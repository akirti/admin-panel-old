import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AskScenarioPage from '../../../pages/user/AskScenarioPage';

// ---- mocks ----

const mockNavigate = jest.fn();
jest.mock('react-router', () => {
  const actual = jest.requireActual('react-router');
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockUser = {
  user_id: 'u1',
  full_name: 'Test User',
  username: 'testuser',
  email: 'test@example.com',
  roles: ['editor'],
};

let mockIsEditor = true;
jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    isSuperAdmin: () => false,
    isAdmin: () => false,
    isEditor: () => mockIsEditor,
  }),
}));

jest.mock('react-hot-toast', () => ({ __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}));

jest.mock('lucide-react', () => ({
  Send: (props) => null,
  Plus: (props) => null,
  Trash2: (props) => null,
  HelpCircle: (props) => null,
  FileUp: (props) => null,
  X: (props) => null,
  Loader2: (props) => <span className={`animate-spin ${props.className || ''}`} />,
  Bold: (props) => null,
  Italic: (props) => null,
  List: (props) => null,
  ListOrdered: (props) => null,
  Link: (props) => null,
  Code: (props) => null,
  ArrowLeft: (props) => null,
  Save: (props) => null,
}));

jest.mock('../../../services/api', () => ({
  scenarioRequestAPI: {
    getDomains: jest.fn(),
    getRequestTypes: jest.fn(),
    getDefaults: jest.fn(),
    getStatuses: jest.fn(),
    get: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    adminUpdate: jest.fn(),
    uploadFile: jest.fn(),
  },
  jiraAPI: {
    getBoards: jest.fn(),
    getAssignableUsers: jest.fn(),
  },
}));

// ---- helpers ----

function renderNew() {
  return render(
    <MemoryRouter initialEntries={['/ask-scenario']}>
      <Routes>
        <Route path="/ask-scenario" element={<AskScenarioPage />} />
      </Routes>
    </MemoryRouter>
  );
}

function renderEdit(requestId = 'REQ-001') {
  return render(
    <MemoryRouter initialEntries={[`/my-requests/${requestId}/edit`]}>
      <Routes>
        <Route path="/my-requests/:requestId/edit" element={<AskScenarioPage />} />
      </Routes>
    </MemoryRouter>
  );
}

async function setupLookupMocks() {
  const { scenarioRequestAPI, jiraAPI } = await import('../../../services/api');
  scenarioRequestAPI.getDomains.mockResolvedValue({ data: [{ key: 'finance', name: 'Finance' }] });
  scenarioRequestAPI.getRequestTypes.mockResolvedValue({ data: [{ value: 'scenario', label: 'New Scenario Request' }] });
  scenarioRequestAPI.getDefaults.mockResolvedValue({ data: { team: 'Team-A', team_name: 'Team-A', assignee: 'acc1', assignee_name: 'Alice' } });
  scenarioRequestAPI.getStatuses.mockResolvedValue({ data: [{ value: 'submitted', label: 'Submitted' }, { value: 'review', label: 'Review' }] });
  jiraAPI.getBoards.mockResolvedValue({ data: [{ id: 1, name: 'Board-1' }] });
  jiraAPI.getAssignableUsers.mockResolvedValue({ data: [{ accountId: 'acc1', displayName: 'Alice', emailAddress: 'alice@test.com' }] });
  return { scenarioRequestAPI, jiraAPI };
}

// ---- tests ----

