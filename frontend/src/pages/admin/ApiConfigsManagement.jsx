import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Input, Table, Modal, Badge, SearchInput, Select, Pagination } from '../../components/shared';
import { apiConfigsAPI } from '../../services/api';
import { PlayCircle, Eye, Pencil, ShieldCheck, ToggleLeft, Trash2, Plus, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';

const AUTH_TYPES = [
  { value: 'none', label: 'None' },
  { value: 'basic', label: 'Basic Auth' },
  { value: 'bearer', label: 'Bearer Token' },
  { value: 'api_key', label: 'API Key' },
  { value: 'login_token', label: 'Login Token' },
  { value: 'oauth2', label: 'OAuth2 Client Credentials' },
  { value: 'mtls', label: 'mTLS' },
  { value: 'custom', label: 'Custom' },
];

// Helper to get auth config template for each auth type
const getAuthConfigTemplate = (authType) => {
  switch (authType) {
    case 'basic':
      return { username: '', password: '' };
    case 'bearer':
      return { token: '' };
    case 'api_key':
      return { key_name: 'X-API-Key', key_value: '', key_location: 'header' };
    case 'login_token':
      return {
        login_endpoint: '',
        login_method: 'POST',
        username_field: 'email',
        password_field: 'password',
        username: '',
        password: '',
        extra_body: {},
        token_response_path: 'access_token',
        token_type: 'Bearer',
        token_header_name: 'Authorization',
      };
    case 'oauth2':
      return {
        token_endpoint: '',
        client_id: '',
        client_secret: '',
        scope: '',
        grant_type: 'client_credentials',
        audience: '',
        extra_params: {},
        token_response_path: 'access_token',
        token_type: 'Bearer',
        token_header_name: 'Authorization',
      };
    default:
      return {};
  }
};

const HTTP_METHODS = [
  { value: 'GET', label: 'GET' },
  { value: 'POST', label: 'POST' },
  { value: 'PUT', label: 'PUT' },
  { value: 'DELETE', label: 'DELETE' },
  { value: 'PATCH', label: 'PATCH' },
];

const ApiConfigsManagement = () => {
  const [configs, setConfigs] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [certModalOpen, setCertModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [testLoading, setTestLoading] = useState(false);
  const [gcsStatus, setGcsStatus] = useState(null);
  const [pagination, setPagination] = useState({ page: 0, limit: 25, total: 0, pages: 0 });

  const [formData, setFormData] = useState({
    key: '',
    name: '',
    description: '',
    endpoint: '',
    method: 'GET',
    headers: {},
    params: {},
    body: {},
    auth_type: 'none',
    auth_config: {},
    ssl_verify: true,
    timeout: 30,
    retry_count: 0,
    retry_delay: 1,
    use_proxy: false,
    proxy_url: '',
    ping_endpoint: '',
    ping_method: 'GET',
    ping_expected_status: 200,
    ping_timeout: 5,
    cache_enabled: false,
    cache_ttl: 300,
    status: 'active',
    tags: [],
  });

  const [headersJson, setHeadersJson] = useState('{}');
  const [paramsJson, setParamsJson] = useState('{}');
  const [bodyJson, setBodyJson] = useState('{}');
  const [authConfigJson, setAuthConfigJson] = useState('{}');
  const [tagsInput, setTagsInput] = useState('');

  const [certFile, setCertFile] = useState(null);
  const [certType, setCertType] = useState('cert');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [configsRes, tagsRes] = await Promise.all([
        apiConfigsAPI.list({
          search: search || undefined,
          status: filterStatus || undefined,
          tags: filterTag || undefined,
          page: pagination.page,
          limit: pagination.limit,
        }),
        apiConfigsAPI.getTags(),
      ]);
      setConfigs(configsRes.data.data || []);
      setPagination(prev => ({ ...prev, ...(configsRes.data.pagination || {}) }));
      setTags(tagsRes.data.tags || []);
    } catch (error) {
      toast.error('Failed to load API configurations');
    } finally {
      setLoading(false);
    }
  }, [search, filterStatus, filterTag, pagination.page, pagination.limit]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    // Fetch GCS status on mount
    apiConfigsAPI.getGCSStatus().then(res => setGcsStatus(res.data)).catch(() => {});
  }, []);

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const resetForm = () => {
    setFormData({
      key: '',
      name: '',
      description: '',
      endpoint: '',
      method: 'GET',
      headers: {},
      params: {},
      body: {},
      auth_type: 'none',
      auth_config: {},
      ssl_verify: true,
      timeout: 30,
      retry_count: 0,
      retry_delay: 1,
      use_proxy: false,
      proxy_url: '',
      ping_endpoint: '',
      ping_method: 'GET',
      ping_expected_status: 200,
      ping_timeout: 5,
      cache_enabled: false,
      cache_ttl: 300,
      status: 'active',
      tags: [],
    });
    setHeadersJson('{}');
    setParamsJson('{}');
    setBodyJson('{}');
    setAuthConfigJson('{}');
    setTagsInput('');
    setEditingItem(null);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setFormData({
      key: item.key,
      name: item.name,
      description: item.description || '',
      endpoint: item.endpoint,
      method: item.method || 'GET',
      headers: item.headers || {},
      params: item.params || {},
      body: item.body || {},
      auth_type: item.auth_type || 'none',
      auth_config: item.auth_config || {},
      ssl_verify: item.ssl_verify !== false,
      timeout: item.timeout || 30,
      retry_count: item.retry_count || 0,
      retry_delay: item.retry_delay || 1,
      use_proxy: item.use_proxy || false,
      proxy_url: item.proxy_url || '',
      ping_endpoint: item.ping_endpoint || '',
      ping_method: item.ping_method || 'GET',
      ping_expected_status: item.ping_expected_status || 200,
      ping_timeout: item.ping_timeout || 5,
      cache_enabled: item.cache_enabled || false,
      cache_ttl: item.cache_ttl || 300,
      status: item.status || 'active',
      tags: item.tags || [],
    });
    setHeadersJson(JSON.stringify(item.headers || {}, null, 2));
    setParamsJson(JSON.stringify(item.params || {}, null, 2));
    setBodyJson(JSON.stringify(item.body || {}, null, 2));
    setAuthConfigJson(JSON.stringify(item.auth_config || {}, null, 2));
    setTagsInput((item.tags || []).join(', '));
    setModalOpen(true);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      // Parse JSON fields
      const data = {
        ...formData,
        headers: JSON.parse(headersJson || '{}'),
        params: JSON.parse(paramsJson || '{}'),
        body: JSON.parse(bodyJson || '{}'),
        auth_config: JSON.parse(authConfigJson || '{}'),
        tags: tagsInput.split(',').map(t => t.trim()).filter(Boolean),
      };
      await apiConfigsAPI.create(data);
      toast.success('API configuration created successfully');
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
      const data = {
        ...formData,
        headers: JSON.parse(headersJson || '{}'),
        params: JSON.parse(paramsJson || '{}'),
        body: JSON.parse(bodyJson || '{}'),
        auth_config: JSON.parse(authConfigJson || '{}'),
        tags: tagsInput.split(',').map(t => t.trim()).filter(Boolean),
      };
      // Remove key from update payload (it's not updatable)
      delete data.key;
      await apiConfigsAPI.update(editingItem._id, data);
      toast.success('API configuration updated successfully');
      setModalOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update configuration');
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm('Are you sure you want to delete this API configuration?')) return;
    try {
      await apiConfigsAPI.delete(item._id);
      toast.success('API configuration deleted successfully');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete configuration');
    }
  };

  const handleToggleStatus = async (item) => {
    try {
      await apiConfigsAPI.toggleStatus(item._id);
      toast.success(`Configuration ${item.status === 'active' ? 'deactivated' : 'activated'}`);
      fetchData();
    } catch (error) {
      toast.error('Failed to toggle status');
    }
  };

  const handleTest = async (item) => {
    setSelectedConfig(item);
    setTestResult(null);
    setTestModalOpen(true);
    setTestLoading(true);

    try {
      const response = await apiConfigsAPI.testById(item._id);
      setTestResult(response.data);
    } catch (error) {
      setTestResult({
        success: false,
        error: error.response?.data?.detail || error.message || 'Test failed',
      });
    } finally {
      setTestLoading(false);
    }
  };

  const handleViewDetails = (item) => {
    setSelectedConfig(item);
    setDetailModalOpen(true);
  };

  const handleUploadCert = async (e) => {
    e.preventDefault();
    if (!certFile || !selectedConfig) return;

    const formDataUpload = new FormData();
    formDataUpload.append('file', certFile);
    formDataUpload.append('cert_type', certType);

    try {
      await apiConfigsAPI.uploadCert(selectedConfig._id, formDataUpload);
      toast.success('Certificate uploaded successfully');
      setCertModalOpen(false);
      setCertFile(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to upload certificate');
    }
  };

  const openCertModal = (item) => {
    setSelectedConfig(item);
    setCertFile(null);
    setCertType('cert');
    setCertModalOpen(true);
  };

  const getStatusBadge = (status) => {
    return status === 'active' ? (
      <Badge variant="success">Active</Badge>
    ) : (
      <Badge variant="default">Inactive</Badge>
    );
  };

  const getAuthTypeBadge = (authType) => {
    const colors = {
      none: 'default',
      basic: 'primary',
      bearer: 'warning',
      api_key: 'success',
      oauth2: 'primary',
      mtls: 'danger',
      custom: 'default',
    };
    return <Badge variant={colors[authType] || 'default'}>{authType}</Badge>;
  };

  const columns = [
    { key: 'key', title: 'Key' },
    { key: 'name', title: 'Name' },
    {
      key: 'endpoint',
      title: 'Endpoint',
      render: (val) => (
        <span className="text-xs font-mono truncate max-w-xs block" title={val}>
          {val}
        </span>
      ),
    },
    {
      key: 'method',
      title: 'Method',
      render: (val) => (
        <Badge variant={val === 'GET' ? 'success' : val === 'POST' ? 'primary' : 'warning'}>
          {val}
        </Badge>
      ),
    },
    {
      key: 'auth_type',
      title: 'Auth',
      render: (val) => getAuthTypeBadge(val),
    },
    {
      key: 'status',
      title: 'Status',
      render: (val) => getStatusBadge(val),
    },
    {
      key: 'tags',
      title: 'Tags',
      render: (val) => (
        <div className="flex flex-wrap gap-1">
          {(val || []).slice(0, 2).map((tag, i) => (
            <span key={i} className="text-xs bg-neutral-100 px-2 py-0.5 rounded">{tag}</span>
          ))}
          {(val || []).length > 2 && (
            <span className="text-xs text-neutral-400">+{val.length - 2}</span>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      title: 'Actions',
      render: (_, item) => (
        <div className="flex items-center space-x-1">
          <button
            onClick={(e) => { e.stopPropagation(); handleTest(item); }}
            className="p-1 text-green-500 hover:text-green-600"
            title="Test API"
          >
            <PlayCircle size={16} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleViewDetails(item); }}
            className="p-1 text-neutral-500 hover:text-red-600"
            title="View Details"
          >
            <Eye size={16} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); openEditModal(item); }}
            className="p-1 text-neutral-500 hover:text-red-600"
            title="Edit"
          >
            <Pencil size={16} />
          </button>
          {gcsStatus?.configured && (
            <button
              onClick={(e) => { e.stopPropagation(); openCertModal(item); }}
              className="p-1 text-purple-500 hover:text-purple-600"
              title="Upload Certificate"
            >
              <ShieldCheck size={16} />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); handleToggleStatus(item); }}
            className={`p-1 ${item.status === 'active' ? 'text-yellow-500 hover:text-yellow-600' : 'text-green-500 hover:text-green-600'}`}
            title={item.status === 'active' ? 'Deactivate' : 'Activate'}
          >
            <ToggleLeft size={16} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleDelete(item); }}
            className="p-1 text-red-500 hover:text-red-600"
            title="Delete"
          >
            <Trash2 size={16} />
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
          <h1 className="text-2xl font-bold text-neutral-900">API Configurations</h1>
          <p className="text-neutral-500 mt-1">Manage external API configurations and test connectivity</p>
        </div>
        <div className="flex space-x-3">
          {gcsStatus && (
            <span className={`text-sm px-3 py-2 rounded-lg ${gcsStatus.configured ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
              GCS: {gcsStatus.configured ? 'Connected' : 'Not configured'}
            </span>
          )}
          <Button onClick={() => { resetForm(); setModalOpen(true); }}>
            <Plus size={16} className="mr-2" />
            Add API Config
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
              placeholder="Search by key, name, or endpoint..."
            />
          </div>
          <div className="w-40">
            <Select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setPagination(prev => ({ ...prev, page: 0 })); }}
              options={[
                { value: '', label: 'All Status' },
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ]}
            />
          </div>
          <div className="w-40">
            <Select
              value={filterTag}
              onChange={(e) => { setFilterTag(e.target.value); setPagination(prev => ({ ...prev, page: 0 })); }}
              options={[
                { value: '', label: 'All Tags' },
                ...tags.map(t => ({ value: t, label: t })),
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card>
        <Table columns={columns} data={configs} loading={loading} />
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
        title={editingItem ? 'Edit API Configuration' : 'Add API Configuration'}
        size="xl"
      >
        <form onSubmit={editingItem ? handleUpdate : handleCreate} className="space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Key"
              value={formData.key}
              onChange={(e) => setFormData({ ...formData, key: e.target.value })}
              placeholder="unique-api-key"
              required
              disabled={!!editingItem}
            />
            <Input
              label="Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="My API"
              required
            />
          </div>

          <Input
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Optional description"
          />

          {/* Endpoint */}
          <div className="grid grid-cols-4 gap-4">
            <div className="col-span-3">
              <Input
                label="Endpoint URL"
                value={formData.endpoint}
                onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
                placeholder="https://api.example.com/v1/resource"
                required
              />
            </div>
            <Select
              label="Method"
              value={formData.method}
              onChange={(e) => setFormData({ ...formData, method: e.target.value })}
              options={HTTP_METHODS}
            />
          </div>

          {/* Auth */}
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Authentication Type"
              value={formData.auth_type}
              onChange={(e) => setFormData({ ...formData, auth_type: e.target.value })}
              options={AUTH_TYPES}
            />
            <div className="flex items-center gap-4 pt-6">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.ssl_verify}
                  onChange={(e) => setFormData({ ...formData, ssl_verify: e.target.checked })}
                  className="rounded border-neutral-300"
                />
                <span className="text-sm">Verify SSL</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.use_proxy}
                  onChange={(e) => setFormData({ ...formData, use_proxy: e.target.checked })}
                  className="rounded border-neutral-300"
                />
                <span className="text-sm">Use Proxy</span>
              </label>
            </div>
          </div>

          {formData.use_proxy && (
            <Input
              label="Proxy URL"
              value={formData.proxy_url}
              onChange={(e) => setFormData({ ...formData, proxy_url: e.target.value })}
              placeholder="http://proxy:8080"
            />
          )}

          {/* Auth Config - Login Token */}
          {formData.auth_type === 'login_token' && (
            <div className="p-4 bg-blue-50 rounded-lg space-y-4">
              <h4 className="text-sm font-medium text-blue-800 mb-2">Login Token Configuration</h4>
              <p className="text-xs text-blue-600 mb-3">
                System will call the login endpoint to obtain a bearer token, then use it for the main API call.
              </p>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <Input
                    label="Login Endpoint URL"
                    value={JSON.parse(authConfigJson || '{}').login_endpoint || ''}
                    onChange={(e) => {
                      const config = JSON.parse(authConfigJson || '{}');
                      config.login_endpoint = e.target.value;
                      setAuthConfigJson(JSON.stringify(config, null, 2));
                    }}
                    placeholder="https://api.example.com/auth/login"
                  />
                </div>
                <Select
                  label="Login Method"
                  value={JSON.parse(authConfigJson || '{}').login_method || 'POST'}
                  onChange={(e) => {
                    const config = JSON.parse(authConfigJson || '{}');
                    config.login_method = e.target.value;
                    setAuthConfigJson(JSON.stringify(config, null, 2));
                  }}
                  options={HTTP_METHODS}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Username Field Name"
                  value={JSON.parse(authConfigJson || '{}').username_field || 'email'}
                  onChange={(e) => {
                    const config = JSON.parse(authConfigJson || '{}');
                    config.username_field = e.target.value;
                    setAuthConfigJson(JSON.stringify(config, null, 2));
                  }}
                  placeholder="email"
                />
                <Input
                  label="Password Field Name"
                  value={JSON.parse(authConfigJson || '{}').password_field || 'password'}
                  onChange={(e) => {
                    const config = JSON.parse(authConfigJson || '{}');
                    config.password_field = e.target.value;
                    setAuthConfigJson(JSON.stringify(config, null, 2));
                  }}
                  placeholder="password"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Username/Email"
                  value={JSON.parse(authConfigJson || '{}').username || ''}
                  onChange={(e) => {
                    const config = JSON.parse(authConfigJson || '{}');
                    config.username = e.target.value;
                    setAuthConfigJson(JSON.stringify(config, null, 2));
                  }}
                  placeholder="user@example.com"
                />
                <Input
                  label="Password"
                  type="password"
                  value={JSON.parse(authConfigJson || '{}').password || ''}
                  onChange={(e) => {
                    const config = JSON.parse(authConfigJson || '{}');
                    config.password = e.target.value;
                    setAuthConfigJson(JSON.stringify(config, null, 2));
                  }}
                  placeholder="••••••••"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Input
                  label="Token Response Path"
                  value={JSON.parse(authConfigJson || '{}').token_response_path || 'access_token'}
                  onChange={(e) => {
                    const config = JSON.parse(authConfigJson || '{}');
                    config.token_response_path = e.target.value;
                    setAuthConfigJson(JSON.stringify(config, null, 2));
                  }}
                  placeholder="access_token or data.token"
                />
                <Input
                  label="Token Type (Prefix)"
                  value={JSON.parse(authConfigJson || '{}').token_type || 'Bearer'}
                  onChange={(e) => {
                    const config = JSON.parse(authConfigJson || '{}');
                    config.token_type = e.target.value;
                    setAuthConfigJson(JSON.stringify(config, null, 2));
                  }}
                  placeholder="Bearer"
                />
                <Input
                  label="Token Header Name"
                  value={JSON.parse(authConfigJson || '{}').token_header_name || 'Authorization'}
                  onChange={(e) => {
                    const config = JSON.parse(authConfigJson || '{}');
                    config.token_header_name = e.target.value;
                    setAuthConfigJson(JSON.stringify(config, null, 2));
                  }}
                  placeholder="Authorization"
                />
              </div>
            </div>
          )}

          {/* Auth Config - OAuth2 Client Credentials */}
          {formData.auth_type === 'oauth2' && (
            <div className="p-4 bg-purple-50 rounded-lg space-y-4">
              <h4 className="text-sm font-medium text-purple-800 mb-2">OAuth2 Client Credentials Configuration</h4>
              <p className="text-xs text-purple-600 mb-3">
                System will obtain an OAuth2 token using client credentials flow, then use it for the main API call.
              </p>
              <Input
                label="Token Endpoint URL"
                value={JSON.parse(authConfigJson || '{}').token_endpoint || ''}
                onChange={(e) => {
                  const config = JSON.parse(authConfigJson || '{}');
                  config.token_endpoint = e.target.value;
                  setAuthConfigJson(JSON.stringify(config, null, 2));
                }}
                placeholder="https://auth.example.com/oauth/token"
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Client ID"
                  value={JSON.parse(authConfigJson || '{}').client_id || ''}
                  onChange={(e) => {
                    const config = JSON.parse(authConfigJson || '{}');
                    config.client_id = e.target.value;
                    setAuthConfigJson(JSON.stringify(config, null, 2));
                  }}
                  placeholder="my-client-id"
                />
                <Input
                  label="Client Secret"
                  type="password"
                  value={JSON.parse(authConfigJson || '{}').client_secret || ''}
                  onChange={(e) => {
                    const config = JSON.parse(authConfigJson || '{}');
                    config.client_secret = e.target.value;
                    setAuthConfigJson(JSON.stringify(config, null, 2));
                  }}
                  placeholder="••••••••"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Scope (optional)"
                  value={JSON.parse(authConfigJson || '{}').scope || ''}
                  onChange={(e) => {
                    const config = JSON.parse(authConfigJson || '{}');
                    config.scope = e.target.value;
                    setAuthConfigJson(JSON.stringify(config, null, 2));
                  }}
                  placeholder="read write"
                />
                <Input
                  label="Audience (optional)"
                  value={JSON.parse(authConfigJson || '{}').audience || ''}
                  onChange={(e) => {
                    const config = JSON.parse(authConfigJson || '{}');
                    config.audience = e.target.value;
                    setAuthConfigJson(JSON.stringify(config, null, 2));
                  }}
                  placeholder="https://api.example.com"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Input
                  label="Token Response Path"
                  value={JSON.parse(authConfigJson || '{}').token_response_path || 'access_token'}
                  onChange={(e) => {
                    const config = JSON.parse(authConfigJson || '{}');
                    config.token_response_path = e.target.value;
                    setAuthConfigJson(JSON.stringify(config, null, 2));
                  }}
                  placeholder="access_token"
                />
                <Input
                  label="Token Type (Prefix)"
                  value={JSON.parse(authConfigJson || '{}').token_type || 'Bearer'}
                  onChange={(e) => {
                    const config = JSON.parse(authConfigJson || '{}');
                    config.token_type = e.target.value;
                    setAuthConfigJson(JSON.stringify(config, null, 2));
                  }}
                  placeholder="Bearer"
                />
                <Input
                  label="Token Header Name"
                  value={JSON.parse(authConfigJson || '{}').token_header_name || 'Authorization'}
                  onChange={(e) => {
                    const config = JSON.parse(authConfigJson || '{}');
                    config.token_header_name = e.target.value;
                    setAuthConfigJson(JSON.stringify(config, null, 2));
                  }}
                  placeholder="Authorization"
                />
              </div>
            </div>
          )}

          {/* Auth Config JSON - For basic, bearer, api_key, mtls, custom */}
          {formData.auth_type !== 'none' && formData.auth_type !== 'login_token' && formData.auth_type !== 'oauth2' && (
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Auth Configuration JSON
                <span className="text-xs text-neutral-400 ml-2">
                  {formData.auth_type === 'basic' && '{"username": "", "password": ""}'}
                  {formData.auth_type === 'bearer' && '{"token": ""}'}
                  {formData.auth_type === 'api_key' && '{"key_name": "X-API-Key", "key_value": "", "key_location": "header"}'}
                </span>
              </label>
              <textarea
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 font-mono text-sm"
                rows={3}
                value={authConfigJson}
                onChange={(e) => setAuthConfigJson(e.target.value)}
              />
            </div>
          )}

          {/* Headers JSON */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Headers JSON</label>
            <textarea
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 font-mono text-sm"
              rows={2}
              value={headersJson}
              onChange={(e) => setHeadersJson(e.target.value)}
              placeholder='{"Content-Type": "application/json"}'
            />
          </div>

          {/* Params & Body */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Query Params JSON</label>
              <textarea
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 font-mono text-sm"
                rows={2}
                value={paramsJson}
                onChange={(e) => setParamsJson(e.target.value)}
                placeholder='{}'
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Request Body JSON</label>
              <textarea
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 font-mono text-sm"
                rows={2}
                value={bodyJson}
                onChange={(e) => setBodyJson(e.target.value)}
                placeholder='{}'
              />
            </div>
          </div>

          {/* Timeouts */}
          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Timeout (sec)"
              type="number"
              value={formData.timeout}
              onChange={(e) => setFormData({ ...formData, timeout: parseInt(e.target.value) || 30 })}
            />
            <Input
              label="Retry Count"
              type="number"
              value={formData.retry_count}
              onChange={(e) => setFormData({ ...formData, retry_count: parseInt(e.target.value) || 0 })}
            />
            <Input
              label="Retry Delay (sec)"
              type="number"
              value={formData.retry_delay}
              onChange={(e) => setFormData({ ...formData, retry_delay: parseInt(e.target.value) || 1 })}
            />
          </div>

          {/* Ping/Health Check */}
          <div className="p-4 bg-neutral-50 rounded-lg">
            <h4 className="text-sm font-medium text-neutral-700 mb-3">Health Check Settings</h4>
            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-2">
                <Input
                  label="Ping Endpoint"
                  value={formData.ping_endpoint}
                  onChange={(e) => setFormData({ ...formData, ping_endpoint: e.target.value })}
                  placeholder="Leave empty to use main endpoint"
                />
              </div>
              <Select
                label="Ping Method"
                value={formData.ping_method}
                onChange={(e) => setFormData({ ...formData, ping_method: e.target.value })}
                options={HTTP_METHODS}
              />
              <Input
                label="Expected Status"
                type="number"
                value={formData.ping_expected_status}
                onChange={(e) => setFormData({ ...formData, ping_expected_status: parseInt(e.target.value) || 200 })}
              />
            </div>
          </div>

          {/* Cache */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.cache_enabled}
                onChange={(e) => setFormData({ ...formData, cache_enabled: e.target.checked })}
                className="rounded border-neutral-300"
              />
              <span className="text-sm">Enable Caching</span>
            </label>
            {formData.cache_enabled && (
              <Input
                label="Cache TTL (sec)"
                type="number"
                value={formData.cache_ttl}
                onChange={(e) => setFormData({ ...formData, cache_ttl: parseInt(e.target.value) || 300 })}
                className="w-32"
              />
            )}
          </div>

          {/* Tags */}
          <Input
            label="Tags (comma-separated)"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="production, internal, payment"
          />

          {/* Status */}
          <Select
            label="Status"
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ]}
          />

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button type="button" variant="secondary" onClick={() => { setModalOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button type="submit">
              {editingItem ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Test Result Modal */}
      <Modal
        isOpen={testModalOpen}
        onClose={() => setTestModalOpen(false)}
        title={`Test: ${selectedConfig?.name || ''}`}
        size="lg"
      >
        <div className="space-y-4">
          {testLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
              <span className="ml-3 text-neutral-500">Testing API connection...</span>
            </div>
          ) : testResult ? (
            <>
              <div className={`p-4 rounded-lg ${testResult.success ? 'bg-green-50' : 'bg-red-50'}`}>
                <div className="flex items-center gap-2">
                  {testResult.success ? (
                    <Check size={20} className="text-green-500" />
                  ) : (
                    <X size={20} className="text-red-500" />
                  )}
                  <span className={`font-medium ${testResult.success ? 'text-green-700' : 'text-red-700'}`}>
                    {testResult.success ? 'Connection Successful' : 'Connection Failed'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="bg-neutral-50 p-3 rounded-lg">
                  <p className="text-xs text-neutral-500">Status Code</p>
                  <p className="text-lg font-semibold">{testResult.status_code || 'N/A'}</p>
                </div>
                <div className="bg-neutral-50 p-3 rounded-lg">
                  <p className="text-xs text-neutral-500">Response Time</p>
                  <p className="text-lg font-semibold">{testResult.response_time_ms ? `${testResult.response_time_ms}ms` : 'N/A'}</p>
                </div>
                <div className="bg-neutral-50 p-3 rounded-lg">
                  <p className="text-xs text-neutral-500">SSL Version</p>
                  <p className="text-lg font-semibold">{testResult.ssl_info?.version || 'N/A'}</p>
                </div>
              </div>

              {testResult.error && (
                <div className="bg-red-50 p-3 rounded-lg">
                  <p className="text-sm font-medium text-red-700">Error</p>
                  <p className="text-sm text-red-600">{testResult.error}</p>
                </div>
              )}

              {testResult.response_headers && (
                <div>
                  <p className="text-sm font-medium text-neutral-700 mb-2">Response Headers</p>
                  <pre className="bg-neutral-900 text-green-400 p-3 rounded-lg overflow-auto max-h-32 text-xs">
                    {JSON.stringify(testResult.response_headers, null, 2)}
                  </pre>
                </div>
              )}

              {testResult.response_body && (
                <div>
                  <p className="text-sm font-medium text-neutral-700 mb-2">Response Body</p>
                  <pre className="bg-neutral-900 text-green-400 p-3 rounded-lg overflow-auto max-h-48 text-xs">
                    {typeof testResult.response_body === 'string'
                      ? testResult.response_body
                      : JSON.stringify(testResult.response_body, null, 2)}
                  </pre>
                </div>
              )}
            </>
          ) : null}

          <div className="flex justify-end pt-4">
            <Button variant="secondary" onClick={() => setTestModalOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* Detail View Modal */}
      <Modal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title="API Configuration Details"
        size="xl"
      >
        {selectedConfig && (
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-500">Key</label>
                <p className="text-neutral-900 font-mono">{selectedConfig.key}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-500">Name</label>
                <p className="text-neutral-900">{selectedConfig.name}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-500">Status</label>
                {getStatusBadge(selectedConfig.status)}
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-500">Auth Type</label>
                {getAuthTypeBadge(selectedConfig.auth_type)}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-500">Endpoint</label>
              <p className="text-neutral-900 font-mono text-sm break-all">{selectedConfig.endpoint}</p>
            </div>

            {selectedConfig.description && (
              <div>
                <label className="block text-sm font-medium text-neutral-500">Description</label>
                <p className="text-neutral-900">{selectedConfig.description}</p>
              </div>
            )}

            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-500">Method</label>
                <Badge variant="primary">{selectedConfig.method}</Badge>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-500">Timeout</label>
                <p className="text-neutral-900">{selectedConfig.timeout}s</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-500">SSL Verify</label>
                <p className="text-neutral-900">{selectedConfig.ssl_verify ? 'Yes' : 'No'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-500">Use Proxy</label>
                <p className="text-neutral-900">{selectedConfig.use_proxy ? 'Yes' : 'No'}</p>
              </div>
            </div>

            {(selectedConfig.tags || []).length > 0 && (
              <div>
                <label className="block text-sm font-medium text-neutral-500 mb-2">Tags</label>
                <div className="flex flex-wrap gap-2">
                  {selectedConfig.tags.map((tag, i) => (
                    <span key={i} className="bg-neutral-100 px-3 py-1 rounded-full text-sm">{tag}</span>
                  ))}
                </div>
              </div>
            )}

            {/* SSL Certificates */}
            {(selectedConfig.ssl_cert_gcs_path || selectedConfig.ssl_key_gcs_path || selectedConfig.ssl_ca_gcs_path) && (
              <div className="bg-purple-50 p-4 rounded-lg">
                <h4 className="font-medium text-purple-900 mb-2">SSL Certificates</h4>
                <div className="space-y-1 text-sm">
                  {selectedConfig.ssl_cert_gcs_path && (
                    <p><span className="text-purple-600">Client Cert:</span> {selectedConfig.ssl_cert_gcs_path}</p>
                  )}
                  {selectedConfig.ssl_key_gcs_path && (
                    <p><span className="text-purple-600">Client Key:</span> {selectedConfig.ssl_key_gcs_path}</p>
                  )}
                  {selectedConfig.ssl_ca_gcs_path && (
                    <p><span className="text-purple-600">CA Cert:</span> {selectedConfig.ssl_ca_gcs_path}</p>
                  )}
                </div>
              </div>
            )}

            {Object.keys(selectedConfig.headers || {}).length > 0 && (
              <div>
                <label className="block text-sm font-medium text-neutral-500 mb-2">Headers</label>
                <pre className="bg-neutral-900 text-green-400 p-3 rounded-lg overflow-auto max-h-32 text-xs">
                  {JSON.stringify(selectedConfig.headers, null, 2)}
                </pre>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <label className="block text-sm font-medium text-neutral-500">Created</label>
                <p className="text-neutral-900">
                  {selectedConfig.created_at ? new Date(selectedConfig.created_at).toLocaleString() : '-'}
                  {selectedConfig.created_by && <span className="text-neutral-400"> by {selectedConfig.created_by}</span>}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-500">Updated</label>
                <p className="text-neutral-900">
                  {selectedConfig.updated_at ? new Date(selectedConfig.updated_at).toLocaleString() : '-'}
                  {selectedConfig.updated_by && <span className="text-neutral-400"> by {selectedConfig.updated_by}</span>}
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button variant="secondary" onClick={() => handleTest(selectedConfig)}>
                Test API
              </Button>
              <Button onClick={() => { setDetailModalOpen(false); openEditModal(selectedConfig); }}>
                Edit
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Certificate Upload Modal */}
      <Modal
        isOpen={certModalOpen}
        onClose={() => setCertModalOpen(false)}
        title="Upload Certificate"
        size="md"
      >
        <form onSubmit={handleUploadCert} className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-700">
            <p>Upload SSL certificates for mTLS authentication. Certificates are stored securely in GCS.</p>
          </div>

          <Select
            label="Certificate Type"
            value={certType}
            onChange={(e) => setCertType(e.target.value)}
            options={[
              { value: 'cert', label: 'Client Certificate (.pem, .crt)' },
              { value: 'key', label: 'Client Private Key (.pem, .key)' },
              { value: 'ca', label: 'CA Certificate (.pem, .crt)' },
            ]}
          />

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">Certificate File</label>
            <input
              type="file"
              accept=".pem,.crt,.key"
              onChange={(e) => setCertFile(e.target.files[0])}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
            />
            {certFile && (
              <p className="mt-2 text-sm text-neutral-500">Selected: {certFile.name}</p>
            )}
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setCertModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!certFile}>
              Upload
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ApiConfigsManagement;
