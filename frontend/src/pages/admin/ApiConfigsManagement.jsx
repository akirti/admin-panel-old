import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Input, Table, Modal, Badge, SearchInput, Select, Pagination } from '../../components/shared';
import { apiConfigsAPI } from '../../services/api';
import { PlayCircle, Eye, Pencil, ShieldCheck, ToggleLeft, Trash2, Plus, Check, X, Search, Filter } from 'lucide-react';
import toast from 'react-hot-toast';
import { AUTH_CONFIG_HINTS, PLACEHOLDER_URLS } from '../../constants/apiConfigDefaults';

/* ─── helpers (outside component) ─── */

function getMethodVariant(method) {
  if (method === 'GET') return 'success';
  if (method === 'POST') return 'primary';
  return 'warning';
}

function getStatusBadge(status) {
  return status === 'active' ? (
    <Badge variant="success">Active</Badge>
  ) : (
    <Badge variant="default">Inactive</Badge>
  );
}

const AUTH_TYPE_COLORS = {
  none: 'default',
  basic: 'primary',
  bearer: 'warning',
  api_key: 'success',
  oauth2: 'primary',
  mtls: 'danger',
  custom: 'default',
};

function getAuthTypeBadge(authType) {
  return <Badge variant={AUTH_TYPE_COLORS[authType] || 'default'}>{authType}</Badge>;
}

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

const HTTP_METHODS = [
  { value: 'GET', label: 'GET' },
  { value: 'POST', label: 'POST' },
  { value: 'PUT', label: 'PUT' },
  { value: 'DELETE', label: 'DELETE' },
  { value: 'PATCH', label: 'PATCH' },
];

const DEFAULT_TIMEOUT = 30;
const DEFAULT_RETRY_COUNT = 0;
const DEFAULT_RETRY_DELAY = 1;
const DEFAULT_PING_EXPECTED_STATUS = 200;
const DEFAULT_PING_TIMEOUT = 5;
const DEFAULT_CACHE_TTL = 300;
const DEFAULT_PAGE_LIMIT = 25;

function buildColumns({ handleTest, handleViewDetails, openEditModal, gcsStatus, openCertModal, handleToggleStatus, handleDelete }) {
  return [
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
      render: (val) => <Badge variant={getMethodVariant(val)}>{val}</Badge>,
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
            <span key={i} className="text-xs bg-surface-hover px-2 py-0.5 rounded">{tag}</span>
          ))}
          {(val || []).length > 2 && (
            <span className="text-xs text-content-muted">+{val.length - 2}</span>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      title: 'Actions',
      render: (_, item) => (
        <div className="flex items-center space-x-1">
          <button onClick={(e) => { e.stopPropagation(); handleTest(item); }} className="p-1 text-green-500 hover:text-green-600" title="Test API"><PlayCircle size={16} /></button>
          <button onClick={(e) => { e.stopPropagation(); handleViewDetails(item); }} className="p-1 text-content-muted hover:text-primary-600" title="View Details"><Eye size={16} /></button>
          <button onClick={(e) => { e.stopPropagation(); openEditModal(item); }} className="p-1 text-content-muted hover:text-primary-600" title="Edit"><Pencil size={16} /></button>
          {gcsStatus?.configured && (
            <button onClick={(e) => { e.stopPropagation(); openCertModal(item); }} className="p-1 text-purple-500 hover:text-purple-600" title="Upload Certificate"><ShieldCheck size={16} /></button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); handleToggleStatus(item); }}
            className={`p-1 ${item.status === 'active' ? 'text-yellow-500 hover:text-yellow-600' : 'text-green-500 hover:text-green-600'}`}
            title={item.status === 'active' ? 'Deactivate' : 'Activate'}
          ><ToggleLeft size={16} /></button>
          <button onClick={(e) => { e.stopPropagation(); handleDelete(item); }} className="p-1 text-red-500 hover:text-red-600" title="Delete"><Trash2 size={16} /></button>
        </div>
      ),
    },
  ];
}

function parseJsonSafe(str) {
  try { return JSON.parse(str || '{}'); } catch { return {}; }
}