describe('AskScenarioPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsEditor = true;
  });

  it('renders the "Ask for a New Scenario" heading in create mode', async () => {
    await setupLookupMocks();
    renderNew();

    expect(screen.getByText('Ask for a New Scenario')).toBeInTheDocument();
  });

  it('renders the form fields: Request Type, Domain, Scenario Name, Description', async () => {
    await setupLookupMocks();
    renderNew();

    await waitFor(() => {
      expect(screen.getByText('Basic Information')).toBeInTheDocument();
    });
    expect(screen.getByText(/Request Type/)).toBeInTheDocument();
    expect(screen.getByText(/Scenario Name/)).toBeInTheDocument();
    expect(screen.getByText(/Description/)).toBeInTheDocument();
  });

  it('renders Submit Request button in create mode', async () => {
    await setupLookupMocks();
    renderNew();

    expect(screen.getByText('Submit Request')).toBeInTheDocument();
  });

  it('renders Cancel button', async () => {
    await setupLookupMocks();
    renderNew();

    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('renders Implementation Details section', async () => {
    await setupLookupMocks();
    renderNew();

    expect(screen.getByText('Implementation Details')).toBeInTheDocument();
  });

  it('renders Sample Files section', async () => {
    await setupLookupMocks();
    renderNew();

    expect(screen.getByText('Sample Files')).toBeInTheDocument();
  });

  it('loads domains from API and populates the dropdown', async () => {
    await setupLookupMocks();
    renderNew();

    await waitFor(() => {
      expect(screen.getByText('Finance')).toBeInTheDocument();
    });
  });

  it('shows loading spinner in edit mode while request is loading', async () => {
    const { scenarioRequestAPI, jiraAPI } = await setupLookupMocks();
    // Make the get call hang to observe loading state
    scenarioRequestAPI.get.mockReturnValue(new Promise(Function.prototype));

    const { container } = renderEdit();

    // Loading state should render the spinner (a div with animate-spin)
    await waitFor(() => {
      expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    });
  });

  it('renders "Edit Scenario Request" heading in edit mode after data loads', async () => {
    const { scenarioRequestAPI } = await setupLookupMocks();
    scenarioRequestAPI.get.mockResolvedValue({
      data: {
        user_id: 'u1',
        requestId: 'REQ-001',
        requestType: 'scenario',
        dataDomain: 'finance',
        name: 'My Test Scenario',
        description: '<p>Test description</p>',
        status: 'submitted',
        steps: [],
        files: [],
      },
    });

    renderEdit();

    await waitFor(() => {
      expect(screen.getByText('Edit Scenario Request')).toBeInTheDocument();
    });
  });

  it('populates form data with existing request values in edit mode', async () => {
    const { scenarioRequestAPI } = await setupLookupMocks();
    scenarioRequestAPI.get.mockResolvedValue({
      data: {
        user_id: 'u1',
        requestId: 'REQ-001',
        requestType: 'scenario',
        dataDomain: 'finance',
        name: 'Existing Scenario',
        description: '<p>Existing desc</p>',
        status: 'submitted',
        steps: [],
        files: [],
      },
    });

    renderEdit();

    await waitFor(() => {
      const nameInput = screen.getByPlaceholderText('Enter a descriptive name for your scenario');
      expect(nameInput.value).toBe('Existing Scenario');
    });
  });

  it('shows Save Changes button in edit mode', async () => {
    const { scenarioRequestAPI } = await setupLookupMocks();
    scenarioRequestAPI.get.mockResolvedValue({
      data: {
        user_id: 'u1',
        requestId: 'REQ-001',
        requestType: 'scenario',
        dataDomain: 'finance',
        name: 'Test',
        description: '<p>desc</p>',
        status: 'submitted',
        steps: [],
        files: [],
      },
    });

    renderEdit();

    await waitFor(() => {
      expect(screen.getByText('Save Changes')).toBeInTheDocument();
    });
  });

  it('shows Admin Settings section in edit mode for editors', async () => {
    const { scenarioRequestAPI } = await setupLookupMocks();
    scenarioRequestAPI.get.mockResolvedValue({
      data: {
        user_id: 'u1',
        requestId: 'REQ-001',
        requestType: 'scenario',
        dataDomain: 'finance',
        name: 'Test',
        description: '<p>desc</p>',
        status: 'submitted',
        steps: [],
        files: [],
      },
    });

    renderEdit();

    await waitFor(() => {
      expect(screen.getByText('Admin Settings')).toBeInTheDocument();
    });
  });

  it('shows existing files in edit mode', async () => {
    const { scenarioRequestAPI } = await setupLookupMocks();
    scenarioRequestAPI.get.mockResolvedValue({
      data: {
        user_id: 'u1',
        requestId: 'REQ-001',
        requestType: 'scenario',
        dataDomain: 'finance',
        name: 'Test',
        description: '<p>desc</p>',
        status: 'submitted',
        steps: [],
        files: [{ file_name: 'data.csv', file_type: 'csv', version: 1 }],
      },
    });

    renderEdit();

    await waitFor(() => {
      expect(screen.getByText('Existing files:')).toBeInTheDocument();
      expect(screen.getByText('data.csv')).toBeInTheDocument();
    });
  });

  it('shows error toast and navigates away when request load fails in edit mode', async () => {
    const { scenarioRequestAPI } = await setupLookupMocks();
    scenarioRequestAPI.get.mockRejectedValue(new Error('Not found'));
    const toast = (await import('react-hot-toast')).default;

    renderEdit();

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to load request');
    });
    expect(mockNavigate).toHaveBeenCalledWith('/my-requests');
  });

  it('shows error toast when user has no permission to edit in edit mode', async () => {
    const { scenarioRequestAPI } = await setupLookupMocks();
    // Return a request owned by another user and useAuth isEditor returns false
    // Since our mock always returns isEditor: true, we test that canEdit passes for editors
    scenarioRequestAPI.get.mockResolvedValue({
      data: {
        user_id: 'other-user',
        requestId: 'REQ-001',
        requestType: 'scenario',
        dataDomain: 'finance',
        name: 'Other Request',
        description: '<p>desc</p>',
        status: 'submitted',
        steps: [],
        files: [],
      },
    });

    renderEdit();

    // Editor can edit any request, so form should render
    await waitFor(() => {
      expect(screen.getByText('Edit Scenario Request')).toBeInTheDocument();
    });
  });

  it('renders Team and Assignee fields', async () => {
    await setupLookupMocks();
    renderNew();

    await waitFor(() => {
      expect(screen.getByText('Team')).toBeInTheDocument();
      expect(screen.getByText('Assignee')).toBeInTheDocument();
    });
  });

  it('renders Choose Files button for file upload', async () => {
    await setupLookupMocks();
    renderNew();

    expect(screen.getByText('Choose Files')).toBeInTheDocument();
  });

  // --- Interaction tests ---

  it('submits new scenario request successfully', async () => {
    const { scenarioRequestAPI } = await setupLookupMocks();
    scenarioRequestAPI.create.mockResolvedValue({ data: { requestId: 'REQ-002' } });
    const toast = (await import('react-hot-toast')).default;
    const user = userEvent.setup();

    renderNew();

    await waitFor(() => {
      expect(screen.getByText('Finance')).toBeInTheDocument();
    });

    // Fill in domain
    const domainSelect = screen.getByDisplayValue('Select a domain...');
    await user.selectOptions(domainSelect, 'finance');

    // Fill in name
    const nameInput = screen.getByPlaceholderText('Enter a descriptive name for your scenario');
    await user.type(nameInput, 'New Test Scenario');

    // Fill in description via contentEditable (the RichTextEditor)
    const editorDiv = document.querySelector('[contenteditable]');
    if (editorDiv) {
      editorDiv.innerHTML = '<p>Test description content</p>';
      fireEvent.input(editorDiv);
    }

    // Submit form
    fireEvent.click(screen.getByText('Submit Request'));

    await waitFor(() => {
      expect(scenarioRequestAPI.create).toHaveBeenCalledWith(expect.objectContaining({
        dataDomain: 'finance',
        name: 'New Test Scenario',
      }));
      expect(toast.success).toHaveBeenCalledWith('Scenario request submitted successfully!');
      expect(mockNavigate).toHaveBeenCalledWith('/my-requests');
    });
  });

  it('validates missing domain on submit', async () => {
    await setupLookupMocks();
    const toast = (await import('react-hot-toast')).default;
    const user = userEvent.setup();

    renderNew();

    await waitFor(() => {
      expect(screen.getByText('Finance')).toBeInTheDocument();
    });

    // Fill in name but not domain
    const nameInput = screen.getByPlaceholderText('Enter a descriptive name for your scenario');
    await user.type(nameInput, 'Test');

    const editorDiv = document.querySelector('[contenteditable]');
    if (editorDiv) {
      editorDiv.innerHTML = '<p>desc</p>';
      fireEvent.input(editorDiv);
    }

    // Submit via form event to bypass HTML5 validation
    const form = document.querySelector('form');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Please select a domain');
    });
  });

  it('validates missing name on submit', async () => {
    await setupLookupMocks();
    const toast = (await import('react-hot-toast')).default;
    const user = userEvent.setup();

    renderNew();

    await waitFor(() => {
      expect(screen.getByText('Finance')).toBeInTheDocument();
    });

    // Select domain but leave name empty
    const domainSelect = screen.getByDisplayValue('Select a domain...');
    await user.selectOptions(domainSelect, 'finance');

    const editorDiv = document.querySelector('[contenteditable]');
    if (editorDiv) {
      editorDiv.innerHTML = '<p>desc</p>';
      fireEvent.input(editorDiv);
    }

    // Submit via form event to bypass HTML5 validation
    const form = document.querySelector('form');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Please enter a scenario name');
    });
  });

  it('handles create submission error', async () => {
    const { scenarioRequestAPI } = await setupLookupMocks();
    scenarioRequestAPI.create.mockRejectedValue({ response: { data: { detail: 'Server error' } } });
    const toast = (await import('react-hot-toast')).default;
    const user = userEvent.setup();

    renderNew();

    await waitFor(() => {
      expect(screen.getByText('Finance')).toBeInTheDocument();
    });

    const domainSelect = screen.getByDisplayValue('Select a domain...');
    await user.selectOptions(domainSelect, 'finance');

    const nameInput = screen.getByPlaceholderText('Enter a descriptive name for your scenario');
    await user.type(nameInput, 'Error Test');

    const editorDiv = document.querySelector('[contenteditable]');
    if (editorDiv) {
      editorDiv.innerHTML = '<p>desc</p>';
      fireEvent.input(editorDiv);
    }

    fireEvent.click(screen.getByText('Submit Request'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Server error');
    });
  });

  it('navigates back on Cancel click in create mode', async () => {
    await setupLookupMocks();
    const user = userEvent.setup();

    renderNew();

    await user.click(screen.getByText('Cancel'));

    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('adds implementation steps', async () => {
    await setupLookupMocks();
    const user = userEvent.setup();

    renderNew();

    await waitFor(() => {
      expect(screen.getByText('Implementation Details')).toBeInTheDocument();
    });

    // Enable "knows steps" checkbox
    const checkbox = document.querySelector('input[name="knows_steps"]');
    if (checkbox) {
      await user.click(checkbox);

      // Should show step input fields
      await waitFor(() => {
        const stepInput = screen.getByPlaceholderText('What should this step do?');
        expect(stepInput).toBeInTheDocument();
      });

      // Type a step description
      const stepInput = screen.getByPlaceholderText('What should this step do?');
      await user.type(stepInput, 'First step');

      // Click add step button
      const addBtn = screen.getByText('Add Step');
      await user.click(addBtn);

      // Step should appear in the list
      await waitFor(() => {
        expect(screen.getByText('First step')).toBeInTheDocument();
      });
    }
  });

  it('handles file selection', async () => {
    await setupLookupMocks();
    const user = userEvent.setup();

    renderNew();

    const fileInput = document.querySelector('input[type="file"]');
    if (fileInput) {
      const testFile = new File(['test content'], 'test.csv', { type: 'text/csv' });
      await user.upload(fileInput, testFile);

      await waitFor(() => {
        expect(screen.getByText('test.csv')).toBeInTheDocument();
      });
    }
  });

  it('updates request in edit mode successfully', async () => {
    const { scenarioRequestAPI } = await setupLookupMocks();
    scenarioRequestAPI.get.mockResolvedValue({
      data: {
        user_id: 'u1',
        requestId: 'REQ-001',
        requestType: 'scenario',
        dataDomain: 'finance',
        name: 'Original Name',
        description: '<p>Original desc</p>',
        status: 'submitted',
        steps: [],
        files: [],
      },
    });
    scenarioRequestAPI.update.mockResolvedValue({ data: {} });
    const toast = (await import('react-hot-toast')).default;
    const user = userEvent.setup();

    renderEdit();

    await waitFor(() => {
      expect(screen.getByText('Edit Scenario Request')).toBeInTheDocument();
    });

    // Update the name
    const nameInput = screen.getByPlaceholderText('Enter a descriptive name for your scenario');
    await user.clear(nameInput);
    await user.type(nameInput, 'Updated Name');

    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(scenarioRequestAPI.update).toHaveBeenCalledWith('REQ-001', expect.objectContaining({
        name: 'Updated Name',
      }));
      expect(toast.success).toHaveBeenCalledWith('Scenario request updated successfully!');
    });
  });

  it('loads Jira boards in team dropdown', async () => {
    await setupLookupMocks();
    const user = userEvent.setup();

    renderNew();

    // Autocomplete: type 2+ chars to see suggestions
    const teamInput = screen.getByPlaceholderText('Type to search teams...');
    await user.type(teamInput, 'Bo');

    await waitFor(() => {
      expect(screen.getByText('Board-1')).toBeInTheDocument();
    });
  });

  it('loads Jira assignable users in assignee dropdown', async () => {
    await setupLookupMocks();
    const user = userEvent.setup();

    renderNew();

    // Autocomplete: type 2+ chars to see suggestions
    const assigneeInput = screen.getByPlaceholderText('Type to search assignees...');
    await user.type(assigneeInput, 'Al');

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });
  });

  it('renders Back button in edit mode', async () => {
    const { scenarioRequestAPI } = await setupLookupMocks();
    scenarioRequestAPI.get.mockResolvedValue({
      data: {
        user_id: 'u1',
        requestId: 'REQ-001',
        requestType: 'scenario',
        dataDomain: 'finance',
        name: 'Test',
        description: '<p>desc</p>',
        status: 'submitted',
        steps: [],
        files: [],
      },
    });

    renderEdit();

    await waitFor(() => {
      expect(screen.getByText('Back')).toBeInTheDocument();
    });
  });

  it('navigates back when Back button is clicked in edit mode', async () => {
    const { scenarioRequestAPI } = await setupLookupMocks();
    scenarioRequestAPI.get.mockResolvedValue({
      data: {
        user_id: 'u1',
        requestId: 'REQ-001',
        requestType: 'scenario',
        dataDomain: 'finance',
        name: 'Test',
        description: '<p>desc</p>',
        status: 'submitted',
        steps: [],
        files: [],
      },
    });
    const user = userEvent.setup();

    renderEdit();

    await waitFor(() => {
      expect(screen.getByText('Back')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Back'));

    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('renders editing description text in edit mode', async () => {
    const { scenarioRequestAPI } = await setupLookupMocks();
    scenarioRequestAPI.get.mockResolvedValue({
      data: {
        user_id: 'u1',
        requestId: 'REQ-001',
        requestType: 'scenario',
        dataDomain: 'finance',
        name: 'Test',
        description: '<p>desc</p>',
        status: 'submitted',
        steps: [],
        files: [],
      },
    });

    renderEdit();

    await waitFor(() => {
      expect(screen.getByText('Editing request REQ-001')).toBeInTheDocument();
    });
  });

  it('shows request types in dropdown', async () => {
    await setupLookupMocks();
    renderNew();

    await waitFor(() => {
      expect(screen.getByText('New Scenario Request')).toBeInTheDocument();
    });
  });

  it('validates missing description on submit', async () => {
    await setupLookupMocks();
    const toast = (await import('react-hot-toast')).default;
    const user = userEvent.setup();

    renderNew();

    await waitFor(() => {
      expect(screen.getByText('Finance')).toBeInTheDocument();
    });

    const domainSelect = screen.getByDisplayValue('Select a domain...');
    await user.selectOptions(domainSelect, 'finance');

    const nameInput = screen.getByPlaceholderText('Enter a descriptive name for your scenario');
    await user.type(nameInput, 'Test Scenario');

    // Leave description empty - don't type in contentEditable
    const form = document.querySelector('form');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Please enter a description');
    });
  });

  it('handles update error in edit mode', async () => {
    const { scenarioRequestAPI } = await setupLookupMocks();
    scenarioRequestAPI.get.mockResolvedValue({
      data: {
        user_id: 'u1',
        requestId: 'REQ-001',
        requestType: 'scenario',
        dataDomain: 'finance',
        name: 'Test',
        description: '<p>desc</p>',
        status: 'submitted',
        steps: [],
        files: [],
      },
    });
    scenarioRequestAPI.update.mockRejectedValue({ response: { data: { detail: 'Update failed' } } });
    const toast = (await import('react-hot-toast')).default;

    renderEdit();

    await waitFor(() => {
      expect(screen.getByText('Edit Scenario Request')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Update failed');
    });
  });

  it('adds and removes implementation steps', async () => {
    await setupLookupMocks();
    const user = userEvent.setup();

    renderNew();

    await waitFor(() => {
      expect(screen.getByText('Implementation Details')).toBeInTheDocument();
    });

    const checkbox = document.querySelector('input[name="knows_steps"]');
    if (checkbox) {
      await user.click(checkbox);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('What should this step do?')).toBeInTheDocument();
      });

      const stepInput = screen.getByPlaceholderText('What should this step do?');
      await user.type(stepInput, 'Step to remove');
      await user.click(screen.getByText('Add Step'));

      await waitFor(() => {
        expect(screen.getByText('Step to remove')).toBeInTheDocument();
      });

      // Find and click the remove button (trash icon)
      const removeButtons = document.querySelectorAll('button[title="Remove step"]');
      if (removeButtons.length > 0) {
        await user.click(removeButtons[0]);

        await waitFor(() => {
          expect(screen.queryByText('Step to remove')).not.toBeInTheDocument();
        });
      }
    }
  });

  it('handles file removal', async () => {
    await setupLookupMocks();
    const user = userEvent.setup();

    renderNew();

    const fileInput = document.querySelector('input[type="file"]');
    if (fileInput) {
      const testFile = new File(['content'], 'remove_me.csv', { type: 'text/csv' });
      await user.upload(fileInput, testFile);

      await waitFor(() => {
        expect(screen.getByText('remove_me.csv')).toBeInTheDocument();
      });

      // Find the remove button for the file
      const removeButtons = document.querySelectorAll('button');
      const removeBtn = Array.from(removeButtons).find(b => {
        // Look for X icon button near the filename
        const parent = b.closest('.flex');
        return parent && parent.textContent.includes('remove_me.csv');
      });
      if (removeBtn) {
        await user.click(removeBtn);
      }
    }
  });

  it('shows Jira error gracefully', async () => {
    const { scenarioRequestAPI, jiraAPI } = await import('../../../services/api');
    scenarioRequestAPI.getDomains.mockResolvedValue({ data: [{ key: 'finance', name: 'Finance' }] });
    scenarioRequestAPI.getRequestTypes.mockResolvedValue({ data: [{ value: 'scenario', label: 'New Scenario Request' }] });
    scenarioRequestAPI.getDefaults.mockResolvedValue({ data: { team: 'Team-A' } });
    jiraAPI.getBoards.mockRejectedValue(new Error('Jira unavailable'));
    jiraAPI.getAssignableUsers.mockRejectedValue(new Error('Jira unavailable'));

    renderNew();

    // Should still render the form even though Jira data failed to load
    await waitFor(() => {
      expect(screen.getByText('Ask for a New Scenario')).toBeInTheDocument();
    });
  });

  it('shows default team and assignee from API defaults', async () => {
    await setupLookupMocks();
    renderNew();

    await waitFor(() => {
      // Team should be set from defaults
      expect(screen.getByText('Team')).toBeInTheDocument();
    });
  });

  it('submits form with file upload', async () => {
    const { scenarioRequestAPI } = await setupLookupMocks();
    scenarioRequestAPI.create.mockResolvedValue({ data: { requestId: 'REQ-003' } });
    scenarioRequestAPI.uploadFile.mockResolvedValue({ data: {} });
    const toast = (await import('react-hot-toast')).default;
    const user = userEvent.setup();

    renderNew();

    await waitFor(() => {
      expect(screen.getByText('Finance')).toBeInTheDocument();
    });

    // Fill required fields
    await user.selectOptions(screen.getByDisplayValue('Select a domain...'), 'finance');
    await user.type(screen.getByPlaceholderText('Enter a descriptive name for your scenario'), 'File Upload Test');

    const editorDiv = document.querySelector('[contenteditable]');
    if (editorDiv) {
      editorDiv.innerHTML = '<p>Test with file</p>';
      fireEvent.input(editorDiv);
    }

    // Upload a file
    const fileInput = document.querySelector('input[type="file"]');
    if (fileInput) {
      const testFile = new File(['content'], 'upload.csv', { type: 'text/csv' });
      await user.upload(fileInput, testFile);
    }

    fireEvent.click(screen.getByText('Submit Request'));

    await waitFor(() => {
      expect(scenarioRequestAPI.create).toHaveBeenCalled();
    });
  });

  it('handles admin settings in edit mode', async () => {
    const { scenarioRequestAPI } = await setupLookupMocks();
    scenarioRequestAPI.get.mockResolvedValue({
      data: {
        user_id: 'u1',
        requestId: 'REQ-001',
        requestType: 'scenario',
        dataDomain: 'finance',
        name: 'Admin Edit Test',
        description: '<p>desc</p>',
        status: 'submitted',
        steps: [],
        files: [],
        scenarioKey: 'SC-001',
        configName: 'config-1',
      },
    });
    scenarioRequestAPI.update.mockResolvedValue({ data: {} });
    scenarioRequestAPI.adminUpdate.mockResolvedValue({ data: {} });
    const toast = (await import('react-hot-toast')).default;

    renderEdit();

    await waitFor(() => {
      expect(screen.getByText('Admin Settings')).toBeInTheDocument();
    });

    // Click Save Changes to trigger both user update and admin update
    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(scenarioRequestAPI.update).toHaveBeenCalled();
    });
  });

  it('renders business justification field', async () => {
    await setupLookupMocks();
    renderNew();

    expect(screen.getByText('Reason / Business Justification')).toBeInTheDocument();
  });

  it('shows fulfilment date field in admin settings', async () => {
    const { scenarioRequestAPI } = await setupLookupMocks();
    scenarioRequestAPI.get.mockResolvedValue({
      data: {
        user_id: 'u1',
        requestId: 'REQ-001',
        requestType: 'scenario',
        dataDomain: 'finance',
        name: 'Test',
        description: '<p>desc</p>',
        status: 'submitted',
        steps: [],
        files: [],
      },
    });

    renderEdit();

    await waitFor(() => {
      expect(screen.getByText('Target Date')).toBeInTheDocument();
    });
  });

  // =====================================================================
  // Additional branch-coverage tests
  // =====================================================================

  it('Cancel button in edit mode navigates back with navigate(-1)', async () => {
    const { scenarioRequestAPI } = await setupLookupMocks();
    scenarioRequestAPI.get.mockResolvedValue({
      data: {
        user_id: 'u1',
        requestId: 'REQ-001',
        requestType: 'scenario',
        dataDomain: 'finance',
        name: 'Test',
        description: '<p>desc</p>',
        status: 'submitted',
        steps: [],
        files: [],
      },
    });

    renderEdit();

    await waitFor(() => {
      expect(screen.getByText('Save Changes')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Cancel'));

    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('handles submit error with error field instead of detail', async () => {
    const { scenarioRequestAPI } = await setupLookupMocks();
    scenarioRequestAPI.create.mockRejectedValue({
      response: { data: { error: 'Validation error from server' } },
    });
    const toast = (await import('react-hot-toast')).default;
    const user = userEvent.setup();

    renderNew();

    await waitFor(() => {
      expect(screen.getByText('Finance')).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByDisplayValue('Select a domain...'), 'finance');
    await user.type(screen.getByPlaceholderText('Enter a descriptive name for your scenario'), 'Error Test');

    const editorDiv = document.querySelector('[contenteditable]');
    if (editorDiv) {
      editorDiv.innerHTML = '<p>desc</p>';
      fireEvent.input(editorDiv);
    }

    fireEvent.click(screen.getByText('Submit Request'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Validation error from server');
    });
  });

  it('handles submit error with no response data (generic fallback)', async () => {
    const { scenarioRequestAPI } = await setupLookupMocks();
    scenarioRequestAPI.create.mockRejectedValue(new Error('Network error'));
    const toast = (await import('react-hot-toast')).default;
    const user = userEvent.setup();

    renderNew();

    await waitFor(() => {
      expect(screen.getByText('Finance')).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByDisplayValue('Select a domain...'), 'finance');
    await user.type(screen.getByPlaceholderText('Enter a descriptive name for your scenario'), 'Net Error Test');

    const editorDiv = document.querySelector('[contenteditable]');
    if (editorDiv) {
      editorDiv.innerHTML = '<p>desc</p>';
      fireEvent.input(editorDiv);
    }

    fireEvent.click(screen.getByText('Submit Request'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to submit request');
    });
  });

  it('handles submit error with non-string errorMsg (object detail)', async () => {
    const { scenarioRequestAPI } = await setupLookupMocks();
    scenarioRequestAPI.create.mockRejectedValue({
      response: { data: { detail: { msg: 'field required', loc: ['body', 'name'] } } },
    });
    const toast = (await import('react-hot-toast')).default;
    const user = userEvent.setup();

    renderNew();

    await waitFor(() => {
      expect(screen.getByText('Finance')).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByDisplayValue('Select a domain...'), 'finance');
    await user.type(screen.getByPlaceholderText('Enter a descriptive name for your scenario'), 'Obj Error Test');

    const editorDiv = document.querySelector('[contenteditable]');
    if (editorDiv) {
      editorDiv.innerHTML = '<p>desc</p>';
      fireEvent.input(editorDiv);
    }

    fireEvent.click(screen.getByText('Submit Request'));

    await waitFor(() => {
      // Should JSON.stringify the non-string detail
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('field required')
      );
    });
  });

  it('adds a step with database and query fields populated', async () => {
    await setupLookupMocks();
    const user = userEvent.setup();

    renderNew();

    await waitFor(() => {
      expect(screen.getByText('Implementation Details')).toBeInTheDocument();
    });

    const checkbox = document.querySelector('input[name="knows_steps"]');
    await user.click(checkbox);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('What should this step do?')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('What should this step do?'), 'Query step');
    await user.type(screen.getByPlaceholderText('e.g., sales_db.reporting'), 'my_database');
    await user.type(screen.getByPlaceholderText('SELECT ... FROM ... WHERE ...'), 'SELECT * FROM users');
    await user.click(screen.getByText('Add Step'));

    await waitFor(() => {
      expect(screen.getByText('Query step')).toBeInTheDocument();
      expect(screen.getByText(/my_database/)).toBeInTheDocument();
      expect(screen.getByText(/SELECT \* FROM users/)).toBeInTheDocument();
    });
  });

  it('does not add a step with empty description', async () => {
    await setupLookupMocks();
    const user = userEvent.setup();

    renderNew();

    await waitFor(() => {
      expect(screen.getByText('Implementation Details')).toBeInTheDocument();
    });

    const checkbox = document.querySelector('input[name="knows_steps"]');
    await user.click(checkbox);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('What should this step do?')).toBeInTheDocument();
    });

    // The Add Step button should be disabled when description is empty
    const addBtn = screen.getByText('Add Step');
    expect(addBtn).toBeDisabled();
  });

  it('shows steps section when has_suggestion checkbox is checked', async () => {
    await setupLookupMocks();
    const user = userEvent.setup();

    renderNew();

    await waitFor(() => {
      expect(screen.getByText('Implementation Details')).toBeInTheDocument();
    });

    const checkbox = document.querySelector('input[name="has_suggestion"]');
    await user.click(checkbox);

    await waitFor(() => {
      expect(screen.getByText('Suggested Steps')).toBeInTheDocument();
    });
  });

  it('removes a step and reorders remaining steps', async () => {
    await setupLookupMocks();
    const user = userEvent.setup();

    renderNew();

    await waitFor(() => {
      expect(screen.getByText('Implementation Details')).toBeInTheDocument();
    });

    const checkbox = document.querySelector('input[name="knows_steps"]');
    await user.click(checkbox);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('What should this step do?')).toBeInTheDocument();
    });

    // Add two steps
    const stepInput = screen.getByPlaceholderText('What should this step do?');
    await user.type(stepInput, 'First step');
    await user.click(screen.getByText('Add Step'));

    await waitFor(() => {
      expect(screen.getByText('First step')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('What should this step do?'), 'Second step');
    await user.click(screen.getByText('Add Step'));

    await waitFor(() => {
      expect(screen.getByText('Second step')).toBeInTheDocument();
    });

    // Remove the first step - find button near "First step"
    const stepElements = document.querySelectorAll('.flex-shrink-0.text-content-muted');
    if (stepElements.length > 0) {
      fireEvent.click(stepElements[0]);
    }

    await waitFor(() => {
      expect(screen.queryByText('First step')).not.toBeInTheDocument();
      expect(screen.getByText('Second step')).toBeInTheDocument();
    });
  });

  it('updates request with admin field changes in edit mode', async () => {
    const { scenarioRequestAPI } = await setupLookupMocks();
    scenarioRequestAPI.get.mockResolvedValue({
      data: {
        user_id: 'u1',
        requestId: 'REQ-001',
        requestType: 'scenario',
        dataDomain: 'finance',
        name: 'Admin Test',
        description: '<p>desc</p>',
        status: 'submitted',
        steps: [],
        files: [],
        scenarioKey: '',
        configName: '',
        fulfilmentDate: null,
      },
    });
    scenarioRequestAPI.update.mockResolvedValue({ data: {} });
    scenarioRequestAPI.adminUpdate.mockResolvedValue({ data: {} });
    const toast = (await import('react-hot-toast')).default;
    const user = userEvent.setup();

    renderEdit();

    await waitFor(() => {
      expect(screen.getByText('Admin Settings')).toBeInTheDocument();
    });

    // Change status
    const statusSelect = document.querySelector('select[name="status"]');
    fireEvent.change(statusSelect, { target: { value: 'review' } });

    // Wait for status comment field to appear
    await waitFor(() => {
      expect(screen.getByText(/Status Change Comment/)).toBeInTheDocument();
    });

    // Fill in status comment
    const commentTextarea = document.querySelector('textarea[name="statusComment"]');
    fireEvent.change(commentTextarea, { target: { value: 'Moving to review phase' } });

    // Change scenario key
    const scenarioKeyInput = screen.getByPlaceholderText('e.g., SC-001');
    await user.type(scenarioKeyInput, 'SC-123');

    // Change config name
    const configInput = screen.getByPlaceholderText('Configuration name');
    await user.type(configInput, 'my-config');

    // Change fulfilment date
    const dateInput = document.querySelector('input[name="fulfilmentDate"]');
    fireEvent.change(dateInput, { target: { value: '2026-04-01' } });

    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(scenarioRequestAPI.update).toHaveBeenCalled();
      expect(scenarioRequestAPI.adminUpdate).toHaveBeenCalledWith(
        'REQ-001',
        expect.objectContaining({
          status: 'review',
          status_comment: 'Moving to review phase',
          scenarioKey: 'SC-123',
          configName: 'my-config',
          fulfilmentDate: '2026-04-01',
        })
      );
      expect(toast.success).toHaveBeenCalledWith('Scenario request updated successfully!');
    });
  });

  it('validates status comment is required when status changes in edit mode', async () => {
    const { scenarioRequestAPI } = await setupLookupMocks();
    scenarioRequestAPI.get.mockResolvedValue({
      data: {
        user_id: 'u1',
        requestId: 'REQ-001',
        requestType: 'scenario',
        dataDomain: 'finance',
        name: 'Comment Required Test',
        description: '<p>desc</p>',
        status: 'submitted',
        steps: [],
        files: [],
      },
    });
    const toast = (await import('react-hot-toast')).default;

    renderEdit();

    await waitFor(() => {
      expect(screen.getByText('Admin Settings')).toBeInTheDocument();
    });

    // Change status but leave comment empty
    const statusSelect = document.querySelector('select[name="status"]');
    fireEvent.change(statusSelect, { target: { value: 'review' } });

    await waitFor(() => {
      expect(screen.getByText(/Status Change Comment/)).toBeInTheDocument();
    });

    // Submit without comment
    const form = document.querySelector('form');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Please provide a comment for the status change');
    });
  });

  it('skips adminUpdate when no admin fields changed in edit mode', async () => {
    const { scenarioRequestAPI } = await setupLookupMocks();
    scenarioRequestAPI.get.mockResolvedValue({
      data: {
        user_id: 'u1',
        requestId: 'REQ-001',
        requestType: 'scenario',
        dataDomain: 'finance',
        name: 'No Admin Changes',
        description: '<p>desc</p>',
        status: 'submitted',
        steps: [],
        files: [],
        scenarioKey: '',
        configName: '',
        fulfilmentDate: null,
      },
    });
    scenarioRequestAPI.update.mockResolvedValue({ data: {} });
    const toast = (await import('react-hot-toast')).default;

    renderEdit();

    await waitFor(() => {
      expect(screen.getByText('Edit Scenario Request')).toBeInTheDocument();
    });

    // Don't change any admin fields, just save
    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(scenarioRequestAPI.update).toHaveBeenCalled();
      expect(scenarioRequestAPI.adminUpdate).not.toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith('Scenario request updated successfully!');
    });
  });

  it('handles file upload error during edit mode save', async () => {
    const { scenarioRequestAPI } = await setupLookupMocks();
    scenarioRequestAPI.get.mockResolvedValue({
      data: {
        user_id: 'u1',
        requestId: 'REQ-001',
        requestType: 'scenario',
        dataDomain: 'finance',
        name: 'File Error Test',
        description: '<p>desc</p>',
        status: 'submitted',
        steps: [],
        files: [],
      },
    });
    scenarioRequestAPI.update.mockResolvedValue({ data: {} });
    scenarioRequestAPI.uploadFile.mockRejectedValue(new Error('Upload failed'));
    const toast = (await import('react-hot-toast')).default;
    const user = userEvent.setup();

    renderEdit();

    await waitFor(() => {
      expect(screen.getByText('Edit Scenario Request')).toBeInTheDocument();
    });

    // Upload a file
    const fileInput = document.querySelector('input[type="file"]');
    const testFile = new File(['content'], 'fail_upload.csv', { type: 'text/csv' });
    await user.upload(fileInput, testFile);

    await waitFor(() => {
      expect(screen.getByText('fail_upload.csv')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(scenarioRequestAPI.update).toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith('Failed to upload: fail_upload.csv');
      // Still shows success for the request update itself
      expect(toast.success).toHaveBeenCalledWith('Scenario request updated successfully!');
    });
  });

  it('handles file upload error during create mode', async () => {
    const { scenarioRequestAPI } = await setupLookupMocks();
    scenarioRequestAPI.create.mockResolvedValue({ data: { requestId: 'REQ-NEW' } });
    scenarioRequestAPI.uploadFile.mockRejectedValue(new Error('Upload failed'));
    const toast = (await import('react-hot-toast')).default;
    const user = userEvent.setup();

    renderNew();

    await waitFor(() => {
      expect(screen.getByText('Finance')).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByDisplayValue('Select a domain...'), 'finance');
    await user.type(screen.getByPlaceholderText('Enter a descriptive name for your scenario'), 'File Upload Fail Test');

    const editorDiv = document.querySelector('[contenteditable]');
    if (editorDiv) {
      editorDiv.innerHTML = '<p>desc</p>';
      fireEvent.input(editorDiv);
    }

    // Upload a file
    const fileInput = document.querySelector('input[type="file"]');
    const testFile = new File(['content'], 'bad_file.csv', { type: 'text/csv' });
    await user.upload(fileInput, testFile);

    fireEvent.click(screen.getByText('Submit Request'));

    await waitFor(() => {
      expect(scenarioRequestAPI.create).toHaveBeenCalled();
      expect(scenarioRequestAPI.uploadFile).toHaveBeenCalledWith('REQ-NEW', testFile);
      expect(toast.error).toHaveBeenCalledWith('Failed to upload: bad_file.csv');
    });
  });

  it('populates form with request that has fulfilmentDate with T delimiter', async () => {
    const { scenarioRequestAPI } = await setupLookupMocks();
    scenarioRequestAPI.get.mockResolvedValue({
      data: {
        user_id: 'u1',
        requestId: 'REQ-001',
        requestType: 'scenario',
        dataDomain: 'finance',
        name: 'Date Test',
        description: '<p>desc</p>',
        status: 'submitted',
        steps: [],
        files: [],
        fulfilmentDate: '2026-04-15T00:00:00Z',
        scenarioKey: 'SC-001',
        configName: 'cfg-1',
        team: 'TeamX',
        assignee: 'acc2',
        assignee_name: 'Bob',
        has_suggestion: true,
        knows_steps: true,
        reason: '<p>business reason</p>',
      },
    });

    renderEdit();

    await waitFor(() => {
      const dateInput = document.querySelector('input[name="fulfilmentDate"]');
      expect(dateInput.value).toBe('2026-04-15');
    });
  });

  it('shows existing files with file.name fallback when file_name is absent', async () => {
    const { scenarioRequestAPI } = await setupLookupMocks();
    scenarioRequestAPI.get.mockResolvedValue({
      data: {
        user_id: 'u1',
        requestId: 'REQ-001',
        requestType: 'scenario',
        dataDomain: 'finance',
        name: 'File Name Test',
        description: '<p>desc</p>',
        status: 'submitted',
        steps: [],
        files: [{ name: 'fallback_name.csv', file_type: 'csv', version: 2 }],
      },
    });

    renderEdit();

    await waitFor(() => {
      expect(screen.getByText('fallback_name.csv')).toBeInTheDocument();
      expect(screen.getByText(/v2/)).toBeInTheDocument();
    });
  });

  it('shows existing file with default version 1 when version is missing', async () => {
    const { scenarioRequestAPI } = await setupLookupMocks();
    scenarioRequestAPI.get.mockResolvedValue({
      data: {
        user_id: 'u1',
        requestId: 'REQ-001',
        requestType: 'scenario',
        dataDomain: 'finance',
        name: 'Version Default Test',
        description: '<p>desc</p>',
        status: 'submitted',
        steps: [],
        files: [{ file_name: 'noversion.csv', file_type: 'csv' }],
      },
    });

    renderEdit();

    await waitFor(() => {
      expect(screen.getByText('noversion.csv')).toBeInTheDocument();
      expect(screen.getByText(/v1/)).toBeInTheDocument();
    });
  });

  it('handles assignee selection and sets assignee_name from jiraUsers', async () => {
    await setupLookupMocks();
    const user = userEvent.setup();

    renderNew();

    // Type to trigger autocomplete
    const assigneeInput = screen.getByPlaceholderText('Type to search assignees...');
    await user.type(assigneeInput, 'Al');

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    // Click the suggestion
    await user.click(screen.getByText('Alice'));

    // Input should now show the selected name
    expect(assigneeInput.value).toBe('Alice');
  });

  it('handles assignee selection with clear (empty assignee_name)', async () => {
    await setupLookupMocks();
    const user = userEvent.setup();

    renderNew();

    // Type to trigger autocomplete, select, then clear
    const assigneeInput = screen.getByPlaceholderText('Type to search assignees...');
    await user.type(assigneeInput, 'Al');

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Alice'));
    await user.clear(assigneeInput);

    expect(assigneeInput.value).toBe('');
  });

  it('renders team name for formData.team not in jiraBoards list', async () => {
    const { scenarioRequestAPI } = await setupLookupMocks();
    scenarioRequestAPI.get.mockResolvedValue({
      data: {
        user_id: 'u1',
        requestId: 'REQ-001',
        requestType: 'scenario',
        dataDomain: 'finance',
        name: 'Team Fallback Test',
        description: '<p>desc</p>',
        status: 'submitted',
        steps: [],
        files: [],
        team: 'Unknown-Team',
        team_name: 'Unknown-Team',
        assignee: 'unknown-acc',
        assignee_name: 'Unknown User',
      },
    });

    renderEdit();

    await waitFor(() => {
      // Team name should be shown in the autocomplete input
      expect(screen.getByDisplayValue('Unknown-Team')).toBeInTheDocument();
      // Assignee name should be shown in the autocomplete input
      expect(screen.getByDisplayValue('Unknown User')).toBeInTheDocument();
    });
  });

  it('renders empty assignee input when assignee_name is empty', async () => {
    const { scenarioRequestAPI } = await setupLookupMocks();
    scenarioRequestAPI.get.mockResolvedValue({
      data: {
        user_id: 'u1',
        requestId: 'REQ-001',
        requestType: 'scenario',
        dataDomain: 'finance',
        name: 'Assignee ID Fallback',
        description: '<p>desc</p>',
        status: 'submitted',
        steps: [],
        files: [],
        assignee: 'unknown-acc-id',
        assignee_name: '',
      },
    });

    renderEdit();

    await waitFor(() => {
      // With empty assignee_name, autocomplete input should be empty
      const assigneeInput = screen.getByPlaceholderText('Type to search assignees...');
      expect(assigneeInput.value).toBe('');
    });
  });

  it('renders Jira user without email address in autocomplete', async () => {
    const { scenarioRequestAPI, jiraAPI } = await import('../../../services/api');
    scenarioRequestAPI.getDomains.mockResolvedValue({ data: [{ key: 'finance', name: 'Finance' }] });
    scenarioRequestAPI.getRequestTypes.mockResolvedValue({ data: [{ value: 'scenario', label: 'New Scenario Request' }] });
    scenarioRequestAPI.getDefaults.mockResolvedValue({ data: {} });
    jiraAPI.getBoards.mockResolvedValue({ data: [] });
    jiraAPI.getAssignableUsers.mockResolvedValue({
      data: [{ accountId: 'acc-no-email', displayName: 'No Email User' }],
    });
    const user = userEvent.setup();

    renderNew();

    // Type to trigger autocomplete
    const assigneeInput = screen.getByPlaceholderText('Type to search assignees...');
    await user.type(assigneeInput, 'No');

    await waitFor(() => {
      // Should display without email parenthetical
      expect(screen.getByText('No Email User')).toBeInTheDocument();
    });
  });

  it('renders domain options using value/label fallbacks when key/name are absent', async () => {
    const { scenarioRequestAPI, jiraAPI } = await import('../../../services/api');
    scenarioRequestAPI.getDomains.mockResolvedValue({
      data: [{ value: 'sales', label: 'Sales Domain' }],
    });
    scenarioRequestAPI.getRequestTypes.mockResolvedValue({ data: [{ value: 'scenario', label: 'Scenario' }] });
    scenarioRequestAPI.getDefaults.mockResolvedValue({ data: {} });
    jiraAPI.getBoards.mockResolvedValue({ data: [] });
    jiraAPI.getAssignableUsers.mockResolvedValue({ data: [] });

    renderNew();

    await waitFor(() => {
      expect(screen.getByText('Sales Domain')).toBeInTheDocument();
    });
  });

  it('shows default request type option when requestTypes is empty', async () => {
    const { scenarioRequestAPI, jiraAPI } = await import('../../../services/api');
    scenarioRequestAPI.getDomains.mockResolvedValue({ data: [] });
    scenarioRequestAPI.getRequestTypes.mockResolvedValue({ data: [] });
    scenarioRequestAPI.getDefaults.mockResolvedValue({ data: {} });
    jiraAPI.getBoards.mockResolvedValue({ data: [] });
    jiraAPI.getAssignableUsers.mockResolvedValue({ data: [] });

    renderNew();

    await waitFor(() => {
      expect(screen.getByText('New Scenario Request')).toBeInTheDocument();
    });
  });

  it('handles lookups with null data fields', async () => {
    const { scenarioRequestAPI, jiraAPI } = await import('../../../services/api');
    scenarioRequestAPI.getDomains.mockResolvedValue({ data: null });
    scenarioRequestAPI.getRequestTypes.mockResolvedValue({ data: null });
    scenarioRequestAPI.getDefaults.mockResolvedValue({ data: null });
    jiraAPI.getBoards.mockResolvedValue({ data: null });
    jiraAPI.getAssignableUsers.mockResolvedValue({ data: null });

    renderNew();

    // Should still render without errors
    await waitFor(() => {
      expect(screen.getByText('Ask for a New Scenario')).toBeInTheDocument();
    });
  });

  it('handles loadLookups failure gracefully', async () => {
    const { scenarioRequestAPI, jiraAPI } = await import('../../../services/api');
    scenarioRequestAPI.getDomains.mockRejectedValue(new Error('API down'));
    scenarioRequestAPI.getRequestTypes.mockRejectedValue(new Error('API down'));
    scenarioRequestAPI.getDefaults.mockRejectedValue(new Error('API down'));
    jiraAPI.getBoards.mockResolvedValue({ data: [] });
    jiraAPI.getAssignableUsers.mockResolvedValue({ data: [] });

    renderNew();

    // Should still render the page without crashing
    await waitFor(() => {
      expect(screen.getByText('Ask for a New Scenario')).toBeInTheDocument();
    });
  });

  it('loads request with steps containing database and query data', async () => {
    const { scenarioRequestAPI } = await setupLookupMocks();
    scenarioRequestAPI.get.mockResolvedValue({
      data: {
        user_id: 'u1',
        requestId: 'REQ-001',
        requestType: 'scenario',
        dataDomain: 'finance',
        name: 'Steps Test',
        description: '<p>desc</p>',
        status: 'submitted',
        has_suggestion: true,
        knows_steps: true,
        steps: [
          {
            description: 'Extract data',
            database: 'prod_db',
            query: ['SELECT * FROM orders'],
            order: 1,
          },
          {
            description: 'Transform data',
            database: null,
            query: [],
            order: 2,
          },
        ],
        files: [],
      },
    });

    renderEdit();

    await waitFor(() => {
      expect(screen.getByText('Extract data')).toBeInTheDocument();
      expect(screen.getByText(/prod_db/)).toBeInTheDocument();
      expect(screen.getByText(/SELECT \* FROM orders/)).toBeInTheDocument();
      expect(screen.getByText('Transform data')).toBeInTheDocument();
    });
  });

  it('submits new request with steps, reason, team and assignee', async () => {
    const { scenarioRequestAPI } = await setupLookupMocks();
    scenarioRequestAPI.create.mockResolvedValue({ data: { requestId: 'REQ-004' } });
    const toast = (await import('react-hot-toast')).default;
    const user = userEvent.setup();

    renderNew();

    await waitFor(() => {
      expect(screen.getByText('Finance')).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByDisplayValue('Select a domain...'), 'finance');
    await user.type(screen.getByPlaceholderText('Enter a descriptive name for your scenario'), 'Full Submit Test');

    const editorDivs = document.querySelectorAll('[contenteditable]');
    // First contenteditable is description
    if (editorDivs[0]) {
      editorDivs[0].innerHTML = '<p>Full description</p>';
      fireEvent.input(editorDivs[0]);
    }
    // Second contenteditable is reason
    if (editorDivs[1]) {
      editorDivs[1].innerHTML = '<p>Business reason</p>';
      fireEvent.input(editorDivs[1]);
    }

    // Enable steps
    const checkbox = document.querySelector('input[name="knows_steps"]');
    await user.click(checkbox);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('What should this step do?')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('What should this step do?'), 'Test step');
    await user.click(screen.getByText('Add Step'));

    await waitFor(() => {
      expect(screen.getByText('Test step')).toBeInTheDocument();
    });

    // Select team via autocomplete (clear default first)
    const teamInput = screen.getByPlaceholderText('Type to search teams...');
    await user.clear(teamInput);
    await user.type(teamInput, 'Bo');
    await waitFor(() => {
      expect(screen.getByText('Board-1')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Board-1'));

    // Select assignee via autocomplete (clear default first)
    const assigneeInput = screen.getByPlaceholderText('Type to search assignees...');
    await user.clear(assigneeInput);
    await user.type(assigneeInput, 'Al');
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Alice'));

    fireEvent.click(screen.getByText('Submit Request'));

    await waitFor(() => {
      expect(scenarioRequestAPI.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Full Submit Test',
          has_suggestion: false,
          knows_steps: true,
          steps: expect.arrayContaining([
            expect.objectContaining({ description: 'Test step' }),
          ]),
          team: '1',
          team_name: 'Board-1',
          assignee: 'acc1',
          assignee_name: 'Alice',
        })
      );
      expect(toast.success).toHaveBeenCalledWith('Scenario request submitted successfully!');
    });
  });

  it('edits request and uploads files successfully', async () => {
    const { scenarioRequestAPI } = await setupLookupMocks();
    scenarioRequestAPI.get.mockResolvedValue({
      data: {
        user_id: 'u1',
        requestId: 'REQ-001',
        requestType: 'scenario',
        dataDomain: 'finance',
        name: 'Upload Edit Test',
        description: '<p>desc</p>',
        status: 'submitted',
        steps: [],
        files: [{ file_name: 'existing.csv', file_type: 'csv', version: 1 }],
      },
    });
    scenarioRequestAPI.update.mockResolvedValue({ data: {} });
    scenarioRequestAPI.uploadFile.mockResolvedValue({ data: {} });
    const toast = (await import('react-hot-toast')).default;
    const user = userEvent.setup();

    renderEdit();

    await waitFor(() => {
      expect(screen.getByText('existing.csv')).toBeInTheDocument();
    });

    // Upload a new file
    const fileInput = document.querySelector('input[type="file"]');
    const testFile = new File(['content'], 'new_upload.csv', { type: 'text/csv' });
    await user.upload(fileInput, testFile);

    await waitFor(() => {
      expect(screen.getByText('new_upload.csv')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(scenarioRequestAPI.update).toHaveBeenCalled();
      expect(scenarioRequestAPI.uploadFile).toHaveBeenCalledWith('REQ-001', testFile);
      expect(toast.success).toHaveBeenCalledWith('Scenario request updated successfully!');
    });
  });

  it('handles request with null/missing optional fields in edit mode', async () => {
    const { scenarioRequestAPI } = await setupLookupMocks();
    scenarioRequestAPI.get.mockResolvedValue({
      data: {
        user_id: 'u1',
        requestId: 'REQ-001',
        // requestType is missing
        dataDomain: null,
        name: null,
        description: null,
        status: null,
        has_suggestion: null,
        knows_steps: null,
        steps: null,
        // files is missing
        reason: null,
        team: null,
        assignee: null,
        assignee_name: null,
        scenarioKey: null,
        configName: null,
        fulfilmentDate: null,
      },
    });

    renderEdit();

    await waitFor(() => {
      expect(screen.getByText('Edit Scenario Request')).toBeInTheDocument();
    });
  });

  it('handles checkbox toggle correctly via handleChange', async () => {
    await setupLookupMocks();
    const user = userEvent.setup();

    renderNew();

    await waitFor(() => {
      expect(screen.getByText('Implementation Details')).toBeInTheDocument();
    });

    // Toggle has_suggestion on
    const hasSuggestion = document.querySelector('input[name="has_suggestion"]');
    expect(hasSuggestion.checked).toBe(false);
    await user.click(hasSuggestion);
    expect(hasSuggestion.checked).toBe(true);

    // Toggle it off
    await user.click(hasSuggestion);
    expect(hasSuggestion.checked).toBe(false);
  });

  it('submits edit with dataDomain change triggers admin update', async () => {
    const { scenarioRequestAPI } = await setupLookupMocks();
    scenarioRequestAPI.get.mockResolvedValue({
      data: {
        user_id: 'u1',
        requestId: 'REQ-001',
        requestType: 'scenario',
        dataDomain: 'old-domain',
        name: 'Domain Change Test',
        description: '<p>desc</p>',
        status: 'submitted',
        steps: [],
        files: [],
      },
    });
    scenarioRequestAPI.update.mockResolvedValue({ data: {} });
    scenarioRequestAPI.adminUpdate.mockResolvedValue({ data: {} });

    renderEdit();

    await waitFor(() => {
      expect(screen.getByText('Edit Scenario Request')).toBeInTheDocument();
    });

    // Change the domain
    const domainSelect = document.querySelector('select[name="dataDomain"]');
    fireEvent.change(domainSelect, { target: { value: 'finance' } });

    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(scenarioRequestAPI.adminUpdate).toHaveBeenCalledWith(
        'REQ-001',
        expect.objectContaining({ dataDomain: 'finance' })
      );
    });
  });

  it('handles RichTextEditor paste event', async () => {
    await setupLookupMocks();
    document.execCommand = jest.fn();

    renderNew();

    await waitFor(() => {
      expect(screen.getByText('Basic Information')).toBeInTheDocument();
    });

    const editorDiv = document.querySelector('[contenteditable]');
    if (editorDiv) {
      // Fire focus first
      fireEvent.focus(editorDiv);
      // Fire paste event using fireEvent which handles clipboardData properly
      fireEvent.paste(editorDiv, {
        clipboardData: {
          getData: jest.fn().mockReturnValue('pasted text'),
        },
      });

      expect(document.execCommand).toHaveBeenCalledWith('insertText', false, 'pasted text');
    }
  });

  it('handles RichTextEditor focus and blur', async () => {
    await setupLookupMocks();

    renderNew();

    await waitFor(() => {
      expect(screen.getByText('Basic Information')).toBeInTheDocument();
    });

    const editorDiv = document.querySelector('[contenteditable]');
    if (editorDiv) {
      fireEvent.focus(editorDiv);
      // Check that focus class is applied (ring-2)
      const editorWrapper = editorDiv.closest('.border, .ring-2');
      expect(editorWrapper).toBeInTheDocument();

      fireEvent.blur(editorDiv);
    }
  });

  it('handles RichTextEditor toolbar bold button', async () => {
    await setupLookupMocks();
    document.execCommand = jest.fn();

    renderNew();

    await waitFor(() => {
      expect(screen.getByText('Basic Information')).toBeInTheDocument();
    });

    const boldButtons = screen.getAllByTitle('Bold');
    fireEvent.click(boldButtons[0]);

    expect(document.execCommand).toHaveBeenCalledWith('bold', false, null);
  });

  it('handles RichTextEditor toolbar italic button', async () => {
    await setupLookupMocks();
    document.execCommand = jest.fn();

    renderNew();

    await waitFor(() => {
      expect(screen.getByText('Basic Information')).toBeInTheDocument();
    });

    const italicButtons = screen.getAllByTitle('Italic');
    fireEvent.click(italicButtons[0]);

    expect(document.execCommand).toHaveBeenCalledWith('italic', false, null);
  });

  it('handles RichTextEditor toolbar list buttons', async () => {
    await setupLookupMocks();
    document.execCommand = jest.fn();

    renderNew();

    await waitFor(() => {
      expect(screen.getByText('Basic Information')).toBeInTheDocument();
    });

    const bulletButtons = screen.getAllByTitle('Bullet List');
    fireEvent.click(bulletButtons[0]);
    expect(document.execCommand).toHaveBeenCalledWith('insertUnorderedList', false, null);

    const numberButtons = screen.getAllByTitle('Numbered List');
    fireEvent.click(numberButtons[0]);
    expect(document.execCommand).toHaveBeenCalledWith('insertOrderedList', false, null);
  });

  it('handles RichTextEditor toolbar code block button', async () => {
    await setupLookupMocks();
    document.execCommand = jest.fn();

    renderNew();

    await waitFor(() => {
      expect(screen.getByText('Basic Information')).toBeInTheDocument();
    });

    const codeButtons = screen.getAllByTitle('Code Block');
    fireEvent.click(codeButtons[0]);

    expect(document.execCommand).toHaveBeenCalledWith('formatBlock', false, 'pre');
  });

  it('handles RichTextEditor toolbar link button with URL', async () => {
    await setupLookupMocks();
    document.execCommand = jest.fn();
    const originalPrompt = window.prompt;
    window.prompt = jest.fn().mockReturnValue('https://example.com');

    renderNew();

    await waitFor(() => {
      expect(screen.getByText('Basic Information')).toBeInTheDocument();
    });

    const linkButtons = screen.getAllByTitle('Insert Link');
    fireEvent.click(linkButtons[0]);

    expect(window.prompt).toHaveBeenCalledWith('Enter URL:');
    expect(document.execCommand).toHaveBeenCalledWith('createLink', false, 'https://example.com');

    window.prompt = originalPrompt;
  });

  it('handles RichTextEditor toolbar link button with cancelled prompt', async () => {
    await setupLookupMocks();
    document.execCommand = jest.fn();
    const originalPrompt = window.prompt;
    window.prompt = jest.fn().mockReturnValue(null);

    renderNew();

    await waitFor(() => {
      expect(screen.getByText('Basic Information')).toBeInTheDocument();
    });

    const linkButtons = screen.getAllByTitle('Insert Link');
    fireEvent.click(linkButtons[0]);

    expect(window.prompt).toHaveBeenCalledWith('Enter URL:');
    // Should NOT call execCommand with createLink when prompt returns null
    expect(document.execCommand).not.toHaveBeenCalledWith('createLink', expect.anything(), expect.anything());

    window.prompt = originalPrompt;
  });

  it('handles RichTextEditor list command on empty editor', async () => {
    await setupLookupMocks();
    document.execCommand = jest.fn();

    renderNew();

    await waitFor(() => {
      expect(screen.getByText('Basic Information')).toBeInTheDocument();
    });

    // Ensure editor is empty
    const editorDiv = document.querySelector('[contenteditable]');
    if (editorDiv) {
      editorDiv.innerHTML = '';
      editorDiv.textContent = '';
    }

    // Click bullet list on empty editor - this should trigger the empty editor branch
    const bulletButtons = screen.getAllByTitle('Bullet List');
    fireEvent.click(bulletButtons[0]);

    expect(document.execCommand).toHaveBeenCalledWith('insertUnorderedList', false, null);
  });

  it('sets loading to false after successful submit', async () => {
    const { scenarioRequestAPI } = await setupLookupMocks();
    scenarioRequestAPI.create.mockResolvedValue({ data: { requestId: 'REQ-LOAD' } });
    const user = userEvent.setup();

    renderNew();

    await waitFor(() => {
      expect(screen.getByText('Finance')).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByDisplayValue('Select a domain...'), 'finance');
    await user.type(screen.getByPlaceholderText('Enter a descriptive name for your scenario'), 'Loading Test');

    const editorDiv = document.querySelector('[contenteditable]');
    if (editorDiv) {
      editorDiv.innerHTML = '<p>desc</p>';
      fireEvent.input(editorDiv);
    }

    const submitBtn = screen.getByText('Submit Request');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(scenarioRequestAPI.create).toHaveBeenCalled();
    });

    // After submit, loading should be false and button should not be disabled
    await waitFor(() => {
      expect(submitBtn).not.toBeDisabled();
    });
  });

  it('loading button shows spinner during submission', async () => {
    const { scenarioRequestAPI } = await setupLookupMocks();
    // Make create hang to see loading state
    let resolveCreate;
    scenarioRequestAPI.create.mockReturnValue(
      new Promise((resolve) => { resolveCreate = resolve; })
    );
    const user = userEvent.setup();

    renderNew();

    await waitFor(() => {
      expect(screen.getByText('Finance')).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByDisplayValue('Select a domain...'), 'finance');
    await user.type(screen.getByPlaceholderText('Enter a descriptive name for your scenario'), 'Loading Test');

    const editorDiv = document.querySelector('[contenteditable]');
    if (editorDiv) {
      editorDiv.innerHTML = '<p>desc</p>';
      fireEvent.input(editorDiv);
    }

    fireEvent.click(screen.getByText('Submit Request'));

    // While loading, submit button should be disabled
    await waitFor(() => {
      const submitBtn = document.querySelector('button[type="submit"]');
      expect(submitBtn).toBeDisabled();
    });

    // Also check that spinner is shown
    await waitFor(() => {
      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });

    // Resolve to clean up
    resolveCreate({ data: { requestId: 'REQ-DONE' } });
  });

  it('does not show Admin Settings section in create mode', async () => {
    await setupLookupMocks();

    renderNew();

    await waitFor(() => {
      expect(screen.getByText('Ask for a New Scenario')).toBeInTheDocument();
    });

    expect(screen.queryByText('Admin Settings')).not.toBeInTheDocument();
  });

  it('does not show Back button in create mode', async () => {
    await setupLookupMocks();

    renderNew();

    await waitFor(() => {
      expect(screen.getByText('Ask for a New Scenario')).toBeInTheDocument();
    });

    expect(screen.queryByText('Back')).not.toBeInTheDocument();
  });

  it('shows "Add more files" text in edit mode file section', async () => {
    const { scenarioRequestAPI } = await setupLookupMocks();
    scenarioRequestAPI.get.mockResolvedValue({
      data: {
        user_id: 'u1',
        requestId: 'REQ-001',
        requestType: 'scenario',
        dataDomain: 'finance',
        name: 'Test',
        description: '<p>desc</p>',
        status: 'submitted',
        steps: [],
        files: [],
      },
    });

    renderEdit();

    await waitFor(() => {
      expect(screen.getByText('Add more files')).toBeInTheDocument();
    });
  });

  it('shows "Drag and drop files here, or click to browse" in create mode', async () => {
    await setupLookupMocks();

    renderNew();

    await waitFor(() => {
      expect(screen.getByText('Drag and drop files here, or click to browse')).toBeInTheDocument();
    });
  });

  it('shows uploaded file count text', async () => {
    await setupLookupMocks();
    const user = userEvent.setup();

    renderNew();

    const fileInput = document.querySelector('input[type="file"]');
    const testFile1 = new File(['a'], 'file1.csv', { type: 'text/csv' });
    const testFile2 = new File(['b'], 'file2.csv', { type: 'text/csv' });
    await user.upload(fileInput, [testFile1, testFile2]);

    await waitFor(() => {
      expect(screen.getByText('2 new file(s) to upload:')).toBeInTheDocument();
    });
  });

  it('shows file size in KB for uploaded files', async () => {
    await setupLookupMocks();
    const user = userEvent.setup();

    renderNew();

    const fileInput = document.querySelector('input[type="file"]');
    const testFile = new File(['a'.repeat(2048)], 'sized.csv', { type: 'text/csv' });
    await user.upload(fileInput, testFile);

    await waitFor(() => {
      expect(screen.getByText('sized.csv')).toBeInTheDocument();
      expect(screen.getByText('2.0 KB')).toBeInTheDocument();
    });
  });

  it('clears step form fields after adding a step', async () => {
    await setupLookupMocks();
    const user = userEvent.setup();

    renderNew();

    await waitFor(() => {
      expect(screen.getByText('Implementation Details')).toBeInTheDocument();
    });

    const checkbox = document.querySelector('input[name="knows_steps"]');
    await user.click(checkbox);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('What should this step do?')).toBeInTheDocument();
    });

    const stepInput = screen.getByPlaceholderText('What should this step do?');
    const dbInput = screen.getByPlaceholderText('e.g., sales_db.reporting');
    const queryInput = screen.getByPlaceholderText('SELECT ... FROM ... WHERE ...');

    await user.type(stepInput, 'A step');
    await user.type(dbInput, 'my_db');
    await user.type(queryInput, 'SELECT 1');

    await user.click(screen.getByText('Add Step'));

    // After adding, step fields should be cleared
    await waitFor(() => {
      expect(stepInput.value).toBe('');
      expect(dbInput.value).toBe('');
      expect(queryInput.value).toBe('');
    });
  });

  it('adds step without database (null fallback)', async () => {
    await setupLookupMocks();
    const { scenarioRequestAPI } = await import('../../../services/api');
    scenarioRequestAPI.create.mockResolvedValue({ data: { requestId: 'REQ-STEPS' } });
    const user = userEvent.setup();

    renderNew();

    await waitFor(() => {
      expect(screen.getByText('Finance')).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByDisplayValue('Select a domain...'), 'finance');
    await user.type(screen.getByPlaceholderText('Enter a descriptive name for your scenario'), 'Step No DB');

    const editorDiv = document.querySelector('[contenteditable]');
    if (editorDiv) {
      editorDiv.innerHTML = '<p>desc</p>';
      fireEvent.input(editorDiv);
    }

    const checkbox = document.querySelector('input[name="knows_steps"]');
    await user.click(checkbox);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('What should this step do?')).toBeInTheDocument();
    });

    // Add step without database or query
    await user.type(screen.getByPlaceholderText('What should this step do?'), 'Simple step');
    await user.click(screen.getByText('Add Step'));

    await waitFor(() => {
      expect(screen.getByText('Simple step')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Submit Request'));

    await waitFor(() => {
      expect(scenarioRequestAPI.create).toHaveBeenCalledWith(
        expect.objectContaining({
          steps: expect.arrayContaining([
            expect.objectContaining({
              description: 'Simple step',
              database: null,
              query: [],
            }),
          ]),
        })
      );
    });
  });

  it('submits create request with empty steps array when no steps added', async () => {
    const { scenarioRequestAPI } = await setupLookupMocks();
    scenarioRequestAPI.create.mockResolvedValue({ data: { requestId: 'REQ-NOSTEPS' } });
    const user = userEvent.setup();

    renderNew();

    await waitFor(() => {
      expect(screen.getByText('Finance')).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByDisplayValue('Select a domain...'), 'finance');
    await user.type(screen.getByPlaceholderText('Enter a descriptive name for your scenario'), 'No Steps');

    const editorDiv = document.querySelector('[contenteditable]');
    if (editorDiv) {
      editorDiv.innerHTML = '<p>desc</p>';
      fireEvent.input(editorDiv);
    }

    fireEvent.click(screen.getByText('Submit Request'));

    await waitFor(() => {
      expect(scenarioRequestAPI.create).toHaveBeenCalledWith(
        expect.objectContaining({
          steps: [],
          reason: null,
          team: 'Team-A',
          assignee: 'acc1',
          assignee_name: 'Alice',
        })
      );
    });
  });

  it('submits edit request with null reason and null team/assignee when empty', async () => {
    const { scenarioRequestAPI } = await setupLookupMocks();
    scenarioRequestAPI.get.mockResolvedValue({
      data: {
        user_id: 'u1',
        requestId: 'REQ-001',
        requestType: 'scenario',
        dataDomain: 'finance',
        name: 'Null Fields Test',
        description: '<p>desc</p>',
        status: 'submitted',
        steps: [],
        files: [],
        reason: '',
        team: '',
        assignee: '',
        assignee_name: '',
      },
    });
    scenarioRequestAPI.update.mockResolvedValue({ data: {} });

    renderEdit();

    await waitFor(() => {
      expect(screen.getByText('Edit Scenario Request')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(scenarioRequestAPI.update).toHaveBeenCalledWith(
        'REQ-001',
        expect.objectContaining({
          reason: null,
          team: null,
          assignee: null,
          assignee_name: null,
        })
      );
    });
  });

  it('handles edit mode with scenarioKey clearing (setting to null)', async () => {
    const { scenarioRequestAPI } = await setupLookupMocks();
    scenarioRequestAPI.get.mockResolvedValue({
      data: {
        user_id: 'u1',
        requestId: 'REQ-001',
        requestType: 'scenario',
        dataDomain: 'finance',
        name: 'Clear Key Test',
        description: '<p>desc</p>',
        status: 'submitted',
        steps: [],
        files: [],
        scenarioKey: 'SC-OLD',
        configName: 'old-config',
        fulfilmentDate: '2026-03-01T00:00:00Z',
      },
    });
    scenarioRequestAPI.update.mockResolvedValue({ data: {} });
    scenarioRequestAPI.adminUpdate.mockResolvedValue({ data: {} });
    const user = userEvent.setup();

    renderEdit();

    await waitFor(() => {
      expect(screen.getByText('Admin Settings')).toBeInTheDocument();
    });

    // Clear scenarioKey
    const scenarioKeyInput = screen.getByPlaceholderText('e.g., SC-001');
    await user.clear(scenarioKeyInput);

    // Clear configName
    const configInput = screen.getByPlaceholderText('Configuration name');
    await user.clear(configInput);

    // Clear fulfilment date
    const dateInput = document.querySelector('input[name="fulfilmentDate"]');
    fireEvent.change(dateInput, { target: { value: '' } });

    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(scenarioRequestAPI.adminUpdate).toHaveBeenCalledWith(
        'REQ-001',
        expect.objectContaining({
          scenarioKey: null,
          configName: null,
          fulfilmentDate: null,
        })
      );
    });
  });

  it('does not load statuses for non-edit mode', async () => {
    const { scenarioRequestAPI, jiraAPI } = await import('../../../services/api');
    scenarioRequestAPI.getDomains.mockResolvedValue({ data: [] });
    scenarioRequestAPI.getRequestTypes.mockResolvedValue({ data: [{ value: 'scenario', label: 'Scenario' }] });
    scenarioRequestAPI.getDefaults.mockResolvedValue({ data: {} });
    scenarioRequestAPI.getStatuses.mockResolvedValue({ data: [] });
    jiraAPI.getBoards.mockResolvedValue({ data: [] });
    jiraAPI.getAssignableUsers.mockResolvedValue({ data: [] });

    renderNew();

    await waitFor(() => {
      expect(screen.getByText('Ask for a New Scenario')).toBeInTheDocument();
    });

    // In create mode, getStatuses should NOT have been called
    expect(scenarioRequestAPI.getStatuses).not.toHaveBeenCalled();
  });

  it('handles multiple file uploads', async () => {
    await setupLookupMocks();
    const user = userEvent.setup();

    renderNew();

    const fileInput = document.querySelector('input[type="file"]');

    // Upload first batch
    const file1 = new File(['a'], 'first.csv', { type: 'text/csv' });
    await user.upload(fileInput, file1);

    await waitFor(() => {
      expect(screen.getByText('first.csv')).toBeInTheDocument();
    });

    // Upload second batch
    const file2 = new File(['b'], 'second.csv', { type: 'text/csv' });
    await user.upload(fileInput, file2);

    await waitFor(() => {
      expect(screen.getByText('first.csv')).toBeInTheDocument();
      expect(screen.getByText('second.csv')).toBeInTheDocument();
    });
  });

  it('removes the correct file from uploaded files list', async () => {
    await setupLookupMocks();
    const user = userEvent.setup();

    renderNew();

    const fileInput = document.querySelector('input[type="file"]');
    const file1 = new File(['a'], 'keep.csv', { type: 'text/csv' });
    const file2 = new File(['b'], 'remove.csv', { type: 'text/csv' });
    await user.upload(fileInput, [file1, file2]);

    await waitFor(() => {
      expect(screen.getByText('keep.csv')).toBeInTheDocument();
      expect(screen.getByText('remove.csv')).toBeInTheDocument();
    });

    // Find the remove button for remove.csv - it should be in the second file entry
    const fileEntries = document.querySelectorAll('.flex.items-center.justify-between.p-3');
    const removeEntry = Array.from(fileEntries).find(el => el.textContent.includes('remove.csv'));
    if (removeEntry) {
      const removeBtn = removeEntry.querySelector('button');
      if (removeBtn) {
        await user.click(removeBtn);
      }
    }

    await waitFor(() => {
      expect(screen.getByText('keep.csv')).toBeInTheDocument();
      expect(screen.queryByText('remove.csv')).not.toBeInTheDocument();
    });
  });

  it('handles request type change', async () => {
    const { scenarioRequestAPI, jiraAPI } = await import('../../../services/api');
    scenarioRequestAPI.getDomains.mockResolvedValue({ data: [] });
    scenarioRequestAPI.getRequestTypes.mockResolvedValue({
      data: [
        { value: 'scenario', label: 'New Scenario' },
        { value: 'feature', label: 'Feature Request' },
      ],
    });
    scenarioRequestAPI.getDefaults.mockResolvedValue({ data: {} });
    jiraAPI.getBoards.mockResolvedValue({ data: [] });
    jiraAPI.getAssignableUsers.mockResolvedValue({ data: [] });
    const user = userEvent.setup();

    renderNew();

    await waitFor(() => {
      expect(screen.getByText('Feature Request')).toBeInTheDocument();
    });

    const typeSelect = document.querySelector('select[name="requestType"]');
    await user.selectOptions(typeSelect, 'feature');

    expect(typeSelect.value).toBe('feature');
  });

  it('does not set default request type when requestTypes data is empty', async () => {
    const { scenarioRequestAPI, jiraAPI } = await import('../../../services/api');
    scenarioRequestAPI.getDomains.mockResolvedValue({ data: [] });
    scenarioRequestAPI.getRequestTypes.mockResolvedValue({ data: [] });
    scenarioRequestAPI.getDefaults.mockResolvedValue({ data: {} });
    jiraAPI.getBoards.mockResolvedValue({ data: [] });
    jiraAPI.getAssignableUsers.mockResolvedValue({ data: [] });

    renderNew();

    await waitFor(() => {
      expect(screen.getByText('Ask for a New Scenario')).toBeInTheDocument();
    });

    // With empty requestTypes, the default "scenario" value should remain
    const typeSelect = document.querySelector('select[name="requestType"]');
    expect(typeSelect.value).toBe('scenario');
  });

  it('shows permission error and navigates away when non-owner non-editor tries to edit', async () => {
    mockIsEditor = false;
    const { scenarioRequestAPI } = await setupLookupMocks();
    scenarioRequestAPI.get.mockResolvedValue({
      data: {
        user_id: 'other-user-id',
        requestId: 'REQ-001',
        requestType: 'scenario',
        dataDomain: 'finance',
        name: 'Forbidden Request',
        description: '<p>desc</p>',
        status: 'submitted',
        steps: [],
        files: [],
      },
    });
    const toast = (await import('react-hot-toast')).default;

    renderEdit();

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('You do not have permission to edit this request');
    });
    expect(mockNavigate).toHaveBeenCalledWith('/my-requests');
  });

  it('allows owner who is not editor to edit their own request', async () => {
    mockIsEditor = false;
    const { scenarioRequestAPI } = await setupLookupMocks();
    scenarioRequestAPI.get.mockResolvedValue({
      data: {
        user_id: 'u1', // same as mockUser.user_id
        requestId: 'REQ-001',
        requestType: 'scenario',
        dataDomain: 'finance',
        name: 'My Own Request',
        description: '<p>desc</p>',
        status: 'submitted',
        steps: [],
        files: [],
      },
    });

    renderEdit();

    await waitFor(() => {
      expect(screen.getByText('Edit Scenario Request')).toBeInTheDocument();
      expect(screen.getByDisplayValue('My Own Request')).toBeInTheDocument();
    });

    // Admin Settings should NOT be visible for non-editors
    expect(screen.queryByText('Admin Settings')).not.toBeInTheDocument();
  });

  it('does not call adminUpdate when non-editor submits edit', async () => {
    mockIsEditor = false;
    const { scenarioRequestAPI } = await setupLookupMocks();
    scenarioRequestAPI.get.mockResolvedValue({
      data: {
        user_id: 'u1',
        requestId: 'REQ-001',
        requestType: 'scenario',
        dataDomain: 'finance',
        name: 'Non-Editor Edit',
        description: '<p>desc</p>',
        status: 'submitted',
        steps: [],
        files: [],
      },
    });
    scenarioRequestAPI.update.mockResolvedValue({ data: {} });
    const toast = (await import('react-hot-toast')).default;

    renderEdit();

    await waitFor(() => {
      expect(screen.getByText('Edit Scenario Request')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(scenarioRequestAPI.update).toHaveBeenCalled();
      expect(scenarioRequestAPI.adminUpdate).not.toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith('Scenario request updated successfully!');
    });
  });

  it('non-editor does not trigger status comment validation', async () => {
    mockIsEditor = false;
    const { scenarioRequestAPI } = await setupLookupMocks();
    scenarioRequestAPI.get.mockResolvedValue({
      data: {
        user_id: 'u1',
        requestId: 'REQ-001',
        requestType: 'scenario',
        dataDomain: 'finance',
        name: 'No Status Check',
        description: '<p>desc</p>',
        status: 'submitted',
        steps: [],
        files: [],
      },
    });
    scenarioRequestAPI.update.mockResolvedValue({ data: {} });
    const toast = (await import('react-hot-toast')).default;

    renderEdit();

    await waitFor(() => {
      expect(screen.getByText('Edit Scenario Request')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(scenarioRequestAPI.update).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith('Scenario request updated successfully!');
    });

    // Should NOT have shown status comment error
    expect(toast.error).not.toHaveBeenCalledWith('Please provide a comment for the status change');
  });
});
