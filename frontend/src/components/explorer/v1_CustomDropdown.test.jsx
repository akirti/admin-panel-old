import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import V1CustomDropdown from './v1_CustomDropdown';

describe('V1CustomDropdown', () => {
  const options = [
    { name: 'Apple', value: 'apple' },
    { name: 'Banana', value: 'banana' },
    { name: 'Cherry', value: 'cherry' },
  ];

  it('renders with placeholder when no value', () => {
    render(<V1CustomDropdown options={options} onChange={jest.fn()} />);
    expect(screen.getByText('Select')).toBeInTheDocument();
  });

  it('renders with custom placeholder', () => {
    render(<V1CustomDropdown options={options} onChange={jest.fn()} placeholder="Pick fruit" />);
    expect(screen.getByText('Pick fruit')).toBeInTheDocument();
  });

  it('shows selected value name', () => {
    render(<V1CustomDropdown options={options} value="banana" onChange={jest.fn()} />);
    expect(screen.getByText('Banana')).toBeInTheDocument();
  });

  it('opens dropdown on click', async () => {
    const user = userEvent.setup();
    render(<V1CustomDropdown options={options} onChange={jest.fn()} />);

    await user.click(screen.getByRole('button'));

    expect(screen.getByText('Apple')).toBeInTheDocument();
    expect(screen.getByText('Banana')).toBeInTheDocument();
    expect(screen.getByText('Cherry')).toBeInTheDocument();
  });

  it('calls onChange when option selected', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<V1CustomDropdown options={options} onChange={onChange} />);

    await user.click(screen.getByRole('button'));
    await user.click(screen.getByText('Banana'));

    expect(onChange).toHaveBeenCalledWith('banana');
  });

  it('does not call onChange when same value selected', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<V1CustomDropdown options={options} value="banana" onChange={onChange} />);

    await user.click(screen.getByRole('button'));
    // "Banana" appears in both the button and the dropdown list — click the one in the list
    const bananaElements = screen.getAllByText('Banana');
    await user.click(bananaElements[bananaElements.length - 1]);

    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not show search when 5 or fewer options', async () => {
    const user = userEvent.setup();
    render(<V1CustomDropdown options={options} onChange={jest.fn()} />);

    await user.click(screen.getByRole('button'));
    expect(screen.queryByPlaceholderText('Search...')).not.toBeInTheDocument();
  });

  it('shows search when more than 5 options', async () => {
    const user = userEvent.setup();
    const manyOptions = Array.from({ length: 6 }, (_, i) => ({
      name: `Option ${i}`,
      value: `opt${i}`,
    }));
    render(<V1CustomDropdown options={manyOptions} onChange={jest.fn()} />);

    await user.click(screen.getByRole('button'));
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
  });

  it('filters options by search term', async () => {
    const user = userEvent.setup();
    const manyOptions = Array.from({ length: 6 }, (_, i) => ({
      name: `Option ${i}`,
      value: `opt${i}`,
    }));
    render(<V1CustomDropdown options={manyOptions} onChange={jest.fn()} />);

    await user.click(screen.getByRole('button'));
    await user.type(screen.getByPlaceholderText('Search...'), 'Option 3');

    expect(screen.getByText('Option 3')).toBeInTheDocument();
    expect(screen.queryByText('Option 0')).not.toBeInTheDocument();
  });

  it('shows no results message', async () => {
    const user = userEvent.setup();
    const manyOptions = Array.from({ length: 6 }, (_, i) => ({
      name: `Option ${i}`,
      value: `opt${i}`,
    }));
    render(<V1CustomDropdown options={manyOptions} onChange={jest.fn()} />);

    await user.click(screen.getByRole('button'));
    await user.type(screen.getByPlaceholderText('Search...'), 'xyz');

    expect(screen.getByText('No results found')).toBeInTheDocument();
  });
});
