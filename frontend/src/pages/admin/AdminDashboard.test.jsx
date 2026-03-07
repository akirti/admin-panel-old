import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import AdminDashboard from './AdminDashboard';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    isSuperAdmin: () => true,
  }),
}));

vi.mock('../../services/api', () => ({
  dashboardAPI: {
    getStats: vi.fn(),
    getSummary: vi.fn(),
    getRecentLogins: vi.fn(),
    getAnalytics: vi.fn(),
  },
  scenarioRequestAPI: {
    getStats: vi.fn(),
  },
  feedbackAPI: {
    getStats: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
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
  const { dashboardAPI, scenarioRequestAPI, feedbackAPI } = await import('../../services/api');
  dashboardAPI.getStats.mockResolvedValueOnce({ data: mockStats });
  dashboardAPI.getSummary.mockResolvedValueOnce({ data: mockSummary });
  dashboardAPI.getRecentLogins.mockResolvedValueOnce({ data: mockRecentLogins });
  dashboardAPI.getAnalytics.mockResolvedValueOnce({ data: mockAnalytics });
  scenarioRequestAPI.getStats.mockResolvedValueOnce({ data: mockRequestStats });
  feedbackAPI.getStats.mockResolvedValueOnce({ data: mockFeedbackStats });
}

describe('AdminDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', async () => {
    const { dashboardAPI, scenarioRequestAPI, feedbackAPI } = await import('../../services/api');
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
      expect(screen.getByText('Activity Trend (Last 7 Days)')).toBeInTheDocument();
      expect(screen.getByText('Role Distribution')).toBeInTheDocument();
      expect(screen.getByText('Top Active Users (Last 7 Days)')).toBeInTheDocument();
      expect(screen.getByText('Recent User Signups')).toBeInTheDocument();
    });
  });

  it('handles API error', async () => {
    const { dashboardAPI, scenarioRequestAPI, feedbackAPI } = await import('../../services/api');
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
    const { dashboardAPI, scenarioRequestAPI, feedbackAPI } = await import('../../services/api');
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
});
