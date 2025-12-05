import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth APIs
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  getCurrentUser: () => api.get('/auth/me'),
  changePassword: (currentPassword, newPassword) =>
    api.post('/auth/change-password', { current_password: currentPassword, new_password: newPassword }),
  requestPasswordReset: (email, sendEmail = true) =>
    api.post('/auth/request-password-reset', { email, send_email: sendEmail }),
  updateProfile: (username, fullName) =>
    api.put('/auth/profile', null, { params: { username, full_name: fullName } }),
};

// Dashboard APIs
export const dashboardAPI = {
  getStats: () => api.get('/dashboard/stats'),
  getSummary: () => api.get('/dashboard/summary'),
  getRecentLogins: (limit = 10) => api.get('/dashboard/recent-logins', { params: { limit } }),
  getAnalytics: () => api.get('/dashboard/analytics'),
};

// Users APIs
export const usersAPI = {
  list: (params = {}) => api.get('/users', { params }),
  count: (params = {}) => api.get('/users/count', { params }),
  get: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
  toggleStatus: (id) => api.post(`/users/${id}/toggle-status`),
  sendPasswordReset: (id, sendEmail = true) =>
    api.post(`/users/${id}/send-password-reset`, null, { params: { send_email: sendEmail } }),
  adminResetPassword: (id, sendEmail = true) =>
    api.post(`/users/${id}/reset-password`, null, { params: { send_email: sendEmail } }),
};

// Roles APIs
export const rolesAPI = {
  list: (params = {}) => api.get('/roles', { params }),
  count: (params = {}) => api.get('/roles/count', { params }),
  get: (id) => api.get(`/roles/${id}`),
  create: (data) => api.post('/roles', data),
  update: (id, data) => api.put(`/roles/${id}`, data),
  delete: (id) => api.delete(`/roles/${id}`),
  toggleStatus: (id) => api.post(`/roles/${id}/toggle-status`),
  getUsers: (id) => api.get(`/roles/${id}/users`),
};

// Groups APIs
export const groupsAPI = {
  list: (params = {}) => api.get('/groups', { params }),
  count: (params = {}) => api.get('/groups/count', { params }),
  get: (id) => api.get(`/groups/${id}`),
  create: (data) => api.post('/groups', data),
  update: (id, data) => api.put(`/groups/${id}`, data),
  delete: (id) => api.delete(`/groups/${id}`),
  toggleStatus: (id) => api.post(`/groups/${id}/toggle-status`),
  getUsers: (id) => api.get(`/groups/${id}/users`),
};

// Permissions APIs
export const permissionsAPI = {
  list: (params = {}) => api.get('/permissions', { params }),
  getModules: () => api.get('/permissions/modules'),
  count: (params = {}) => api.get('/permissions/count', { params }),
  get: (id) => api.get(`/permissions/${id}`),
  create: (data) => api.post('/permissions', data),
  update: (id, data) => api.put(`/permissions/${id}`, data),
  delete: (id) => api.delete(`/permissions/${id}`),
  getRoles: (id) => api.get(`/permissions/${id}/roles`),
  getGroups: (id) => api.get(`/permissions/${id}/groups`),
};

// Customers APIs
export const customersAPI = {
  list: (params = {}) => api.get('/customers', { params }),
  count: (params = {}) => api.get('/customers/count', { params }),
  get: (id) => api.get(`/customers/${id}`),
  create: (data) => api.post('/customers', data),
  update: (id, data) => api.put(`/customers/${id}`, data),
  delete: (id) => api.delete(`/customers/${id}`),
  toggleStatus: (id) => api.post(`/customers/${id}/toggle-status`),
  getUsers: (id) => api.get(`/customers/${id}/users`),
  assignUsers: (id, userIds) => api.post(`/customers/${id}/assign-users`, userIds),
  removeUsers: (id, userIds) => api.post(`/customers/${id}/remove-users`, userIds),
};

// Domains APIs
export const domainsAPI = {
  list: (params = {}) => api.get('/domains', { params }),
  count: (params = {}) => api.get('/domains/count', { params }),
  get: (id) => api.get(`/domains/${id}`),
  create: (data) => api.post('/domains', data),
  update: (id, data) => api.put(`/domains/${id}`, data),
  delete: (id) => api.delete(`/domains/${id}`),
  toggleStatus: (id) => api.post(`/domains/${id}/toggle-status`),
  addSubdomain: (id, data) => api.post(`/domains/${id}/subdomains`, data),
  removeSubdomain: (id, subdomainKey) => api.delete(`/domains/${id}/subdomains/${subdomainKey}`),
  getScenarios: (id) => api.get(`/domains/${id}/scenarios`),
};

