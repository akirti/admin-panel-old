import { render, screen } from '@testing-library/react';
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
});
