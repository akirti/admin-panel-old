import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import V1ExplorerReportPage from './v1_ExplorerReportPage';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Loader2: (props) => <span data-testid="loader-icon" {...props} />,
  AlertCircle: (props) => <span data-testid="alert-icon" {...props} />,
  BarChart3: (props) => <span data-testid="barchart-icon" {...props} />,
  BookOpen: (props) => <span data-testid="bookopen-icon" {...props} />,
  ChevronDown: (props) => <span data-testid="chevrondown-icon" {...props} />,
  ChevronUp: (props) => <span data-testid="chevronup-icon" {...props} />,
  X: (props) => <span data-testid="x-icon" {...props} />,
}));

// Mock config/env
vi.mock('../../config/env', () => ({
  ENV: 'test',
}));

// Mock ExplorerContext
const mockGetDomainByKey = vi.fn();
const mockScenarios = [];
vi.mock('../../components/explorer/v1_ExplorerContext', () => ({
  useExplorer: () => ({
    getDomainByKey: mockGetDomainByKey,
    scenarios: mockScenarios,
  }),
}));

// Mock playboardAPI and prevailAPI
const mockPlayboardGet = vi.fn();
const mockPrevailExecute = vi.fn();

vi.mock('../../services/api', () => ({
  playboardAPI: {
    get: (...args) => mockPlayboardGet(...args),
  },
}));

vi.mock('../../services/v1_explorerApi', () => ({
  prevailAPI: {
    execute: (...args) => mockPrevailExecute(...args),
  },
}));

// Mock reportUtils
vi.mock('../../utils/v1_reportUtils', () => ({
  getColumnsFromData: (data) => {
    if (!data || data.length === 0) return [];
    return Object.keys(data[0]).map((key) => ({ key, label: key }));
  },
}));

// Track filter submit callback
let capturedFilterSubmit = null;

// Mock Breadcrumbs
vi.mock('../../components/explorer/v1_Breadcrumbs', () => ({
  default: ({ items }) => (
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
vi.mock('../../components/explorer/v1_FilterSection', () => ({
  default: ({ filterConfig, onSubmit, initialFilterValues }) => {
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
vi.mock('../../components/explorer/v1_DataTable', () => ({
  default: ({
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
vi.mock('../../components/explorer/v1_DescriptionRenderer', () => ({
  default: ({ description }) => (
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
    vi.clearAllMocks();
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
    mockPlayboardGet.mockReturnValue(new Promise(() => {})); // never resolves
    renderWithRoute();

    expect(screen.getByText('Loading filters...')).toBeInTheDocument();
  });

  it('shows loading spinner while report data is loading', async () => {
    mockPlayboardGet.mockResolvedValue(makePlayboardResponse());
    mockPrevailExecute.mockReturnValue(new Promise(() => {})); // never resolves

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
});
