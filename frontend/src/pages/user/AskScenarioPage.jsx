import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router';
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
import { scenarioRequestAPI, jiraAPI } from '../../services/api';
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

  const execCommand = (command, value = null) => {
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

    document.execCommand(command, false, value);
    setTimeout(() => handleInput(), 10);
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  };

  return (
    <div className={`border rounded-lg overflow-hidden transition-all ${isFocused ? 'ring-2 ring-red-500 border-transparent' : 'border-neutral-300'}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1.5 bg-neutral-50 border-b border-neutral-200">
        <button
          type="button"
          onClick={() => execCommand('bold')}
          className="p-1.5 rounded hover:bg-neutral-200 text-neutral-600"
          title="Bold"
        >
          <Bold size={16} />
        </button>
        <button
          type="button"
          onClick={() => execCommand('italic')}
          className="p-1.5 rounded hover:bg-neutral-200 text-neutral-600"
          title="Italic"
        >
          <Italic size={16} />
        </button>
        <div className="w-px h-5 bg-neutral-300 mx-1" />
        <button
          type="button"
          onClick={() => execCommand('insertUnorderedList')}
          className="p-1.5 rounded hover:bg-neutral-200 text-neutral-600"
          title="Bullet List"
        >
          <List size={16} />
        </button>
        <button
          type="button"
          onClick={() => execCommand('insertOrderedList')}
          className="p-1.5 rounded hover:bg-neutral-200 text-neutral-600"
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
          className="p-1.5 rounded hover:bg-neutral-200 text-neutral-600"
          title="Insert Link"
        >
          <LinkIcon size={16} />
        </button>
        <button
          type="button"
          onClick={() => execCommand('formatBlock', 'pre')}
          className="p-1.5 rounded hover:bg-neutral-200 text-neutral-600"
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
        className="w-full px-4 py-3 bg-white text-neutral-900 focus:outline-none overflow-y-auto prose prose-sm max-w-none"
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

function AskScenarioPage() {
  const navigate = useNavigate();
  const { requestId } = useParams();
  const { user, isEditor } = useAuth();

  const isEditMode = !!requestId;
  const [loading, setLoading] = useState(false);
  const [loadingRequest, setLoadingRequest] = useState(false);
  const [domains, setDomains] = useState([]);
  const [requestTypes, setRequestTypes] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [originalRequest, setOriginalRequest] = useState(null);
  const [jiraBoards, setJiraBoards] = useState([]);
  const [jiraUsers, setJiraUsers] = useState([]);
  const [loadingJiraUsers, setLoadingJiraUsers] = useState(false);

  const [formData, setFormData] = useState({
    requestType: 'scenario',
    dataDomain: '',
    name: '',
    description: '',
    has_suggestion: false,
    knows_steps: false,
    steps: [],
    reason: '',
    // Team and assignee
    team: '',
    assignee: '',
    assignee_name: '',
    // Admin fields (only editable by editors)
    status: '',
    scenarioKey: '',
    configName: '',
    fulfilmentDate: '',
    // Workflow comment (required when changing status)
    statusComment: ''
  });

  const [newStep, setNewStep] = useState({ description: '', database: '', query: '' });
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [existingFiles, setExistingFiles] = useState([]);

  useEffect(() => {
    loadLookups();
  }, []);

  useEffect(() => {
    if (isEditMode) {
      loadRequest();
    }
  }, [requestId]);

  const loadLookups = async () => {
    try {
      const promises = [
        scenarioRequestAPI.getDomains(),
        scenarioRequestAPI.getRequestTypes(),
        scenarioRequestAPI.getDefaults()
      ];
      // Load statuses for editors in edit mode
      if (isEditMode && isEditor()) {
        promises.push(scenarioRequestAPI.getStatuses());
      }

      const results = await Promise.all(promises);
      setDomains(results[0].data || []);
      setRequestTypes(results[1].data || []);
      const defaults = results[2].data || {};
      if (results[3]) {
        setStatuses(results[3].data || []);
      }

      // Set default request type if available (only for new requests)
      if (!isEditMode && results[1].data && results[1].data.length > 0) {
        setFormData(prev => ({
          ...prev,
          requestType: results[1].data[0].value,
          team: defaults.team || '',
          assignee: defaults.assignee || '',
          assignee_name: defaults.assignee_name || ''
        }));
      }

      // Load Jira boards and assignable users
      loadJiraData();
    } catch (error) {
      console.error('Failed to load lookups:', error);
    }
  };

  const loadJiraData = async () => {
    try {
      const [boardsRes, usersRes] = await Promise.all([
        jiraAPI.getBoards().catch(() => ({ data: [] })),
        jiraAPI.getAssignableUsers().catch(() => ({ data: [] }))
      ]);
      setJiraBoards(boardsRes.data || []);
      setJiraUsers(usersRes.data || []);
    } catch (error) {
      console.error('Failed to load Jira data:', error);
    }
  };

  const searchJiraUsers = async (query) => {
    if (!query || query.length < 1) return;
    setLoadingJiraUsers(true);
    try {
      const res = await jiraAPI.getAssignableUsers(null, query);
      setJiraUsers(res.data || []);
    } catch (error) {
      console.error('Failed to search Jira users:', error);
    } finally {
      setLoadingJiraUsers(false);
    }
  };

  const loadRequest = async () => {
    setLoadingRequest(true);
    try {
      const response = await scenarioRequestAPI.get(requestId);
      const request = response.data;
      setOriginalRequest(request);

      // Check if user can edit this request
      const isOwner = request.user_id === user?.user_id;
      const canEdit = isOwner || isEditor();

      if (!canEdit) {
        toast.error('You do not have permission to edit this request');
        navigate('/my-requests');
        return;
      }

      // Populate form with existing data
      setFormData({
        requestType: request.requestType || 'scenario',
        dataDomain: request.dataDomain || '',
        name: request.name || '',
        description: request.description || '',
        has_suggestion: request.has_suggestion || false,
        knows_steps: request.knows_steps || false,
        steps: request.steps || [],
        reason: request.reason || '',
        // Team and assignee
        team: request.team || '',
        assignee: request.assignee || '',
        assignee_name: request.assignee_name || '',
        // Admin fields
        status: request.status || '',
        scenarioKey: request.scenarioKey || '',
        configName: request.configName || '',
        fulfilmentDate: request.fulfilmentDate ? request.fulfilmentDate.split('T')[0] : ''
      });

      // Set existing files
      setExistingFiles(request.files || []);
    } catch (error) {
      console.error('Failed to load request:', error);
      toast.error('Failed to load request');
      navigate('/my-requests');
    } finally {
      setLoadingRequest(false);
    }
  };

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

  const handleAddStep = () => {
    if (newStep.description.trim()) {
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
      setNewStep({ description: '', database: '', query: '' });
    }
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

  // Strip HTML for plain text check
  const stripHtml = (html) => {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.dataDomain) {
      toast.error('Please select a domain');
      return;
    }
    if (!formData.name.trim()) {
      toast.error('Please enter a scenario name');
      return;
    }
    if (!stripHtml(formData.description).trim()) {
      toast.error('Please enter a description');
      return;
    }

    // Validate status change comment for editors
    if (isEditMode && isEditor() && originalRequest) {
      if (formData.status && formData.status !== originalRequest.status) {
        if (!formData.statusComment || !formData.statusComment.trim()) {
          toast.error('Please provide a comment for the status change');
          return;
        }
      }
    }

    setLoading(true);
    try {
      if (isEditMode) {
        // Update existing request
        const userUpdateData = {
          name: formData.name.trim(),
          description: formData.description,
          has_suggestion: formData.has_suggestion,
          knows_steps: formData.knows_steps,
          steps: formData.steps.length > 0 ? formData.steps : [],
          reason: formData.reason || null,
          team: formData.team || null,
          assignee: formData.assignee || null,
          assignee_name: formData.assignee_name || null
        };

        // Use user update endpoint for basic fields
        await scenarioRequestAPI.update(requestId, userUpdateData);

        // If editor, also update admin fields
        if (isEditor() && originalRequest) {
          const adminUpdateData = {};

          // Only include fields that changed
          if (formData.status && formData.status !== originalRequest.status) {
            adminUpdateData.status = formData.status;
            // Include status comment for workflow tracking
            adminUpdateData.status_comment = formData.statusComment.trim();
          }
          if (formData.dataDomain !== originalRequest.dataDomain) {
            adminUpdateData.dataDomain = formData.dataDomain;
          }
          if (formData.scenarioKey !== (originalRequest.scenarioKey || '')) {
            adminUpdateData.scenarioKey = formData.scenarioKey || null;
          }
          if (formData.configName !== (originalRequest.configName || '')) {
            adminUpdateData.configName = formData.configName || null;
          }
          if (formData.fulfilmentDate !== (originalRequest.fulfilmentDate?.split('T')[0] || '')) {
            adminUpdateData.fulfilmentDate = formData.fulfilmentDate || null;
          }

          if (Object.keys(adminUpdateData).length > 0) {
            await scenarioRequestAPI.adminUpdate(requestId, adminUpdateData);
          }
        }

        // Upload new files if any
        for (const file of uploadedFiles) {
          try {
            await scenarioRequestAPI.uploadFile(requestId, file);
          } catch (fileError) {
            console.error('Failed to upload file:', file.name, fileError);
            toast.error(`Failed to upload: ${file.name}`);
          }
        }

        toast.success('Scenario request updated successfully!');
        navigate(`/my-requests/${requestId}`);
      } else {
        // Create new request
        const submitData = {
          requestType: formData.requestType,
          dataDomain: formData.dataDomain,
          name: formData.name.trim(),
          description: formData.description,
          has_suggestion: formData.has_suggestion,
          knows_steps: formData.knows_steps,
          steps: formData.steps.length > 0 ? formData.steps : [],
          reason: formData.reason || null,
          team: formData.team || null,
          assignee: formData.assignee || null,
          assignee_name: formData.assignee_name || null
        };

        const response = await scenarioRequestAPI.create(submitData);
        const newRequestId = response.data.requestId;

        // Upload files if any
        for (const file of uploadedFiles) {
          try {
            await scenarioRequestAPI.uploadFile(newRequestId, file);
          } catch (fileError) {
            console.error('Failed to upload file:', file.name, fileError);
            toast.error(`Failed to upload: ${file.name}`);
          }
        }

        toast.success('Scenario request submitted successfully!');
        navigate('/my-requests');
      }
    } catch (error) {
      console.error('Submit error:', error.response?.data);
      const errorMsg = error.response?.data?.detail || error.response?.data?.error || 'Failed to submit request';
      toast.error(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
    } finally {
      setLoading(false);
    }
  };

  // Show loading state while loading request in edit mode
  if (isEditMode && loadingRequest) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-red-600" size={32} />
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-4">
      <div className="mb-6">
        {isEditMode && (
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-neutral-600 hover:text-neutral-900 mb-4"
          >
            <ArrowLeft size={18} />
            Back
          </button>
        )}
        <h1 className="text-2xl font-bold text-neutral-900">
          {isEditMode ? 'Edit Scenario Request' : 'Ask for a New Scenario'}
        </h1>
        <p className="text-neutral-600 mt-1">
          {isEditMode
            ? `Editing request ${requestId}`
            : 'Submit a request for a new scenario or feature. Our team will review and respond.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Request Type & Domain */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold text-neutral-900">Basic Information</h2>
          </div>
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="w-full">
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Request Type <span className="text-red-500">*</span>
                </label>
                <select
                  name="requestType"
                  value={formData.requestType}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white text-neutral-900"
                >
                  {requestTypes.length === 0 && (
                    <option value="scenario">New Scenario Request</option>
                  )}
                  {requestTypes.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
              
              <div className="w-full">
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Domain <span className="text-red-500">*</span>
                </label>
                <select
                  name="dataDomain"
                  value={formData.dataDomain}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white text-neutral-900"
                  required
                >
                  <option value="">Select a domain...</option>
                  {domains.map(domain => (
                    <option key={domain.key || domain.value} value={domain.key || domain.value}>
                      {domain.name || domain.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="w-full">
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Scenario Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white text-neutral-900 placeholder-neutral-400"
                placeholder="Enter a descriptive name for your scenario"
                required
              />
            </div>

            <div className="w-full">
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Description <span className="text-red-500">*</span>
              </label>
              <RichTextEditor
                value={formData.description}
                onChange={(val) => handleRichTextChange('description', val)}
                placeholder="Describe what you need this scenario to do. Include data requirements, expected output format, and any specific conditions..."
                rows={8}
              />
            </div>

            <div className="w-full">
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Reason / Business Justification
              </label>
              <RichTextEditor
                value={formData.reason}
                onChange={(val) => handleRichTextChange('reason', val)}
                placeholder="Why do you need this scenario? What business problem does it solve? (optional)"
                rows={4}
              />
            </div>

            {/* Team and Assignee - editable by all users */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-3 border-t border-neutral-200">
              <div className="w-full">
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Team
                </label>
                <select
                  name="team"
                  value={formData.team}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white text-neutral-900"
                >
                  <option value="">Select a team...</option>
                  {jiraBoards.map(board => (
                    <option key={board.id} value={board.name}>{board.name}</option>
                  ))}
                  {formData.team && !jiraBoards.find(b => b.name === formData.team) && (
                    <option value={formData.team}>{formData.team}</option>
                  )}
                </select>
              </div>

              <div className="w-full">
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Assignee
                </label>
                <select
                  name="assignee"
                  value={formData.assignee}
                  onChange={(e) => {
                    const selectedUser = jiraUsers.find(u => u.accountId === e.target.value);
                    setFormData(prev => ({
                      ...prev,
                      assignee: e.target.value,
                      assignee_name: selectedUser ? selectedUser.displayName : ''
                    }));
                  }}
                  className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white text-neutral-900"
                >
                  <option value="">Select an assignee...</option>
                  {jiraUsers.map(jUser => (
                    <option key={jUser.accountId} value={jUser.accountId}>
                      {jUser.displayName}{jUser.emailAddress ? ` (${jUser.emailAddress})` : ''}
                    </option>
                  ))}
                  {formData.assignee && !jiraUsers.find(u => u.accountId === formData.assignee) && (
                    <option value={formData.assignee}>{formData.assignee_name || formData.assignee}</option>
                  )}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Steps Section */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="text-lg font-semibold text-neutral-900">Implementation Details</h2>
            <div className="flex items-center gap-2 text-sm text-neutral-600">
              <HelpCircle size={16} />
              <span>Optional but helpful</span>
            </div>
          </div>
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="has_suggestion"
                  checked={formData.has_suggestion}
                  onChange={handleChange}
                  className="w-4 h-4 rounded border-neutral-300 text-red-600 focus:ring-red-500"
                />
                <span className="text-sm text-neutral-700">I have suggestions for implementation</span>
              </label>
              
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="knows_steps"
                  checked={formData.knows_steps}
                  onChange={handleChange}
                  className="w-4 h-4 rounded border-neutral-300 text-red-600 focus:ring-red-500"
                />
                <span className="text-sm text-neutral-700">I know the required steps</span>
              </label>
            </div>

            {(formData.has_suggestion || formData.knows_steps) && (
              <div className="border-t border-neutral-200 pt-5">
                <h3 className="text-sm font-medium text-neutral-700 mb-4">Suggested Steps</h3>
                
                {/* Existing Steps */}
                {formData.steps.length > 0 && (
                  <div className="space-y-3 mb-5">
                    {formData.steps.map((step, index) => (
                      <div key={index} className="flex items-start gap-3 p-4 bg-neutral-50 rounded-lg border border-neutral-200">
                        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-sm font-semibold">
                          {index + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-neutral-800 font-medium">{step.description}</p>
                          {step.database && (
                            <p className="text-xs text-neutral-500 mt-1">
                              <span className="font-medium">Database:</span> {step.database}
                            </p>
                          )}
                          {step.query && step.query.length > 0 && (
                            <pre className="text-xs text-neutral-600 mt-2 bg-neutral-100 p-2 rounded overflow-x-auto font-mono">
                              {step.query.join('\n')}
                            </pre>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveStep(index)}
                          className="flex-shrink-0 text-neutral-400 hover:text-red-600 p-1"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add New Step */}
                <div className="bg-neutral-50 rounded-lg p-5 border border-neutral-200 space-y-4">
                  <div className="w-full">
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Step Description</label>
                    <input
                      type="text"
                      value={newStep.description}
                      onChange={(e) => setNewStep(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white text-neutral-900 placeholder-neutral-400"
                      placeholder="What should this step do?"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="w-full">
                      <label className="block text-xs font-medium text-neutral-600 mb-1">Database / Schema</label>
                      <input
                        type="text"
                        value={newStep.database}
                        onChange={(e) => setNewStep(prev => ({ ...prev, database: e.target.value }))}
                        className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white text-neutral-900 placeholder-neutral-400"
                        placeholder="e.g., sales_db.reporting"
                      />
                    </div>
                    <div className="w-full">
                      <label className="block text-xs font-medium text-neutral-600 mb-1">SQL Query Hint</label>
                      <input
                        type="text"
                        value={newStep.query}
                        onChange={(e) => setNewStep(prev => ({ ...prev, query: e.target.value }))}
                        className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white text-neutral-900 placeholder-neutral-400"
                        placeholder="SELECT ... FROM ... WHERE ..."
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddStep}
                    disabled={!newStep.description.trim()}
                    className="btn-secondary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus size={16} />
                    Add Step
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Admin Fields - Only for editors in edit mode */}
        {isEditMode && isEditor() && (
          <div className="card">
            <div className="card-header">
              <h2 className="text-lg font-semibold text-neutral-900">Admin Settings</h2>
              <p className="text-sm text-neutral-500 mt-1">These fields are only visible to administrators and editors</p>
            </div>
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="w-full">
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Status
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white text-neutral-900"
                  >
                    {statuses.map(status => (
                      <option key={status.value} value={status.value}>{status.label}</option>
                    ))}
                  </select>
                </div>

                <div className="w-full">
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Target Date
                  </label>
                  <input
                    type="date"
                    name="fulfilmentDate"
                    value={formData.fulfilmentDate}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white text-neutral-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="w-full">
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Scenario Key
                  </label>
                  <input
                    type="text"
                    name="scenarioKey"
                    value={formData.scenarioKey}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white text-neutral-900 placeholder-neutral-400"
                    placeholder="e.g., SC-001"
                  />
                </div>

                <div className="w-full">
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Config Name
                  </label>
                  <input
                    type="text"
                    name="configName"
                    value={formData.configName}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white text-neutral-900 placeholder-neutral-400"
                    placeholder="Configuration name"
                  />
                </div>
              </div>

              {/* Status Change Comment - Required when status is changed */}
              {formData.status && originalRequest && formData.status !== originalRequest.status && (
                <div className="w-full border-t border-neutral-200 pt-5">
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Status Change Comment <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="statusComment"
                    value={formData.statusComment}
                    onChange={handleChange}
                    rows={3}
                    className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white text-neutral-900 placeholder-neutral-400"
                    placeholder="Please provide a reason for this status change..."
                    required
                  />
                  <p className="text-xs text-neutral-500 mt-1">
                    This comment will be recorded in the workflow history.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* File Upload */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold text-neutral-900">Sample Files</h2>
            <p className="text-sm text-neutral-500 mt-1">Upload sample data files or screenshots to help us understand your requirements</p>
          </div>
          <div>
            {/* Show existing files in edit mode */}
            {isEditMode && existingFiles.length > 0 && (
              <div className="mb-5 space-y-2">
                <p className="text-sm font-medium text-neutral-700">Existing files:</p>
                {existingFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded bg-green-100 flex items-center justify-center text-green-600">
                        <FileUp size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-neutral-800 truncate">{file.file_name || file.name}</p>
                        <p className="text-xs text-neutral-500">{file.file_type} • v{file.version || 1}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="border-2 border-dashed border-neutral-300 rounded-lg p-8 text-center hover:border-red-300 transition-colors">
              <FileUp className="mx-auto text-neutral-400 mb-3" size={40} />
              <p className="text-sm text-neutral-600 mb-3">
                {isEditMode ? 'Add more files' : 'Drag and drop files here, or click to browse'}
              </p>
              <p className="text-xs text-neutral-400 mb-4">
                Supported: CSV, Excel, JSON, PDF, PNG, JPG (max 10MB each)
              </p>
              <input
                type="file"
                id="file-upload"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                accept=".csv,.xlsx,.xls,.json,.pdf,.png,.jpg,.jpeg"
              />
              <label
                htmlFor="file-upload"
                className="btn-secondary cursor-pointer inline-block"
              >
                Choose Files
              </label>
            </div>

            {uploadedFiles.length > 0 && (
              <div className="mt-5 space-y-2">
                <p className="text-sm font-medium text-neutral-700">{uploadedFiles.length} new file(s) to upload:</p>
                {uploadedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg border border-neutral-200">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded bg-red-100 flex items-center justify-center text-red-600">
                        <FileUp size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-neutral-800 truncate">{file.name}</p>
                        <p className="text-xs text-neutral-500">{(file.size / 1024).toFixed(1)} KB</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(index)}
                      className="flex-shrink-0 text-neutral-400 hover:text-red-600 p-1"
                    >
                      <X size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-4 pb-6">
          <button
            type="button"
            onClick={() => isEditMode ? navigate(-1) : navigate('/dashboard')}
            className="btn-secondary px-6"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary flex items-center gap-2 px-6"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={18} />
            ) : isEditMode ? (
              <Save size={18} />
            ) : (
              <Send size={18} />
            )}
            {isEditMode ? 'Save Changes' : 'Submit Request'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default AskScenarioPage;
