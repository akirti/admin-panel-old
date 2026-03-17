import { render, screen } from '@testing-library/react';
import UITemplatePreview from '../../../components/admin/UITemplatePreview';

const GRID_WIDGET = {
  key: 'name',
  displayName: 'Name',
  index: 0,
  attributes: [
    { key: 'type', value: 'text' },
    { key: 'sortable', value: 'true' },
    { key: 'editable', value: 'true' },
    { key: 'locked', value: 'true' },
    { key: 'width', value: '200px' },
  ],
};

const FORM_WIDGET_TEXT = {
  key: 'title',
  displayName: 'Title',
  index: 0,
  attributes: [
    { key: 'type', value: 'text' },
    { key: 'required', value: 'true' },
  ],
};

const FORM_WIDGET_TEXTAREA = {
  key: 'description',
  displayName: 'Description',
  index: 1,
  attributes: [{ key: 'type', value: 'textarea' }],
};

const FORM_WIDGET_SELECT = {
  key: 'category',
  displayName: 'Category',
  index: 2,
  attributes: [{ key: 'type', value: 'select' }],
};

const FORM_WIDGET_CHECKBOX = {
  key: 'active',
  displayName: 'Active',
  index: 3,
  attributes: [{ key: 'type', value: 'checkbox' }],
};

const BASE_TEMPLATE = {
  page: 'scenarios',
  component: 'table',
  componentType: 'grid',
  version: 2,
};

