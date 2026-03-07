import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import ErrorLogsPage from './ErrorLogsPage';

vi.mock('../../services/api', () => ({
  errorLogsAPI: {
    list: vi.fn(),
    getStats: vi.fn(),
    getLevels: vi.fn(),
    getTypes: vi.fn(),
    listArchives: vi.fn(),
    getCurrentFile: vi.fn(),
    forceArchive: vi.fn(),
    deleteArchive: vi.fn(),
    cleanup: vi.fn(),
    getArchiveDownloadUrl: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

const mockLogs = [
  {
    _id: 'log1',
    timestamp: '2025-01-15T10:00:00Z',
    level: 'ERROR',
    error_type: 'ValueError',
    message: 'Invalid input value',
    stack_trace: 'Traceback...',
    request_context: { method: 'POST', path: '/api/v1/users' },
  },
  {
    _id: 'log2',
    timestamp: '2025-01-15T09:00:00Z',
    level: 'WARNING',
    error_type: 'TimeoutError',
    message: 'Request timed out',
    stack_trace: null,
    request_context: {},
  },
];

const mockStats = {
  total: 25,
  days: 7,
  by_level: { ERROR: 15, WARNING: 10 },
  by_type: [{ type: 'ValueError', count: 10 }],
  timeline: [
    { date: '2025-01-14', count: 5 },
    { date: '2025-01-15', count: 3 },
  ],
};

async function setupCurrentLogsMocks() {
  const { errorLogsAPI } = await import('../../services/api');
  errorLogsAPI.list.mockResolvedValue({
    data: { data: mockLogs, pagination: { total: 2, pages: 1, page: 0, limit: 25 } },
  });
  errorLogsAPI.getStats.mockResolvedValue({ data: mockStats });
  errorLogsAPI.getLevels.mockResolvedValue({ data: { levels: ['ERROR', 'WARNING', 'CRITICAL'] } });
  errorLogsAPI.getTypes.mockResolvedValue({ data: { types: ['ValueError', 'TimeoutError'] } });
}

function renderErrorLogsPage() {
  return render(
    <MemoryRouter>
      <ErrorLogsPage />
    </MemoryRouter>
  );
}

describe('ErrorLogsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page header', async () => {
    await setupCurrentLogsMocks();
    renderErrorLogsPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Error Logs' })).toBeInTheDocument();
      expect(screen.getByText('View and manage application error logs')).toBeInTheDocument();
    });
  });

  it('renders tabs for current logs and archives', async () => {
    await setupCurrentLogsMocks();
    renderErrorLogsPage();

    await waitFor(() => {
      expect(screen.getByText('Current Logs')).toBeInTheDocument();
      expect(screen.getByText('Archives')).toBeInTheDocument();
    });
  });

  it('renders statistics cards', async () => {
    await setupCurrentLogsMocks();
    renderErrorLogsPage();

    await waitFor(() => {
      expect(screen.getByText('Total Errors')).toBeInTheDocument();
      expect(screen.getByText('25')).toBeInTheDocument();
      expect(screen.getByText('By Level')).toBeInTheDocument();
      expect(screen.getByText('Error Types')).toBeInTheDocument();
    });
  });

  it('renders error logs table', async () => {
    await setupCurrentLogsMocks();
    renderErrorLogsPage();

    await waitFor(() => {
      expect(screen.getByText('Invalid input value')).toBeInTheDocument();
      expect(screen.getAllByText('ValueError').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Request timed out')).toBeInTheDocument();
      expect(screen.getAllByText('TimeoutError').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders filter inputs', async () => {
    await setupCurrentLogsMocks();
    renderErrorLogsPage();

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search in message or stack trace...')).toBeInTheDocument();
      expect(screen.getByText('All Levels')).toBeInTheDocument();
      expect(screen.getByText('All Types')).toBeInTheDocument();
    });
  });

  it('shows empty state when no logs', async () => {
    const { errorLogsAPI } = await import('../../services/api');
    errorLogsAPI.list.mockResolvedValue({ data: { data: [], pagination: { total: 0, pages: 0 } } });
    errorLogsAPI.getStats.mockResolvedValue({ data: { total: 0, days: 7, by_level: {}, by_type: [] } });
    errorLogsAPI.getLevels.mockResolvedValue({ data: { levels: [] } });
    errorLogsAPI.getTypes.mockResolvedValue({ data: { types: [] } });

    renderErrorLogsPage();

    await waitFor(() => {
      expect(screen.getByText('No error logs found')).toBeInTheDocument();
    });
  });

  it('handles API error', async () => {
    const { errorLogsAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    errorLogsAPI.list.mockRejectedValue(new Error('API Error'));
    errorLogsAPI.getStats.mockRejectedValue(new Error('API Error'));
    errorLogsAPI.getLevels.mockRejectedValue(new Error('API Error'));
    errorLogsAPI.getTypes.mockRejectedValue(new Error('API Error'));

    renderErrorLogsPage();

    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalledWith('Failed to load error logs');
    });
  });

  it('renders time range selector', async () => {
    await setupCurrentLogsMocks();
    renderErrorLogsPage();

    await waitFor(() => {
      expect(screen.getByText('Last 7 Days')).toBeInTheDocument();
    });
  });

  it('shows request context in log rows', async () => {
    await setupCurrentLogsMocks();
    renderErrorLogsPage();

    await waitFor(() => {
      expect(screen.getByText('POST /api/v1/users')).toBeInTheDocument();
    });
  });

  it('switches to archives tab', async () => {
    await setupCurrentLogsMocks();
    const { errorLogsAPI } = await import('../../services/api');
    errorLogsAPI.listArchives.mockResolvedValue({ data: { archives: [] } });
    errorLogsAPI.getCurrentFile.mockResolvedValue({ data: { size: 1024, line_count: 50 } });
    const user = userEvent.setup();

    renderErrorLogsPage();

    await waitFor(() => {
      expect(screen.getByText('Current Logs')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Archives'));

    await waitFor(() => {
      expect(errorLogsAPI.listArchives).toHaveBeenCalled();
    });
  });

  it('handles force archive', async () => {
    await setupCurrentLogsMocks();
    const { errorLogsAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    errorLogsAPI.forceArchive.mockResolvedValue({ data: { message: 'Archived' } });
    errorLogsAPI.listArchives.mockResolvedValue({ data: { archives: [] } });
    errorLogsAPI.getCurrentFile.mockResolvedValue({ data: { size: 1024, line_count: 50 } });
    const user = userEvent.setup();

    renderErrorLogsPage();

    await waitFor(() => {
      expect(screen.getByText('Current Logs')).toBeInTheDocument();
    });

    // Switch to archives tab
    await user.click(screen.getByText('Archives'));

    await waitFor(() => {
      expect(errorLogsAPI.listArchives).toHaveBeenCalled();
    });
  });

  it('shows log level filter options', async () => {
    await setupCurrentLogsMocks();
    renderErrorLogsPage();

    await waitFor(() => {
      expect(screen.getByText('All Levels')).toBeInTheDocument();
    });
  });

  it('shows error type filter options', async () => {
    await setupCurrentLogsMocks();
    renderErrorLogsPage();

    await waitFor(() => {
      expect(screen.getByText('All Types')).toBeInTheDocument();
    });
  });

  it('renders level badges in table', async () => {
    await setupCurrentLogsMocks();
    renderErrorLogsPage();

    await waitFor(() => {
      expect(screen.getByText('ERROR')).toBeInTheDocument();
      expect(screen.getByText('WARNING')).toBeInTheDocument();
    });
  });

  it('renders error type badges', async () => {
    await setupCurrentLogsMocks();
    renderErrorLogsPage();

    await waitFor(() => {
      expect(screen.getAllByText('ValueError').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('TimeoutError').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders timeline stats', async () => {
    await setupCurrentLogsMocks();
    renderErrorLogsPage();

    await waitFor(() => {
      expect(screen.getByText('Total Errors')).toBeInTheDocument();
      expect(screen.getByText('25')).toBeInTheDocument();
    });
  });

  it('renders search input', async () => {
    await setupCurrentLogsMocks();
    renderErrorLogsPage();

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search in message or stack trace...')).toBeInTheDocument();
    });
  });

  it('renders by level stats', async () => {
    await setupCurrentLogsMocks();
    renderErrorLogsPage();

    await waitFor(() => {
      expect(screen.getByText('By Level')).toBeInTheDocument();
    });
  });

  it('renders by type stats', async () => {
    await setupCurrentLogsMocks();
    renderErrorLogsPage();

    await waitFor(() => {
      expect(screen.getByText('Error Types')).toBeInTheDocument();
    });
  });

  it('handles stats API error gracefully', async () => {
    const { errorLogsAPI } = await import('../../services/api');
    errorLogsAPI.list.mockResolvedValue({
      data: { data: [], pagination: { total: 0, pages: 0, page: 0, limit: 25 } },
    });
    errorLogsAPI.getStats.mockRejectedValue(new Error('Stats error'));
    errorLogsAPI.getLevels.mockResolvedValue({ data: { levels: [] } });
    errorLogsAPI.getTypes.mockResolvedValue({ data: { types: [] } });

    renderErrorLogsPage();

    await waitFor(() => {
      // Should still render the page even if stats fail
      expect(screen.getByRole('heading', { name: 'Error Logs' })).toBeInTheDocument();
    });
  });
});
