import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminDashboard from '../../../pages/admin/AdminDashboard';

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    isSuperAdmin: () => true,
  }),
}));

jest.mock('../../../services/api', () => ({
  dashboardAPI: {
    getStats: jest.fn(),
    getSummary: jest.fn(),
    getRecentLogins: jest.fn(),
    getAnalytics: jest.fn(),
  },
  scenarioRequestAPI: {
    getStats: jest.fn(),
  },
  feedbackAPI: {
    getStats: jest.fn(),
  },
}));

jest.mock('react-hot-toast', () => ({ __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const mockStats = {
  total_users: 150,
  active_users: 120,
  total_roles: 7,
  total_groups: 5,
  total_domains: 10,
  total_scenarios: 25,
  total_playboards: 15,
  total_configurations: 8,
};

const mockSummary = {
  users: { active: 120, inactive: 30 },
  domains: { active: 8, inactive: 2 },
};

const mockRecentLogins = {
  recent_logins: [
    { full_name: 'John Doe', email: 'john@test.com', last_login: '2025-01-15T10:00:00Z' },
  ],
};

const mockAnalytics = {
  activity_trend: [
    { date: '2025-01-10', count: 5 },
    { date: '2025-01-11', count: 10 },
  ],
  role_distribution: [
    { role: 'user', count: 100 },
    { role: 'admin', count: 10 },
  ],
  top_active_users: [
    { user_email: 'user1@test.com', activities: 50 },
  ],
  recent_signups: [
    { full_name: 'New User', email: 'new@test.com', created_at: '2025-01-14T10:00:00Z' },
  ],
};

const mockRequestStats = {
  total: 20,
  submitted: 5,
  inProgress: 8,
  deployed: 5,
  rejected: 2,
  recent: [],
};

const mockFeedbackStats = {
  total_feedback: 100,
  avg_rating: 4.5,
  this_week_count: 12,
  rating_distribution: { '5': 50, '4': 30, '3': 15, '2': 3, '1': 2 },
};

function renderAdminDashboard() {
  return render(
    <MemoryRouter>
      <AdminDashboard />
    </MemoryRouter>
  );
}

async function setupMocks() {
  const { dashboardAPI, scenarioRequestAPI, feedbackAPI } = await import('../../../services/api');
  dashboardAPI.getStats.mockResolvedValueOnce({ data: mockStats });
  dashboardAPI.getSummary.mockResolvedValueOnce({ data: mockSummary });
  dashboardAPI.getRecentLogins.mockResolvedValueOnce({ data: mockRecentLogins });
  dashboardAPI.getAnalytics.mockResolvedValueOnce({ data: mockAnalytics });
  scenarioRequestAPI.getStats.mockResolvedValueOnce({ data: mockRequestStats });
  feedbackAPI.getStats.mockResolvedValueOnce({ data: mockFeedbackStats });
}

describe('AdminDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading state initially', async () => {
    const { dashboardAPI, scenarioRequestAPI, feedbackAPI } = await import('../../../services/api');
    let resolveStats;
    dashboardAPI.getStats.mockReturnValueOnce(new Promise(r => { resolveStats = r; }));
    dashboardAPI.getSummary.mockResolvedValueOnce({ data: {} });
    dashboardAPI.getRecentLogins.mockResolvedValueOnce({ data: { recent_logins: [] } });
    dashboardAPI.getAnalytics.mockResolvedValueOnce({ data: {} });
    scenarioRequestAPI.getStats.mockResolvedValueOnce({ data: mockRequestStats });
    feedbackAPI.getStats.mockResolvedValueOnce({ data: mockFeedbackStats });

    renderAdminDashboard();
    // Loading spinner visible - no dashboard heading yet
    expect(screen.queryByText('Admin Dashboard')).not.toBeInTheDocument();
  });

  it('renders dashboard with stats', async () => {
    await setupMocks();
    renderAdminDashboard();

    await waitFor(() => {
      expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
    });
    expect(screen.getByText('150')).toBeInTheDocument();
    expect(screen.getByText('120')).toBeInTheDocument();
    expect(screen.getByText('Total Users')).toBeInTheDocument();
    expect(screen.getByText('Active Users')).toBeInTheDocument();
  });

  it('renders scenario request stats', async () => {
    await setupMocks();
    renderAdminDashboard();

    await waitFor(() => {
      expect(screen.getByText('Scenario Request Statistics')).toBeInTheDocument();
    });
    expect(screen.getByText('Submitted')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Deployed')).toBeInTheDocument();
    expect(screen.getByText('Rejected')).toBeInTheDocument();
  });

  it('renders feedback stats', async () => {
    await setupMocks();
    renderAdminDashboard();

    await waitFor(() => {
      expect(screen.getByText('Total Feedback')).toBeInTheDocument();
      expect(screen.getByText('100')).toBeInTheDocument();
      expect(screen.getByText('4.5')).toBeInTheDocument();
    });
  });

  it('renders quick actions', async () => {
    await setupMocks();
    renderAdminDashboard();

    await waitFor(() => {
      expect(screen.getByText('Quick Actions')).toBeInTheDocument();
      expect(screen.getByText('Add User')).toBeInTheDocument();
      expect(screen.getByText('Manage Roles')).toBeInTheDocument();
      expect(screen.getByText('Permissions')).toBeInTheDocument();
      expect(screen.getByText('Bulk Upload')).toBeInTheDocument();
    });
  });

  it('renders recent logins', async () => {
    await setupMocks();
    renderAdminDashboard();

    await waitFor(() => {
      expect(screen.getByText('Recent Logins')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('john@test.com')).toBeInTheDocument();
    });
  });

  it('renders analytics sections', async () => {
    await setupMocks();
    renderAdminDashboard();

    await waitFor(() => {
      expect(screen.getByText('Activity Trend')).toBeInTheDocument();
      expect(screen.getByText('Role Distribution')).toBeInTheDocument();
      expect(screen.getByText('Top Active Users (Last 7 Days)')).toBeInTheDocument();
      expect(screen.getByText('Recent User Signups')).toBeInTheDocument();
    });
  });

  it('handles API error', async () => {
    const { dashboardAPI, scenarioRequestAPI, feedbackAPI } = await import('../../../services/api');
    const toast = await import('react-hot-toast');
    dashboardAPI.getStats.mockRejectedValueOnce(new Error('API Error'));
    dashboardAPI.getSummary.mockRejectedValueOnce(new Error('API Error'));
    dashboardAPI.getRecentLogins.mockRejectedValueOnce(new Error('API Error'));
    dashboardAPI.getAnalytics.mockRejectedValueOnce(new Error('API Error'));
    scenarioRequestAPI.getStats.mockRejectedValueOnce(new Error('API Error'));
    feedbackAPI.getStats.mockRejectedValueOnce(new Error('API Error'));

    renderAdminDashboard();

    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalledWith('Failed to load dashboard data');
    });
  });

  it('shows no recent logins message when empty', async () => {
    const { dashboardAPI, scenarioRequestAPI, feedbackAPI } = await import('../../../services/api');
    dashboardAPI.getStats.mockResolvedValueOnce({ data: mockStats });
    dashboardAPI.getSummary.mockResolvedValueOnce({ data: mockSummary });
    dashboardAPI.getRecentLogins.mockResolvedValueOnce({ data: { recent_logins: [] } });
    dashboardAPI.getAnalytics.mockResolvedValueOnce({ data: { top_active_users: [], recent_signups: [] } });
    scenarioRequestAPI.getStats.mockResolvedValueOnce({ data: mockRequestStats });
    feedbackAPI.getStats.mockResolvedValueOnce({ data: mockFeedbackStats });

    renderAdminDashboard();

    await waitFor(() => {
      expect(screen.getByText('No recent logins')).toBeInTheDocument();
    });
  });

  // --- Deep coverage tests for uncovered branches ---

  it('shows configurations overview when summary has configurations', async () => {
    const { dashboardAPI, scenarioRequestAPI, feedbackAPI } = await import('../../../services/api');
    dashboardAPI.getStats.mockResolvedValueOnce({ data: mockStats });
    dashboardAPI.getSummary.mockResolvedValueOnce({
      data: {
        ...mockSummary,
        configurations: {
          'process-config': 3,
          'lookup-data': 5,
          'gcs-data': 2,
          'snapshot-data': 1,
        },
      },
    });
    dashboardAPI.getRecentLogins.mockResolvedValueOnce({ data: mockRecentLogins });
    dashboardAPI.getAnalytics.mockResolvedValueOnce({ data: mockAnalytics });
    scenarioRequestAPI.getStats.mockResolvedValueOnce({ data: mockRequestStats });
    feedbackAPI.getStats.mockResolvedValueOnce({ data: mockFeedbackStats });

    renderAdminDashboard();

    await waitFor(() => {
      expect(screen.getByText('Configurations Overview')).toBeInTheDocument();
      expect(screen.getByText('Total Configs')).toBeInTheDocument();
      expect(screen.getByText('Process')).toBeInTheDocument();
      expect(screen.getByText('Lookup')).toBeInTheDocument();
      expect(screen.getByText('GCS Files')).toBeInTheDocument();
      expect(screen.getByText('Snapshot')).toBeInTheDocument();
      expect(screen.getByText('View All →')).toBeInTheDocument();
    });
  });

  it('shows entity status summary', async () => {
    await setupMocks();
    renderAdminDashboard();

    await waitFor(() => {
      expect(screen.getByText('Entity Status Summary')).toBeInTheDocument();
      // 'users' and 'domains' from mockSummary
      expect(screen.getByText('users')).toBeInTheDocument();
      expect(screen.getByText('domains')).toBeInTheDocument();
    });
  });

  it('renders top active users with multiple positions', async () => {
    const { dashboardAPI, scenarioRequestAPI, feedbackAPI } = await import('../../../services/api');
    dashboardAPI.getStats.mockResolvedValueOnce({ data: mockStats });
    dashboardAPI.getSummary.mockResolvedValueOnce({ data: mockSummary });
    dashboardAPI.getRecentLogins.mockResolvedValueOnce({ data: mockRecentLogins });
    dashboardAPI.getAnalytics.mockResolvedValueOnce({
      data: {
        ...mockAnalytics,
        top_active_users: [
          { user_email: 'first@test.com', activities: 50 },
          { user_email: 'second@test.com', activities: 40 },
          { user_email: 'third@test.com', activities: 30 },
          { user_email: 'fourth@test.com', activities: 20 },
        ],
      },
    });
    scenarioRequestAPI.getStats.mockResolvedValueOnce({ data: mockRequestStats });
    feedbackAPI.getStats.mockResolvedValueOnce({ data: mockFeedbackStats });

    renderAdminDashboard();

    await waitFor(() => {
      expect(screen.getByText('first@test.com')).toBeInTheDocument();
      expect(screen.getByText('second@test.com')).toBeInTheDocument();
      expect(screen.getByText('third@test.com')).toBeInTheDocument();
      expect(screen.getByText('fourth@test.com')).toBeInTheDocument();
      expect(screen.getByText('50 activities')).toBeInTheDocument();
      expect(screen.getByText('20 activities')).toBeInTheDocument();
    });
  });

  it('shows no activity data message when top_active_users is empty', async () => {
    const { dashboardAPI, scenarioRequestAPI, feedbackAPI } = await import('../../../services/api');
    dashboardAPI.getStats.mockResolvedValueOnce({ data: mockStats });
    dashboardAPI.getSummary.mockResolvedValueOnce({ data: mockSummary });
    dashboardAPI.getRecentLogins.mockResolvedValueOnce({ data: mockRecentLogins });
    dashboardAPI.getAnalytics.mockResolvedValueOnce({
      data: { ...mockAnalytics, top_active_users: [] },
    });
    scenarioRequestAPI.getStats.mockResolvedValueOnce({ data: mockRequestStats });
    feedbackAPI.getStats.mockResolvedValueOnce({ data: mockFeedbackStats });

    renderAdminDashboard();

    await waitFor(() => {
      expect(screen.getByText('No activity data available')).toBeInTheDocument();
    });
  });

  it('shows no recent signups message', async () => {
    const { dashboardAPI, scenarioRequestAPI, feedbackAPI } = await import('../../../services/api');
    dashboardAPI.getStats.mockResolvedValueOnce({ data: mockStats });
    dashboardAPI.getSummary.mockResolvedValueOnce({ data: mockSummary });
    dashboardAPI.getRecentLogins.mockResolvedValueOnce({ data: mockRecentLogins });
    dashboardAPI.getAnalytics.mockResolvedValueOnce({
      data: { ...mockAnalytics, recent_signups: [] },
    });
    scenarioRequestAPI.getStats.mockResolvedValueOnce({ data: mockRequestStats });
    feedbackAPI.getStats.mockResolvedValueOnce({ data: mockFeedbackStats });

    renderAdminDashboard();

    await waitFor(() => {
      expect(screen.getByText('No recent signups')).toBeInTheDocument();
    });
  });

  it('renders recent signup without full_name', async () => {
    const { dashboardAPI, scenarioRequestAPI, feedbackAPI } = await import('../../../services/api');
    dashboardAPI.getStats.mockResolvedValueOnce({ data: mockStats });
    dashboardAPI.getSummary.mockResolvedValueOnce({ data: mockSummary });
    dashboardAPI.getRecentLogins.mockResolvedValueOnce({ data: mockRecentLogins });
    dashboardAPI.getAnalytics.mockResolvedValueOnce({
      data: {
        ...mockAnalytics,
        recent_signups: [
          { email: 'noname@test.com', created_at: null },
        ],
      },
    });
    scenarioRequestAPI.getStats.mockResolvedValueOnce({ data: mockRequestStats });
    feedbackAPI.getStats.mockResolvedValueOnce({ data: mockFeedbackStats });

    renderAdminDashboard();

    await waitFor(() => {
      expect(screen.getByText('N/A')).toBeInTheDocument();
      expect(screen.getByText('noname@test.com')).toBeInTheDocument();
      expect(screen.getByText('Unknown')).toBeInTheDocument();
    });
  });

  it('renders login without last_login showing Never', async () => {
    const { dashboardAPI, scenarioRequestAPI, feedbackAPI } = await import('../../../services/api');
    dashboardAPI.getStats.mockResolvedValueOnce({ data: mockStats });
    dashboardAPI.getSummary.mockResolvedValueOnce({ data: mockSummary });
    dashboardAPI.getRecentLogins.mockResolvedValueOnce({
      data: {
        recent_logins: [
          { full_name: 'No Login User', email: 'nologin@test.com', last_login: null },
        ],
      },
    });
    dashboardAPI.getAnalytics.mockResolvedValueOnce({ data: mockAnalytics });
    scenarioRequestAPI.getStats.mockResolvedValueOnce({ data: mockRequestStats });
    feedbackAPI.getStats.mockResolvedValueOnce({ data: mockFeedbackStats });

    renderAdminDashboard();

    await waitFor(() => {
      expect(screen.getByText('No Login User')).toBeInTheDocument();
      expect(screen.getByText('Never')).toBeInTheDocument();
    });
  });

  it('renders rating distribution entries', async () => {
    await setupMocks();
    renderAdminDashboard();

    await waitFor(() => {
      expect(screen.getByText('Rating Distribution')).toBeInTheDocument();
      expect(screen.getByText('5★')).toBeInTheDocument();
      expect(screen.getByText('4★')).toBeInTheDocument();
      expect(screen.getByText('3★')).toBeInTheDocument();
      expect(screen.getByText('50')).toBeInTheDocument(); // 5-star count
    });
  });

  it('renders analytics with no activity_trend data', async () => {
    const { dashboardAPI, scenarioRequestAPI, feedbackAPI } = await import('../../../services/api');
    dashboardAPI.getStats.mockResolvedValueOnce({ data: mockStats });
    dashboardAPI.getSummary.mockResolvedValueOnce({ data: mockSummary });
    dashboardAPI.getRecentLogins.mockResolvedValueOnce({ data: mockRecentLogins });
    dashboardAPI.getAnalytics.mockResolvedValueOnce({
      data: {
        activity_trend: [],
        role_distribution: [],
        top_active_users: [{ user_email: 'u@t.com', activities: 5 }],
        recent_signups: [{ full_name: 'U', email: 'u@t.com', created_at: '2025-01-01T00:00:00Z' }],
      },
    });
    scenarioRequestAPI.getStats.mockResolvedValueOnce({ data: mockRequestStats });
    feedbackAPI.getStats.mockResolvedValueOnce({ data: mockFeedbackStats });

    renderAdminDashboard();

    await waitFor(() => {
      // Activity trend and role distribution should not appear
      expect(screen.queryByText('Activity Trend')).not.toBeInTheDocument();
      expect(screen.queryByText('Role Distribution')).not.toBeInTheDocument();
      // But top active users and recent signups should
      expect(screen.getByText('Top Active Users (Last 7 Days)')).toBeInTheDocument();
    });
  });

  it('renders without analytics data', async () => {
    const { dashboardAPI, scenarioRequestAPI, feedbackAPI } = await import('../../../services/api');
    dashboardAPI.getStats.mockResolvedValueOnce({ data: mockStats });
    dashboardAPI.getSummary.mockResolvedValueOnce({ data: mockSummary });
    dashboardAPI.getRecentLogins.mockResolvedValueOnce({ data: mockRecentLogins });
    dashboardAPI.getAnalytics.mockResolvedValueOnce({ data: null });
    scenarioRequestAPI.getStats.mockResolvedValueOnce({ data: mockRequestStats });
    feedbackAPI.getStats.mockResolvedValueOnce({ data: mockFeedbackStats });

    renderAdminDashboard();

    await waitFor(() => {
      expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
      // No analytics sections should appear
      expect(screen.queryByText('Activity Trend')).not.toBeInTheDocument();
      expect(screen.queryByText('Role Distribution')).not.toBeInTheDocument();
      expect(screen.queryByText('Top Active Users (Last 7 Days)')).not.toBeInTheDocument();
    });
  });

  it('renders stat cards with zero values when stats is null', async () => {
    const { dashboardAPI, scenarioRequestAPI, feedbackAPI } = await import('../../../services/api');
    dashboardAPI.getStats.mockResolvedValueOnce({ data: null });
    dashboardAPI.getSummary.mockResolvedValueOnce({ data: null });
    dashboardAPI.getRecentLogins.mockResolvedValueOnce({ data: { recent_logins: [] } });
    dashboardAPI.getAnalytics.mockResolvedValueOnce({ data: null });
    scenarioRequestAPI.getStats.mockResolvedValueOnce({ data: null });
    feedbackAPI.getStats.mockResolvedValueOnce({ data: null });

    renderAdminDashboard();

    await waitFor(() => {
      expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
    });
  });

  it('renders summary entity status excluding module and configurations keys', async () => {
    const { dashboardAPI, scenarioRequestAPI, feedbackAPI } = await import('../../../services/api');
    dashboardAPI.getStats.mockResolvedValueOnce({ data: mockStats });
    dashboardAPI.getSummary.mockResolvedValueOnce({
      data: {
        users: { active: 100, inactive: 10 },
        domains: { active: 5, inactive: 2 },
        module_status: { active: 3, inactive: 0 },
        configurations: { 'process-config': 2 },
      },
    });
    dashboardAPI.getRecentLogins.mockResolvedValueOnce({ data: mockRecentLogins });
    dashboardAPI.getAnalytics.mockResolvedValueOnce({ data: mockAnalytics });
    scenarioRequestAPI.getStats.mockResolvedValueOnce({ data: mockRequestStats });
    feedbackAPI.getStats.mockResolvedValueOnce({ data: mockFeedbackStats });

    renderAdminDashboard();

    await waitFor(() => {
      expect(screen.getByText('Entity Status Summary')).toBeInTheDocument();
      expect(screen.getByText('users')).toBeInTheDocument();
      expect(screen.getByText('domains')).toBeInTheDocument();
      // module_status should be filtered out (contains 'module')
      expect(screen.queryByText('module_status')).not.toBeInTheDocument();
    });
  });

  it('renders login without full_name showing U initial', async () => {
    const { dashboardAPI, scenarioRequestAPI, feedbackAPI } = await import('../../../services/api');
    dashboardAPI.getStats.mockResolvedValueOnce({ data: mockStats });
    dashboardAPI.getSummary.mockResolvedValueOnce({ data: mockSummary });
    dashboardAPI.getRecentLogins.mockResolvedValueOnce({
      data: {
        recent_logins: [
          { email: 'nofullname@test.com', last_login: '2025-01-15T10:00:00Z' },
        ],
      },
    });
    dashboardAPI.getAnalytics.mockResolvedValueOnce({ data: mockAnalytics });
    scenarioRequestAPI.getStats.mockResolvedValueOnce({ data: mockRequestStats });
    feedbackAPI.getStats.mockResolvedValueOnce({ data: mockFeedbackStats });

    renderAdminDashboard();

    await waitFor(() => {
      expect(screen.getByText('U')).toBeInTheDocument();
      expect(screen.getByText('nofullname@test.com')).toBeInTheDocument();
    });
  });
});
