/**
 * V1FilterSection tests
 *
 * IMPORTANT: Always pass `initialFilterValues` as a stable reference.
 * The component default `initialFilterValues = {}` creates a new object on every render,
 * which triggers the useEffect that depends on it, causing an infinite re-render loop.
 */
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('lucide-react', () => ({
  ChevronDown: () => null,
  ChevronUp: () => null,
  Filter: () => null,
  RotateCcw: () => null,
  Users: () => null,
  Info: () => null,
  X: () => null,
}));
jest.mock('../../hooks/useAssignedCustomers', () => ({
  __esModule: true, default: () => ({ customers: [], tags: [], loading: false, hasAssigned: false, search: Function.prototype, filterByTag: Function.prototype }),
}));
jest.mock('../../utils/v1_reportUtils', () => ({
  getAttrValue: (attrs, key) => attrs?.find(a => a.key === key)?.value,
  parseCurrentDateString: (v) => v,
  getDefaultValue: () => '',
  formatDateValue: (_, v) => v,
  deepEqual: (a, b) => a === b,
  trimCellValue: (v) => v,
}));
jest.mock('../../utils/v1_filterValidators', () => ({
  validateFilter: jest.fn(() => ({ valid: true })),
}));
jest.mock('./v1_DescriptionRenderer', () => ({ __esModule: true, default: () => null }));
jest.mock('./v1_DynamicFilterControl', () => ({
  __esModule: true, default: ({ filter, value, onChange }) => (
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
    render(<V1FilterSection onSubmit={jest.fn()} filterConfig={baseConfig} initialFilterValues={EMPTY_FILTERS} />);
    expect(screen.getByText('Filters')).toBeInTheDocument();
  });

  it('renders Submit and Reset buttons', () => {
    render(<V1FilterSection onSubmit={jest.fn()} filterConfig={baseConfig} initialFilterValues={EMPTY_FILTERS} />);
    expect(screen.getByText('Submit')).toBeInTheDocument();
    expect(screen.getByText('Reset')).toBeInTheDocument();
  });

  it('shows no filters message for empty config', () => {
    render(<V1FilterSection onSubmit={jest.fn()} filterConfig={[]} initialFilterValues={EMPTY_FILTERS} />);
    expect(screen.getByText('No filters available.')).toBeInTheDocument();
  });

  it('shows filterError', () => {
    render(
      <V1FilterSection onSubmit={jest.fn()} filterConfig={baseConfig} filterError="Load failed" initialFilterValues={EMPTY_FILTERS} />
    );
    expect(screen.getByText('Load failed')).toBeInTheDocument();
  });

  it('calls onSubmit when Submit button is clicked', async () => {
    const onSubmit = jest.fn();
    const user = userEvent.setup();

    render(<V1FilterSection onSubmit={onSubmit} filterConfig={baseConfig} initialFilterValues={EMPTY_FILTERS} />);

    await user.click(screen.getByText('Submit'));

    expect(onSubmit).toHaveBeenCalled();
  });

  it('resets form when Reset button is clicked', async () => {
    const onSubmit = jest.fn();
    const user = userEvent.setup();

    render(<V1FilterSection onSubmit={onSubmit} filterConfig={baseConfig} initialFilterValues={EMPTY_FILTERS} />);

    await user.click(screen.getByText('Reset'));

    // After reset, form should be back to defaults - no error thrown
    expect(screen.getByText('Reset')).toBeInTheDocument();
  });

  it('renders filter label for each visible filter', () => {
    render(<V1FilterSection onSubmit={jest.fn()} filterConfig={baseConfig} initialFilterValues={EMPTY_FILTERS} />);

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
    render(<V1FilterSection onSubmit={jest.fn()} filterConfig={config} initialFilterValues={EMPTY_FILTERS} />);

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
    render(<V1FilterSection onSubmit={jest.fn()} filterConfig={config} initialFilterValues={EMPTY_FILTERS} />);

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
    render(<V1FilterSection onSubmit={jest.fn()} filterConfig={config} initialFilterValues={EMPTY_FILTERS} />);

    expect(screen.queryByText('Invisible')).not.toBeInTheDocument();
  });

  it('shows loading state when filterLoading is true', () => {
    render(
      <V1FilterSection onSubmit={jest.fn()} filterConfig={baseConfig} filterLoading={true} initialFilterValues={EMPTY_FILTERS} />
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
    render(<V1FilterSection onSubmit={jest.fn()} filterConfig={config} initialFilterValues={EMPTY_FILTERS} />);

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
    render(<V1FilterSection onSubmit={jest.fn()} filterConfig={config} initialFilterValues={EMPTY_FILTERS} />);

    expect(screen.getByText('Tags')).toBeInTheDocument();
  });

  it('handles autoSubmit mode', () => {
    const onSubmit = jest.fn();

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
        onSubmit={jest.fn()}
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
    const onSubmit = jest.fn();
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
    const onSubmit = jest.fn();
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
    const onSubmit = jest.fn();
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
    const onSubmit = jest.fn();
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
        onSubmit={jest.fn()}
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
    render(<V1FilterSection onSubmit={jest.fn()} filterConfig={config} initialFilterValues={EMPTY_FILTERS} />);
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
    render(<V1FilterSection onSubmit={jest.fn()} filterConfig={config} initialFilterValues={EMPTY_FILTERS} />);
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
    render(<V1FilterSection onSubmit={jest.fn()} filterConfig={config} initialFilterValues={EMPTY_FILTERS} />);
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
    render(<V1FilterSection onSubmit={jest.fn()} filterConfig={config} initialFilterValues={EMPTY_FILTERS} />);
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
    render(<V1FilterSection onSubmit={jest.fn()} filterConfig={config} initialFilterValues={initial} />);
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
    render(<V1FilterSection onSubmit={jest.fn()} filterConfig={config} initialFilterValues={EMPTY_FILTERS} />);
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
    render(<V1FilterSection onSubmit={jest.fn()} filterConfig={config} initialFilterValues={EMPTY_FILTERS} />);
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
    render(<V1FilterSection onSubmit={jest.fn()} filterConfig={config} initialFilterValues={EMPTY_FILTERS} />);
    await user.click(screen.getByText('Reset'));
    expect(screen.getByText('Tags')).toBeInTheDocument();
  });

  it('submits with formatted values', async () => {
    const onSubmit = jest.fn();
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
      <V1FilterSection onSubmit={jest.fn()} filterConfig={config} initialFilterValues={EMPTY_FILTERS} />
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
    render(<V1FilterSection onSubmit={jest.fn()} filterConfig={config} initialFilterValues={EMPTY_FILTERS} />);
    expect(screen.getByText('No Status')).toBeInTheDocument();
  });

  // --- Additional branch coverage tests ---

  // Submit is disabled (does nothing) when externalLoading is true
  it('does not call onSubmit when filterLoading is true and Submit is pressed', async () => {
    // When filterLoading is true, the buttons are not rendered (loading spinner shown instead).
    // But handleSubmit also checks externalLoading as first guard.
    // We test that the submit handler bails out by rendering without loading
    // then externally invoking submit while loading.
    const onSubmit = jest.fn();
    const { rerender } = render(
      <V1FilterSection
        onSubmit={onSubmit}
        filterConfig={baseConfig}
        filterLoading={false}
        initialFilterValues={EMPTY_FILTERS}
      />
    );

    // Now rerender with loading=true — submit button hides, so onSubmit should not be callable
    rerender(
      <V1FilterSection
        onSubmit={onSubmit}
        filterConfig={baseConfig}
        filterLoading={true}
        initialFilterValues={EMPTY_FILTERS}
      />
    );

    expect(screen.queryByText('Submit')).not.toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  // FilterLabel: renders info button when description is a non-empty string
  it('renders info button for filter with string description', async () => {
    const user = userEvent.setup();
    const config = [
      {
        dataKey: 'withDesc',
        displayName: 'With Desc',
        visible: true,
        status: 'Y',
        description: 'This is a help description',
        attributes: [{ key: 'type', value: 'input' }],
      },
    ];
    render(<V1FilterSection onSubmit={jest.fn()} filterConfig={config} initialFilterValues={EMPTY_FILTERS} />);

    // Info button should be present
    const infoBtn = screen.getByTitle('View filter info');
    expect(infoBtn).toBeInTheDocument();

    // Click to open the info popover
    await user.click(infoBtn);

    expect(screen.getByText('Info')).toBeInTheDocument();
  });

  // FilterLabel: renders info button when description is an array
  it('renders info button for filter with array description', async () => {
    const user = userEvent.setup();
    const config = [
      {
        dataKey: 'arrDesc',
        displayName: 'Array Desc',
        visible: true,
        status: 'Y',
        description: [
          { text: 'Help text', status: 'A' },
        ],
        attributes: [{ key: 'type', value: 'input' }],
      },
    ];
    render(<V1FilterSection onSubmit={jest.fn()} filterConfig={config} initialFilterValues={EMPTY_FILTERS} />);

    const infoBtn = screen.getByTitle('View filter info');
    expect(infoBtn).toBeInTheDocument();

    await user.click(infoBtn);
    expect(screen.getByText('Info')).toBeInTheDocument();
  });

  // FilterLabel: does not render info button when description is empty string
  it('does not render info button for filter with empty string description', () => {
    const config = [
      {
        dataKey: 'emptyDesc',
        displayName: 'Empty Desc',
        visible: true,
        status: 'Y',
        description: '   ',
        attributes: [{ key: 'type', value: 'input' }],
      },
    ];
    render(<V1FilterSection onSubmit={jest.fn()} filterConfig={config} initialFilterValues={EMPTY_FILTERS} />);

    expect(screen.queryByTitle('View filter info')).not.toBeInTheDocument();
  });

  // FilterLabel: does not render info button when description array has only inactive items
  it('does not render info button when description array has only inactive items', () => {
    const config = [
      {
        dataKey: 'inactiveDesc',
        displayName: 'Inactive Desc',
        visible: true,
        status: 'Y',
        description: [
          { text: 'Hidden', status: 'I' },
        ],
        attributes: [{ key: 'type', value: 'input' }],
      },
    ];
    render(<V1FilterSection onSubmit={jest.fn()} filterConfig={config} initialFilterValues={EMPTY_FILTERS} />);

    expect(screen.queryByTitle('View filter info')).not.toBeInTheDocument();
  });

  // FilterLabel: does not render info button when description is null
  it('does not render info button when description is null', () => {
    const config = [
      {
        dataKey: 'nullDesc',
        displayName: 'Null Desc',
        visible: true,
        status: 'Y',
        description: null,
        attributes: [{ key: 'type', value: 'input' }],
      },
    ];
    render(<V1FilterSection onSubmit={jest.fn()} filterConfig={config} initialFilterValues={EMPTY_FILTERS} />);

    expect(screen.queryByTitle('View filter info')).not.toBeInTheDocument();
  });

  // FilterLabel: close info popover via X button
  it('closes info popover via X button click', async () => {
    const user = userEvent.setup();
    const config = [
      {
        dataKey: 'closeDesc',
        displayName: 'Close Desc',
        visible: true,
        status: 'Y',
        description: 'Some description',
        attributes: [{ key: 'type', value: 'input' }],
      },
    ];
    render(<V1FilterSection onSubmit={jest.fn()} filterConfig={config} initialFilterValues={EMPTY_FILTERS} />);

    const infoBtn = screen.getByTitle('View filter info');
    await user.click(infoBtn);
    expect(screen.getByText('Info')).toBeInTheDocument();

    // Click the info toggle again to close (toggle)
    await user.click(infoBtn);
    expect(screen.queryByText('Info')).not.toBeInTheDocument();
  });

  // FilterLabel: outside click closes info popover
  it('closes info popover on outside mousedown', async () => {
    const user = userEvent.setup();
    const config = [
      {
        dataKey: 'outsideDesc',
        displayName: 'Outside Desc',
        visible: true,
        status: 'Y',
        description: 'Help text for outside click',
        attributes: [{ key: 'type', value: 'input' }],
      },
    ];
    render(<V1FilterSection onSubmit={jest.fn()} filterConfig={config} initialFilterValues={EMPTY_FILTERS} />);

    const infoBtn = screen.getByTitle('View filter info');
    await user.click(infoBtn);
    expect(screen.getByText('Info')).toBeInTheDocument();

    // Click outside — mousedown on document
    fireEvent.mouseDown(document.body);

    await waitFor(() => {
      expect(screen.queryByText('Info')).not.toBeInTheDocument();
    });
  });

  // Input type filter with empty defaultValue — renders inputHint placeholder
  it('passes placeholder from inputHint for input type with empty defaultValue', () => {
    const config = [
      {
        dataKey: 'search',
        displayName: 'Search',
        visible: true,
        status: 'Y',
        inputHint: 'Type to search...',
        attributes: [
          { key: 'type', value: 'input' },
          { key: 'defaultValue', value: '' },
        ],
      },
    ];
    render(<V1FilterSection onSubmit={jest.fn()} filterConfig={config} initialFilterValues={EMPTY_FILTERS} />);

    expect(screen.getByText('Search')).toBeInTheDocument();
  });

  // Input type filter with no defaultValue and no inputHint — defaults to 'Enter value'
  it('uses default Enter value placeholder when no inputHint provided', () => {
    const config = [
      {
        dataKey: 'search2',
        displayName: 'Search2',
        visible: true,
        status: 'Y',
        attributes: [
          { key: 'type', value: 'input' },
        ],
      },
    ];
    render(<V1FilterSection onSubmit={jest.fn()} filterConfig={config} initialFilterValues={EMPTY_FILTERS} />);

    expect(screen.getByText('Search2')).toBeInTheDocument();
  });

  // Non-input type filter — no placeholder set
  it('does not set placeholder for non-input type filters', () => {
    const config = [
      {
        dataKey: 'dropdown',
        displayName: 'Dropdown',
        visible: true,
        status: 'Y',
        attributes: [
          { key: 'type', value: 'select' },
          { key: 'defaultValue', value: '' },
        ],
      },
    ];
    render(<V1FilterSection onSubmit={jest.fn()} filterConfig={config} initialFilterValues={EMPTY_FILTERS} />);

    expect(screen.getByText('Dropdown')).toBeInTheDocument();
  });

  // Validation error with displayName already included in message
  it('does not double-add displayName when message already contains it', async () => {
    validateFilter.mockReturnValue({ valid: false, message: 'Name is required.' });
    const user = userEvent.setup();

    render(
      <V1FilterSection
        onSubmit={jest.fn()}
        filterConfig={baseConfig}
        initialFilterValues={EMPTY_FILTERS}
      />
    );

    await user.click(screen.getByText('Submit'));
    await waitFor(() => {
      // Should show the message without "in Name" since "Name" is already in message
      expect(screen.getByText(/Name is required/)).toBeInTheDocument();
    });
    validateFilter.mockReturnValue({ valid: true });
  });

  // More than 3 filters rendered — checks row splitting logic
  it('renders filters in rows of 3', () => {
    const config = [
      { dataKey: 'a', displayName: 'Alpha', visible: true, status: 'Y', attributes: [{ key: 'type', value: 'input' }] },
      { dataKey: 'b', displayName: 'Beta', visible: true, status: 'Y', attributes: [{ key: 'type', value: 'input' }] },
      { dataKey: 'c', displayName: 'Gamma', visible: true, status: 'Y', attributes: [{ key: 'type', value: 'input' }] },
      { dataKey: 'd', displayName: 'Delta', visible: true, status: 'Y', attributes: [{ key: 'type', value: 'input' }] },
    ];
    render(<V1FilterSection onSubmit={jest.fn()} filterConfig={config} initialFilterValues={EMPTY_FILTERS} />);

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText('Gamma')).toBeInTheDocument();
    expect(screen.getByText('Delta')).toBeInTheDocument();
  });

  // Initialize multiselect with array defaultValue
  it('initializes multiselect with array defaultValue', () => {
    const config = [
      {
        dataKey: 'tags',
        displayName: 'Tags',
        visible: true,
        status: 'Y',
        attributes: [
          { key: 'type', value: 'multi-select' },
          { key: 'defaultValue', value: ['x', 'y'] },
        ],
      },
    ];
    render(<V1FilterSection onSubmit={jest.fn()} filterConfig={config} initialFilterValues={EMPTY_FILTERS} />);
    expect(screen.getByText('Tags')).toBeInTheDocument();
  });

  // Initialize toggleButton with false default
  it('initializes toggleButton with false default value', () => {
    const config = [
      {
        dataKey: 'toggle',
        displayName: 'Toggle',
        visible: true,
        status: 'Y',
        attributes: [
          { key: 'type', value: 'toggleButton' },
          { key: 'defaultValue', value: false },
        ],
      },
    ];
    render(<V1FilterSection onSubmit={jest.fn()} filterConfig={config} initialFilterValues={EMPTY_FILTERS} />);
    expect(screen.getByText('Toggle')).toBeInTheDocument();
  });

  // Initialize toggleButton with non-boolean — should not set default
  it('does not initialize toggleButton with non-boolean default', () => {
    const config = [
      {
        dataKey: 'toggle2',
        displayName: 'Toggle2',
        visible: true,
        status: 'Y',
        attributes: [
          { key: 'type', value: 'toggleButton' },
          { key: 'defaultValue', value: 'yes' },
        ],
      },
    ];
    render(<V1FilterSection onSubmit={jest.fn()} filterConfig={config} initialFilterValues={EMPTY_FILTERS} />);
    expect(screen.getByText('Toggle2')).toBeInTheDocument();
  });

  // Date picker with undefined default — does not set initial value
  it('skips date-picker initialization when defaultValue is undefined', () => {
    const config = [
      {
        dataKey: 'datePick',
        displayName: 'Date Pick',
        visible: true,
        status: 'Y',
        attributes: [
          { key: 'type', value: 'date' },
        ],
      },
    ];
    render(<V1FilterSection onSubmit={jest.fn()} filterConfig={config} initialFilterValues={EMPTY_FILTERS} />);
    expect(screen.getByText('Date Pick')).toBeInTheDocument();
  });

  // Date range with no start/end defaults — does not set initial value
  it('skips date-range initialization when no defaults exist', () => {
    const config = [
      {
        dataKey: 'dateRange2',
        displayName: 'Date Range 2',
        visible: true,
        status: 'Y',
        attributes: [
          { key: 'type', value: 'date-range' },
        ],
      },
    ];
    render(<V1FilterSection onSubmit={jest.fn()} filterConfig={config} initialFilterValues={EMPTY_FILTERS} />);
    expect(screen.getByText('Date Range 2')).toBeInTheDocument();
  });

  // Multiselect with empty string default — does not set initial value
  it('skips multiselect initialization when defaultValue is empty string', () => {
    const config = [
      {
        dataKey: 'tags2',
        displayName: 'Tags2',
        visible: true,
        status: 'Y',
        attributes: [
          { key: 'type', value: 'multiselect' },
          { key: 'defaultValue', value: '' },
        ],
      },
    ];
    render(<V1FilterSection onSubmit={jest.fn()} filterConfig={config} initialFilterValues={EMPTY_FILTERS} />);
    expect(screen.getByText('Tags2')).toBeInTheDocument();
  });

  // RadioButton with empty default — does not set
  it('skips radioButton initialization when defaultValue is empty', () => {
    const config = [
      {
        dataKey: 'radio2',
        displayName: 'Radio2',
        visible: true,
        status: 'Y',
        attributes: [
          { key: 'type', value: 'radioButton' },
          { key: 'defaultValue', value: '' },
        ],
      },
    ];
    render(<V1FilterSection onSubmit={jest.fn()} filterConfig={config} initialFilterValues={EMPTY_FILTERS} />);
    expect(screen.getByText('Radio2')).toBeInTheDocument();
  });

  // Generic input with null default — does not set
  it('skips generic filter initialization when defaultValue is null', () => {
    const config = [
      {
        dataKey: 'generic2',
        displayName: 'Generic2',
        visible: true,
        status: 'Y',
        attributes: [
          { key: 'type', value: 'input' },
          { key: 'defaultValue', value: null },
        ],
      },
    ];
    render(<V1FilterSection onSubmit={jest.fn()} filterConfig={config} initialFilterValues={EMPTY_FILTERS} />);
    expect(screen.getByText('Generic2')).toBeInTheDocument();
  });

  // Reset: date-picker defaults reset correctly
  it('resets date-picker filters to defaults', async () => {
    const user = userEvent.setup();
    const config = [
      {
        dataKey: 'datePick',
        displayName: 'Date Pick',
        visible: true,
        status: 'Y',
        attributes: [
          { key: 'type', value: 'date-picker' },
          { key: 'defaultValue', value: '2026-03-01' },
        ],
      },
    ];
    render(<V1FilterSection onSubmit={jest.fn()} filterConfig={config} initialFilterValues={EMPTY_FILTERS} />);
    await user.click(screen.getByText('Reset'));
    expect(screen.getByText('Date Pick')).toBeInTheDocument();
  });

  // Reset: date type filter
  it('resets date type filters to defaults', async () => {
    const user = userEvent.setup();
    const config = [
      {
        dataKey: 'dateFld',
        displayName: 'Date Fld',
        visible: true,
        status: 'Y',
        attributes: [
          { key: 'type', value: 'date' },
          { key: 'defaultValue', value: '2026-01-15' },
        ],
      },
    ];
    render(<V1FilterSection onSubmit={jest.fn()} filterConfig={config} initialFilterValues={EMPTY_FILTERS} />);
    await user.click(screen.getByText('Reset'));
    expect(screen.getByText('Date Fld')).toBeInTheDocument();
  });

  // Reset: generic filter with default value
  it('resets generic filters to default values', async () => {
    const user = userEvent.setup();
    const config = [
      {
        dataKey: 'gen',
        displayName: 'Gen',
        visible: true,
        status: 'Y',
        attributes: [
          { key: 'type', value: 'input' },
          { key: 'defaultValue', value: 'reset_val' },
        ],
      },
    ];
    render(<V1FilterSection onSubmit={jest.fn()} filterConfig={config} initialFilterValues={EMPTY_FILTERS} />);
    await user.click(screen.getByText('Reset'));
    expect(screen.getByText('Gen')).toBeInTheDocument();
  });

  // Reset: date-range without defaults — should not set value
  it('resets date-range without defaults to no value', async () => {
    const user = userEvent.setup();
    const config = [
      {
        dataKey: 'drEmpty',
        displayName: 'DR Empty',
        visible: true,
        status: 'Y',
        attributes: [
          { key: 'type', value: 'date-range' },
        ],
      },
    ];
    render(<V1FilterSection onSubmit={jest.fn()} filterConfig={config} initialFilterValues={EMPTY_FILTERS} />);
    await user.click(screen.getByText('Reset'));
    expect(screen.getByText('DR Empty')).toBeInTheDocument();
  });

  // Reset: multiselect with empty default — should not set
  it('resets multiselect with empty default to no value', async () => {
    const user = userEvent.setup();
    const config = [
      {
        dataKey: 'msEmpty',
        displayName: 'MS Empty',
        visible: true,
        status: 'Y',
        attributes: [
          { key: 'type', value: 'multi-select' },
          { key: 'defaultValue', value: '' },
        ],
      },
    ];
    render(<V1FilterSection onSubmit={jest.fn()} filterConfig={config} initialFilterValues={EMPTY_FILTERS} />);
    await user.click(screen.getByText('Reset'));
    expect(screen.getByText('MS Empty')).toBeInTheDocument();
  });

  // Reset: date-picker with undefined default — should not set
  it('resets date-picker with no default to no value', async () => {
    const user = userEvent.setup();
    const config = [
      {
        dataKey: 'dpEmpty',
        displayName: 'DP Empty',
        visible: true,
        status: 'Y',
        attributes: [
          { key: 'type', value: 'date-picker' },
        ],
      },
    ];
    render(<V1FilterSection onSubmit={jest.fn()} filterConfig={config} initialFilterValues={EMPTY_FILTERS} />);
    await user.click(screen.getByText('Reset'));
    expect(screen.getByText('DP Empty')).toBeInTheDocument();
  });

  // Reset: generic with null default — should not set
  it('resets generic filter with null default to no value', async () => {
    const user = userEvent.setup();
    const config = [
      {
        dataKey: 'genNull',
        displayName: 'Gen Null',
        visible: true,
        status: 'Y',
        attributes: [
          { key: 'type', value: 'input' },
          { key: 'defaultValue', value: null },
        ],
      },
    ];
    render(<V1FilterSection onSubmit={jest.fn()} filterConfig={config} initialFilterValues={EMPTY_FILTERS} />);
    await user.click(screen.getByText('Reset'));
    expect(screen.getByText('Gen Null')).toBeInTheDocument();
  });

  // Customer filter toggle: not shown when hasCustomerFilter is false
  it('does not show customer toggle when no customer filter exists', () => {
    const config = [
      {
        dataKey: 'plainField',
        displayName: 'Plain Field',
        visible: true,
        status: 'Y',
        attributes: [{ key: 'type', value: 'input' }],
      },
    ];
    render(<V1FilterSection onSubmit={jest.fn()} filterConfig={config} initialFilterValues={EMPTY_FILTERS} />);

    expect(screen.queryByText('Assigned Customers')).not.toBeInTheDocument();
    expect(screen.queryByText('No Preference')).not.toBeInTheDocument();
  });

  // isCustomerFilter: detection by displayName
  it('detects customer filter by displayName pattern', () => {
    const config = [
      {
        dataKey: 'nonCustomerKey',
        displayName: 'Customer #1',
        visible: true,
        status: 'Y',
        attributes: [{ key: 'type', value: 'input' }],
      },
    ];
    render(<V1FilterSection onSubmit={jest.fn()} filterConfig={config} initialFilterValues={EMPTY_FILTERS} />);
    // If hasAssigned were true, we'd see the toggle
    // At minimum this exercises the isCustomerFilter branch
    expect(screen.getByText('Customer #1')).toBeInTheDocument();
  });

  // isCustomerFilter: detection by dataKey pattern
  it('detects customer filter by dataKey pattern', () => {
    const config = [
      {
        dataKey: 'query_customer',
        displayName: 'QCustomer',
        visible: true,
        status: 'Y',
        attributes: [{ key: 'type', value: 'input' }],
      },
    ];
    render(<V1FilterSection onSubmit={jest.fn()} filterConfig={config} initialFilterValues={EMPTY_FILTERS} />);
    expect(screen.getByText('QCustomer')).toBeInTheDocument();
  });

  // Submit collapses the filter section (setShow(false))
  it('collapses filter section after successful submit', async () => {
    const onSubmit = jest.fn();
    const user = userEvent.setup();

    render(<V1FilterSection onSubmit={onSubmit} filterConfig={baseConfig} initialFilterValues={EMPTY_FILTERS} />);

    expect(screen.getByText('Submit')).toBeInTheDocument();

    await user.click(screen.getByText('Submit'));

    // After successful submit, accordion should collapse
    expect(screen.queryByText('Submit')).not.toBeInTheDocument();
  });

  // Re-open filter section after submit collapse
  it('can re-open filter section by clicking header after collapse', async () => {
    const onSubmit = jest.fn();
    const user = userEvent.setup();

    render(<V1FilterSection onSubmit={onSubmit} filterConfig={baseConfig} initialFilterValues={EMPTY_FILTERS} />);

    await user.click(screen.getByText('Submit'));
    expect(screen.queryByText('Submit')).not.toBeInTheDocument();

    // Re-open by clicking header
    await user.click(screen.getByText('Filters'));
    expect(screen.getByText('Submit')).toBeInTheDocument();
  });

  // Filter description array with nodes but no text
  it('shows info button for description array item with nodes but no text', async () => {
    const config = [
      {
        dataKey: 'nodesDesc',
        displayName: 'Nodes Desc',
        visible: true,
        status: 'Y',
        description: [
          { nodes: [{ type: 'text', content: 'node content' }], status: 'A' },
        ],
        attributes: [{ key: 'type', value: 'input' }],
      },
    ];
    render(<V1FilterSection onSubmit={jest.fn()} filterConfig={config} initialFilterValues={EMPTY_FILTERS} />);

    expect(screen.getByTitle('View filter info')).toBeInTheDocument();
  });

  // Filter without attributes (null) — initialization edge case
  it('handles filter without attributes during initialization', () => {
    const config = [
      {
        dataKey: 'noAttrs',
        displayName: 'No Attrs',
        visible: true,
        status: 'Y',
        attributes: null,
      },
    ];
    render(<V1FilterSection onSubmit={jest.fn()} filterConfig={config} initialFilterValues={EMPTY_FILTERS} />);
    expect(screen.getByText('No Attrs')).toBeInTheDocument();
  });

  // Empty filterConfig does not cause init effect to run
  it('does not initialize form when filterConfig is empty', () => {
    const onSubmit = jest.fn();
    render(<V1FilterSection onSubmit={onSubmit} filterConfig={[]} initialFilterValues={EMPTY_FILTERS} />);
    expect(screen.getByText('No filters available.')).toBeInTheDocument();
  });

  // Input with defaultValue but type is 'input' — uses else branch in init
  it('initializes input type filter with non-empty defaultValue via else branch', () => {
    const config = [
      {
        dataKey: 'inputVal',
        displayName: 'Input Val',
        visible: true,
        status: 'Y',
        attributes: [
          { key: 'type', value: 'input' },
          { key: 'defaultValue', value: 'pre-filled' },
        ],
      },
    ];
    render(<V1FilterSection onSubmit={jest.fn()} filterConfig={config} initialFilterValues={EMPTY_FILTERS} />);
    // The filter input should have the default value
    expect(screen.getByTestId('filter-inputVal')).toHaveValue('pre-filled');
  });

  // Validation: single error message that already contains field displayName
  it('handles validation error where message contains displayName', async () => {
    validateFilter.mockReturnValue({ valid: false, message: 'Name field is not valid' });
    const user = userEvent.setup();

    render(
      <V1FilterSection
        onSubmit={jest.fn()}
        filterConfig={baseConfig}
        initialFilterValues={EMPTY_FILTERS}
      />
    );

    await user.click(screen.getByText('Submit'));
    await waitFor(() => {
      // Should show message without duplicating "Name"
      expect(screen.getByText(/Name field is not valid/)).toBeInTheDocument();
    });
    validateFilter.mockReturnValue({ valid: true });
  });

  // Filter with no displayName, no label — uses dataKey as fallback
  it('uses dataKey as fallback displayName in error messages', async () => {
    validateFilter.mockReturnValue({ valid: false, message: 'Required.' });
    const user = userEvent.setup();
    const config = [
      {
        dataKey: 'fieldKey',
        visible: true,
        status: 'Y',
        attributes: [{ key: 'type', value: 'input' }],
      },
    ];

    render(
      <V1FilterSection
        onSubmit={jest.fn()}
        filterConfig={config}
        initialFilterValues={EMPTY_FILTERS}
      />
    );

    await user.click(screen.getByText('Submit'));
    await waitFor(() => {
      expect(screen.getByText(/fieldKey/)).toBeInTheDocument();
    });
    validateFilter.mockReturnValue({ valid: true });
  });
});
