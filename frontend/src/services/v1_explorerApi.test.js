import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted() so the mock value exists when the hoisted vi.mock factory runs
const { mockApi } = vi.hoisted(() => {
  const mock = {
    get: vi.fn(() => Promise.resolve({ data: {} })),
    post: vi.fn(() => Promise.resolve({ data: {} })),
    put: vi.fn(() => Promise.resolve({ data: {} })),
    delete: vi.fn(() => Promise.resolve({ data: {} })),
  };
  return { mockApi: mock };
});

vi.mock('./api', () => ({
  default: mockApi,
}));

import { prevailAPI, downloadAPI } from './v1_explorerApi.js';
import defaultExport from './v1_explorerApi.js';

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Exports ─────────────────────────────────────────────────────────────────

describe('v1_explorerApi exports', () => {
  it('exports prevailAPI object', () => {
    expect(prevailAPI).toBeDefined();
    expect(typeof prevailAPI).toBe('object');
  });

  it('exports downloadAPI object', () => {
    expect(downloadAPI).toBeDefined();
    expect(typeof downloadAPI).toBe('object');
  });

  it('default export contains prevailAPI and downloadAPI', () => {
    expect(defaultExport).toBeDefined();
    expect(defaultExport.prevailAPI).toBe(prevailAPI);
    expect(defaultExport.downloadAPI).toBe(downloadAPI);
  });
});

// ─── prevailAPI ──────────────────────────────────────────────────────────────

describe('prevailAPI', () => {
  it('has an execute method', () => {
    expect(typeof prevailAPI.execute).toBe('function');
  });

  it('execute calls api.post with /prevail/:scenarioKey and payload', () => {
    const payload = { query: 'SELECT 1', filters: {} };
    prevailAPI.execute('test-scenario', payload);
    expect(mockApi.post).toHaveBeenCalledWith('/prevail/test-scenario', payload);
  });

  it('execute returns the promise from api.post', async () => {
    const mockResponse = { data: { rows: [{ id: 1 }] } };
    mockApi.post.mockResolvedValueOnce(mockResponse);

    const result = await prevailAPI.execute('my-key', { q: 'test' });
    expect(result).toEqual(mockResponse);
  });
});

// ─── downloadAPI ─────────────────────────────────────────────────────────────

describe('downloadAPI', () => {
  describe('fullReport', () => {
    it('calls api.get /download with params and blob responseType', () => {
      const params = { scenario_key: 'sc1', format: 'csv' };
      downloadAPI.fullReport(params);
      expect(mockApi.get).toHaveBeenCalledWith('/download', {
        params,
        responseType: 'blob',
      });
    });

    it('returns the promise from api.get', async () => {
      const mockBlob = new Blob(['data'], { type: 'text/csv' });
      mockApi.get.mockResolvedValueOnce({ data: mockBlob });

      const result = await downloadAPI.fullReport({ key: 'x' });
      expect(result.data).toBeInstanceOf(Blob);
    });
  });

  describe('currentPage', () => {
    it('returns a JSON Blob when format is json', () => {
      const data = [{ id: 1, name: 'Alpha' }];
      const blob = downloadAPI.currentPage(data, 'json');
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('application/json');
    });

    it('returns a CSV Blob when format is csv (default)', () => {
      const data = [
        { id: 1, name: 'Alpha' },
        { id: 2, name: 'Beta' },
      ];
      const blob = downloadAPI.currentPage(data);
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('text/csv');
    });

    it('returns null for empty data array with csv format', () => {
      const result = downloadAPI.currentPage([], 'csv');
      expect(result).toBeNull();
    });

    it('returns null for null/undefined data with csv format', () => {
      expect(downloadAPI.currentPage(null)).toBeNull();
      expect(downloadAPI.currentPage(undefined)).toBeNull();
    });

    it('properly escapes CSV values containing commas', () => {
      const data = [{ col: 'value, with comma' }];
      const blob = downloadAPI.currentPage(data);
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('text/csv');
    });

    it('properly escapes CSV values containing double quotes', () => {
      const data = [{ col: 'value "with" quotes' }];
      const blob = downloadAPI.currentPage(data);
      expect(blob).toBeInstanceOf(Blob);
    });

    it('properly escapes CSV values containing newlines', () => {
      const data = [{ col: 'line1\nline2' }];
      const blob = downloadAPI.currentPage(data);
      expect(blob).toBeInstanceOf(Blob);
    });

    it('handles null/undefined cell values gracefully', () => {
      const data = [{ a: null, b: undefined, c: 'ok' }];
      const blob = downloadAPI.currentPage(data);
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('text/csv');
    });

    it('creates correct CSV content structure', async () => {
      const data = [
        { id: 1, name: 'Alpha' },
        { id: 2, name: 'Beta' },
      ];
      const blob = downloadAPI.currentPage(data);
      const text = await blob.text();
      const lines = text.split('\n');
      expect(lines[0]).toBe('id,name');
      expect(lines[1]).toBe('1,Alpha');
      expect(lines[2]).toBe('2,Beta');
      expect(lines.length).toBe(3);
    });
  });
});
