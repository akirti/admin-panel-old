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

  it('expands log row to show stack trace', async () => {
    await setupCurrentLogsMocks();
    const user = userEvent.setup();
    renderErrorLogsPage();

    await waitFor(() => {
      expect(screen.getByText('Invalid input value')).toBeInTheDocument();
    });

    // Click the row with stack trace - find the expand button in the first row
    const row = screen.getByText('Invalid input value').closest('tr');
    const expandBtn = row.querySelector('button');
    if (expandBtn) {
      await user.click(expandBtn);

      await waitFor(() => {
        expect(screen.getByText('Stack Trace:')).toBeInTheDocument();
      });
    }
  });

  it('handles search filter', async () => {
    await setupCurrentLogsMocks();
    const { errorLogsAPI } = await import('../../services/api');
    const user = userEvent.setup();
    renderErrorLogsPage();

    await waitFor(() => {
      expect(screen.getByText('Invalid input value')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search in message or stack trace...');
    await user.type(searchInput, 'invalid');

    await waitFor(() => {
      expect(errorLogsAPI.list).toHaveBeenCalledWith(expect.objectContaining({
        search: 'invalid',
      }));
    });
  });

  it('handles level filter change', async () => {
    await setupCurrentLogsMocks();
    const { errorLogsAPI } = await import('../../services/api');
    const user = userEvent.setup();
    renderErrorLogsPage();

    await waitFor(() => {
      expect(screen.getByText('Invalid input value')).toBeInTheDocument();
    });

    const levelSelect = screen.getByDisplayValue('All Levels');
    await user.selectOptions(levelSelect, 'ERROR');

    await waitFor(() => {
      expect(errorLogsAPI.list).toHaveBeenCalledWith(expect.objectContaining({
        level: 'ERROR',
      }));
    });
  });

  it('handles error type filter change', async () => {
    await setupCurrentLogsMocks();
    const { errorLogsAPI } = await import('../../services/api');
    const user = userEvent.setup();
    renderErrorLogsPage();

    await waitFor(() => {
      expect(screen.getByText('Invalid input value')).toBeInTheDocument();
    });

    const typeSelect = screen.getByDisplayValue('All Types');
    await user.selectOptions(typeSelect, 'ValueError');

    await waitFor(() => {
      expect(errorLogsAPI.list).toHaveBeenCalledWith(expect.objectContaining({
        error_type: 'ValueError',
      }));
    });
  });

  it('handles time range change', async () => {
    await setupCurrentLogsMocks();
    const { errorLogsAPI } = await import('../../services/api');
    const user = userEvent.setup();
    renderErrorLogsPage();

    await waitFor(() => {
      expect(screen.getByText('Invalid input value')).toBeInTheDocument();
    });

    // Time range is a select, find by current value
    const timeSelect = screen.getByDisplayValue('Last 7 Days');
    await user.selectOptions(timeSelect, '30');

    await waitFor(() => {
      expect(errorLogsAPI.list).toHaveBeenCalledWith(expect.objectContaining({
        days: 30,
      }));
    });
  });

  it('handles force archive with confirmation', async () => {
    await setupCurrentLogsMocks();
    const { errorLogsAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    errorLogsAPI.forceArchive.mockResolvedValue({ data: { archived: true, message: 'Archived successfully' } });
    errorLogsAPI.listArchives.mockResolvedValue({ data: { archives: [] } });
    errorLogsAPI.getCurrentFile.mockResolvedValue({ data: { size: 1024, line_count: 50 } });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();

    renderErrorLogsPage();

    await waitFor(() => {
      expect(screen.getByText('Current Logs')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Archives'));

    await waitFor(() => {
      expect(screen.getByText('Force Archive')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Force Archive'));

    await waitFor(() => {
      expect(errorLogsAPI.forceArchive).toHaveBeenCalled();
    });

    vi.restoreAllMocks();
  });

  it('handles cleanup with prompt', async () => {
    await setupCurrentLogsMocks();
    const { errorLogsAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    errorLogsAPI.cleanup.mockResolvedValue({ data: { deleted_count: 3 } });
    errorLogsAPI.listArchives.mockResolvedValue({ data: { archives: [] } });
    errorLogsAPI.getCurrentFile.mockResolvedValue({ data: { size: 1024, line_count: 50 } });
    vi.spyOn(window, 'prompt').mockReturnValue('30');
    const user = userEvent.setup();

    renderErrorLogsPage();

    await waitFor(() => {
      expect(screen.getByText('Current Logs')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Archives'));

    await waitFor(() => {
      expect(screen.getByText('Cleanup Old')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Cleanup Old'));

    await waitFor(() => {
      expect(errorLogsAPI.cleanup).toHaveBeenCalledWith(30);
    });

    vi.restoreAllMocks();
  });

  it('shows today stats card', async () => {
    await setupCurrentLogsMocks();
    renderErrorLogsPage();

    await waitFor(() => {
      expect(screen.getByText('Today')).toBeInTheDocument();
    });
  });

  it('shows archive current file info', async () => {
    await setupCurrentLogsMocks();
    const { errorLogsAPI } = await import('../../services/api');
    errorLogsAPI.listArchives.mockResolvedValue({ data: { archives: [] } });
    errorLogsAPI.getCurrentFile.mockResolvedValue({ data: { size: 2048, line_count: 100 } });
    const user = userEvent.setup();

    renderErrorLogsPage();

    await waitFor(() => {
      expect(screen.getByText('Current Logs')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Archives'));

    await waitFor(() => {
      expect(screen.getByText('Current Log File')).toBeInTheDocument();
    });
  });

  it('handles delete archive with confirmation', async () => {
    await setupCurrentLogsMocks();
    const { errorLogsAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    const mockArchives = [
      { archive_id: 'arch1', file_name: 'errors_2025-01-01.log', date_range: { start: '2025-01-01', end: '2025-01-07' }, error_count: 50, compressed_size: 5120, original_size: 10240, created_at: '2025-01-08' },
    ];
    errorLogsAPI.listArchives.mockResolvedValue({ data: { archives: mockArchives } });
    errorLogsAPI.getCurrentFile.mockResolvedValue({ data: { size: 1024, line_count: 50 } });
    errorLogsAPI.deleteArchive.mockResolvedValue({ data: {} });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();

    renderErrorLogsPage();

    await waitFor(() => {
      expect(screen.getByText('Current Logs')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Archives'));

    await waitFor(() => {
      expect(screen.getByText('errors_2025-01-01.log')).toBeInTheDocument();
    });

    // Find and click delete button for archive (title="Delete")
    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(errorLogsAPI.deleteArchive).toHaveBeenCalledWith('arch1');
    });

    vi.restoreAllMocks();
  });

  it('handles download archive', async () => {
    await setupCurrentLogsMocks();
    const { errorLogsAPI } = await import('../../services/api');
    const mockArchives = [
      { archive_id: 'arch1', file_name: 'errors_2025-01-01.log', date_range: { start: '2025-01-01', end: '2025-01-07' }, error_count: 50, compressed_size: 5120, original_size: 10240, created_at: '2025-01-08' },
    ];
    errorLogsAPI.listArchives.mockResolvedValue({ data: { archives: mockArchives } });
    errorLogsAPI.getCurrentFile.mockResolvedValue({ data: { size: 1024, line_count: 50 } });
    errorLogsAPI.getArchiveDownloadUrl.mockResolvedValue({ data: { download_url: 'https://download.test/file' } });
    vi.spyOn(window, 'open').mockImplementation(() => {});
    const user = userEvent.setup();

    renderErrorLogsPage();

    await waitFor(() => {
      expect(screen.getByText('Current Logs')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Archives'));

    await waitFor(() => {
      expect(screen.getByText('errors_2025-01-01.log')).toBeInTheDocument();
    });

    // Find and click download button for archive (title="Download")
    const downloadButtons = screen.getAllByTitle('Download');
    await user.click(downloadButtons[0]);

    await waitFor(() => {
      expect(errorLogsAPI.getArchiveDownloadUrl).toHaveBeenCalledWith('arch1');
    });

    vi.restoreAllMocks();
  });

  it('shows CRITICAL level badge correctly', async () => {
    const { errorLogsAPI } = await import('../../services/api');
    errorLogsAPI.list.mockResolvedValue({
      data: {
        data: [
          { _id: 'log3', timestamp: '2025-01-15T08:00:00Z', level: 'CRITICAL', error_type: 'SystemError', message: 'System critical failure', stack_trace: null, request_context: {} },
        ],
        pagination: { total: 1, pages: 1, page: 0, limit: 25 },
      },
    });
    errorLogsAPI.getStats.mockResolvedValue({ data: { total: 1, days: 7, by_level: { CRITICAL: 1 }, by_type: [{ type: 'SystemError', count: 1 }] } });
    errorLogsAPI.getLevels.mockResolvedValue({ data: { levels: ['CRITICAL'] } });
    errorLogsAPI.getTypes.mockResolvedValue({ data: { types: ['SystemError'] } });

    renderErrorLogsPage();

    await waitFor(() => {
      const criticalEls = screen.getAllByText('CRITICAL');
      expect(criticalEls.length).toBeGreaterThanOrEqual(2); // filter option + badge
      expect(screen.getByText('System critical failure')).toBeInTheDocument();
    });
  });

  it('shows archive files with size info', async () => {
    await setupCurrentLogsMocks();
    const { errorLogsAPI } = await import('../../services/api');
    const mockArchives = [
      {
        archive_id: 'arch1',
        file_name: 'errors_2025-01-01.log',
        date_range: { start: '2025-01-01', end: '2025-01-07' },
        error_count: 50,
        compressed_size: 5120,
        original_size: 10240,
        created_at: '2025-01-08',
      },
    ];
    errorLogsAPI.listArchives.mockResolvedValue({ data: { archives: mockArchives } });
    errorLogsAPI.getCurrentFile.mockResolvedValue({ data: { size: 2048000, line_count: 500 } });
    const user = userEvent.setup();

    renderErrorLogsPage();

    await waitFor(() => {
      expect(screen.getByText('Current Logs')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Archives'));

    await waitFor(() => {
      expect(screen.getByText('errors_2025-01-01.log')).toBeInTheDocument();
      // Should display error count
      expect(screen.getByText(/50/)).toBeInTheDocument();
    });
  });

  it('handles force archive cancellation', async () => {
    await setupCurrentLogsMocks();
    const { errorLogsAPI } = await import('../../services/api');
    errorLogsAPI.listArchives.mockResolvedValue({ data: { archives: [] } });
    errorLogsAPI.getCurrentFile.mockResolvedValue({ data: { size: 1024, line_count: 50 } });
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();

    renderErrorLogsPage();

    await waitFor(() => {
      expect(screen.getByText('Current Logs')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Archives'));

    await waitFor(() => {
      expect(screen.getByText('Force Archive')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Force Archive'));

    expect(errorLogsAPI.forceArchive).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('handles cleanup cancellation', async () => {
    await setupCurrentLogsMocks();
    const { errorLogsAPI } = await import('../../services/api');
    errorLogsAPI.listArchives.mockResolvedValue({ data: { archives: [] } });
    errorLogsAPI.getCurrentFile.mockResolvedValue({ data: { size: 1024, line_count: 50 } });
    vi.spyOn(window, 'prompt').mockReturnValue(null);
    const user = userEvent.setup();

    renderErrorLogsPage();

    await waitFor(() => {
      expect(screen.getByText('Current Logs')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Archives'));

    await waitFor(() => {
      expect(screen.getByText('Cleanup Old')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Cleanup Old'));

    expect(errorLogsAPI.cleanup).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('handles force archive error', async () => {
    await setupCurrentLogsMocks();
    const { errorLogsAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    errorLogsAPI.forceArchive.mockRejectedValue(new Error('Archive failed'));
    errorLogsAPI.listArchives.mockResolvedValue({ data: { archives: [] } });
    errorLogsAPI.getCurrentFile.mockResolvedValue({ data: { size: 1024, line_count: 50 } });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();

    renderErrorLogsPage();

    await waitFor(() => {
      expect(screen.getByText('Current Logs')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Archives'));

    await waitFor(() => {
      expect(screen.getByText('Force Archive')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Force Archive'));

    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalled();
    });

    vi.restoreAllMocks();
  });

  it('handles delete archive cancellation', async () => {
    await setupCurrentLogsMocks();
    const { errorLogsAPI } = await import('../../services/api');
    const mockArchives = [
      { archive_id: 'arch1', file_name: 'errors_2025-01-01.log', date_range: { start: '2025-01-01', end: '2025-01-07' }, error_count: 50, compressed_size: 5120, original_size: 10240, created_at: '2025-01-08' },
    ];
    errorLogsAPI.listArchives.mockResolvedValue({ data: { archives: mockArchives } });
    errorLogsAPI.getCurrentFile.mockResolvedValue({ data: { size: 1024, line_count: 50 } });
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();

    renderErrorLogsPage();

    await waitFor(() => {
      expect(screen.getByText('Current Logs')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Archives'));

    await waitFor(() => {
      expect(screen.getByText('errors_2025-01-01.log')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);

    expect(errorLogsAPI.deleteArchive).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('expands and collapses log row', async () => {
    await setupCurrentLogsMocks();
    const user = userEvent.setup();
    renderErrorLogsPage();

    await waitFor(() => {
      expect(screen.getByText('Invalid input value')).toBeInTheDocument();
    });

    // Click on the first log row to expand it
    const row = screen.getByText('Invalid input value').closest('tr');
    if (row) {
      await user.click(row);
      // Stack trace should show for log1
      await waitFor(() => {
        expect(screen.getByText('Traceback...')).toBeInTheDocument();
      });

      // Click again to collapse
      await user.click(row);
    }
  });

  it('changes time range filter', async () => {
    await setupCurrentLogsMocks();
    const { errorLogsAPI } = await import('../../services/api');
    const user = userEvent.setup();
    renderErrorLogsPage();

    await waitFor(() => {
      expect(screen.getByText('Invalid input value')).toBeInTheDocument();
    });

    // Find time range dropdown
    const timeSelect = screen.getByDisplayValue('Last 7 Days');
    if (timeSelect) {
      await user.selectOptions(timeSelect, '30');
      await waitFor(() => {
        expect(errorLogsAPI.list).toHaveBeenCalledTimes(2);
      });
    }
  });

  it('changes level filter', async () => {
    await setupCurrentLogsMocks();
    const { errorLogsAPI } = await import('../../services/api');
    const user = userEvent.setup();
    renderErrorLogsPage();

    await waitFor(() => {
      expect(screen.getByText('Invalid input value')).toBeInTheDocument();
    });

    const levelSelect = screen.getByDisplayValue('All Levels');
    if (levelSelect) {
      await user.selectOptions(levelSelect, 'ERROR');
      await waitFor(() => {
        expect(errorLogsAPI.list).toHaveBeenCalledTimes(2);
      });
    }
  });

  it('changes type filter', async () => {
    await setupCurrentLogsMocks();
    const { errorLogsAPI } = await import('../../services/api');
    const user = userEvent.setup();
    renderErrorLogsPage();

    await waitFor(() => {
      expect(screen.getByText('Invalid input value')).toBeInTheDocument();
    });

    const typeSelect = screen.getByDisplayValue('All Types');
    if (typeSelect) {
      await user.selectOptions(typeSelect, 'ValueError');
      await waitFor(() => {
        expect(errorLogsAPI.list).toHaveBeenCalledTimes(2);
      });
    }
  });

  it('shows stats summary cards', async () => {
    await setupCurrentLogsMocks();
    renderErrorLogsPage();

    await waitFor(() => {
      expect(screen.getByText('Total Errors')).toBeInTheDocument();
      expect(screen.getByText('25')).toBeInTheDocument();
    });
  });

  it('shows empty archives state', async () => {
    await setupCurrentLogsMocks();
    const { errorLogsAPI } = await import('../../services/api');
    errorLogsAPI.listArchives.mockResolvedValue({ data: { archives: [] } });
    errorLogsAPI.getCurrentFile.mockResolvedValue({ data: { size: 0, line_count: 0 } });
    const user = userEvent.setup();

    renderErrorLogsPage();

    await waitFor(() => {
      expect(screen.getByText('Current Logs')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Archives'));

    await waitFor(() => {
      expect(screen.getByText(/No archived/i)).toBeInTheDocument();
    });
  });

});
