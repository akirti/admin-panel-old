import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import RegisterPage from './RegisterPage';

const mockRegister = vi.fn();
const mockNavigate = vi.fn();

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ register: mockRegister }),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

function renderRegisterPage() {
  return render(
    <MemoryRouter>
      <RegisterPage />
    </MemoryRouter>
  );
}

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders the registration form', () => {
      renderRegisterPage();
      expect(screen.getByRole('heading', { name: 'Create Account' })).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter your full name')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Choose a username')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter your email')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Create a password')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Confirm your password')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Create Account' })).toBeInTheDocument();
    });

    it('renders sign in link', () => {
      renderRegisterPage();
      expect(screen.getByText('Sign in')).toBeInTheDocument();
    });
  });

  describe('form interactions', () => {
    it('allows typing in all fields', async () => {
      const user = userEvent.setup();
      renderRegisterPage();

      await user.type(screen.getByPlaceholderText('Enter your full name'), 'John Doe');
      await user.type(screen.getByPlaceholderText('Choose a username'), 'johndoe');
      await user.type(screen.getByPlaceholderText('Enter your email'), 'john@example.com');
      await user.type(screen.getByPlaceholderText('Create a password'), 'Password1');
      await user.type(screen.getByPlaceholderText('Confirm your password'), 'Password1');

      expect(screen.getByPlaceholderText('Enter your full name')).toHaveValue('John Doe');
      expect(screen.getByPlaceholderText('Choose a username')).toHaveValue('johndoe');
      expect(screen.getByPlaceholderText('Enter your email')).toHaveValue('john@example.com');
      expect(screen.getByPlaceholderText('Create a password')).toHaveValue('Password1');
      expect(screen.getByPlaceholderText('Confirm your password')).toHaveValue('Password1');
    });

    it('toggles password visibility for both fields', async () => {
      const user = userEvent.setup();
      renderRegisterPage();

      const passwordInput = screen.getByPlaceholderText('Create a password');
      const confirmInput = screen.getByPlaceholderText('Confirm your password');

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
      renderRegisterPage();

      await user.type(screen.getByPlaceholderText('Choose a username'), 'johndoe');
      await user.type(screen.getByPlaceholderText('Enter your email'), 'john@example.com');
      await user.type(screen.getByPlaceholderText('Create a password'), 'Password1');
      await user.type(screen.getByPlaceholderText('Confirm your password'), 'Different1');
      await user.click(screen.getByRole('button', { name: 'Create Account' }));

      expect(toast.default.error).toHaveBeenCalledWith('Passwords do not match');
      expect(mockRegister).not.toHaveBeenCalled();
    });

    it('shows error when password is too short', async () => {
      const toast = await import('react-hot-toast');
      const user = userEvent.setup();
      renderRegisterPage();

      await user.type(screen.getByPlaceholderText('Choose a username'), 'johndoe');
      await user.type(screen.getByPlaceholderText('Enter your email'), 'john@example.com');
      await user.type(screen.getByPlaceholderText('Create a password'), 'short');
      await user.type(screen.getByPlaceholderText('Confirm your password'), 'short');
      await user.click(screen.getByRole('button', { name: 'Create Account' }));

      expect(toast.default.error).toHaveBeenCalledWith('Password must be at least 8 characters');
      expect(mockRegister).not.toHaveBeenCalled();
    });
  });

  describe('form submission', () => {
    it('calls register and navigates on success', async () => {
      const user = userEvent.setup();
      mockRegister.mockResolvedValueOnce({});
      renderRegisterPage();

      await user.type(screen.getByPlaceholderText('Enter your full name'), 'John Doe');
      await user.type(screen.getByPlaceholderText('Choose a username'), 'johndoe');
      await user.type(screen.getByPlaceholderText('Enter your email'), 'john@example.com');
      await user.type(screen.getByPlaceholderText('Create a password'), 'Password123');
      await user.type(screen.getByPlaceholderText('Confirm your password'), 'Password123');
      await user.click(screen.getByRole('button', { name: 'Create Account' }));

      await waitFor(() => {
        expect(mockRegister).toHaveBeenCalledWith({
          email: 'john@example.com',
          username: 'johndoe',
          password: 'Password123',
          full_name: 'John Doe',
        });
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
      });
    });

    it('shows loading state during submission', async () => {
      const user = userEvent.setup();
      let resolveRegister;
      mockRegister.mockReturnValueOnce(new Promise(r => { resolveRegister = r; }));
      renderRegisterPage();

      await user.type(screen.getByPlaceholderText('Choose a username'), 'johndoe');
      await user.type(screen.getByPlaceholderText('Enter your email'), 'john@example.com');
      await user.type(screen.getByPlaceholderText('Create a password'), 'Password123');
      await user.type(screen.getByPlaceholderText('Confirm your password'), 'Password123');
      await user.click(screen.getByRole('button', { name: 'Create Account' }));

      expect(screen.getByRole('button', { name: 'Creating account...' })).toBeDisabled();

      resolveRegister({});
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Create Account' })).not.toBeDisabled();
      });
    });

    it('shows error toast on registration failure', async () => {
      const toast = await import('react-hot-toast');
      const user = userEvent.setup();
      mockRegister.mockRejectedValueOnce({
        response: { data: { error: 'Email already exists' } },
      });
      renderRegisterPage();

      await user.type(screen.getByPlaceholderText('Choose a username'), 'johndoe');
      await user.type(screen.getByPlaceholderText('Enter your email'), 'john@example.com');
      await user.type(screen.getByPlaceholderText('Create a password'), 'Password123');
      await user.type(screen.getByPlaceholderText('Confirm your password'), 'Password123');
      await user.click(screen.getByRole('button', { name: 'Create Account' }));

      await waitFor(() => {
        expect(toast.default.error).toHaveBeenCalledWith('Email already exists');
      });
    });

    it('shows generic error when no error detail', async () => {
      const toast = await import('react-hot-toast');
      const user = userEvent.setup();
      mockRegister.mockRejectedValueOnce(new Error('Network error'));
      renderRegisterPage();

      await user.type(screen.getByPlaceholderText('Choose a username'), 'johndoe');
      await user.type(screen.getByPlaceholderText('Enter your email'), 'john@example.com');
      await user.type(screen.getByPlaceholderText('Create a password'), 'Password123');
      await user.type(screen.getByPlaceholderText('Confirm your password'), 'Password123');
      await user.click(screen.getByRole('button', { name: 'Create Account' }));

      await waitFor(() => {
        expect(toast.default.error).toHaveBeenCalledWith('Registration failed');
      });
    });
  });
});
