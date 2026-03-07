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
    source: 'web',
    createdAt: '2025-01-15T10:00:00Z',
  },
  {
    _id: 'fb2',
    name: 'Jane',
    email: 'jane@test.com',
    rating: 3,
    message: 'Decent experience',
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
});
