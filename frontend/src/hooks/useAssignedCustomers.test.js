import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import useAssignedCustomers from './useAssignedCustomers';

// Mock the API module
vi.mock('../services/api', () => ({
  usersAPI: {
    getAssignedCustomers: vi.fn(),
    getCustomerTags: vi.fn(),
  },
}));

import { usersAPI } from '../services/api';

const mockCustomers = [
  { id: '1', name: 'Alice Corp', tags: ['vip', 'enterprise'] },
  { id: '2', name: 'Bob LLC', tags: ['startup'] },
  { id: '3', name: 'Charlie Inc', tags: ['vip'] },
];

const mockTags = ['vip', 'enterprise', 'startup'];

// Helper: flush microtasks so resolved promises settle
const flushPromises = () => new Promise((r) => setTimeout(r, 0));

describe('useAssignedCustomers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usersAPI.getAssignedCustomers.mockResolvedValue({
      data: { customers: mockCustomers },
    });
    usersAPI.getCustomerTags.mockResolvedValue({
      data: { tags: mockTags },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts in loading state', () => {
    const { result } = renderHook(() => useAssignedCustomers());
    expect(result.current.loading).toBe(true);
    expect(result.current.customers).toEqual([]);
    expect(result.current.tags).toEqual([]);
    expect(result.current.hasAssigned).toBe(false);
  });

  it('fetches customers and tags on mount', async () => {
    const { result } = renderHook(() => useAssignedCustomers());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.customers).toEqual(mockCustomers);
    expect(result.current.tags).toEqual(mockTags);
    expect(result.current.hasAssigned).toBe(true);
    expect(usersAPI.getAssignedCustomers).toHaveBeenCalledTimes(1);
    expect(usersAPI.getCustomerTags).toHaveBeenCalledTimes(1);
  });

  it('sets hasAssigned to false when no customers are returned', async () => {
    usersAPI.getAssignedCustomers.mockResolvedValue({
      data: { customers: [] },
    });

    const { result } = renderHook(() => useAssignedCustomers());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.customers).toEqual([]);
    expect(result.current.hasAssigned).toBe(false);
  });

  it('handles API errors gracefully', async () => {
    usersAPI.getAssignedCustomers.mockRejectedValue(new Error('Network error'));
    usersAPI.getCustomerTags.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useAssignedCustomers());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.customers).toEqual([]);
    expect(result.current.tags).toEqual([]);
    expect(result.current.hasAssigned).toBe(false);
  });

  it('handles missing data fields in API response', async () => {
    usersAPI.getAssignedCustomers.mockResolvedValue({ data: {} });
    usersAPI.getCustomerTags.mockResolvedValue({ data: {} });

    const { result } = renderHook(() => useAssignedCustomers());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.customers).toEqual([]);
    expect(result.current.tags).toEqual([]);
    expect(result.current.hasAssigned).toBe(false);
  });

  it('filterByTag filters customers client-side', async () => {
    const { result } = renderHook(() => useAssignedCustomers());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.filterByTag('vip');
    });

    expect(result.current.customers).toEqual([
      { id: '1', name: 'Alice Corp', tags: ['vip', 'enterprise'] },
      { id: '3', name: 'Charlie Inc', tags: ['vip'] },
    ]);
  });

  it('filterByTag with null/empty restores full list', async () => {
    const { result } = renderHook(() => useAssignedCustomers());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Filter first
    act(() => {
      result.current.filterByTag('startup');
    });

    expect(result.current.customers).toHaveLength(1);

    // Clear filter
    act(() => {
      result.current.filterByTag('');
    });

    expect(result.current.customers).toEqual(mockCustomers);
  });

  it('filterByTag with no matching tag returns empty list', async () => {
    const { result } = renderHook(() => useAssignedCustomers());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.filterByTag('nonexistent');
    });

    expect(result.current.customers).toEqual([]);
  });

  it('empty search restores full customer list immediately', async () => {
    const { result } = renderHook(() => useAssignedCustomers());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Search with empty string should immediately restore full list
    act(() => {
      result.current.search('');
    });

    expect(result.current.customers).toEqual(mockCustomers);
  });

  it('whitespace-only search restores full customer list', async () => {
    const { result } = renderHook(() => useAssignedCustomers());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.search('   ');
    });

    expect(result.current.customers).toEqual(mockCustomers);
  });
});

// Tests that require fake timers are separated so waitFor works in the main suite
describe('useAssignedCustomers - debounce search', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.clearAllMocks();
    usersAPI.getAssignedCustomers.mockResolvedValue({
      data: { customers: mockCustomers },
    });
    usersAPI.getCustomerTags.mockResolvedValue({
      data: { tags: mockTags },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('search with debounce calls API after 300ms', async () => {
    const { result } = renderHook(() => useAssignedCustomers());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Setup the search result
    const searchResults = [{ id: '1', name: 'Alice Corp', tags: ['vip', 'enterprise'] }];
    usersAPI.getAssignedCustomers.mockResolvedValue({
      data: { customers: searchResults },
    });

    act(() => {
      result.current.search('Alice');
    });

    // API should not have been called again yet (debounce not elapsed)
    expect(usersAPI.getAssignedCustomers).toHaveBeenCalledTimes(1);

    // Advance timers past debounce threshold
    await act(async () => {
      vi.advanceTimersByTime(300);
      await flushPromises();
    });

    await waitFor(() => {
      expect(usersAPI.getAssignedCustomers).toHaveBeenCalledTimes(2);
    });

    expect(usersAPI.getAssignedCustomers).toHaveBeenLastCalledWith({ search: 'Alice' });
    expect(result.current.customers).toEqual(searchResults);
  });

  it('search debounce cancels previous pending search', async () => {
    const { result } = renderHook(() => useAssignedCustomers());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    usersAPI.getAssignedCustomers.mockResolvedValue({
      data: { customers: [mockCustomers[1]] },
    });

    // Fire multiple searches rapidly
    act(() => {
      result.current.search('A');
    });
    act(() => {
      result.current.search('Al');
    });
    act(() => {
      result.current.search('Ali');
    });

    await act(async () => {
      vi.advanceTimersByTime(300);
      await flushPromises();
    });

    await waitFor(() => {
      // Only the last search should have triggered an API call
      // 1 from mount + 1 from the final debounced search = 2
      expect(usersAPI.getAssignedCustomers).toHaveBeenCalledTimes(2);
    });

    expect(usersAPI.getAssignedCustomers).toHaveBeenLastCalledWith({ search: 'Ali' });
  });

  it('search API error keeps current list', async () => {
    const { result } = renderHook(() => useAssignedCustomers());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const originalCustomers = result.current.customers;

    // Make search API fail
    usersAPI.getAssignedCustomers.mockRejectedValue(new Error('Search failed'));

    act(() => {
      result.current.search('fail');
    });

    await act(async () => {
      vi.advanceTimersByTime(300);
      await flushPromises();
    });

    // Wait a bit for the catch block to execute
    await act(async () => {
      await flushPromises();
    });

    // Should keep the current list on error
    expect(result.current.customers).toEqual(originalCustomers);
  });
});
