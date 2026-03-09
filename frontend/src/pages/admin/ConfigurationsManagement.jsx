import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Input, Table, Modal, Badge, SearchInput, Select, FileUpload, Pagination } from '../../components/shared';
import { configurationsAPI } from '../../services/api';
import { Eye, Pencil, Download, Clock, Trash2, Upload, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

/* ─── helpers (outside component) ─── */

const TYPE_BADGE_VARIANTS = {
  'process-config': 'primary',
  'lookup-data': 'success',
  'gcs-data': 'warning',
  'snapshot-data': 'default',
};

function getTypeBadgeVariant(type) {
  return TYPE_BADGE_VARIANTS[type] || 'default';
}

function parseJsonSafe(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function applyParsedJsonToFormData(formData, parsed, type) {
  if (type === 'process-config') {
    return { ...formData, queries: parsed.queries || {}, logics: parsed.logics || {}, operations: parsed.operations || {} };
  }
  if (type === 'lookup-data') {
    return { ...formData, lookups: parsed };
  }
  if (type === 'snapshot-data') {
    return { ...formData, data: parsed };
  }
  return formData;
}

function getJsonInputForType(item) {
  if (item.type === 'process-config') {
    return JSON.stringify({ queries: item.queries || {}, logics: item.logics || {}, operations: item.operations || {} }, null, 2);
  }
  if (item.type === 'lookup-data') {
    return JSON.stringify(item.lookups || {}, null, 2);
  }
  if (item.type === 'snapshot-data') {
    return JSON.stringify(item.data || {}, null, 2);
  }
  return '';
}

function getDetailData(config) {
  if (config.type === 'process-config') {
    return { queries: config.queries, logics: config.logics, operations: config.operations };
  }
  if (config.type === 'lookup-data') {
    return config.lookups;
  }
  return config.data;
}

function getJsonLabel(type) {
  if (type === 'process-config') return 'Configuration JSON (queries, logics, operations)';
  if (type === 'lookup-data') return 'Lookups JSON';
  if (type === 'snapshot-data') return 'Data JSON';
  return '';
}

function getJsonPlaceholder(type) {
  if (type === 'process-config') return '{\n  "queries": {},\n  "logics": {},\n  "operations": {}\n}';
  return '{}';
}

/* ─── ConfigTable columns builder ─── */
function buildColumns({ configTypes, handleViewDetails, openEditModal, handleDownload, handleViewVersions, handleDelete }) {
  const getTypeLabel = (type) => {
    const typeObj = configTypes.find(t => t.value === type);
    return typeObj?.label || type;
  };

  return [
    { key: 'config_id', title: 'Config ID' },
    { key: 'key', title: 'Key' },
    {
      key: 'type',
      title: 'Type',
      render: (val) => <Badge variant={getTypeBadgeVariant(val)}>{getTypeLabel(val)}</Badge>,
    },
    {
      key: 'gcs',
      title: 'File Info',
      render: (val, row) => {
        if (row.type === 'gcs-data' && val) {
          return (
            <div className="text-xs">
              <div>{val.file_name}</div>
              <div className="text-content-muted">v{val.current_version} - {(val.size / 1024).toFixed(1)}KB</div>
            </div>
          );
        }
        return '-';
      },
    },
    {
      key: 'row_update_stp',
      title: 'Last Updated',
      render: (val) => val ? new Date(val).toLocaleString() : '-',
    },
    {
      key: 'actions',
      title: 'Actions',
      render: (_, item) => (
        <div className="flex items-center space-x-2">
          <button onClick={(e) => { e.stopPropagation(); handleViewDetails(item); }} className="p-1 text-content-muted hover:text-primary-600" title="View Details"><Eye size={16} /></button>
          {item.type !== 'gcs-data' && (
            <button onClick={(e) => { e.stopPropagation(); openEditModal(item); }} className="p-1 text-content-muted hover:text-primary-600" title="Edit"><Pencil size={16} /></button>
          )}
          <button onClick={(e) => { e.stopPropagation(); handleDownload(item); }} className="p-1 text-blue-500 hover:text-blue-600" title="Download"><Download size={16} /></button>
          {item.type === 'gcs-data' && item.gcs?.versions?.length > 0 && (
            <button onClick={(e) => { e.stopPropagation(); handleViewVersions(item); }} className="p-1 text-purple-500 hover:text-purple-600" title="View Versions"><Clock size={16} /></button>
          )}
          <button onClick={(e) => { e.stopPropagation(); handleDelete(item); }} className="p-1 text-red-500 hover:text-red-600" title="Delete"><Trash2 size={16} /></button>
        </div>
      ),
    },
  ];
}

/* ─── Config Form (modal body) ─── */
function ConfigForm({ formData, setFormData, editingItem, jsonInput, onJsonInputChange, configTypes, onSubmit, onCancel }) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input label="Key" value={formData.key} onChange={(e) => setFormData({ ...formData, key: e.target.value })} required disabled={!!editingItem} />
        <Select
          label="Type"
          value={formData.type}
          onChange={(e) => { setFormData({ ...formData, type: e.target.value }); onJsonInputChange(''); }}
          options={configTypes.map(t => ({ value: t.value, label: t.label }))}
          disabled={!!editingItem}
        />
      </div>
      {formData.type !== 'gcs-data' && (
        <div>
          <label className="block text-sm font-medium text-content-secondary mb-1">
            {getJsonLabel(formData.type)}
          </label>
          <textarea
            className="w-full px-3 py-2 border border-edge rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm"
            rows={12}
            value={jsonInput}
            onChange={(e) => onJsonInputChange(e.target.value)}
            placeholder={getJsonPlaceholder(formData.type)}
          />
        </div>
      )}
      <div className="flex justify-end space-x-3 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit">{editingItem ? 'Update' : 'Create'}</Button>
      </div>
    </form>
  );
}

