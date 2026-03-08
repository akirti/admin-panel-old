import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import V1SearchBar from './v1_SearchBar';

describe('V1SearchBar', () => {
  it('renders input with default placeholder', () => {
    render(<V1SearchBar value="" onChange={jest.fn()} />);
    expect(screen.getByPlaceholderText('Search scenarios...')).toBeInTheDocument();
  });

  it('renders input with custom placeholder', () => {
    render(<V1SearchBar value="" onChange={jest.fn()} placeholder="Find items..." />);
    expect(screen.getByPlaceholderText('Find items...')).toBeInTheDocument();
  });

  it('calls onChange when typing', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<V1SearchBar value="" onChange={onChange} />);

    await user.type(screen.getByPlaceholderText('Search scenarios...'), 'test');
    expect(onChange).toHaveBeenCalledWith('t');
  });

  it('shows clear button when value is present', () => {
    render(<V1SearchBar value="query" onChange={jest.fn()} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('does not show clear button when value is empty', () => {
    render(<V1SearchBar value="" onChange={jest.fn()} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('calls onChange with empty string when clear is clicked', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<V1SearchBar value="query" onChange={onChange} />);

    await user.click(screen.getByRole('button'));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('displays the current value', () => {
    render(<V1SearchBar value="hello" onChange={jest.fn()} />);
    expect(screen.getByDisplayValue('hello')).toBeInTheDocument();
  });
});