/* ─── Login Token Auth Fields ─── */
function LoginTokenAuthFields({ authConfigJson, setAuthConfigJson }) {
  const updateField = (field, value) => {
    const config = parseJsonSafe(authConfigJson);
    config[field] = value;
    setAuthConfigJson(JSON.stringify(config, null, 2));
  };
  const config = parseJsonSafe(authConfigJson);

  return (
    <div className="p-4 bg-blue-50 rounded-lg space-y-4">
      <h4 className="text-sm font-medium text-blue-800 mb-2">Login Token Configuration</h4>
      <p className="text-xs text-blue-600 mb-3">
        System will call the login endpoint to obtain a bearer token, then use it for the main API call.
      </p>
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <Input label="Login Endpoint URL" value={config.login_endpoint || ''} onChange={(e) => updateField('login_endpoint', e.target.value)} placeholder={PLACEHOLDER_URLS.LOGIN_ENDPOINT} />
        </div>
        <Select label="Login Method" value={config.login_method || 'POST'} onChange={(e) => updateField('login_method', e.target.value)} options={HTTP_METHODS} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Username Field Name" value={config.username_field || 'email'} onChange={(e) => updateField('username_field', e.target.value)} placeholder="email" />
        <Input label="Password Field Name" value={config.password_field || 'password'} onChange={(e) => updateField('password_field', e.target.value)} placeholder="password" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Username/Email" value={config.username || ''} onChange={(e) => updateField('username', e.target.value)} placeholder="user@example.com" />
        <Input label="Password" type="password" value={config.password || ''} onChange={(e) => updateField('password', e.target.value)} placeholder="••••••••" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Input label="Token Response Path" value={config.token_response_path || 'access_token'} onChange={(e) => updateField('token_response_path', e.target.value)} placeholder="access_token or data.token" />
        <Input label="Token Type (Prefix)" value={config.token_type || 'Bearer'} onChange={(e) => updateField('token_type', e.target.value)} placeholder="Bearer" />
        <Input label="Token Header Name" value={config.token_header_name || 'Authorization'} onChange={(e) => updateField('token_header_name', e.target.value)} placeholder="Authorization" />
      </div>
    </div>
  );
}

/* ─── OAuth2 Auth Fields ─── */
function OAuth2AuthFields({ authConfigJson, setAuthConfigJson }) {
  const updateField = (field, value) => {
    const config = parseJsonSafe(authConfigJson);
    config[field] = value;
    setAuthConfigJson(JSON.stringify(config, null, 2));
  };
  const config = parseJsonSafe(authConfigJson);

  return (
    <div className="p-4 bg-purple-50 rounded-lg space-y-4">
      <h4 className="text-sm font-medium text-purple-800 mb-2">OAuth2 Client Credentials Configuration</h4>
      <p className="text-xs text-purple-600 mb-3">
        System will obtain an OAuth2 token using client credentials flow, then use it for the main API call.
      </p>
      <Input label="Token Endpoint URL" value={config.token_endpoint || ''} onChange={(e) => updateField('token_endpoint', e.target.value)} placeholder={PLACEHOLDER_URLS.OAUTH_TOKEN_ENDPOINT} />
      <div className="grid grid-cols-2 gap-4">
        <Input label="Client ID" value={config.client_id || ''} onChange={(e) => updateField('client_id', e.target.value)} placeholder="my-client-id" />
        <Input label="Client Secret" type="password" value={config.client_secret || ''} onChange={(e) => updateField('client_secret', e.target.value)} placeholder="••••••••" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Scope (optional)" value={config.scope || ''} onChange={(e) => updateField('scope', e.target.value)} placeholder="read write" />
        <Input label="Audience (optional)" value={config.audience || ''} onChange={(e) => updateField('audience', e.target.value)} placeholder={PLACEHOLDER_URLS.OAUTH_AUDIENCE} />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Input label="Token Response Path" value={config.token_response_path || 'access_token'} onChange={(e) => updateField('token_response_path', e.target.value)} placeholder="access_token" />
        <Input label="Token Type (Prefix)" value={config.token_type || 'Bearer'} onChange={(e) => updateField('token_type', e.target.value)} placeholder="Bearer" />
        <Input label="Token Header Name" value={config.token_header_name || 'Authorization'} onChange={(e) => updateField('token_header_name', e.target.value)} placeholder="Authorization" />
      </div>
    </div>
  );
}

/* ─── Auth Config Section (picks which sub-component to render) ─── */
function AuthConfigSection({ authType, authConfigJson, setAuthConfigJson }) {
  if (authType === 'none') return null;
  if (authType === 'login_token') return <LoginTokenAuthFields authConfigJson={authConfigJson} setAuthConfigJson={setAuthConfigJson} />;
  if (authType === 'oauth2') return <OAuth2AuthFields authConfigJson={authConfigJson} setAuthConfigJson={setAuthConfigJson} />;

  return (
    <div>
      <label className="block text-sm font-medium text-content-secondary mb-1">
        Auth Configuration JSON
        <span className="text-xs text-content-muted ml-2">
          {AUTH_CONFIG_HINTS[authType] || ''}
        </span>
      </label>
      <textarea
        className="w-full px-3 py-2 border border-edge rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm"
        rows={3}
        value={authConfigJson}
        onChange={(e) => setAuthConfigJson(e.target.value)}
      />
    </div>
  );
}

