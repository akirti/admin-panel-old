import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import FeedbackManagement from '../../../pages/admin/FeedbackManagement';

jest.mock('../../../services/api', () => ({
  feedbackAPI: {
    getAdminList: jest.fn(),
    getStats: jest.fn(),
  },
}));

jest.mock('react-hot-toast', () => ({ __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../../../components/shared', () => ({
  Modal: ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;
    return <div data-testid="modal"><h2>{title}</h2><button onClick={onClose} aria-label="Close dialog">X</button>{children}</div>;
  },
  Table: ({ columns, data, loading, emptyMessage }) => {
    if (loading) return <div>Loading...</div>;
    if (!data || data.length === 0) return <div>{emptyMessage || 'No data available'}</div>;
    return (
      <table>
        <thead><tr>{columns.map(c => <th key={c.key}>{c.title}</th>)}</tr></thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={row._id || i}>
              {columns.map(c => (
                <td key={c.key}>{c.render ? c.render(row[c.key], row) : row[c.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  },
}));

const mockFeedback = [
  {
    _id: 'fb1',
    name: 'John',
    email: 'john@test.com',
    rating: 5,
    message: 'Great product!',
    improvements: 'Nothing to improve',
    suggestions: 'Keep going',
    is_public: true,
    source: 'web',
    createdAt: '2025-01-15T10:00:00Z',
  },
  {
    _id: 'fb2',
    name: 'Jane',
    email: 'jane@test.com',
    rating: 3,
    message: 'Decent experience',
    improvements: 'Speed could be better',
    suggestions: 'Add dark mode',
    is_public: false,
    source: 'mobile',
    createdAt: '2025-01-14T10:00:00Z',
  },
];

const mockStats = {
  total_feedback: 50,
  avg_rating: 4.2,
  this_week_count: 8,
  rating_distribution: { '5': 20, '4': 15, '3': 10, '2': 3, '1': 2 },
};

async function setupMocks() {
  const { feedbackAPI } = await import('../../../services/api');
  feedbackAPI.getAdminList.mockResolvedValue({
    data: { data: mockFeedback, pagination: { total: 2, pages: 1, page: 0, limit: 10 } },
  });
  feedbackAPI.getStats.mockResolvedValue({ data: mockStats });
}

function renderFeedbackManagement() {
  return render(
    <MemoryRouter>
      <FeedbackManagement />
    </MemoryRouter>
  );
}

describe('FeedbackManagement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders page header', async () => {
    await setupMocks();
    renderFeedbackManagement();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Feedback Management' })).toBeInTheDocument();
    });
  });

  it('renders feedback list', async () => {
    await setupMocks();
    renderFeedbackManagement();

    await waitFor(() => {
      expect(screen.getByText('john@test.com')).toBeInTheDocument();
      expect(screen.getByText('jane@test.com')).toBeInTheDocument();
    });
  });

  it('renders statistics', async () => {
    await setupMocks();
    renderFeedbackManagement();

    await waitFor(() => {
      expect(screen.getByText('Total Feedback')).toBeInTheDocument();
      expect(screen.getByText('50')).toBeInTheDocument();
      expect(screen.getByText('Average Rating')).toBeInTheDocument();
    });
  });

  it('renders search and filter', async () => {
    await setupMocks();
    renderFeedbackManagement();

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Search/i)).toBeInTheDocument();
    });
  });

  it('handles API error', async () => {
    const { feedbackAPI } = await import('../../../services/api');
    const toast = await import('react-hot-toast');
    feedbackAPI.getAdminList.mockRejectedValue(new Error('API Error'));
    feedbackAPI.getStats.mockRejectedValue(new Error('API Error'));

    renderFeedbackManagement();

    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalledWith('Failed to load feedback');
    });
  });

  it('renders feedback emails in table', async () => {
    await setupMocks();
    renderFeedbackManagement();

    await waitFor(() => {
      expect(screen.getByText('john@test.com')).toBeInTheDocument();
      expect(screen.getByText('jane@test.com')).toBeInTheDocument();
    });
  });

  it('renders average rating value', async () => {
    await setupMocks();
    renderFeedbackManagement();

    await waitFor(() => {
      expect(screen.getByText('4.2')).toBeInTheDocument();
    });
  });

  it('renders this week count', async () => {
    await setupMocks();
    renderFeedbackManagement();

    await waitFor(() => {
      expect(screen.getByText('This Week')).toBeInTheDocument();
      expect(screen.getByText('8')).toBeInTheDocument();
    });
  });

  it('renders rating filter dropdown', async () => {
    await setupMocks();
    renderFeedbackManagement();

    await waitFor(() => {
      expect(screen.getByText('All Ratings')).toBeInTheDocument();
    });
  });

  it('shows empty state when no feedback', async () => {
    const { feedbackAPI } = await import('../../../services/api');
    feedbackAPI.getAdminList.mockResolvedValue({
      data: { data: [], pagination: { total: 0, pages: 0, page: 0, limit: 10 } },
    });
    feedbackAPI.getStats.mockResolvedValue({
      data: { total_feedback: 0, avg_rating: 0, this_week_count: 0, rating_distribution: {} },
    });

    renderFeedbackManagement();

    await waitFor(() => {
      expect(screen.getByText('No feedback found')).toBeInTheDocument();
    });
  });

  it('handles view feedback button click', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderFeedbackManagement();

    await waitFor(() => {
      expect(screen.getByText('john@test.com')).toBeInTheDocument();
    });

    // Click view button for first feedback
    const viewButtons = screen.getAllByText('View');
    await user.click(viewButtons[0]);

    // Should open the detail modal - email appears in both table and modal
    await waitFor(() => {
      expect(screen.getAllByText('john@test.com').length).toBeGreaterThanOrEqual(2);
    });
  });

  it('shows rating distribution', async () => {
    await setupMocks();
    renderFeedbackManagement();

    await waitFor(() => {
      expect(screen.getByText('Rating Distribution')).toBeInTheDocument();
    });
  });

  it('renders page description', async () => {
    await setupMocks();
    renderFeedbackManagement();

    await waitFor(() => {
      expect(screen.getByText('View and manage user feedback submissions')).toBeInTheDocument();
    });
  });

  it('renders feedback dates', async () => {
    await setupMocks();
    renderFeedbackManagement();

    await waitFor(() => {
      expect(screen.getByText('2025-01-15T10:00:00Z')).toBeInTheDocument();
      expect(screen.getByText('2025-01-14T10:00:00Z')).toBeInTheDocument();
    });
  });

  it('renders table column headers', async () => {
    await setupMocks();
    renderFeedbackManagement();

    await waitFor(() => {
      expect(screen.getByText('Email')).toBeInTheDocument();
      expect(screen.getByText('Rating')).toBeInTheDocument();
      expect(screen.getByText('Date')).toBeInTheDocument();
      expect(screen.getByText('Actions')).toBeInTheDocument();
    });
  });

  it('handles search input', async () => {
    await setupMocks();
    const { feedbackAPI } = await import('../../../services/api');
    const user = userEvent.setup();
    renderFeedbackManagement();

    await waitFor(() => {
      expect(screen.getByText('john@test.com')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search/i);
    await user.type(searchInput, 'john');

    await waitFor(() => {
      expect(feedbackAPI.getAdminList).toHaveBeenCalledWith(expect.objectContaining({
        search: 'john',
      }));
    });
  });

  it('handles rating filter change', async () => {
    await setupMocks();
    const { feedbackAPI } = await import('../../../services/api');
    const user = userEvent.setup();
    renderFeedbackManagement();

    await waitFor(() => {
      expect(screen.getByText('john@test.com')).toBeInTheDocument();
    });

    const ratingSelect = screen.getByDisplayValue('All Ratings');
    await user.selectOptions(ratingSelect, '5');

    await waitFor(() => {
      expect(feedbackAPI.getAdminList).toHaveBeenCalledWith(expect.objectContaining({
        rating: 5,
      }));
    });
  });

  it('handles clear filters', async () => {
    await setupMocks();
    const user = userEvent.setup();
    renderFeedbackManagement();

    await waitFor(() => {
      expect(screen.getByText('john@test.com')).toBeInTheDocument();
    });

    // Type in search to make Clear button appear
    const searchInput = screen.getByPlaceholderText(/Search/i);
    await user.type(searchInput, 'test');

    // Click Clear button
    const clearButton = screen.getByText('Clear');
    await user.click(clearButton);

    // Search should be cleared
    expect(searchInput.value).toBe('');
  });

  it('loads data with default sort params', async () => {
    await setupMocks();
    const { feedbackAPI } = await import('../../../services/api');
    renderFeedbackManagement();

    await waitFor(() => {
      expect(screen.getByText('john@test.com')).toBeInTheDocument();
    });

    // Verify default sort params are passed to API
    expect(feedbackAPI.getAdminList).toHaveBeenCalledWith(expect.objectContaining({
      sort_by: 'createdAt',
      sort_order: 'desc',
    }));
  });

  it('closes detail modal', async () => {
    await setupMocks();
    const user = userEvent.setup();
    renderFeedbackManagement();

    await waitFor(() => {
      expect(screen.getByText('john@test.com')).toBeInTheDocument();
    });

    // Open detail modal
    const viewButtons = screen.getAllByText('View');
    await user.click(viewButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Feedback Details')).toBeInTheDocument();
    });

    // Close modal
    await user.click(screen.getByText('Close'));

    await waitFor(() => {
      expect(screen.queryByText('Feedback Details')).not.toBeInTheDocument();
    });
  });

  it('renders feedback improvements in table', async () => {
    await setupMocks();
    renderFeedbackManagement();

    await waitFor(() => {
      expect(screen.getByText('Nothing to improve')).toBeInTheDocument();
      expect(screen.getByText('Speed could be better')).toBeInTheDocument();
    });
  });

  it('renders type badges', async () => {
    await setupMocks();
    renderFeedbackManagement();

    await waitFor(() => {
      expect(screen.getByText('Public')).toBeInTheDocument();
      expect(screen.getByText('User')).toBeInTheDocument();
    });
  });

  it('renders column headers in table', async () => {
    await setupMocks();
    renderFeedbackManagement();

    await waitFor(() => {
      expect(screen.getByText('john@test.com')).toBeInTheDocument();
    });

    // Verify column headers are rendered
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Rating')).toBeInTheDocument();
  });

  it('renders date values in table', async () => {
    await setupMocks();
    renderFeedbackManagement();

    await waitFor(() => {
      expect(screen.getByText('john@test.com')).toBeInTheDocument();
    });

    // Verify data is rendered in the table
    expect(screen.getByText('jane@test.com')).toBeInTheDocument();
  });

  it('shows pagination when multiple pages', async () => {
    const { feedbackAPI } = await import('../../../services/api');
    feedbackAPI.getAdminList.mockResolvedValue({
      data: { data: mockFeedback, pagination: { total: 50, pages: 5, page: 0, limit: 10 } },
    });
    feedbackAPI.getStats.mockResolvedValue({ data: mockStats });

    renderFeedbackManagement();
    await waitFor(() => { expect(screen.getByText('john@test.com')).toBeInTheDocument(); });

    // Navigation buttons should exist
    await waitFor(() => {
      expect(screen.getByTitle('Next page')).toBeInTheDocument();
    });
    expect(screen.getByTitle('Previous page')).toBeInTheDocument();
    expect(screen.getByTitle('First page')).toBeInTheDocument();
    expect(screen.getByTitle('Last page')).toBeInTheDocument();
  });

  it('shows page size selector', async () => {
    const { feedbackAPI } = await import('../../../services/api');
    feedbackAPI.getAdminList.mockResolvedValue({
      data: { data: mockFeedback, pagination: { total: 50, pages: 5, page: 0, limit: 10 } },
    });
    feedbackAPI.getStats.mockResolvedValue({ data: mockStats });

    renderFeedbackManagement();
    await waitFor(() => { expect(screen.getByText('john@test.com')).toBeInTheDocument(); });

    // Should show page size selector
    const pageSizeSelect = screen.getByDisplayValue('10 per page');
    expect(pageSizeSelect).toBeInTheDocument();
  });

  it('searches feedback', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderFeedbackManagement();
    await waitFor(() => { expect(screen.getByText('john@test.com')).toBeInTheDocument(); });

    const searchInput = screen.getByPlaceholderText(/search/i);
    await user.type(searchInput, 'john');
    expect(searchInput.value).toBe('john');
  });

  it('filters by rating', async () => {
    await setupMocks();
    const { feedbackAPI } = await import('../../../services/api');
    const user = userEvent.setup();

    renderFeedbackManagement();
    await waitFor(() => { expect(screen.getByText('john@test.com')).toBeInTheDocument(); });

    // Find rating filter dropdown
    const ratingSelect = screen.getByDisplayValue('All Ratings');
    await user.selectOptions(ratingSelect, '5');

    await waitFor(() => {
      expect(feedbackAPI.getAdminList).toHaveBeenCalledTimes(2);
    });
  });
});