/* ─── Upload Form (modal body) ─── */
function UploadForm({ uploadKey, setUploadKey, uploadType, setUploadType, uploadFile, setUploadFile, configTypes, onSubmit, onCancel }) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Input label="Configuration Key" value={uploadKey} onChange={(e) => setUploadKey(e.target.value)} placeholder="e.g., my-config-key" required />
      <Select
        label="Configuration Type (optional for JSON)"
        value={uploadType}
        onChange={(e) => setUploadType(e.target.value)}
        options={[{ value: '', label: 'Auto-detect from file' }, ...configTypes.map(t => ({ value: t.value, label: t.label }))]}
      />
      <div>
        <label className="block text-sm font-medium text-content-secondary mb-2">File</label>
        <FileUpload accept=".json,.xlsx,.xls,.csv" label="Select JSON, Excel, or CSV file" onFileSelect={(f) => setUploadFile(f)} />
        {uploadFile && <p className="mt-2 text-sm text-content-muted">Selected: {uploadFile.name}</p>}
      </div>
      <div className="bg-surface-secondary p-4 rounded-lg text-sm text-content-muted">
        <p className="font-medium text-content-muted mb-2">File Type Handling:</p>
        <ul className="list-disc list-inside space-y-1">
          <li><strong>JSON files:</strong> Content parsed and stored in MongoDB based on structure</li>
          <li><strong>XLSX/CSV files:</strong> Stored in GCS bucket with versioning support</li>
        </ul>
      </div>
      <div className="flex justify-end space-x-3 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={!uploadFile || !uploadKey}>Upload</Button>
      </div>
    </form>
  );
}

