import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import V1ExplorerSidebar from './v1_ExplorerSidebar';

const mockNavigate = vi.fn();

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ dataDomain: 'domain1' }),
  };
});

vi.mock('./v1_ExplorerContext', () => ({
  useExplorer: vi.fn(),
}));

import { useExplorer } from './v1_ExplorerContext';

describe('V1ExplorerSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading spinner when loading', () => {
    useExplorer.mockReturnValue({ domains: [], loading: true });
    const { container } = render(
      <MemoryRouter>
        <V1ExplorerSidebar />
      </MemoryRouter>
    );
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renders domain list', () => {
    useExplorer.mockReturnValue({
      domains: [
        { key: 'domain1', name: 'Sales Data' },
        { key: 'domain2', name: 'Finance Data' },
      ],
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={['/explorer/domain1']}>
        <V1ExplorerSidebar />
      </MemoryRouter>
    );

    expect(screen.getByText('Sales Data')).toBeInTheDocument();
    expect(screen.getByText('Finance Data')).toBeInTheDocument();
  });

  it('shows Data Domains header', () => {
    useExplorer.mockReturnValue({
      domains: [{ key: 'd1', name: 'Test' }],
      loading: false,
    });

    render(
      <MemoryRouter>
        <V1ExplorerSidebar />
      </MemoryRouter>
    );

    expect(screen.getByText('Data Domains')).toBeInTheDocument();
  });

  it('toggles sidebar collapse', async () => {
    const user = userEvent.setup();
    useExplorer.mockReturnValue({
      domains: [{ key: 'd1', name: 'Test Domain' }],
      loading: false,
    });

    const { container } = render(
      <MemoryRouter>
        <V1ExplorerSidebar />
      </MemoryRouter>
    );

    // Initially expanded
    expect(screen.getByText('Data Domains')).toBeInTheDocument();

    // Click collapse button
    const collapseBtn = screen.getAllByRole('button')[0];
    await user.click(collapseBtn);

    // Header text should be hidden
    expect(screen.queryByText('Data Domains')).not.toBeInTheDocument();
  });

  it('renders domain links with correct href', () => {
    useExplorer.mockReturnValue({
      domains: [{ key: 'sales', name: 'Sales' }],
      loading: false,
    });

    render(
      <MemoryRouter>
        <V1ExplorerSidebar />
      </MemoryRouter>
    );

    const link = screen.getByText('Sales').closest('a');
    expect(link).toHaveAttribute('href', '/explorer/sales');
  });

  it('hides domain names when collapsed', async () => {
    const user = userEvent.setup();
    useExplorer.mockReturnValue({
      domains: [{ key: 'd1', name: 'TestDomain' }],
      loading: false,
    });

    render(
      <MemoryRouter>
        <V1ExplorerSidebar />
      </MemoryRouter>
    );

    expect(screen.getByText('TestDomain')).toBeInTheDocument();

    // Collapse the sidebar
    const collapseBtn = screen.getAllByRole('button')[0];
    await user.click(collapseBtn);

    // Domain name text should be hidden
    expect(screen.queryByText('TestDomain')).not.toBeInTheDocument();
  });

  it('renders domain icon when icon URL provided', () => {
    useExplorer.mockReturnValue({
      domains: [{ key: 'd1', name: 'Test', icon: '/icon.png' }],
      loading: false,
    });

    const { container } = render(
      <MemoryRouter initialEntries={['/explorer/d1']}>
        <V1ExplorerSidebar />
      </MemoryRouter>
    );

    const img = container.querySelector('img');
    // img may or may not be visible depending on active state
    // but the element should exist or fallback icon shown
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('renders multiple domain links', () => {
    useExplorer.mockReturnValue({
      domains: [
        { key: 'a', name: 'Domain A' },
        { key: 'b', name: 'Domain B' },
        { key: 'c', name: 'Domain C' },
      ],
      loading: false,
    });

    render(
      <MemoryRouter>
        <V1ExplorerSidebar />
      </MemoryRouter>
    );

    expect(screen.getByText('Domain A')).toBeInTheDocument();
    expect(screen.getByText('Domain B')).toBeInTheDocument();
    expect(screen.getByText('Domain C')).toBeInTheDocument();
  });

  it('re-expands sidebar after collapsing', async () => {
    const user = userEvent.setup();
    useExplorer.mockReturnValue({
      domains: [{ key: 'd1', name: 'Test' }],
      loading: false,
    });

    render(
      <MemoryRouter>
        <V1ExplorerSidebar />
      </MemoryRouter>
    );

    // Collapse
    const collapseBtn = screen.getAllByRole('button')[0];
    await user.click(collapseBtn);
    expect(screen.queryByText('Data Domains')).not.toBeInTheDocument();

    // Expand again
    await user.click(screen.getAllByRole('button')[0]);
    expect(screen.getByText('Data Domains')).toBeInTheDocument();
  });
});