/* ─── API Config Form (modal body) ─── */
function ApiConfigForm({ formData, setFormData, editingItem, headersJson, setHeadersJson, paramsJson, setParamsJson, bodyJson, setBodyJson, authConfigJson, setAuthConfigJson, tagsInput, setTagsInput, onSubmit, onCancel }) {
  return (
    <form onSubmit={onSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto">
      {/* Basic Info */}
      <div className="grid grid-cols-2 gap-4">
        <Input label="Key" value={formData.key} onChange={(e) => setFormData({ ...formData, key: e.target.value })} placeholder="unique-api-key" required disabled={!!editingItem} />
        <Input label="Name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="My API" required />
      </div>
      <Input label="Description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Optional description" />

      {/* Endpoint */}
      <div className="grid grid-cols-4 gap-4">
        <div className="col-span-3">
          <Input label="Endpoint URL" value={formData.endpoint} onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })} placeholder={PLACEHOLDER_URLS.API_ENDPOINT} required />
        </div>
        <Select label="Method" value={formData.method} onChange={(e) => setFormData({ ...formData, method: e.target.value })} options={HTTP_METHODS} />
      </div>

      {/* Auth */}
      <div className="grid grid-cols-2 gap-4">
        <Select label="Authentication Type" value={formData.auth_type} onChange={(e) => setFormData({ ...formData, auth_type: e.target.value })} options={AUTH_TYPES} />
        <div className="flex items-center gap-4 pt-6">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={formData.ssl_verify} onChange={(e) => setFormData({ ...formData, ssl_verify: e.target.checked })} className="rounded border-edge" />
            <span className="text-sm">Verify SSL</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={formData.use_proxy} onChange={(e) => setFormData({ ...formData, use_proxy: e.target.checked })} className="rounded border-edge" />
            <span className="text-sm">Use Proxy</span>
          </label>
        </div>
      </div>

      {formData.use_proxy && (
        <Input label="Proxy URL" value={formData.proxy_url} onChange={(e) => setFormData({ ...formData, proxy_url: e.target.value })} placeholder={PLACEHOLDER_URLS.PROXY} />
      )}

      <AuthConfigSection authType={formData.auth_type} authConfigJson={authConfigJson} setAuthConfigJson={setAuthConfigJson} />

      {/* Headers JSON */}
      <div>
        <label className="block text-sm font-medium text-content-secondary mb-1">Headers JSON</label>
        <textarea className="w-full px-3 py-2 border border-edge rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm" rows={2} value={headersJson} onChange={(e) => setHeadersJson(e.target.value)} placeholder='{"Content-Type": "application/json"}' />
      </div>

      {/* Params & Body */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-content-secondary mb-1">Query Params JSON</label>
          <textarea className="w-full px-3 py-2 border border-edge rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm" rows={2} value={paramsJson} onChange={(e) => setParamsJson(e.target.value)} placeholder='{}' />
        </div>
        <div>
          <label className="block text-sm font-medium text-content-secondary mb-1">Request Body JSON</label>
          <textarea className="w-full px-3 py-2 border border-edge rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm" rows={2} value={bodyJson} onChange={(e) => setBodyJson(e.target.value)} placeholder='{}' />
        </div>
      </div>

      {/* Timeouts */}
      <div className="grid grid-cols-3 gap-4">
        <Input label="Timeout (sec)" type="number" value={formData.timeout} onChange={(e) => setFormData({ ...formData, timeout: parseInt(e.target.value) || DEFAULT_TIMEOUT })} />
        <Input label="Retry Count" type="number" value={formData.retry_count} onChange={(e) => setFormData({ ...formData, retry_count: parseInt(e.target.value) || 0 })} />
        <Input label="Retry Delay (sec)" type="number" value={formData.retry_delay} onChange={(e) => setFormData({ ...formData, retry_delay: parseInt(e.target.value) || DEFAULT_RETRY_DELAY })} />
      </div>

      {/* Ping/Health Check */}
      <div className="p-4 bg-surface-secondary rounded-lg">
        <h4 className="text-sm font-medium text-content-secondary mb-3">Health Check Settings</h4>
        <div className="grid grid-cols-4 gap-4">
          <div className="col-span-2">
            <Input label="Ping Endpoint" value={formData.ping_endpoint} onChange={(e) => setFormData({ ...formData, ping_endpoint: e.target.value })} placeholder="Leave empty to use main endpoint" />
          </div>
          <Select label="Ping Method" value={formData.ping_method} onChange={(e) => setFormData({ ...formData, ping_method: e.target.value })} options={HTTP_METHODS} />
          <Input label="Expected Status" type="number" value={formData.ping_expected_status} onChange={(e) => setFormData({ ...formData, ping_expected_status: parseInt(e.target.value) || DEFAULT_PING_EXPECTED_STATUS })} />
        </div>
      </div>

      {/* Cache */}
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={formData.cache_enabled} onChange={(e) => setFormData({ ...formData, cache_enabled: e.target.checked })} className="rounded border-edge" />
          <span className="text-sm">Enable Caching</span>
        </label>
        {formData.cache_enabled && (
          <Input label="Cache TTL (sec)" type="number" value={formData.cache_ttl} onChange={(e) => setFormData({ ...formData, cache_ttl: parseInt(e.target.value) || DEFAULT_CACHE_TTL })} className="w-32" />
        )}
      </div>

      {/* Tags */}
      <Input label="Tags (comma-separated)" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="production, internal, payment" />

      {/* Status */}
      <Select label="Status" value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} />

      <div className="flex justify-end space-x-3 pt-4 border-t">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit">{editingItem ? 'Update' : 'Create'}</Button>
      </div>
    </form>
  );
}

