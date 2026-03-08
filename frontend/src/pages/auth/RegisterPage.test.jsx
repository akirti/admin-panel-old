import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import RegisterPage from './RegisterPage';

const mockRegister = jest.fn();
const mockNavigate = jest.fn();

// Test constants
const TEST_FULL_NAME = 'John Doe';
const TEST_USERNAME = 'johndoe';
const TEST_EMAIL = 'john@example.com';
const TEST_PASSWORD = 'Password123';
const TEST_WEAK_PASSWORD = 'Password1';
const TEST_SHORT_PASSWORD = 'short';
const TEST_MISMATCHED_PASSWORD = 'Different1';
const DASHBOARD_ROUTE = '/dashboard';

jest.mock('react-router', () => {
  const actual = jest.requireActual('react-router');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ register: mockRegister }),
}));

jest.mock('react-hot-toast', () => ({ __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
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
    jest.clearAllMocks();
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

      await user.type(screen.getByPlaceholderText('Enter your full name'), TEST_FULL_NAME);
      await user.type(screen.getByPlaceholderText('Choose a username'), TEST_USERNAME);
      await user.type(screen.getByPlaceholderText('Enter your email'), TEST_EMAIL);
      await user.type(screen.getByPlaceholderText('Create a password'), TEST_WEAK_PASSWORD);
      await user.type(screen.getByPlaceholderText('Confirm your password'), TEST_WEAK_PASSWORD);

      expect(screen.getByPlaceholderText('Enter your full name')).toHaveValue(TEST_FULL_NAME);
      expect(screen.getByPlaceholderText('Choose a username')).toHaveValue(TEST_USERNAME);
      expect(screen.getByPlaceholderText('Enter your email')).toHaveValue(TEST_EMAIL);
      expect(screen.getByPlaceholderText('Create a password')).toHaveValue(TEST_WEAK_PASSWORD);
      expect(screen.getByPlaceholderText('Confirm your password')).toHaveValue(TEST_WEAK_PASSWORD);
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

      await user.type(screen.getByPlaceholderText('Choose a username'), TEST_USERNAME);
      await user.type(screen.getByPlaceholderText('Enter your email'), TEST_EMAIL);
      await user.type(screen.getByPlaceholderText('Create a password'), TEST_WEAK_PASSWORD);
      await user.type(screen.getByPlaceholderText('Confirm your password'), TEST_MISMATCHED_PASSWORD);
      await user.click(screen.getByRole('button', { name: 'Create Account' }));

      expect(toast.default.error).toHaveBeenCalledWith('Passwords do not match');
      expect(mockRegister).not.toHaveBeenCalled();
    });

    it('shows error when password is too short', async () => {
      const toast = await import('react-hot-toast');
      const user = userEvent.setup();
      renderRegisterPage();

      await user.type(screen.getByPlaceholderText('Choose a username'), TEST_USERNAME);
      await user.type(screen.getByPlaceholderText('Enter your email'), TEST_EMAIL);
      await user.type(screen.getByPlaceholderText('Create a password'), TEST_SHORT_PASSWORD);
      await user.type(screen.getByPlaceholderText('Confirm your password'), TEST_SHORT_PASSWORD);
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

      await user.type(screen.getByPlaceholderText('Enter your full name'), TEST_FULL_NAME);
      await user.type(screen.getByPlaceholderText('Choose a username'), TEST_USERNAME);
      await user.type(screen.getByPlaceholderText('Enter your email'), TEST_EMAIL);
      await user.type(screen.getByPlaceholderText('Create a password'), TEST_PASSWORD);
      await user.type(screen.getByPlaceholderText('Confirm your password'), TEST_PASSWORD);
      await user.click(screen.getByRole('button', { name: 'Create Account' }));

      await waitFor(() => {
        expect(mockRegister).toHaveBeenCalledWith({
          email: TEST_EMAIL,
          username: TEST_USERNAME,
          password: TEST_PASSWORD,
          full_name: TEST_FULL_NAME,
        });
        expect(mockNavigate).toHaveBeenCalledWith(DASHBOARD_ROUTE);
      });
    });

    it('shows loading state during submission', async () => {
      const user = userEvent.setup();
      let resolveRegister;
      mockRegister.mockReturnValueOnce(new Promise(r => { resolveRegister = r; }));
      renderRegisterPage();

      await user.type(screen.getByPlaceholderText('Choose a username'), TEST_USERNAME);
      await user.type(screen.getByPlaceholderText('Enter your email'), TEST_EMAIL);
      await user.type(screen.getByPlaceholderText('Create a password'), TEST_PASSWORD);
      await user.type(screen.getByPlaceholderText('Confirm your password'), TEST_PASSWORD);
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

      await user.type(screen.getByPlaceholderText('Choose a username'), TEST_USERNAME);
      await user.type(screen.getByPlaceholderText('Enter your email'), TEST_EMAIL);
      await user.type(screen.getByPlaceholderText('Create a password'), TEST_PASSWORD);
      await user.type(screen.getByPlaceholderText('Confirm your password'), TEST_PASSWORD);
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

      await user.type(screen.getByPlaceholderText('Choose a username'), TEST_USERNAME);
      await user.type(screen.getByPlaceholderText('Enter your email'), TEST_EMAIL);
      await user.type(screen.getByPlaceholderText('Create a password'), TEST_PASSWORD);
      await user.type(screen.getByPlaceholderText('Confirm your password'), TEST_PASSWORD);
      await user.click(screen.getByRole('button', { name: 'Create Account' }));

      await waitFor(() => {
        expect(toast.default.error).toHaveBeenCalledWith('Registration failed');
      });
    });
  });
});
