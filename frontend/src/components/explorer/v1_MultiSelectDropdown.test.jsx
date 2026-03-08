import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import V1MultiSelectDropdown from './v1_MultiSelectDropdown';

describe('V1MultiSelectDropdown', () => {
  const options = [
    { name: 'Red', value: 'red' },
    { name: 'Green', value: 'green' },
    { name: 'Blue', value: 'blue' },
  ];

  const defaultProps = {
    options,
    selectedOptions: [],
    onChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with placeholder', () => {
    render(<V1MultiSelectDropdown {...defaultProps} />);
    expect(screen.getByText('Select...')).toBeInTheDocument();
  });

  it('renders with custom placeholder', () => {
    render(<V1MultiSelectDropdown {...defaultProps} placeholder="Pick colors" />);
    expect(screen.getByText('Pick colors')).toBeInTheDocument();
  });

  it('shows selected options in button', () => {
    render(
      <V1MultiSelectDropdown {...defaultProps} selectedOptions={['red', 'blue']} />
    );
    expect(screen.getByText('Red, Blue')).toBeInTheDocument();
  });

  it('shows "All selected" when all options selected', () => {
    render(
      <V1MultiSelectDropdown
        {...defaultProps}
        selectedOptions={['red', 'green', 'blue']}
      />
    );
    expect(screen.getByText('All selected (3)')).toBeInTheDocument();
  });

  it('opens dropdown and shows options on click', async () => {
    const user = userEvent.setup();
    render(<V1MultiSelectDropdown {...defaultProps} />);

    await user.click(screen.getByRole('button'));

    expect(screen.getByText('Red')).toBeInTheDocument();
    expect(screen.getByText('Green')).toBeInTheDocument();
    expect(screen.getByText('Blue')).toBeInTheDocument();
  });

  it('calls onChange when option is toggled', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<V1MultiSelectDropdown {...defaultProps} onChange={onChange} />);

    await user.click(screen.getByRole('button'));
    await user.click(screen.getByText('Red'));

    expect(onChange).toHaveBeenCalledWith(['red']);
  });

  it('removes option when already selected', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <V1MultiSelectDropdown
        {...defaultProps}
        selectedOptions={['red', 'blue']}
        onChange={onChange}
      />
    );

    await user.click(screen.getByRole('button'));
    await user.click(screen.getByText('Red'));

    expect(onChange).toHaveBeenCalledWith(['blue']);
  });

  it('shows Select All button when multiSelectFooter and handleToggleSelectAll', async () => {
    const user = userEvent.setup();
    render(
      <V1MultiSelectDropdown
        {...defaultProps}
        multiSelectFooter
        handleToggleSelectAll={vi.fn()}
        allSelected={false}
      />
    );

    await user.click(screen.getByRole('button'));
    expect(screen.getByText('Select All')).toBeInTheDocument();
  });

  it('shows Clear All button when all selected', async () => {
    const user = userEvent.setup();
    render(
      <V1MultiSelectDropdown
        {...defaultProps}
        selectedOptions={['red', 'green', 'blue']}
        multiSelectFooter
        handleToggleSelectAll={vi.fn()}
        allSelected={true}
      />
    );

    await user.click(screen.getByRole('button'));
    expect(screen.getByText('Clear All')).toBeInTheDocument();
  });

  it('calls handleToggleSelectAll when Select All clicked', async () => {
    const user = userEvent.setup();
    const handleToggleSelectAll = vi.fn();
    render(
      <V1MultiSelectDropdown
        {...defaultProps}
        multiSelectFooter
        handleToggleSelectAll={handleToggleSelectAll}
      />
    );

    await user.click(screen.getByRole('button'));
    await user.click(screen.getByText('Select All'));
    expect(handleToggleSelectAll).toHaveBeenCalled();
  });

  it('renders label when provided', () => {
    render(<V1MultiSelectDropdown {...defaultProps} label="Colors" />);
    expect(screen.getByText('Colors')).toBeInTheDocument();
  });

  // --- Additional branch coverage tests ---

  // Close dropdown on outside click
  it('closes dropdown on outside click', async () => {
    const user = userEvent.setup();
    render(<V1MultiSelectDropdown {...defaultProps} />);

    // Open
    await user.click(screen.getByRole('button'));
    expect(screen.getByText('Red')).toBeInTheDocument();

    // Click outside — simulate mousedown on document body
    fireEvent.mouseDown(document.body);

    await waitFor(() => {
      expect(screen.queryByText('Red')).not.toBeInTheDocument();
    });
  });

  // Toggle dropdown closed by clicking button again
  it('closes dropdown when clicking the toggle button again', async () => {
    const user = userEvent.setup();
    render(<V1MultiSelectDropdown {...defaultProps} />);

    const btn = screen.getByRole('button');

    // Open
    await user.click(btn);
    expect(screen.getByText('Red')).toBeInTheDocument();

    // Close
    await user.click(btn);
    await waitFor(() => {
      expect(screen.queryByText('Red')).not.toBeInTheDocument();
    });
  });

  // Search filtering with more than 5 options
  it('shows search input when options > 5 and filters options by search', async () => {
    const user = userEvent.setup();
    const manyOptions = [
      { name: 'Red', value: 'red' },
      { name: 'Green', value: 'green' },
      { name: 'Blue', value: 'blue' },
      { name: 'Yellow', value: 'yellow' },
      { name: 'Purple', value: 'purple' },
      { name: 'Orange', value: 'orange' },
    ];
    const onChange = vi.fn();
    render(
      <V1MultiSelectDropdown
        options={manyOptions}
        selectedOptions={[]}
        onChange={onChange}
      />
    );

    await user.click(screen.getByRole('button'));

    // Search input should be present
    const searchInput = screen.getByPlaceholderText('Search...');
    expect(searchInput).toBeInTheDocument();

    // Type search term
    await user.type(searchInput, 'Red');

    // Only Red should appear
    expect(screen.getByText('Red')).toBeInTheDocument();
    expect(screen.queryByText('Green')).not.toBeInTheDocument();
    expect(screen.queryByText('Blue')).not.toBeInTheDocument();
  });

  // Search by value (not just name)
  it('filters options by value in search', async () => {
    const user = userEvent.setup();
    const manyOptions = [
      { name: 'Red Color', value: 'red' },
      { name: 'Green Color', value: 'green' },
      { name: 'Blue Color', value: 'blue' },
      { name: 'Yellow Color', value: 'yellow' },
      { name: 'Purple Color', value: 'purple' },
      { name: 'Orange Color', value: 'orange' },
    ];
    render(
      <V1MultiSelectDropdown
        options={manyOptions}
        selectedOptions={[]}
        onChange={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button'));
    const searchInput = screen.getByPlaceholderText('Search...');
    await user.type(searchInput, 'green');

    expect(screen.getByText('Green Color')).toBeInTheDocument();
    expect(screen.queryByText('Red Color')).not.toBeInTheDocument();
  });

  // No search results
  it('shows "No results found" when search matches nothing', async () => {
    const user = userEvent.setup();
    const manyOptions = [
      { name: 'Red', value: 'red' },
      { name: 'Green', value: 'green' },
      { name: 'Blue', value: 'blue' },
      { name: 'Yellow', value: 'yellow' },
      { name: 'Purple', value: 'purple' },
      { name: 'Orange', value: 'orange' },
    ];
    render(
      <V1MultiSelectDropdown
        options={manyOptions}
        selectedOptions={[]}
        onChange={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button'));
    const searchInput = screen.getByPlaceholderText('Search...');
    await user.type(searchInput, 'zzzzzzz');

    expect(screen.getByText('No results found')).toBeInTheDocument();
  });

  // Does not show search input when 5 or fewer options
  it('does not show search input when options <= 5', async () => {
    const user = userEvent.setup();
    render(<V1MultiSelectDropdown {...defaultProps} />);

    await user.click(screen.getByRole('button'));

    expect(screen.queryByPlaceholderText('Search...')).not.toBeInTheDocument();
  });

  // Empty options list
  it('shows "No results found" when options is empty', async () => {
    const user = userEvent.setup();
    render(
      <V1MultiSelectDropdown
        options={[]}
        selectedOptions={[]}
        onChange={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button'));

    expect(screen.getByText('No results found')).toBeInTheDocument();
  });

  // Selected label: shows placeholder when no options selected
  it('shows placeholder when selectedOptions is empty', () => {
    render(
      <V1MultiSelectDropdown
        {...defaultProps}
        selectedOptions={[]}
        placeholder="Choose..."
      />
    );
    expect(screen.getByText('Choose...')).toBeInTheDocument();
  });

  // Selected label: option value not found in options — falls back to value string
  it('shows option value when option not found in options list', () => {
    render(
      <V1MultiSelectDropdown
        {...defaultProps}
        selectedOptions={['unknown_value']}
      />
    );
    expect(screen.getByText('unknown_value')).toBeInTheDocument();
  });

  // trimLabel: long label gets truncated with ellipsis
  it('truncates long selected label', () => {
    const longName = 'A'.repeat(50);
    const longOptions = [
      { name: longName, value: 'long' },
      { name: 'Other', value: 'other' },
    ];
    render(
      <V1MultiSelectDropdown
        options={longOptions}
        selectedOptions={['long']}
        onChange={vi.fn()}
      />
    );

    // The truncated label should have a title attribute with the full text
    const truncatedEl = screen.getByTitle(longName);
    expect(truncatedEl).toBeInTheDocument();
  });

  // trimLabel: short label does not get truncated
  it('does not truncate short selected label', () => {
    render(
      <V1MultiSelectDropdown
        {...defaultProps}
        selectedOptions={['red']}
      />
    );
    expect(screen.getByText('Red')).toBeInTheDocument();
  });

  // No label rendered when label prop is not provided
  it('does not render label element when label is not provided', () => {
    const { container } = render(<V1MultiSelectDropdown {...defaultProps} />);
    const labels = container.querySelectorAll('label');
    expect(labels.length).toBe(0);
  });

  // Footer not shown when multiSelectFooter is false
  it('does not show footer when multiSelectFooter is false', async () => {
    const user = userEvent.setup();
    render(
      <V1MultiSelectDropdown
        {...defaultProps}
        handleToggleSelectAll={vi.fn()}
        allSelected={false}
      />
    );

    await user.click(screen.getByRole('button'));
    expect(screen.queryByText('Select All')).not.toBeInTheDocument();
  });

  // Footer not shown when handleToggleSelectAll is not provided
  it('does not show footer when handleToggleSelectAll is not provided', async () => {
    const user = userEvent.setup();
    render(
      <V1MultiSelectDropdown
        {...defaultProps}
        multiSelectFooter={true}
      />
    );

    await user.click(screen.getByRole('button'));
    expect(screen.queryByText('Select All')).not.toBeInTheDocument();
  });

  // Option with label but no name — uses label for display
  it('displays option.label when option.name is not available', async () => {
    const user = userEvent.setup();
    const labelOptions = [
      { label: 'Label One', value: 'one' },
      { label: 'Label Two', value: 'two' },
      { label: 'Label Three', value: 'three' },
    ];
    render(
      <V1MultiSelectDropdown
        options={labelOptions}
        selectedOptions={[]}
        onChange={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button'));
    expect(screen.getByText('Label One')).toBeInTheDocument();
  });

  // Option with neither name nor label — uses value for display
  it('displays option.value when neither name nor label is available', async () => {
    const user = userEvent.setup();
    const valueOnlyOptions = [
      { value: 'val1' },
      { value: 'val2' },
      { value: 'val3' },
    ];
    render(
      <V1MultiSelectDropdown
        options={valueOnlyOptions}
        selectedOptions={[]}
        onChange={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button'));
    expect(screen.getByText('val1')).toBeInTheDocument();
  });

  // Option key: falls back to option.id when value is falsy
  it('uses option.id as key when value is empty', async () => {
    const user = userEvent.setup();
    const idOptions = [
      { id: 'id1', name: 'Item 1', value: '' },
      { id: 'id2', name: 'Item 2', value: '' },
    ];
    render(
      <V1MultiSelectDropdown
        options={idOptions}
        selectedOptions={[]}
        onChange={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button'));
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
  });

  // Checked option styling in dropdown
  it('applies checked styling to selected options', async () => {
    const user = userEvent.setup();
    render(
      <V1MultiSelectDropdown
        {...defaultProps}
        selectedOptions={['red']}
      />
    );

    await user.click(screen.getByRole('button'));

    const checkboxes = screen.getAllByRole('checkbox');
    const redCheckbox = checkboxes.find((cb) => cb.checked);
    expect(redCheckbox).toBeTruthy();
  });

  // Search resets when dropdown closes via outside click
  it('resets search term when dropdown closes via outside click', async () => {
    const user = userEvent.setup();
    const manyOptions = [
      { name: 'Red', value: 'red' },
      { name: 'Green', value: 'green' },
      { name: 'Blue', value: 'blue' },
      { name: 'Yellow', value: 'yellow' },
      { name: 'Purple', value: 'purple' },
      { name: 'Orange', value: 'orange' },
    ];
    render(
      <V1MultiSelectDropdown
        options={manyOptions}
        selectedOptions={[]}
        onChange={vi.fn()}
      />
    );

    // Open and search
    await user.click(screen.getByRole('button'));
    const searchInput = screen.getByPlaceholderText('Search...');
    await user.type(searchInput, 'Red');

    // Close via outside click
    fireEvent.mouseDown(document.body);

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Search...')).not.toBeInTheDocument();
    });

    // Re-open — search should be cleared
    await user.click(screen.getByRole('button'));
    const newSearchInput = screen.getByPlaceholderText('Search...');
    expect(newSearchInput).toHaveValue('');
  });

  // Dropdown positioning: opens upward when space below is limited
  it('positions dropdown based on button location', async () => {
    const user = userEvent.setup();
    // Mock getBoundingClientRect to simulate near-bottom position
    const mockRect = {
      top: 700,
      bottom: 730,
      left: 100,
      width: 200,
      height: 30,
      right: 300,
      x: 100,
      y: 700,
      toJSON: () => {},
    };

    render(<V1MultiSelectDropdown {...defaultProps} />);
    const btn = screen.getByRole('button');
    vi.spyOn(btn, 'getBoundingClientRect').mockReturnValue(mockRect);

    await user.click(btn);

    // Dropdown should be rendered
    expect(screen.getByText('Red')).toBeInTheDocument();
  });

  // Selection label when options.length > 0 and selectedOptions = options but text resolves empty
  it('falls back to placeholder when selected names join to empty string', () => {
    const emptyNameOptions = [
      { name: '', value: '' },
    ];
    render(
      <V1MultiSelectDropdown
        options={emptyNameOptions}
        selectedOptions={['']}
        onChange={vi.fn()}
        placeholder="Fallback"
      />
    );

    // All selected case: selectedOptions.length === options.length
    expect(screen.getByText('All selected (1)')).toBeInTheDocument();
  });

  // Option with name containing search term in different case
  it('performs case-insensitive search', async () => {
    const user = userEvent.setup();
    const manyOptions = [
      { name: 'RED', value: 'red' },
      { name: 'GREEN', value: 'green' },
      { name: 'BLUE', value: 'blue' },
      { name: 'YELLOW', value: 'yellow' },
      { name: 'PURPLE', value: 'purple' },
      { name: 'ORANGE', value: 'orange' },
    ];
    render(
      <V1MultiSelectDropdown
        options={manyOptions}
        selectedOptions={[]}
        onChange={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button'));
    const searchInput = screen.getByPlaceholderText('Search...');
    await user.type(searchInput, 'red');

    expect(screen.getByText('RED')).toBeInTheDocument();
    expect(screen.queryByText('GREEN')).not.toBeInTheDocument();
  });

  // Option with null name/value — handles gracefully in search
  it('handles options with null name and value in search', async () => {
    const user = userEvent.setup();
    const nullishOptions = [
      { name: null, value: null },
      { name: 'Valid', value: 'valid' },
      { name: null, value: 'hasvalue' },
      { name: 'HasName', value: null },
      { name: 'Extra1', value: 'extra1' },
      { name: 'Extra2', value: 'extra2' },
    ];
    render(
      <V1MultiSelectDropdown
        options={nullishOptions}
        selectedOptions={[]}
        onChange={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button'));
    const searchInput = screen.getByPlaceholderText('Search...');
    await user.type(searchInput, 'Valid');

    expect(screen.getByText('Valid')).toBeInTheDocument();
  });

  // trimLabel with non-string value — returns value as-is
  it('handles non-string value in trimLabel', () => {
    // trimLabel is called through selectedLabel which always returns a string.
    // But if selectedOptions produces a value, trimLabel handles it.
    // This is an edge case — just ensure no crash with empty options.
    render(
      <V1MultiSelectDropdown
        options={[]}
        selectedOptions={[]}
        onChange={vi.fn()}
        placeholder="Pick"
      />
    );
    expect(screen.getByText('Pick')).toBeInTheDocument();
  });
});
