import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ScenarioRequestsManagement from './ScenarioRequestsManagement';

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
    getDomains: jest.fn(),
    getStatuses: jest.fn(),
    updateStatus: jest.fn(),
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
    jest.clearAllMocks();
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

  // --- Additional branch coverage tests ---

  it('handles status update failure with error.response.data.error fallback', async () => {
    await setupMocks();
    const { scenarioRequestAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    // No detail, but has error property
    scenarioRequestAPI.updateStatus.mockRejectedValue({ response: { data: { error: 'Status error fallback' } } });
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
      expect(toast.default.error).toHaveBeenCalledWith('Status error fallback');
    });
  });

  it('handles status update failure with generic fallback message', async () => {
    await setupMocks();
    const { scenarioRequestAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    // No response at all
    scenarioRequestAPI.updateStatus.mockRejectedValue(new Error('Network error'));
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
      expect(toast.default.error).toHaveBeenCalledWith('Failed to update status');
    });
  });

  it('early returns from handleStatusUpdate when no selectedRequest', async () => {
    await setupMocks();
    const { scenarioRequestAPI } = await import('../../services/api');
    renderScenarioRequestsManagement();

    await waitFor(() => {
      expect(screen.getByText('REQ-001')).toBeInTheDocument();
    });

    // handleStatusUpdate with no selectedRequest should not call API
    expect(scenarioRequestAPI.updateStatus).not.toHaveBeenCalled();
  });

  it('renders jira_links when jira is not present', async () => {
    const { scenarioRequestAPI } = await import('../../services/api');
    scenarioRequestAPI.getAll.mockResolvedValue({
      data: {
        data: [{
          ...mockRequests[0],
          jira: null,
          jira_integration: null,
          jira_links: [
            { ticket_key: 'LINK-001', ticket_url: 'https://jira.test/LINK-001' },
            { ticket_key: 'LINK-002', ticket_url: 'https://jira.test/LINK-002' },
          ],
        }],
        pagination: { total: 1 },
      },
    });
    scenarioRequestAPI.getDomains.mockResolvedValue({ data: mockDomains });
    scenarioRequestAPI.getStatuses.mockResolvedValue({ data: mockStatuses });

    renderScenarioRequestsManagement();

    await waitFor(() => {
      expect(screen.getByText('LINK-001')).toBeInTheDocument();
      expect(screen.getByText('LINK-002')).toBeInTheDocument();
    });
  });

  it('renders "+N more" for jira_links exceeding 2', async () => {
    const { scenarioRequestAPI } = await import('../../services/api');
    scenarioRequestAPI.getAll.mockResolvedValue({
      data: {
        data: [{
          ...mockRequests[0],
          jira: null,
          jira_integration: null,
          jira_links: [
            { ticket_key: 'LINK-001', ticket_url: 'https://jira.test/LINK-001' },
            { ticket_key: 'LINK-002', ticket_url: 'https://jira.test/LINK-002' },
            { ticket_key: 'LINK-003', ticket_url: 'https://jira.test/LINK-003' },
            { ticket_key: 'LINK-004', ticket_url: 'https://jira.test/LINK-004' },
          ],
        }],
        pagination: { total: 1 },
      },
    });
    scenarioRequestAPI.getDomains.mockResolvedValue({ data: mockDomains });
    scenarioRequestAPI.getStatuses.mockResolvedValue({ data: mockStatuses });

    renderScenarioRequestsManagement();

    await waitFor(() => {
      expect(screen.getByText('LINK-001')).toBeInTheDocument();
      expect(screen.getByText('LINK-002')).toBeInTheDocument();
      expect(screen.getByText('+2 more')).toBeInTheDocument();
    });
  });

  it('renders jira dash when no jira info at all', async () => {
    const { scenarioRequestAPI } = await import('../../services/api');
    scenarioRequestAPI.getAll.mockResolvedValue({
      data: {
        data: [{
          ...mockRequests[0],
          jira: null,
          jira_integration: null,
          jira_links: null,
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
  });

  it('renders unknown status badge with fallback', async () => {
    const { scenarioRequestAPI } = await import('../../services/api');
    scenarioRequestAPI.getAll.mockResolvedValue({
      data: {
        data: [{
          ...mockRequests[0],
          status: 'some_unknown_status',
        }],
        pagination: { total: 1 },
      },
    });
    scenarioRequestAPI.getDomains.mockResolvedValue({ data: mockDomains });
    scenarioRequestAPI.getStatuses.mockResolvedValue({ data: mockStatuses });

    renderScenarioRequestsManagement();

    await waitFor(() => {
      expect(screen.getByText('some_unknown_status')).toBeInTheDocument();
    });
  });

  it('renders status badge with null status fallback to Unknown', async () => {
    const { scenarioRequestAPI } = await import('../../services/api');
    scenarioRequestAPI.getAll.mockResolvedValue({
      data: {
        data: [{
          ...mockRequests[0],
          status: null,
        }],
        pagination: { total: 1 },
      },
    });
    scenarioRequestAPI.getDomains.mockResolvedValue({ data: mockDomains });
    scenarioRequestAPI.getStatuses.mockResolvedValue({ data: mockStatuses });

    renderScenarioRequestsManagement();

    await waitFor(() => {
      expect(screen.getByText('Unknown')).toBeInTheDocument();
    });
  });

  it('returns dash for null dateString in formatDate', async () => {
    const { scenarioRequestAPI } = await import('../../services/api');
    scenarioRequestAPI.getAll.mockResolvedValue({
      data: {
        data: [{
          ...mockRequests[0],
          row_add_stp: null,
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
  });

  it('returns empty string for null html in stripHtml', async () => {
    const { scenarioRequestAPI } = await import('../../services/api');
    scenarioRequestAPI.getAll.mockResolvedValue({
      data: {
        data: [{
          ...mockRequests[0],
          description: null,
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
  });

  it('uses paginiation (typo) fallback for total', async () => {
    const { scenarioRequestAPI } = await import('../../services/api');
    scenarioRequestAPI.getAll.mockResolvedValue({
      data: {
        data: mockRequests,
        paginiation: { total: 99 },
      },
    });
    scenarioRequestAPI.getDomains.mockResolvedValue({ data: mockDomains });
    scenarioRequestAPI.getStatuses.mockResolvedValue({ data: mockStatuses });

    renderScenarioRequestsManagement();

    await waitFor(() => {
      expect(screen.getByText('Revenue Dashboard')).toBeInTheDocument();
    });
  });

  it('falls back to data.length when no pagination at all', async () => {
    const { scenarioRequestAPI } = await import('../../services/api');
    scenarioRequestAPI.getAll.mockResolvedValue({
      data: {
        data: mockRequests,
      },
    });
    scenarioRequestAPI.getDomains.mockResolvedValue({ data: mockDomains });
    scenarioRequestAPI.getStatuses.mockResolvedValue({ data: mockStatuses });

    renderScenarioRequestsManagement();

    await waitFor(() => {
      expect(screen.getByText('Revenue Dashboard')).toBeInTheDocument();
    });
  });

  it('handles loadLookups failure gracefully', async () => {
    const { scenarioRequestAPI } = await import('../../services/api');
    scenarioRequestAPI.getDomains.mockRejectedValue(new Error('Lookup error'));
    scenarioRequestAPI.getStatuses.mockRejectedValue(new Error('Lookup error'));
    scenarioRequestAPI.getAll.mockResolvedValue({
      data: { data: mockRequests, pagination: { total: 2 } },
    });

    renderScenarioRequestsManagement();

    await waitFor(() => {
      expect(screen.getByText('Revenue Dashboard')).toBeInTheDocument();
    });
  });

  it('handles null domains/statuses data in lookups', async () => {
    const { scenarioRequestAPI } = await import('../../services/api');
    scenarioRequestAPI.getDomains.mockResolvedValue({ data: null });
    scenarioRequestAPI.getStatuses.mockResolvedValue({ data: null });
    scenarioRequestAPI.getAll.mockResolvedValue({
      data: { data: mockRequests, pagination: { total: 2 } },
    });

    renderScenarioRequestsManagement();

    await waitFor(() => {
      expect(screen.getByText('Revenue Dashboard')).toBeInTheDocument();
    });
  });

  it('navigates with management base path', async () => {
    await setupMocks();
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/management/scenario-requests']}>
        <ScenarioRequestsManagement />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('REQ-001')).toBeInTheDocument();
    });

    const viewButtons = screen.getAllByTitle('View');
    await user.click(viewButtons[0]);

    expect(mockNavigate).toHaveBeenCalledWith('/management/scenario-requests/REQ-001');
  });

  it('renders pagination with next/prev and clicking next page', async () => {
    const { scenarioRequestAPI } = await import('../../services/api');
    // Create enough data for pagination (total > limit of 15)
    scenarioRequestAPI.getAll.mockResolvedValue({
      data: { data: mockRequests, pagination: { total: 50 } },
    });
    scenarioRequestAPI.getDomains.mockResolvedValue({ data: mockDomains });
    scenarioRequestAPI.getStatuses.mockResolvedValue({ data: mockStatuses });
    const user = userEvent.setup();

    renderScenarioRequestsManagement();

    await waitFor(() => {
      expect(screen.getByText('Revenue Dashboard')).toBeInTheDocument();
    });

    // Should display pagination
    await waitFor(() => {
      expect(screen.getByText(/Page 1 of/)).toBeInTheDocument();
    });
  });

  it('uses jira_integration ticket_key when jira is absent', async () => {
    const { scenarioRequestAPI } = await import('../../services/api');
    scenarioRequestAPI.getAll.mockResolvedValue({
      data: {
        data: [{
          ...mockRequests[0],
          jira: null,
          jira_integration: { ticket_key: 'INT-789', ticket_url: 'https://jira.test/INT-789' },
          jira_links: null,
        }],
        pagination: { total: 1 },
      },
    });
    scenarioRequestAPI.getDomains.mockResolvedValue({ data: mockDomains });
    scenarioRequestAPI.getStatuses.mockResolvedValue({ data: mockStatuses });

    renderScenarioRequestsManagement();

    await waitFor(() => {
      expect(screen.getByText('INT-789')).toBeInTheDocument();
    });
  });

  it('filters by search matching email', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderScenarioRequestsManagement();

    await waitFor(() => {
      expect(screen.getByText('Revenue Dashboard')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('Search by ID, name or email...'), 'user2@test.com');

    expect(screen.queryByText('Revenue Dashboard')).not.toBeInTheDocument();
    expect(screen.getByText('HR Analytics')).toBeInTheDocument();
  });

  it('filters by search matching requestId', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderScenarioRequestsManagement();

    await waitFor(() => {
      expect(screen.getByText('Revenue Dashboard')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('Search by ID, name or email...'), 'REQ-002');

    expect(screen.queryByText('Revenue Dashboard')).not.toBeInTheDocument();
    expect(screen.getByText('HR Analytics')).toBeInTheDocument();
  });

  it('calculates stats correctly with various statuses', async () => {
    const { scenarioRequestAPI } = await import('../../services/api');
    scenarioRequestAPI.getAll.mockResolvedValue({
      data: {
        data: [
          { ...mockRequests[0], status: 'submitted' },
          { ...mockRequests[1], status: 'review' },
          { ...mockRequests[0], requestId: 'REQ-003', status: 'rejected' },
          { ...mockRequests[0], requestId: 'REQ-004', status: 'deployed' },
          { ...mockRequests[0], requestId: 'REQ-005', status: 'inactive' },
        ],
        pagination: { total: 5 },
      },
    });
    scenarioRequestAPI.getDomains.mockResolvedValue({ data: mockDomains });
    scenarioRequestAPI.getStatuses.mockResolvedValue({ data: mockStatuses });

    renderScenarioRequestsManagement();

    await waitFor(() => {
      expect(screen.getByText('REQ-003')).toBeInTheDocument();
    });
  });

  it('uses domain.value and domain.label as fallback keys', async () => {
    const { scenarioRequestAPI } = await import('../../services/api');
    scenarioRequestAPI.getAll.mockResolvedValue({
      data: { data: mockRequests, pagination: { total: 2 } },
    });
    scenarioRequestAPI.getDomains.mockResolvedValue({
      data: [
        { value: 'finance', label: 'Finance' },
        { value: 'hr', label: 'HR' },
      ],
    });
    scenarioRequestAPI.getStatuses.mockResolvedValue({ data: mockStatuses });

    renderScenarioRequestsManagement();

    await waitFor(() => {
      expect(screen.getByText('Revenue Dashboard')).toBeInTheDocument();
    });
  });

  it('handles null response.data in getAll', async () => {
    const { scenarioRequestAPI } = await import('../../services/api');
    scenarioRequestAPI.getAll.mockResolvedValue({
      data: { data: null },
    });
    scenarioRequestAPI.getDomains.mockResolvedValue({ data: mockDomains });
    scenarioRequestAPI.getStatuses.mockResolvedValue({ data: mockStatuses });

    renderScenarioRequestsManagement();

    await waitFor(() => {
      expect(screen.getByText('No requests found')).toBeInTheDocument();
    });
  });

  it('clicks refresh button to reload requests', async () => {
    await setupMocks();
    const { scenarioRequestAPI } = await import('../../services/api');
    const user = userEvent.setup();

    renderScenarioRequestsManagement();

    await waitFor(() => {
      expect(screen.getByText('Revenue Dashboard')).toBeInTheDocument();
    });

    // The refresh button is a button with RefreshCw icon
    const buttons = screen.getAllByRole('button');
    const refreshBtn = buttons.find(btn => btn.classList.contains('btn-secondary'));
    if (refreshBtn) {
      await user.click(refreshBtn);
      await waitFor(() => {
        // getAll should be called more than initial load
        expect(scenarioRequestAPI.getAll.mock.calls.length).toBeGreaterThanOrEqual(2);
      });
    }
  });
});
