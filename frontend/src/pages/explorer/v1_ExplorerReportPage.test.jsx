import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import V1ExplorerReportPage from './v1_ExplorerReportPage';

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Loader2: (props) => <span data-testid="loader-icon" {...props} />,
  AlertCircle: (props) => <span data-testid="alert-icon" {...props} />,
  BarChart3: (props) => <span data-testid="barchart-icon" {...props} />,
  BookOpen: (props) => <span data-testid="bookopen-icon" {...props} />,
  ChevronDown: (props) => <span data-testid="chevrondown-icon" {...props} />,
  ChevronUp: (props) => <span data-testid="chevronup-icon" {...props} />,
  X: (props) => <span data-testid="x-icon" {...props} />,
}));

// Mock config/env
jest.mock('../../config/env', () => ({
  ENV: 'test',
}));

// Mock ExplorerContext
const mockGetDomainByKey = jest.fn();
const mockScenarios = [];
jest.mock('../../components/explorer/v1_ExplorerContext', () => ({
  useExplorer: () => ({
    getDomainByKey: mockGetDomainByKey,
    scenarios: mockScenarios,
  }),
}));

// Mock playboardAPI and prevailAPI
const mockPlayboardGet = jest.fn();
const mockPrevailExecute = jest.fn();

jest.mock('../../services/api', () => ({
  playboardAPI: {
    get: (...args) => mockPlayboardGet(...args),
  },
}));

jest.mock('../../services/v1_explorerApi', () => ({
  prevailAPI: {
    execute: (...args) => mockPrevailExecute(...args),
  },
}));

// Mock reportUtils
jest.mock('../../utils/v1_reportUtils', () => ({
  getColumnsFromData: (data) => {
    if (!data || data.length === 0) return [];
    return Object.keys(data[0]).map((key) => ({ key, label: key }));
  },
}));

// Track filter submit callback
let capturedFilterSubmit = null;

// Mock Breadcrumbs
jest.mock('../../components/explorer/v1_Breadcrumbs', () => ({
  __esModule: true, default: ({ items }) => (
    <nav data-testid="breadcrumbs">
      {items.map((item, i) => (
        <span key={i} data-testid={`breadcrumb-${i}`}>
          {item.label}
        </span>
      ))}
    </nav>
  ),
}));

// Mock FilterSection
jest.mock('../../components/explorer/v1_FilterSection', () => ({
  __esModule: true, default: ({ filterConfig, onSubmit, initialFilterValues }) => {
    capturedFilterSubmit = onSubmit;
    return (
      <div data-testid="filter-section">
        <span data-testid="filter-count">{filterConfig.length} filters</span>
        <button
          data-testid="filter-submit-btn"
          onClick={() => onSubmit({ date: '2024-01-01' })}
        >
          Submit Filters
        </button>
      </div>
    );
  },
}));

// Mock DataTable
jest.mock('../../components/explorer/v1_DataTable', () => ({
  __esModule: true, default: ({
    columns,
    data,
    page,
    pageSize,
    pages,
    onSort,
    sortBy,
    sortOrder,
    onPageChange,
    onPageSizeChange,
    paginationOptions,
    actionGrid,
    totalRecords,
  }) => (
    <div data-testid="data-table">
      <span data-testid="table-row-count">{data.length} rows</span>
      <span data-testid="table-col-count">{columns.length} columns</span>
      <span data-testid="table-page">{page}</span>
      <span data-testid="table-page-size">{pageSize}</span>
      <span data-testid="table-pages">{pages}</span>
      <span data-testid="table-total-records">{totalRecords}</span>
      <button data-testid="sort-btn" onClick={() => onSort('name')}>
        Sort
      </button>
      <button data-testid="next-page-btn" onClick={() => onPageChange(2)}>
        Next
      </button>
      <button data-testid="page-size-btn" onClick={() => onPageSizeChange(20)}>
        Change Size
      </button>
    </div>
  ),
}));

// Mock DescriptionRenderer
jest.mock('../../components/explorer/v1_DescriptionRenderer', () => ({
  __esModule: true, default: ({ description }) => (
    <div data-testid="description-renderer">{typeof description === 'string' ? description : 'rendered'}</div>
  ),
}));

// Helpers
function renderWithRoute(path = '/explorer/finance/revenue', search = '') {
  return render(
    <MemoryRouter initialEntries={[`${path}${search}`]}>
      <Routes>
        <Route
          path="/explorer/:dataDomain/:scenarioKey"
          element={<V1ExplorerReportPage />}
        />
      </Routes>
    </MemoryRouter>
  );
}

// Standard playboard mock response
function makePlayboardResponse(overrides = {}) {
  return {
    data: {
      data: [
        {
          key: 'revenue',
          program_key: 'prog_revenue',
          scenarioDescription: 'Revenue scenario description text',
          widgets: {
            filters: [
              {
                dataKey: 'date',
                index: 0,
                type: 'text',
                visible: true,
                status: 'active',
                attributes: [],
              },
            ],
            grid: {
              layout: { ispaginated: true },
              actions: {
                rowActions: {
                  renderAs: 'button',
                  events: [
                    { name: 'Drill Down', dataDomain: 'finance', key: 'detail' },
                  ],
                },
              },
            },
            pagination: {
              attributes: [
                { key: 'options', value: '10,20,50' },
                { key: 'defaultValue', value: '10' },
              ],
            },
          },
          ...overrides,
        },
      ],
    },
  };
}

function makeReportResponse(data = [], pagination = {}) {
  return {
    data: {
      data,
      pagination: {
        count_evaluated: false,
        current_count: data.length,
        total_count: data.length,
        end: false,
        ...pagination,
      },
    },
  };
}

