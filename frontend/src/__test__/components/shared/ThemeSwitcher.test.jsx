import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ThemeSwitcher from '../../../components/shared/ThemeSwitcher';

const mockSetTheme = jest.fn();
const mockThemes = [
  { id: 'original', label: 'Original', description: 'Classic red theme', colors: { primary: '#dc2626', bg: '#ffffff', accent: '#fef2f2' } },
  { id: 'dark', label: 'Dark', description: 'Easy on the eyes', colors: { primary: '#818cf8', bg: '#0f0f1a', accent: '#1e1e2e' } },
  { id: 'ocean', label: 'Ocean Breeze', description: 'Cool teal tones', colors: { primary: '#0891b2', bg: '#f0f9ff', accent: '#ecfeff' } },
];

jest.mock('../../../contexts/ThemeContext', () => ({
  useTheme: jest.fn(() => ({
    theme: 'original',
    setTheme: mockSetTheme,
    themes: mockThemes,
  })),
}));

import { useTheme } from '../../../contexts/ThemeContext';

describe('ThemeSwitcher', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useTheme.mockReturnValue({
      theme: 'original',
      setTheme: mockSetTheme,
      themes: mockThemes,
    });
  });

  it('renders the theme button with label when not compact', () => {
    render(<ThemeSwitcher />);
    expect(screen.getByTitle('Switch theme')).toBeInTheDocument();
    expect(screen.getByText('Theme')).toBeInTheDocument();
  });

  it('renders without label when compact', () => {
    render(<ThemeSwitcher compact />);
    expect(screen.getByTitle('Switch theme')).toBeInTheDocument();
    expect(screen.queryByText('Theme')).not.toBeInTheDocument();
  });

  it('does not show dropdown initially', () => {
    render(<ThemeSwitcher />);
    expect(screen.queryByText('Choose Theme')).not.toBeInTheDocument();
  });

  it('opens dropdown on button click', async () => {
    const user = userEvent.setup();
    render(<ThemeSwitcher />);

    await user.click(screen.getByTitle('Switch theme'));

    expect(screen.getByText('Choose Theme')).toBeInTheDocument();
    expect(screen.getByText('Original')).toBeInTheDocument();
    expect(screen.getByText('Dark')).toBeInTheDocument();
    expect(screen.getByText('Ocean Breeze')).toBeInTheDocument();
  });

  it('shows theme descriptions in dropdown', async () => {
    const user = userEvent.setup();
    render(<ThemeSwitcher />);

    await user.click(screen.getByTitle('Switch theme'));

    expect(screen.getByText('Classic red theme')).toBeInTheDocument();
    expect(screen.getByText('Easy on the eyes')).toBeInTheDocument();
    expect(screen.getByText('Cool teal tones')).toBeInTheDocument();
  });

  it('calls setTheme and closes dropdown when a theme is selected', async () => {
    const user = userEvent.setup();
    render(<ThemeSwitcher />);

    await user.click(screen.getByTitle('Switch theme'));
    await user.click(screen.getByText('Dark'));

    expect(mockSetTheme).toHaveBeenCalledWith('dark');
    expect(screen.queryByText('Choose Theme')).not.toBeInTheDocument();
  });

  it('toggles dropdown open and closed', async () => {
    const user = userEvent.setup();
    render(<ThemeSwitcher />);

    await user.click(screen.getByTitle('Switch theme'));
    expect(screen.getByText('Choose Theme')).toBeInTheDocument();

    await user.click(screen.getByTitle('Switch theme'));
    expect(screen.queryByText('Choose Theme')).not.toBeInTheDocument();
  });

  it('closes dropdown on outside click', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <div>
        <div data-testid="outside">Outside</div>
        <ThemeSwitcher />
      </div>
    );

    await user.click(screen.getByTitle('Switch theme'));
    expect(screen.getByText('Choose Theme')).toBeInTheDocument();

    await user.click(screen.getByTestId('outside'));
    expect(screen.queryByText('Choose Theme')).not.toBeInTheDocument();
  });

  it('shows check mark next to active theme', async () => {
    const user = userEvent.setup();
    render(<ThemeSwitcher />);

    await user.click(screen.getByTitle('Switch theme'));

    // The active theme (original) should have a different style
    const originalButton = screen.getByText('Original').closest('button');
    expect(originalButton).toHaveClass('bg-primary-50');
  });

  it('renders color swatches for each theme', async () => {
    const user = userEvent.setup();
    render(<ThemeSwitcher />);

    await user.click(screen.getByTitle('Switch theme'));

    // Each theme has 3 color swatches
    const swatches = document.querySelectorAll('[style]');
    expect(swatches.length).toBeGreaterThanOrEqual(9); // 3 themes × 3 colors
  });
});
