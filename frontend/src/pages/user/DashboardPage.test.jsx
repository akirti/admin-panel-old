import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DashboardPage from './DashboardPage';

const mockUser = {
  full_name: 'Test User',
  username: 'testuser',
  email: 'test@example.com',
  roles: ['user'],
  groups: ['group1'],
  domains: ['domain1'],
};

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    isSuperAdmin: jest.fn(() => false),
    canManageUsers: jest.fn(() => false),
    isEditor: jest.fn(() => false),
  }),
}));

jest.mock('../../services/api', () => ({
  domainAPI: {
    getAll: jest.fn(),
  },
  scenarioRequestAPI: {
    getStats: jest.fn(),
  },
}));

function renderDashboardPage() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>
  );
}

describe('DashboardPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders welcome message with user name', async () => {
    const { domainAPI, scenarioRequestAPI } = await import('../../services/api');
    domainAPI.getAll.mockResolvedValueOnce({ data: [] });
    scenarioRequestAPI.getStats.mockResolvedValueOnce({ data: { total: 0, submitted: 0, inProgress: 0, deployed: 0, recent: [] } });

    renderDashboardPage();
    expect(screen.getByText(/Welcome back, Test User!/)).toBeInTheDocument();
  });

  it('renders stats cards', async () => {
    const { domainAPI, scenarioRequestAPI } = await import('../../services/api');
    domainAPI.getAll.mockResolvedValueOnce({ data: [{ key: 'd1', name: 'Domain 1' }] });
    scenarioRequestAPI.getStats.mockResolvedValueOnce({ data: { total: 5, submitted: 2, inProgress: 1, deployed: 2, recent: [] } });

    renderDashboardPage();

    await waitFor(() => {
      expect(screen.getAllByText('My Requests').length).toBeGreaterThan(0);
    });
  });

  it('renders quick action links', async () => {
    const { domainAPI, scenarioRequestAPI } = await import('../../services/api');
    domainAPI.getAll.mockResolvedValueOnce({ data: [] });
    scenarioRequestAPI.getStats.mockResolvedValueOnce({ data: { total: 0, submitted: 0, inProgress: 0, deployed: 0, recent: [] } });

    renderDashboardPage();
    expect(screen.getByText('Ask Scenario')).toBeInTheDocument();
    expect(screen.getByText('Profile Settings')).toBeInTheDocument();
  });

  it('shows no domains message when empty', async () => {
    const { domainAPI, scenarioRequestAPI } = await import('../../services/api');
    domainAPI.getAll.mockResolvedValueOnce({ data: [] });
    scenarioRequestAPI.getStats.mockResolvedValueOnce({ data: { total: 0, submitted: 0, inProgress: 0, deployed: 0, recent: [] } });

    renderDashboardPage();

    await waitFor(() => {
      expect(screen.getByText('No domains available. Contact your administrator.')).toBeInTheDocument();
    });
  });

  it('renders domain cards when domains exist', async () => {
    const { domainAPI, scenarioRequestAPI } = await import('../../services/api');
    domainAPI.getAll.mockResolvedValueOnce({ data: [
      { key: 'd1', name: 'Finance' },
      { key: 'd2', name: 'HR' },
    ] });
    scenarioRequestAPI.getStats.mockResolvedValueOnce({ data: { total: 0, submitted: 0, inProgress: 0, deployed: 0, recent: [] } });

    renderDashboardPage();

    await waitFor(() => {
      expect(screen.getByText('Finance')).toBeInTheDocument();
      expect(screen.getByText('HR')).toBeInTheDocument();
    });
  });

  it('renders recent requests when available', async () => {
    const { domainAPI, scenarioRequestAPI } = await import('../../services/api');
    domainAPI.getAll.mockResolvedValueOnce({ data: [] });
    scenarioRequestAPI.getStats.mockResolvedValueOnce({ data: {
      total: 1, submitted: 1, inProgress: 0, deployed: 0,
      recent: [{ requestId: 'REQ-001', name: 'Test Request', status: 'submitted' }]
    } });

    renderDashboardPage();

    await waitFor(() => {
      expect(screen.getByText('Recent Requests')).toBeInTheDocument();
      expect(screen.getByText('REQ-001')).toBeInTheDocument();
      expect(screen.getByText('Test Request')).toBeInTheDocument();
    });
  });

  it('handles API error gracefully', async () => {
    const { domainAPI, scenarioRequestAPI } = await import('../../services/api');
    domainAPI.getAll.mockRejectedValueOnce(new Error('API Error'));
    scenarioRequestAPI.getStats.mockRejectedValueOnce(new Error('API Error'));

    renderDashboardPage();

    await waitFor(() => {
      expect(screen.getByText('No domains available. Contact your administrator.')).toBeInTheDocument();
    });
  });

  it('displays user access info', async () => {
    const { domainAPI, scenarioRequestAPI } = await import('../../services/api');
    domainAPI.getAll.mockResolvedValueOnce({ data: [] });
    scenarioRequestAPI.getStats.mockResolvedValueOnce({ data: { total: 0, submitted: 0, inProgress: 0, deployed: 0, recent: [] } });

    renderDashboardPage();
    expect(screen.getByText('Your Access')).toBeInTheDocument();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('renders recent requests with different status badges', async () => {
    const { domainAPI, scenarioRequestAPI } = await import('../../services/api');
    domainAPI.getAll.mockResolvedValueOnce({ data: [] });
    scenarioRequestAPI.getStats.mockResolvedValueOnce({ data: {
      total: 5, submitted: 1, inProgress: 1, deployed: 1,
      recent: [
        { requestId: 'REQ-001', name: 'Request 1', status: 'submitted' },
        { requestId: 'REQ-002', name: 'Request 2', status: 'in-progress' },
        { requestId: 'REQ-003', name: 'Request 3', status: 'deployed' },
        { requestId: 'REQ-004', name: 'Request 4', status: 'rejected' },
        { requestId: 'REQ-005', name: 'Request 5', status: 'development' },
      ]
    } });

    renderDashboardPage();

    await waitFor(() => {
      expect(screen.getByText('Submitted')).toBeInTheDocument();
      expect(screen.getAllByText('In Progress').length).toBeGreaterThan(0);
      expect(screen.getByText('Deployed')).toBeInTheDocument();
      expect(screen.getByText('Rejected')).toBeInTheDocument();
      expect(screen.getByText('Development')).toBeInTheDocument();
    });
  });

  it('renders status badges for review, testing, active, accepted', async () => {
    const { domainAPI, scenarioRequestAPI } = await import('../../services/api');
    domainAPI.getAll.mockResolvedValueOnce({ data: [] });
    scenarioRequestAPI.getStats.mockResolvedValueOnce({ data: {
      total: 4, submitted: 0, inProgress: 0, deployed: 0,
      recent: [
        { requestId: 'REQ-010', name: 'R10', status: 'review' },
        { requestId: 'REQ-011', name: 'R11', status: 'testing' },
        { requestId: 'REQ-012', name: 'R12', status: 'active' },
        { requestId: 'REQ-013', name: 'R13', status: 'accepted' },
      ]
    } });

    renderDashboardPage();

    await waitFor(() => {
      expect(screen.getByText('Review')).toBeInTheDocument();
      expect(screen.getByText('Testing')).toBeInTheDocument();
      expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
      expect(screen.getByText('Accepted')).toBeInTheDocument();
    });
  });

  it('shows stat counts correctly', async () => {
    const { domainAPI, scenarioRequestAPI } = await import('../../services/api');
    domainAPI.getAll.mockResolvedValueOnce({ data: [{ key: 'd1', name: 'D1' }, { key: 'd2', name: 'D2' }] });
    scenarioRequestAPI.getStats.mockResolvedValueOnce({ data: {
      total: 10, submitted: 3, inProgress: 4, deployed: 3, recent: []
    } });

    renderDashboardPage();

    await waitFor(() => {
      expect(screen.getByText('10')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();
    });
  });

  it('shows user roles and groups badges', async () => {
    const { domainAPI, scenarioRequestAPI } = await import('../../services/api');
    domainAPI.getAll.mockResolvedValueOnce({ data: [] });
    scenarioRequestAPI.getStats.mockResolvedValueOnce({ data: { total: 0, submitted: 0, inProgress: 0, deployed: 0, recent: [] } });

    renderDashboardPage();

    expect(screen.getByText('Roles')).toBeInTheDocument();
    expect(screen.getByText('user')).toBeInTheDocument();
    expect(screen.getAllByText('Groups').length).toBeGreaterThan(0);
    expect(screen.getByText('group1')).toBeInTheDocument();
    expect(screen.getByText('Domains Access')).toBeInTheDocument();
    expect(screen.getByText('domain1')).toBeInTheDocument();
  });

  it('limits domains to 6 in grid', async () => {
    const { domainAPI, scenarioRequestAPI } = await import('../../services/api');
    const manyDomains = Array.from({ length: 8 }, (_, i) => ({ key: `d${i}`, name: `Domain ${i}` }));
    domainAPI.getAll.mockResolvedValueOnce({ data: manyDomains });
    scenarioRequestAPI.getStats.mockResolvedValueOnce({ data: { total: 0, submitted: 0, inProgress: 0, deployed: 0, recent: [] } });

    renderDashboardPage();

    await waitFor(() => {
      expect(screen.getByText('Domain 0')).toBeInTheDocument();
      expect(screen.getByText('Domain 5')).toBeInTheDocument();
      // Domains 6 and 7 should not be displayed (sliced to 6)
      expect(screen.queryByText('Domain 6')).not.toBeInTheDocument();
      expect(screen.queryByText('Domain 7')).not.toBeInTheDocument();
    });
  });

  it('shows "View all" links', async () => {
    const { domainAPI, scenarioRequestAPI } = await import('../../services/api');
    domainAPI.getAll.mockResolvedValueOnce({ data: [{ key: 'd1', name: 'D1' }] });
    scenarioRequestAPI.getStats.mockResolvedValueOnce({ data: { total: 1, submitted: 1, inProgress: 0, deployed: 0, recent: [{ requestId: 'R1', name: 'Test', status: 'submitted' }] } });

    renderDashboardPage();

    await waitFor(() => {
      const viewAllLinks = screen.getAllByText(/View all/);
      expect(viewAllLinks.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders snapshot status badge with success variant', async () => {
    const { domainAPI, scenarioRequestAPI } = await import('../../services/api');
    domainAPI.getAll.mockResolvedValueOnce({ data: [] });
    scenarioRequestAPI.getStats.mockResolvedValueOnce({ data: {
      total: 1, submitted: 0, inProgress: 0, deployed: 0,
      recent: [{ requestId: 'REQ-020', name: 'Snap', status: 'snapshot' }]
    } });

    renderDashboardPage();

    await waitFor(() => {
      expect(screen.getByText('REQ-020')).toBeInTheDocument();
    });
  });

  it('renders unknown status using statusDescription fallback', async () => {
    const { domainAPI, scenarioRequestAPI } = await import('../../services/api');
    domainAPI.getAll.mockResolvedValueOnce({ data: [] });
    scenarioRequestAPI.getStats.mockResolvedValueOnce({ data: {
      total: 1, submitted: 0, inProgress: 0, deployed: 0,
      recent: [{ requestId: 'REQ-030', name: 'Custom', status: 'custom-status', statusDescription: 'Custom Desc' }]
    } });

    renderDashboardPage();

    await waitFor(() => {
      expect(screen.getByText('Custom Desc')).toBeInTheDocument();
    });
  });

  it('renders unknown status showing raw status when no statusDescription', async () => {
    const { domainAPI, scenarioRequestAPI } = await import('../../services/api');
    domainAPI.getAll.mockResolvedValueOnce({ data: [] });
    scenarioRequestAPI.getStats.mockResolvedValueOnce({ data: {
      total: 1, submitted: 0, inProgress: 0, deployed: 0,
      recent: [{ requestId: 'REQ-031', name: 'Raw', status: 'pending-approval' }]
    } });

    renderDashboardPage();

    await waitFor(() => {
      expect(screen.getByText('pending-approval')).toBeInTheDocument();
    });
  });

  it('handles null stats data from API', async () => {
    const { domainAPI, scenarioRequestAPI } = await import('../../services/api');
    domainAPI.getAll.mockResolvedValueOnce({ data: null });
    scenarioRequestAPI.getStats.mockResolvedValueOnce({ data: null });

    renderDashboardPage();

    await waitFor(() => {
      expect(screen.getByText('No domains available. Contact your administrator.')).toBeInTheDocument();
    });
  });

  it('shows loading spinner initially', async () => {
    const { domainAPI, scenarioRequestAPI } = await import('../../services/api');
    let resolveApi;
    domainAPI.getAll.mockReturnValue(new Promise(r => { resolveApi = r; }));
    scenarioRequestAPI.getStats.mockReturnValue(new Promise(Function.prototype));

    const { container } = renderDashboardPage();
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();

    resolveApi({ data: [] });
  });
});