/* ─── Detail Modal Content ─── */
function ConfigDetailContent({ selectedConfig, configTypes, onClose }) {
  if (!selectedConfig) return null;
  const getTypeLabel = (type) => {
    const typeObj = configTypes.find(t => t.value === type);
    return typeObj?.label || type;
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-content-muted">Config ID</label>
          <p className="text-content">{selectedConfig.config_id}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-content-muted">Key</label>
          <p className="text-content">{selectedConfig.key}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-content-muted">Type</label>
          <Badge variant={getTypeBadgeVariant(selectedConfig.type)}>{getTypeLabel(selectedConfig.type)}</Badge>
        </div>
        <div>
          <label className="block text-sm font-medium text-content-muted">Last Updated</label>
          <p className="text-content">{selectedConfig.row_update_stp ? new Date(selectedConfig.row_update_stp).toLocaleString() : '-'}</p>
        </div>
      </div>
      {selectedConfig.type === 'gcs-data' && selectedConfig.gcs && (
        <div className="bg-surface-secondary p-4 rounded-lg">
          <h4 className="font-medium text-content mb-2">GCS File Info</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-content-muted">File:</span> {selectedConfig.gcs.file_name}</div>
            <div><span className="text-content-muted">Version:</span> {selectedConfig.gcs.current_version}</div>
            <div><span className="text-content-muted">Size:</span> {(selectedConfig.gcs.size / 1024).toFixed(2)} KB</div>
            <div><span className="text-content-muted">Type:</span> {selectedConfig.gcs.content_type}</div>
          </div>
        </div>
      )}
      {selectedConfig.type !== 'gcs-data' && (
        <div>
          <label className="block text-sm font-medium text-content-muted mb-2">Data</label>
          <pre className="bg-neutral-900 text-green-400 p-4 rounded-lg overflow-auto max-h-96 text-sm">
            {JSON.stringify(getDetailData(selectedConfig), null, 2)}
          </pre>
        </div>
      )}
      <div className="flex justify-end pt-4">
        <Button variant="secondary" onClick={onClose}>Close</Button>
      </div>
    </div>
  );
}

/* ─── Versions Modal Content ─── */
function VersionsContent({ versions, selectedConfig, onDownloadVersion, onClose }) {
  return (
    <div className="space-y-4">
      {versions.length === 0 ? (
        <p className="text-content-muted text-center py-4">No versions available</p>
      ) : (
        <div className="space-y-2">
          {versions.map((version, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-surface-secondary rounded-lg">
              <div>
                <p className="font-medium text-content">
                  Version {version.version}
                  {selectedConfig?.gcs?.current_version === version.version && (
                    <Badge variant="success" className="ml-2">Current</Badge>
                  )}
                </p>
                <p className="text-sm text-content-muted">{version.file_name} - {(version.size / 1024).toFixed(2)} KB</p>
                <p className="text-xs text-content-muted">Uploaded: {new Date(version.upload_date).toLocaleString()}</p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => onDownloadVersion(version)}>Download</Button>
            </div>
          ))}
        </div>
      )}
      <div className="flex justify-end pt-4">
        <Button variant="secondary" onClick={onClose}>Close</Button>
      </div>
    </div>
  );
}

/* ─── Download helper ─── */
function triggerDownload(blobData, fileName, contentType) {
  const blob = contentType ? new Blob([blobData], { type: contentType }) : new Blob([blobData]);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

async function downloadGcsConfig(item) {
  const response = await configurationsAPI.download(item.config_id);
  triggerDownload(response.data, item.gcs?.file_name || `${item.key}_download`);
}

async function downloadJsonConfig(item) {
  const response = await configurationsAPI.downloadJson(item.config_id);
  const dataStr = JSON.stringify(response.data, null, 2);
  triggerDownload(dataStr, `${item.key}.json`, 'application/json');
}

/* ─── Header Section ─── */
function ConfigsHeader({ onOpenUpload, onAddNew }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-content">Configurations</h1>
        <p className="text-content-muted mt-1">Manage process configs, lookups, and file configurations</p>
      </div>
      <div className="flex space-x-3">
        <Button variant="secondary" onClick={onOpenUpload}><Upload size={16} className="mr-2" />Upload File</Button>
        <Button onClick={onAddNew}><Plus size={16} className="mr-2" />Add Configuration</Button>
      </div>
    </div>
  );
}

/* ─── Filters Section ─── */
function ConfigsFilters({ search, onSearchChange, filterType, onFilterTypeChange, configTypes }) {
  return (
    <Card className="p-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <SearchInput value={search} onChange={onSearchChange} placeholder="Search by key or config ID..." />
        </div>
        <div className="w-48">
          <Select value={filterType} onChange={onFilterTypeChange} options={[{ value: '', label: 'All Types' }, ...configTypes.map(t => ({ value: t.value, label: t.label }))]} />
        </div>
      </div>
    </Card>
  );
}

/* ─── Default form data ─── */
const DEFAULT_CONFIG_FORM = { key: '', type: 'process-config', queries: {}, logics: {}, operations: {}, lookups: {}, data: {} };

