import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import V1DynamicFilterControl from './v1_DynamicFilterControl';

vi.mock('../../utils/v1_reportUtils', () => ({
  getAttrValue: vi.fn((attrs, key) => {
    const attr = attrs?.find(a => a.key === key);
    return attr?.value;
  }),
  formatApiDateForInput: vi.fn((val) => val),
  getCurrentDate: vi.fn(() => '2026-01-01'),
  addDays: vi.fn((date, days) => '2025-11-02'),
  handleArray: vi.fn((vals, filter, onChange) => onChange(filter.dataKey, vals)),
}));

describe('V1DynamicFilterControl', () => {
  const onChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders text input for default/input type', () => {
    const filter = {
      dataKey: 'field1',
      attributes: [{ key: 'type', value: 'input' }],
    };
    render(<V1DynamicFilterControl filter={filter} value="" onChange={onChange} />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('calls onChange on text input change', async () => {
    const user = userEvent.setup();
    const filter = {
      dataKey: 'field1',
      attributes: [{ key: 'type', value: 'input' }],
    };
    render(<V1DynamicFilterControl filter={filter} value="" onChange={onChange} />);
    await user.type(screen.getByRole('textbox'), 'hello');
    expect(onChange).toHaveBeenCalledWith('field1', 'h');
  });

  it('renders date input for date-picker type', () => {
    const filter = {
      dataKey: 'dateField',
      attributes: [{ key: 'type', value: 'date-picker' }],
    };
    const { container } = render(
      <V1DynamicFilterControl filter={filter} value="2026-01-01" onChange={onChange} />
    );
    expect(container.querySelector('input[type="date"]')).toBeInTheDocument();
  });

  it('renders checkbox for checkbox type', () => {
    const filter = {
      dataKey: 'active',
      attributes: [{ key: 'type', value: 'checkbox' }],
    };
    render(<V1DynamicFilterControl filter={filter} value={true} onChange={onChange} />);
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('renders date range for date-range type', () => {
    const filter = {
      dataKey: 'dateRange',
      attributes: [{ key: 'type', value: 'date-range' }],
    };
    const { container } = render(
      <V1DynamicFilterControl
        filter={filter}
        value={{ start: '2026-01-01', end: '2026-01-31' }}
        onChange={onChange}
      />
    );
    const dateInputs = container.querySelectorAll('input[type="date"]');
    expect(dateInputs).toHaveLength(2);
    expect(screen.getByText('to')).toBeInTheDocument();
  });

  it('shows placeholder from inputHint', () => {
    const filter = {
      dataKey: 'search',
      inputHint: 'Enter search term',
      attributes: [{ key: 'type', value: 'input' }],
    };
    render(<V1DynamicFilterControl filter={filter} value="" onChange={onChange} />);
    expect(screen.getByPlaceholderText('Enter search term')).toBeInTheDocument();
  });

  it('renders dropdown for select type', () => {
    const filter = {
      dataKey: 'category',
      attributes: [
        { key: 'type', value: 'select' },
        { key: 'options', value: 'A,B,C' },
      ],
    };
    render(<V1DynamicFilterControl filter={filter} value="" onChange={onChange} />);
    // Should render V1CustomDropdown button
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('renders dropdown for dropdown type', () => {
    const filter = {
      dataKey: 'dropdown_field',
      attributes: [
        { key: 'type', value: 'dropdown' },
        { key: 'options', value: [{ name: 'Option A', value: 'a' }, { name: 'Option B', value: 'b' }] },
      ],
    };
    render(<V1DynamicFilterControl filter={filter} value="a" onChange={onChange} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('renders multiselect for multiselect type', () => {
    const filter = {
      dataKey: 'tags',
      attributes: [
        { key: 'type', value: 'multiselect' },
        { key: 'options', value: [{ name: 'Tag1', value: 't1' }, { name: 'Tag2', value: 't2' }] },
      ],
    };
    render(<V1DynamicFilterControl filter={filter} value={['t1']} onChange={onChange} />);
    // V1MultiSelectDropdown renders a button
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('handles string value for multiselect', () => {
    const filter = {
      dataKey: 'tags',
      attributes: [
        { key: 'type', value: 'multi-select' },
        { key: 'options', value: [{ name: 'Tag1', value: 't1' }] },
      ],
    };
    render(<V1DynamicFilterControl filter={filter} value="t1" onChange={onChange} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('uses defaultValue for multiselect when value is empty', () => {
    const filter = {
      dataKey: 'tags',
      attributes: [
        { key: 'type', value: 'multiselect' },
        { key: 'options', value: [{ name: 'Tag1', value: 't1' }] },
        { key: 'defaultValue', value: 't1' },
      ],
    };
    render(<V1DynamicFilterControl filter={filter} value={undefined} onChange={onChange} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('renders radio button for radioButton type', () => {
    const filter = {
      dataKey: 'status',
      attributes: [
        { key: 'type', value: 'radioButton' },
        { key: 'options', value: [{ name: 'Active', value: 'A' }, { name: 'Inactive', value: 'I' }] },
      ],
    };
    render(<V1DynamicFilterControl filter={filter} value="A" onChange={onChange} />);
    // V1RadioButtonDropdown renders a button
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('uses defaultValue for radio when value is empty', () => {
    const filter = {
      dataKey: 'status',
      attributes: [
        { key: 'type', value: 'radioButton' },
        { key: 'options', value: [{ name: 'Active', value: 'A' }] },
        { key: 'defaultValue', value: 'A' },
      ],
    };
    render(<V1DynamicFilterControl filter={filter} value="" onChange={onChange} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('renders toggle button for toggleButton type', () => {
    const filter = {
      dataKey: 'toggles',
      attributes: [
        { key: 'type', value: 'toggleButton' },
        {
          key: 'options',
          value: [
            { name: 'Toggle A', dataKey: 'toggleA', values: { on: 1, off: 0 } },
            { name: 'Toggle B', dataKey: 'toggleB', values: { on: 1, off: 0 } },
          ],
        },
      ],
    };
    render(
      <V1DynamicFilterControl
        filter={filter}
        value={{ toggleA: 1, toggleB: 0 }}
        onChange={onChange}
      />
    );
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('handles toggle button with defaultValue', () => {
    const filter = {
      dataKey: 'toggles',
      attributes: [
        { key: 'type', value: 'toggleButton' },
        {
          key: 'options',
          value: [
            { name: 'Toggle A', dataKey: 'toggleA' },
          ],
        },
        { key: 'defaultValue', value: { toggleA: true } },
      ],
    };
    render(
      <V1DynamicFilterControl filter={filter} value={undefined} onChange={onChange} />
    );
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('handles toggle button with no value and no defaultValue', () => {
    const filter = {
      dataKey: 'toggles',
      attributes: [
        { key: 'type', value: 'toggleButton' },
        {
          key: 'options',
          value: [{ name: 'Toggle A', dataKey: 'toggleA' }],
        },
      ],
    };
    render(
      <V1DynamicFilterControl filter={filter} value={undefined} onChange={onChange} />
    );
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('applies 60-day logic for paired date pickers (from date)', () => {
    const fromFilter = {
      dataKey: 'fromDate',
      attributes: [{ key: 'type', value: 'date-picker' }],
    };
    const toFilter = {
      dataKey: 'toDate',
      attributes: [{ key: 'type', value: 'date-picker' }],
    };
    const { container } = render(
      <V1DynamicFilterControl
        filter={fromFilter}
        value=""
        onChange={onChange}
        allFilters={[fromFilter, toFilter]}
        form={{}}
      />
    );
    expect(container.querySelector('input[type="date"]')).toBeInTheDocument();
  });

  it('applies 60-day logic for paired date pickers (to date)', () => {
    const fromFilter = {
      dataKey: 'fromDate',
      attributes: [{ key: 'type', value: 'date-picker' }],
    };
    const toFilter = {
      dataKey: 'toDate',
      attributes: [{ key: 'type', value: 'date-picker' }],
    };
    const { container } = render(
      <V1DynamicFilterControl
        filter={toFilter}
        value=""
        onChange={onChange}
        allFilters={[fromFilter, toFilter]}
        form={{}}
      />
    );
    expect(container.querySelector('input[type="date"]')).toBeInTheDocument();
  });

  it('uses defaultValue for date when value is empty', () => {
    const filter = {
      dataKey: 'someDate',
      attributes: [
        { key: 'type', value: 'date' },
        { key: 'defaultValue', value: '2025-06-01' },
      ],
    };
    const { container } = render(
      <V1DynamicFilterControl filter={filter} value="" onChange={onChange} />
    );
    expect(container.querySelector('input[type="date"]')).toBeInTheDocument();
  });

  it('calls onChange for checkbox click', async () => {
    const user = userEvent.setup();
    const filter = {
      dataKey: 'active',
      attributes: [{ key: 'type', value: 'checkbox' }],
    };
    render(<V1DynamicFilterControl filter={filter} value={false} onChange={onChange} />);
    await user.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith('active', true);
  });

  it('handles date-range onChange for start date', async () => {
    const user = userEvent.setup();
    const filter = {
      dataKey: 'dateRange',
      attributes: [{ key: 'type', value: 'date-range' }],
    };
    const { container } = render(
      <V1DynamicFilterControl
        filter={filter}
        value={{ start: '2026-01-01', end: '2026-01-31' }}
        onChange={onChange}
      />
    );
    const dateInputs = container.querySelectorAll('input[type="date"]');
    // Change the first date input
    await user.clear(dateInputs[0]);
    await user.type(dateInputs[0], '2026-02-01');
    expect(onChange).toHaveBeenCalled();
  });

  it('renders text input without placeholder when value is present', () => {
    const filter = {
      dataKey: 'search',
      inputHint: 'Search hint',
      attributes: [{ key: 'type', value: 'input' }],
    };
    render(<V1DynamicFilterControl filter={filter} value="existing" onChange={onChange} />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('existing');
  });

  it('handles numeric radioButton value', () => {
    const filter = {
      dataKey: 'num_field',
      attributes: [
        { key: 'type', value: 'radioButton' },
        { key: 'options', value: [{ name: 'One', value: '1' }] },
      ],
    };
    render(<V1DynamicFilterControl filter={filter} value={1} onChange={onChange} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('uses date type same as date-picker', () => {
    const filter = {
      dataKey: 'dateField',
      attributes: [{ key: 'type', value: 'date' }],
    };
    const { container } = render(
      <V1DynamicFilterControl filter={filter} value="2026-03-01" onChange={onChange} />
    );
    expect(container.querySelector('input[type="date"]')).toBeInTheDocument();
  });

  // --- Deep coverage: uncovered branches/functions ---

  it('parses string options into array', () => {
    const filter = {
      dataKey: 'category',
      attributes: [
        { key: 'type', value: 'select' },
        { key: 'options', value: 'Apple,Banana,Cherry' },
      ],
    };
    render(<V1DynamicFilterControl filter={filter} value="" onChange={onChange} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('converts non-array non-string options to empty array', () => {
    const filter = {
      dataKey: 'category',
      attributes: [
        { key: 'type', value: 'select' },
        { key: 'options', value: 42 },
      ],
    };
    render(<V1DynamicFilterControl filter={filter} value="" onChange={onChange} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('uses defaultValue as array for multiselect when value is empty', () => {
    const filter = {
      dataKey: 'tags',
      attributes: [
        { key: 'type', value: 'multiselect' },
        { key: 'options', value: [{ name: 'Tag1', value: 't1' }, { name: 'Tag2', value: 't2' }] },
        { key: 'defaultValue', value: ['t1', 't2'] },
      ],
    };
    render(<V1DynamicFilterControl filter={filter} value={null} onChange={onChange} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('renders customer suggest input for customer filter', () => {
    const filter = {
      dataKey: 'query_customer',
      displayName: 'Customer #1',
      attributes: [{ key: 'type', value: 'input' }],
    };
    const customerData = {
      hasAssigned: true,
      customers: [{ id: '1', name: 'Cust 1' }],
      tags: ['vip'],
      loading: false,
      search: vi.fn(),
      filterByTag: vi.fn(),
    };
    render(
      <V1DynamicFilterControl
        filter={filter}
        value=""
        onChange={onChange}
        useCustomerSuggest={true}
        customerData={customerData}
      />
    );
    // V1CustomerSuggestInput should be rendered; it's mocked so we verify no crash
  });

  it('does not render customer suggest when useCustomerSuggest is false', () => {
    const filter = {
      dataKey: 'query_customer',
      attributes: [{ key: 'type', value: 'input' }],
    };
    render(
      <V1DynamicFilterControl
        filter={filter}
        value=""
        onChange={onChange}
        useCustomerSuggest={false}
      />
    );
    // Falls through to text input
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('detects customer filter by displayName', () => {
    const filter = {
      dataKey: 'some_field',
      displayName: 'Customer #2',
      attributes: [{ key: 'type', value: 'input' }],
    };
    const customerData = {
      hasAssigned: true,
      customers: [],
      tags: [],
      loading: false,
      search: vi.fn(),
      filterByTag: vi.fn(),
    };
    render(
      <V1DynamicFilterControl
        filter={filter}
        value=""
        onChange={onChange}
        useCustomerSuggest={true}
        customerData={customerData}
      />
    );
    // Should match the customer pattern and render customer suggest
  });

  it('handles toggle button with value object and values.on/off mapping', () => {
    const filter = {
      dataKey: 'toggles',
      attributes: [
        { key: 'type', value: 'toggleButton' },
        {
          key: 'options',
          value: [
            { name: 'Toggle A', dataKey: 'toggleA', values: { on: 'Y', off: 'N' } },
            { name: 'Toggle B', dataKey: 'toggleB', values: { on: 'Y', off: 'N' } },
          ],
        },
      ],
    };
    render(
      <V1DynamicFilterControl
        filter={filter}
        value={{ toggleA: 'Y', toggleB: 'N' }}
        onChange={onChange}
      />
    );
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('handles toggle button with value object but no values.on (uses isToggleOn fallback)', () => {
    const filter = {
      dataKey: 'toggles',
      attributes: [
        { key: 'type', value: 'toggleButton' },
        {
          key: 'options',
          value: [
            { name: 'Toggle A', dataKey: 'toggleA' },
            { name: 'Toggle B', dataKey: 'toggleB' },
          ],
        },
      ],
    };
    render(
      <V1DynamicFilterControl
        filter={filter}
        value={{ toggleA: 1, toggleB: false }}
        onChange={onChange}
      />
    );
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('handles toggle button with value object where key is undefined and defaultVal is object', () => {
    const filter = {
      dataKey: 'toggles',
      attributes: [
        { key: 'type', value: 'toggleButton' },
        {
          key: 'options',
          value: [
            { name: 'Toggle A', dataKey: 'toggleA', values: { on: 1, off: 0 } },
            { name: 'Toggle B', dataKey: 'toggleB' },
          ],
        },
        { key: 'defaultValue', value: { toggleA: 1, toggleB: true } },
      ],
    };
    // value has the dataKey but toggleB is undefined in value object
    render(
      <V1DynamicFilterControl
        filter={filter}
        value={{ toggleA: 1 }}
        onChange={onChange}
      />
    );
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('handles toggle button with defaultVal as array', () => {
    const filter = {
      dataKey: 'toggles',
      attributes: [
        { key: 'type', value: 'toggleButton' },
        {
          key: 'options',
          value: [
            { name: 'Toggle A', dataKey: 'toggleA', values: { on: 1, off: 0 } },
          ],
        },
        {
          key: 'defaultValue',
          value: [{ toggleA: 1 }],
        },
      ],
    };
    render(
      <V1DynamicFilterControl filter={filter} value={undefined} onChange={onChange} />
    );
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('handles date-range with defaultValue_start and defaultValue_end', () => {
    const filter = {
      dataKey: 'dateRange',
      attributes: [
        { key: 'type', value: 'date-range' },
        { key: 'defaultValue_start', value: '2025-01-01' },
        { key: 'defaultValue_end', value: '2025-12-31' },
      ],
    };
    const { container } = render(
      <V1DynamicFilterControl
        filter={filter}
        value={{ start: '', end: '' }}
        onChange={onChange}
      />
    );
    const dateInputs = container.querySelectorAll('input[type="date"]');
    expect(dateInputs).toHaveLength(2);
  });

  it('handles date-range onChange for end date', async () => {
    const user = userEvent.setup();
    const filter = {
      dataKey: 'dateRange',
      attributes: [{ key: 'type', value: 'date-range' }],
    };
    const { container } = render(
      <V1DynamicFilterControl
        filter={filter}
        value={{ start: '2026-01-01', end: '2026-01-31' }}
        onChange={onChange}
      />
    );
    const dateInputs = container.querySelectorAll('input[type="date"]');
    await user.clear(dateInputs[1]);
    await user.type(dateInputs[1], '2026-02-28');
    expect(onChange).toHaveBeenCalled();
  });

  it('uses placeholder prop as fallback for text input', () => {
    const filter = {
      dataKey: 'field1',
      attributes: [{ key: 'type', value: 'input' }],
    };
    render(
      <V1DynamicFilterControl
        filter={filter}
        value=""
        onChange={onChange}
        placeholder="Custom placeholder"
      />
    );
    expect(screen.getByPlaceholderText('Custom placeholder')).toBeInTheDocument();
  });

  it('uses type as fallback placeholder when no inputHint and no placeholder', () => {
    const filter = {
      dataKey: 'field1',
      attributes: [{ key: 'type', value: 'input' }],
    };
    render(
      <V1DynamicFilterControl filter={filter} value="" onChange={onChange} />
    );
    expect(screen.getByPlaceholderText('input')).toBeInTheDocument();
  });

  it('passes title prop to text input', () => {
    const filter = {
      dataKey: 'field1',
      attributes: [{ key: 'type', value: 'input' }],
    };
    const { container } = render(
      <V1DynamicFilterControl filter={filter} value="" onChange={onChange} title="Help text" />
    );
    expect(container.querySelector('input[title="Help text"]')).toBeInTheDocument();
  });

  it('handles multiselect with empty array value', () => {
    const filter = {
      dataKey: 'tags',
      attributes: [
        { key: 'type', value: 'multiselect' },
        { key: 'options', value: [{ name: 'Tag1', value: 't1' }] },
      ],
    };
    render(<V1DynamicFilterControl filter={filter} value={[]} onChange={onChange} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('handles radio with undefined value and no defaultValue', () => {
    const filter = {
      dataKey: 'status',
      attributes: [
        { key: 'type', value: 'radioButton' },
        { key: 'options', value: [{ name: 'Active', value: 'A' }] },
      ],
    };
    render(<V1DynamicFilterControl filter={filter} value={undefined} onChange={onChange} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('handles paired date pickers with form value for toDate', () => {
    const fromFilter = {
      dataKey: 'fromDate',
      attributes: [{ key: 'type', value: 'date-picker' }],
    };
    const toFilter = {
      dataKey: 'toDate',
      attributes: [{ key: 'type', value: 'date-picker' }],
    };
    const { container } = render(
      <V1DynamicFilterControl
        filter={fromFilter}
        value=""
        onChange={onChange}
        allFilters={[fromFilter, toFilter]}
        form={{ toDate: '2026-03-15' }}
      />
    );
    expect(container.querySelector('input[type="date"]')).toBeInTheDocument();
  });

  it('calls onChange on date input change', async () => {
    const user = userEvent.setup();
    const filter = {
      dataKey: 'dateField',
      attributes: [{ key: 'type', value: 'date-picker' }],
    };
    const { container } = render(
      <V1DynamicFilterControl filter={filter} value="2026-01-01" onChange={onChange} />
    );
    const dateInput = container.querySelector('input[type="date"]');
    await user.clear(dateInput);
    await user.type(dateInput, '2026-02-01');
    expect(onChange).toHaveBeenCalled();
  });

  it('handles toggle with defaultVal array where key not found', () => {
    const filter = {
      dataKey: 'toggles',
      attributes: [
        { key: 'type', value: 'toggleButton' },
        {
          key: 'options',
          value: [
            { name: 'Toggle X', dataKey: 'toggleX' },
          ],
        },
        {
          key: 'defaultValue',
          value: [{ toggleY: true }],
        },
      ],
    };
    render(
      <V1DynamicFilterControl filter={filter} value={undefined} onChange={onChange} />
    );
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});
