import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import DomainsPage from './DomainsPage';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    hasAccessToDomain: vi.fn(() => true),
  }),
}));

vi.mock('../../services/api', () => ({
  domainAPI: {
    getAll: vi.fn(),
  },
}));

function renderDomainsPage() {
  return render(
    <MemoryRouter>
      <DomainsPage />
    </MemoryRouter>
  );
}

describe('DomainsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', async () => {
    const { domainAPI } = await import('../../services/api');
    let resolveApi;
    domainAPI.getAll.mockReturnValueOnce(new Promise(r => { resolveApi = r; }));

    renderDomainsPage();
    // Should show loading spinner (no heading visible during loading)
    expect(screen.queryByText('My Domains')).not.toBeInTheDocument();

    resolveApi({ data: [] });
    await waitFor(() => {
      expect(screen.getByText('My Domains')).toBeInTheDocument();
    });
  });

  it('renders domain list', async () => {
    const { domainAPI } = await import('../../services/api');
    domainAPI.getAll.mockResolvedValueOnce({
      data: [
        { key: 'finance', name: 'Finance', description: 'Financial data' },
        { key: 'hr', name: 'Human Resources', description: 'HR data' },
      ],
    });

    renderDomainsPage();

    await waitFor(() => {
      expect(screen.getByText('Finance')).toBeInTheDocument();
      expect(screen.getByText('Human Resources')).toBeInTheDocument();
    });
  });

  it('shows empty state when no domains', async () => {
    const { domainAPI } = await import('../../services/api');
    domainAPI.getAll.mockResolvedValueOnce({ data: [] });

    renderDomainsPage();

    await waitFor(() => {
      expect(screen.getByText('No Domains Found')).toBeInTheDocument();
      expect(screen.getByText("You don't have access to any domains yet.")).toBeInTheDocument();
    });
  });

  it('filters domains by search term', async () => {
    const { domainAPI } = await import('../../services/api');
    domainAPI.getAll.mockResolvedValueOnce({
      data: [
        { key: 'finance', name: 'Finance', description: 'Financial data' },
        { key: 'hr', name: 'Human Resources', description: 'HR data' },
      ],
    });

    const user = userEvent.setup();
    renderDomainsPage();

    await waitFor(() => {
      expect(screen.getByText('Finance')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('Search domains...'), 'finance');

    expect(screen.getByText('Finance')).toBeInTheDocument();
    expect(screen.queryByText('Human Resources')).not.toBeInTheDocument();
  });

  it('shows no results message when search has no matches', async () => {
    const { domainAPI } = await import('../../services/api');
    domainAPI.getAll.mockResolvedValueOnce({
      data: [{ key: 'finance', name: 'Finance' }],
    });

    const user = userEvent.setup();
    renderDomainsPage();

    await waitFor(() => {
      expect(screen.getByText('Finance')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('Search domains...'), 'xyz');

    expect(screen.getByText('No Domains Found')).toBeInTheDocument();
    expect(screen.getByText('No domains match your search criteria.')).toBeInTheDocument();
  });

  it('handles API error gracefully', async () => {
    const { domainAPI } = await import('../../services/api');
    domainAPI.getAll.mockRejectedValueOnce(new Error('API Error'));

    renderDomainsPage();

    await waitFor(() => {
      expect(screen.getByText('No Domains Found')).toBeInTheDocument();
    });
  });
});