/* ─── Modals Section ─── */
function ConfigModals({ modalState, formProps, uploadProps, detailProps, versionsProps }) {
  const { modalOpen, uploadModalOpen, detailModalOpen, versionsModalOpen, editingItem, selectedConfig } = modalState;

  return (
    <>
      <Modal isOpen={modalOpen} onClose={formProps.onClose} title={editingItem ? 'Edit Configuration' : 'Add Configuration'} size="xl">
        <ConfigForm {...formProps.formFields} onSubmit={formProps.onSubmit} onCancel={formProps.onClose} />
      </Modal>

      <Modal isOpen={uploadModalOpen} onClose={uploadProps.onClose} title="Upload Configuration File" size="lg">
        <UploadForm {...uploadProps.fields} onSubmit={uploadProps.onSubmit} onCancel={uploadProps.onCancel} />
      </Modal>

      <Modal isOpen={detailModalOpen} onClose={detailProps.onClose} title="Configuration Details" size="xl">
        <ConfigDetailContent selectedConfig={selectedConfig} configTypes={detailProps.configTypes} onClose={detailProps.onClose} />
      </Modal>

      <Modal isOpen={versionsModalOpen} onClose={versionsProps.onClose} title="File Versions" size="lg">
        <VersionsContent versions={versionsProps.versions} selectedConfig={selectedConfig} onDownloadVersion={versionsProps.onDownloadVersion} onClose={versionsProps.onClose} />
      </Modal>
    </>
  );
}

/* ─── Upload handler helper ─── */
function buildUploadFormData(file, key, type) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('key', key);
  if (type) fd.append('config_type', type);
  return fd;
}

/* ─── Download dispatcher ─── */
async function handleDownloadItem(item) {
  if (item.type === 'gcs-data') { await downloadGcsConfig(item); }
  else { await downloadJsonConfig(item); }
}

