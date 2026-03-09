import { render, screen } from '@testing-library/react';
import V1DescriptionRenderer from '../../../components/explorer/v1_DescriptionRenderer';

describe('V1DescriptionRenderer', () => {
  it('returns null when description is null', () => {
    const { container } = render(<V1DescriptionRenderer description={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('returns null when description is undefined', () => {
    const { container } = render(<V1DescriptionRenderer />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders string description as HTML', () => {
    render(<V1DescriptionRenderer description="<b>Bold text</b>" />);
    expect(screen.getByText('Bold text')).toBeInTheDocument();
    expect(screen.getByText('Bold text').tagName).toBe('B');
  });

  it('renders array description nodes', () => {
    const description = [
      { text: 'First paragraph', type: 'p', status: 'Y' },
      { text: 'Second paragraph', type: 'p', status: 'Y' },
    ];
    render(<V1DescriptionRenderer description={description} />);
    expect(screen.getByText('First paragraph')).toBeInTheDocument();
    expect(screen.getByText('Second paragraph')).toBeInTheDocument();
  });

  it('skips inactive nodes (status I)', () => {
    const description = [
      { text: 'Active', type: 'p', status: 'Y' },
      { text: 'Inactive', type: 'p', status: 'I' },
    ];
    render(<V1DescriptionRenderer description={description} />);
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.queryByText('Inactive')).not.toBeInTheDocument();
  });

  it('returns null for empty array after filtering inactive', () => {
    const description = [
      { text: 'Inactive', type: 'p', status: 'I' },
    ];
    const { container } = render(<V1DescriptionRenderer description={description} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nested nodes', () => {
    const description = [
      {
        type: 'div',
        text: 'Parent',
        nodes: [
          { type: 'span', text: 'Child' },
        ],
      },
    ];
    render(<V1DescriptionRenderer description={description} />);
    expect(screen.getByText('Parent')).toBeInTheDocument();
    expect(screen.getByText('Child')).toBeInTheDocument();
  });

  it('renders list elements (ul/ol)', () => {
    const description = [
      {
        type: 'ul',
        nodes: [
          { type: 'li', text: 'Item 1' },
          { type: 'li', text: 'Item 2' },
        ],
      },
    ];
    const { container } = render(<V1DescriptionRenderer description={description} />);
    expect(container.querySelector('ul')).toBeInTheDocument();
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
  });

  it('renders br element', () => {
    const description = [{ type: 'br' }];
    const { container } = render(<V1DescriptionRenderer description={description} />);
    expect(container.querySelector('br')).toBeInTheDocument();
  });

  it('applies className prop', () => {
    const { container } = render(
      <V1DescriptionRenderer description="<p>Test</p>" className="custom-class" />
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('applies styleClasses from nodes', () => {
    const description = [
      { type: 'p', text: 'Styled', styleClasses: 'text-bold text-lg' },
    ];
    render(<V1DescriptionRenderer description={description} />);
    const p = screen.getByText('Styled').closest('p');
    expect(p).toHaveClass('text-bold', 'text-lg');
  });

  it('handles styleClasses as array', () => {
    const description = [
      { type: 'p', text: 'Styled', styleClasses: ['text-bold', 'text-lg'] },
    ];
    render(<V1DescriptionRenderer description={description} />);
    const p = screen.getByText('Styled').closest('p');
    expect(p).toHaveClass('text-bold', 'text-lg');
  });

  it('uses div for unknown element types', () => {
    const description = [
      { type: 'custom-tag', text: 'Fallback' },
    ];
    render(<V1DescriptionRenderer description={description} />);
    const el = screen.getByText('Fallback').closest('div');
    expect(el).toBeInTheDocument();
  });
});
