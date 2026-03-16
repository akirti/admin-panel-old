import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Send,
  Plus,
  Trash2,
  HelpCircle,
  FileUp,
  X,
  Loader2,
  Bold,
  Italic,
  List,
  ListOrdered,
  Link as LinkIcon,
  Code,
  ArrowLeft,
  Save
} from 'lucide-react';
import { scenarioRequestAPI, jiraAPI, atlassianAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

// Simple Rich Text Editor Component
function RichTextEditor({ value, onChange, placeholder, rows = 6 }) {
  const editorRef = useRef(null);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '';
    }
  }, []);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const execCommand = (command, commandValue = null) => {
    editorRef.current?.focus();

    // For list commands, ensure we're in the editor first
    if (command === 'insertUnorderedList' || command === 'insertOrderedList') {
      // If editor is empty or cursor not in editor, add a dummy text node
      if (!editorRef.current.textContent.trim()) {
        editorRef.current.innerHTML = '<br>';
        // Set cursor at the beginning
        const range = document.createRange();
        const sel = window.getSelection();
        range.setStart(editorRef.current, 0);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }

    document.execCommand(command, false, commandValue);
    setTimeout(() => handleInput(), 10);
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  };

  return (
    <div className={`border rounded-lg overflow-hidden transition-all ${isFocused ? 'ring-2 ring-primary-500 border-transparent' : 'border-edge'}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1.5 bg-surface-secondary border-b border-edge">
        <button
          type="button"
          onClick={() => execCommand('bold')}
          className="p-1.5 rounded hover:bg-surface-hover text-content-secondary"
          title="Bold"
        >
          <Bold size={16} />
        </button>
        <button
          type="button"
          onClick={() => execCommand('italic')}
          className="p-1.5 rounded hover:bg-surface-hover text-content-secondary"
          title="Italic"
        >
          <Italic size={16} />
        </button>
        <div className="w-px h-5 bg-neutral-300 mx-1" />
        <button
          type="button"
          onClick={() => execCommand('insertUnorderedList')}
          className="p-1.5 rounded hover:bg-surface-hover text-content-secondary"
          title="Bullet List"
        >
          <List size={16} />
        </button>
        <button
          type="button"
          onClick={() => execCommand('insertOrderedList')}
          className="p-1.5 rounded hover:bg-surface-hover text-content-secondary"
          title="Numbered List"
        >
          <ListOrdered size={16} />
        </button>
        <div className="w-px h-5 bg-neutral-300 mx-1" />
        <button
          type="button"
          onClick={() => {
            const url = prompt('Enter URL:');
            if (url) execCommand('createLink', url);
          }}
          className="p-1.5 rounded hover:bg-surface-hover text-content-secondary"
          title="Insert Link"
        >
          <LinkIcon size={16} />
        </button>
        <button
          type="button"
          onClick={() => execCommand('formatBlock', 'pre')}
          className="p-1.5 rounded hover:bg-surface-hover text-content-secondary"
          title="Code Block"
        >
          <Code size={16} />
        </button>
      </div>
      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onPaste={handlePaste}
        data-placeholder={placeholder}
        className="w-full px-4 py-3 bg-surface text-content focus:outline-none overflow-y-auto prose prose-sm max-w-none"
        style={{ minHeight: `${rows * 1.5}rem` }}
      />
      <style>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
        }
        [contenteditable] ul {
          list-style-type: disc;
          padding-left: 2rem;
          margin: 0.75rem 0;
        }
        [contenteditable] ol {
          list-style-type: decimal;
          padding-left: 2rem;
          margin: 0.75rem 0;
        }
        [contenteditable] li {
          margin: 0.25rem 0;
          padding-left: 0.25rem;
        }
        [contenteditable] ul li {
          display: list-item;
          list-style-type: disc;
        }
        [contenteditable] ol li {
          display: list-item;
          list-style-type: decimal;
        }
        [contenteditable] pre {
          background: #f3f4f6;
          padding: 0.5rem;
          border-radius: 0.25rem;
          font-family: monospace;
          font-size: 0.875rem;
        }
        [contenteditable] a {
          color: #dc2626;
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
}

// Autocomplete input with server-side search support
// - If onSearch is provided, calls it on each input change (debounced) and uses returned results
// - If only options is provided, filters client-side (legacy mode)
function AutocompleteInput({ label, value, displayValue, options, onSearch, onSelect, onClear, placeholder, minChars = 2, renderOption, loading: externalLoading }) {
  const [inputValue, setInputValue] = useState(displayValue || '');
  const [showDropdown, setShowDropdown] = useState(false);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const wrapperRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    setInputValue(displayValue || '');
  }, [displayValue]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Clean up debounce on unmount
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const doSearch = (val) => {
    if (onSearch) {
      // Server-side search with debounce
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setSearching(true);
      debounceRef.current = setTimeout(async () => {
        try {
          const searchResults = await onSearch(val);
          setResults(searchResults);
          setShowDropdown(true);
        } catch {
          setResults([]);
        } finally {
          setSearching(false);
        }
      }, 300);
    } else {
      // Client-side filter
      const lower = val.toLowerCase();
      const matches = (options || []).filter(opt => {
        const searchText = (opt.searchText || opt.label || '').toLowerCase();
        return searchText.includes(lower);
      });
      setResults(matches);
      setShowDropdown(true);
    }
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputValue(val);
    if (val.length >= minChars) {
      doSearch(val);
    } else {
      setShowDropdown(false);
      setResults([]);
    }
    if (!val) {
      onClear();
    }
  };

  const handleSelect = (option) => {
    setInputValue(option.label);
    setShowDropdown(false);
    onSelect(option);
  };

  const isLoading = searching || externalLoading;

  return (
    <div className="w-full" ref={wrapperRef}>
      <label className="block text-sm font-medium text-content-secondary mb-2">{label}</label>
      <div className="relative">
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => {
            if (inputValue.length >= minChars) {
              doSearch(inputValue);
            }
          }}
          placeholder={placeholder}
          className="w-full px-4 py-3 border border-edge rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-surface text-content placeholder-content-muted"
        />
        {value && !isLoading && (
          <button
            type="button"
            onClick={() => { setInputValue(''); onClear(); setShowDropdown(false); setResults([]); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-content-muted hover:text-red-600"
          >
            <X size={16} />
          </button>
        )}
        {isLoading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-content-muted">
            <Loader2 size={16} className="animate-spin" />
          </span>
        )}
        {showDropdown && results.length > 0 && (
          <ul role="listbox" className="absolute z-50 w-full mt-1 bg-surface border border-edge rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {results.map((opt) => (
              <li
                key={opt.id}
                role="option"
                tabIndex={0}
                aria-selected={opt.id === value}
                onClick={() => handleSelect(opt)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelect(opt); } }}
                className="px-4 py-2.5 hover:bg-surface-secondary focus:bg-surface-secondary cursor-pointer text-sm text-content outline-none"
              >
                {renderOption ? renderOption(opt) : opt.label}
              </li>
            ))}
          </ul>
        )}
        {showDropdown && results.length === 0 && !isLoading && inputValue.length >= minChars && (
          <div className="absolute z-50 w-full mt-1 bg-surface border border-edge rounded-lg shadow-lg px-4 py-3 text-sm text-content-muted">
            No matches found
          </div>
        )}
      </div>
    </div>
  );
}

// Strips HTML tags for plain text checks
function stripHtml(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

// Builds form data from a loaded request for edit mode
function buildFormDataFromRequest(request) {
  return {
    requestType: request.requestType || 'scenario',
    dataDomain: request.dataDomain || '',
    name: request.name || '',
    description: request.description || '',
    has_suggestion: request.has_suggestion || false,
    knows_steps: request.knows_steps || false,
    steps: request.steps || [],
    reason: request.reason || '',
    team: request.team || '',
    team_name: request.team_name || '',
    assignee: request.assignee || '',
    assignee_name: request.assignee_name || '',
    status: request.status || '',
    scenarioKey: request.scenarioKey || '',
    configName: request.configName || '',
    fulfilmentDate: request.fulfilmentDate ? request.fulfilmentDate.split('T')[0] : ''
  };
}

// Checks if a field has changed from the original request and adds it to the update object
function addChangedField(updateData, formData, originalRequest, field, originalField) {
  const origField = originalField || field;
  const origValue = originalRequest[origField] || '';
  const normalizedOrig = origField === 'fulfilmentDate' && origValue ? origValue.split('T')[0] : origValue;
  if (formData[field] !== normalizedOrig) {
    updateData[field] = formData[field] || null;
  }
}

// Builds the admin update payload by comparing formData to the original request
function buildAdminUpdate(formData, originalRequest, isEditorFn) {
  if (!isEditorFn() || !originalRequest) return {};
  const adminUpdateData = {};
  if (formData.status && formData.status !== originalRequest.status) {
    adminUpdateData.status = formData.status;
    adminUpdateData.status_comment = formData.statusComment.trim();
  }
  addChangedField(adminUpdateData, formData, originalRequest, 'dataDomain');
  addChangedField(adminUpdateData, formData, originalRequest, 'scenarioKey');
  addChangedField(adminUpdateData, formData, originalRequest, 'configName');
  addChangedField(adminUpdateData, formData, originalRequest, 'fulfilmentDate');
  return adminUpdateData;
}

// Returns the submit button icon based on state
function SubmitButtonIcon({ loading: isLoading, isEditMode }) {
  if (isLoading) return <Loader2 className="animate-spin" size={18} />;
  if (isEditMode) return <Save size={18} />;
  return <Send size={18} />;
}

// Admin settings section for editors in edit mode
function AdminSettingsSection({ formData, handleChange, statuses, originalRequest }) {
  const statusChanged = formData.status && originalRequest && formData.status !== originalRequest.status;
  return (
    <div className="card">
      <div className="card-header">
        <h2 className="text-lg font-semibold text-content">Admin Settings</h2>
        <p className="text-sm text-content-muted mt-1">These fields are only visible to administrators and editors</p>
      </div>
      <div className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="w-full">
            <label className="block text-sm font-medium text-content-secondary mb-2">Status</label>
            <select name="status" value={formData.status} onChange={handleChange}
              className="w-full px-4 py-3 border border-edge rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-surface text-content">
              {statuses.map(status => (
                <option key={status.value} value={status.value}>{status.label}</option>
              ))}
            </select>
          </div>
          <div className="w-full">
            <label className="block text-sm font-medium text-content-secondary mb-2">Target Date</label>
            <input type="date" name="fulfilmentDate" value={formData.fulfilmentDate} onChange={handleChange}
              className="w-full px-4 py-3 border border-edge rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-surface text-content" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="w-full">
            <label className="block text-sm font-medium text-content-secondary mb-2">Scenario Key</label>
            <input type="text" name="scenarioKey" value={formData.scenarioKey} onChange={handleChange}
              className="w-full px-4 py-3 border border-edge rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-surface text-content placeholder-content-muted"
              placeholder="e.g., SC-001" />
          </div>
          <div className="w-full">
            <label className="block text-sm font-medium text-content-secondary mb-2">Config Name</label>
            <input type="text" name="configName" value={formData.configName} onChange={handleChange}
              className="w-full px-4 py-3 border border-edge rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-surface text-content placeholder-content-muted"
              placeholder="Configuration name" />
          </div>
        </div>
        {statusChanged && (
          <div className="w-full border-t border-edge pt-5">
            <label className="block text-sm font-medium text-content-secondary mb-2">
              Status Change Comment <span className="text-red-500">*</span>
            </label>
            <textarea name="statusComment" value={formData.statusComment} onChange={handleChange} rows={3}
              className="w-full px-4 py-3 border border-edge rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-surface text-content placeholder-content-muted"
              placeholder="Please provide a reason for this status change..." required />
            <p className="text-xs text-content-muted mt-1">This comment will be recorded in the workflow history.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// File upload section with existing and new files
function FileUploadSection({ isEditMode, existingFiles, uploadedFiles, handleFileUpload, handleRemoveFile }) {
  return (
    <div className="card">
      <div className="card-header">
        <h2 className="text-lg font-semibold text-content">Sample Files</h2>
        <p className="text-sm text-content-muted mt-1">Upload sample data files or screenshots to help us understand your requirements</p>
      </div>
      <div>
        {isEditMode && existingFiles.length > 0 && (
          <div className="mb-5 space-y-2">
            <p className="text-sm font-medium text-content-secondary">Existing files:</p>
            {existingFiles.map((file, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded bg-green-100 flex items-center justify-center text-green-600">
                    <FileUp size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-content truncate">{file.file_name || file.name}</p>
                    <p className="text-xs text-content-muted">{file.file_type} • v{file.version || 1}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="border-2 border-dashed border-edge rounded-lg p-8 text-center hover:border-primary-300 transition-colors">
          <FileUp className="mx-auto text-content-muted mb-3" size={48} />
          <p className="text-sm text-content-secondary mb-3">
            {isEditMode ? 'Add more files' : 'Drag and drop files here, or click to browse'}
          </p>
          <p className="text-xs text-content-muted mb-4">
            Supported: CSV, Excel, JSON, PDF, PNG, JPG (max 10MB each)
          </p>
          <input type="file" id="file-upload" multiple onChange={handleFileUpload} className="hidden"
            accept=".csv,.xlsx,.xls,.json,.pdf,.png,.jpg,.jpeg" />
          <label htmlFor="file-upload" className="btn-secondary cursor-pointer inline-block">Choose Files</label>
        </div>

        {uploadedFiles.length > 0 && (
          <div className="mt-5 space-y-2">
            <p className="text-sm font-medium text-content-secondary">{uploadedFiles.length} new file(s) to upload:</p>
            {uploadedFiles.map((file, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-surface-secondary rounded-lg border border-edge">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded bg-primary-100 flex items-center justify-center text-primary-600">
                    <FileUp size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-content truncate">{file.name}</p>
                    <p className="text-xs text-content-muted">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
                <button type="button" onClick={() => handleRemoveFile(index)}
                  className="flex-shrink-0 text-content-muted hover:text-red-600 p-1">
                  <X size={18} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Extracted sub-components for the main form sections ---

const INITIAL_FORM_DATA = {
  requestType: 'scenario',
  dataDomain: '',
  name: '',
  description: '',
  has_suggestion: false,
  knows_steps: false,
  steps: [],
  reason: '',
  team: '',
  team_name: '',
  assignee: '',
  assignee_name: '',
  status: '',
  scenarioKey: '',
  configName: '',
  fulfilmentDate: '',
  statusComment: ''
};

const INITIAL_STEP = { description: '', database: '', query: '' };

// --- Custom hook: form state and handlers ---

function useAskScenarioForm() {
  const [formData, setFormData] = useState({ ...INITIAL_FORM_DATA });
  const [newStep, setNewStep] = useState({ ...INITIAL_STEP });
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [existingFiles, setExistingFiles] = useState([]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleRichTextChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const makeAssigneeChangeHandler = (jiraUsers) => (e) => {
    const selectedUser = jiraUsers.find(u => u.accountId === e.target.value);
    setFormData(prev => ({
      ...prev,
      assignee: e.target.value,
      assignee_name: selectedUser ? selectedUser.displayName : ''
    }));
  };

  const handleTeamSelect = (option) => {
    setFormData(prev => ({ ...prev, team: option.id, team_name: option.label }));
  };

  const handleTeamClear = () => {
    setFormData(prev => ({ ...prev, team: '', team_name: '' }));
  };

  const handleAssigneeSelect = (option) => {
    setFormData(prev => ({ ...prev, assignee: option.id, assignee_name: option.label }));
  };

  const handleAssigneeClear = () => {
    setFormData(prev => ({ ...prev, assignee: '', assignee_name: '' }));
  };

  const handleAddStep = () => {
    if (!newStep.description.trim()) return;
    const stepData = {
      description: newStep.description,
      database: newStep.database || null,
      query: newStep.query ? [newStep.query] : [],
      order: formData.steps.length + 1
    };
    setFormData(prev => ({
      ...prev,
      steps: [...prev.steps, stepData]
    }));
    setNewStep({ ...INITIAL_STEP });
  };

  const handleRemoveStep = (index) => {
    setFormData(prev => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index).map((step, i) => ({ ...step, order: i + 1 }))
    }));
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    setUploadedFiles(prev => [...prev, ...files]);
  };

  const handleRemoveFile = (index) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const resetFormFromRequest = (request) => {
    setFormData(buildFormDataFromRequest(request));
    setExistingFiles(request.files || []);
  };

  const applyDefaults = (defaults, requestTypesData) => {
    setFormData(prev => ({
      ...prev,
      requestType: requestTypesData[0].value,
      team: defaults.team || '',
      team_name: defaults.team_name || '',
      assignee: defaults.assignee || '',
      assignee_name: defaults.assignee_name || ''
    }));
  };

  return {
    formData, setFormData, newStep, setNewStep,
    uploadedFiles, existingFiles,
    handleChange, handleRichTextChange, makeAssigneeChangeHandler,
    handleTeamSelect, handleTeamClear, handleAssigneeSelect, handleAssigneeClear,
    handleAddStep, handleRemoveStep, handleFileUpload, handleRemoveFile,
    resetFormFromRequest, applyDefaults
  };
}

// --- Custom hook: data loading ---

function useAskScenarioData({ isEditMode, isEditor, requestId, user, navigate, form }) {
  const [loading, setLoading] = useState(false);
  const [loadingRequest, setLoadingRequest] = useState(false);
  const [domains, setDomains] = useState([]);
  const [requestTypes, setRequestTypes] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [originalRequest, setOriginalRequest] = useState(null);
  const [projectKey, setProjectKey] = useState(null);
  const [projectName, setProjectName] = useState(null);

  const buildLookupPromises = () => {
    const promises = [
      scenarioRequestAPI.getDomains(),
      scenarioRequestAPI.getRequestTypes(),
      scenarioRequestAPI.getDefaults()
    ];
    if (isEditMode && isEditor()) {
      promises.push(scenarioRequestAPI.getStatuses());
    }
    return promises;
  };

  const applyLookupResults = (results) => {
    setDomains(results[0].data || []);
    setRequestTypes(results[1].data || []);
    const defaults = results[2].data || {};
    if (results[3]) {
      setStatuses(results[3].data || []);
    }
    return { defaults, requestTypes: results[1].data };
  };

  const loadLookups = async () => {
    try {
      const results = await Promise.all(buildLookupPromises());
      const { defaults, requestTypes: requestTypesData } = applyLookupResults(results);
      if (defaults.project_key) setProjectKey(defaults.project_key);
      if (defaults.project_name) setProjectName(defaults.project_name);
      if (!isEditMode && requestTypesData && requestTypesData.length > 0) {
        form.applyDefaults(defaults, requestTypesData);
      }
    } catch {
      // error handled silently
    }
  };

  const loadRequest = async () => {
    setLoadingRequest(true);
    try {
      const response = await scenarioRequestAPI.get(requestId);
      const request = response.data;
      setOriginalRequest(request);

      const isOwner = request.user_id === user?.user_id;
      const canEdit = isOwner || isEditor();

      if (!canEdit) {
        toast.error('You do not have permission to edit this request');
        navigate('/my-requests');
        return;
      }

      form.resetFormFromRequest(request);
    } catch (error) {
      toast.error('Failed to load request');
      navigate('/my-requests');
    } finally {
      setLoadingRequest(false);
    }
  };

  useEffect(() => {
    loadLookups();
  }, []);

  useEffect(() => {
    if (isEditMode) {
      loadRequest();
    }
  }, [requestId]);

  return {
    loading, setLoading, loadingRequest,
    domains, requestTypes, statuses, originalRequest,
    projectKey, projectName
  };
}

// --- Validation and data-building helpers (pure functions, outside hooks) ---

function validateFormData(formData) {
  if (!formData.dataDomain) {
    toast.error('Please select a domain');
    return false;
  }
  if (!formData.name.trim()) {
    toast.error('Please enter a scenario name');
    return false;
  }
  if (!stripHtml(formData.description).trim()) {
    toast.error('Please enter a description');
    return false;
  }
  return true;
}

function validateStatusComment(formData, isEditMode, isEditorFn, originalRequest) {
  if (!isEditMode || !isEditorFn() || !originalRequest) return true;
  const statusChanged = formData.status && formData.status !== originalRequest.status;
  if (!statusChanged) return true;
  if (!formData.statusComment || !formData.statusComment.trim()) {
    toast.error('Please provide a comment for the status change');
    return false;
  }
  return true;
}

function buildUserUpdatePayload(formData) {
  return {
    name: formData.name.trim(),
    description: formData.description,
    has_suggestion: formData.has_suggestion,
    knows_steps: formData.knows_steps,
    steps: formData.steps.length > 0 ? formData.steps : [],
    reason: formData.reason || null,
    team: formData.team || null,
    team_name: formData.team_name || null,
    assignee: formData.assignee || null,
    assignee_name: formData.assignee_name || null
  };
}

async function uploadFilesToRequest(files, targetRequestId) {
  for (const file of files) {
    try {
      await scenarioRequestAPI.uploadFile(targetRequestId, file);
    } catch (fileError) {
      toast.error(`Failed to upload: ${file.name}`);
    }
  }
}

function extractSubmitError(error) {
  const errorMsg = error.response?.data?.detail || error.response?.data?.error || 'Failed to submit request';
  return typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg);
}

// --- Custom hook: submission logic ---

function useAskScenarioSubmit({ isEditMode, isEditor, requestId, formData, uploadedFiles, originalRequest, navigate, setLoading }) {
  const handleEditSubmit = async () => {
    await scenarioRequestAPI.update(requestId, buildUserUpdatePayload(formData));

    const adminUpdateData = buildAdminUpdate(formData, originalRequest, isEditor);
    if (Object.keys(adminUpdateData).length > 0) {
      await scenarioRequestAPI.adminUpdate(requestId, adminUpdateData);
    }

    await uploadFilesToRequest(uploadedFiles, requestId);
    toast.success('Scenario request updated successfully!');
    navigate(`/my-requests/${requestId}`);
  };

  const handleCreateSubmit = async () => {
    const submitData = {
      requestType: formData.requestType,
      dataDomain: formData.dataDomain,
      ...buildUserUpdatePayload(formData)
    };
    const response = await scenarioRequestAPI.create(submitData);
    await uploadFilesToRequest(uploadedFiles, response.data.requestId);
    toast.success('Scenario request submitted successfully!');
    navigate('/my-requests');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateFormData(formData)) return;
    if (!validateStatusComment(formData, isEditMode, isEditor, originalRequest)) return;

    setLoading(true);
    try {
      if (isEditMode) {
        await handleEditSubmit();
      } else {
        await handleCreateSubmit();
      }
    } catch (error) {
      toast.error(extractSubmitError(error));
    } finally {
      setLoading(false);
    }
  };

  return { handleSubmit };
}

// --- Extracted JSX sub-components for form sections ---

function PageHeader({ isEditMode, requestId, navigate }) {
  return (
    <div className="mb-6">
      {isEditMode && (
        <button type="button" onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-content-secondary hover:text-content mb-4">
          <ArrowLeft size={18} />
          Back
        </button>
      )}
      <h1 className="text-2xl font-bold text-content">
        {isEditMode ? 'Edit Scenario Request' : 'Ask for a New Scenario'}
      </h1>
      <p className="text-content-secondary mt-1">
        {isEditMode
          ? `Editing request ${requestId}`
          : 'Submit a request for a new scenario or feature. Our team will review and respond.'}
      </p>
    </div>
  );
}

function RequestTypeSelect({ formData, requestTypes, handleChange }) {
  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-content-secondary mb-2">
        Request Type <span className="text-red-500">*</span>
      </label>
      <select name="requestType" value={formData.requestType} onChange={handleChange}
        className="w-full px-4 py-3 border border-edge rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-surface text-content">
        {requestTypes.length === 0 && (
          <option value="scenario">New Scenario Request</option>
        )}
        {requestTypes.map(type => (
          <option key={type.value} value={type.value}>{type.label}</option>
        ))}
      </select>
    </div>
  );
}

function DomainSelect({ formData, domains, handleChange }) {
  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-content-secondary mb-2">
        Domain <span className="text-red-500">*</span>
      </label>
      <select name="dataDomain" value={formData.dataDomain} onChange={handleChange}
        className="w-full px-4 py-3 border border-edge rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-surface text-content" required>
        <option value="">Select a domain...</option>
        {domains.map(domain => (
          <option key={domain.key || domain.value} value={domain.key || domain.value}>
            {domain.name || domain.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function TeamAssigneeSection({ formData, projectKey, projectName, onTeamSelect, onTeamClear, onAssigneeSelect, onAssigneeClear }) {
  const searchTeams = async (query) => {
    try {
      const res = await atlassianAPI.searchBoards(projectKey || null, query, 50);
      const boards = res.data || [];
      return boards.map(board => ({ id: String(board.id), label: board.name, searchText: board.name }));
    } catch {
      return [];
    }
  };

  const searchAssignees = async (query) => {
    try {
      const res = await atlassianAPI.searchUsers(projectKey || null, query, 50);
      return (res.data || []).map(user => ({
        id: user.accountId,
        label: user.displayName,
        searchText: `${user.displayName} ${user.emailAddress || ''}`,
        email: user.emailAddress
      }));
    } catch {
      return [];
    }
  };

  return (
    <div className="pt-3 border-t border-edge space-y-4">
      {projectName && (
        <p className="text-sm text-content-secondary">
          <span className="font-medium">Project:</span> {projectName}{projectKey ? ` (${projectKey})` : ''}
        </p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <AutocompleteInput
          label="Team"
          value={formData.team}
          displayValue={formData.team_name}
          onSearch={searchTeams}
          onSelect={onTeamSelect}
          onClear={onTeamClear}
          placeholder="Type to search teams..."
          minChars={2}
        />

        <AutocompleteInput
          label="Assignee"
          value={formData.assignee}
          displayValue={formData.assignee_name}
          onSearch={searchAssignees}
          onSelect={onAssigneeSelect}
          onClear={onAssigneeClear}
          placeholder="Type to search assignees..."
          minChars={2}
          renderOption={(opt) => (
            <span>{opt.label}{opt.email ? <span className="text-content-muted"> ({opt.email})</span> : ''}</span>
          )}
        />
      </div>
    </div>
  );
}

function BasicInfoSection({ formData, requestTypes, domains, projectKey, projectName, handleChange, handleRichTextChange, onTeamSelect, onTeamClear, onAssigneeSelect, onAssigneeClear }) {
  return (
    <div className="card">
      <div className="card-header">
        <h2 className="text-lg font-semibold text-content">Basic Information</h2>
      </div>
      <div className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <RequestTypeSelect formData={formData} requestTypes={requestTypes} handleChange={handleChange} />
          <DomainSelect formData={formData} domains={domains} handleChange={handleChange} />
        </div>

        <div className="w-full">
          <label className="block text-sm font-medium text-content-secondary mb-2">
            Scenario Name <span className="text-red-500">*</span>
          </label>
          <input type="text" name="name" value={formData.name} onChange={handleChange}
            className="w-full px-4 py-3 border border-edge rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-surface text-content placeholder-content-muted"
            placeholder="Enter a descriptive name for your scenario" required />
        </div>

        <div className="w-full">
          <label className="block text-sm font-medium text-content-secondary mb-2">
            Description <span className="text-red-500">*</span>
          </label>
          <RichTextEditor value={formData.description}
            onChange={(val) => handleRichTextChange('description', val)}
            placeholder="Describe what you need this scenario to do. Include data requirements, expected output format, and any specific conditions..."
            rows={8} />
        </div>

        <div className="w-full">
          <label className="block text-sm font-medium text-content-secondary mb-2">
            Reason / Business Justification
          </label>
          <RichTextEditor value={formData.reason}
            onChange={(val) => handleRichTextChange('reason', val)}
            placeholder="Why do you need this scenario? What business problem does it solve? (optional)"
            rows={4} />
        </div>

        <TeamAssigneeSection
          formData={formData} projectKey={projectKey} projectName={projectName}
          onTeamSelect={onTeamSelect} onTeamClear={onTeamClear}
          onAssigneeSelect={onAssigneeSelect} onAssigneeClear={onAssigneeClear}
        />
      </div>
    </div>
  );
}

function StepItem({ step, index, onRemove }) {
  return (
    <div className="flex items-start gap-3 p-4 bg-surface-secondary rounded-lg border border-edge">
      <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-sm font-semibold">
        {index + 1}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-content font-medium">{step.description}</p>
        {step.database && (
          <p className="text-xs text-content-muted mt-1">
            <span className="font-medium">Database:</span> {step.database}
          </p>
        )}
        {step.query && step.query.length > 0 && (
          <pre className="text-xs text-content-secondary mt-2 bg-surface-hover p-2 rounded overflow-x-auto font-mono">
            {step.query.join('\n')}
          </pre>
        )}
      </div>
      <button type="button" onClick={() => onRemove(index)}
        className="flex-shrink-0 text-content-muted hover:text-red-600 p-1">
        <Trash2 size={18} />
      </button>
    </div>
  );
}

function NewStepForm({ newStep, setNewStep, onAddStep }) {
  return (
    <div className="bg-surface-secondary rounded-lg p-5 border border-edge space-y-4">
      <div className="w-full">
        <label className="block text-xs font-medium text-content-secondary mb-1">Step Description</label>
        <input type="text" value={newStep.description}
          onChange={(e) => setNewStep(prev => ({ ...prev, description: e.target.value }))}
          className="w-full px-4 py-2.5 border border-edge rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-surface text-content placeholder-content-muted"
          placeholder="What should this step do?" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="w-full">
          <label className="block text-xs font-medium text-content-secondary mb-1">Database / Schema</label>
          <input type="text" value={newStep.database}
            onChange={(e) => setNewStep(prev => ({ ...prev, database: e.target.value }))}
            className="w-full px-4 py-2.5 border border-edge rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-surface text-content placeholder-content-muted"
            placeholder="e.g., sales_db.reporting" />
        </div>
        <div className="w-full">
          <label className="block text-xs font-medium text-content-secondary mb-1">SQL Query Hint</label>
          <input type="text" value={newStep.query}
            onChange={(e) => setNewStep(prev => ({ ...prev, query: e.target.value }))}
            className="w-full px-4 py-2.5 border border-edge rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-surface text-content placeholder-content-muted"
            placeholder="SELECT ... FROM ... WHERE ..." />
        </div>
      </div>
      <button type="button" onClick={onAddStep} disabled={!newStep.description.trim()}
        className="btn-secondary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
        <Plus size={16} />
        Add Step
      </button>
    </div>
  );
}

function ImplementationDetailsSection({ formData, newStep, setNewStep, handleChange, handleAddStep, handleRemoveStep }) {
  const showSteps = formData.has_suggestion || formData.knows_steps;

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <h2 className="text-lg font-semibold text-content">Implementation Details</h2>
        <div className="flex items-center gap-2 text-sm text-content-secondary">
          <HelpCircle size={16} />
          <span>Optional but helpful</span>
        </div>
      </div>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" name="has_suggestion" checked={formData.has_suggestion} onChange={handleChange}
              className="w-4 h-4 rounded border-edge text-primary-600 focus:ring-primary-500" />
            <span className="text-sm text-content-secondary">I have suggestions for implementation</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" name="knows_steps" checked={formData.knows_steps} onChange={handleChange}
              className="w-4 h-4 rounded border-edge text-primary-600 focus:ring-primary-500" />
            <span className="text-sm text-content-secondary">I know the required steps</span>
          </label>
        </div>

        {showSteps && (
          <div className="border-t border-edge pt-5">
            <h3 className="text-sm font-medium text-content-secondary mb-4">Suggested Steps</h3>

            {formData.steps.length > 0 && (
              <div className="space-y-3 mb-5">
                {formData.steps.map((step, index) => (
                  <StepItem key={index} step={step} index={index} onRemove={handleRemoveStep} />
                ))}
              </div>
            )}

            <NewStepForm newStep={newStep} setNewStep={setNewStep} onAddStep={handleAddStep} />
          </div>
        )}
      </div>
    </div>
  );
}

function FormActions({ isEditMode, loading, navigate }) {
  return (
    <div className="flex justify-end gap-4 pb-6">
      <button type="button" onClick={() => isEditMode ? navigate(-1) : navigate('/dashboard')}
        className="btn-secondary px-6">
        Cancel
      </button>
      <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2 px-6">
        <SubmitButtonIcon loading={loading} isEditMode={isEditMode} />
        {isEditMode ? 'Save Changes' : 'Submit Request'}
      </button>
    </div>
  );
}

// --- Main Component ---

function AskScenarioPage() {
  const navigate = useNavigate();
  const { requestId } = useParams();
  const { user, isEditor } = useAuth();
  const isEditMode = !!requestId;

  const form = useAskScenarioForm();
  const data = useAskScenarioData({ isEditMode, isEditor, requestId, user, navigate, form });
  const { handleSubmit } = useAskScenarioSubmit({
    isEditMode, isEditor, requestId,
    formData: form.formData, uploadedFiles: form.uploadedFiles,
    originalRequest: data.originalRequest, navigate, setLoading: data.setLoading
  });

  if (isEditMode && data.loadingRequest) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-primary-600" size={32} />
      </div>
    );
  }

  const showAdminSettings = isEditMode && isEditor();

  return (
    <div className="w-full max-w-5xl mx-auto px-4">
      <PageHeader isEditMode={isEditMode} requestId={requestId} navigate={navigate} />

      <form onSubmit={handleSubmit} className="space-y-6">
        <BasicInfoSection
          formData={form.formData} requestTypes={data.requestTypes} domains={data.domains}
          projectKey={data.projectKey} projectName={data.projectName}
          handleChange={form.handleChange} handleRichTextChange={form.handleRichTextChange}
          onTeamSelect={form.handleTeamSelect} onTeamClear={form.handleTeamClear}
          onAssigneeSelect={form.handleAssigneeSelect} onAssigneeClear={form.handleAssigneeClear}
        />

        <ImplementationDetailsSection
          formData={form.formData} newStep={form.newStep} setNewStep={form.setNewStep}
          handleChange={form.handleChange} handleAddStep={form.handleAddStep}
          handleRemoveStep={form.handleRemoveStep}
        />

        {showAdminSettings && (
          <AdminSettingsSection
            formData={form.formData} handleChange={form.handleChange}
            statuses={data.statuses} originalRequest={data.originalRequest}
          />
        )}

        <FileUploadSection
          isEditMode={isEditMode} existingFiles={form.existingFiles}
          uploadedFiles={form.uploadedFiles} handleFileUpload={form.handleFileUpload}
          handleRemoveFile={form.handleRemoveFile}
        />

        <FormActions isEditMode={isEditMode} loading={data.loading} navigate={navigate} />
      </form>
    </div>
  );
}

export default AskScenarioPage;
