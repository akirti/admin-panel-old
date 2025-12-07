import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { scenariosAPI, playboardsAPI, domainsAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Card, Button, Input, Modal, Badge, Select, Toggle, FileUpload } from '../../components/shared';
import {
  ArrowLeft,
  FileText,
  ChevronRight,
  Layout,
  Settings,
  Plus,
  Edit2,
  Download,
  Eye,
  Trash2,
  Upload,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';

function ScenarioDetailPage() {
  const { scenarioKey, domainKey } = useParams();
  const navigate = useNavigate();
  const { isSuperAdmin, isEditor, hasPermission } = useAuth();

  const [scenario, setScenario] = useState(null);
  const [playboards, setPlayboards] = useState([]);
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('playboards');

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [selectedPlayboard, setSelectedPlayboard] = useState(null);
  const [formActiveTab, setFormActiveTab] = useState('basic');
  const [saving, setSaving] = useState(false);

  // Upload state
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadName, setUploadName] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [jsonPreview, setJsonPreview] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    key: '',
    name: '',
    description: '',
    scenarioKey: '',
    dataDomain: '',
    status: 'A',
    order: 0,
    program_key: '',
    config_type: 'db',
    addon_configurations: [],
    widgets: {
      filters: [],
      grid: {
        actions: {
          rowActions: {
            renderAs: 'button',
            attributes: [],
            events: []
          },
          headerActions: {}
        },
        layout: {
          colums: [],
          headers: [],
          footer: [],
          ispaginated: true,
          defaultSize: 25
        }
      },
      pagination: []
    },
    scenarioDescription: []
  });

  // Filter builder state
  const [currentFilter, setCurrentFilter] = useState({
    name: '',
    dataKey: '',
    displayName: '',
    index: 0,
    visible: true,
    status: 'Y',
    inputHint: '',
    title: '',
    type: 'input',
    defaultValue: '',
    regex: '',
    options: []
  });

  // Row action builder state
  const [currentRowAction, setCurrentRowAction] = useState({
    key: '',
    name: '',
    path: '',
    dataDomain: '',
    status: 'A',
    order: 0,
    filters: []
  });

  // Row action filter input state
  const [actionFilterInput, setActionFilterInput] = useState({ inputKey: '', dataKey: '' });

  // Description builder state
  const [currentDescription, setCurrentDescription] = useState({
    index: 0,
    type: 'h3',
    text: '',
    nodes: []
  });

  // Options management for select filters
  const [optionInput, setOptionInput] = useState({ value: '', name: '' });

  // Addon configurations management
  const [addonInput, setAddonInput] = useState('');

  // Permission checks
  const canEdit = isSuperAdmin() || isEditor() || hasPermission('scenarios.edit');
  const canAdd = isSuperAdmin() || hasPermission('playboards.create');
  const canDelete = isSuperAdmin() || hasPermission('playboards.delete');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [scenarioRes, playboardsRes, domainsRes] = await Promise.all([
        scenariosAPI.get(scenarioKey),
        scenariosAPI.getPlayboards(scenarioKey),
        domainsAPI.list({ limit: 100 })
      ]);
      setScenario(scenarioRes.data);
      setPlayboards(playboardsRes.data || []);
      setDomains(domainsRes.data.data || domainsRes.data || []);
    } catch (error) {
      console.error('Failed to fetch scenario data:', error);
      toast.error('Failed to load scenario details');
    } finally {
      setLoading(false);
    }
  }, [scenarioKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const resetForm = () => {
    setFormData({
      key: '',
      name: '',
      description: '',
      scenarioKey: scenarioKey,
      dataDomain: '',
      status: 'A',
      order: 0,
      program_key: '',
      config_type: 'db',
      addon_configurations: [],
      widgets: {
        filters: [],
        grid: {
          actions: {
            rowActions: {
              renderAs: 'button',
              attributes: [],
              events: []
            },
            headerActions: {}
          },
          layout: {
            colums: [],
            headers: [],
            footer: [],
            ispaginated: true,
            defaultSize: 25
          }
        },
        pagination: [
          {
            name: 'limit',
            dataKey: 'limit',
            displayName: 'Result Size',
            index: 0,
            visible: true,
            attributes: [
              { key: 'type', value: 'dropdown' },
              { key: 'options', value: '25,50,75,100' },
              { key: 'defaultValue', value: '25' },
              { key: 'width', value: '10em' }
            ]
          }
        ]
      },
      scenarioDescription: []
    });
    setEditingItem(null);
    setFormActiveTab('basic');
    setCurrentFilter({
      name: '', dataKey: '', displayName: '', index: 0, visible: true,
      status: 'Y', inputHint: '', title: '', type: 'input', defaultValue: '', regex: '', options: []
    });
    setCurrentRowAction({ key: '', name: '', path: '', dataDomain: '', status: 'A', order: 0, filters: [] });
    setCurrentDescription({ index: 0, type: 'h3', text: '', nodes: [] });
  };

  const handleAddPlayboard = () => {
    resetForm();
    setFormData(prev => ({ ...prev, scenarioKey: scenarioKey }));
    setModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    const data = item.data || {};

    const defaultWidgets = {
      filters: [],
      grid: {
        actions: {
          rowActions: { renderAs: 'button', attributes: [], events: [] },
          headerActions: {}
        },
        layout: { colums: [], headers: [], footer: [], ispaginated: true, defaultSize: 25 }
      },
      pagination: []
    };

    const widgets = data.widgets ? {
      filters: data.widgets.filters || [],
      grid: {
        actions: {
          rowActions: {
            renderAs: data.widgets.grid?.actions?.rowActions?.renderAs || 'button',
            attributes: data.widgets.grid?.actions?.rowActions?.attributes || [],
            events: data.widgets.grid?.actions?.rowActions?.events || []
          },
          headerActions: data.widgets.grid?.actions?.headerActions || {}
        },
        layout: {
          colums: data.widgets.grid?.layout?.colums || [],
          headers: data.widgets.grid?.layout?.headers || [],
          footer: data.widgets.grid?.layout?.footer || [],
          ispaginated: data.widgets.grid?.layout?.ispaginated !== undefined ? data.widgets.grid.layout.ispaginated : true,
          defaultSize: data.widgets.grid?.layout?.defaultSize || 25
        }
      },
      pagination: data.widgets.pagination || []
    } : defaultWidgets;

    setFormData({
      key: data.key || item.name || '',
      name: item.name || '',
      description: item.description || '',
      scenarioKey: item.scenarioKey || data.scenarioKey || scenarioKey,
      dataDomain: data.dataDomain || '',
      status: data.status || (item.status === 'active' ? 'A' : 'I'),
      order: data.order || 0,
      program_key: data.program_key || '',
      config_type: data.config_type || 'db',
      addon_configurations: data.addon_configurations || [],
      widgets: widgets,
      scenarioDescription: data.scenarioDescription || []
    });
    setModalOpen(true);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: formData.name,
        description: formData.description,
        scenarioKey: formData.scenarioKey || scenarioKey,
        status: formData.status === 'A' ? 'active' : 'inactive',
        data: {
          key: formData.key,
          dataDomain: formData.dataDomain,
          scenarioKey: formData.scenarioKey || scenarioKey,
          scenerioKey: formData.scenarioKey || scenarioKey,
          order: formData.order,
          status: formData.status,
          program_key: formData.program_key,
          config_type: formData.config_type,
          addon_configurations: formData.addon_configurations,
          widgets: formData.widgets,
          scenarioDescription: formData.scenarioDescription
        }
      };
      await playboardsAPI.create(payload);
      toast.success('Playboard created successfully');
      setModalOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create playboard');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: formData.name,
        description: formData.description,
        scenarioKey: formData.scenarioKey || scenarioKey,
        status: formData.status === 'A' ? 'active' : 'inactive',
        data: {
          key: formData.key,
          dataDomain: formData.dataDomain,
          scenarioKey: formData.scenarioKey || scenarioKey,
          scenerioKey: formData.scenarioKey || scenarioKey,
          order: formData.order,
          status: formData.status,
          program_key: formData.program_key,
          config_type: formData.config_type,
          addon_configurations: formData.addon_configurations,
          widgets: formData.widgets,
          scenarioDescription: formData.scenarioDescription
        }
      };
      await playboardsAPI.update(editingItem.id || editingItem._id, payload);
      toast.success('Playboard updated successfully');
      setModalOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update playboard');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePlayboard = async (playboard) => {
    if (!window.confirm(`Are you sure you want to delete "${playboard.name}"?`)) {
      return;
    }
    try {
      await playboardsAPI.delete(playboard._id || playboard.id);
      toast.success('Playboard deleted successfully');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete playboard');
    }
  };

  const handleDownloadPlayboard = async (playboard) => {
    try {
      const response = await playboardsAPI.download(playboard._id || playboard.id);
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${playboard.data?.key || playboard.key || playboard.name}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Playboard downloaded');
    } catch (error) {
      toast.error('Failed to download playboard');
    }
  };

  const handleToggleStatus = async (playboard) => {
    try {
      await playboardsAPI.toggleStatus(playboard._id || playboard.id);
      toast.success(`Playboard ${playboard.status === 'active' ? 'deactivated' : 'activated'}`);
      fetchData();
    } catch (error) {
      toast.error('Failed to toggle playboard status');
    }
  };

  const handleViewDetails = (item) => {
    setSelectedPlayboard(item);
    setDetailModalOpen(true);
  };

  // File upload handlers
  const handleFileSelect = async (file) => {
    setUploadFile(file);
    if (file && file.name.endsWith('.json')) {
      try {
        const text = await file.text();
        const json = JSON.parse(text);
        setJsonPreview(json);
        if (json.key) setUploadName(json.key);
      } catch (e) {
        toast.error('Invalid JSON file');
        setJsonPreview(null);
      }
    }
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      toast.error('Please select a file');
      return;
    }

    const formDataUpload = new FormData();
    formDataUpload.append('file', uploadFile);

    try {
      await playboardsAPI.upload(formDataUpload, {
        scenario_key: scenarioKey,
        name: uploadName || undefined,
        description: uploadDescription || undefined
      });
      toast.success('Playboard uploaded successfully');
      setUploadModalOpen(false);
      resetUploadForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Upload failed');
    }
  };

  const resetUploadForm = () => {
    setUploadFile(null);
    setUploadName('');
    setUploadDescription('');
    setJsonPreview(null);
  };

  // Filter management
  const addFilter = () => {
    const newFilter = {
      name: currentFilter.name,
      dataKey: currentFilter.dataKey || currentFilter.name,
      displayName: currentFilter.displayName,
      index: formData.widgets.filters.length,
      visible: currentFilter.visible,
      status: currentFilter.status,
      inputHint: currentFilter.inputHint,
      title: currentFilter.title,
      attributes: [
        { key: 'type', value: currentFilter.type },
        { key: 'defaultValue', value: currentFilter.defaultValue },
        { key: 'regex', value: currentFilter.regex }
      ],
      description: [],
      validators: []
    };

    if (currentFilter.type === 'select' && currentFilter.options.length > 0) {
      newFilter.attributes.push({ key: 'options', value: currentFilter.options });
    }

    setFormData({
      ...formData,
      widgets: {
        ...formData.widgets,
        filters: [...formData.widgets.filters, newFilter]
      }
    });

    setCurrentFilter({
      name: '', dataKey: '', displayName: '', index: 0, visible: true,
      status: 'Y', inputHint: '', title: '', type: 'input', defaultValue: '', regex: '', options: []
    });
  };

  const removeFilter = (index) => {
    const newFilters = formData.widgets.filters.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      widgets: {
        ...formData.widgets,
        filters: newFilters.map((f, i) => ({ ...f, index: i }))
      }
    });
  };

  // Row action management
  const addRowAction = () => {
    const newAction = {
      key: currentRowAction.key,
      name: currentRowAction.name,
      path: currentRowAction.path,
      dataDomain: currentRowAction.dataDomain,
      status: currentRowAction.status,
      order: formData.widgets.grid.actions.rowActions.events.length,
      filters: currentRowAction.filters
    };

    setFormData({
      ...formData,
      widgets: {
        ...formData.widgets,
        grid: {
          ...formData.widgets.grid,
          actions: {
            ...formData.widgets.grid.actions,
            rowActions: {
              ...formData.widgets.grid.actions.rowActions,
              events: [...formData.widgets.grid.actions.rowActions.events, newAction]
            }
          }
        }
      }
    });

    setCurrentRowAction({ key: '', name: '', path: '', dataDomain: '', status: 'A', order: 0, filters: [] });
  };

  const removeRowAction = (index) => {
    const newEvents = formData.widgets.grid.actions.rowActions.events.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      widgets: {
        ...formData.widgets,
        grid: {
          ...formData.widgets.grid,
          actions: {
            ...formData.widgets.grid.actions,
            rowActions: {
              ...formData.widgets.grid.actions.rowActions,
              events: newEvents.map((e, i) => ({ ...e, order: i }))
            }
          }
        }
      }
    });
  };

  // Action filter management
  const addActionFilter = () => {
    if (actionFilterInput.inputKey && actionFilterInput.dataKey) {
      setCurrentRowAction({
        ...currentRowAction,
        filters: [...currentRowAction.filters, { inputKey: actionFilterInput.inputKey, dataKey: actionFilterInput.dataKey }]
      });
      setActionFilterInput({ inputKey: '', dataKey: '' });
    }
  };

  const removeActionFilter = (index) => {
    setCurrentRowAction({
      ...currentRowAction,
      filters: currentRowAction.filters.filter((_, i) => i !== index)
    });
  };

  // Description management
  const addDescription = () => {
    const newDesc = {
      index: formData.scenarioDescription.length,
      type: currentDescription.type,
      text: currentDescription.text,
      nodes: currentDescription.nodes
    };

    setFormData({
      ...formData,
      scenarioDescription: [...formData.scenarioDescription, newDesc]
    });

    setCurrentDescription({ index: 0, type: 'h3', text: '', nodes: [] });
  };

  const removeDescription = (index) => {
    const newDescs = formData.scenarioDescription.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      scenarioDescription: newDescs.map((d, i) => ({ ...d, index: i }))
    });
  };

  // Options management for select filters
  const addOption = () => {
    if (optionInput.value && optionInput.name) {
      setCurrentFilter({
        ...currentFilter,
        options: [...currentFilter.options, { value: optionInput.value, name: optionInput.name }]
      });
      setOptionInput({ value: '', name: '' });
    }
  };

  const removeOption = (index) => {
    setCurrentFilter({
      ...currentFilter,
      options: currentFilter.options.filter((_, i) => i !== index)
    });
  };

  // Addon configurations management
  const addAddon = () => {
    if (addonInput && !formData.addon_configurations.includes(addonInput)) {
      setFormData({
        ...formData,
        addon_configurations: [...formData.addon_configurations, addonInput]
      });
      setAddonInput('');
    }
  };

  const removeAddon = (index) => {
    setFormData({
      ...formData,
      addon_configurations: formData.addon_configurations.filter((_, i) => i !== index)
    });
  };

  const formTabs = [
    { id: 'basic', label: 'Basic Info' },
    { id: 'filters', label: 'Filters' },
    { id: 'actions', label: 'Row Actions' },
    { id: 'grid', label: 'Grid Settings' },
    { id: 'description', label: 'Description' },
    { id: 'json', label: 'JSON Preview' }
  ];

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!scenario) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-800 mb-2">Scenario Not Found</h2>
        <p className="text-gray-500 mb-4">The scenario you're looking for doesn't exist.</p>
        <Link to="/domains" className="btn-primary">
          Back to Domains
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link to="/domains" className="hover:text-blue-600 flex items-center gap-1">
          <ArrowLeft size={16} />
          Domains
        </Link>
        <ChevronRight size={16} />
        {(domainKey || scenario.domainKey) && (
          <>
            <Link to={`/domains/${domainKey || scenario.domainKey}`} className="hover:text-blue-600">
              {domainKey || scenario.domainKey}
            </Link>
            <ChevronRight size={16} />
          </>
        )}
        <span className="text-gray-800">{scenario.name}</span>
      </div>

      {/* Scenario Header */}
      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-purple-100 rounded-lg flex items-center justify-center">
              <FileText className="text-purple-600" size={32} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{scenario.name}</h1>
              <p className="text-gray-500">{scenario.key}</p>
              {scenario.description && (
                <p className="text-gray-600 mt-2">{scenario.description}</p>
              )}
              <div className="flex items-center gap-4 mt-3">
                <Badge variant={scenario.status === 'active' || scenario.status === 'A' ? 'success' : 'default'}>
                  {scenario.status === 'active' || scenario.status === 'A' ? 'Active' : 'Inactive'}
                </Badge>
                {scenario.domainKey && (
                  <span className="text-sm text-gray-500">
                    Domain: <span className="font-medium">{scenario.domainKey}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
          {canEdit && (
            <Link
              to={isSuperAdmin() ? `/admin/scenarios` : '#'}
              className="btn-secondary text-sm"
            >
              <Edit2 size={16} className="mr-1" />
              Edit Scenario
            </Link>
          )}
        </div>
      </Card>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('playboards')}
            className={`pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'playboards'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Layout size={16} className="inline mr-2" />
            Playboards ({playboards.length})
          </button>
          <button
            onClick={() => setActiveTab('details')}
            className={`pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'details'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Settings size={16} className="inline mr-2" />
            Details
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'playboards' && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">
              Playboards
            </h2>
            {canAdd && (
              <div className="flex space-x-3">
                <Button variant="secondary" onClick={() => { resetUploadForm(); setUploadModalOpen(true); }}>
                  <Upload size={16} className="mr-2" />
                  Upload JSON
                </Button>
                <Button onClick={handleAddPlayboard}>
                  <Plus size={16} className="mr-2" />
                  Build Playboard
                </Button>
              </div>
            )}
          </div>

          {playboards.length === 0 ? (
            <div className="text-center py-8">
              <Layout className="mx-auto text-gray-400 mb-4" size={48} />
              <p className="text-gray-500">No playboards available for this scenario.</p>
              {canAdd && (
                <div className="flex justify-center space-x-3 mt-4">
                  <Button variant="secondary" onClick={() => { resetUploadForm(); setUploadModalOpen(true); }}>
                    <Upload size={16} className="mr-2" />
                    Upload JSON
                  </Button>
                  <Button onClick={handleAddPlayboard}>
                    <Plus size={16} className="mr-2" />
                    Build Playboard
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {playboards.map((playboard) => (
                <div
                  key={playboard._id || playboard.id}
                  className="flex items-center gap-4 p-4 border rounded-lg hover:border-blue-300 transition-colors"
                >
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Layout className="text-blue-600" size={20} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-800">{playboard.name}</h3>
                    <p className="text-sm text-gray-500">{playboard.data?.key || playboard.key || playboard._id}</p>
                    {playboard.description && (
                      <p className="text-sm text-gray-600 mt-1 line-clamp-1">
                        {playboard.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="primary">
                        {playboard.data?.widgets?.filters?.length || 0} Filters
                      </Badge>
                      <Badge variant="success">
                        {playboard.data?.widgets?.grid?.actions?.rowActions?.events?.length || 0} Actions
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={playboard.status === 'active' ? 'success' : 'danger'}>
                      {playboard.status === 'active' ? 'Active' : 'Inactive'}
                    </Badge>
                    <button
                      onClick={() => handleViewDetails(playboard)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                      title="View JSON"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={() => handleDownloadPlayboard(playboard)}
                      className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded"
                      title="Download JSON"
                    >
                      <Download size={16} />
                    </button>
                    {canEdit && (
                      <button
                        onClick={() => openEditModal(playboard)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                        title="Edit"
                      >
                        <Edit2 size={16} />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => handleDeletePlayboard(playboard)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {activeTab === 'details' && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Scenario Information</h2>
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-sm text-gray-500">Key</dt>
              <dd className="text-gray-800 font-mono">{scenario.key}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Status</dt>
              <dd>
                <Badge variant={scenario.status === 'active' || scenario.status === 'A' ? 'success' : 'default'}>
                  {scenario.status === 'active' || scenario.status === 'A' ? 'Active' : 'Inactive'}
                </Badge>
              </dd>
            </div>
            {scenario.domainKey && (
              <div>
                <dt className="text-sm text-gray-500">Domain Key</dt>
                <dd className="text-gray-800">{scenario.domainKey}</dd>
              </div>
            )}
            {scenario.dataDomain && (
              <div>
                <dt className="text-sm text-gray-500">Data Domain</dt>
                <dd className="text-gray-800">{scenario.dataDomain}</dd>
              </div>
            )}
            {scenario.path && (
              <div>
                <dt className="text-sm text-gray-500">Path</dt>
                <dd className="text-gray-800">{scenario.path}</dd>
              </div>
            )}
            {scenario.order !== undefined && (
              <div>
                <dt className="text-sm text-gray-500">Order</dt>
                <dd className="text-gray-800">{scenario.order}</dd>
              </div>
            )}
            {scenario.icon && (
              <div>
                <dt className="text-sm text-gray-500">Icon</dt>
                <dd className="text-gray-800">{scenario.icon}</dd>
              </div>
            )}
            {scenario.type && (
              <div>
                <dt className="text-sm text-gray-500">Type</dt>
                <dd className="text-gray-800">{scenario.type}</dd>
              </div>
            )}
          </dl>

          {scenario.subDomains && scenario.subDomains.length > 0 && (
            <div className="mt-6">
              <h3 className="text-md font-semibold text-gray-800 mb-3">Sub-Domains</h3>
              <div className="space-y-2">
                {scenario.subDomains.map((subDomain, index) => (
                  <div key={index} className="p-3 bg-gray-50 rounded-lg">
                    <p className="font-medium text-gray-800">{subDomain.name}</p>
                    <p className="text-sm text-gray-500">{subDomain.key}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); resetForm(); }}
        title={editingItem ? 'Edit Playboard' : 'Create Playboard'}
        size="xl"
      >
        <form onSubmit={editingItem ? handleUpdate : handleCreate}>
          {/* Tabs */}
          <div className="border-b border-gray-200 mb-4">
            <nav className="flex space-x-4 overflow-x-auto">
              {formTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFormActiveTab(tab.id)}
                  className={`py-2 px-3 text-sm font-medium border-b-2 whitespace-nowrap ${
                    formActiveTab === tab.id
                      ? 'border-red-500 text-red-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Basic Info Tab */}
          {formActiveTab === 'basic' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Key *"
                  value={formData.key}
                  onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                  placeholder="customers_scenario_playboard_1"
                  required
                />
                <Input
                  label="Name *"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Customer Search Playboard"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Scenario Key"
                  value={formData.scenarioKey || scenarioKey}
                  disabled
                />
                <Select
                  label="Data Domain"
                  value={formData.dataDomain}
                  onChange={(e) => setFormData({ ...formData, dataDomain: e.target.value })}
                  options={[
                    { value: '', label: 'Select Domain' },
                    ...domains.map(d => ({ value: d.key, label: d.name }))
                  ]}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <Input
                  label="Program Key"
                  value={formData.program_key}
                  onChange={(e) => setFormData({ ...formData, program_key: e.target.value })}
                  placeholder="generic_search_logic"
                />
                <Select
                  label="Config Type"
                  value={formData.config_type}
                  onChange={(e) => setFormData({ ...formData, config_type: e.target.value })}
                  options={[
                    { value: 'db', label: 'Database' },
                    { value: 'gcs', label: 'GCS' },
                    { value: 'db or gcs', label: 'DB or GCS' }
                  ]}
                />
                <Input
                  label="Order"
                  type="number"
                  value={formData.order}
                  onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Status"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  options={[
                    { value: 'A', label: 'Active' },
                    { value: 'I', label: 'Inactive' }
                  ]}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Playboard description..."
                />
              </div>

              {/* Addon Configurations */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Addon Configurations</label>
                <div className="flex space-x-2 mb-2">
                  <Input
                    value={addonInput}
                    onChange={(e) => setAddonInput(e.target.value)}
                    placeholder="customer-api_v2"
                  />
                  <Button type="button" onClick={addAddon} variant="secondary">Add</Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.addon_configurations.map((addon, idx) => (
                    <Badge key={idx} variant="primary" className="flex items-center">
                      {addon}
                      <button
                        type="button"
                        onClick={() => removeAddon(idx)}
                        className="ml-1 text-red-500 hover:text-red-700"
                      >x</button>
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Filters Tab */}
          {formActiveTab === 'filters' && (
            <div className="space-y-4">
              {/* Existing Filters */}
              {formData.widgets.filters.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <h4 className="font-medium text-gray-900 mb-2">Configured Filters ({formData.widgets.filters.length})</h4>
                  <div className="space-y-2">
                    {formData.widgets.filters.map((filter, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white p-3 rounded border">
                        <div>
                          <span className="font-medium">{filter.displayName}</span>
                          <span className="text-gray-500 text-sm ml-2">({filter.name})</span>
                          <Badge variant="default" className="ml-2">
                            {filter.attributes?.find(a => a.key === 'type')?.value || 'input'}
                          </Badge>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFilter(idx)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add New Filter */}
              <div className="border rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">Add New Filter</h4>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Name (key)"
                    value={currentFilter.name}
                    onChange={(e) => setCurrentFilter({ ...currentFilter, name: e.target.value, dataKey: e.target.value })}
                    placeholder="query_text"
                  />
                  <Input
                    label="Display Name"
                    value={currentFilter.displayName}
                    onChange={(e) => setCurrentFilter({ ...currentFilter, displayName: e.target.value })}
                    placeholder="Customer#"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4 mt-4">
                  <Select
                    label="Type"
                    value={currentFilter.type}
                    onChange={(e) => setCurrentFilter({ ...currentFilter, type: e.target.value })}
                    options={[
                      { value: 'input', label: 'Text Input' },
                      { value: 'select', label: 'Select Dropdown' },
                      { value: 'date', label: 'Date Picker' },
                      { value: 'checkbox', label: 'Checkbox' },
                      { value: 'radio', label: 'Radio' }
                    ]}
                  />
                  <Input
                    label="Default Value"
                    value={currentFilter.defaultValue}
                    onChange={(e) => setCurrentFilter({ ...currentFilter, defaultValue: e.target.value })}
                  />
                  <Input
                    label="Regex Pattern"
                    value={currentFilter.regex}
                    onChange={(e) => setCurrentFilter({ ...currentFilter, regex: e.target.value })}
                    placeholder="[A-Za-z0-9]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <Input
                    label="Input Hint"
                    value={currentFilter.inputHint}
                    onChange={(e) => setCurrentFilter({ ...currentFilter, inputHint: e.target.value })}
                    placeholder="Enter Customer# or name"
                  />
                  <Input
                    label="Title"
                    value={currentFilter.title}
                    onChange={(e) => setCurrentFilter({ ...currentFilter, title: e.target.value })}
                    placeholder="Enter Customer#'s or name"
                  />
                </div>

                {/* Options for Select type */}
                {currentFilter.type === 'select' && (
                  <div className="mt-4 border-t pt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Options</label>
                    <div className="flex space-x-2 mb-2">
                      <Input
                        placeholder="Value (e.g., 01)"
                        value={optionInput.value}
                        onChange={(e) => setOptionInput({ ...optionInput, value: e.target.value })}
                      />
                      <Input
                        placeholder="Display Name (e.g., 01 - Option)"
                        value={optionInput.name}
                        onChange={(e) => setOptionInput({ ...optionInput, name: e.target.value })}
                      />
                      <Button type="button" onClick={addOption} variant="secondary">Add</Button>
                    </div>
                    {currentFilter.options.length > 0 && (
                      <div className="bg-gray-50 rounded p-2 max-h-32 overflow-y-auto">
                        {currentFilter.options.map((opt, idx) => (
                          <div key={idx} className="flex items-center justify-between py-1">
                            <span className="text-sm">{opt.value} - {opt.name}</span>
                            <button type="button" onClick={() => removeOption(idx)} className="text-red-500">x</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center space-x-4 mt-4">
                  <Toggle
                    enabled={currentFilter.visible}
                    onChange={(val) => setCurrentFilter({ ...currentFilter, visible: val })}
                    label="Visible"
                  />
                </div>

                <Button
                  type="button"
                  onClick={addFilter}
                  variant="secondary"
                  className="mt-4"
                  disabled={!currentFilter.name || !currentFilter.displayName}
                >
                  Add Filter
                </Button>
              </div>
            </div>
          )}

          {/* Row Actions Tab */}
          {formActiveTab === 'actions' && (
            <div className="space-y-4">
              {/* Existing Actions */}
              {formData.widgets.grid.actions.rowActions.events.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <h4 className="font-medium text-gray-900 mb-2">Configured Row Actions ({formData.widgets.grid.actions.rowActions.events.length})</h4>
                  <div className="space-y-2">
                    {formData.widgets.grid.actions.rowActions.events.map((action, idx) => (
                      <div key={idx} className="bg-white p-3 rounded border">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-medium">{action.name}</span>
                            <span className="text-gray-500 text-sm ml-2">-&gt; {action.path}</span>
                            <Badge variant={action.status === 'A' ? 'success' : 'danger'} className="ml-2">
                              {action.status === 'A' ? 'Active' : 'Inactive'}
                            </Badge>
                            {action.filters && action.filters.length > 0 && (
                              <Badge variant="primary" className="ml-2">{action.filters.length} filters</Badge>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeRowAction(idx)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <X size={16} />
                          </button>
                        </div>
                        {action.filters && action.filters.length > 0 && (
                          <div className="mt-2 pt-2 border-t text-xs text-gray-500">
                            {action.filters.map((f, i) => (
                              <span key={i} className="mr-3">
                                {f.inputKey} -&gt; {f.dataKey}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add New Action */}
              <div className="border rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">Add New Row Action</h4>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Key"
                    value={currentRowAction.key}
                    onChange={(e) => setCurrentRowAction({ ...currentRowAction, key: e.target.value })}
                    placeholder="orders_scenario_6"
                  />
                  <Input
                    label="Button Name"
                    value={currentRowAction.name}
                    onChange={(e) => setCurrentRowAction({ ...currentRowAction, name: e.target.value })}
                    placeholder="Orders"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <Input
                    label="Path"
                    value={currentRowAction.path}
                    onChange={(e) => setCurrentRowAction({ ...currentRowAction, path: e.target.value })}
                    placeholder="/report/orders_scenario_6"
                  />
                  <Select
                    label="Data Domain"
                    value={currentRowAction.dataDomain}
                    onChange={(e) => setCurrentRowAction({ ...currentRowAction, dataDomain: e.target.value })}
                    options={[
                      { value: '', label: 'Select Domain' },
                      ...domains.map(d => ({ value: d.key, label: d.name }))
                    ]}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <Select
                    label="Status"
                    value={currentRowAction.status}
                    onChange={(e) => setCurrentRowAction({ ...currentRowAction, status: e.target.value })}
                    options={[
                      { value: 'A', label: 'Active' },
                      { value: 'I', label: 'Inactive' }
                    ]}
                  />
                </div>

                {/* Action Filters */}
                <div className="mt-4 border-t pt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Filters (maps row data to navigation params)
                  </label>
                  <div className="flex space-x-2 mb-2">
                    <Input
                      placeholder="inputKey (e.g., query_customer)"
                      value={actionFilterInput.inputKey}
                      onChange={(e) => setActionFilterInput({ ...actionFilterInput, inputKey: e.target.value })}
                    />
                    <Input
                      placeholder="dataKey (e.g., customer)"
                      value={actionFilterInput.dataKey}
                      onChange={(e) => setActionFilterInput({ ...actionFilterInput, dataKey: e.target.value })}
                    />
                    <Button type="button" onClick={addActionFilter} variant="secondary">Add</Button>
                  </div>
                  {currentRowAction.filters.length > 0 && (
                    <div className="bg-gray-50 rounded p-2 space-y-1">
                      {currentRowAction.filters.map((filter, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-white p-2 rounded border text-sm">
                          <span>
                            <span className="text-gray-500">inputKey:</span> <span className="font-medium">{filter.inputKey}</span>
                            <span className="mx-2">-&gt;</span>
                            <span className="text-gray-500">dataKey:</span> <span className="font-medium">{filter.dataKey}</span>
                          </span>
                          <button type="button" onClick={() => removeActionFilter(idx)} className="text-red-500 hover:text-red-700">x</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Button
                  type="button"
                  onClick={addRowAction}
                  variant="secondary"
                  className="mt-4"
                  disabled={!currentRowAction.key || !currentRowAction.name}
                >
                  Add Row Action
                </Button>
              </div>
            </div>
          )}

          {/* Grid Settings Tab */}
          {formActiveTab === 'grid' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Row Actions Render As"
                  value={formData.widgets.grid.actions.rowActions.renderAs}
                  onChange={(e) => setFormData({
                    ...formData,
                    widgets: {
                      ...formData.widgets,
                      grid: {
                        ...formData.widgets.grid,
                        actions: {
                          ...formData.widgets.grid.actions,
                          rowActions: {
                            ...formData.widgets.grid.actions.rowActions,
                            renderAs: e.target.value
                          }
                        }
                      }
                    }
                  })}
                  options={[
                    { value: 'button', label: 'Buttons' },
                    { value: 'dropdown', label: 'Dropdown Menu' },
                    { value: 'icons', label: 'Icon Buttons' }
                  ]}
                />
                <Input
                  label="Default Page Size"
                  type="number"
                  value={formData.widgets.grid.layout.defaultSize}
                  onChange={(e) => setFormData({
                    ...formData,
                    widgets: {
                      ...formData.widgets,
                      grid: {
                        ...formData.widgets.grid,
                        layout: {
                          ...formData.widgets.grid.layout,
                          defaultSize: parseInt(e.target.value) || 25
                        }
                      }
                    }
                  })}
                />
              </div>

              <Toggle
                enabled={formData.widgets?.grid?.layout?.ispaginated === true}
                onChange={(val) => setFormData({
                  ...formData,
                  widgets: {
                    ...formData.widgets,
                    grid: {
                      ...formData.widgets.grid,
                      layout: {
                        ...formData.widgets.grid.layout,
                        ispaginated: val
                      }
                    }
                  }
                })}
                label="Enable Pagination"
              />
            </div>
          )}

          {/* Description Tab */}
          {formActiveTab === 'description' && (
            <div className="space-y-4">
              {/* Existing Descriptions */}
              {formData.scenarioDescription.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <h4 className="font-medium text-gray-900 mb-2">Scenario Description Items</h4>
                  <div className="space-y-2">
                    {formData.scenarioDescription.map((desc, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white p-3 rounded border">
                        <div>
                          <Badge variant="default" className="mr-2">{desc.type}</Badge>
                          <span className="text-gray-700">{desc.text || '(empty)'}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeDescription(idx)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add New Description */}
              <div className="border rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">Add Description Element</h4>
                <div className="grid grid-cols-4 gap-4">
                  <Select
                    label="Type"
                    value={currentDescription.type}
                    onChange={(e) => setCurrentDescription({ ...currentDescription, type: e.target.value })}
                    options={[
                      { value: 'h3', label: 'Heading 3' },
                      { value: 'h4', label: 'Heading 4' },
                      { value: 'p', label: 'Paragraph' },
                      { value: 'ol', label: 'Ordered List' },
                      { value: 'ul', label: 'Unordered List' },
                      { value: 'br', label: 'Line Break' },
                      { value: 'code', label: 'Code Block' }
                    ]}
                  />
                  <div className="col-span-3">
                    <Input
                      label="Text"
                      value={currentDescription.text}
                      onChange={(e) => setCurrentDescription({ ...currentDescription, text: e.target.value })}
                      placeholder="Description text..."
                    />
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={addDescription}
                  variant="secondary"
                  className="mt-4"
                >
                  Add Description
                </Button>
              </div>
            </div>
          )}

          {/* JSON Preview Tab */}
          {formActiveTab === 'json' && (
            <div>
              <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-auto max-h-96 text-xs">
                {JSON.stringify({
                  key: formData.key,
                  dataDomain: formData.dataDomain,
                  scenarioKey: formData.scenarioKey || scenarioKey,
                  order: formData.order,
                  status: formData.status,
                  program_key: formData.program_key,
                  config_type: formData.config_type,
                  addon_configurations: formData.addon_configurations,
                  widgets: formData.widgets,
                  scenarioDescription: formData.scenarioDescription
                }, null, 2)}
              </pre>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex justify-end space-x-3 pt-6 border-t mt-6">
            <Button type="button" variant="secondary" onClick={() => { setModalOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : (editingItem ? 'Update Playboard' : 'Create Playboard')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Upload JSON Modal */}
      <Modal
        isOpen={uploadModalOpen}
        onClose={() => { setUploadModalOpen(false); resetUploadForm(); }}
        title="Upload Playboard JSON"
        size="xl"
      >
        <form onSubmit={handleFileUpload} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">JSON File *</label>
            <FileUpload
              accept=".json"
              label="Select playboard JSON file"
              onFileSelect={handleFileSelect}
            />
            {uploadFile && (
              <p className="mt-2 text-sm text-green-600">Selected: {uploadFile.name}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Name (optional, auto-detected from JSON)"
              value={uploadName}
              onChange={(e) => setUploadName(e.target.value)}
              placeholder="Playboard name"
            />
            <Input
              label="Scenario Key"
              value={scenarioKey}
              disabled
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              rows={2}
              value={uploadDescription}
              onChange={(e) => setUploadDescription(e.target.value)}
              placeholder="Playboard description..."
            />
          </div>

          {/* JSON Preview */}
          {jsonPreview && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">JSON Preview</label>
              <div className="bg-gray-50 rounded-lg p-4 border">
                <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                  <div>
                    <span className="text-gray-500">Key:</span>{' '}
                    <span className="font-medium">{jsonPreview.key || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Scenario:</span>{' '}
                    <span className="font-medium">{jsonPreview.scenarioKey || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Data Domain:</span>{' '}
                    <span className="font-medium">{jsonPreview.dataDomain || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Status:</span>{' '}
                    <Badge variant={jsonPreview.status === 'A' ? 'success' : 'danger'}>
                      {jsonPreview.status === 'A' ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-gray-500">Filters:</span>{' '}
                    <Badge variant="primary">{jsonPreview.widgets?.filters?.length || 0}</Badge>
                  </div>
                  <div>
                    <span className="text-gray-500">Row Actions:</span>{' '}
                    <Badge variant="success">{jsonPreview.widgets?.grid?.actions?.rowActions?.events?.length || 0}</Badge>
                  </div>
                </div>
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm text-red-600 hover:text-red-700">
                    View Full JSON
                  </summary>
                  <pre className="mt-2 bg-gray-900 text-green-400 p-3 rounded text-xs overflow-auto max-h-48">
                    {JSON.stringify(jsonPreview, null, 2)}
                  </pre>
                </details>
              </div>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
            <p className="font-medium text-blue-800 mb-2">Expected JSON Structure:</p>
            <pre className="text-blue-700 text-xs overflow-auto">
{`{
  "key": "playboard_key",
  "dataDomain": "customers",
  "scenarioKey": "scenario_key",
  "status": "A",
  "widgets": {
    "filters": [...],
    "grid": { "actions": {...}, "layout": {...} },
    "pagination": [...]
  },
  "scenarioDescription": [...]
}`}
            </pre>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button type="button" variant="secondary" onClick={() => { setUploadModalOpen(false); resetUploadForm(); }}>
              Cancel
            </Button>
            <Button type="submit" disabled={!uploadFile}>
              Upload Playboard
            </Button>
          </div>
        </form>
      </Modal>

      {/* Detail View Modal */}
      <Modal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title="Playboard Details"
        size="xl"
      >
        {selectedPlayboard && (
          <div>
            <div className="mb-4">
              <h3 className="font-medium text-gray-900">{selectedPlayboard.name}</h3>
              <p className="text-gray-500 text-sm">{selectedPlayboard.description}</p>
            </div>
            <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-auto max-h-[60vh] text-xs">
              {JSON.stringify(selectedPlayboard.data || selectedPlayboard, null, 2)}
            </pre>
            <div className="flex justify-end mt-4">
              <Button variant="secondary" onClick={() => setDetailModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default ScenarioDetailPage;
