import { SupabaseClient } from '@supabase/supabase-js';
import { Hotspot, HotspotAnalytics, CityHotspot } from '../types';

interface GeoPoint {
  latitude: number;
  longitude: number;
}

interface ListingWithGeo {
  id: string;
  latitude: number;
  longitude: number;
  city: string;
  neighborhood?: string;
  estimated_revenue?: number;
  is_registered: boolean;
}

export class HotspotDetectionEngine {
  private supabase: SupabaseClient;
  private clusterRadius: number = 0.01; // Approximately 1km in degrees

  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient;
  }

  /**
   * Get comprehensive hotspot analytics
   */
  async getHotspotAnalytics(): Promise<HotspotAnalytics> {
    const hotspots = await this.detectHotspots();
    const topCities = await this.getTopCitiesByHotspots();

    const totalUnregisteredEstimate = hotspots.reduce(
      (sum, h) => sum + h.unregisteredCount,
      0
    );
    const totalLostRevenueEstimate = hotspots.reduce(
      (sum, h) => sum + h.estimatedLostRevenue,
      0
    );

    return {
      hotspots,
      totalUnregisteredEstimate,
      totalLostRevenueEstimate,
      topCities,
    };
  }

  /**
   * Detect geographic hotspots of unregistered activity
   */
  async detectHotspots(): Promise<Hotspot[]> {
    const unregisteredListings = await this.getUnregisteredListings();

    if (unregisteredListings.length === 0) {
      return [];
    }

    // Cluster nearby listings using DBSCAN-like approach
    const clusters = this.clusterListings(unregisteredListings);

    // Convert clusters to hotspots
    const hotspots: Hotspot[] = clusters.map((cluster, index) => {
      const centroid = this.calculateCentroid(cluster);
      const estimatedLostRevenue = cluster.reduce(
        (sum, listing) => sum + (listing.estimated_revenue || 0),
        0
      );

      // Determine primary city and neighborhood from cluster
      const cityCount = new Map<string, number>();
      const neighborhoodCount = new Map<string, number>();

      cluster.forEach((listing) => {
        cityCount.set(listing.city, (cityCount.get(listing.city) || 0) + 1);
        if (listing.neighborhood) {
          neighborhoodCount.set(
            listing.neighborhood,
            (neighborhoodCount.get(listing.neighborhood) || 0) + 1
          );
        }
      });

      const primaryCity = Array.from(cityCount.entries()).sort(
        (a, b) => b[1] - a[1]
      )[0]?.[0] || 'Unknown';

      const primaryNeighborhood = Array.from(neighborhoodCount.entries()).sort(
        (a, b) => b[1] - a[1]
      )[0]?.[0] || 'Unknown';

      const riskLevel = this.calculateRiskLevel(cluster.length, estimatedLostRevenue);

      return {
        id: `hotspot-${index + 1}`,
        latitude: centroid.latitude,
        longitude: centroid.longitude,
        city: primaryCity,
        neighborhood: primaryNeighborhood,
        unregisteredCount: cluster.length,
        estimatedLostRevenue,
        riskLevel,
        lastUpdated: new Date(),
      };
    });

    // Sort by unregistered count descending
    return hotspots.sort((a, b) => b.unregisteredCount - a.unregisteredCount);
  }

  /**
   * Get unregistered listings with geographic data
   */
  private async getUnregisteredListings(): Promise<ListingWithGeo[]> {
    const { data, error } = await this.supabase
      .from('scraped_listings')
      .select('id, latitude, longitude, city, neighborhood, estimated_revenue')
      .eq('matched_registration', false)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);

    if (error) {
      console.error('Error fetching unregistered listings:', error);
      return [];
    }

    return (data || []).map((listing) => ({
      ...listing,
      is_registered: false,
    }));
  }

  /**
   * Cluster listings using density-based approach
   */
  private clusterListings(listings: ListingWithGeo[]): ListingWithGeo[][] {
    const clusters: ListingWithGeo[][] = [];
    const visited = new Set<string>();
    const minClusterSize = 3; // Minimum listings to form a hotspot

    for (const listing of listings) {
      if (visited.has(listing.id)) continue;

      const cluster: ListingWithGeo[] = [];
      this.expandCluster(listing, listings, cluster, visited);

      if (cluster.length >= minClusterSize) {
        clusters.push(cluster);
      }
    }

    return clusters;
  }

  /**
   * Expand cluster by finding nearby listings
   */
  private expandCluster(
    listing: ListingWithGeo,
    allListings: ListingWithGeo[],
    cluster: ListingWithGeo[],
    visited: Set<string>
  ): void {
    if (visited.has(listing.id)) return;

    visited.add(listing.id);
    cluster.push(listing);

    const neighbors = this.getNeighbors(listing, allListings);

    for (const neighbor of neighbors) {
      if (!visited.has(neighbor.id)) {
        this.expandCluster(neighbor, allListings, cluster, visited);
      }
    }
  }

  /**
   * Get listings within cluster radius
   */
  private getNeighbors(
    listing: ListingWithGeo,
    allListings: ListingWithGeo[]
  ): ListingWithGeo[] {
    return allListings.filter((other) => {
      if (other.id === listing.id) return false;
      const distance = this.calculateDistance(
        { latitude: listing.latitude, longitude: listing.longitude },
        { latitude: other.latitude, longitude: other.longitude }
      );
      return distance <= this.clusterRadius;
    });
  }

  /**
   * Calculate Euclidean distance between two points
   */
  private calculateDistance(point1: GeoPoint, point2: GeoPoint): number {
    const latDiff = point1.latitude - point2.latitude;
    const lonDiff = point1.longitude - point2.longitude;
    return Math.sqrt(latDiff * latDiff + lonDiff * lonDiff);
  }

  /**
   * Calculate centroid of a cluster
   */
  private calculateCentroid(cluster: ListingWithGeo[]): GeoPoint {
    const sumLat = cluster.reduce((sum, l) => sum + l.latitude, 0);
    const sumLon = cluster.reduce((sum, l) => sum + l.longitude, 0);

    return {
      latitude: sumLat / cluster.length,
      longitude: sumLon / cluster.length,
    };
  }

  /**
   * Calculate risk level based on cluster metrics
   */
  private calculateRiskLevel(
    count: number,
    lostRevenue: number
  ): 'low' | 'medium' | 'high' | 'critical' {
    const countScore = count >= 20 ? 4 : count >= 10 ? 3 : count >= 5 ? 2 : 1;
    const revenueScore =
      lostRevenue >= 100000 ? 4 : lostRevenue >= 50000 ? 3 : lostRevenue >= 20000 ? 2 : 1;

    const combinedScore = (countScore + revenueScore) / 2;

    if (combinedScore >= 3.5) return 'critical';
    if (combinedScore >= 2.5) return 'high';
    if (combinedScore >= 1.5) return 'medium';
    return 'low';
  }

  /**
   * Get top cities by hotspot activity
   */
  async getTopCitiesByHotspots(): Promise<CityHotspot[]> {
    const hotspots = await this.detectHotspots();

    const cityMap = new Map<
      string,
      { count: number; unregistered: number; lostRevenue: number }
    >();

    hotspots.forEach((hotspot) => {
      const current = cityMap.get(hotspot.city) || {
        count: 0,
        unregistered: 0,
        lostRevenue: 0,
      };
      cityMap.set(hotspot.city, {
        count: current.count + 1,
        unregistered: current.unregistered + hotspot.unregisteredCount,
        lostRevenue: current.lostRevenue + hotspot.estimatedLostRevenue,
      });
    });

    return Array.from(cityMap.entries())
      .map(([city, data]) => ({
        city,
        hotspotCount: data.count,
        unregisteredEstimate: data.unregistered,
        lostRevenueEstimate: data.lostRevenue,
      }))
      .sort((a, b) => b.hotspotCount - a.hotspotCount);
  }

  /**
   * Get hotspots within a specific bounding box
   */
  async getHotspotsInBounds(
    minLat: number,
    maxLat: number,
    minLon: number,
    maxLon: number
  ): Promise<Hotspot[]> {
    const allHotspots = await this.detectHotspots();

    return allHotspots.filter(
      (hotspot) =>
        hotspot.latitude >= minLat &&
        hotspot.latitude <= maxLat &&
        hotspot.longitude >= minLon &&
        hotspot.longitude <= maxLon
    );
  }

  /**
   * Get hotspots for a specific city
   */
  async getHotspotsByCity(city: string): Promise<Hotspot[]> {
    const allHotspots = await this.detectHotspots();
    return allHotspots.filter(
      (hotspot) => hotspot.city.toLowerCase() === city.toLowerCase()
    );
  }
}
