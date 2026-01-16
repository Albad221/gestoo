'use client';

import { QueryResult } from '@/lib/ai-assistant/types';

interface DataCardProps {
  data: QueryResult;
}

export function DataCard({ data }: DataCardProps) {
  if (!data) return null;

  return (
    <div className="w-full bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      {data.title && (
        <div className="px-4 py-3 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-gray-500 text-sm">
              {getIcon(data.type)}
            </span>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {data.title}
            </span>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        {data.type === 'count' && (
          <div className="text-center py-4">
            <div className="text-4xl font-bold text-primary">{data.value}</div>
          </div>
        )}

        {data.type === 'stats' && (
          <div className="text-center py-4">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {data.value}
            </div>
          </div>
        )}

        {data.type === 'details' && data.items && data.items.length > 0 && (
          <div className="space-y-2">
            {Object.entries(data.items[0] as Record<string, unknown>)
              .filter(([key]) => data.columns?.includes(key))
              .map(([key, value]) => (
                <div key={key} className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800 last:border-0">
                  <span className="text-sm text-gray-500">{formatLabel(key)}</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {formatValue(value)}
                  </span>
                </div>
              ))}
          </div>
        )}

        {(data.type === 'table' || data.type === 'list') && data.items && data.items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  {data.columns?.map((col) => (
                    <th
                      key={col}
                      className="text-left py-2 px-2 text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      {formatLabel(col)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.items.slice(0, 10).map((item, idx) => {
                  const row = item as Record<string, unknown>;
                  return (
                    <tr
                      key={idx}
                      className="border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      {data.columns?.map((col) => (
                        <td key={col} className="py-2 px-2 text-gray-900 dark:text-white">
                          {formatValue(row[col])}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {data.items.length > 10 && (
              <div className="text-center py-2 text-xs text-gray-500">
                ...et {data.items.length - 10} autres
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function getIcon(type: string): string {
  switch (type) {
    case 'count':
      return 'tag';
    case 'stats':
      return 'analytics';
    case 'details':
      return 'info';
    case 'table':
    case 'list':
      return 'table_chart';
    default:
      return 'data_object';
  }
}

function formatLabel(key: string): string {
  const labels: Record<string, string> = {
    name: 'Nom',
    type: 'Type',
    city: 'Ville',
    region: 'Région',
    address: 'Adresse',
    num_rooms: 'Chambres',
    status: 'Statut',
    registration_number: 'N° Enreg.',
    severity: 'Sévérité',
    title: 'Titre',
    created_at: 'Date',
    platform: 'Plateforme',
    host_name: 'Hôte',
    price: 'Prix',
    is_compliant: 'Conforme',
  };
  return labels[key] || key.replace(/_/g, ' ');
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '-';
  }
  if (typeof value === 'boolean') {
    return value ? 'Oui' : 'Non';
  }
  if (typeof value === 'number') {
    return value.toLocaleString('fr-FR');
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return new Date(value).toLocaleDateString('fr-FR');
  }
  return String(value);
}
