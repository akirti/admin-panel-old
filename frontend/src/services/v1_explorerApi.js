import axios from 'axios';
import api from './api';
import { API_BASE_URL, PREVAIL_API_BASE_URL } from '../config/env';

// Create a separate axios instance for prevail if it has a different base URL
const prevailInstance = PREVAIL_API_BASE_URL !== API_BASE_URL
  ? axios.create({
      baseURL: PREVAIL_API_BASE_URL,
      headers: { 'Content-Type': 'application/json' },
      withCredentials: true,
    })
  : api;

// Explorer API - Query execution via prevail endpoint
export const prevailAPI = {
  execute: (scenarioKey, payload) => prevailInstance.post(`/prevail/${scenarioKey}`, payload),
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
