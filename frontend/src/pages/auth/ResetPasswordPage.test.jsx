import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import ResetPasswordPage from './ResetPasswordPage';

const mockNavigate = jest.fn();

jest.mock('react-router', () => {
  const actual = jest.requireActual('react-router');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

jest.mock('../../services/api', () => ({
  authAPI: {
    resetPassword: jest.fn(),
  },
}));

jest.mock('react-hot-toast', () => ({ __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

function renderResetPasswordPage(token = 'valid-token') {
  const url = token ? `/reset-password?token=${token}` : '/reset-password';
  return render(
    <MemoryRouter initialEntries={[url]}>
      <ResetPasswordPage />
    </MemoryRouter>
  );
}

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('no token', () => {
    it('shows invalid link message when no token', () => {
      renderResetPasswordPage(null);
      expect(screen.getByText('Invalid Link')).toBeInTheDocument();
      expect(screen.getByText('This password reset link is invalid or has expired.')).toBeInTheDocument();
      expect(screen.getByText('Request a new link')).toBeInTheDocument();
    });
  });

  describe('rendering with token', () => {
    it('renders the reset password form', () => {
      renderResetPasswordPage();
      expect(screen.getByRole('heading', { name: 'Reset Password' })).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter new password')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Confirm new password')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Reset Password' })).toBeInTheDocument();
    });
  });

  describe('form interactions', () => {
    it('toggles password visibility', async () => {
      const user = userEvent.setup();
      renderResetPasswordPage();

      const passwordInput = screen.getByPlaceholderText('Enter new password');
      const confirmInput = screen.getByPlaceholderText('Confirm new password');

      expect(passwordInput).toHaveAttribute('type', 'password');
      expect(confirmInput).toHaveAttribute('type', 'password');

      const toggleButton = screen.getAllByRole('button').find(btn => btn.type === 'button');
      await user.click(toggleButton);

      expect(passwordInput).toHaveAttribute('type', 'text');
      expect(confirmInput).toHaveAttribute('type', 'text');
    });
  });

  describe('validation', () => {
    it('shows error when passwords do not match', async () => {
      const toast = await import('react-hot-toast');
      const user = userEvent.setup();
      renderResetPasswordPage();

      await user.type(screen.getByPlaceholderText('Enter new password'), 'Password123');
      await user.type(screen.getByPlaceholderText('Confirm new password'), 'Different12');
      await user.click(screen.getByRole('button', { name: 'Reset Password' }));

      expect(toast.default.error).toHaveBeenCalledWith('Passwords do not match');
    });

    it('shows error when password is too short', async () => {
      const toast = await import('react-hot-toast');
      const user = userEvent.setup();
      renderResetPasswordPage();

      await user.type(screen.getByPlaceholderText('Enter new password'), 'short');
      await user.type(screen.getByPlaceholderText('Confirm new password'), 'short');
      await user.click(screen.getByRole('button', { name: 'Reset Password' }));

      expect(toast.default.error).toHaveBeenCalledWith('Password must be at least 8 characters');
    });
  });

  describe('form submission', () => {
    it('calls resetPassword and shows success view', async () => {
      const { authAPI } = await import('../../services/api');
      authAPI.resetPassword.mockResolvedValueOnce({});
      const user = userEvent.setup();
      renderResetPasswordPage('my-reset-token');

      await user.type(screen.getByPlaceholderText('Enter new password'), 'NewPassword1');
      await user.type(screen.getByPlaceholderText('Confirm new password'), 'NewPassword1');
      await user.click(screen.getByRole('button', { name: 'Reset Password' }));

      await waitFor(() => {
        expect(authAPI.resetPassword).toHaveBeenCalledWith('my-reset-token', 'NewPassword1');
      });

      expect(screen.getByText('Password Reset!')).toBeInTheDocument();
      expect(screen.getByText('Your password has been reset successfully.')).toBeInTheDocument();
    });

    it('shows loading state during submission', async () => {
      const { authAPI } = await import('../../services/api');
      let resolveApi;
      authAPI.resetPassword.mockReturnValueOnce(new Promise(r => { resolveApi = r; }));
      const user = userEvent.setup();
      renderResetPasswordPage();

      await user.type(screen.getByPlaceholderText('Enter new password'), 'NewPassword1');
      await user.type(screen.getByPlaceholderText('Confirm new password'), 'NewPassword1');
      await user.click(screen.getByRole('button', { name: 'Reset Password' }));

      expect(screen.getByRole('button', { name: 'Resetting...' })).toBeDisabled();

      resolveApi({});
      await waitFor(() => {
        expect(screen.getByText('Password Reset!')).toBeInTheDocument();
      });
    });

    it('shows error toast on failure', async () => {
      const { authAPI } = await import('../../services/api');
      const toast = await import('react-hot-toast');
      authAPI.resetPassword.mockRejectedValueOnce({
        response: { data: { error: 'Token expired' } },
      });
      const user = userEvent.setup();
      renderResetPasswordPage();

      await user.type(screen.getByPlaceholderText('Enter new password'), 'NewPassword1');
      await user.type(screen.getByPlaceholderText('Confirm new password'), 'NewPassword1');
      await user.click(screen.getByRole('button', { name: 'Reset Password' }));

      await waitFor(() => {
        expect(toast.default.error).toHaveBeenCalledWith('Token expired');
      });
    });

    it('shows generic error when no error detail', async () => {
      const { authAPI } = await import('../../services/api');
      const toast = await import('react-hot-toast');
      authAPI.resetPassword.mockRejectedValueOnce(new Error('Network'));
      const user = userEvent.setup();
      renderResetPasswordPage();

      await user.type(screen.getByPlaceholderText('Enter new password'), 'NewPassword1');
      await user.type(screen.getByPlaceholderText('Confirm new password'), 'NewPassword1');
      await user.click(screen.getByRole('button', { name: 'Reset Password' }));

      await waitFor(() => {
        expect(toast.default.error).toHaveBeenCalledWith('Failed to reset password');
      });
    });
  });

  describe('success view', () => {
    it('navigates to login on continue button click', async () => {
      const { authAPI } = await import('../../services/api');
      authAPI.resetPassword.mockResolvedValueOnce({});
      const user = userEvent.setup();
      renderResetPasswordPage();

      await user.type(screen.getByPlaceholderText('Enter new password'), 'NewPassword1');
      await user.type(screen.getByPlaceholderText('Confirm new password'), 'NewPassword1');
      await user.click(screen.getByRole('button', { name: 'Reset Password' }));

      await waitFor(() => {
        expect(screen.getByText('Password Reset!')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Continue to Login' }));
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });
});
