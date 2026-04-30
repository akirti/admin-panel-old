import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UISchemaManagement from '../../../pages/admin/UISchemaManagement';

/* eslint-disable react/prop-types */
jest.mock('../../../components/shared', () => ({
  Card: ({ children, className }) => <div className={className}>{children}</div>,
  Button: ({ children, onClick, type, variant, disabled }) => (
    <button onClick={onClick} type={type || 'button'} disabled={disabled}>{children}</button>
  ),
  Input: ({ label, value, onChange, placeholder, required }) => (
    <div>
      {label && <label>{label}</label>}
      <input value={value} onChange={onChange} placeholder={placeholder} required={required} />
    </div>
  ),
  Table: ({ columns, data, loading }) => (
    <table>
      <thead><tr>{columns.map((c) => <th key={c.key}>{c.title}</th>)}</tr></thead>
      <tbody>
        {(data || []).map((row, i) => (
          <tr key={row._id || i}>
            {columns.map((c) => (
              <td key={c.key}>{c.render ? c.render(row[c.key], row) : (row[c.key] || '')}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  ),
  Modal: ({ isOpen, onClose, title, children }) => isOpen ? (
    <div data-testid="modal">
      <div className="modal-header">{title}</div>
      <div>{children}</div>
    </div>
  ) : null,
  Badge: ({ children }) => <span>{children}</span>,
  SearchInput: ({ value, onChange, placeholder }) => (
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
  ),
  Select: ({ value, onChange, options, label }) => (
    <div>
      {label && <label>{label}</label>}
      <select value={value} onChange={onChange}>
        {(options || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  ),
  Pagination: () => <div data-testid="pagination">pagination</div>,
}));
/* eslint-enable react/prop-types */

jest.mock('../../../services/api', () => ({
  uiTemplatesAPI: {
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    toggleStatus: jest.fn(),
    bumpVersion: jest.fn(),
    addComment: jest.fn(),
  },
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}));

jest.mock('../../../components/admin/UITemplatePreview', () => ({
  __esModule: true,
  default: ({ template }) => <div data-testid="template-preview">{template?.name || 'no-name'}</div>,
}));

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    hasGroup: (group) => group === 'ui-editors',
    hasAnyRole: (roles) => roles.includes('super-administrator'),
  }),
}));

jest.mock('lucide-react', () => ({
  Eye: (p) => <span {...p}>Eye</span>,
  Pencil: (p) => <span {...p}>Pencil</span>,
  Plus: (p) => <span {...p}>Plus</span>,
  ToggleLeft: (p) => <span {...p}>ToggleLeft</span>,
  ToggleRight: (p) => <span {...p}>ToggleRight</span>,
  GitBranch: (p) => <span {...p}>GitBranch</span>,
  ArrowUp: (p) => <span {...p}>ArrowUp</span>,
  ArrowDown: (p) => <span {...p}>ArrowDown</span>,
  Trash2: (p) => <span {...p}>Trash2</span>,
  MessageSquarePlus: (p) => <span {...p}>MessageSquarePlus</span>,
  Code: (p) => <span {...p}>Code</span>,
  ChevronDown: (p) => <span {...p}>ChevronDown</span>,
  ChevronRight: (p) => <span {...p}>ChevronRight</span>,
}));

import { uiTemplatesAPI } from '../../../services/api';
import toast from 'react-hot-toast';

const TEMPLATE_1 = {
  _id: 't1',
  name: 'Scenarios Grid',
  page: 'scenarios',
  component: 'table',
  componentType: 'grid',
  version: '1.0.0',
  status: 'Y',
  accessLevel: 'USR',
  widgets: [],
  usage: [],
};

const TEMPLATE_2 = {
  _id: 't2',
  name: 'Users Form',
  page: 'users',
  component: 'form',
  componentType: 'form',
  version: '2.0.0',
  status: 'N',
  accessLevel: 'ADM',
  widgets: [],
  usage: [],
};

const LIST_RESPONSE = {
  data: {
    data: [TEMPLATE_1, TEMPLATE_2],
    pagination: { page: 0, limit: 25, total: 2, pages: 1 },
  },
};

const EMPTY_LIST = {
  data: { data: [], pagination: { page: 0, limit: 25, total: 0, pages: 0 } },
};

function setupMocks(listResponse = LIST_RESPONSE) {
  uiTemplatesAPI.list.mockResolvedValue(listResponse);
  uiTemplatesAPI.create.mockResolvedValue({ data: {} });
  uiTemplatesAPI.update.mockResolvedValue({ data: {} });
  uiTemplatesAPI.delete.mockResolvedValue({ data: {} });
  uiTemplatesAPI.toggleStatus.mockResolvedValue({ data: {} });
  uiTemplatesAPI.bumpVersion.mockResolvedValue({ data: {} });
  uiTemplatesAPI.addComment.mockResolvedValue({ data: {} });
}

describe('UISchemaManagement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    globalThis.confirm = jest.fn(() => true);
  });

  it('renders page header and New Template button', async () => {
    setupMocks();
    render(<UISchemaManagement />);
    await waitFor(() => {
      expect(screen.getByText('UI Schema Templates')).toBeInTheDocument();
    });
    expect(screen.getByText('New Template')).toBeInTheDocument();
  });

  it('loads and displays templates', async () => {
    setupMocks();
    render(<UISchemaManagement />);
    await waitFor(() => {
      expect(screen.getByText('Scenarios Grid')).toBeInTheDocument();
    });
    expect(screen.getByText('Users Form')).toBeInTheDocument();
  });

  it('shows error toast when list fails', async () => {
    uiTemplatesAPI.list.mockRejectedValue(new Error('fail'));
    render(<UISchemaManagement />);
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to load templates');
    });
  });

  it('handles empty list response gracefully', async () => {
    setupMocks(EMPTY_LIST);
    render(<UISchemaManagement />);
    await waitFor(() => {
      expect(uiTemplatesAPI.list).toHaveBeenCalled();
    });
  });

  it('handles null data in list response', async () => {
    uiTemplatesAPI.list.mockResolvedValue({ data: null });
    render(<UISchemaManagement />);
    await waitFor(() => {
      expect(uiTemplatesAPI.list).toHaveBeenCalled();
    });
  });

  describe('Create template', () => {
    it('opens create modal with form', async () => {
      setupMocks();
      const user = userEvent.setup();
      render(<UISchemaManagement />);
      await waitFor(() => expect(screen.getByText('Scenarios Grid')).toBeInTheDocument());

      // Click the "New Template" button (in the page header)
      const newBtn = screen.getAllByText('New Template')[0];
      await user.click(newBtn);
      await waitFor(() => {
        expect(screen.getByText('Create')).toBeInTheDocument();
      });
    });

    it('shows error on create failure', async () => {
      setupMocks();
      uiTemplatesAPI.create.mockRejectedValue({
        response: { data: { detail: 'Duplicate name' } },
      });
      render(<UISchemaManagement />);
      await waitFor(() => expect(screen.getByText('Scenarios Grid')).toBeInTheDocument());
    });
  });

  describe('Toggle status', () => {
    it('toggles template status', async () => {
      setupMocks();
      const user = userEvent.setup();
      render(<UISchemaManagement />);
      await waitFor(() => expect(screen.getByText('Scenarios Grid')).toBeInTheDocument());

      const toggleButtons = screen.getAllByTitle('Toggle Status');
      await user.click(toggleButtons[0]);

      await waitFor(() => {
        expect(uiTemplatesAPI.toggleStatus).toHaveBeenCalledWith('t1');
      });
      expect(toast.success).toHaveBeenCalledWith('Status toggled to Inactive');
    });

    it('shows error on toggle failure', async () => {
      setupMocks();
      uiTemplatesAPI.toggleStatus.mockRejectedValue(new Error('fail'));
      const user = userEvent.setup();
      render(<UISchemaManagement />);
      await waitFor(() => expect(screen.getByText('Scenarios Grid')).toBeInTheDocument());

      await user.click(screen.getAllByTitle('Toggle Status')[0]);
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to toggle status');
      });
    });
  });

  describe('Delete template', () => {
    it('deletes template after confirmation', async () => {
      setupMocks();
      const user = userEvent.setup();
      render(<UISchemaManagement />);
      await waitFor(() => expect(screen.getByText('Scenarios Grid')).toBeInTheDocument());

      await user.click(screen.getAllByTitle('Delete')[0]);
      expect(globalThis.confirm).toHaveBeenCalled();
      await waitFor(() => {
        expect(uiTemplatesAPI.delete).toHaveBeenCalledWith('t1');
      });
      expect(toast.success).toHaveBeenCalledWith('Template deleted');
    });

    it('cancels delete when not confirmed', async () => {
      setupMocks();
      globalThis.confirm.mockReturnValue(false);
      const user = userEvent.setup();
      render(<UISchemaManagement />);
      await waitFor(() => expect(screen.getByText('Scenarios Grid')).toBeInTheDocument());

      await user.click(screen.getAllByTitle('Delete')[0]);
      expect(uiTemplatesAPI.delete).not.toHaveBeenCalled();
    });

    it('shows error on delete failure', async () => {
      setupMocks();
      uiTemplatesAPI.delete.mockRejectedValue(new Error('fail'));
      const user = userEvent.setup();
      render(<UISchemaManagement />);
      await waitFor(() => expect(screen.getByText('Scenarios Grid')).toBeInTheDocument());

      await user.click(screen.getAllByTitle('Delete')[0]);
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to delete');
      });
    });
  });

  describe('Preview modal', () => {
    it('opens preview modal', async () => {
      setupMocks();
      const user = userEvent.setup();
      render(<UISchemaManagement />);
      await waitFor(() => expect(screen.getByText('Scenarios Grid')).toBeInTheDocument());

      await user.click(screen.getAllByTitle('Preview')[0]);
      await waitFor(() => {
        expect(screen.getByTestId('template-preview')).toBeInTheDocument();
      });
    });
  });

  describe('View JSON modal', () => {
    it('opens JSON detail modal', async () => {
      setupMocks();
      const user = userEvent.setup();
      render(<UISchemaManagement />);
      await waitFor(() => expect(screen.getByText('Scenarios Grid')).toBeInTheDocument());

      await user.click(screen.getAllByTitle('View JSON')[0]);
      await waitFor(() => {
        expect(screen.getByText('Template JSON')).toBeInTheDocument();
      });
    });
  });

  describe('Edit modal', () => {
    it('opens edit modal with populated fields', async () => {
      setupMocks();
      const user = userEvent.setup();
      render(<UISchemaManagement />);
      await waitFor(() => expect(screen.getByText('Scenarios Grid')).toBeInTheDocument());

      await user.click(screen.getAllByTitle('Edit')[0]);
      await waitFor(() => {
        expect(screen.getByText('Edit Template')).toBeInTheDocument();
      });
      expect(screen.getByDisplayValue('Scenarios Grid')).toBeInTheDocument();
      expect(screen.getByDisplayValue('scenarios')).toBeInTheDocument();
    });
  });

  describe('Version bump modal', () => {
    it('opens version bump modal with current version', async () => {
      setupMocks();
      const user = userEvent.setup();
      render(<UISchemaManagement />);
      await waitFor(() => expect(screen.getByText('Scenarios Grid')).toBeInTheDocument());

      await user.click(screen.getAllByTitle('Bump Version')[0]);
      await waitFor(() => {
        expect(screen.getByText(/Current version/)).toBeInTheDocument();
        expect(screen.getByPlaceholderText('e.g. 1.1.0')).toBeInTheDocument();
      });
    });

    it('shows Jira ticket input in version bump form', async () => {
      setupMocks();
      const user = userEvent.setup();
      render(<UISchemaManagement />);
      await waitFor(() => expect(screen.getByText('Scenarios Grid')).toBeInTheDocument());

      await user.click(screen.getAllByTitle('Bump Version')[0]);
      await waitFor(() => {
        expect(screen.getByPlaceholderText('PROJ-123')).toBeInTheDocument();
      });
    });
  });

  describe('Add comment modal', () => {
    it('opens add comment modal with Jira field', async () => {
      setupMocks();
      const user = userEvent.setup();
      render(<UISchemaManagement />);
      await waitFor(() => expect(screen.getByText('Scenarios Grid')).toBeInTheDocument());

      await user.click(screen.getAllByTitle('Add Comment')[0]);
      await waitFor(() => {
        expect(screen.getByText('Jira Ticket')).toBeInTheDocument();
      });
    });
  });

  describe('Filters', () => {
    it('renders search input', async () => {
      setupMocks();
      render(<UISchemaManagement />);
      await waitFor(() => expect(screen.getByText('Scenarios Grid')).toBeInTheDocument());
      expect(screen.getByPlaceholderText(/search by name/i)).toBeInTheDocument();
    });

    it('renders page code filter input', async () => {
      setupMocks();
      render(<UISchemaManagement />);
      await waitFor(() => expect(screen.getByText('Scenarios Grid')).toBeInTheDocument());
      expect(screen.getByPlaceholderText(/filter by page code/i)).toBeInTheDocument();
    });
  });
});
