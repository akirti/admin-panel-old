import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import FeedbackPage from './FeedbackPage';

// Mock the PublicFeedbackForm since it's tested separately
jest.mock('../components/feedback/PublicFeedbackForm', () => ({
  __esModule: true, default: () => <div data-testid="feedback-form">Mock Feedback Form</div>,
}));

function renderFeedbackPage() {
  return render(
    <MemoryRouter>
      <FeedbackPage />
    </MemoryRouter>
  );
}

describe('FeedbackPage', () => {
  it('renders the feedback page', () => {
    renderFeedbackPage();
    expect(screen.getAllByText(/Share Your Feedback/i).length).toBeGreaterThan(0);
  });

  it('renders the feedback form component', () => {
    renderFeedbackPage();
    expect(screen.getByTestId('feedback-form')).toBeInTheDocument();
  });

  it('shows branding section', () => {
    renderFeedbackPage();
    expect(screen.getByText('We Value Your Feedback')).toBeInTheDocument();
  });

  it('shows back to login link', () => {
    renderFeedbackPage();
    expect(screen.getByText('Back to Login')).toBeInTheDocument();
  });

  it('displays stats', () => {
    renderFeedbackPage();
    expect(screen.getByText('1000+')).toBeInTheDocument();
    expect(screen.getByText('Feedback Received')).toBeInTheDocument();
    expect(screen.getByText('4.8')).toBeInTheDocument();
    expect(screen.getByText('Average Rating')).toBeInTheDocument();
  });

  it('shows description text', () => {
    renderFeedbackPage();
    expect(screen.getByText('Your feedback helps us improve our services.')).toBeInTheDocument();
  });
});