describe('UITemplatePreview', () => {
  it('renders null when no template provided', () => {
    const { container } = render(<UITemplatePreview template={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders template metadata', () => {
    render(<UITemplatePreview template={{ ...BASE_TEMPLATE, widgets: [] }} />);
    expect(screen.getByText('scenarios')).toBeInTheDocument();
    expect(screen.getByText('table')).toBeInTheDocument();
    expect(screen.getByText('grid')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('shows empty state when no widgets', () => {
    render(<UITemplatePreview template={{ ...BASE_TEMPLATE, widgets: [] }} />);
    expect(screen.getByText('No widgets defined')).toBeInTheDocument();
  });

  it('does not show component label when component is absent', () => {
    const template = { page: 'test', componentType: 'grid', version: 1, widgets: [] };
    render(<UITemplatePreview template={template} />);
    expect(screen.queryByText('Component:')).not.toBeInTheDocument();
  });

  describe('GridPreview', () => {
    it('renders column headers from widgets', () => {
      const template = { ...BASE_TEMPLATE, widgets: [GRID_WIDGET] };
      render(<UITemplatePreview template={template} />);
      expect(screen.getByText('Name')).toBeInTheDocument();
    });

    it('renders sortable, editable, and locked indicators', () => {
      const template = { ...BASE_TEMPLATE, widgets: [GRID_WIDGET] };
      render(<UITemplatePreview template={template} />);
      expect(screen.getByTitle('Sortable')).toHaveTextContent('S');
      expect(screen.getByTitle('Editable')).toHaveTextContent('E');
      expect(screen.getByTitle('Locked')).toHaveTextContent('L');
    });

    it('renders type badge under column header', () => {
      const template = { ...BASE_TEMPLATE, widgets: [GRID_WIDGET] };
      render(<UITemplatePreview template={template} />);
      expect(screen.getByText('text')).toBeInTheDocument();
    });

    it('renders 3 placeholder rows', () => {
      const template = { ...BASE_TEMPLATE, widgets: [GRID_WIDGET] };
      const { container } = render(<UITemplatePreview template={template} />);
      const rows = container.querySelectorAll('tbody tr');
      expect(rows).toHaveLength(3);
    });

    it('sorts widgets by index', () => {
      const widgets = [
        { key: 'b', displayName: 'Beta', index: 1, attributes: [] },
        { key: 'a', displayName: 'Alpha', index: 0, attributes: [] },
      ];
      const template = { ...BASE_TEMPLATE, widgets };
      const { container } = render(<UITemplatePreview template={template} />);
      const headers = container.querySelectorAll('th');
      expect(headers[0]).toHaveTextContent('Alpha');
      expect(headers[1]).toHaveTextContent('Beta');
    });

    it('hides indicators when attributes are not set', () => {
      const widget = { key: 'plain', displayName: 'Plain', index: 0, attributes: [] };
      const template = { ...BASE_TEMPLATE, widgets: [widget] };
      render(<UITemplatePreview template={template} />);
      expect(screen.queryByTitle('Sortable')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Editable')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Locked')).not.toBeInTheDocument();
    });

    it('handles widget without attributes array', () => {
      const widget = { key: 'bare', displayName: 'Bare', index: 0 };
      const template = { ...BASE_TEMPLATE, widgets: [widget] };
      render(<UITemplatePreview template={template} />);
      expect(screen.getByText('Bare')).toBeInTheDocument();
    });
  });

  describe('FormPreview', () => {
    const FORM_TEMPLATE = { ...BASE_TEMPLATE, componentType: 'form' };

    it('renders text input field', () => {
      render(<UITemplatePreview template={{ ...FORM_TEMPLATE, widgets: [FORM_WIDGET_TEXT] }} />);
      expect(screen.getByText('Title')).toBeInTheDocument();
    });

    it('renders required asterisk', () => {
      render(<UITemplatePreview template={{ ...FORM_TEMPLATE, widgets: [FORM_WIDGET_TEXT] }} />);
      expect(screen.getByText('*')).toBeInTheDocument();
    });

    it('renders textarea field', () => {
      const { container } = render(
        <UITemplatePreview template={{ ...FORM_TEMPLATE, widgets: [FORM_WIDGET_TEXTAREA] }} />
      );
      expect(screen.getByText('Description')).toBeInTheDocument();
      // textarea mock has h-20 class
      expect(container.querySelector('.h-20')).toBeInTheDocument();
    });

    it('renders select field with placeholder', () => {
      render(<UITemplatePreview template={{ ...FORM_TEMPLATE, widgets: [FORM_WIDGET_SELECT] }} />);
      expect(screen.getByText('Category')).toBeInTheDocument();
      expect(screen.getByText('Select...')).toBeInTheDocument();
    });

    it('renders checkbox field', () => {
      render(<UITemplatePreview template={{ ...FORM_TEMPLATE, widgets: [FORM_WIDGET_CHECKBOX] }} />);
      // checkbox renders displayName inside the field
      const activeTexts = screen.getAllByText('Active');
      expect(activeTexts.length).toBeGreaterThanOrEqual(1);
    });

    it('defaults to text type when no type attribute', () => {
      const widget = { key: 'noType', displayName: 'No Type', index: 0, attributes: [] };
      const { container } = render(
        <UITemplatePreview template={{ ...FORM_TEMPLATE, widgets: [widget] }} />
      );
      expect(screen.getByText('No Type')).toBeInTheDocument();
      // default text renders h-10 div (not h-20 textarea, no Select... text)
      expect(container.querySelector('.h-10')).toBeInTheDocument();
      expect(screen.queryByText('Select...')).not.toBeInTheDocument();
    });

    it('sorts form fields by index', () => {
      const widgets = [FORM_WIDGET_TEXTAREA, FORM_WIDGET_TEXT];
      const { container } = render(
        <UITemplatePreview template={{ ...FORM_TEMPLATE, widgets }} />
      );
      const labels = container.querySelectorAll('label');
      expect(labels[0]).toHaveTextContent('Title');
      expect(labels[1]).toHaveTextContent('Description');
    });

    it('matches form componentType case-insensitively', () => {
      const template = { ...BASE_TEMPLATE, componentType: 'DataForm', widgets: [FORM_WIDGET_TEXT] };
      render(<UITemplatePreview template={template} />);
      // Should render form preview (has label), not grid (has th)
      expect(screen.getByText('Title')).toBeInTheDocument();
      expect(screen.queryByRole('columnheader')).not.toBeInTheDocument();
    });
  });

  it('defaults componentType to grid when absent', () => {
    const template = { page: 'test', version: 1, widgets: [GRID_WIDGET] };
    const { container } = render(<UITemplatePreview template={template} />);
    // Should render grid (has table)
    expect(container.querySelector('table')).toBeInTheDocument();
  });

  it('defaults widgets to empty array when absent', () => {
    const template = { page: 'test', componentType: 'grid', version: 1 };
    render(<UITemplatePreview template={template} />);
    expect(screen.getByText('No widgets defined')).toBeInTheDocument();
  });
});
