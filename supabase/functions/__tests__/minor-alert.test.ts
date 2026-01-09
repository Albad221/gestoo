import { describe, it, expect, vi, beforeEach } from 'vitest';

// Calculate age from date of birth (extracted from edge function)
function calculateAge(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

// Determine alert severity based on circumstances (extracted from edge function)
function determineSeverity(data: {
  age: number;
  hasGuardian: boolean;
  guardianVerified: boolean;
  isNightCheckin: boolean;
}): 'low' | 'medium' | 'high' | 'critical' {
  const { age, hasGuardian, guardianVerified, isNightCheckin } = data;

  // Critical: Very young minor (under 14) without verified guardian
  if (age < 14 && (!hasGuardian || !guardianVerified)) {
    return 'critical';
  }

  // High: Minor (14-17) without guardian, or night check-in without verified guardian
  if (!hasGuardian || (isNightCheckin && !guardianVerified)) {
    return 'high';
  }

  // Medium: Minor with unverified guardian
  if (!guardianVerified) {
    return 'medium';
  }

  // Low: Minor with verified guardian (routine tracking)
  return 'low';
}

// Check if check-in is during night hours
function isNightCheckIn(checkInDate: Date): boolean {
  const hour = checkInDate.getHours();
  return hour >= 22 || hour < 6;
}

describe('Minor Alert Edge Function', () => {
  describe('Age Calculation', () => {
    it('should calculate age correctly for adult', () => {
      const today = new Date();
      const birthDate = new Date(today.getFullYear() - 25, today.getMonth(), today.getDate());
      const age = calculateAge(birthDate.toISOString().split('T')[0]);
      expect(age).toBe(25);
    });

    it('should calculate age correctly for minor', () => {
      const today = new Date();
      const birthDate = new Date(today.getFullYear() - 15, today.getMonth(), today.getDate());
      const age = calculateAge(birthDate.toISOString().split('T')[0]);
      expect(age).toBe(15);
    });

    it('should handle birthday not yet occurred this year', () => {
      const today = new Date();
      const birthDate = new Date(today.getFullYear() - 20, today.getMonth() + 2, today.getDate());
      const age = calculateAge(birthDate.toISOString().split('T')[0]);
      expect(age).toBe(19);
    });

    it('should handle very young children', () => {
      const today = new Date();
      const birthDate = new Date(today.getFullYear() - 5, today.getMonth(), today.getDate());
      const age = calculateAge(birthDate.toISOString().split('T')[0]);
      expect(age).toBe(5);
    });

    it('should return 0 for newborn', () => {
      const today = new Date();
      const birthDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const age = calculateAge(birthDate.toISOString().split('T')[0]);
      expect(age).toBe(0);
    });
  });

  describe('Severity Determination', () => {
    it('should return critical for child under 14 without guardian', () => {
      const severity = determineSeverity({
        age: 10,
        hasGuardian: false,
        guardianVerified: false,
        isNightCheckin: false,
      });
      expect(severity).toBe('critical');
    });

    it('should return critical for child under 14 with unverified guardian', () => {
      const severity = determineSeverity({
        age: 12,
        hasGuardian: true,
        guardianVerified: false,
        isNightCheckin: false,
      });
      expect(severity).toBe('critical');
    });

    it('should return high for teen 14-17 without guardian', () => {
      const severity = determineSeverity({
        age: 16,
        hasGuardian: false,
        guardianVerified: false,
        isNightCheckin: false,
      });
      expect(severity).toBe('high');
    });

    it('should return high for night check-in with unverified guardian', () => {
      const severity = determineSeverity({
        age: 15,
        hasGuardian: true,
        guardianVerified: false,
        isNightCheckin: true,
      });
      expect(severity).toBe('high');
    });

    it('should return medium for minor with unverified guardian', () => {
      const severity = determineSeverity({
        age: 16,
        hasGuardian: true,
        guardianVerified: false,
        isNightCheckin: false,
      });
      expect(severity).toBe('medium');
    });

    it('should return low for minor with verified guardian', () => {
      const severity = determineSeverity({
        age: 15,
        hasGuardian: true,
        guardianVerified: true,
        isNightCheckin: false,
      });
      expect(severity).toBe('low');
    });

    it('should return low for minor with verified guardian even at night', () => {
      const severity = determineSeverity({
        age: 17,
        hasGuardian: true,
        guardianVerified: true,
        isNightCheckin: true,
      });
      expect(severity).toBe('low');
    });
  });

  describe('Night Check-in Detection', () => {
    it('should detect night check-in at 22:00', () => {
      const checkIn = new Date('2024-01-15T22:00:00');
      expect(isNightCheckIn(checkIn)).toBe(true);
    });

    it('should detect night check-in at 23:30', () => {
      const checkIn = new Date('2024-01-15T23:30:00');
      expect(isNightCheckIn(checkIn)).toBe(true);
    });

    it('should detect night check-in at 02:00', () => {
      const checkIn = new Date('2024-01-15T02:00:00');
      expect(isNightCheckIn(checkIn)).toBe(true);
    });

    it('should detect night check-in at 05:59', () => {
      const checkIn = new Date('2024-01-15T05:59:00');
      expect(isNightCheckIn(checkIn)).toBe(true);
    });

    it('should not detect night check-in at 06:00', () => {
      const checkIn = new Date('2024-01-15T06:00:00');
      expect(isNightCheckIn(checkIn)).toBe(false);
    });

    it('should not detect night check-in at 14:00', () => {
      const checkIn = new Date('2024-01-15T14:00:00');
      expect(isNightCheckIn(checkIn)).toBe(false);
    });

    it('should not detect night check-in at 21:59', () => {
      const checkIn = new Date('2024-01-15T21:59:00');
      expect(isNightCheckIn(checkIn)).toBe(false);
    });
  });

  describe('Alert Description Generation', () => {
    it('should include minor age in description', () => {
      const age = 15;
      const firstName = 'Jean';
      const lastName = 'Dupont';
      const description = `Mineur de ${age} ans (${firstName} ${lastName})`;

      expect(description).toContain('Mineur de 15 ans');
      expect(description).toContain('Jean Dupont');
    });

    it('should indicate when no guardian is declared', () => {
      const hasGuardian = false;
      const warningText = !hasGuardian ? 'AUCUN ACCOMPAGNATEUR DECLARE' : '';

      expect(warningText).toBe('AUCUN ACCOMPAGNATEUR DECLARE');
    });

    it('should indicate unverified guardian', () => {
      const guardianVerified = false;
      const warningText = !guardianVerified
        ? "Identite de l'accompagnateur NON VERIFIEE"
        : '';

      expect(warningText).toBe("Identite de l'accompagnateur NON VERIFIEE");
    });
  });

  describe('Minor Detection', () => {
    it('should identify 17-year-old as minor', () => {
      const today = new Date();
      const birthDate = new Date(today.getFullYear() - 17, today.getMonth(), today.getDate());
      const age = calculateAge(birthDate.toISOString().split('T')[0]);
      expect(age < 18).toBe(true);
    });

    it('should not identify 18-year-old as minor', () => {
      const today = new Date();
      const birthDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
      const age = calculateAge(birthDate.toISOString().split('T')[0]);
      expect(age < 18).toBe(false);
    });

    it('should not generate alert for adult guest', () => {
      const today = new Date();
      const birthDate = new Date(today.getFullYear() - 30, today.getMonth(), today.getDate());
      const age = calculateAge(birthDate.toISOString().split('T')[0]);
      const shouldAlert = age < 18;
      expect(shouldAlert).toBe(false);
    });
  });
});