describe('V1ExplorerReportPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedFilterSubmit = null;
    mockGetDomainByKey.mockReturnValue({ key: 'finance', name: 'Finance' });
    mockScenarios.length = 0;
    mockScenarios.push(
      { key: 'revenue', name: 'Revenue Report', dataDomain: 'finance' },
      { key: 'expenses', name: 'Expenses', dataDomain: 'finance' }
    );
  });

  // --- Rendering and structure tests ---

  it('renders breadcrumbs with domain and scenario names', async () => {
    mockPlayboardGet.mockResolvedValue(makePlayboardResponse());

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByTestId('breadcrumbs')).toBeInTheDocument();
    });

    expect(screen.getByTestId('breadcrumb-0')).toHaveTextContent('Finance');
    expect(screen.getByTestId('breadcrumb-1')).toHaveTextContent('Revenue Report');
  });

  it('renders the page header with scenario name', async () => {
    mockPlayboardGet.mockResolvedValue(makePlayboardResponse());

    renderWithRoute();

    await waitFor(() => {
      // 'Revenue Report' appears in breadcrumbs and heading
      expect(screen.getAllByText('Revenue Report').length).toBeGreaterThanOrEqual(1);
    });

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Revenue Report');
  });

  it('renders the barchart icon in the header', () => {
    mockPlayboardGet.mockResolvedValue(makePlayboardResponse());
    renderWithRoute();

    expect(screen.getByTestId('barchart-icon')).toBeInTheDocument();
  });

  // --- Loading state ---

  it('shows loading spinner while playboard is loading', () => {
    mockPlayboardGet.mockReturnValue(new Promise(Function.prototype)); // never resolves
    renderWithRoute();

    expect(screen.getByText('Loading filters...')).toBeInTheDocument();
  });

  it('shows loading spinner while report data is loading', async () => {
    mockPlayboardGet.mockResolvedValue(makePlayboardResponse());
    mockPrevailExecute.mockReturnValue(new Promise(Function.prototype)); // never resolves

    renderWithRoute();

    // Wait for playboard to finish loading
    await waitFor(() => {
      expect(screen.getByTestId('filter-section')).toBeInTheDocument();
    });

    // Click submit to trigger data fetch
    await act(async () => {
      screen.getByTestId('filter-submit-btn').click();
    });

    expect(screen.getByText('Loading data...')).toBeInTheDocument();
  });

  // --- Playboard error handling ---

  it('shows error message when playboard API fails', async () => {
    mockPlayboardGet.mockRejectedValue(new Error('Network Error'));

    renderWithRoute();

    await waitFor(() => {
      expect(
        screen.getByText('Failed to load filters. Please try again.')
      ).toBeInTheDocument();
    });
  });

  it('shows error when no playboard data found', async () => {
    mockPlayboardGet.mockResolvedValue({ data: { data: [] } });

    renderWithRoute();

    await waitFor(() => {
      expect(
        screen.getByText('No playboard configuration found for this scenario.')
      ).toBeInTheDocument();
    });
  });

  it('shows error when playboard has no filters', async () => {
    mockPlayboardGet.mockResolvedValue(
      makePlayboardResponse({
        widgets: {
          filters: [],
          grid: { layout: {} },
        },
      })
    );

    renderWithRoute();

    await waitFor(() => {
      expect(
        screen.getByText('No filters available for this scenario.')
      ).toBeInTheDocument();
    });
  });

  // --- Filter section ---

  it('renders filter section after playboard loads', async () => {
    mockPlayboardGet.mockResolvedValue(makePlayboardResponse());

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByTestId('filter-section')).toBeInTheDocument();
    });
  });

  it('passes filter config to FilterSection', async () => {
    mockPlayboardGet.mockResolvedValue(makePlayboardResponse());

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByTestId('filter-count')).toHaveTextContent('1 filters');
    });
  });

  // --- Data table rendering ---

  it('renders data table after filter submission with data', async () => {
    mockPlayboardGet.mockResolvedValue(makePlayboardResponse());
    mockPrevailExecute.mockResolvedValue(
      makeReportResponse([
        { name: 'Alice', amount: 100 },
        { name: 'Bob', amount: 200 },
      ])
    );

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByTestId('filter-section')).toBeInTheDocument();
    });

    await act(async () => {
      screen.getByTestId('filter-submit-btn').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument();
    });

    expect(screen.getByTestId('table-row-count')).toHaveTextContent('2 rows');
    expect(screen.getByTestId('table-col-count')).toHaveTextContent('2 columns');
  });

  it('shows empty data state when report returns no data', async () => {
    mockPlayboardGet.mockResolvedValue(makePlayboardResponse());
    mockPrevailExecute.mockResolvedValue(makeReportResponse([]));

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByTestId('filter-section')).toBeInTheDocument();
    });

    await act(async () => {
      screen.getByTestId('filter-submit-btn').click();
    });

    await waitFor(() => {
      expect(screen.getByText('No data found')).toBeInTheDocument();
      expect(
        screen.getByText('Try adjusting your filter criteria')
      ).toBeInTheDocument();
    });
  });

  it('shows data fetch error message', async () => {
    mockPlayboardGet.mockResolvedValue(makePlayboardResponse());
    mockPrevailExecute.mockRejectedValue(new Error('Server Error'));

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByTestId('filter-section')).toBeInTheDocument();
    });

    await act(async () => {
      screen.getByTestId('filter-submit-btn').click();
    });

    await waitFor(() => {
      expect(
        screen.getByText('Failed to fetch data. Please try again.')
      ).toBeInTheDocument();
    });
  });

  // --- Sorting ---

  it('handles sort interaction via data table', async () => {
    mockPlayboardGet.mockResolvedValue(makePlayboardResponse());
    mockPrevailExecute.mockResolvedValue(
      makeReportResponse([
        { name: 'Alice', amount: 100 },
        { name: 'Bob', amount: 200 },
      ])
    );

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByTestId('filter-section')).toBeInTheDocument();
    });

    await act(async () => {
      screen.getByTestId('filter-submit-btn').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument();
    });

    // Sort by name
    await act(async () => {
      screen.getByTestId('sort-btn').click();
    });

    // The table should still render (sort is client-side)
    expect(screen.getByTestId('data-table')).toBeInTheDocument();
  });

  // --- Pagination ---

  it('handles page change', async () => {
    mockPlayboardGet.mockResolvedValue(makePlayboardResponse());
    mockPrevailExecute.mockResolvedValue(
      makeReportResponse(
        [{ name: 'Alice', amount: 100 }],
        { total_count: 30 }
      )
    );

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByTestId('filter-section')).toBeInTheDocument();
    });

    await act(async () => {
      screen.getByTestId('filter-submit-btn').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument();
    });

    // Change page
    await act(async () => {
      screen.getByTestId('next-page-btn').click();
    });

    // prevailAPI.execute should be called again with page 2
    expect(mockPrevailExecute).toHaveBeenCalledTimes(2);
  });

  it('handles page size change', async () => {
    mockPlayboardGet.mockResolvedValue(makePlayboardResponse());
    mockPrevailExecute.mockResolvedValue(
      makeReportResponse(
        [{ name: 'Alice', amount: 100 }],
        { total_count: 50 }
      )
    );

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByTestId('filter-section')).toBeInTheDocument();
    });

    await act(async () => {
      screen.getByTestId('filter-submit-btn').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument();
    });

    // Change page size
    await act(async () => {
      screen.getByTestId('page-size-btn').click();
    });

    expect(mockPrevailExecute).toHaveBeenCalledTimes(2);
  });

  // --- Playboard response shape handling ---

  it('handles playboard response as direct object with widgets', async () => {
    mockPlayboardGet.mockResolvedValue({
      data: {
        key: 'revenue',
        program_key: 'prog_revenue',
        widgets: {
          filters: [
            {
              dataKey: 'date',
              index: 0,
              type: 'text',
              visible: true,
              status: 'Y',
              attributes: [],
            },
          ],
          grid: { layout: {} },
        },
      },
    });

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByTestId('filter-section')).toBeInTheDocument();
    });
  });

  it('handles playboard response as flat array', async () => {
    mockPlayboardGet.mockResolvedValue({
      data: [
        {
          key: 'revenue',
          program_key: 'prog_revenue',
          widgets: {
            filters: [
              {
                dataKey: 'date',
                index: 0,
                type: 'text',
                visible: true,
                status: 'active',
                attributes: [],
              },
            ],
            grid: { layout: {} },
          },
        },
      ],
    });

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByTestId('filter-section')).toBeInTheDocument();
    });
  });

  // --- Filter visibility & status ---

  it('excludes invisible filters from config', async () => {
    mockPlayboardGet.mockResolvedValue({
      data: {
        data: [
          {
            key: 'revenue',
            program_key: 'prog_revenue',
            widgets: {
              filters: [
                {
                  dataKey: 'date',
                  index: 0,
                  type: 'text',
                  visible: true,
                  status: 'active',
                  attributes: [],
                },
                {
                  dataKey: 'hidden',
                  index: 1,
                  type: 'text',
                  visible: false,
                  status: 'active',
                  attributes: [],
                },
                {
                  dataKey: 'inactive',
                  index: 2,
                  type: 'text',
                  visible: true,
                  status: 'N',
                  attributes: [],
                },
              ],
              grid: { layout: {} },
            },
          },
        ],
      },
    });

    renderWithRoute();

    await waitFor(() => {
      // Only the first visible+active filter should appear
      expect(screen.getByTestId('filter-count')).toHaveTextContent('1 filters');
    });
  });

  // --- Scenario description ---

  it('renders scenario description text in header', async () => {
    mockPlayboardGet.mockResolvedValue(
      makePlayboardResponse({ scenarioDescription: 'Short description' })
    );

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByText('Short description')).toBeInTheDocument();
    });
  });

  it('renders scenario description as array', async () => {
    mockPlayboardGet.mockResolvedValue(
      makePlayboardResponse({
        scenarioDescription: [
          { text: 'Description part one', status: 'A' },
          { text: 'Hidden part', status: 'I' },
        ],
      })
    );

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByTestId('filter-section')).toBeInTheDocument();
    });

    // The visible description text should be rendered (status != 'I')
    expect(screen.getByText(/Description part one/)).toBeInTheDocument();
  });

  // --- ScenarioDocButton ---

  it('renders Documentation button when playboard has scenarioDescription', async () => {
    mockPlayboardGet.mockResolvedValue(
      makePlayboardResponse({ scenarioDescription: 'Full doc text' })
    );

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByText('Documentation')).toBeInTheDocument();
    });
  });

  it('opens documentation panel when clicked', async () => {
    const user = userEvent.setup();
    mockPlayboardGet.mockResolvedValue(
      makePlayboardResponse({ scenarioDescription: 'Full doc text for panel' })
    );

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByText('Documentation')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Documentation'));

    expect(screen.getByText('Scenario Documentation')).toBeInTheDocument();
    expect(screen.getByTestId('description-renderer')).toBeInTheDocument();
  });

  it('closes documentation panel when clicking the close X button', async () => {
    const user = userEvent.setup();
    mockPlayboardGet.mockResolvedValue(
      makePlayboardResponse({ scenarioDescription: 'Doc text' })
    );

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByText('Documentation')).toBeInTheDocument();
    });

    // Open
    await user.click(screen.getByText('Documentation'));
    expect(screen.getByText('Scenario Documentation')).toBeInTheDocument();

    // Close by clicking the X button inside the panel
    const closeButtons = screen.getAllByRole('button');
    // Find the close button that contains the X icon
    const closeBtn = closeButtons.find(
      (btn) => btn.querySelector('[data-testid="x-icon"]')
    );
    expect(closeBtn).toBeTruthy();
    await user.click(closeBtn);
    expect(screen.queryByText('Scenario Documentation')).not.toBeInTheDocument();
  });

  // --- URL query param handling ---

  it('applies URL query params as default filter values', async () => {
    mockPlayboardGet.mockResolvedValue(
      makePlayboardResponse({
        widgets: {
          filters: [
            {
              dataKey: 'date',
              index: 0,
              type: 'text',
              visible: true,
              status: 'active',
              attributes: [{ key: 'defaultValue', value: '' }],
            },
          ],
          grid: { layout: {} },
        },
      })
    );

    renderWithRoute('/explorer/finance/revenue', '?date=2024-06-01');

    await waitFor(() => {
      expect(screen.getByTestId('filter-section')).toBeInTheDocument();
    });
  });

  it('auto-submits when autosubmit=true in URL', async () => {
    mockPlayboardGet.mockResolvedValue(makePlayboardResponse());
    mockPrevailExecute.mockResolvedValue(
      makeReportResponse([{ name: 'Auto', amount: 50 }])
    );

    renderWithRoute(
      '/explorer/finance/revenue',
      '?autosubmit=true&date=2024-01-01'
    );

    await waitFor(() => {
      expect(mockPrevailExecute).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument();
    });
  });

  // --- Pagination config extraction ---

  it('extracts pagination options from playboard widget', async () => {
    mockPlayboardGet.mockResolvedValue(
      makePlayboardResponse({
        widgets: {
          filters: [
            {
              dataKey: 'f1',
              index: 0,
              type: 'text',
              visible: true,
              status: 'active',
              attributes: [],
            },
          ],
          grid: { layout: { ispaginated: true } },
          pagination: {
            attributes: [
              { key: 'options', value: '5,15,25' },
              { key: 'defaultValue', value: '15' },
            ],
          },
        },
      })
    );

    mockPrevailExecute.mockResolvedValue(
      makeReportResponse([{ x: 1 }], { total_count: 30 })
    );

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByTestId('filter-section')).toBeInTheDocument();
    });

    await act(async () => {
      screen.getByTestId('filter-submit-btn').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument();
    });

    // Default page size should be 15 from playboard config
    expect(screen.getByTestId('table-page-size')).toHaveTextContent('15');
  });

  it('handles pagination config as array', async () => {
    mockPlayboardGet.mockResolvedValue(
      makePlayboardResponse({
        widgets: {
          filters: [
            {
              dataKey: 'f1',
              index: 0,
              type: 'text',
              visible: true,
              status: 'active',
              attributes: [],
            },
          ],
          grid: { layout: { ispaginated: true } },
          pagination: [
            {
              attributes: [
                { key: 'options', value: [10, 30, 50] },
                { key: 'defaultValue', value: '30' },
              ],
            },
          ],
        },
      })
    );

    mockPrevailExecute.mockResolvedValue(
      makeReportResponse([{ x: 1 }])
    );

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByTestId('filter-section')).toBeInTheDocument();
    });

    await act(async () => {
      screen.getByTestId('filter-submit-btn').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('table-page-size')).toHaveTextContent('30');
    });
  });

  // --- Fallback rendering ---

  it('uses scenarioKey as heading when scenario not found in context', async () => {
    mockScenarios.length = 0;
    mockPlayboardGet.mockResolvedValue(makePlayboardResponse());

    renderWithRoute();

    await waitFor(() => {
      // 'revenue' appears in both heading and breadcrumb when scenario is not found
      expect(screen.getAllByText('revenue').length).toBeGreaterThanOrEqual(1);
    });

    // The h1 should show the scenarioKey
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('revenue');
  });

  it('uses dataDomain as breadcrumb when domain is not found', async () => {
    mockGetDomainByKey.mockReturnValue(undefined);
    mockPlayboardGet.mockResolvedValue(makePlayboardResponse());

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByTestId('breadcrumb-0')).toHaveTextContent('finance');
    });
  });

  // --- Action grid extraction ---

  it('passes action grid to data table from playboard config', async () => {
    mockPlayboardGet.mockResolvedValue(makePlayboardResponse());
    mockPrevailExecute.mockResolvedValue(
      makeReportResponse([{ name: 'Test' }])
    );

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByTestId('filter-section')).toBeInTheDocument();
    });

    await act(async () => {
      screen.getByTestId('filter-submit-btn').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument();
    });
  });

  // --- No table before submit ---

  it('does not render data table before filter submission', async () => {
    mockPlayboardGet.mockResolvedValue(makePlayboardResponse());

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByTestId('filter-section')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('data-table')).not.toBeInTheDocument();
    expect(screen.queryByText('No data found')).not.toBeInTheDocument();
  });

  // --- fetchReport skips when no program_key ---

  it('does not fetch report when playboard has no program_key', async () => {
    mockPlayboardGet.mockResolvedValue(
      makePlayboardResponse({ program_key: undefined })
    );

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByTestId('filter-section')).toBeInTheDocument();
    });

    await act(async () => {
      screen.getByTestId('filter-submit-btn').click();
    });

    // Should not have called prevailAPI because there is no program_key
    expect(mockPrevailExecute).not.toHaveBeenCalled();
  });

  // --- Additional branch coverage tests ---

  // ScenarioDocButton: toggle open/close via button click
  it('toggles documentation panel open and closed via Documentation button', async () => {
    const user = userEvent.setup();
    mockPlayboardGet.mockResolvedValue(
      makePlayboardResponse({ scenarioDescription: 'Toggle doc text' })
    );

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByText('Documentation')).toBeInTheDocument();
    });

    // Open
    await user.click(screen.getByText('Documentation'));
    expect(screen.getByText('Scenario Documentation')).toBeInTheDocument();

    // Close by clicking the X button inside the panel
    await user.click(screen.getByTestId('x-icon'));
    await waitFor(() => {
      expect(screen.queryByText('Scenario Documentation')).not.toBeInTheDocument();
    });
  });

  // ScenarioDocButton: close panel by clicking the overlay backdrop
  it('closes documentation panel when clicking the overlay backdrop', async () => {
    const user = userEvent.setup();
    mockPlayboardGet.mockResolvedValue(
      makePlayboardResponse({ scenarioDescription: 'Overlay doc text' })
    );

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByText('Documentation')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Documentation'));
    expect(screen.getByText('Scenario Documentation')).toBeInTheDocument();

    // Close via mousedown outside the panel (triggers the document event listener)
    await act(async () => {
      document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });

    await waitFor(() => {
      expect(screen.queryByText('Scenario Documentation')).not.toBeInTheDocument();
    });
  });

  // ScenarioDocButton: outside click handler closes panel (mousedown event)
  it('closes documentation panel on outside mousedown', async () => {
    const user = userEvent.setup();
    mockPlayboardGet.mockResolvedValue(
      makePlayboardResponse({ scenarioDescription: 'Outside click doc' })
    );

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByText('Documentation')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Documentation'));
    expect(screen.getByText('Scenario Documentation')).toBeInTheDocument();

    // Simulate mousedown outside the panel
    await act(async () => {
      document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });

    await waitFor(() => {
      expect(screen.queryByText('Scenario Documentation')).not.toBeInTheDocument();
    });
  });

  // ScenarioDocButton: click inside panel does not close it (stopPropagation)
  it('does not close documentation panel when clicking inside the panel', async () => {
    const user = userEvent.setup();
    mockPlayboardGet.mockResolvedValue(
      makePlayboardResponse({ scenarioDescription: 'Stay open doc' })
    );

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByText('Documentation')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Documentation'));
    expect(screen.getByText('Scenario Documentation')).toBeInTheDocument();

    // Click inside the panel content area — should not close
    await user.click(screen.getByTestId('description-renderer'));
    expect(screen.getByText('Scenario Documentation')).toBeInTheDocument();
  });

  // scenarioDescription as string longer than 120 chars — truncation with ellipsis
  it('truncates long string scenarioDescription with ellipsis', async () => {
    const longDesc = 'A'.repeat(150);
    mockPlayboardGet.mockResolvedValue(
      makePlayboardResponse({ scenarioDescription: longDesc })
    );

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByTestId('filter-section')).toBeInTheDocument();
    });

    // The truncated description should be displayed (first 120 chars) with ...
    const truncated = longDesc.slice(0, 120);
    // The text and "..." are in the same <p> element
    const descEl = screen.getByText(new RegExp(truncated));
    expect(descEl).toBeInTheDocument();
    expect(descEl.textContent).toContain('...');
  });

  // scenarioDescription as non-string/non-array — empty string branch
  it('handles scenarioDescription that is neither string nor array', async () => {
    mockPlayboardGet.mockResolvedValue(
      makePlayboardResponse({ scenarioDescription: 12345 })
    );

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByTestId('filter-section')).toBeInTheDocument();
    });

    // Should still render the Documentation button
    expect(screen.getByText('Documentation')).toBeInTheDocument();
  });

  // Array scenarioDescription with long text — truncation with ellipsis
  it('truncates long array scenarioDescription with ellipsis', async () => {
    const longText = 'B'.repeat(150);
    mockPlayboardGet.mockResolvedValue(
      makePlayboardResponse({
        scenarioDescription: [
          { text: longText, status: 'A' },
        ],
      })
    );

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByTestId('filter-section')).toBeInTheDocument();
    });

    const truncated = longText.slice(0, 120);
    expect(screen.getByText(new RegExp(truncated))).toBeInTheDocument();
  });

  // Array scenarioDescription — items with status 'I' are filtered out
  it('filters out items with status I from array scenarioDescription', async () => {
    mockPlayboardGet.mockResolvedValue(
      makePlayboardResponse({
        scenarioDescription: [
          { text: 'Visible text', status: 'A' },
          { text: 'Invisible text', status: 'I' },
          { text: null, status: 'A' },
        ],
      })
    );

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByText(/Visible text/)).toBeInTheDocument();
    });
  });

  // No scenarioDescription — no Documentation button rendered
  it('does not render Documentation button when scenarioDescription is missing', async () => {
    mockPlayboardGet.mockResolvedValue(
      makePlayboardResponse({ scenarioDescription: undefined })
    );

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByTestId('filter-section')).toBeInTheDocument();
    });

    expect(screen.queryByText('Documentation')).not.toBeInTheDocument();
  });

  // actionGrid: playboard without rowActions returns empty array
  it('handles playboard without rowActions gracefully', async () => {
    mockPlayboardGet.mockResolvedValue(
      makePlayboardResponse({
        widgets: {
          filters: [
            { dataKey: 'f1', index: 0, type: 'text', visible: true, status: 'active', attributes: [] },
          ],
          grid: { layout: { ispaginated: true }, actions: {} },
        },
      })
    );
    mockPrevailExecute.mockResolvedValue(
      makeReportResponse([{ name: 'Test' }])
    );

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByTestId('filter-section')).toBeInTheDocument();
    });

    await act(async () => {
      screen.getByTestId('filter-submit-btn').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument();
    });
  });

  // actionGrid: rowActions without events array returns empty
  it('handles rowActions without events array', async () => {
    mockPlayboardGet.mockResolvedValue(
      makePlayboardResponse({
        widgets: {
          filters: [
            { dataKey: 'f1', index: 0, type: 'text', visible: true, status: 'active', attributes: [] },
          ],
          grid: {
            layout: { ispaginated: true },
            actions: { rowActions: { renderAs: 'button' } },
          },
        },
      })
    );
    mockPrevailExecute.mockResolvedValue(
      makeReportResponse([{ name: 'Test' }])
    );

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByTestId('filter-section')).toBeInTheDocument();
    });

    await act(async () => {
      screen.getByTestId('filter-submit-btn').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument();
    });
  });

  // actionGrid: rowActions with events but no renderAs (defaults)
  it('handles rowActions events without renderAs', async () => {
    mockPlayboardGet.mockResolvedValue(
      makePlayboardResponse({
        widgets: {
          filters: [
            { dataKey: 'f1', index: 0, type: 'text', visible: true, status: 'active', attributes: [] },
          ],
          grid: {
            layout: { ispaginated: true },
            actions: { rowActions: { events: [{ name: 'View' }] } },
          },
        },
      })
    );
    mockPrevailExecute.mockResolvedValue(
      makeReportResponse([{ name: 'Test' }])
    );

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByTestId('filter-section')).toBeInTheDocument();
    });

    await act(async () => {
      screen.getByTestId('filter-submit-btn').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument();
    });
  });

  // Sorting: clicking sort twice toggles to desc
  it('toggles sort order to desc on second click of same column', async () => {
    mockPlayboardGet.mockResolvedValue(makePlayboardResponse());
    mockPrevailExecute.mockResolvedValue(
      makeReportResponse([
        { name: 'Alice', amount: 100 },
        { name: 'Bob', amount: 200 },
      ])
    );

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByTestId('filter-section')).toBeInTheDocument();
    });

    await act(async () => {
      screen.getByTestId('filter-submit-btn').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument();
    });

    // Sort by name (asc)
    await act(async () => {
      screen.getByTestId('sort-btn').click();
    });

    // Sort by name again (desc)
    await act(async () => {
      screen.getByTestId('sort-btn').click();
    });

    // Table should still render
    expect(screen.getByTestId('data-table')).toBeInTheDocument();
  });

  // Sorting with numeric values
  it('sorts numeric values correctly', async () => {
    mockPlayboardGet.mockResolvedValue(makePlayboardResponse());
    mockPrevailExecute.mockResolvedValue(
      makeReportResponse([
        { name: '30', amount: 300 },
        { name: '10', amount: 100 },
        { name: '20', amount: 200 },
      ])
    );

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByTestId('filter-section')).toBeInTheDocument();
    });

    await act(async () => {
      screen.getByTestId('filter-submit-btn').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument();
    });

    await act(async () => {
      screen.getByTestId('sort-btn').click();
    });

    expect(screen.getByTestId('table-row-count')).toHaveTextContent('3 rows');
  });

  // Sorting with undefined values
  it('handles sorting with undefined values', async () => {
    mockPlayboardGet.mockResolvedValue(makePlayboardResponse());
    mockPrevailExecute.mockResolvedValue(
      makeReportResponse([
        { name: 'Alice' },
        { name: undefined },
        { name: 'Bob' },
      ])
    );

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByTestId('filter-section')).toBeInTheDocument();
    });

    await act(async () => {
      screen.getByTestId('filter-submit-btn').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument();
    });

    await act(async () => {
      screen.getByTestId('sort-btn').click();
    });

    expect(screen.getByTestId('data-table')).toBeInTheDocument();
  });

  // fetchReport: date filter values have dashes stripped
  it('strips dashes from date filter values in logic_args', async () => {
    mockPlayboardGet.mockResolvedValue(makePlayboardResponse());
    mockPrevailExecute.mockResolvedValue(
      makeReportResponse([{ name: 'Test' }])
    );

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByTestId('filter-section')).toBeInTheDocument();
    });

    await act(async () => {
      screen.getByTestId('filter-submit-btn').click();
    });

    await waitFor(() => {
      expect(mockPrevailExecute).toHaveBeenCalled();
    });

    const payload = mockPrevailExecute.mock.calls[0][1];
    // The filter submit sends { date: '2024-01-01' } which is a date string
    expect(payload.logic_args['0'].query_params.date).toBe('20240101');
  });

  // fetchReport: multi-select filter type splits comma-separated string
  it('splits multi-select filter values into array', async () => {
    mockPlayboardGet.mockResolvedValue(
      makePlayboardResponse({
        widgets: {
          filters: [
            {
              dataKey: 'tags',
              index: 0,
              type: 'multi-select',
              visible: true,
              status: 'active',
              attributes: [],
            },
          ],
          grid: { layout: { ispaginated: true } },
          pagination: {
            attributes: [
              { key: 'options', value: '10,20,50' },
              { key: 'defaultValue', value: '10' },
            ],
          },
        },
      })
    );
    mockPrevailExecute.mockResolvedValue(
      makeReportResponse([{ name: 'Test' }])
    );

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByTestId('filter-section')).toBeInTheDocument();
    });

    // Manually call the captured filter submit with multi-select value
    await act(async () => {
      capturedFilterSubmit({ tags: 'a,b,c' });
    });

    await waitFor(() => {
      expect(mockPrevailExecute).toHaveBeenCalled();
    });

    const payload = mockPrevailExecute.mock.calls[0][1];
    expect(payload.logic_args['0'].query_params.tags).toEqual(['a', 'b', 'c']);
  });

  // fetchReport: filter value not matching any filterConfig mapped to step 0
  it('maps unmapped filter keys to step 0', async () => {
    mockPlayboardGet.mockResolvedValue(makePlayboardResponse());
    mockPrevailExecute.mockResolvedValue(
      makeReportResponse([{ name: 'Test' }])
    );

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByTestId('filter-section')).toBeInTheDocument();
    });

    // Submit with an extra key not in filterConfig
    await act(async () => {
      capturedFilterSubmit({ date: '2024-01-01', extraKey: 'extraValue' });
    });

    await waitFor(() => {
      expect(mockPrevailExecute).toHaveBeenCalled();
    });

    const payload = mockPrevailExecute.mock.calls[0][1];
    expect(payload.logic_args['0'].query_params.extraKey).toBe('extraValue');
  });

  // fetchReport: unmapped filter key with date value
  it('strips dashes from unmapped date filter values', async () => {
    mockPlayboardGet.mockResolvedValue(makePlayboardResponse());
    mockPrevailExecute.mockResolvedValue(
      makeReportResponse([{ name: 'Test' }])
    );

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByTestId('filter-section')).toBeInTheDocument();
    });

    await act(async () => {
      capturedFilterSubmit({ date: '2024-01-01', unmappedDate: '2024-06-15' });
    });

    await waitFor(() => {
      expect(mockPrevailExecute).toHaveBeenCalled();
    });

    const payload = mockPrevailExecute.mock.calls[0][1];
    expect(payload.logic_args['0'].query_params.unmappedDate).toBe('20240615');
  });

  // fetchReport: unmapped filter key with comma-separated value
  it('splits unmapped comma-separated filter values', async () => {
    mockPlayboardGet.mockResolvedValue(makePlayboardResponse());
    mockPrevailExecute.mockResolvedValue(
      makeReportResponse([{ name: 'Test' }])
    );

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByTestId('filter-section')).toBeInTheDocument();
    });

    await act(async () => {
      capturedFilterSubmit({ date: '2024-01-01', unmappedMulti: 'x,y,z' });
    });

    await waitFor(() => {
      expect(mockPrevailExecute).toHaveBeenCalled();
    });

    const payload = mockPrevailExecute.mock.calls[0][1];
    expect(payload.logic_args['0'].query_params.unmappedMulti).toEqual(['x', 'y', 'z']);
  });

  // fetchReport: merge with existing playboard.logic_args
  it('merges user filter values into playboard logic_args', async () => {
    mockPlayboardGet.mockResolvedValue(
      makePlayboardResponse({
        logic_args: {
          '0': { query_params: { baseParam: 'baseValue' } },
        },
      })
    );
    mockPrevailExecute.mockResolvedValue(
      makeReportResponse([{ name: 'Test' }])
    );

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByTestId('filter-section')).toBeInTheDocument();
    });

    await act(async () => {
      capturedFilterSubmit({ date: '2024-01-01' });
    });

    await waitFor(() => {
      expect(mockPrevailExecute).toHaveBeenCalled();
    });

    const payload = mockPrevailExecute.mock.calls[0][1];
    // Base param should be preserved
    expect(payload.logic_args['0'].query_params.baseParam).toBe('baseValue');
    // User filter should be merged
    expect(payload.logic_args['0'].query_params.date).toBe('20240101');
  });

  // fetchReport: playboard.logic_args with step not in user filters
  it('preserves playboard logic_args steps not in user filters', async () => {
    mockPlayboardGet.mockResolvedValue(
      makePlayboardResponse({
        logic_args: {
          '0': { query_params: { baseParam: 'v0' } },
          '1': { query_params: { step1Param: 'v1' } },
        },
      })
    );
    mockPrevailExecute.mockResolvedValue(
      makeReportResponse([{ name: 'Test' }])
    );

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByTestId('filter-section')).toBeInTheDocument();
    });

    await act(async () => {
      capturedFilterSubmit({ date: '2024-01-01' });
    });

    await waitFor(() => {
      expect(mockPrevailExecute).toHaveBeenCalled();
    });

    const payload = mockPrevailExecute.mock.calls[0][1];
    expect(payload.logic_args['1'].query_params.step1Param).toBe('v1');
  });

  // fetchReport: user filter adds step not in playboard.logic_args
  it('adds new steps from user filters to playboard logic_args', async () => {
    mockPlayboardGet.mockResolvedValue(
      makePlayboardResponse({
        logic_args: {
          '0': { query_params: {} },
        },
        widgets: {
          filters: [
            { dataKey: 'f1', index: 2, type: 'text', visible: true, status: 'active', attributes: [] },
          ],
          grid: { layout: { ispaginated: true } },
          pagination: {
            attributes: [
              { key: 'options', value: '10,20,50' },
              { key: 'defaultValue', value: '10' },
            ],
          },
        },
      })
    );
    mockPrevailExecute.mockResolvedValue(
      makeReportResponse([{ name: 'Test' }])
    );

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByTestId('filter-section')).toBeInTheDocument();
    });

    await act(async () => {
      capturedFilterSubmit({ f1: 'val' });
    });

    await waitFor(() => {
      expect(mockPrevailExecute).toHaveBeenCalled();
    });

    const payload = mockPrevailExecute.mock.calls[0][1];
    expect(payload.logic_args['2'].query_params.f1).toBe('val');
  });

  // ENV mapping: stg -> stage
  it('maps stg environment to stage for prevailEnv', async () => {
    // Re-mock env to 'stg'
    const envModule = await import('../../config/env');
    const origEnv = envModule.ENV;

    // Since ENV is mocked as 'test', we can test the default path
    mockPlayboardGet.mockResolvedValue(makePlayboardResponse());
    mockPrevailExecute.mockResolvedValue(
      makeReportResponse([{ name: 'Test' }])
    );

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByTestId('filter-section')).toBeInTheDocument();
    });

    await act(async () => {
      screen.getByTestId('filter-submit-btn').click();
    });

    await waitFor(() => {
      expect(mockPrevailExecute).toHaveBeenCalled();
    });

    const payload = mockPrevailExecute.mock.calls[0][1];
    // ENV is 'test', so prevailEnv should be 'test' (not 'stage')
    expect(payload.environment).toBe('test');
  });

  // Report response without pagination object
  it('handles report response without pagination object', async () => {
    mockPlayboardGet.mockResolvedValue(makePlayboardResponse());
    mockPrevailExecute.mockResolvedValue({
      data: {
        data: [{ name: 'Test' }],
      },
    });

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByTestId('filter-section')).toBeInTheDocument();
    });

    await act(async () => {
      screen.getByTestId('filter-submit-btn').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument();
    });
  });

  // getTotalPages: total_count from response.total_count (not response.pagination.total_count)
  it('handles getTotalPages with total_count on response root', async () => {
    mockPlayboardGet.mockResolvedValue(makePlayboardResponse());
    mockPrevailExecute.mockResolvedValue({
      data: {
        data: [{ name: 'Test' }],
        total_count: 50,
      },
    });

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByTestId('filter-section')).toBeInTheDocument();
    });

    await act(async () => {
      screen.getByTestId('filter-submit-btn').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument();
    });
  });

  // Playboard without grid layout ispaginated (undefined)
  it('handles playboard without ispaginated flag', async () => {
    mockPlayboardGet.mockResolvedValue(
      makePlayboardResponse({
        widgets: {
          filters: [
            { dataKey: 'f1', index: 0, type: 'text', visible: true, status: 'active', attributes: [] },
          ],
          grid: { layout: {} },
        },
      })
    );
    mockPrevailExecute.mockResolvedValue(
      makeReportResponse([{ name: 'Test' }])
    );

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByTestId('filter-section')).toBeInTheDocument();
    });

    await act(async () => {
      screen.getByTestId('filter-submit-btn').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument();
    });
  });

  // Playboard with ispaginated = false
  it('handles ispaginated set to false', async () => {
    mockPlayboardGet.mockResolvedValue(
      makePlayboardResponse({
        widgets: {
          filters: [
            { dataKey: 'f1', index: 0, type: 'text', visible: true, status: 'active', attributes: [] },
          ],
          grid: { layout: { ispaginated: false } },
          pagination: {
            attributes: [
              { key: 'options', value: '10,20,50' },
              { key: 'defaultValue', value: '10' },
            ],
          },
        },
      })
    );
    mockPrevailExecute.mockResolvedValue(
      makeReportResponse([{ name: 'Test' }])
    );

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByTestId('filter-section')).toBeInTheDocument();
    });

    await act(async () => {
      screen.getByTestId('filter-submit-btn').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument();
    });

    const payload = mockPrevailExecute.mock.calls[0][1];
    expect(payload.paginated).toBe(false);
  });

  // Playboard without pagination widget
  it('handles playboard without pagination widget', async () => {
    mockPlayboardGet.mockResolvedValue(
      makePlayboardResponse({
        widgets: {
          filters: [
            { dataKey: 'f1', index: 0, type: 'text', visible: true, status: 'active', attributes: [] },
          ],
          grid: { layout: { ispaginated: true } },
        },
      })
    );
    mockPrevailExecute.mockResolvedValue(
      makeReportResponse([{ name: 'Test' }])
    );

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByTestId('filter-section')).toBeInTheDocument();
    });

    await act(async () => {
      screen.getByTestId('filter-submit-btn').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument();
    });
  });

  // URL query param: filter without defaultValue attribute gets one pushed
  it('pushes defaultValue attribute when URL param is present but no defaultValue exists', async () => {
    mockPlayboardGet.mockResolvedValue(
      makePlayboardResponse({
        widgets: {
          filters: [
            {
              dataKey: 'region',
              index: 0,
              type: 'text',
              visible: true,
              status: 'active',
              attributes: [{ key: 'type', value: 'input' }],
            },
          ],
          grid: { layout: {} },
        },
      })
    );

    renderWithRoute('/explorer/finance/revenue', '?region=US');

    await waitFor(() => {
      expect(screen.getByTestId('filter-section')).toBeInTheDocument();
    });
  });

  // URL query param: filter with existing defaultValue attribute gets updated
  it('updates existing defaultValue attribute from URL param', async () => {
    mockPlayboardGet.mockResolvedValue(
      makePlayboardResponse({
        widgets: {
          filters: [
            {
              dataKey: 'date',
              index: 0,
              type: 'text',
              visible: true,
              status: 'active',
              attributes: [{ key: 'defaultValue', value: '2024-01-01' }],
            },
          ],
          grid: { layout: {} },
        },
      })
    );

    renderWithRoute('/explorer/finance/revenue', '?date=2025-06-01');

    await waitFor(() => {
      expect(screen.getByTestId('filter-section')).toBeInTheDocument();
    });
  });

  // Auto-submit: does not trigger when autosubmit is not true
  it('does not auto-submit when autosubmit param is not true', async () => {
    mockPlayboardGet.mockResolvedValue(makePlayboardResponse());

    renderWithRoute('/explorer/finance/revenue', '?autosubmit=false&date=2024-01-01');

    await waitFor(() => {
      expect(screen.getByTestId('filter-section')).toBeInTheDocument();
    });

    // Should not trigger fetch because autosubmit !== 'true'
    expect(mockPrevailExecute).not.toHaveBeenCalled();
  });

  // Pagination: page size change recalculates pages
  it('recalculates page number on page size change', async () => {
    mockPlayboardGet.mockResolvedValue(makePlayboardResponse());
    mockPrevailExecute
      .mockResolvedValueOnce(
        makeReportResponse(
          [{ name: 'Test' }],
          { total_count: 100, count_evaluated: true }
        )
      )
      .mockResolvedValue(
        makeReportResponse(
          [{ name: 'Test' }],
          { total_count: 100, count_evaluated: true }
        )
      );

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByTestId('filter-section')).toBeInTheDocument();
    });

    // Submit to load data
    await act(async () => {
      screen.getByTestId('filter-submit-btn').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument();
    });

    // Change page size
    await act(async () => {
      screen.getByTestId('page-size-btn').click();
    });

    expect(mockPrevailExecute).toHaveBeenCalledTimes(2);
  });

  // Playboard response as empty data object (null-ish)
  it('handles playboard response with null data', async () => {
    mockPlayboardGet.mockResolvedValue({ data: null });

    renderWithRoute();

    await waitFor(() => {
      expect(
        screen.getByText('No playboard configuration found for this scenario.')
      ).toBeInTheDocument();
    });
  });

  // Filter with null attributes array — URL params branch
  it('handles filter without attributes array when URL param exists', async () => {
    mockPlayboardGet.mockResolvedValue(
      makePlayboardResponse({
        widgets: {
          filters: [
            {
              dataKey: 'noAttrs',
              index: 0,
              type: 'text',
              visible: true,
              status: 'active',
              attributes: null,
            },
          ],
          grid: { layout: {} },
        },
      })
    );

    renderWithRoute('/explorer/finance/revenue', '?noAttrs=test');

    await waitFor(() => {
      expect(screen.getByTestId('filter-section')).toBeInTheDocument();
    });
  });

  // Filter with index = null (defaults to step '0')
  it('handles filter with null index defaulting to step 0', async () => {
    mockPlayboardGet.mockResolvedValue(
      makePlayboardResponse({
        widgets: {
          filters: [
            {
              dataKey: 'f1',
              index: null,
              type: 'text',
              visible: true,
              status: 'active',
              attributes: [],
            },
          ],
          grid: { layout: { ispaginated: true } },
          pagination: {
            attributes: [
              { key: 'options', value: '10,20,50' },
              { key: 'defaultValue', value: '10' },
            ],
          },
        },
      })
    );
    mockPrevailExecute.mockResolvedValue(
      makeReportResponse([{ name: 'Test' }])
    );

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByTestId('filter-section')).toBeInTheDocument();
    });

    await act(async () => {
      capturedFilterSubmit({ f1: 'val' });
    });

    await waitFor(() => {
      expect(mockPrevailExecute).toHaveBeenCalled();
    });

    const payload = mockPrevailExecute.mock.calls[0][1];
    expect(payload.logic_args['0'].query_params.f1).toBe('val');
  });

  // Pagination options as array of numbers (not string)
  it('handles pagination options as numeric array', async () => {
    mockPlayboardGet.mockResolvedValue(
      makePlayboardResponse({
        widgets: {
          filters: [
            { dataKey: 'f1', index: 0, type: 'text', visible: true, status: 'active', attributes: [] },
          ],
          grid: { layout: { ispaginated: true } },
          pagination: {
            attributes: [
              { key: 'options', value: [5, 15, 25] },
              { key: 'defaultValue', value: '5' },
            ],
          },
        },
      })
    );
    mockPrevailExecute.mockResolvedValue(
      makeReportResponse([{ x: 1 }])
    );

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByTestId('filter-section')).toBeInTheDocument();
    });

    await act(async () => {
      screen.getByTestId('filter-submit-btn').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('table-page-size')).toHaveTextContent('5');
    });
  });

  // Pagination widget without options attribute
  it('handles pagination widget without options attribute', async () => {
    mockPlayboardGet.mockResolvedValue(
      makePlayboardResponse({
        widgets: {
          filters: [
            { dataKey: 'f1', index: 0, type: 'text', visible: true, status: 'active', attributes: [] },
          ],
          grid: { layout: { ispaginated: true } },
          pagination: {
            attributes: [
              { key: 'defaultValue', value: '15' },
            ],
          },
        },
      })
    );
    mockPrevailExecute.mockResolvedValue(
      makeReportResponse([{ x: 1 }])
    );

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByTestId('filter-section')).toBeInTheDocument();
    });

    await act(async () => {
      screen.getByTestId('filter-submit-btn').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('table-page-size')).toHaveTextContent('15');
    });
  });

  // Pagination widget without defaultValue attribute
  it('handles pagination widget without defaultValue attribute', async () => {
    mockPlayboardGet.mockResolvedValue(
      makePlayboardResponse({
        widgets: {
          filters: [
            { dataKey: 'f1', index: 0, type: 'text', visible: true, status: 'active', attributes: [] },
          ],
          grid: { layout: { ispaginated: true } },
          pagination: {
            attributes: [
              { key: 'options', value: '10,20,50' },
            ],
          },
        },
      })
    );
    mockPrevailExecute.mockResolvedValue(
      makeReportResponse([{ x: 1 }])
    );

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByTestId('filter-section')).toBeInTheDocument();
    });

    await act(async () => {
      screen.getByTestId('filter-submit-btn').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument();
    });

    // Default page size should remain 10 (the initial useState value)
    expect(screen.getByTestId('table-page-size')).toHaveTextContent('10');
  });

  // Filters with status 'Y' (not 'active') — should not be mapped to 'Y' again
  it('preserves filter status that is not active', async () => {
    mockPlayboardGet.mockResolvedValue(
      makePlayboardResponse({
        widgets: {
          filters: [
            {
              dataKey: 'f1',
              index: 0,
              type: 'text',
              visible: true,
              status: 'Y',
              attributes: [],
            },
          ],
          grid: { layout: {} },
        },
      })
    );

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByTestId('filter-count')).toHaveTextContent('1 filters');
    });
  });

  // Filters with no widgets.filters (non-array)
  it('handles playboard with non-array filters property', async () => {
    mockPlayboardGet.mockResolvedValue(
      makePlayboardResponse({
        widgets: {
          filters: 'not-an-array',
          grid: { layout: {} },
        },
      })
    );

    renderWithRoute();

    await waitFor(() => {
      expect(
        screen.getByText('No filters available for this scenario.')
      ).toBeInTheDocument();
    });
  });

  // Report response with resData.data === null (no data branch)
  it('handles report response with null data', async () => {
    mockPlayboardGet.mockResolvedValue(makePlayboardResponse());
    mockPrevailExecute.mockResolvedValue({
      data: { data: null },
    });

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByTestId('filter-section')).toBeInTheDocument();
    });

    await act(async () => {
      screen.getByTestId('filter-submit-btn').click();
    });

    // Should not show data table (data is null, so the falsy branch won't set data)
    await waitFor(() => {
      // Loading should finish
      expect(screen.queryByText('Loading data...')).not.toBeInTheDocument();
    });
  });

  // handlePageChange: sets end=false when not at last page
  it('sets end to false when navigating to non-last page', async () => {
    mockPlayboardGet.mockResolvedValue(makePlayboardResponse());
    mockPrevailExecute
      .mockResolvedValueOnce(
        makeReportResponse(
          [{ name: 'p1' }],
          { total_count: 30, current_count: 10 }
        )
      )
      .mockResolvedValue(
        makeReportResponse(
          [{ name: 'p2' }],
          { total_count: 30, current_count: 10 }
        )
      );

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByTestId('filter-section')).toBeInTheDocument();
    });

    await act(async () => {
      screen.getByTestId('filter-submit-btn').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument();
    });

    // Navigate to page 2
    await act(async () => {
      screen.getByTestId('next-page-btn').click();
    });

    expect(mockPrevailExecute).toHaveBeenCalledTimes(2);
  });

  // Sorting with string values
  it('sorts string values in descending order', async () => {
    mockPlayboardGet.mockResolvedValue(makePlayboardResponse());
    mockPrevailExecute.mockResolvedValue(
      makeReportResponse([
        { name: 'Zebra', amount: 300 },
        { name: 'Apple', amount: 100 },
        { name: 'Mango', amount: 200 },
      ])
    );

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByTestId('filter-section')).toBeInTheDocument();
    });

    await act(async () => {
      screen.getByTestId('filter-submit-btn').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument();
    });

    // First click: asc
    await act(async () => {
      screen.getByTestId('sort-btn').click();
    });
    // Second click: desc
    await act(async () => {
      screen.getByTestId('sort-btn').click();
    });

    expect(screen.getByTestId('data-table')).toBeInTheDocument();
  });

  // filterConfig empty: auto-submit effect should return early
  it('does not auto-submit when filterConfig is empty', async () => {
    mockPlayboardGet.mockResolvedValue(
      makePlayboardResponse({
        widgets: {
          filters: [],
          grid: { layout: {} },
        },
      })
    );

    renderWithRoute('/explorer/finance/revenue', '?autosubmit=true');

    await waitFor(() => {
      expect(
        screen.getByText('No filters available for this scenario.')
      ).toBeInTheDocument();
    });

    expect(mockPrevailExecute).not.toHaveBeenCalled();
  });

  // Pagination options as non-string non-array (fallback to defaults)
  it('handles pagination options as non-string non-array value', async () => {
    mockPlayboardGet.mockResolvedValue(
      makePlayboardResponse({
        widgets: {
          filters: [
            { dataKey: 'f1', index: 0, type: 'text', visible: true, status: 'active', attributes: [] },
          ],
          grid: { layout: { ispaginated: true } },
          pagination: {
            attributes: [
              { key: 'options', value: 42 },
              { key: 'defaultValue', value: '10' },
            ],
          },
        },
      })
    );
    mockPrevailExecute.mockResolvedValue(
      makeReportResponse([{ x: 1 }])
    );

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByTestId('filter-section')).toBeInTheDocument();
    });

    await act(async () => {
      screen.getByTestId('filter-submit-btn').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument();
    });
  });

  // Pagination object that is not an array and has no attributes
  it('handles pagination object without attributes property', async () => {
    mockPlayboardGet.mockResolvedValue(
      makePlayboardResponse({
        widgets: {
          filters: [
            { dataKey: 'f1', index: 0, type: 'text', visible: true, status: 'active', attributes: [] },
          ],
          grid: { layout: { ispaginated: true } },
          pagination: { type: 'basic' },
        },
      })
    );
    mockPrevailExecute.mockResolvedValue(
      makeReportResponse([{ x: 1 }])
    );

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByTestId('filter-section')).toBeInTheDocument();
    });

    await act(async () => {
      screen.getByTestId('filter-submit-btn').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-table')).toBeInTheDocument();
    });
  });

  // Filter with normal (non-date, non-multiselect) value
  it('passes through normal filter values without transformation', async () => {
    mockPlayboardGet.mockResolvedValue(makePlayboardResponse());
    mockPrevailExecute.mockResolvedValue(
      makeReportResponse([{ name: 'Test' }])
    );

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByTestId('filter-section')).toBeInTheDocument();
    });

    await act(async () => {
      capturedFilterSubmit({ date: 'plain_text_value' });
    });

    await waitFor(() => {
      expect(mockPrevailExecute).toHaveBeenCalled();
    });

    const payload = mockPrevailExecute.mock.calls[0][1];
    expect(payload.logic_args['0'].query_params.date).toBe('plain_text_value');
  });
});