// Domain Scenarios APIs
export const scenariosAPI = {
  list: (params = {}) => api.get('/domain-scenarios', { params }),
  count: (params = {}) => api.get('/domain-scenarios/count', { params }),
  get: (id) => api.get(`/domain-scenarios/${id}`),
  create: (data) => api.post('/domain-scenarios', data),
  update: (id, data) => api.put(`/domain-scenarios/${id}`, data),
  delete: (id) => api.delete(`/domain-scenarios/${id}`),
  toggleStatus: (id) => api.post(`/domain-scenarios/${id}/toggle-status`),
  getPlayboards: (id) => api.get(`/domain-scenarios/${id}/playboards`),
};

// Playboards APIs
export const playboardsAPI = {
  list: (params = {}) => api.get('/playboards', { params }),
  count: (params = {}) => api.get('/playboards/count', { params }),
  get: (id) => api.get(`/playboards/${id}`),
  create: (data) => api.post('/playboards', data),
  upload: (formData, params) =>
    api.post('/playboards/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      params,
    }),
  update: (id, data) => api.put(`/playboards/${id}`, data),
  updateJson: (id, formData) =>
    api.put(`/playboards/${id}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  delete: (id) => api.delete(`/playboards/${id}`),
  toggleStatus: (id) => api.post(`/playboards/${id}/toggle-status`),
  download: (id) => api.get(`/playboards/${id}/download`),
};

// Bulk Upload APIs
export const bulkAPI = {
  upload: (entityType, formData, sendPasswordEmails = true) =>
    api.post(`/bulk/upload/${entityType}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      params: { send_password_emails: sendPasswordEmails },
    }),
  getTemplate: (entityType, format = 'xlsx') =>
    api.get(`/bulk/template/${entityType}`, {
      params: { format },
      responseType: 'blob',
    }),
  uploadFromGCS: (entityType, data, sendPasswordEmails = true) =>
    api.post(`/bulk/gcs/upload/${entityType}`, data, {
      params: { send_password_emails: sendPasswordEmails },
    }),
  listGCSFiles: (prefix = '', bucketName = null) =>
    api.get('/bulk/gcs/list', { params: { prefix, bucket_name: bucketName } }),
  getGCSStatus: () => api.get('/bulk/gcs/status'),
};

// Configurations APIs
export const configurationsAPI = {
  list: (params = {}) => api.get('/configurations', { params }),
  count: (params = {}) => api.get('/configurations/count', { params }),
  getTypes: () => api.get('/configurations/types'),
  get: (id) => api.get(`/configurations/${id}`),
  create: (data) => api.post('/configurations', data),
  update: (id, data) => api.put(`/configurations/${id}`, data),
  delete: (id) => api.delete(`/configurations/${id}`),
  upload: (formData, key, configType = null) =>
    api.post('/configurations/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  download: (id, version = null) =>
    api.get(`/configurations/${id}/download`, {
      params: version ? { version } : {},
      responseType: 'blob',
    }),
  downloadJson: (id) => api.get(`/configurations/${id}/download`),
  getVersions: (id) => api.get(`/configurations/${id}/versions`),
};

// Export APIs
export const exportAPI = {
  users: {
    csv: (params = {}) => api.get('/export/users/csv', { params, responseType: 'blob' }),
    json: (params = {}) => api.get('/export/users/json', { params, responseType: 'blob' }),
  },
  roles: {
    csv: (params = {}) => api.get('/export/roles/csv', { params, responseType: 'blob' }),
    json: (params = {}) => api.get('/export/roles/json', { params, responseType: 'blob' }),
  },
  groups: {
    csv: (params = {}) => api.get('/export/groups/csv', { params, responseType: 'blob' }),
    json: (params = {}) => api.get('/export/groups/json', { params, responseType: 'blob' }),
  },
  customers: {
    csv: (params = {}) => api.get('/export/customers/csv', { params, responseType: 'blob' }),
    json: (params = {}) => api.get('/export/customers/json', { params, responseType: 'blob' }),
  },
  domains: {
    csv: (params = {}) => api.get('/export/domains/csv', { params, responseType: 'blob' }),
    json: (params = {}) => api.get('/export/domains/json', { params, responseType: 'blob' }),
  },
  activityLogs: {
    csv: (params = {}) => api.get('/export/activity-logs/csv', { params, responseType: 'blob' }),
    json: (params = {}) => api.get('/export/activity-logs/json', { params, responseType: 'blob' }),
  },
  permissions: {
    csv: (params = {}) => api.get('/export/permissions/csv', { params, responseType: 'blob' }),
    json: (params = {}) => api.get('/export/permissions/json', { params, responseType: 'blob' }),
  },
};

export default api;
