import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ForgotPasswordPage from './ForgotPasswordPage';

jest.mock('../../services/api', () => ({
  authAPI: {
    forgotPassword: jest.fn(),
  },
}));

jest.mock('react-hot-toast', () => ({ __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

function renderForgotPasswordPage() {
  return render(
    <MemoryRouter>
      <ForgotPasswordPage />
    </MemoryRouter>
  );
}

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders the forgot password form', () => {
      renderForgotPasswordPage();
      expect(screen.getByText('Forgot password?')).toBeInTheDocument();
      expect(screen.getByText("Enter your email and we'll send you a reset link.")).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter your email')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Send Reset Link' })).toBeInTheDocument();
    });

    it('renders back to login link', () => {
      renderForgotPasswordPage();
      expect(screen.getByText('Back to login')).toBeInTheDocument();
    });
  });

  describe('form submission', () => {
    it('calls forgotPassword API and shows success view', async () => {
      const { authAPI } = await import('../../services/api');
      authAPI.forgotPassword.mockResolvedValueOnce({});
      const user = userEvent.setup();
      renderForgotPasswordPage();

      await user.type(screen.getByPlaceholderText('Enter your email'), 'test@example.com');
      await user.click(screen.getByRole('button', { name: 'Send Reset Link' }));

      await waitFor(() => {
        expect(authAPI.forgotPassword).toHaveBeenCalledWith(
          'test@example.com',
          expect.stringContaining('/reset-password')
        );
      });

      // Should show success view
      expect(screen.getByText('Check your email')).toBeInTheDocument();
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });

    it('shows loading state during submission', async () => {
      const { authAPI } = await import('../../services/api');
      let resolveApi;
      authAPI.forgotPassword.mockReturnValueOnce(new Promise(r => { resolveApi = r; }));
      const user = userEvent.setup();
      renderForgotPasswordPage();

      await user.type(screen.getByPlaceholderText('Enter your email'), 'test@example.com');
      await user.click(screen.getByRole('button', { name: 'Send Reset Link' }));

      expect(screen.getByRole('button', { name: 'Sending...' })).toBeDisabled();

      resolveApi({});
      await waitFor(() => {
        expect(screen.getByText('Check your email')).toBeInTheDocument();
      });
    });

    it('shows error toast on failure', async () => {
      const { authAPI } = await import('../../services/api');
      const toast = await import('react-hot-toast');
      authAPI.forgotPassword.mockRejectedValueOnce({
        response: { data: { error: 'User not found' } },
      });
      const user = userEvent.setup();
      renderForgotPasswordPage();

      await user.type(screen.getByPlaceholderText('Enter your email'), 'unknown@example.com');
      await user.click(screen.getByRole('button', { name: 'Send Reset Link' }));

      await waitFor(() => {
        expect(toast.default.error).toHaveBeenCalledWith('User not found');
      });

      // Should stay on form view (not switch to success)
      expect(screen.getByText('Forgot password?')).toBeInTheDocument();
    });

    it('shows generic error when no error detail', async () => {
      const { authAPI } = await import('../../services/api');
      const toast = await import('react-hot-toast');
      authAPI.forgotPassword.mockRejectedValueOnce(new Error('Network'));
      const user = userEvent.setup();
      renderForgotPasswordPage();

      await user.type(screen.getByPlaceholderText('Enter your email'), 'test@example.com');
      await user.click(screen.getByRole('button', { name: 'Send Reset Link' }));

      await waitFor(() => {
        expect(toast.default.error).toHaveBeenCalledWith('Failed to send reset link');
      });
    });
  });

  describe('success view', () => {
    it('shows back to login link after success', async () => {
      const { authAPI } = await import('../../services/api');
      authAPI.forgotPassword.mockResolvedValueOnce({});
      const user = userEvent.setup();
      renderForgotPasswordPage();

      await user.type(screen.getByPlaceholderText('Enter your email'), 'test@example.com');
      await user.click(screen.getByRole('button', { name: 'Send Reset Link' }));

      await waitFor(() => {
        expect(screen.getByText('Check your email')).toBeInTheDocument();
      });
      // The success view has a "Back to login" link
      expect(screen.getByText('Back to login')).toBeInTheDocument();
    });
  });
});
