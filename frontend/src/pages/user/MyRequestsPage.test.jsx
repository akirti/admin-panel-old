import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import MyRequestsPage from './MyRequestsPage';

const mockNavigate = jest.fn();

jest.mock('react-router', () => {
  const actual = jest.requireActual('react-router');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

jest.mock('../../services/api', () => ({
  scenarioRequestAPI: {
    getAll: jest.fn(),
  },
}));

jest.mock('react-hot-toast', () => ({ __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
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
    jest.clearAllMocks();
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

  it('filters by status', async () => {
    const { scenarioRequestAPI } = await import('../../services/api');
    scenarioRequestAPI.getAll.mockResolvedValue({
      data: { data: mockRequests, pagination: { total: 2 } },
    });

    const user = userEvent.setup();
    renderMyRequestsPage();

    await waitFor(() => {
      expect(screen.getByText('REQ-001')).toBeInTheDocument();
    });

    const statusSelect = screen.getByDisplayValue('All Status');
    await user.selectOptions(statusSelect, 'submitted');

    // After filtering, only submitted request should show
    expect(screen.getByText('REQ-001')).toBeInTheDocument();
    expect(screen.queryByText('REQ-002')).not.toBeInTheDocument();
  });

  it('renders pagination when more than one page', async () => {
    const { scenarioRequestAPI } = await import('../../services/api');
    scenarioRequestAPI.getAll.mockResolvedValue({
      data: {
        data: mockRequests,
        pagination: { total: 25 },
      },
    });

    renderMyRequestsPage();

    await waitFor(() => {
      expect(screen.getByText('REQ-001')).toBeInTheDocument();
    });

    expect(screen.getByText(/Page 1 of/)).toBeInTheDocument();
    expect(screen.getByText(/Showing 1 to/)).toBeInTheDocument();
  });

  it('handles refresh button click', async () => {
    const { scenarioRequestAPI } = await import('../../services/api');
    scenarioRequestAPI.getAll.mockResolvedValue({
      data: { data: mockRequests, pagination: { total: 2 } },
    });

    const user = userEvent.setup();
    renderMyRequestsPage();

    await waitFor(() => {
      expect(screen.getByText('REQ-001')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Refresh'));

    await waitFor(() => {
      expect(scenarioRequestAPI.getAll).toHaveBeenCalledTimes(2);
    });
  });

  it('handles unknown status gracefully', async () => {
    const { scenarioRequestAPI } = await import('../../services/api');
    scenarioRequestAPI.getAll.mockResolvedValueOnce({
      data: {
        data: [{ ...mockRequests[0], status: 'unknown-status' }],
        pagination: { total: 1 },
      },
    });

    renderMyRequestsPage();

    await waitFor(() => {
      expect(screen.getByText('unknown-status')).toBeInTheDocument();
    });
  });

  it('shows various status badges', async () => {
    const { scenarioRequestAPI } = await import('../../services/api');
    const allStatusRequests = [
      { ...mockRequests[0], requestId: 'R1', status: 'review' },
      { ...mockRequests[0], requestId: 'R2', status: 'rejected' },
      { ...mockRequests[0], requestId: 'R3', status: 'accepted' },
      { ...mockRequests[0], requestId: 'R4', status: 'in-progress' },
      { ...mockRequests[0], requestId: 'R5', status: 'development' },
      { ...mockRequests[0], requestId: 'R6', status: 'testing' },
      { ...mockRequests[0], requestId: 'R7', status: 'snapshot' },
      { ...mockRequests[0], requestId: 'R8', status: 'active' },
      { ...mockRequests[0], requestId: 'R9', status: 'inactive' },
    ];
    scenarioRequestAPI.getAll.mockResolvedValueOnce({
      data: { data: allStatusRequests, pagination: { total: 9 } },
    });

    renderMyRequestsPage();

    await waitFor(() => {
      expect(screen.getByText('Review')).toBeInTheDocument();
      expect(screen.getAllByText('Rejected').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Accepted')).toBeInTheDocument();
      expect(screen.getByText('In Progress')).toBeInTheDocument();
      expect(screen.getByText('Development')).toBeInTheDocument();
      expect(screen.getByText('Testing')).toBeInTheDocument();
      expect(screen.getByText('Files Ready')).toBeInTheDocument();
    });
  });

  it('shows dash for null date', async () => {
    const { scenarioRequestAPI } = await import('../../services/api');
    scenarioRequestAPI.getAll.mockResolvedValueOnce({
      data: {
        data: [{ ...mockRequests[0], row_add_stp: null, row_update_stp: null }],
        pagination: { total: 1 },
      },
    });

    renderMyRequestsPage();

    await waitFor(() => {
      const dashes = screen.getAllByText('-');
      expect(dashes.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('truncates long descriptions', async () => {
    const { scenarioRequestAPI } = await import('../../services/api');
    const longDesc = 'A'.repeat(100);
    scenarioRequestAPI.getAll.mockResolvedValueOnce({
      data: {
        data: [{ ...mockRequests[0], description: longDesc }],
        pagination: { total: 1 },
      },
    });

    renderMyRequestsPage();

    await waitFor(() => {
      expect(screen.getByText(/\.\.\.$/)).toBeInTheDocument();
    });
  });
});
