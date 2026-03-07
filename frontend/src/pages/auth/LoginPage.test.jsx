import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import LoginPage from './LoginPage';

// Mock dependencies
const mockLogin = vi.fn();
const mockNavigate = vi.fn();

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin }),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

function renderLoginPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders the login form', () => {
      renderLoginPage();
      expect(screen.getByText('Welcome Back')).toBeInTheDocument();
      expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter your email')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter your password')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
    });

    it('renders forgot password link', () => {
      renderLoginPage();
      expect(screen.getByText('Forgot password?')).toBeInTheDocument();
    });

    it('renders sign up link', () => {
      renderLoginPage();
      expect(screen.getByText('Sign up')).toBeInTheDocument();
    });

    it('renders feedback link', () => {
      renderLoginPage();
      expect(screen.getByText('Share your feedback')).toBeInTheDocument();
    });

    it('renders remember me checkbox', () => {
      renderLoginPage();
      expect(screen.getByText('Remember me')).toBeInTheDocument();
    });
  });

  describe('form interactions', () => {
    it('allows typing email and password', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Enter your password');

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');

      expect(emailInput).toHaveValue('test@example.com');
      expect(passwordInput).toHaveValue('password123');
    });

    it('toggles password visibility', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      const passwordInput = screen.getByPlaceholderText('Enter your password');
      expect(passwordInput).toHaveAttribute('type', 'password');

      // Find the toggle button (it's the button that's not the submit button and not a link)
      const toggleButtons = screen.getAllByRole('button');
      const toggleButton = toggleButtons.find(btn => btn.type === 'button');

      await user.click(toggleButton);
      expect(passwordInput).toHaveAttribute('type', 'text');

      await user.click(toggleButton);
      expect(passwordInput).toHaveAttribute('type', 'password');
    });
  });

  describe('form submission', () => {
    it('calls login and navigates on success', async () => {
      const user = userEvent.setup();
      mockLogin.mockResolvedValueOnce({});
      renderLoginPage();

      await user.type(screen.getByPlaceholderText('Enter your email'), 'test@example.com');
      await user.type(screen.getByPlaceholderText('Enter your password'), 'password123');
      await user.click(screen.getByRole('button', { name: 'Sign In' }));

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
      });
    });

    it('shows loading state during submission', async () => {
      const user = userEvent.setup();
      let resolveLogin;
      mockLogin.mockReturnValueOnce(new Promise(r => { resolveLogin = r; }));
      renderLoginPage();

      await user.type(screen.getByPlaceholderText('Enter your email'), 'test@example.com');
      await user.type(screen.getByPlaceholderText('Enter your password'), 'pass1234');
      await user.click(screen.getByRole('button', { name: 'Sign In' }));

      expect(screen.getByRole('button', { name: 'Signing in...' })).toBeDisabled();

      resolveLogin({});
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Sign In' })).not.toBeDisabled();
      });
    });

    it('shows error toast on login failure', async () => {
      const toast = await import('react-hot-toast');
      const user = userEvent.setup();
      mockLogin.mockRejectedValueOnce({
        response: { data: { error: 'Invalid credentials' } },
      });
      renderLoginPage();

      await user.type(screen.getByPlaceholderText('Enter your email'), 'test@example.com');
      await user.type(screen.getByPlaceholderText('Enter your password'), 'wrong');
      await user.click(screen.getByRole('button', { name: 'Sign In' }));

      await waitFor(() => {
        expect(toast.default.error).toHaveBeenCalledWith('Invalid credentials');
      });
    });

    it('shows generic error when no error detail', async () => {
      const toast = await import('react-hot-toast');
      const user = userEvent.setup();
      mockLogin.mockRejectedValueOnce(new Error('Network error'));
      renderLoginPage();

      await user.type(screen.getByPlaceholderText('Enter your email'), 'test@example.com');
      await user.type(screen.getByPlaceholderText('Enter your password'), 'wrong');
      await user.click(screen.getByRole('button', { name: 'Sign In' }));

      await waitFor(() => {
        expect(toast.default.error).toHaveBeenCalledWith('Login failed');
      });
    });
  });
});
