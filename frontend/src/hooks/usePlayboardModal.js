import { useState } from 'react';
import toast from 'react-hot-toast';
import { playboardsAPI } from '../services/api';

function parseWidgetsFromData(data) {
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

  if (!data.widgets) return defaultWidgets;

  const w = data.widgets;
  return {
    filters: w.filters || [],
    grid: {
      actions: {
        rowActions: {
          renderAs: w.grid?.actions?.rowActions?.renderAs || 'button',
          attributes: w.grid?.actions?.rowActions?.attributes || [],
          events: w.grid?.actions?.rowActions?.events || []
        },
        headerActions: w.grid?.actions?.headerActions || {}
      },
      layout: {
        colums: w.grid?.layout?.colums || [],
        headers: w.grid?.layout?.headers || [],
        footer: w.grid?.layout?.footer || [],
        ispaginated: w.grid?.layout?.ispaginated !== undefined ? w.grid.layout.ispaginated : true,
        defaultSize: w.grid?.layout?.defaultSize || 25
      }
    },
    pagination: w.pagination || []
  };
}

function buildFormDataFromItem(item, scenarioKey) {
  const data = item.data || {};
  return {
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
    widgets: parseWidgetsFromData(data),
    scenarioDescription: data.scenarioDescription || []
  };
}

function buildPayload(formData, scenarioKey) {
  return {
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
}

function triggerPlayboardDownload(playboard, responseData) {
  const blob = new Blob([JSON.stringify(responseData, null, 2)], { type: 'application/json' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${playboard.data?.key || playboard.key || playboard.name}.json`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

function getInitialFormData(scenarioKey) {
  return {
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
  };
}

const INITIAL_FILTER = {
  name: '', dataKey: '', displayName: '', index: 0, visible: true,
  status: 'Y', inputHint: '', title: '', type: 'input', defaultValue: '', regex: '', options: []
};

const INITIAL_ROW_ACTION = { key: '', name: '', path: '', dataDomain: '', status: 'A', order: 0, filters: [] };

const INITIAL_DESCRIPTION = { index: 0, type: 'h3', text: '', nodes: [] };

const usePlayboardModal = (scenarioKey, fetchData) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState(getInitialFormData(scenarioKey));
  const [saving, setSaving] = useState(false);
  const [formActiveTab, setFormActiveTab] = useState('basic');
  const [selectedPlayboard, setSelectedPlayboard] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  const resetForm = () => {
    setFormData(getInitialFormData(scenarioKey));
    setEditingItem(null);
    setFormActiveTab('basic');
  };

  const handleAddPlayboard = () => {
    resetForm();
    setFormData(prev => ({ ...prev, scenarioKey: scenarioKey }));
    setModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setFormData(buildFormDataFromItem(item, scenarioKey));
    setModalOpen(true);
  };

  const handleSavePlayboard = async (apiCall, successMsg, errorMsg) => {
    setSaving(true);
    try {
      const payload = buildPayload(formData, scenarioKey);
      await apiCall(payload);
      toast.success(successMsg);
      setModalOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || errorMsg);
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = (e) => {
    e.preventDefault();
    handleSavePlayboard(
      (payload) => playboardsAPI.create(payload),
      'Playboard created successfully',
      'Failed to create playboard'
    );
  };

  const handleUpdate = (e) => {
    e.preventDefault();
    handleSavePlayboard(
      (payload) => playboardsAPI.update(editingItem.id || editingItem._id, payload),
      'Playboard updated successfully',
      'Failed to update playboard'
    );
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
      triggerPlayboardDownload(playboard, response.data);
      toast.success('Playboard downloaded');
    } catch {
      toast.error('Failed to download playboard');
    }
  };

  const handleViewDetails = (item) => {
    setSelectedPlayboard(item);
    setDetailModalOpen(true);
  };

  // Grid settings helpers
  const updateRowActionsRenderAs = (value) => {
    setFormData(prev => ({
      ...prev,
      widgets: {
        ...prev.widgets,
        grid: {
          ...prev.widgets.grid,
          actions: {
            ...prev.widgets.grid.actions,
            rowActions: { ...prev.widgets.grid.actions.rowActions, renderAs: value }
          }
        }
      }
    }));
  };

  const updateGridLayout = (key, value) => {
    setFormData(prev => ({
      ...prev,
      widgets: {
        ...prev.widgets,
        grid: {
          ...prev.widgets.grid,
          layout: { ...prev.widgets.grid.layout, [key]: value }
        }
      }
    }));
  };

  return {
    modalOpen, setModalOpen,
    editingItem,
    formData, setFormData,
    saving,
    formActiveTab, setFormActiveTab,
    selectedPlayboard, detailModalOpen, setDetailModalOpen,
    resetForm,
    handleAddPlayboard, openEditModal,
    handleCreate, handleUpdate,
    handleDeletePlayboard, handleDownloadPlayboard,
    handleViewDetails,
    updateRowActionsRenderAs, updateGridLayout
  };
};

// Export the constants so they can be used by the builder hooks
export { INITIAL_FILTER, INITIAL_ROW_ACTION, INITIAL_DESCRIPTION };
export default usePlayboardModal;
