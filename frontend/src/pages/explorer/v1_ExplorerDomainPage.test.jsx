import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import V1ExplorerDomainPage from './v1_ExplorerDomainPage';

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Compass: (props) => <span data-testid="compass-icon" {...props} />,
  FileText: (props) => <span data-testid="filetext-icon" {...props} />,
  Layers: (props) => <span data-testid="layers-icon" {...props} />,
}));

// Mock the ExplorerContext
const mockGetScenariosByDomain = jest.fn();
const mockGetDomainByKey = jest.fn();

jest.mock('../../components/explorer/v1_ExplorerContext', () => ({
  useExplorer: () => ({
    getScenariosByDomain: mockGetScenariosByDomain,
    getDomainByKey: mockGetDomainByKey,
  }),
}));

// Mock sub-components
jest.mock('../../components/explorer/v1_Breadcrumbs', () => ({
  __esModule: true, default: ({ items }) => (
    <nav data-testid="breadcrumbs">
      {items.map((item, i) => (
        <span key={i}>{item.label}</span>
      ))}
    </nav>
  ),
}));

jest.mock('../../components/explorer/v1_SearchBar', () => ({
  __esModule: true, default: ({ value, onChange }) => (
    <input
      data-testid="search-bar"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Search..."
    />
  ),
}));

