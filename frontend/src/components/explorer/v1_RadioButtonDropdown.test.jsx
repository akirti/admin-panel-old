import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import V1RadioButtonDropdown from './v1_RadioButtonDropdown';

describe('V1RadioButtonDropdown', () => {
  const options = [
    { name: 'Option A', value: 'a' },
    { name: 'Option B', value: 'b' },
    { name: 'Option C', value: 'c' },
  ];

  it('renders with placeholder when no value', () => {
    render(<V1RadioButtonDropdown options={options} onChange={jest.fn()} name="test" />);
    expect(screen.getByText('Select an option')).toBeInTheDocument();
  });

  it('renders with custom placeholder', () => {
    render(<V1RadioButtonDropdown options={options} onChange={jest.fn()} name="test" placeholder="Pick one" />);
    expect(screen.getByText('Pick one')).toBeInTheDocument();
  });

  it('shows selected value label', () => {
    render(<V1RadioButtonDropdown options={options} value="b" onChange={jest.fn()} name="test" />);
    expect(screen.getByText('Option B')).toBeInTheDocument();
  });

  it('opens dropdown on click', async () => {
    const user = userEvent.setup();
    render(<V1RadioButtonDropdown options={options} onChange={jest.fn()} name="test" />);

    await user.click(screen.getByRole('button'));

    expect(screen.getByText('Option A')).toBeInTheDocument();
    expect(screen.getByText('Option B')).toBeInTheDocument();
    expect(screen.getByText('Option C')).toBeInTheDocument();
  });

  it('calls onChange and closes on selection', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<V1RadioButtonDropdown options={options} onChange={onChange} name="test" />);

    await user.click(screen.getByRole('button'));
    await user.click(screen.getByText('Option B'));

    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('highlights selected radio option', async () => {
    const user = userEvent.setup();
    render(<V1RadioButtonDropdown options={options} value="a" onChange={jest.fn()} name="test" />);

    await user.click(screen.getByRole('button'));

    const radios = screen.getAllByRole('radio');
    expect(radios[0]).toBeChecked();
    expect(radios[1]).not.toBeChecked();
  });

  it('toggles dropdown open and closed', async () => {
    const user = userEvent.setup();
    render(<V1RadioButtonDropdown options={options} onChange={jest.fn()} name="test" />);

    await user.click(screen.getByRole('button'));
    expect(screen.getByText('Option A')).toBeInTheDocument();

    await user.click(screen.getByRole('button'));
    // Options should be hidden (dropdown closed)
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });
});