/* ═══════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════ */
const ConfigurationsManagement = () => {
  const [configurations, setConfigurations] = useState([]);
  const [configTypes, setConfigTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [versionsModalOpen, setVersionsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [versions, setVersions] = useState([]);
  const [pagination, setPagination] = useState({ page: 0, limit: 25, total: 0, pages: 0 });
  const [formData, setFormData] = useState({ ...DEFAULT_CONFIG_FORM });
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadKey, setUploadKey] = useState('');
  const [uploadType, setUploadType] = useState('');
  const [jsonInput, setJsonInput] = useState('');

  const resetPage = useCallback(() => setPagination(prev => ({ ...prev, page: 0 })), []);

  const fetchData = useCallback(async () => {
    try {
      const [configsRes, typesRes] = await Promise.all([
        configurationsAPI.list({ search: search || undefined, type: filterType || undefined, page: pagination.page, limit: pagination.limit }),
        configurationsAPI.getTypes(),
      ]);
      const configsData = configsRes?.data || {};
      setConfigurations(configsData.data || (Array.isArray(configsData) ? configsData : []));
      setPagination(prev => ({ ...prev, ...(configsData.pagination || {}) }));
      setConfigTypes(typesRes?.data?.types || []);
    } catch (error) {
      toast.error('Failed to load configurations');
    } finally {
      setLoading(false);
    }
  }, [search, filterType, pagination.page, pagination.limit]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handlePageChange = (newPage) => setPagination(prev => ({ ...prev, page: newPage }));

  const resetForm = () => {
    setFormData({ ...DEFAULT_CONFIG_FORM });
    setJsonInput('');
    setEditingItem(null);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await configurationsAPI.create(formData);
      toast.success('Configuration created successfully');
      setModalOpen(false); resetForm(); fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create configuration');
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await configurationsAPI.update(editingItem.config_id, formData);
      toast.success('Configuration updated successfully');
      setModalOpen(false); resetForm(); fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update configuration');
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm('Are you sure you want to delete this configuration?')) return;
    try {
      await configurationsAPI.delete(item.config_id);
      toast.success('Configuration deleted successfully');
      fetchData();
    } catch (error) { toast.error('Failed to delete configuration'); }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile || !uploadKey) { toast.error('Please select a file and enter a key'); return; }
    try {
      const response = await configurationsAPI.upload(buildUploadFormData(uploadFile, uploadKey, uploadType), uploadKey, uploadType);
      toast.success(response?.data?.message || 'File uploaded successfully');
      setUploadModalOpen(false); setUploadFile(null); setUploadKey(''); setUploadType(''); fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Upload failed');
    }
  };

  const handleDownload = async (item) => {
    try {
      await handleDownloadItem(item);
      toast.success('Download started');
    } catch (error) { toast.error('Failed to download'); }
  };

  const handleViewVersions = async (item) => {
    try {
      const response = await configurationsAPI.getVersions(item.config_id);
      setVersions(response?.data?.versions || []);
      setSelectedConfig(item);
      setVersionsModalOpen(true);
    } catch (error) { toast.error('Failed to load versions'); }
  };

  const handleDownloadVersion = async (version) => {
    try {
      const response = await configurationsAPI.download(selectedConfig.config_id, version.version);
      triggerDownload(response.data, version.file_name);
      toast.success('Download started');
    } catch (error) { toast.error('Failed to download version'); }
  };

  const handleViewDetails = (item) => { setSelectedConfig(item); setDetailModalOpen(true); };

  const openEditModal = (item) => {
    setEditingItem(item);
    setFormData({
      key: item.key, type: item.type,
      queries: item.queries || {}, logics: item.logics || {},
      operations: item.operations || {}, lookups: item.lookups || {}, data: item.data || {},
    });
    setJsonInput(getJsonInputForType(item));
    setModalOpen(true);
  };

  const handleJsonInputChange = (value) => {
    setJsonInput(value);
    const parsed = parseJsonSafe(value);
    if (parsed !== null) {
      setFormData(prev => applyParsedJsonToFormData(prev, parsed, prev.type));
    }
  };

  const handleSearchChange = (val) => { setSearch(val); resetPage(); };
  const handleFilterTypeChange = (e) => { setFilterType(e.target.value); resetPage(); };

  const columns = buildColumns({ configTypes, handleViewDetails, openEditModal, handleDownload, handleViewVersions, handleDelete });

  const closeFormModal = () => { setModalOpen(false); resetForm(); };
  const closeUploadModal = () => { setUploadModalOpen(false); setUploadFile(null); setUploadKey(''); setUploadType(''); };

  const modalState = { modalOpen, uploadModalOpen, detailModalOpen, versionsModalOpen, editingItem, selectedConfig };

  const formProps = {
    onClose: closeFormModal,
    onSubmit: editingItem ? handleUpdate : handleCreate,
    formFields: { formData, setFormData, editingItem, jsonInput, onJsonInputChange: handleJsonInputChange, configTypes },
  };

  const uploadProps = {
    onClose: closeUploadModal,
    onCancel: () => { setUploadModalOpen(false); setUploadFile(null); setUploadKey(''); },
    onSubmit: handleUpload,
    fields: { uploadKey, setUploadKey, uploadType, setUploadType, uploadFile, setUploadFile, configTypes },
  };

  const detailProps = { onClose: () => setDetailModalOpen(false), configTypes };
  const versionsProps = { versions, onDownloadVersion: handleDownloadVersion, onClose: () => setVersionsModalOpen(false) };

  return (
    <div className="space-y-6">
      <ConfigsHeader onOpenUpload={() => setUploadModalOpen(true)} onAddNew={() => { resetForm(); setModalOpen(true); }} />

      <ConfigsFilters search={search} onSearchChange={handleSearchChange} filterType={filterType} onFilterTypeChange={handleFilterTypeChange} configTypes={configTypes} />

      <Card>
        <Table columns={columns} data={configurations} loading={loading} />
        {pagination.pages > 1 && (
          <Pagination currentPage={pagination.page} totalPages={pagination.pages} total={pagination.total} limit={pagination.limit} onPageChange={handlePageChange} />
        )}
      </Card>

      <ConfigModals modalState={modalState} formProps={formProps} uploadProps={uploadProps} detailProps={detailProps} versionsProps={versionsProps} />
    </div>
  );
};

export default ConfigurationsManagement;