const mockNavigate = jest.fn();
jest.mock('react-router', () => {
  const actual = jest.requireActual('react-router');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderWithRoute(domainKey = 'finance') {
  return render(
    <MemoryRouter initialEntries={[`/explorer/${domainKey}`]}>
      <Routes>
        <Route path="/explorer/:dataDomain" element={<V1ExplorerDomainPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('V1ExplorerDomainPage', () => {
  const mockDomain = {
    key: 'finance',
    name: 'Finance',
    description: 'Financial data domain',
    icon: 'https://example.com/icon.png',
  };

  const mockScenarios = [
    { key: 'sc1', name: 'Revenue Report', description: 'Revenue analysis report' },
    { key: 'sc2', name: 'Expense Tracker', description: 'Track company expenses' },
    { key: 'sc3', name: 'Budget Overview', description: 'Annual budget overview' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDomainByKey.mockReturnValue(mockDomain);
    mockGetScenariosByDomain.mockReturnValue(mockScenarios);
  });

  it('renders the page header with domain name', () => {
    renderWithRoute();

    // 'Finance' appears in breadcrumbs and heading
    expect(screen.getAllByText('Finance').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Finance');
  });

  it('renders breadcrumbs with domain name', () => {
    renderWithRoute();

    expect(screen.getByTestId('breadcrumbs')).toBeInTheDocument();
    expect(screen.getAllByText('Finance').length).toBeGreaterThanOrEqual(1);
  });

  it('renders domain description when available', () => {
    renderWithRoute();

    expect(screen.getByText('Financial data domain')).toBeInTheDocument();
  });

  it('renders all scenario cards', () => {
    renderWithRoute();

    expect(screen.getByText('Revenue Report')).toBeInTheDocument();
    expect(screen.getByText('Expense Tracker')).toBeInTheDocument();
    expect(screen.getByText('Budget Overview')).toBeInTheDocument();
  });

  it('renders scenario descriptions', () => {
    renderWithRoute();

    expect(screen.getByText('Revenue analysis report')).toBeInTheDocument();
    expect(screen.getByText('Track company expenses')).toBeInTheDocument();
    expect(screen.getByText('Annual budget overview')).toBeInTheDocument();
  });

  it('renders Explore buttons for each scenario', () => {
    renderWithRoute();

    const exploreButtons = screen.getAllByText('Explore');
    expect(exploreButtons).toHaveLength(3);
  });

  it('navigates to scenario page when Explore is clicked', async () => {
    const user = userEvent.setup();
    renderWithRoute();

    const exploreButtons = screen.getAllByText('Explore');
    await user.click(exploreButtons[0]);

    expect(mockNavigate).toHaveBeenCalledWith('/explorer/finance/sc1');
  });

  it('navigates to correct scenario for each card', async () => {
    const user = userEvent.setup();
    renderWithRoute();

    const exploreButtons = screen.getAllByText('Explore');
    await user.click(exploreButtons[2]);

    expect(mockNavigate).toHaveBeenCalledWith('/explorer/finance/sc3');
  });

  it('shows search bar', () => {
    renderWithRoute();

    expect(screen.getByTestId('search-bar')).toBeInTheDocument();
  });

  it('filters scenarios by name when searching', async () => {
    const user = userEvent.setup();
    renderWithRoute();

    const searchInput = screen.getByTestId('search-bar');
    await user.type(searchInput, 'Revenue');

    expect(screen.getByText('Revenue Report')).toBeInTheDocument();
    expect(screen.queryByText('Expense Tracker')).not.toBeInTheDocument();
    expect(screen.queryByText('Budget Overview')).not.toBeInTheDocument();
  });

  it('filters scenarios by description when searching', async () => {
    const user = userEvent.setup();
    renderWithRoute();

    const searchInput = screen.getByTestId('search-bar');
    await user.type(searchInput, 'company expenses');

    expect(screen.queryByText('Revenue Report')).not.toBeInTheDocument();
    expect(screen.getByText('Expense Tracker')).toBeInTheDocument();
    expect(screen.queryByText('Budget Overview')).not.toBeInTheDocument();
  });

  it('shows empty state when no scenarios exist', () => {
    mockGetScenariosByDomain.mockReturnValue([]);
    renderWithRoute();

    expect(screen.getByText('No scenarios found')).toBeInTheDocument();
    expect(screen.getByText('No scenarios available for this domain')).toBeInTheDocument();
  });

  it('shows different empty state message when search has no matches', async () => {
    const user = userEvent.setup();
    renderWithRoute();

    const searchInput = screen.getByTestId('search-bar');
    await user.type(searchInput, 'nonexistent');

    expect(screen.getByText('No scenarios found')).toBeInTheDocument();
    expect(screen.getByText('Try a different search term')).toBeInTheDocument();
  });

  it('falls back to dataDomain param when domain is not found', () => {
    mockGetDomainByKey.mockReturnValue(undefined);
    renderWithRoute('unknown-domain');

    // Should show the URL param key as the title
    expect(screen.getAllByText('unknown-domain').length).toBeGreaterThanOrEqual(1);
  });

  it('does not render description when domain has none', () => {
    mockGetDomainByKey.mockReturnValue({ key: 'finance', name: 'Finance' });
    renderWithRoute();

    // Should render name but no description paragraph
    expect(screen.getAllByText('Finance').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('Financial data domain')).not.toBeInTheDocument();
  });

  it('shows "No description available" for scenarios without description', () => {
    mockGetScenariosByDomain.mockReturnValue([
      { key: 'sc1', name: 'No Desc Scenario' },
    ]);
    renderWithRoute();

    expect(screen.getByText('No description available')).toBeInTheDocument();
  });

  it('renders domain icon image when icon URL is provided', () => {
    renderWithRoute();

    const img = screen.getByAltText('Finance');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/icon.png');
  });

  it('shows fallback Layers icon when domain has no icon', () => {
    mockGetDomainByKey.mockReturnValue({ key: 'finance', name: 'Finance' });
    renderWithRoute();

    // The Layers icon should be visible (display: block) when there's no icon
    const layersIcon = screen.getByTestId('layers-icon');
    expect(layersIcon).toBeInTheDocument();
  });

  it('performs case-insensitive search', async () => {
    const user = userEvent.setup();
    renderWithRoute();

    const searchInput = screen.getByTestId('search-bar');
    await user.type(searchInput, 'REVENUE');

    expect(screen.getByText('Revenue Report')).toBeInTheDocument();
    expect(screen.queryByText('Expense Tracker')).not.toBeInTheDocument();
  });

  it('returns all scenarios when search is cleared', async () => {
    const user = userEvent.setup();
    renderWithRoute();

    const searchInput = screen.getByTestId('search-bar');
    await user.type(searchInput, 'Revenue');
    expect(screen.queryByText('Expense Tracker')).not.toBeInTheDocument();

    await user.clear(searchInput);
    expect(screen.getByText('Revenue Report')).toBeInTheDocument();
    expect(screen.getByText('Expense Tracker')).toBeInTheDocument();
    expect(screen.getByText('Budget Overview')).toBeInTheDocument();
  });
});
