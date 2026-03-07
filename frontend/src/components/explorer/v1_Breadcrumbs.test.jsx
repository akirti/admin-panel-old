import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import V1Breadcrumbs from './v1_Breadcrumbs';

function renderBreadcrumbs(props = {}) {
  return render(
    <MemoryRouter>
      <V1Breadcrumbs {...props} />
    </MemoryRouter>
  );
}

describe('V1Breadcrumbs', () => {
  it('renders Explorer home link', () => {
    renderBreadcrumbs();
    expect(screen.getByText('Explorer')).toBeInTheDocument();
    expect(screen.getByText('Explorer').closest('a')).toHaveAttribute('href', '/explorer');
  });

  it('renders breadcrumb items with links', () => {
    const items = [
      { label: 'Domain A', path: '/explorer/domain-a' },
      { label: 'Scenario 1' },
    ];
    renderBreadcrumbs({ items });

    expect(screen.getByText('Domain A')).toBeInTheDocument();
    expect(screen.getByText('Domain A').closest('a')).toHaveAttribute('href', '/explorer/domain-a');
    expect(screen.getByText('Scenario 1')).toBeInTheDocument();
    // Last item should be a span, not a link
    expect(screen.getByText('Scenario 1').tagName).toBe('SPAN');
  });

  it('renders empty breadcrumbs when no items', () => {
    renderBreadcrumbs({ items: [] });
    expect(screen.getByText('Explorer')).toBeInTheDocument();
  });

  it('renders nav element with correct role', () => {
    const { container } = renderBreadcrumbs();
    expect(container.querySelector('nav')).toBeInTheDocument();
  });
});
