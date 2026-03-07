import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import ActivityLogsPage from './ActivityLogsPage';

vi.mock('../../services/api', () => ({
  activityLogsAPI: {
    list: vi.fn(),
    getStats: vi.fn(),
    getActions: vi.fn(),
    getEntityTypes: vi.fn(),
  },
  exportAPI: {
    activityLogs: { csv: vi.fn(), json: vi.fn() },
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../components/shared', () => ({
  ExportButton: ({ label }) => <button>{label}</button>,
}));

const mockLogs = [
  {
    _id: '1',
    timestamp: '2025-01-15T10:00:00Z',
    action: 'create',
    entity_type: 'user',
    entity_id: 'user123',
    user_email: 'admin@test.com',
    changes: { status: { old: 'inactive', new: 'active' } },
  },
  {
    _id: '2',
    timestamp: '2025-01-15T09:00:00Z',
    action: 'update',
    entity_type: 'domain',
    entity_id: 'domain456',
    user_email: 'admin@test.com',
    changes: {},
  },
];

const mockStats = {
  total_activities: 50,
  period_days: 7,
  actions: [
    { action: 'create', count: 20 },
    { action: 'update', count: 30 },
  ],
  entities: [
    { entity_type: 'user' },
    { entity_type: 'domain' },
  ],
  top_users: [{ user_email: 'admin@test.com' }],
};

async function setupMocks() {
  const { activityLogsAPI } = await import('../../services/api');
  activityLogsAPI.list.mockResolvedValue({
    data: { data: mockLogs, pagination: { total: 2, pages: 1, page: 0, limit: 25 } },
  });
  activityLogsAPI.getStats.mockResolvedValue({ data: mockStats });
  activityLogsAPI.getActions.mockResolvedValue({ data: { actions: ['create', 'update', 'delete'] } });
  activityLogsAPI.getEntityTypes.mockResolvedValue({ data: { entity_types: ['user', 'domain'] } });
}

function renderActivityLogsPage() {
  return render(
    <MemoryRouter>
      <ActivityLogsPage />
    </MemoryRouter>
  );
}

describe('ActivityLogsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page header', async () => {
    await setupMocks();
    renderActivityLogsPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Activity Logs' })).toBeInTheDocument();
      expect(screen.getByText('View and audit all system activities')).toBeInTheDocument();
    });
  });

  it('renders statistics cards', async () => {
    await setupMocks();
    renderActivityLogsPage();

    await waitFor(() => {
      expect(screen.getByText('Total Activities')).toBeInTheDocument();
      expect(screen.getByText('50')).toBeInTheDocument();
      expect(screen.getByText('Action Types')).toBeInTheDocument();
      expect(screen.getByText('Entity Types')).toBeInTheDocument();
      expect(screen.getByText('Active Users')).toBeInTheDocument();
    });
  });

  it('renders logs table', async () => {
    await setupMocks();
    renderActivityLogsPage();

    await waitFor(() => {
      expect(screen.getAllByText('admin@test.com').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('user123')).toBeInTheDocument();
      expect(screen.getByText('domain456')).toBeInTheDocument();
    });
  });

  it('renders filter inputs', async () => {
    await setupMocks();
    renderActivityLogsPage();

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Filter by user email...')).toBeInTheDocument();
      expect(screen.getByText('All Entity Types')).toBeInTheDocument();
      expect(screen.getByText('All Actions')).toBeInTheDocument();
    });
  });

  it('renders export buttons', async () => {
    await setupMocks();
    renderActivityLogsPage();

    await waitFor(() => {
      expect(screen.getByText('Export CSV')).toBeInTheDocument();
      expect(screen.getByText('Export JSON')).toBeInTheDocument();
    });
  });

  it('renders time range selector', async () => {
    await setupMocks();
    renderActivityLogsPage();

    await waitFor(() => {
      expect(screen.getByText('Last 7 Days')).toBeInTheDocument();
    });
  });

  it('shows empty state when no logs', async () => {
    const { activityLogsAPI } = await import('../../services/api');
    activityLogsAPI.list.mockResolvedValue({ data: { data: [], pagination: { total: 0, pages: 0, page: 0, limit: 25 } } });
    activityLogsAPI.getStats.mockResolvedValue({ data: mockStats });
    activityLogsAPI.getActions.mockResolvedValue({ data: { actions: [] } });
    activityLogsAPI.getEntityTypes.mockResolvedValue({ data: { entity_types: [] } });

    renderActivityLogsPage();

    await waitFor(() => {
      expect(screen.getByText('No activity logs found')).toBeInTheDocument();
    });
  });

  it('handles API error', async () => {
    const { activityLogsAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    activityLogsAPI.list.mockRejectedValue(new Error('API Error'));
    activityLogsAPI.getStats.mockRejectedValue(new Error('API Error'));
    activityLogsAPI.getActions.mockRejectedValue(new Error('API Error'));
    activityLogsAPI.getEntityTypes.mockRejectedValue(new Error('API Error'));

    renderActivityLogsPage();

    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalledWith('Failed to load activity logs');
    });
  });

  it('handles user email filter', async () => {
    await setupMocks();
    const { activityLogsAPI } = await import('../../services/api');
    const user = (await import('@testing-library/user-event')).default.setup();

    renderActivityLogsPage();

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Filter by user email...')).toBeInTheDocument();
    });

    const emailInput = screen.getByPlaceholderText('Filter by user email...');
    await user.type(emailInput, 'admin');

    await waitFor(() => {
      expect(activityLogsAPI.list).toHaveBeenCalledWith(expect.objectContaining({
        user_email: 'admin',
      }));
    });
  });

  it('handles entity type filter', async () => {
    await setupMocks();
    const { activityLogsAPI } = await import('../../services/api');
    const user = (await import('@testing-library/user-event')).default.setup();

    renderActivityLogsPage();

    await waitFor(() => {
      expect(screen.getByText('All Entity Types')).toBeInTheDocument();
    });

    const entitySelect = screen.getByDisplayValue('All Entity Types');
    await user.selectOptions(entitySelect, 'user');

    await waitFor(() => {
      expect(activityLogsAPI.list).toHaveBeenCalledWith(expect.objectContaining({
        entity_type: 'user',
      }));
    });
  });

  it('handles action filter', async () => {
    await setupMocks();
    const { activityLogsAPI } = await import('../../services/api');
    const user = (await import('@testing-library/user-event')).default.setup();

    renderActivityLogsPage();

    await waitFor(() => {
      expect(screen.getByText('All Actions')).toBeInTheDocument();
    });

    const actionSelect = screen.getByDisplayValue('All Actions');
    await user.selectOptions(actionSelect, 'create');

    await waitFor(() => {
      expect(activityLogsAPI.list).toHaveBeenCalledWith(expect.objectContaining({
        action: 'create',
      }));
    });
  });

  it('handles time range change', async () => {
    await setupMocks();
    const { activityLogsAPI } = await import('../../services/api');
    const user = (await import('@testing-library/user-event')).default.setup();

    renderActivityLogsPage();

    await waitFor(() => {
      expect(screen.getByText('Last 7 Days')).toBeInTheDocument();
    });

    const timeSelect = screen.getByDisplayValue('Last 7 Days');
    await user.selectOptions(timeSelect, '30');

    await waitFor(() => {
      expect(activityLogsAPI.list).toHaveBeenCalledWith(expect.objectContaining({
        days: 30,
      }));
    });
  });

  it('shows action color badges', async () => {
    await setupMocks();
    renderActivityLogsPage();

    await waitFor(() => {
      // Actions in stats show as "action (count)" and in table as "action"
      expect(screen.getByText('create (20)')).toBeInTheDocument();
      expect(screen.getByText('update (30)')).toBeInTheDocument();
    });
  });

  it('shows changes in log entries', async () => {
    await setupMocks();
    renderActivityLogsPage();

    await waitFor(() => {
      // The first log entry has changes with old/new values
      expect(screen.getByText(/inactive/)).toBeInTheDocument();
    });
  });

  it('shows top user in statistics', async () => {
    await setupMocks();
    renderActivityLogsPage();

    await waitFor(() => {
      expect(screen.getAllByText('admin@test.com').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders timeline when stats have timeline data', async () => {
    const { activityLogsAPI } = await import('../../services/api');
    activityLogsAPI.list.mockResolvedValue({
      data: { data: mockLogs, pagination: { total: 2, pages: 1, page: 0, limit: 25 } },
    });
    activityLogsAPI.getStats.mockResolvedValue({
      data: {
        ...mockStats,
        timeline: [
          { date: '2025-01-15', count: 10 },
          { date: '2025-01-14', count: 5 },
        ],
      },
    });
    activityLogsAPI.getActions.mockResolvedValue({ data: { actions: ['create'] } });
    activityLogsAPI.getEntityTypes.mockResolvedValue({ data: { entity_types: ['user'] } });

    renderActivityLogsPage();

    await waitFor(() => {
      expect(screen.getByText('Activity Timeline')).toBeInTheDocument();
    });
  });

  it('shows entity IDs in table', async () => {
    await setupMocks();
    renderActivityLogsPage();

    await waitFor(() => {
      expect(screen.getByText('user123')).toBeInTheDocument();
      expect(screen.getByText('domain456')).toBeInTheDocument();
    });
  });

  it('truncates long entity IDs', async () => {
    const { activityLogsAPI } = await import('../../services/api');
    const longIdLog = [{
      ...mockLogs[0],
      entity_id: 'very_long_entity_id_that_exceeds_20_characters',
    }];
    activityLogsAPI.list.mockResolvedValue({
      data: { data: longIdLog, pagination: { total: 1, pages: 1, page: 0, limit: 25 } },
    });
    activityLogsAPI.getStats.mockResolvedValue({ data: mockStats });
    activityLogsAPI.getActions.mockResolvedValue({ data: { actions: ['create'] } });
    activityLogsAPI.getEntityTypes.mockResolvedValue({ data: { entity_types: ['user'] } });

    renderActivityLogsPage();

    await waitFor(() => {
      expect(screen.getByText('very_long_entity_id_...')).toBeInTheDocument();
    });
  });
});
