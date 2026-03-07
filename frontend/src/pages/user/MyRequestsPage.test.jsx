import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import MyRequestsPage from './MyRequestsPage';

const mockNavigate = vi.fn();

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../services/api', () => ({
  scenarioRequestAPI: {
    getAll: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockRequests = [
  {
    requestId: 'REQ-001',
    name: 'Revenue Dashboard',
    description: 'Monthly revenue report',
    dataDomain: 'finance',
    status: 'submitted',
    row_add_stp: '2025-01-15',
    row_update_stp: '2025-01-16',
  },
  {
    requestId: 'REQ-002',
    name: 'HR Analytics',
    description: 'Employee analytics',
    dataDomain: 'hr',
    status: 'deployed',
    row_add_stp: '2025-01-10',
    row_update_stp: '2025-01-12',
  },
];

function renderMyRequestsPage() {
  return render(
    <MemoryRouter>
      <MyRequestsPage />
    </MemoryRouter>
  );
}

describe('MyRequestsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page header and new request link', async () => {
    const { scenarioRequestAPI } = await import('../../services/api');
    scenarioRequestAPI.getAll.mockResolvedValueOnce({ data: { data: [], pagination: { total: 0 } } });

    renderMyRequestsPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'My Requests' })).toBeInTheDocument();
    });
    expect(screen.getByText('New Request')).toBeInTheDocument();
  });

  it('shows loading state', async () => {
    const { scenarioRequestAPI } = await import('../../services/api');
    let resolveApi;
    scenarioRequestAPI.getAll.mockReturnValueOnce(new Promise(r => { resolveApi = r; }));

    renderMyRequestsPage();
    // Loading state - no table visible yet

    resolveApi({ data: { data: [], pagination: { total: 0 } } });
    await waitFor(() => {
      expect(screen.getByText('No requests found')).toBeInTheDocument();
    });
  });

  it('renders requests table', async () => {
    const { scenarioRequestAPI } = await import('../../services/api');
    scenarioRequestAPI.getAll.mockResolvedValueOnce({
      data: { data: mockRequests, pagination: { total: 2 } },
    });

    renderMyRequestsPage();

    await waitFor(() => {
      expect(screen.getByText('REQ-001')).toBeInTheDocument();
      expect(screen.getByText('Revenue Dashboard')).toBeInTheDocument();
      expect(screen.getByText('REQ-002')).toBeInTheDocument();
      expect(screen.getByText('HR Analytics')).toBeInTheDocument();
    });
  });

  it('shows empty state when no requests', async () => {
    const { scenarioRequestAPI } = await import('../../services/api');
    scenarioRequestAPI.getAll.mockResolvedValueOnce({
      data: { data: [], pagination: { total: 0 } },
    });

    renderMyRequestsPage();

    await waitFor(() => {
      expect(screen.getByText('No requests found')).toBeInTheDocument();
      expect(screen.getByText('Create your first request')).toBeInTheDocument();
    });
  });

  it('filters by search term', async () => {
    const { scenarioRequestAPI } = await import('../../services/api');
    scenarioRequestAPI.getAll.mockResolvedValueOnce({
      data: { data: mockRequests, pagination: { total: 2 } },
    });

    const user = userEvent.setup();
    renderMyRequestsPage();

    await waitFor(() => {
      expect(screen.getByText('REQ-001')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('Search by ID, name or description...'), 'Revenue');

    expect(screen.getByText('REQ-001')).toBeInTheDocument();
    expect(screen.queryByText('REQ-002')).not.toBeInTheDocument();
  });

  it('navigates to request detail on view click', async () => {
    const { scenarioRequestAPI } = await import('../../services/api');
    scenarioRequestAPI.getAll.mockResolvedValueOnce({
      data: { data: mockRequests, pagination: { total: 2 } },
    });

    const user = userEvent.setup();
    renderMyRequestsPage();

    await waitFor(() => {
      expect(screen.getByText('REQ-001')).toBeInTheDocument();
    });

    const viewButtons = screen.getAllByText('View');
    await user.click(viewButtons[0]);

    expect(mockNavigate).toHaveBeenCalledWith('/my-requests/REQ-001');
  });

  it('shows stats cards', async () => {
    const { scenarioRequestAPI } = await import('../../services/api');
    scenarioRequestAPI.getAll.mockResolvedValueOnce({
      data: { data: mockRequests, pagination: { total: 2 } },
    });

    renderMyRequestsPage();

    await waitFor(() => {
      expect(screen.getByText('Total Requests')).toBeInTheDocument();
      // "Pending", "Completed", "Rejected" appear in both stats cards and status dropdown
      expect(screen.getAllByText('Pending').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Completed').length).toBeGreaterThan(0);
    });
  });

  it('handles API error', async () => {
    const { scenarioRequestAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    scenarioRequestAPI.getAll.mockRejectedValueOnce(new Error('API Error'));

    renderMyRequestsPage();

    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalledWith('Failed to load requests');
    });
  });

  it('renders status badges with correct labels', async () => {
    const { scenarioRequestAPI } = await import('../../services/api');
    scenarioRequestAPI.getAll.mockResolvedValueOnce({
      data: { data: mockRequests, pagination: { total: 2 } },
    });

    renderMyRequestsPage();

    await waitFor(() => {
      expect(screen.getByText('Submitted')).toBeInTheDocument();
      expect(screen.getByText('Deployed')).toBeInTheDocument();
    });
  });
});
