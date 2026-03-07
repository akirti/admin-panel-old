import api from './api';

// Explorer API - Query execution via prevail endpoint.
// Always routes through our backend's /prevail proxy which handles
// auth token extraction and forwarding to the external Prevail service.
export const prevailAPI = {
  execute: (scenarioKey, payload) => api.post(`/prevail/${scenarioKey}`, payload),
};

// Download API for explorer reports
export const downloadAPI = {
  fullReport: (params) => api.get('/download', { params, responseType: 'blob' }),
  currentPage: (data, format = 'csv') => {
    // Client-side download - creates blob from data array
    if (format === 'json') {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      return blob;
    }
    // CSV format
    if (!data || data.length === 0) return null;
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(h => {
        const val = row[h] ?? '';
        return typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))
          ? `"${val.replace(/"/g, '""')}"` : val;
      }).join(','))
    ].join('\n');
    return new Blob([csvContent], { type: 'text/csv' });
  }
};

export default { prevailAPI, downloadAPI };
