import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PublicFeedbackForm from './PublicFeedbackForm';

jest.mock('../../services/api', () => ({
  feedbackAPI: {
    submitPublic: jest.fn(),
  },
}));

import { feedbackAPI } from '../../services/api';

describe('PublicFeedbackForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the form with all fields', () => {
    render(<PublicFeedbackForm />);
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByText(/rating/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/what could we improve/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/suggestions/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit feedback/i })).toBeInTheDocument();
  });

  it('renders 5 star rating buttons', () => {
    render(<PublicFeedbackForm />);
    const starButtons = screen.getAllByRole('button', { name: '' }).filter(
      btn => btn.getAttribute('type') === 'button'
    );
    expect(starButtons).toHaveLength(5);
  });

  it('shows validation error when email is empty', async () => {
    const user = userEvent.setup();
    render(<PublicFeedbackForm />);

    // Click a star first so rating is valid
    const starButtons = screen.getAllByRole('button', { name: '' }).filter(
      btn => btn.getAttribute('type') === 'button'
    );
    await user.click(starButtons[2]); // 3 stars

    // Clear the required attribute to allow form submission for testing our custom validation
    const emailInput = screen.getByLabelText(/email address/i);
    emailInput.removeAttribute('required');

    await user.click(screen.getByRole('button', { name: /submit feedback/i }));

    expect(screen.getByText('Email is required')).toBeInTheDocument();
  });

  it('shows validation error when rating is not selected', async () => {
    const user = userEvent.setup();
    render(<PublicFeedbackForm />);

    await user.type(screen.getByLabelText(/email address/i), 'test@test.com');
    await user.click(screen.getByRole('button', { name: /submit feedback/i }));

    expect(screen.getByText('Please select a rating')).toBeInTheDocument();
  });

  it('shows rating label on selection', async () => {
    const user = userEvent.setup();
    render(<PublicFeedbackForm />);

    const starButtons = screen.getAllByRole('button', { name: '' }).filter(
      btn => btn.getAttribute('type') === 'button'
    );

    await user.click(starButtons[0]); // 1 star
    expect(screen.getByText('Poor')).toBeInTheDocument();

    await user.click(starButtons[4]); // 5 stars
    expect(screen.getByText('Excellent')).toBeInTheDocument();
  });

  it('submits form successfully', async () => {
    const user = userEvent.setup();
    const onSuccess = jest.fn();
    feedbackAPI.submitPublic.mockResolvedValue({ data: {} });

    render(<PublicFeedbackForm onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText(/email address/i), 'test@test.com');

    // Select rating
    const starButtons = screen.getAllByRole('button', { name: '' }).filter(
      btn => btn.getAttribute('type') === 'button'
    );
    await user.click(starButtons[3]); // 4 stars

    await user.type(screen.getByLabelText(/what could we improve/i), 'Better docs');
    await user.type(screen.getByLabelText(/suggestions/i), 'Add dark mode');

    await user.click(screen.getByRole('button', { name: /submit feedback/i }));

    await waitFor(() => {
      expect(feedbackAPI.submitPublic).toHaveBeenCalledWith({
        email: 'test@test.com',
        rating: 4,
        improvements: 'Better docs',
        suggestions: 'Add dark mode',
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Thank You!')).toBeInTheDocument();
    });
    expect(onSuccess).toHaveBeenCalled();
  });

  it('shows success view with reset option', async () => {
    const user = userEvent.setup();
    feedbackAPI.submitPublic.mockResolvedValue({ data: {} });

    render(<PublicFeedbackForm />);

    await user.type(screen.getByLabelText(/email address/i), 'a@b.com');
    const starButtons = screen.getAllByRole('button', { name: '' }).filter(
      btn => btn.getAttribute('type') === 'button'
    );
    await user.click(starButtons[2]);
    await user.click(screen.getByRole('button', { name: /submit feedback/i }));

    await waitFor(() => {
      expect(screen.getByText('Thank You!')).toBeInTheDocument();
    });
    expect(screen.getByText(/submitted successfully/i)).toBeInTheDocument();

    // Click "Submit another feedback"
    await user.click(screen.getByText(/submit another feedback/i));

    // Form should be back
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toHaveValue('');
  });

  it('shows error on submission failure', async () => {
    const user = userEvent.setup();
    const error = new Error('fail');
    error.response = { data: { detail: 'Server unavailable' } };
    feedbackAPI.submitPublic.mockRejectedValue(error);

    render(<PublicFeedbackForm />);

    await user.type(screen.getByLabelText(/email address/i), 'a@b.com');
    const starButtons = screen.getAllByRole('button', { name: '' }).filter(
      btn => btn.getAttribute('type') === 'button'
    );
    await user.click(starButtons[0]);
    await user.click(screen.getByRole('button', { name: /submit feedback/i }));

    await waitFor(() => {
      expect(screen.getByText('Server unavailable')).toBeInTheDocument();
    });
  });

  it('shows generic error when no detail in response', async () => {
    const user = userEvent.setup();
    feedbackAPI.submitPublic.mockRejectedValue(new Error('Network error'));

    render(<PublicFeedbackForm />);

    await user.type(screen.getByLabelText(/email address/i), 'a@b.com');
    const starButtons = screen.getAllByRole('button', { name: '' }).filter(
      btn => btn.getAttribute('type') === 'button'
    );
    await user.click(starButtons[0]);
    await user.click(screen.getByRole('button', { name: /submit feedback/i }));

    await waitFor(() => {
      expect(screen.getByText(/failed to submit feedback/i)).toBeInTheDocument();
    });
  });

  it('shows loading state during submission', async () => {
    const user = userEvent.setup();
    let resolveSubmit;
    feedbackAPI.submitPublic.mockReturnValue(new Promise(resolve => { resolveSubmit = resolve; }));

    render(<PublicFeedbackForm />);

    await user.type(screen.getByLabelText(/email address/i), 'a@b.com');
    const starButtons = screen.getAllByRole('button', { name: '' }).filter(
      btn => btn.getAttribute('type') === 'button'
    );
    await user.click(starButtons[0]);
    await user.click(screen.getByRole('button', { name: /submit feedback/i }));

    expect(screen.getByText('Submitting...')).toBeInTheDocument();

    resolveSubmit({ data: {} });
    await waitFor(() => {
      expect(screen.queryByText('Submitting...')).not.toBeInTheDocument();
    });
  });

  it('clears error when input changes', async () => {
    const user = userEvent.setup();
    render(<PublicFeedbackForm />);

    // Trigger rating validation error (email filled, no rating)
    await user.type(screen.getByLabelText(/email address/i), 'a@b.com');
    await user.click(screen.getByRole('button', { name: /submit feedback/i }));
    expect(screen.getByText('Please select a rating')).toBeInTheDocument();

    // Type in improvements to clear error
    await user.type(screen.getByLabelText(/what could we improve/i), 'x');
    expect(screen.queryByText('Please select a rating')).not.toBeInTheDocument();
  });

  it('shows all rating labels correctly', async () => {
    const user = userEvent.setup();
    render(<PublicFeedbackForm />);

    const starButtons = screen.getAllByRole('button', { name: '' }).filter(
      btn => btn.getAttribute('type') === 'button'
    );

    const labels = ['Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];
    for (let i = 0; i < 5; i++) {
      await user.click(starButtons[i]);
      expect(screen.getByText(labels[i])).toBeInTheDocument();
    }
  });
});
