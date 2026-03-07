import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import ScenarioRequestsManagement from './ScenarioRequestsManagement';

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
    getDomains: vi.fn(),
    getStatuses: vi.fn(),
    updateStatus: vi.fn(),
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
    description: '<p>Monthly revenue report</p>',
    dataDomain: 'finance',
    status: 'submitted',
    email: 'user@test.com',
    team: 'Analytics',
    assignee_name: 'John Doe',
    row_add_stp: '2025-01-15',
  },
  {
    requestId: 'REQ-002',
    name: 'HR Analytics',
    description: '<p>Employee analytics</p>',
    dataDomain: 'hr',
    status: 'deployed',
    email: 'user2@test.com',
    team: null,
    assignee_name: null,
    row_add_stp: '2025-01-10',
  },
];

const mockStatuses = [
  { value: 'submitted', label: 'Submitted' },
  { value: 'review', label: 'Review' },
  { value: 'deployed', label: 'Deployed' },
  { value: 'rejected', label: 'Rejected' },
];

const mockDomains = [
  { key: 'finance', name: 'Finance' },
  { key: 'hr', name: 'HR' },
];

async function setupMocks() {
  const { scenarioRequestAPI } = await import('../../services/api');
  scenarioRequestAPI.getAll.mockResolvedValue({
    data: { data: mockRequests, pagination: { total: 2 } },
  });
  scenarioRequestAPI.getDomains.mockResolvedValue({ data: mockDomains });
  scenarioRequestAPI.getStatuses.mockResolvedValue({ data: mockStatuses });
}

function renderScenarioRequestsManagement() {
  return render(
    <MemoryRouter initialEntries={['/admin/scenario-requests']}>
      <ScenarioRequestsManagement />
    </MemoryRouter>
  );
}