/* ─── Test Result Sub-Components ─── */
function TestLoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      <span className="ml-3 text-content-muted">Testing API connection...</span>
    </div>
  );
}

function TestResultStatusBanner({ success }) {
  const bgClass = success ? 'bg-green-50' : 'bg-red-50';
  const textClass = success ? 'text-green-700' : 'text-red-700';
  const icon = success ? <Check size={20} className="text-green-500" /> : <X size={20} className="text-red-500" />;
  const label = success ? 'Connection Successful' : 'Connection Failed';
  return (
    <div className={`p-4 rounded-lg ${bgClass}`}>
      <div className="flex items-center gap-2">
        {icon}
        <span className={`font-medium ${textClass}`}>{label}</span>
      </div>
    </div>
  );
}

function TestResultMetrics({ testResult }) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="bg-surface-secondary p-3 rounded-lg">
        <p className="text-xs text-content-muted">Status Code</p>
        <p className="text-lg font-semibold">{testResult.status_code || 'N/A'}</p>
      </div>
      <div className="bg-surface-secondary p-3 rounded-lg">
        <p className="text-xs text-content-muted">Response Time</p>
        <p className="text-lg font-semibold">{testResult.response_time_ms ? `${testResult.response_time_ms}ms` : 'N/A'}</p>
      </div>
      <div className="bg-surface-secondary p-3 rounded-lg">
        <p className="text-xs text-content-muted">SSL Version</p>
        <p className="text-lg font-semibold">{testResult.ssl_info?.version || 'N/A'}</p>
      </div>
    </div>
  );
}

function formatResponseBody(body) {
  return typeof body === 'string' ? body : JSON.stringify(body, null, 2);
}

function TestResultDetails({ testResult }) {
  return (
    <>
      <TestResultStatusBanner success={testResult.success} />
      <TestResultMetrics testResult={testResult} />
      {testResult.error && (
        <div className="bg-red-50 p-3 rounded-lg">
          <p className="text-sm font-medium text-red-700">Error</p>
          <p className="text-sm text-red-600">{testResult.error}</p>
        </div>
      )}
      {testResult.response_headers && (
        <div>
          <p className="text-sm font-medium text-content-secondary mb-2">Response Headers</p>
          <pre className="bg-neutral-900 text-green-400 p-3 rounded-lg overflow-auto max-h-32 text-xs">
            {JSON.stringify(testResult.response_headers, null, 2)}
          </pre>
        </div>
      )}
      {testResult.response_body && (
        <div>
          <p className="text-sm font-medium text-content-secondary mb-2">Response Body</p>
          <pre className="bg-neutral-900 text-green-400 p-3 rounded-lg overflow-auto max-h-48 text-xs">
            {formatResponseBody(testResult.response_body)}
          </pre>
        </div>
      )}
    </>
  );
}

/* ─── Test Result Modal Content ─── */
function TestResultContent({ testLoading, testResult, onClose }) {
  return (
    <div className="space-y-4">
      {testLoading && <TestLoadingSpinner />}
      {!testLoading && testResult && <TestResultDetails testResult={testResult} />}
      <div className="flex justify-end pt-4">
        <Button variant="secondary" onClick={onClose}>Close</Button>
      </div>
    </div>
  );
}

/* ─── Detail View Sub-Components ─── */
function DetailField({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-content-muted">{label}</label>
      {children}
    </div>
  );
}

function DetailSslCerts({ config }) {
  const hasCerts = config.ssl_cert_gcs_path || config.ssl_key_gcs_path || config.ssl_ca_gcs_path;
  if (!hasCerts) return null;
  return (
    <div className="bg-purple-50 p-4 rounded-lg">
      <h4 className="font-medium text-purple-900 mb-2">SSL Certificates</h4>
      <div className="space-y-1 text-sm">
        {config.ssl_cert_gcs_path && <p><span className="text-purple-600">Client Cert:</span> {config.ssl_cert_gcs_path}</p>}
        {config.ssl_key_gcs_path && <p><span className="text-purple-600">Client Key:</span> {config.ssl_key_gcs_path}</p>}
        {config.ssl_ca_gcs_path && <p><span className="text-purple-600">CA Cert:</span> {config.ssl_ca_gcs_path}</p>}
      </div>
    </div>
  );
}

function DetailTimestamps({ config }) {
  return (
    <div className="grid grid-cols-2 gap-4 text-sm">
      <DetailField label="Created">
        <p className="text-content">
          {config.created_at ? new Date(config.created_at).toLocaleString() : '-'}
          {config.created_by && <span className="text-content-muted"> by {config.created_by}</span>}
        </p>
      </DetailField>
      <DetailField label="Updated">
        <p className="text-content">
          {config.updated_at ? new Date(config.updated_at).toLocaleString() : '-'}
          {config.updated_by && <span className="text-content-muted"> by {config.updated_by}</span>}
        </p>
      </DetailField>
    </div>
  );
}

