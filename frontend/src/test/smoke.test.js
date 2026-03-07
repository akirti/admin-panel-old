import { describe, it, expect } from 'vitest';

describe('Test infrastructure smoke test', () => {
  it('vitest runs', () => {
    expect(1 + 1).toBe(2);
  });

  it('jsdom environment is available', () => {
    expect(document).toBeDefined();
    expect(window).toBeDefined();
  });

  it('window.__env is set from setup', () => {
    expect(window.__env.ENV).toBe('test');
    expect(window.__env.API_BASE_URL).toBe('/api/v1');
  });
});