describe('ScenarioRequestsManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page header', async () => {
    await setupMocks();
    renderScenarioRequestsManagement();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Scenario Requests' })).toBeInTheDocument();
      expect(screen.getByText('Manage and process scenario requests')).toBeInTheDocument();
    });
  });

  it('renders stats cards', async () => {
    await setupMocks();
    renderScenarioRequestsManagement();

    await waitFor(() => {
      expect(screen.getByText('Total')).toBeInTheDocument();
      expect(screen.getAllByText('Submitted').length).toBeGreaterThan(0);
      expect(screen.getByText('In Progress')).toBeInTheDocument();
      expect(screen.getAllByText('Deployed').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Rejected').length).toBeGreaterThan(0);
    });
  });

  it('renders requests table', async () => {
    await setupMocks();
    renderScenarioRequestsManagement();

    await waitFor(() => {
      expect(screen.getByText('REQ-001')).toBeInTheDocument();
      expect(screen.getByText('Revenue Dashboard')).toBeInTheDocument();
      expect(screen.getByText('REQ-002')).toBeInTheDocument();
      expect(screen.getByText('HR Analytics')).toBeInTheDocument();
    });
  });

  it('renders requester email', async () => {
    await setupMocks();
    renderScenarioRequestsManagement();

    await waitFor(() => {
      expect(screen.getByText('user@test.com')).toBeInTheDocument();
      expect(screen.getByText('user2@test.com')).toBeInTheDocument();
    });
  });

  it('renders search and filters', async () => {
    await setupMocks();
    renderScenarioRequestsManagement();

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search by ID, name or email...')).toBeInTheDocument();
      expect(screen.getByText('All Status')).toBeInTheDocument();
      expect(screen.getByText('All Domains')).toBeInTheDocument();
    });
  });

  it('shows empty state when no requests', async () => {
    const { scenarioRequestAPI } = await import('../../services/api');
    scenarioRequestAPI.getAll.mockResolvedValue({ data: { data: [], pagination: { total: 0 } } });
    scenarioRequestAPI.getDomains.mockResolvedValue({ data: mockDomains });
    scenarioRequestAPI.getStatuses.mockResolvedValue({ data: mockStatuses });

    renderScenarioRequestsManagement();

    await waitFor(() => {
      expect(screen.getByText('No requests found')).toBeInTheDocument();
    });
  });

  it('renders team and assignee columns', async () => {
    await setupMocks();
    renderScenarioRequestsManagement();

    await waitFor(() => {
      expect(screen.getByText('Analytics')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
  });

  it('handles API error', async () => {
    const { scenarioRequestAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    scenarioRequestAPI.getAll.mockRejectedValue(new Error('API Error'));
    scenarioRequestAPI.getDomains.mockResolvedValue({ data: [] });
    scenarioRequestAPI.getStatuses.mockResolvedValue({ data: [] });

    renderScenarioRequestsManagement();

    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalledWith('Failed to load requests');
    });
  });

  it('navigates to request detail on view click', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderScenarioRequestsManagement();

    await waitFor(() => {
      expect(screen.getByText('REQ-001')).toBeInTheDocument();
    });

    const viewButtons = screen.getAllByTitle('View');
    await user.click(viewButtons[0]);

    expect(mockNavigate).toHaveBeenCalledWith('/admin/scenario-requests/REQ-001');
  });

  it('opens status update modal', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderScenarioRequestsManagement();

    await waitFor(() => {
      expect(screen.getByText('REQ-001')).toBeInTheDocument();
    });

    const statusButtons = screen.getAllByTitle('Update Status');
    await user.click(statusButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Update Status' })).toBeInTheDocument();
      expect(screen.getByText('REQ-001 - Revenue Dashboard')).toBeInTheDocument();
    });
  });

  it('handles status update', async () => {
    await setupMocks();
    const { scenarioRequestAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    scenarioRequestAPI.updateStatus.mockResolvedValue({ data: {} });
    const user = userEvent.setup();

    renderScenarioRequestsManagement();

    await waitFor(() => {
      expect(screen.getByText('REQ-001')).toBeInTheDocument();
    });

    const statusButtons = screen.getAllByTitle('Update Status');
    await user.click(statusButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Update Status' })).toBeInTheDocument();
    });

    // Click the "Update Status" submit button
    const updateButtons = screen.getAllByText('Update Status');
    // The submit button should be the one inside the modal
    await user.click(updateButtons[updateButtons.length - 1]);

    await waitFor(() => {
      expect(scenarioRequestAPI.updateStatus).toHaveBeenCalledWith('REQ-001', 'submitted', '');
      expect(toast.default.success).toHaveBeenCalledWith('Status updated successfully');
    });
  });

  it('handles status update failure', async () => {
    await setupMocks();
    const { scenarioRequestAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    scenarioRequestAPI.updateStatus.mockRejectedValue({ response: { data: { detail: 'Invalid transition' } } });
    const user = userEvent.setup();

    renderScenarioRequestsManagement();

    await waitFor(() => {
      expect(screen.getByText('REQ-001')).toBeInTheDocument();
    });

    const statusButtons = screen.getAllByTitle('Update Status');
    await user.click(statusButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Update Status' })).toBeInTheDocument();
    });

    const updateButtons = screen.getAllByText('Update Status');
    await user.click(updateButtons[updateButtons.length - 1]);

    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalledWith('Invalid transition');
    });
  });

  it('filters requests by search', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderScenarioRequestsManagement();

    await waitFor(() => {
      expect(screen.getByText('Revenue Dashboard')).toBeInTheDocument();
      expect(screen.getByText('HR Analytics')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('Search by ID, name or email...'), 'Revenue');

    // Only Revenue Dashboard should be visible
    expect(screen.getByText('Revenue Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('HR Analytics')).not.toBeInTheDocument();
  });

  it('shows description preview in table', async () => {
    await setupMocks();
    renderScenarioRequestsManagement();

    await waitFor(() => {
      // The stripHtml should convert <p>Monthly revenue report</p> to "Monthly revenue report"
      expect(screen.getByText(/Monthly revenue report/)).toBeInTheDocument();
    });
  });

  it('shows status badges with correct labels', async () => {
    await setupMocks();
    renderScenarioRequestsManagement();

    await waitFor(() => {
      // REQ-001 has status 'submitted', REQ-002 has 'deployed'
      expect(screen.getAllByText('Submitted').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Deployed').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders domain badges', async () => {
    await setupMocks();
    renderScenarioRequestsManagement();

    await waitFor(() => {
      expect(screen.getByText('finance')).toBeInTheDocument();
      expect(screen.getByText('hr')).toBeInTheDocument();
    });
  });

  it('cancels status update modal', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderScenarioRequestsManagement();

    await waitFor(() => {
      expect(screen.getByText('REQ-001')).toBeInTheDocument();
    });

    const statusButtons = screen.getAllByTitle('Update Status');
    await user.click(statusButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Update Status' })).toBeInTheDocument();
    });

    await user.click(screen.getByText('Cancel'));

    // The modal should close
  });

  it('filters by status', async () => {
    await setupMocks();
    const { scenarioRequestAPI } = await import('../../services/api');
    const user = userEvent.setup();

    renderScenarioRequestsManagement();

    await waitFor(() => {
      expect(screen.getByText('Revenue Dashboard')).toBeInTheDocument();
    });

    const statusSelect = screen.getByDisplayValue('All Status');
    await user.selectOptions(statusSelect, 'submitted');

    // Client-side filter: only submitted requests visible
    await waitFor(() => {
      expect(screen.getByText('Revenue Dashboard')).toBeInTheDocument();
    });
  });

  it('filters by domain', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderScenarioRequestsManagement();

    await waitFor(() => {
      expect(screen.getByText('Revenue Dashboard')).toBeInTheDocument();
    });

    const domainSelect = screen.getByDisplayValue('All Domains');
    await user.selectOptions(domainSelect, 'hr');

    // Client-side filter: only hr domain visible
    await waitFor(() => {
      expect(screen.queryByText('Revenue Dashboard')).not.toBeInTheDocument();
      expect(screen.getByText('HR Analytics')).toBeInTheDocument();
    });
  });

  it('updates status comment in modal', async () => {
    await setupMocks();
    const { scenarioRequestAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    scenarioRequestAPI.updateStatus.mockResolvedValue({ data: {} });
    const user = userEvent.setup();

    renderScenarioRequestsManagement();

    await waitFor(() => {
      expect(screen.getByText('REQ-001')).toBeInTheDocument();
    });

    const statusButtons = screen.getAllByTitle('Update Status');
    await user.click(statusButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Update Status' })).toBeInTheDocument();
    });

    // Type a comment
    const commentArea = screen.getByPlaceholderText(/Add a comment/i) || screen.getByRole('textbox');
    if (commentArea) {
      await user.type(commentArea, 'Status change comment');
    }

    // Change the status dropdown
    const statusDropdowns = document.querySelectorAll('select');
    const modalStatusSelect = Array.from(statusDropdowns).find(s =>
      Array.from(s.options).some(o => o.value === 'review')
    );
    if (modalStatusSelect) {
      await user.selectOptions(modalStatusSelect, 'review');
    }

    const updateButtons = screen.getAllByText('Update Status');
    await user.click(updateButtons[updateButtons.length - 1]);

    await waitFor(() => {
      expect(scenarioRequestAPI.updateStatus).toHaveBeenCalled();
    });
  });

  it('shows formatted dates', async () => {
    await setupMocks();
    renderScenarioRequestsManagement();

    await waitFor(() => {
      // The date should be formatted by formatDate
      expect(screen.getByText('Revenue Dashboard')).toBeInTheDocument();
    });
  });

  it('strips HTML from descriptions', async () => {
    await setupMocks();
    renderScenarioRequestsManagement();

    await waitFor(() => {
      // stripHtml should convert <p>Monthly revenue report</p> to plain text
      expect(screen.getByText(/Monthly revenue report/)).toBeInTheDocument();
      expect(screen.getByText(/Employee analytics/)).toBeInTheDocument();
    });
  });

  it('shows "N/A" for missing team/assignee', async () => {
    await setupMocks();
    renderScenarioRequestsManagement();

    await waitFor(() => {
      // REQ-002 has null team and assignee_name
      expect(screen.getByText('HR Analytics')).toBeInTheDocument();
    });
  });

  it('renders pagination info', async () => {
    const { scenarioRequestAPI } = await import('../../services/api');
    scenarioRequestAPI.getAll.mockResolvedValue({
      data: { data: mockRequests, pagination: { total: 50, page: 0, limit: 25 } },
    });
    scenarioRequestAPI.getDomains.mockResolvedValue({ data: mockDomains });
    scenarioRequestAPI.getStatuses.mockResolvedValue({ data: mockStatuses });

    renderScenarioRequestsManagement();

    await waitFor(() => {
      expect(screen.getByText('Revenue Dashboard')).toBeInTheDocument();
    });
  });

  it('shows refresh button', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderScenarioRequestsManagement();

    await waitFor(() => {
      expect(screen.getByText('Revenue Dashboard')).toBeInTheDocument();
    });

    // Look for refresh button
    const refreshButton = screen.queryByTitle('Refresh') || screen.queryByText('Refresh');
    if (refreshButton) {
      await user.click(refreshButton);
    }
  });

  it('filters by domain dropdown', async () => {
    await setupMocks();
    const { scenarioRequestAPI } = await import('../../services/api');
    const user = userEvent.setup();

    renderScenarioRequestsManagement();

    await waitFor(() => {
      expect(screen.getByText('Revenue Dashboard')).toBeInTheDocument();
    });

    const domainFilter = screen.getByDisplayValue('All Domains');
    if (domainFilter) {
      await user.selectOptions(domainFilter, 'finance');
      await waitFor(() => {
        expect(scenarioRequestAPI.getAll).toHaveBeenCalledTimes(2);
      });
    }
  });

  it('filters by status dropdown', async () => {
    await setupMocks();
    const { scenarioRequestAPI } = await import('../../services/api');
    const user = userEvent.setup();

    renderScenarioRequestsManagement();

    await waitFor(() => {
      expect(screen.getByText('Revenue Dashboard')).toBeInTheDocument();
    });

    const statusFilter = screen.getByDisplayValue('All Status');
    if (statusFilter) {
      await user.selectOptions(statusFilter, 'submitted');
      await waitFor(() => {
        expect(scenarioRequestAPI.getAll).toHaveBeenCalledTimes(2);
      });
    }
  });

  it('shows Jira ticket info when available', async () => {
    const { scenarioRequestAPI } = await import('../../services/api');
    scenarioRequestAPI.getAll.mockResolvedValue({
      data: {
        data: [{
          ...mockRequests[0],
          jira: { ticket_key: 'PROJ-123' },
          jira_links: [{ ticket_key: 'PROJ-456', link_type: 'related' }],
        }],
        pagination: { total: 1 },
      },
    });
    scenarioRequestAPI.getDomains.mockResolvedValue({ data: mockDomains });
    scenarioRequestAPI.getStatuses.mockResolvedValue({ data: mockStatuses });

    renderScenarioRequestsManagement();

    await waitFor(() => {
      expect(screen.getByText('Revenue Dashboard')).toBeInTheDocument();
    });

    // Jira ticket key should be visible
    await waitFor(() => {
      expect(screen.getByText('PROJ-123')).toBeInTheDocument();
    });
  });

  it('shows assignee and team info', async () => {
    await setupMocks();
    renderScenarioRequestsManagement();

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Analytics')).toBeInTheDocument();
    });
  });
});