function hasHeaders(config) {
  return Object.keys(config.headers || {}).length > 0;
}

function hasTags(config) {
  return (config.tags || []).length > 0;
}

/* ─── Detail View Modal Content ─── */
function DetailViewContent({ selectedConfig, onTest, onEdit, onClose }) {
  if (!selectedConfig) return null;
  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto">
      <div className="grid grid-cols-2 gap-4">
        <DetailField label="Key"><p className="text-content font-mono">{selectedConfig.key}</p></DetailField>
        <DetailField label="Name"><p className="text-content">{selectedConfig.name}</p></DetailField>
        <DetailField label="Status">{getStatusBadge(selectedConfig.status)}</DetailField>
        <DetailField label="Auth Type">{getAuthTypeBadge(selectedConfig.auth_type)}</DetailField>
      </div>
      <DetailField label="Endpoint">
        <p className="text-content font-mono text-sm break-all">{selectedConfig.endpoint}</p>
      </DetailField>
      {selectedConfig.description && (
        <DetailField label="Description"><p className="text-content">{selectedConfig.description}</p></DetailField>
      )}
      <div className="grid grid-cols-4 gap-4">
        <DetailField label="Method"><Badge variant="primary">{selectedConfig.method}</Badge></DetailField>
        <DetailField label="Timeout"><p className="text-content">{selectedConfig.timeout}s</p></DetailField>
        <DetailField label="SSL Verify"><p className="text-content">{selectedConfig.ssl_verify ? 'Yes' : 'No'}</p></DetailField>
        <DetailField label="Use Proxy"><p className="text-content">{selectedConfig.use_proxy ? 'Yes' : 'No'}</p></DetailField>
      </div>
      {hasTags(selectedConfig) && (
        <div>
          <label className="block text-sm font-medium text-content-muted mb-2">Tags</label>
          <div className="flex flex-wrap gap-2">
            {selectedConfig.tags.map((tag, i) => (
              <span key={i} className="bg-surface-hover px-3 py-1 rounded-full text-sm">{tag}</span>
            ))}
          </div>
        </div>
      )}
      <DetailSslCerts config={selectedConfig} />
      {hasHeaders(selectedConfig) && (
        <div>
          <label className="block text-sm font-medium text-content-muted mb-2">Headers</label>
          <pre className="bg-neutral-900 text-green-400 p-3 rounded-lg overflow-auto max-h-32 text-xs">
            {JSON.stringify(selectedConfig.headers, null, 2)}
          </pre>
        </div>
      )}
      <DetailTimestamps config={selectedConfig} />
      <div className="flex justify-end space-x-3 pt-4 border-t">
        <Button variant="secondary" onClick={() => onTest(selectedConfig)}>Test API</Button>
        <Button onClick={() => onEdit(selectedConfig)}>Edit</Button>
      </div>
    </div>
  );
}

/* ─── Default form data factory ─── */
function getDefaultFormData() {
  return {
    key: '', name: '', description: '', endpoint: '', method: 'GET',
    headers: {}, params: {}, body: {}, auth_type: 'none', auth_config: {},
    ssl_verify: true, timeout: DEFAULT_TIMEOUT, retry_count: DEFAULT_RETRY_COUNT,
    retry_delay: DEFAULT_RETRY_DELAY, use_proxy: false, proxy_url: '',
    ping_endpoint: '', ping_method: 'GET', ping_expected_status: DEFAULT_PING_EXPECTED_STATUS,
    ping_timeout: DEFAULT_PING_TIMEOUT, cache_enabled: false, cache_ttl: DEFAULT_CACHE_TTL,
    status: 'active', tags: [],
  };
}

/* ─── Build form data from existing item ─── */
const FORM_FIELD_DEFAULTS = {
  description: '', method: 'GET', headers: {}, params: {}, body: {},
  auth_type: 'none', auth_config: {}, use_proxy: false, proxy_url: '',
  ping_endpoint: '', ping_method: 'GET', cache_enabled: false, status: 'active', tags: [],
};

const FORM_NUMERIC_DEFAULTS = {
  timeout: DEFAULT_TIMEOUT, retry_count: DEFAULT_RETRY_COUNT, retry_delay: DEFAULT_RETRY_DELAY,
  ping_expected_status: DEFAULT_PING_EXPECTED_STATUS, ping_timeout: DEFAULT_PING_TIMEOUT,
  cache_ttl: DEFAULT_CACHE_TTL,
};

function buildFormDataFromItem(item) {
  const result = { key: item.key, name: item.name, ssl_verify: item.ssl_verify !== false, endpoint: item.endpoint };
  for (const [field, fallback] of Object.entries(FORM_FIELD_DEFAULTS)) {
    result[field] = item[field] || fallback;
  }
  for (const [field, fallback] of Object.entries(FORM_NUMERIC_DEFAULTS)) {
    result[field] = item[field] || fallback;
  }
  return result;
}

