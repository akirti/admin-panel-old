import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import V1ExplorerLayout from './v1_ExplorerLayout';

vi.mock('./v1_ExplorerContext', () => ({
  ExplorerProvider: ({ children }) => <div data-testid="explorer-provider">{children}</div>,
}));

vi.mock('./v1_ExplorerSidebar', () => ({
  default: () => <div data-testid="explorer-sidebar">Sidebar</div>,
}));

describe('V1ExplorerLayout', () => {
  it('renders ExplorerProvider wrapper', () => {
    render(
      <MemoryRouter>
        <V1ExplorerLayout />
      </MemoryRouter>
    );
    expect(screen.getByTestId('explorer-provider')).toBeInTheDocument();
  });

  it('renders sidebar', () => {
    render(
      <MemoryRouter>
        <V1ExplorerLayout />
      </MemoryRouter>
    );
    expect(screen.getByTestId('explorer-sidebar')).toBeInTheDocument();
  });

  it('renders content area for Outlet', () => {
    const { container } = render(
      <MemoryRouter>
        <V1ExplorerLayout />
      </MemoryRouter>
    );
    expect(container.querySelector('.flex-1.overflow-auto')).toBeInTheDocument();
  });
});
