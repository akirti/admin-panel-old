import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Input, Table, Modal, Badge, SearchInput, Select, FileUpload, Pagination } from '../../components/shared';
import { configurationsAPI } from '../../services/api';
import toast from 'react-hot-toast';

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
  const [formData, setFormData] = useState({
    key: '',
    type: 'process-config',
    queries: {},
    logics: {},
    operations: {},
    lookups: {},
    data: {},
  });
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadKey, setUploadKey] = useState('');
  const [uploadType, setUploadType] = useState('');
  const [jsonInput, setJsonInput] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [configsRes, typesRes] = await Promise.all([
        configurationsAPI.list({ search: search || undefined, type: filterType || undefined, page: pagination.page, limit: pagination.limit }),
        configurationsAPI.getTypes(),
      ]);
      setConfigurations(configsRes.data.data || configsRes.data);
      setPagination(prev => ({ ...prev, ...(configsRes.data.pagination || {}) }));
      setConfigTypes(typesRes.data.types || []);
    } catch (error) {
      toast.error('Failed to load configurations');
    } finally {
      setLoading(false);
    }
  }, [search, filterType, pagination.page, pagination.limit]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await configurationsAPI.create(formData);
      toast.success('Configuration created successfully');
      setModalOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create configuration');
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await configurationsAPI.update(editingItem.config_id, formData);
      toast.success('Configuration updated successfully');
      setModalOpen(false);
      resetForm();
      fetchData();
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
    } catch (error) {
      toast.error('Failed to delete configuration');
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile || !uploadKey) {
      toast.error('Please select a file and enter a key');
      return;
    }

    const formDataUpload = new FormData();
    formDataUpload.append('file', uploadFile);
    formDataUpload.append('key', uploadKey);
    if (uploadType) {
      formDataUpload.append('config_type', uploadType);
    }

    try {
      const response = await configurationsAPI.upload(formDataUpload, uploadKey, uploadType);
      toast.success(response.data.message || 'File uploaded successfully');
      setUploadModalOpen(false);
      setUploadFile(null);
      setUploadKey('');
      setUploadType('');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Upload failed');
    }
  };

  const handleDownload = async (item) => {
    try {
      if (item.type === 'gcs-data') {
        const response = await configurationsAPI.download(item.config_id);
        const blob = new Blob([response.data]);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = item.gcs?.file_name || `${item.key}_download`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const response = await configurationsAPI.downloadJson(item.config_id);
        const dataStr = JSON.stringify(response.data, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${item.key}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
      toast.success('Download started');
    } catch (error) {
      toast.error('Failed to download');
    }
  };

  const handleViewVersions = async (item) => {
    try {
      const response = await configurationsAPI.getVersions(item.config_id);
      setVersions(response.data.versions || []);
      setSelectedConfig(item);
      setVersionsModalOpen(true);
    } catch (error) {
      toast.error('Failed to load versions');
    }
  };

  const handleDownloadVersion = async (version) => {
    try {
      const response = await configurationsAPI.download(selectedConfig.config_id, version.version);
      const blob = new Blob([response.data]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = version.file_name;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Download started');
    } catch (error) {
      toast.error('Failed to download version');
    }
  };

  const handleViewDetails = (item) => {
    setSelectedConfig(item);
    setDetailModalOpen(true);
  };

  const resetForm = () => {
    setFormData({
      key: '',
      type: 'process-config',
      queries: {},
      logics: {},
      operations: {},
      lookups: {},
      data: {},
    });
    setJsonInput('');
    setEditingItem(null);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setFormData({
      key: item.key,
      type: item.type,
      queries: item.queries || {},
      logics: item.logics || {},
      operations: item.operations || {},
      lookups: item.lookups || {},
      data: item.data || {},
    });

    // Set JSON input based on type
    if (item.type === 'process-config') {
      setJsonInput(JSON.stringify({ queries: item.queries, logics: item.logics, operations: item.operations }, null, 2));
    } else if (item.type === 'lookup-data') {
      setJsonInput(JSON.stringify(item.lookups || {}, null, 2));
    } else if (item.type === 'snapshot-data') {
      setJsonInput(JSON.stringify(item.data || {}, null, 2));
    }

    setModalOpen(true);
  };

  const handleJsonInputChange = (value) => {
    setJsonInput(value);
    try {
      const parsed = JSON.parse(value);
      if (formData.type === 'process-config') {
        setFormData({
          ...formData,
          queries: parsed.queries || {},
          logics: parsed.logics || {},
          operations: parsed.operations || {},
        });
      } else if (formData.type === 'lookup-data') {
        setFormData({ ...formData, lookups: parsed });
      } else if (formData.type === 'snapshot-data') {
        setFormData({ ...formData, data: parsed });
      }
    } catch (e) {
      // Invalid JSON, don't update formData
    }
  };

  const getTypeLabel = (type) => {
    const typeObj = configTypes.find(t => t.value === type);
    return typeObj?.label || type;
  };

  const getTypeBadgeVariant = (type) => {
    switch (type) {
      case 'process-config': return 'primary';
      case 'lookup-data': return 'success';
      case 'gcs-data': return 'warning';
      case 'snapshot-data': return 'default';
      default: return 'default';
    }
  };

  const columns = [
    { key: 'config_id', title: 'Config ID' },
    { key: 'key', title: 'Key' },
    {
      key: 'type',
      title: 'Type',
      render: (val) => (
        <Badge variant={getTypeBadgeVariant(val)}>
          {getTypeLabel(val)}
        </Badge>
      ),
    },
    {
      key: 'gcs',
      title: 'File Info',
      render: (val, row) => {
        if (row.type === 'gcs-data' && val) {
          return (
            <div className="text-xs">
              <div>{val.file_name}</div>
              <div className="text-gray-400">v{val.current_version} - {(val.size / 1024).toFixed(1)}KB</div>
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
          <button
            onClick={(e) => { e.stopPropagation(); handleViewDetails(item); }}
            className="p-1 text-gray-500 hover:text-red-600"
            title="View Details"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
          {item.type !== 'gcs-data' && (
            <button
              onClick={(e) => { e.stopPropagation(); openEditModal(item); }}
              className="p-1 text-gray-500 hover:text-red-600"
              title="Edit"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); handleDownload(item); }}
            className="p-1 text-blue-500 hover:text-blue-600"
            title="Download"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
          {item.type === 'gcs-data' && item.gcs?.versions?.length > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); handleViewVersions(item); }}
              className="p-1 text-purple-500 hover:text-purple-600"
              title="View Versions"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          )}
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
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configurations</h1>
          <p className="text-gray-500 mt-1">Manage process configs, lookups, and file configurations</p>
        </div>
        <div className="flex space-x-3">
          <Button variant="secondary" onClick={() => setUploadModalOpen(true)}>
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Upload File
          </Button>
          <Button onClick={() => { resetForm(); setModalOpen(true); }}>
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Configuration
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <SearchInput
              value={search}
              onChange={(val) => { setSearch(val); setPagination(prev => ({ ...prev, page: 0 })); }}
              placeholder="Search by key or config ID..."
            />
          </div>
          <div className="w-48">
            <Select
              value={filterType}
              onChange={(e) => { setFilterType(e.target.value); setPagination(prev => ({ ...prev, page: 0 })); }}
              options={[
                { value: '', label: 'All Types' },
                ...configTypes.map(t => ({ value: t.value, label: t.label })),
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card>
        <Table columns={columns} data={configurations} loading={loading} />
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
        title={editingItem ? 'Edit Configuration' : 'Add Configuration'}
        size="xl"
      >
        <form onSubmit={editingItem ? handleUpdate : handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Key"
              value={formData.key}
              onChange={(e) => setFormData({ ...formData, key: e.target.value })}
              required
              disabled={!!editingItem}
            />
            <Select
              label="Type"
              value={formData.type}
              onChange={(e) => {
                setFormData({ ...formData, type: e.target.value });
                setJsonInput('');
              }}
              options={configTypes.map(t => ({ value: t.value, label: t.label }))}
              disabled={!!editingItem}
            />
          </div>

          {formData.type !== 'gcs-data' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {formData.type === 'process-config' && 'Configuration JSON (queries, logics, operations)'}
                {formData.type === 'lookup-data' && 'Lookups JSON'}
                {formData.type === 'snapshot-data' && 'Data JSON'}
              </label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 font-mono text-sm"
                rows={12}
                value={jsonInput}
                onChange={(e) => handleJsonInputChange(e.target.value)}
                placeholder={
                  formData.type === 'process-config'
                    ? '{\n  "queries": {},\n  "logics": {},\n  "operations": {}\n}'
                    : '{}'
                }
              />
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => { setModalOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button type="submit">
              {editingItem ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Upload Modal */}
      <Modal
        isOpen={uploadModalOpen}
        onClose={() => { setUploadModalOpen(false); setUploadFile(null); setUploadKey(''); setUploadType(''); }}
        title="Upload Configuration File"
        size="lg"
      >
        <form onSubmit={handleUpload} className="space-y-4">
          <Input
            label="Configuration Key"
            value={uploadKey}
            onChange={(e) => setUploadKey(e.target.value)}
            placeholder="e.g., my-config-key"
            required
          />

          <Select
            label="Configuration Type (optional for JSON)"
            value={uploadType}
            onChange={(e) => setUploadType(e.target.value)}
            options={[
              { value: '', label: 'Auto-detect from file' },
              ...configTypes.map(t => ({ value: t.value, label: t.label })),
            ]}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">File</label>
            <FileUpload
              accept=".json,.xlsx,.xls,.csv"
              label="Select JSON, Excel, or CSV file"
              onFileSelect={(f) => setUploadFile(f)}
            />
            {uploadFile && (
              <p className="mt-2 text-sm text-gray-500">Selected: {uploadFile.name}</p>
            )}
          </div>

          <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-600">
            <p className="font-medium mb-2">File Type Handling:</p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>JSON files:</strong> Content parsed and stored in MongoDB based on structure</li>
              <li><strong>XLSX/CSV files:</strong> Stored in GCS bucket with versioning support</li>
            </ul>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => { setUploadModalOpen(false); setUploadFile(null); setUploadKey(''); }}>
              Cancel
            </Button>
            <Button type="submit" disabled={!uploadFile || !uploadKey}>
              Upload
            </Button>
          </div>
        </form>
      </Modal>

      {/* Detail View Modal */}
      <Modal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title="Configuration Details"
        size="xl"
      >
        {selectedConfig && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-500">Config ID</label>
                <p className="text-gray-900">{selectedConfig.config_id}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Key</label>
                <p className="text-gray-900">{selectedConfig.key}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Type</label>
                <Badge variant={getTypeBadgeVariant(selectedConfig.type)}>
                  {getTypeLabel(selectedConfig.type)}
                </Badge>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Last Updated</label>
                <p className="text-gray-900">
                  {selectedConfig.row_update_stp ? new Date(selectedConfig.row_update_stp).toLocaleString() : '-'}
                </p>
              </div>
            </div>

            {selectedConfig.type === 'gcs-data' && selectedConfig.gcs && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">GCS File Info</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-gray-500">File:</span> {selectedConfig.gcs.file_name}</div>
                  <div><span className="text-gray-500">Version:</span> {selectedConfig.gcs.current_version}</div>
                  <div><span className="text-gray-500">Size:</span> {(selectedConfig.gcs.size / 1024).toFixed(2)} KB</div>
                  <div><span className="text-gray-500">Type:</span> {selectedConfig.gcs.content_type}</div>
                </div>
              </div>
            )}

            {selectedConfig.type !== 'gcs-data' && (
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-2">Data</label>
                <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-auto max-h-96 text-sm">
                  {JSON.stringify(
                    selectedConfig.type === 'process-config'
                      ? { queries: selectedConfig.queries, logics: selectedConfig.logics, operations: selectedConfig.operations }
                      : selectedConfig.type === 'lookup-data'
                      ? selectedConfig.lookups
                      : selectedConfig.data,
                    null,
                    2
                  )}
                </pre>
              </div>
            )}

            <div className="flex justify-end pt-4">
              <Button variant="secondary" onClick={() => setDetailModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Versions Modal */}
      <Modal
        isOpen={versionsModalOpen}
        onClose={() => setVersionsModalOpen(false)}
        title="File Versions"
        size="lg"
      >
        <div className="space-y-4">
          {versions.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No versions available</p>
          ) : (
            <div className="space-y-2">
              {versions.map((version, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      Version {version.version}
                      {selectedConfig?.gcs?.current_version === version.version && (
                        <Badge variant="success" className="ml-2">Current</Badge>
                      )}
                    </p>
                    <p className="text-sm text-gray-500">
                      {version.file_name} - {(version.size / 1024).toFixed(2)} KB
                    </p>
                    <p className="text-xs text-gray-400">
                      Uploaded: {new Date(version.upload_date).toLocaleString()}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleDownloadVersion(version)}
                  >
                    Download
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end pt-4">
            <Button variant="secondary" onClick={() => setVersionsModalOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ConfigurationsManagement;