/* ─── Header Section ─── */
function ApiConfigsHeader({ total, gcsStatus, onAddNew }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-content">API Configurations</h1>
        <p className="text-content-muted mt-1">Manage external API configurations and test connectivity ({total} total)</p>
      </div>
      <div className="flex space-x-3">
        {gcsStatus && (
          <span className={`text-sm px-3 py-2 rounded-lg ${gcsStatus.configured ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
            GCS: {gcsStatus.configured ? 'Connected' : 'Not configured'}
          </span>
        )}
        <Button onClick={onAddNew}><Plus size={16} className="mr-2" />Add API Config</Button>
      </div>
    </div>
  );
}

/* ─── Stats Section ─── */
function ApiConfigsStats({ configs, total, filterStatus, filterTag }) {
  if (filterStatus || filterTag || configs.length === 0) return null;
  const active = configs.filter(c => c.status === 'active').length;
  const byMethod = {};
  configs.forEach(c => { const m = (c.method || 'GET').toUpperCase(); byMethod[m] = (byMethod[m] || 0) + 1; });
  const topMethod = Object.entries(byMethod).sort((a, b) => b[1] - a[1])[0];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="card p-4"><div className="text-sm text-content-muted">Total API Configs</div><div className="text-2xl font-bold text-content">{total}</div></div>
      <div className="card p-4"><div className="text-sm text-content-muted">Active</div><div className="text-2xl font-bold text-green-600">{active}</div></div>
      <div className="card p-4"><div className="text-sm text-content-muted">Inactive</div><div className="text-2xl font-bold text-red-600">{total - active}</div></div>
      {topMethod && <div className="card p-4"><div className="text-sm text-content-muted">{topMethod[0]}</div><div className="text-2xl font-bold text-content">{topMethod[1]}</div><div className="text-xs text-content-muted">endpoints</div></div>}
    </div>
  );
}

/* ─── Filter Section ─── */
function ApiConfigsFilters({ search, onSearchChange, filterStatus, onFilterStatusChange, filterTag, onFilterTagChange, tags, onClear }) {
  return (
    <div className="card !p-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted pointer-events-none" size={18} />
          <input type="text" value={search} onChange={(e) => onSearchChange(e.target.value)} placeholder="Search by key, name, or endpoint..." className="input !py-2 pl-10 w-full" />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-content-muted shrink-0" />
          <select className="input !py-2 min-w-[140px]" value={filterStatus} onChange={onFilterStatusChange}>
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <select className="input !py-2 min-w-[140px]" value={filterTag} onChange={onFilterTagChange}>
            <option value="">All Tags</option>
            {tags.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          {(filterStatus || filterTag) && <button className="text-sm text-primary-600 hover:underline whitespace-nowrap" onClick={onClear}>Clear</button>}
        </div>
      </div>
    </div>
  );
}

/* ─── Certificate Upload Modal Content ─── */
function CertUploadContent({ certFile, setCertFile, certType, setCertType, onSubmit, onCancel }) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-700">
        <p>Upload SSL certificates for mTLS authentication. Certificates are stored securely in GCS.</p>
      </div>
      <Select label="Certificate Type" value={certType} onChange={(e) => setCertType(e.target.value)} options={[
        { value: 'cert', label: 'Client Certificate (.pem, .crt)' },
        { value: 'key', label: 'Client Private Key (.pem, .key)' },
        { value: 'ca', label: 'CA Certificate (.pem, .crt)' },
      ]} />
      <div>
        <label className="block text-sm font-medium text-content-secondary mb-2">Certificate File</label>
        <input type="file" accept=".pem,.crt,.key" onChange={(e) => setCertFile(e.target.files[0])} className="w-full px-3 py-2 border border-edge rounded-lg" />
        {certFile && <p className="mt-2 text-sm text-content-muted">Selected: {certFile.name}</p>}
      </div>
      <div className="flex justify-end space-x-3 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={!certFile}>Upload</Button>
      </div>
    </form>
  );
}

/* ─── Modals Section ─── */
function ApiConfigModals({ modalState, formProps, testProps, detailProps, certProps }) {
  const { modalOpen, testModalOpen, detailModalOpen, certModalOpen, editingItem, selectedConfig } = modalState;

  return (
    <>
      <Modal isOpen={modalOpen} onClose={formProps.onClose} title={editingItem ? 'Edit API Configuration' : 'Add API Configuration'} size="xl">
        <ApiConfigForm {...formProps.formFields} onSubmit={formProps.onSubmit} onCancel={formProps.onClose} />
      </Modal>

      <Modal isOpen={testModalOpen} onClose={testProps.onClose} title={`Test: ${selectedConfig?.name || ''}`} size="lg">
        <TestResultContent testLoading={testProps.testLoading} testResult={testProps.testResult} onClose={testProps.onClose} />
      </Modal>

      <Modal isOpen={detailModalOpen} onClose={detailProps.onClose} title="API Configuration Details" size="xl">
        <DetailViewContent selectedConfig={selectedConfig} onTest={detailProps.onTest} onEdit={detailProps.onEdit} onClose={detailProps.onClose} />
      </Modal>

      <Modal isOpen={certModalOpen} onClose={certProps.onClose} title="Upload Certificate" size="md">
        <CertUploadContent certFile={certProps.certFile} setCertFile={certProps.setCertFile} certType={certProps.certType} setCertType={certProps.setCertType} onSubmit={certProps.onSubmit} onCancel={certProps.onClose} />
      </Modal>
    </>
  );
}

/* ─── CRUD helpers (outside component to reduce complexity) ─── */
function buildPayloadFromForm(formData, headersJson, paramsJson, bodyJson, authConfigJson, tagsInput) {
  return {
    ...formData,
    headers: JSON.parse(headersJson || '{}'),
    params: JSON.parse(paramsJson || '{}'),
    body: JSON.parse(bodyJson || '{}'),
    auth_config: JSON.parse(authConfigJson || '{}'),
    tags: tagsInput.split(',').map(t => t.trim()).filter(Boolean),
  };
}

function populateJsonFields(item) {
  return {
    headersJson: JSON.stringify(item.headers || {}, null, 2),
    paramsJson: JSON.stringify(item.params || {}, null, 2),
    bodyJson: JSON.stringify(item.body || {}, null, 2),
    authConfigJson: JSON.stringify(item.auth_config || {}, null, 2),
    tagsInput: (item.tags || []).join(', '),
  };
}

/* ─── Data-fetching hook ─── */
function useApiConfigsData(search, filterStatus, filterTag, pagination, setPagination) {
  const [configs, setConfigs] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [gcsStatus, setGcsStatus] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [configsRes, tagsRes] = await Promise.all([
        apiConfigsAPI.list({ search: search || undefined, status: filterStatus || undefined, tags: filterTag || undefined, page: pagination.page, limit: pagination.limit }),
        apiConfigsAPI.getTags(),
      ]);
      setConfigs(configsRes.data.data || []);
      setPagination(prev => ({ ...prev, ...(configsRes.data.pagination || {}) }));
      setTags(tagsRes.data.tags || []);
    } catch {
      toast.error('Failed to load API configurations');
    } finally {
      setLoading(false);
    }
  }, [search, filterStatus, filterTag, pagination.page, pagination.limit, setPagination]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { apiConfigsAPI.getGCSStatus().then(res => setGcsStatus(res.data)).catch(Function.prototype); }, []);

  return { configs, tags, loading, gcsStatus, fetchData };
}

/* ─── CRUD handlers hook ─── */
function useApiConfigsCrud(fetchData, editingItem, formData, headersJson, paramsJson, bodyJson, authConfigJson, tagsInput, resetForm, setModalOpen) {
  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await apiConfigsAPI.create(buildPayloadFromForm(formData, headersJson, paramsJson, bodyJson, authConfigJson, tagsInput));
      toast.success('API configuration created successfully');
      setModalOpen(false); resetForm(); fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create configuration');
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const data = buildPayloadFromForm(formData, headersJson, paramsJson, bodyJson, authConfigJson, tagsInput);
      delete data.key;
      await apiConfigsAPI.update(editingItem._id, data);
      toast.success('API configuration updated successfully');
      setModalOpen(false); resetForm(); fetchData();
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
    } catch { toast.error('Failed to delete configuration'); }
  };

  const handleToggleStatus = async (item) => {
    try {
      await apiConfigsAPI.toggleStatus(item._id);
      toast.success(`Configuration ${item.status === 'active' ? 'deactivated' : 'activated'}`);
      fetchData();
    } catch { toast.error('Failed to toggle status'); }
  };

  return { handleCreate, handleUpdate, handleDelete, handleToggleStatus };
}

/* ─── Test & cert handlers hook ─── */
function useApiConfigsActions(fetchData) {
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [certModalOpen, setCertModalOpen] = useState(false);
  const [certFile, setCertFile] = useState(null);
  const [certType, setCertType] = useState('cert');

  const handleTest = async (item) => {
    setSelectedConfig(item); setTestResult(null); setTestModalOpen(true); setTestLoading(true);
    try {
      const response = await apiConfigsAPI.testById(item._id);
      setTestResult(response.data);
    } catch (error) {
      setTestResult({ success: false, error: error.response?.data?.detail || error.message || 'Test failed' });
    } finally { setTestLoading(false); }
  };

  const handleViewDetails = (item) => { setSelectedConfig(item); setDetailModalOpen(true); };

  const handleUploadCert = async (e) => {
    e.preventDefault();
    if (!certFile || !selectedConfig) return;
    const formDataUpload = new FormData();
    formDataUpload.append('file', certFile);
    formDataUpload.append('cert_type', certType);
    try {
      await apiConfigsAPI.uploadCert(selectedConfig._id, formDataUpload);
      toast.success('Certificate uploaded successfully');
      setCertModalOpen(false); setCertFile(null); fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to upload certificate');
    }
  };

  const openCertModal = (item) => { setSelectedConfig(item); setCertFile(null); setCertType('cert'); setCertModalOpen(true); };

  return {
    selectedConfig, testResult, testLoading, testModalOpen, setTestModalOpen,
    detailModalOpen, setDetailModalOpen, certModalOpen, setCertModalOpen,
    certFile, setCertFile, certType, setCertType,
    handleTest, handleViewDetails, handleUploadCert, openCertModal,
  };
}

/* ═══════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════ */
const ApiConfigsManagement = () => {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [pagination, setPagination] = useState({ page: 0, limit: DEFAULT_PAGE_LIMIT, total: 0, pages: 0 });

  const [formData, setFormData] = useState(getDefaultFormData());
  const [headersJson, setHeadersJson] = useState('{}');
  const [paramsJson, setParamsJson] = useState('{}');
  const [bodyJson, setBodyJson] = useState('{}');
  const [authConfigJson, setAuthConfigJson] = useState('{}');
  const [tagsInput, setTagsInput] = useState('');

  const resetPage = useCallback(() => setPagination(prev => ({ ...prev, page: 0 })), []);

  const { configs, tags, loading, gcsStatus, fetchData } = useApiConfigsData(search, filterStatus, filterTag, pagination, setPagination);

  const resetForm = () => {
    setFormData(getDefaultFormData());
    setHeadersJson('{}'); setParamsJson('{}'); setBodyJson('{}');
    setAuthConfigJson('{}'); setTagsInput(''); setEditingItem(null);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setFormData(buildFormDataFromItem(item));
    const fields = populateJsonFields(item);
    setHeadersJson(fields.headersJson);
    setParamsJson(fields.paramsJson);
    setBodyJson(fields.bodyJson);
    setAuthConfigJson(fields.authConfigJson);
    setTagsInput(fields.tagsInput);
    setModalOpen(true);
  };

  const crud = useApiConfigsCrud(fetchData, editingItem, formData, headersJson, paramsJson, bodyJson, authConfigJson, tagsInput, resetForm, setModalOpen);
  const actions = useApiConfigsActions(fetchData);

  const handlePageChange = (newPage) => setPagination(prev => ({ ...prev, page: newPage }));

  const columns = buildColumns({ handleTest: actions.handleTest, handleViewDetails: actions.handleViewDetails, openEditModal, gcsStatus, openCertModal: actions.openCertModal, handleToggleStatus: crud.handleToggleStatus, handleDelete: crud.handleDelete });

  const handleSearchChange = (val) => { setSearch(val); resetPage(); };
  const handleFilterStatusChange = (e) => { setFilterStatus(e.target.value); resetPage(); };
  const handleFilterTagChange = (e) => { setFilterTag(e.target.value); resetPage(); };

  const closeFormModal = () => { setModalOpen(false); resetForm(); };

  const modalState = { modalOpen, testModalOpen: actions.testModalOpen, detailModalOpen: actions.detailModalOpen, certModalOpen: actions.certModalOpen, editingItem, selectedConfig: actions.selectedConfig };

  const formProps = {
    onClose: closeFormModal,
    onSubmit: editingItem ? crud.handleUpdate : crud.handleCreate,
    formFields: {
      formData, setFormData, editingItem,
      headersJson, setHeadersJson, paramsJson, setParamsJson,
      bodyJson, setBodyJson, authConfigJson, setAuthConfigJson,
      tagsInput, setTagsInput,
    },
  };

  const testProps = { testLoading: actions.testLoading, testResult: actions.testResult, onClose: () => actions.setTestModalOpen(false) };
  const detailProps = { onTest: actions.handleTest, onEdit: (config) => { actions.setDetailModalOpen(false); openEditModal(config); }, onClose: () => actions.setDetailModalOpen(false) };
  const certProps = { certFile: actions.certFile, setCertFile: actions.setCertFile, certType: actions.certType, setCertType: actions.setCertType, onSubmit: actions.handleUploadCert, onClose: () => actions.setCertModalOpen(false) };

  return (
    <div className="space-y-6">
      <ApiConfigsHeader total={pagination.total} gcsStatus={gcsStatus} onAddNew={() => { resetForm(); setModalOpen(true); }} />

      <ApiConfigsStats configs={configs} total={pagination.total} filterStatus={filterStatus} filterTag={filterTag} />

      <ApiConfigsFilters
        search={search} onSearchChange={handleSearchChange}
        filterStatus={filterStatus} onFilterStatusChange={handleFilterStatusChange}
        filterTag={filterTag} onFilterTagChange={handleFilterTagChange}
        tags={tags}
        onClear={() => { setFilterStatus(''); setFilterTag(''); resetPage(); }}
      />

      <Card>
        <Table columns={columns} data={configs} loading={loading} />
        {pagination.pages > 1 && (
          <Pagination currentPage={pagination.page} totalPages={pagination.pages} total={pagination.total} limit={pagination.limit} onPageChange={handlePageChange} />
        )}
      </Card>

      <ApiConfigModals modalState={modalState} formProps={formProps} testProps={testProps} detailProps={detailProps} certProps={certProps} />
    </div>
  );
};

export default ApiConfigsManagement;
