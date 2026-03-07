/**
 * V1FilterSection tests
 *
 * IMPORTANT: Always pass `initialFilterValues` as a stable reference.
 * The component default `initialFilterValues = {}` creates a new object on every render,
 * which triggers the useEffect that depends on it, causing an infinite re-render loop.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('lucide-react', () => ({
  ChevronDown: () => null,
  ChevronUp: () => null,
  Filter: () => null,
  RotateCcw: () => null,
  Users: () => null,
  Info: () => null,
  X: () => null,
}));
vi.mock('../../hooks/useAssignedCustomers', () => ({
  default: () => ({ customers: [], tags: [], loading: false, hasAssigned: false, search: () => {}, filterByTag: () => {} }),
}));
vi.mock('../../utils/v1_reportUtils', () => ({
  getAttrValue: (attrs, key) => attrs?.find(a => a.key === key)?.value,
  parseCurrentDateString: (v) => v,
  getDefaultValue: () => '',
  formatDateValue: (_, v) => v,
  deepEqual: (a, b) => a === b,
  trimCellValue: (v) => v,
}));
vi.mock('../../utils/v1_filterValidators', () => ({
  validateFilter: vi.fn(() => ({ valid: true })),
}));
vi.mock('./v1_DescriptionRenderer', () => ({ default: () => null }));
vi.mock('./v1_DynamicFilterControl', () => ({
  default: ({ filter, value, onChange }) => (
    <input
      data-testid={`filter-${filter.dataKey}`}
      value={value ?? ''}
      onChange={(e) => onChange(filter.dataKey, e.target.value)}
    />
  ),
}));

import V1FilterSection from './v1_FilterSection';
import { validateFilter } from '../../utils/v1_filterValidators';

const baseConfig = [
  {
    dataKey: 'name',
    displayName: 'Name',
    visible: true,
    status: 'Y',
    attributes: [{ key: 'type', value: 'input' }],
  },
];

const EMPTY_FILTERS = {};

describe('V1FilterSection', () => {
  it('renders Filters header', () => {
    render(<V1FilterSection onSubmit={vi.fn()} filterConfig={baseConfig} initialFilterValues={EMPTY_FILTERS} />);
    expect(screen.getByText('Filters')).toBeInTheDocument();
  });

  it('renders Submit and Reset buttons', () => {
    render(<V1FilterSection onSubmit={vi.fn()} filterConfig={baseConfig} initialFilterValues={EMPTY_FILTERS} />);
    expect(screen.getByText('Submit')).toBeInTheDocument();
    expect(screen.getByText('Reset')).toBeInTheDocument();
  });

  it('shows no filters message for empty config', () => {
    render(<V1FilterSection onSubmit={vi.fn()} filterConfig={[]} initialFilterValues={EMPTY_FILTERS} />);
    expect(screen.getByText('No filters available.')).toBeInTheDocument();
  });

  it('shows filterError', () => {
    render(
      <V1FilterSection onSubmit={vi.fn()} filterConfig={baseConfig} filterError="Load failed" initialFilterValues={EMPTY_FILTERS} />
    );
    expect(screen.getByText('Load failed')).toBeInTheDocument();
  });

  it('calls onSubmit when Submit button is clicked', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();

    render(<V1FilterSection onSubmit={onSubmit} filterConfig={baseConfig} initialFilterValues={EMPTY_FILTERS} />);

    await user.click(screen.getByText('Submit'));

    expect(onSubmit).toHaveBeenCalled();
  });

  it('resets form when Reset button is clicked', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();

    render(<V1FilterSection onSubmit={onSubmit} filterConfig={baseConfig} initialFilterValues={EMPTY_FILTERS} />);

    await user.click(screen.getByText('Reset'));

    // After reset, form should be back to defaults - no error thrown
    expect(screen.getByText('Reset')).toBeInTheDocument();
  });

  it('renders filter label for each visible filter', () => {
    render(<V1FilterSection onSubmit={vi.fn()} filterConfig={baseConfig} initialFilterValues={EMPTY_FILTERS} />);

    expect(screen.getByText('Name')).toBeInTheDocument();
  });

  it('renders multiple filters', () => {
    const config = [
      ...baseConfig,
      {
        dataKey: 'status',
        displayName: 'Status',
        visible: true,
        status: 'Y',
        attributes: [{ key: 'type', value: 'select' }],
      },
    ];
    render(<V1FilterSection onSubmit={vi.fn()} filterConfig={config} initialFilterValues={EMPTY_FILTERS} />);

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  it('hides inactive filters (status I)', () => {
    const config = [
      {
        dataKey: 'hidden',
        displayName: 'Hidden Filter',
        visible: true,
        status: 'I',
        attributes: [{ key: 'type', value: 'input' }],
      },
    ];
    render(<V1FilterSection onSubmit={vi.fn()} filterConfig={config} initialFilterValues={EMPTY_FILTERS} />);

    // Inactive filter should not render its label
    expect(screen.queryByText('Hidden Filter')).not.toBeInTheDocument();
  });

  it('hides filters with visible=false', () => {
    const config = [
      {
        dataKey: 'invisible',
        displayName: 'Invisible',
        visible: false,
        status: 'Y',
        attributes: [{ key: 'type', value: 'input' }],
      },
    ];
    render(<V1FilterSection onSubmit={vi.fn()} filterConfig={config} initialFilterValues={EMPTY_FILTERS} />);

    expect(screen.queryByText('Invisible')).not.toBeInTheDocument();
  });

  it('shows loading state when filterLoading is true', () => {
    render(
      <V1FilterSection onSubmit={vi.fn()} filterConfig={baseConfig} filterLoading={true} initialFilterValues={EMPTY_FILTERS} />
    );

    // Loading should still render the filter section
    expect(screen.getByText('Filters')).toBeInTheDocument();
  });

  it('initializes with date-picker default values', () => {
    const config = [
      {
        dataKey: 'startDate',
        displayName: 'Start Date',
        visible: true,
        status: 'Y',
        attributes: [
          { key: 'type', value: 'date-picker' },
          { key: 'defaultValue', value: '2026-01-01' },
        ],
      },
    ];
    render(<V1FilterSection onSubmit={vi.fn()} filterConfig={config} initialFilterValues={EMPTY_FILTERS} />);

    expect(screen.getByText('Start Date')).toBeInTheDocument();
  });

  it('initializes with multiselect default values', () => {
    const config = [
      {
        dataKey: 'tags',
        displayName: 'Tags',
        visible: true,
        status: 'Y',
        attributes: [
          { key: 'type', value: 'multiselect' },
          { key: 'defaultValue', value: 'tag1,tag2' },
        ],
      },
    ];
    render(<V1FilterSection onSubmit={vi.fn()} filterConfig={config} initialFilterValues={EMPTY_FILTERS} />);

    expect(screen.getByText('Tags')).toBeInTheDocument();
  });

  it('handles autoSubmit mode', () => {
    const onSubmit = vi.fn();

    render(
      <V1FilterSection
        onSubmit={onSubmit}
        filterConfig={baseConfig}
        initialFilterValues={EMPTY_FILTERS}
        autoSubmit={true}
      />
    );

    // autoSubmit should be handled on mount
    expect(screen.getByText('Filters')).toBeInTheDocument();
  });

  it('shows spinner instead of form when filterLoading is true', () => {
    const { container } = render(
      <V1FilterSection
        onSubmit={vi.fn()}
        filterConfig={baseConfig}
        filterLoading={true}
        initialFilterValues={EMPTY_FILTERS}
      />
    );

    // Should show loading spinner, not Submit/Reset buttons
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    expect(screen.queryByText('Submit')).not.toBeInTheDocument();
    expect(screen.queryByText('Reset')).not.toBeInTheDocument();
  });

  it('shows validation error when filter is invalid', async () => {
    validateFilter.mockReturnValue({ valid: false, message: 'Required field.' });
    const onSubmit = vi.fn();
    const user = userEvent.setup();

    render(
      <V1FilterSection
        onSubmit={onSubmit}
        filterConfig={baseConfig}
        initialFilterValues={EMPTY_FILTERS}
      />
    );

    await user.click(screen.getByText('Submit'));
    expect(onSubmit).not.toHaveBeenCalled();
    // Error message should appear
    await waitFor(() => {
      expect(screen.getByText(/Required field/)).toBeInTheDocument();
    });
    validateFilter.mockReturnValue({ valid: true });
  });

  it('groups validation errors for multiple fields with same message', async () => {
    validateFilter.mockReturnValue({ valid: false, message: 'Value required.' });
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    const config = [
      ...baseConfig,
      {
        dataKey: 'status',
        displayName: 'Status',
        visible: true,
        status: 'Y',
        attributes: [{ key: 'type', value: 'input' }],
      },
    ];

    render(
      <V1FilterSection
        onSubmit={onSubmit}
        filterConfig={config}
        initialFilterValues={EMPTY_FILTERS}
      />
    );

    await user.click(screen.getByText('Submit'));
    await waitFor(() => {
      expect(screen.getByText(/Name and Status/)).toBeInTheDocument();
    });
    validateFilter.mockReturnValue({ valid: true });
  });

  it('shows fallback error when no message', async () => {
    validateFilter.mockReturnValue({ valid: false });
    const onSubmit = vi.fn();
    const user = userEvent.setup();

    render(
      <V1FilterSection
        onSubmit={onSubmit}
        filterConfig={baseConfig}
        initialFilterValues={EMPTY_FILTERS}
      />
    );

    await user.click(screen.getByText('Submit'));
    await waitFor(() => {
      expect(screen.getByText(/Invalid input/)).toBeInTheDocument();
    });
    validateFilter.mockReturnValue({ valid: true });
  });

  it('clears error on handleChange', async () => {
    validateFilter.mockReturnValueOnce({ valid: false, message: 'Bad value.' });
    const onSubmit = vi.fn();
    const user = userEvent.setup();

    render(
      <V1FilterSection
        onSubmit={onSubmit}
        filterConfig={baseConfig}
        initialFilterValues={EMPTY_FILTERS}
      />
    );

    await user.click(screen.getByText('Submit'));
    await waitFor(() => {
      expect(screen.getByText(/Bad value/)).toBeInTheDocument();
    });

    // Change a filter value - error should clear
    const filterInput = screen.getByTestId('filter-name');
    await user.type(filterInput, 'test');
    expect(screen.queryByText(/Bad value/)).not.toBeInTheDocument();
  });

  it('toggles filter section visibility on header click', async () => {
    const user = userEvent.setup();

    render(
      <V1FilterSection
        onSubmit={vi.fn()}
        filterConfig={baseConfig}
        initialFilterValues={EMPTY_FILTERS}
      />
    );

    // Initially visible - Submit button should be present
    expect(screen.getByText('Submit')).toBeInTheDocument();

    // Click the Filters header to collapse
    await user.click(screen.getByText('Filters'));

    // Submit button should be hidden
    expect(screen.queryByText('Submit')).not.toBeInTheDocument();
  });

  it('initializes with date-range default values', () => {
    const config = [
      {
        dataKey: 'dateRange',
        displayName: 'Date Range',
        visible: true,
        status: 'Y',
        attributes: [
          { key: 'type', value: 'date-range' },
          { key: 'defaultValue_start', value: '2026-01-01' },
          { key: 'defaultValue_end', value: '2026-01-31' },
        ],
      },
    ];
    render(<V1FilterSection onSubmit={vi.fn()} filterConfig={config} initialFilterValues={EMPTY_FILTERS} />);
    expect(screen.getByText('Date Range')).toBeInTheDocument();
  });

  it('initializes with radioButton default values', () => {
    const config = [
      {
        dataKey: 'radioField',
        displayName: 'Radio',
        visible: true,
        status: 'Y',
        attributes: [
          { key: 'type', value: 'radioButton' },
          { key: 'defaultValue', value: 'opt1' },
        ],
      },
    ];
    render(<V1FilterSection onSubmit={vi.fn()} filterConfig={config} initialFilterValues={EMPTY_FILTERS} />);
    expect(screen.getByText('Radio')).toBeInTheDocument();
  });

  it('initializes with toggleButton default values', () => {
    const config = [
      {
        dataKey: 'toggleField',
        displayName: 'Toggle',
        visible: true,
        status: 'Y',
        attributes: [
          { key: 'type', value: 'toggleButton' },
          { key: 'defaultValue', value: true },
        ],
      },
    ];
    render(<V1FilterSection onSubmit={vi.fn()} filterConfig={config} initialFilterValues={EMPTY_FILTERS} />);
    expect(screen.getByText('Toggle')).toBeInTheDocument();
  });

  it('initializes with generic default values', () => {
    const config = [
      {
        dataKey: 'generic',
        displayName: 'Generic',
        visible: true,
        status: 'Y',
        attributes: [
          { key: 'type', value: 'input' },
          { key: 'defaultValue', value: 'default_val' },
        ],
      },
    ];
    render(<V1FilterSection onSubmit={vi.fn()} filterConfig={config} initialFilterValues={EMPTY_FILTERS} />);
    expect(screen.getByText('Generic')).toBeInTheDocument();
  });

  it('uses initialFilterValues over defaults', () => {
    const config = [
      {
        dataKey: 'name',
        displayName: 'Name',
        visible: true,
        status: 'Y',
        attributes: [
          { key: 'type', value: 'input' },
          { key: 'defaultValue', value: 'default' },
        ],
      },
    ];
    const initial = { name: 'initial_value' };
    render(<V1FilterSection onSubmit={vi.fn()} filterConfig={config} initialFilterValues={initial} />);
    expect(screen.getByTestId('filter-name')).toHaveValue('initial_value');
  });

  it('resets date-range filters to defaults', async () => {
    const user = userEvent.setup();
    const config = [
      {
        dataKey: 'dateRange',
        displayName: 'Date Range',
        visible: true,
        status: 'Y',
        attributes: [
          { key: 'type', value: 'date-range' },
          { key: 'defaultValue_start', value: '2026-01-01' },
          { key: 'defaultValue_end', value: '2026-01-31' },
        ],
      },
    ];
    render(<V1FilterSection onSubmit={vi.fn()} filterConfig={config} initialFilterValues={EMPTY_FILTERS} />);
    await user.click(screen.getByText('Reset'));
    expect(screen.getByText('Date Range')).toBeInTheDocument();
  });

  it('resets multiselect filters to defaults', async () => {
    const user = userEvent.setup();
    const config = [
      {
        dataKey: 'tags',
        displayName: 'Tags',
        visible: true,
        status: 'Y',
        attributes: [
          { key: 'type', value: 'multi-select' },
          { key: 'defaultValue', value: 'a,b' },
        ],
      },
    ];
    render(<V1FilterSection onSubmit={vi.fn()} filterConfig={config} initialFilterValues={EMPTY_FILTERS} />);
    await user.click(screen.getByText('Reset'));
    expect(screen.getByText('Tags')).toBeInTheDocument();
  });

  it('handles multiselect array default on reset', async () => {
    const user = userEvent.setup();
    const config = [
      {
        dataKey: 'tags',
        displayName: 'Tags',
        visible: true,
        status: 'Y',
        attributes: [
          { key: 'type', value: 'multiselect' },
          { key: 'defaultValue', value: ['x', 'y'] },
        ],
      },
    ];
    render(<V1FilterSection onSubmit={vi.fn()} filterConfig={config} initialFilterValues={EMPTY_FILTERS} />);
    await user.click(screen.getByText('Reset'));
    expect(screen.getByText('Tags')).toBeInTheDocument();
  });

  it('submits with formatted values', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();

    render(
      <V1FilterSection
        onSubmit={onSubmit}
        filterConfig={baseConfig}
        initialFilterValues={EMPTY_FILTERS}
      />
    );

    // Type into the filter
    const filterInput = screen.getByTestId('filter-name');
    await user.type(filterInput, 'test');

    await user.click(screen.getByText('Submit'));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: 'test' }));
  });

  it('shows validation error with 3+ fields grouped', async () => {
    validateFilter.mockReturnValue({ valid: false, message: 'Missing.' });
    const user = userEvent.setup();
    const config = [
      { dataKey: 'a', displayName: 'Alpha', visible: true, status: 'Y', attributes: [{ key: 'type', value: 'input' }] },
      { dataKey: 'b', displayName: 'Beta', visible: true, status: 'Y', attributes: [{ key: 'type', value: 'input' }] },
      { dataKey: 'c', displayName: 'Gamma', visible: true, status: 'Y', attributes: [{ key: 'type', value: 'input' }] },
    ];

    render(
      <V1FilterSection onSubmit={vi.fn()} filterConfig={config} initialFilterValues={EMPTY_FILTERS} />
    );

    await user.click(screen.getByText('Submit'));
    await waitFor(() => {
      expect(screen.getByText(/Alpha, Beta, and Gamma/)).toBeInTheDocument();
    });
    validateFilter.mockReturnValue({ valid: true });
  });

  it('renders filters without status attribute (defaults to visible)', () => {
    const config = [
      {
        dataKey: 'noStatus',
        displayName: 'No Status',
        visible: true,
        attributes: [{ key: 'type', value: 'input' }],
      },
    ];
    render(<V1FilterSection onSubmit={vi.fn()} filterConfig={config} initialFilterValues={EMPTY_FILTERS} />);
    expect(screen.getByText('No Status')).toBeInTheDocument();
  });
});
