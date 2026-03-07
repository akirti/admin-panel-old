import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import FeedbackManagement from './FeedbackManagement';

vi.mock('../../services/api', () => ({
  feedbackAPI: {
    getAdminList: vi.fn(),
    getStats: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
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
  const { feedbackAPI } = await import('../../services/api');
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
    vi.clearAllMocks();
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
    const { feedbackAPI } = await import('../../services/api');
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
    const { feedbackAPI } = await import('../../services/api');
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
    const { feedbackAPI } = await import('../../services/api');
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
    const { feedbackAPI } = await import('../../services/api');
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

  it('handles sort by clicking column header', async () => {
    await setupMocks();
    const { feedbackAPI } = await import('../../services/api');
    const user = userEvent.setup();
    renderFeedbackManagement();

    await waitFor(() => {
      expect(screen.getByText('john@test.com')).toBeInTheDocument();
    });

    // Click the Rating column header to sort
    await user.click(screen.getByText('Rating'));

    await waitFor(() => {
      expect(feedbackAPI.getAdminList).toHaveBeenCalledWith(expect.objectContaining({
        sort_by: 'rating',
      }));
    });
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

  it('sorts by clicking column headers', async () => {
    await setupMocks();
    const { feedbackAPI } = await import('../../services/api');
    const user = userEvent.setup();

    renderFeedbackManagement();
    await waitFor(() => { expect(screen.getByText('john@test.com')).toBeInTheDocument(); });

    // Click Email header to sort
    const emailHeaders = screen.getAllByText('Email');
    await user.click(emailHeaders[0]);

    // Should trigger refetch with sort params
    await waitFor(() => {
      expect(feedbackAPI.getAdminList).toHaveBeenCalledTimes(2);
    });
  });

  it('sorts by date column', async () => {
    await setupMocks();
    const { feedbackAPI } = await import('../../services/api');
    const user = userEvent.setup();

    renderFeedbackManagement();
    await waitFor(() => { expect(screen.getByText('john@test.com')).toBeInTheDocument(); });

    // Click Date header
    const dateHeaders = screen.getAllByText('Date');
    await user.click(dateHeaders[0]);

    await waitFor(() => {
      expect(feedbackAPI.getAdminList).toHaveBeenCalledTimes(2);
    });
  });

  it('shows pagination when multiple pages', async () => {
    const { feedbackAPI } = await import('../../services/api');
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
    const { feedbackAPI } = await import('../../services/api');
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
    const { feedbackAPI } = await import('../../services/api');
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
