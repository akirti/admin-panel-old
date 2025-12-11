import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Input, Table, Modal, Badge, SearchInput, Select, Toggle, FileUpload, Pagination } from '../../components/shared';
import { playboardsAPI, scenariosAPI, domainsAPI } from '../../services/api';
import toast from 'react-hot-toast';

const PlayboardsManagement = () => {
  const [playboards, setPlayboards] = useState([]);
  const [scenarios, setScenarios] = useState([]);
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [selectedPlayboard, setSelectedPlayboard] = useState(null);
  const [activeTab, setActiveTab] = useState('basic');
  const [pagination, setPagination] = useState({ page: 0, limit: 25, total: 0, pages: 0 });

  // Upload state
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadScenarioKey, setUploadScenarioKey] = useState('');
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
      pagination: [{
        name: 'pagination_limit',
        dataKey: 'pagination_limit',
        displayName: 'Pagination',
        index: 0,
        visible: true,
        attributes: [ 
          {key: 'type', value: 'dropdown'},
          {key: 'options', value: '25,50,75,100'},
          {key: 'defaultValue', value: '25'},
          {key: 'width', value: '10em'}
        ]
      }]
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

  const fetchData = useCallback(async () => {
    try {
      const [playboardsRes, scenariosRes, domainsRes] = await Promise.all([
        playboardsAPI.list({ search: search || undefined, page: pagination.page, limit: pagination.limit }),
        scenariosAPI.list({ limit: 100 }),
        domainsAPI.list({ limit: 100 })
      ]);
      setPlayboards(playboardsRes.data.data || playboardsRes.data);
      setPagination(prev => ({ ...prev, ...(playboardsRes.data.pagination || {}) }));
      setScenarios(scenariosRes.data.data || scenariosRes.data);
      setDomains(domainsRes.data.data || domainsRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [search, pagination.page, pagination.limit]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const resetForm = () => {
    setFormData({
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
        pagination: [
          {
              name: 'pagination_limit',
              dataKey: 'pagination_limit',
              displayName: 'Pagination',
              index: 0,
              visible: true,
              attributes: [ 
                {key: 'type', value: 'dropdown'},
                {key: 'options', value: '25,50,75,100'},
                {key: 'defaultValue', value: '25'},
                {key: 'width', value: '10em'}
              ]
          }
        ]
      },
      scenarioDescription: []
    });
    setEditingItem(null);
    setActiveTab('basic');
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: formData.name,
        description: formData.description,
        scenarioKey: formData.scenarioKey,
        status: formData.status === 'A' ? 'active' : 'inactive',
        key: formData.key,
        dataDomain: formData.dataDomain,
        scenarioKey: formData.scenarioKey,
        scenerioKey: formData.scenarioKey,
        order: formData.order,
        status: formData.status,
        program_key: formData.program_key,
        config_type: formData.config_type,
        addon_configurations: formData.addon_configurations,
        widgets: formData.widgets,
        scenarioDescription: formData.scenarioDescription
      };
      await playboardsAPI.create(payload);
      toast.success('Playboard created successfully');
      setModalOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create playboard');
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: formData.name,
        description: formData.description,
        scenarioKey: formData.scenarioKey,
        status: formData.status === 'A' ? 'active' : 'inactive',
        key: formData.key,
        dataDomain: formData.dataDomain,
        scenarioKey: formData.scenarioKey,
        scenerioKey: formData.scenarioKey,
        order: formData.order,
        status: formData.status,
        program_key: formData.program_key,
        config_type: formData.config_type,
        addon_configurations: formData.addon_configurations,
        widgets: formData.widgets,
        scenarioDescription: formData.scenarioDescription
        
      };
      await playboardsAPI.update(editingItem.id || editingItem._id, payload);
      toast.success('Playboard updated successfully');
      setModalOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update playboard');
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm('Are you sure you want to delete this playboard?')) return;
    try {
      await playboardsAPI.delete(item.id || item._id);
      toast.success('Playboard deleted successfully');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete playboard');
    }
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    const data = item.data || {};

    // Deep merge widgets to ensure all nested properties exist
    const defaultWidgets = {
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
    };

    // Check both item.widgets (direct storage) and data.widgets (nested in data object)
    const sourceWidgets = item.widgets || data.widgets;

    const widgets = sourceWidgets ? {
      filters: sourceWidgets.filters || [],
      grid: {
        actions: {
          rowActions: {
            renderAs: sourceWidgets.grid?.actions?.rowActions?.renderAs || 'button',
            attributes: sourceWidgets.grid?.actions?.rowActions?.attributes || [],
            events: sourceWidgets.grid?.actions?.rowActions?.events || []
          },
          headerActions: sourceWidgets.grid?.actions?.headerActions || {}
        },
        layout: {
          colums: sourceWidgets.grid?.layout?.colums || [],
          headers: sourceWidgets.grid?.layout?.headers || [],
          footer: sourceWidgets.grid?.layout?.footer || [],
          ispaginated: sourceWidgets.grid?.layout?.ispaginated !== undefined
            ? sourceWidgets.grid.layout.ispaginated
            : true,
          defaultSize: sourceWidgets.grid?.layout?.defaultSize || 25
        }
      },
      pagination: sourceWidgets.pagination || []
    } : defaultWidgets;

    setFormData({
      key: item.key || data.key || item.name || '',
      name: item.name || '',
      description: item.description || '',
      scenarioKey: item.scenarioKey || data.scenarioKey || '',
      dataDomain: item.dataDomain || data.dataDomain || '',
      status: data.status || (item.status === 'active' ? 'A' : 'I'),
      order: item.order || data.order || 0,
      program_key: data.program_key || '',
      config_type: data.config_type || 'db',
      addon_configurations: data.addon_configurations || [],
      widgets: widgets,
      scenarioDescription: data.scenarioDescription || []
    });
    setModalOpen(true);
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
        // Auto-fill fields from JSON
        if (json.scenarioKey) setUploadScenarioKey(json.scenarioKey);
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
        scenario_key: uploadScenarioKey || undefined,
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
    setUploadScenarioKey('');
    setUploadName('');
    setUploadDescription('');
    setJsonPreview(null);
  };

  const handleDownload = async (item) => {
    try {
      const response = await playboardsAPI.download(item.id || item._id);
      const dataStr = JSON.stringify(response.data, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${item.data?.key || item.name || 'playboard'}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Download started');
    } catch (error) {
      toast.error('Failed to download playboard');
    }
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
      type: currentFilter.type,
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
    // Ensure the nested structure exists
    const currentEvents = formData.widgets?.grid?.actions?.rowActions?.events || [];
    const currentRowActions = formData.widgets?.grid?.actions?.rowActions || { renderAs: 'button', attributes: [], events: [] };
    const currentActions = formData.widgets?.grid?.actions || { rowActions: currentRowActions, headerActions: {} };
    const currentGrid = formData.widgets?.grid || { actions: currentActions, layout: { colums: [], headers: [], footer: [], ispaginated: true, defaultSize: 25 } };

    const newAction = {
      key: currentRowAction.key,
      name: currentRowAction.name,
      path: currentRowAction.path,
      dataDomain: currentRowAction.dataDomain,
      status: currentRowAction.status,
      order: currentEvents.length,
      filters: currentRowAction.filters
    };

    setFormData({
      ...formData,
      widgets: {
        ...formData.widgets,
        grid: {
          ...currentGrid,
          actions: {
            ...currentActions,
            rowActions: {
              ...currentRowActions,
              events: [...currentEvents, newAction]
            }
          }
        }
      }
    });

    setCurrentRowAction({
      key: '',
      name: '',
      path: '',
      dataDomain: '',
      status: 'A',
      order: 0,
      filters: []
    });
  };

  const removeRowAction = (index) => {
    const currentEvents = formData.widgets?.grid?.actions?.rowActions?.events || [];
    const currentRowActions = formData.widgets?.grid?.actions?.rowActions || { renderAs: 'button', attributes: [], events: [] };
    const currentActions = formData.widgets?.grid?.actions || { rowActions: currentRowActions, headerActions: {} };
    const currentGrid = formData.widgets?.grid || { actions: currentActions, layout: { colums: [], headers: [], footer: [], ispaginated: true, defaultSize: 25 } };

    const newEvents = currentEvents.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      widgets: {
        ...formData.widgets,
        grid: {
          ...currentGrid,
          actions: {
            ...currentActions,
            rowActions: {
              ...currentRowActions,
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

    setCurrentDescription({
      index: 0,
      type: 'h3',
      text: '',
      nodes: []
    });
  };

  const removeDescription = (index) => {
    const newDescs = formData.scenarioDescription.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      scenarioDescription: newDescs.map((d, i) => ({ ...d, index: i }))
    });
  };

  // Options management for select filters
  const [optionInput, setOptionInput] = useState({ value: '', name: '' });

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
  const [addonInput, setAddonInput] = useState('');

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

  const columns = [
    { key: 'name', title: 'Name' },
    {
      key: 'data',
      title: 'Key',
      render: (val) => val?.key || '-'
    },
    { key: 'scenarioKey', title: 'Scenario' },
    {
      key: 'data',
      title: 'Data Domain',
      render: (val) => val?.dataDomain || '-'
    },
    {
      key: 'data',
      title: 'Filters',
      render: (val) => (
        <Badge variant="primary">{val?.widgets?.filters?.length || 0}</Badge>
      )
    },
    {
      key: 'data',
      title: 'Actions',
      render: (val) => (
        <Badge variant="success">{val?.widgets?.grid?.actions?.rowActions?.events?.length || 0}</Badge>
      )
    },
    {
      key: 'status',
      title: 'Status',
      render: (val) => (
        <Badge variant={val === 'active' ? 'success' : 'danger'}>
          {val === 'active' ? 'Active' : 'Inactive'}
        </Badge>
      )
    },
    {
      key: 'actions',
      title: 'Actions',
      render: (_, item) => (
        <div className="flex items-center space-x-2">
          <button
            onClick={(e) => { e.stopPropagation(); handleViewDetails(item); }}
            className="p-1 text-gray-500 hover:text-blue-600"
            title="View JSON"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleDownload(item); }}
            className="p-1 text-gray-500 hover:text-green-600"
            title="Download JSON"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); openEditModal(item); }}
            className="p-1 text-gray-500 hover:text-red-600"
            title="Edit"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleDelete(item); }}
            className="p-1 text-red-500 hover:text-red-600"
            title="Delete"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      )
    }
  ];

  const tabs = [
    { id: 'basic', label: 'Basic Info' },
    { id: 'filters', label: 'Filters' },
    { id: 'actions', label: 'Row Actions' },
    { id: 'grid', label: 'Grid Settings' },
    { id: 'description', label: 'Description' },
    { id: 'json', label: 'JSON Preview' }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Playboards</h1>
          <p className="text-gray-500 mt-1">Manage playboard configurations with widgets, filters, and actions</p>
        </div>
        <div className="flex space-x-3">
          <Button variant="secondary" onClick={() => { resetUploadForm(); setUploadModalOpen(true); }}>
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Upload JSON
          </Button>
          <Button onClick={() => { resetForm(); setModalOpen(true); }}>
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Build Playboard
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card className="p-4">
        <SearchInput
          value={search}
          onChange={(val) => { setSearch(val); setPagination(prev => ({ ...prev, page: 0 })); }}
          placeholder="Search playboards..."
        />
      </Card>

      {/* Table */}
      <Card>
        <Table columns={columns} data={playboards} loading={loading} />
        {pagination.pages > 1 && (
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.pages}
            total={pagination.total}
            limit={pagination.limit}
            onPageChange={handlePageChange}
          />
        )}
      </Card>

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
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-2 px-3 text-sm font-medium border-b-2 whitespace-nowrap ${
                    activeTab === tab.id
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
          {activeTab === 'basic' && (
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
                <Select
                  label="Scenario *"
                  value={formData.scenarioKey}
                  onChange={(e) => setFormData({ ...formData, scenarioKey: e.target.value })}
                  options={[
                    { value: '', label: 'Select Scenario' },
                    ...scenarios.map(s => ({ value: s.key, label: s.name }))
                  ]}
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
                    { value: 'db+gcs', label: 'DB+GCS' }
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
          {activeTab === 'filters' && (
            <div className="space-y-4">
              {/* Existing Filters */}
              {formData.widgets.filters.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <h4 className="font-medium text-gray-900 mb-2">Configured Filters ({formData.widgets.filters.length})</h4>
                  <div className="space-y-2">
                    {formData.widgets.filters.map((filter, idx) => {
                      // Handle both array and object formats for attributes
                      const getFilterType = () => {
                        if (filter.type) return filter.type;
                        if (Array.isArray(filter.attributes)) {
                          return filter.attributes.find(a => a.key === 'type')?.value || 'input';
                        }
                        if (filter.attributes && typeof filter.attributes === 'object') {
                          return filter.attributes.value || filter.attributes.name || 'input';
                        }
                        return 'input';
                      };
                      return (
                      <div key={idx} className="flex items-center justify-between bg-white p-3 rounded border">
                        <div>
                          <span className="font-medium">{filter.displayName}</span>
                          <span className="text-gray-500 text-sm ml-2">({filter.name})</span>
                          <Badge variant="default" className="ml-2">
                            {getFilterType()}
                          </Badge>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFilter(idx)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    );
                    })}
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
          {activeTab === 'actions' && (
            <div className="space-y-4">
              {/* Existing Actions */}
              {(formData.widgets?.grid?.actions?.rowActions?.events?.length || 0) > 0 && (
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <h4 className="font-medium text-gray-900 mb-2">Configured Row Actions ({formData.widgets?.grid?.actions?.rowActions?.events?.length || 0})</h4>
                  <div className="space-y-2">
                    {(formData.widgets?.grid?.actions?.rowActions?.events || []).map((action, idx) => (
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
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
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
          {activeTab === 'grid' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Row Actions Render As"
                  value={formData.widgets?.grid?.actions?.rowActions?.renderAs || 'button'}
                  onChange={(e) => {
                    const currentRowActions = formData.widgets?.grid?.actions?.rowActions || { renderAs: 'button', attributes: [], events: [] };
                    const currentActions = formData.widgets?.grid?.actions || { rowActions: currentRowActions, headerActions: {} };
                    const currentGrid = formData.widgets?.grid || { actions: currentActions, layout: { colums: [], headers: [], footer: [], ispaginated: true, defaultSize: 25 } };
                    setFormData({
                      ...formData,
                      widgets: {
                        ...formData.widgets,
                        grid: {
                          ...currentGrid,
                          actions: {
                            ...currentActions,
                            rowActions: {
                              ...currentRowActions,
                              renderAs: e.target.value
                            }
                          }
                        }
                      }
                    });
                  }}
                  options={[
                    { value: 'button', label: 'Buttons' },
                    { value: 'dropdown', label: 'Dropdown Menu' },
                    { value: 'icons', label: 'Icon Buttons' }
                  ]}
                />
                <Input
                  label="Default Page Size"
                  type="number"
                  value={formData.widgets?.grid?.layout?.defaultSize || 25}
                  onChange={(e) => {
                    const currentLayout = formData.widgets?.grid?.layout || { colums: [], headers: [], footer: [], ispaginated: true, defaultSize: 25 };
                    const currentGrid = formData.widgets?.grid || { actions: { rowActions: { renderAs: 'button', attributes: [], events: [] }, headerActions: {} }, layout: currentLayout };
                    setFormData({
                      ...formData,
                      widgets: {
                        ...formData.widgets,
                        grid: {
                          ...currentGrid,
                          layout: {
                            ...currentLayout,
                            defaultSize: parseInt(e.target.value) || 25
                          }
                        }
                      }
                    });
                  }}
                />
              </div>

              <Toggle
                enabled={formData.widgets?.grid?.layout?.ispaginated === true}
                onChange={(val) => {
                  const currentLayout = formData.widgets?.grid?.layout || { colums: [], headers: [], footer: [], ispaginated: true, defaultSize: 25 };
                  const currentGrid = formData.widgets?.grid || { actions: { rowActions: { renderAs: 'button', attributes: [], events: [] }, headerActions: {} }, layout: currentLayout };
                  setFormData({
                    ...formData,
                    widgets: {
                      ...formData.widgets,
                      grid: {
                        ...currentGrid,
                        layout: {
                          ...currentLayout,
                          ispaginated: val
                        }
                      }
                    }
                  });
                }}
                label="Enable Pagination"
              />
            </div>
          )}

          {/* Description Tab */}
          {activeTab === 'description' && (
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
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
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
          {activeTab === 'json' && (
            <div>
              <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-auto max-h-96 text-xs">
                {JSON.stringify({
                  key: formData.key,
                  dataDomain: formData.dataDomain,
                  scenarioKey: formData.scenarioKey,
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
            <Button type="submit">
              {editingItem ? 'Update Playboard' : 'Create Playboard'}
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
            <Select
              label="Scenario (optional, auto-detected from JSON)"
              value={uploadScenarioKey}
              onChange={(e) => setUploadScenarioKey(e.target.value)}
              options={[
                { value: '', label: 'Auto-detect from JSON' },
                ...scenarios.map(s => ({ value: s.key, label: s.name }))
              ]}
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
};

export default PlayboardsManagement;
