import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import AuthLayout from './AuthLayout';

jest.mock('../shared/ThemeSwitcher', () => ({
  __esModule: true, default: ({ compact }) => (
    <div data-testid="theme-switcher" data-compact={compact}>
      ThemeSwitcher
    </div>
  ),
}));

function renderAuthLayout() {
  return render(
    <MemoryRouter>
      <AuthLayout />
    </MemoryRouter>
  );
}

describe('AuthLayout', () => {
  it('renders the branding section', () => {
    renderAuthLayout();
    // Desktop + mobile both show EasyLife
    const easylifeTexts = screen.getAllByText('EasyLife');
    expect(easylifeTexts.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/streamline your workflow/i)).toBeInTheDocument();
  });

  it('renders stat cards', () => {
    renderAuthLayout();
    expect(screen.getByText('99%')).toBeInTheDocument();
    expect(screen.getByText('Uptime')).toBeInTheDocument();
    expect(screen.getByText('24/7')).toBeInTheDocument();
    expect(screen.getByText('Support')).toBeInTheDocument();
    expect(screen.getByText('500+')).toBeInTheDocument();
    expect(screen.getByText('Users')).toBeInTheDocument();
  });

  it('renders copyright text', () => {
    renderAuthLayout();
    expect(screen.getByText(/2024 EasyLife/)).toBeInTheDocument();
  });

  it('renders theme switcher with compact mode', () => {
    renderAuthLayout();
    const switcher = screen.getAllByTestId('theme-switcher');
    // The compact one in footer
    const compactSwitcher = switcher.find(s => s.dataset.compact === 'true');
    expect(compactSwitcher).toBeInTheDocument();
  });

  it('renders the auth form container', () => {
    renderAuthLayout();
    // The form container has the card styling
    const card = document.querySelector('.bg-surface.rounded-2xl');
    expect(card).toBeInTheDocument();
  });

  it('renders mobile logo section', () => {
    renderAuthLayout();
    // Both desktop and mobile logos contain "EasyLife"
    const easylifeTexts = screen.getAllByText('EasyLife');
    expect(easylifeTexts.length).toBeGreaterThanOrEqual(2);
  });

  it('renders SVG icon in branding', () => {
    const { container } = renderAuthLayout();
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThanOrEqual(2); // desktop + mobile
  });
});
