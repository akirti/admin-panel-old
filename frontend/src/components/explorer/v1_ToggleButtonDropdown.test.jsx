import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import V1ToggleButtonDropdown from './v1_ToggleButtonDropdown';

describe('V1ToggleButtonDropdown', () => {
  const options = [
    { value: 'opt1', label: 'Toggle 1' },
    { value: 'opt2', label: 'Toggle 2' },
  ];

  const defaultProps = {
    options,
    togglesState: { opt1: false, opt2: false },
    onChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with placeholder when nothing selected', () => {
    render(<V1ToggleButtonDropdown {...defaultProps} />);
    expect(screen.getByText('Select toggle(s)')).toBeInTheDocument();
  });

  it('shows selected labels', () => {
    render(
      <V1ToggleButtonDropdown
        {...defaultProps}
        togglesState={{ opt1: true, opt2: false }}
      />
    );
    expect(screen.getByText('Toggle 1')).toBeInTheDocument();
  });

  it('opens dropdown on click', async () => {
    const user = userEvent.setup();
    render(<V1ToggleButtonDropdown {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /select toggle/i }));

    expect(screen.getByLabelText('Toggle 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Toggle 2')).toBeInTheDocument();
  });

  it('calls onChange when toggle is clicked', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<V1ToggleButtonDropdown {...defaultProps} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /select toggle/i }));
    // Click on the toggle row
    const toggleRow = screen.getByText('Toggle 1').closest('[role="button"]');
    await user.click(toggleRow);

    expect(onChange).toHaveBeenCalledWith({ opt1: true, opt2: false });
  });

  it('renders Enable All button when handleToggleSelectAll provided', async () => {
    const user = userEvent.setup();
    render(
      <V1ToggleButtonDropdown
        {...defaultProps}
        handleToggleSelectAll={jest.fn()}
        allSelected={false}
      />
    );

    await user.click(screen.getByRole('button', { name: /select toggle/i }));
    expect(screen.getByText('Enable All')).toBeInTheDocument();
  });

  it('renders Disable All button when all selected', async () => {
    const user = userEvent.setup();
    render(
      <V1ToggleButtonDropdown
        {...defaultProps}
        togglesState={{ opt1: true, opt2: true }}
        handleToggleSelectAll={jest.fn()}
        allSelected={true}
      />
    );

    await user.click(screen.getByRole('button', { name: /toggle 1, toggle 2/i }));
    expect(screen.getByText('Disable All')).toBeInTheDocument();
  });

  it('does not open when disabled', async () => {
    const user = userEvent.setup();
    render(<V1ToggleButtonDropdown {...defaultProps} disabled />);

    await user.click(screen.getByRole('button', { name: /select toggle/i }));
    expect(screen.queryByLabelText('Toggle 1')).not.toBeInTheDocument();
  });

  it('disables the button when disabled prop is true', () => {
    render(<V1ToggleButtonDropdown {...defaultProps} disabled />);
    expect(screen.getByRole('button', { name: /select toggle/i })).toBeDisabled();
  });

  it('trims long selected labels with ellipsis', () => {
    const longLabel = 'A'.repeat(50);
    const longOptions = [{ value: 'long', label: longLabel }];
    render(
      <V1ToggleButtonDropdown
        {...defaultProps}
        options={longOptions}
        togglesState={{ long: true }}
      />
    );
    // Should have a title attribute with full label
    expect(screen.getByTitle(longLabel)).toBeInTheDocument();
  });

  it('closes dropdown on outside click', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <div>
        <span data-testid="outside">Outside</span>
        <V1ToggleButtonDropdown {...defaultProps} />
      </div>
    );

    // Open dropdown
    await user.click(screen.getByRole('button', { name: /select toggle/i }));
    expect(screen.getByLabelText('Toggle 1')).toBeInTheDocument();

    // Click outside
    await user.click(screen.getByTestId('outside'));
    expect(screen.queryByLabelText('Toggle 1')).not.toBeInTheDocument();
  });

  it('toggles via keyboard (Enter)', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<V1ToggleButtonDropdown {...defaultProps} onChange={onChange} />);

    // Open dropdown
    await user.click(screen.getByRole('button', { name: /select toggle/i }));

    // Press Enter on toggle row
    const toggleRow = screen.getByText('Toggle 1').closest('[role="button"]');
    fireEvent.keyDown(toggleRow, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith({ opt1: true, opt2: false });
  });

  it('toggles via keyboard (Space)', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<V1ToggleButtonDropdown {...defaultProps} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /select toggle/i }));

    const toggleRow = screen.getByText('Toggle 2').closest('[role="button"]');
    fireEvent.keyDown(toggleRow, { key: ' ' });

    expect(onChange).toHaveBeenCalledWith({ opt1: false, opt2: true });
  });

  it('calls handleToggleSelectAll when Enable All clicked', async () => {
    const user = userEvent.setup();
    const handleToggleSelectAll = jest.fn();
    render(
      <V1ToggleButtonDropdown
        {...defaultProps}
        handleToggleSelectAll={handleToggleSelectAll}
        allSelected={false}
      />
    );

    await user.click(screen.getByRole('button', { name: /select toggle/i }));
    await user.click(screen.getByText('Enable All'));
    expect(handleToggleSelectAll).toHaveBeenCalled();
  });

  it('shows multiple selected labels joined', () => {
    render(
      <V1ToggleButtonDropdown
        {...defaultProps}
        togglesState={{ opt1: true, opt2: true }}
      />
    );
    expect(screen.getByText('Toggle 1, Toggle 2')).toBeInTheDocument();
  });

  it('uses opt.value as label when label not provided', () => {
    const noLabelOptions = [
      { value: 'alpha' },
      { value: 'beta' },
    ];
    render(
      <V1ToggleButtonDropdown
        {...defaultProps}
        options={noLabelOptions}
        togglesState={{ alpha: true }}
      />
    );
    expect(screen.getByText('alpha')).toBeInTheDocument();
  });

  it('does not toggle when disabled and row clicked', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    // Force dropdown open by not disabling initially, then re-render
    const { rerender } = render(
      <V1ToggleButtonDropdown {...defaultProps} onChange={onChange} />
    );

    await user.click(screen.getByRole('button', { name: /select toggle/i }));

    // Now disable
    rerender(
      <V1ToggleButtonDropdown {...defaultProps} onChange={onChange} disabled />
    );

    const toggleRow = screen.getByText('Toggle 1').closest('[role="button"]');
    await user.click(toggleRow);
    expect(onChange).not.toHaveBeenCalled();
  });
});
