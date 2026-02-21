import axios from 'axios';

// Use relative path - Vite dev server proxies /api to backend
// In production, nginx handles the proxy
const API_BASE_URL = '/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Required for CSRF cookies
});

// CSRF token management
let csrfToken = null;

// Helper to get cookie value by name
const getCookie = (name) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
};

const fetchCSRFToken = async () => {
  try {
    // First try to read directly from cookie (if not httpOnly)
    let token = getCookie('csrf_token');
    if (token) {
      csrfToken = token;
      return csrfToken;
    }

    // Fallback: call the API endpoint to get/set the token
    let response = await axios.get(`${API_BASE_URL}/auth/csrf-token`, {
      withCredentials: true
    });

    // If no token returned, retry (first call sets cookie)
    if (!response.data.csrf_token) {
      response = await axios.get(`${API_BASE_URL}/auth/csrf-token`, {
        withCredentials: true
      });
    }

    // Try reading from cookie again after API call sets it
    token = getCookie('csrf_token');
    if (token) {
      csrfToken = token;
      return csrfToken;
    }

    csrfToken = response.data.csrf_token;
    return csrfToken;
  } catch (error) {
    console.error('Failed to fetch CSRF token:', error);
    return null;
  }
};

// Request interceptor for CSRF token (auth tokens are sent via httpOnly cookies)
api.interceptors.request.use(
  async (config) => {
    // Auth tokens are sent automatically as httpOnly cookies (withCredentials: true)

    // Add CSRF token for state-changing requests
    const needsCSRF = ['post', 'put', 'delete', 'patch'].includes(config.method?.toLowerCase());
    if (needsCSRF) {
      if (!csrfToken) {
        await fetchCSRFToken();
      }
      if (csrfToken) {
        config.headers['X-CSRF-Token'] = csrfToken;
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for token refresh and CSRF errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Don't retry if the request was aborted (e.g., by AbortController timeout)
    if (error.code === 'ERR_CANCELED' || error.name === 'CanceledError') {
      return Promise.reject(error);
    }

    // Handle 401 Unauthorized - refresh JWT token via httpOnly cookie
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Refresh token is sent automatically via httpOnly cookie
        await axios.post(`${API_BASE_URL}/auth/refresh`, {}, {
          withCredentials: true,
          timeout: 10000
        });

        // New tokens are set as httpOnly cookies by the backend
        return api(originalRequest);
      } catch (refreshError) {
        // Only redirect if we're not already on the login page
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }

    // Handle 403 CSRF errors - refresh CSRF token and retry
    const errorDetail = error.response?.data?.detail || error.response?.data?.error || '';
    if (error.response?.status === 403 &&
        (errorDetail.includes('CSRF') || errorDetail.includes('csrf')) &&
        !originalRequest._csrfRetry) {
      originalRequest._csrfRetry = true;

      // Clear existing token to force refresh
      csrfToken = null;

      // Make a GET request to force backend to issue a new cookie
      try {
        await axios.get(`${API_BASE_URL}/auth/csrf-token`, { withCredentials: true });
      } catch (e) {
        // Ignore errors, the cookie might still be set
      }

      // Fetch the new CSRF token from cookie
      await fetchCSRFToken();

      // Retry with new token
      if (csrfToken) {
        originalRequest.headers['X-CSRF-Token'] = csrfToken;
        return api(originalRequest);
      }
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (data) => api.post('/auth/register', data),
  logout: () => api.post('/auth/logout'),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (data) => api.put('/auth/profile', data),
  forgotPassword: (email, reset_url) => api.post('/auth/forgot_password', { email, reset_url }),
  resetPassword: (token, new_password) => api.post('/auth/reset_password', { token, new_password }),
  updatePassword: (password, new_password) => api.post('/auth/update_password', { password, new_password }),
};

// Admin API
export const adminAPI = {
  getUsers: (params = {}) => api.get('/admin/management/users', { params }),
  getUser: (userId) => api.get(`/admin/management/users/${userId}`),
  updateUserStatus: (userId, is_active) => api.put(`/admin/management/users/${userId}/status`, { is_active }),
  updateUserRoles: (userId, roles) => api.put(`/admin/management/users/${userId}/roles`, { roles }),
  updateUserGroups: (userId, groups) => api.put(`/admin/management/users/${userId}/groups`, { groups }),
  updateUserDomains: (userId, domains) => api.put(`/admin/management/users/${userId}/domains`, { domains }),
  deleteUser: (userId) => api.delete(`/admin/management/users/${userId}`),
};

// Users API (scratch-3 compatible)
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

// Roles API (scratch-3 compatible)
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

// Permissions API (scratch-3 compatible)
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

// Customers API (scratch-3 compatible)
export const customersAPI = {
  list: (params = {}) => api.get('/customers', { params }),
  count: (params = {}) => api.get('/customers/count', { params }),
  getFilters: () => api.get('/customers/filters'),
  get: (id) => api.get(`/customers/${id}`),
  create: (data) => api.post('/customers', data),
  update: (id, data) => api.put(`/customers/${id}`, data),
  delete: (id) => api.delete(`/customers/${id}`),
  toggleStatus: (id) => api.post(`/customers/${id}/toggle-status`),
  getUsers: (id) => api.get(`/customers/${id}/users`),
  assignUsers: (id, userIds) => api.post(`/customers/${id}/assign-users`, userIds),
  removeUsers: (id, userIds) => api.post(`/customers/${id}/remove-users`, userIds),
};

// Domain API (scratch-3 compatible)
export const domainAPI = {
  getAll: () => api.get('/domains/all'),  // Returns user-accessible domains only
  getAllAdmin: () => api.get('/domains/admin/all'),  // Returns all domains (admin only)
  getTypes: () => api.get('/domains/types'),  // Returns domain types from DomainTypes enum
  get: (key) => api.get(`/domains/${key}`),
  create: (data) => api.post('/domains', data),
  update: (key, data) => api.put(`/domains/${key}`, data),
  delete: (key) => api.delete(`/domains/${key}`),
};

// Domains API (scratch-3 compatible with pagination)
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

// Scenario API (legacy)
export const scenarioAPI = {
  getAll: () => api.get('/scenarios/all'),
  getByDomain: (domainKey) => api.get(`/scenarios/all/${domainKey}`),
  get: (key) => api.get(`/scenarios/${key}`),
  create: (data) => api.post('/scenarios', data),
  update: (key, data) => api.put(`/scenarios/${key}`, data),
  delete: (key) => api.delete(`/scenarios/${key}`),
};

// Domain Scenarios API (scratch-3 compatible)
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

// Playboard API (legacy)
export const playboardAPI = {
  getAll: () => api.get('/playboards/all'),
  getByDomain: (domainKey) => api.get(`/playboards/all/${domainKey}`),
  get: (key) => api.get(`/playboards/${key}`),
  create: (data) => api.post('/playboards', data),
  update: (key, data) => api.put(`/playboards/${key}`, data),
  delete: (key) => api.delete(`/playboards/${key}`),
};

// Playboards API (scratch-3 compatible)
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

// Configurations API (scratch-3 compatible)
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

// Feedback API
export const feedbackAPI = {
  getAll: () => api.get('/feedback/all'),
  get: (id) => api.get(`/feedback/${id}`),
  create: (data) => api.post('/feedback', data),
  update: (id, data) => api.put(`/feedback/${id}`, data),
  // Public feedback (no auth required)
  submitPublic: (data) => api.post('/feedback/public', data),
  // Admin endpoints
  getAdminList: (params = {}) => api.get('/feedback/admin/list', { params }),
  getStats: () => api.get('/feedback/stats'),
};

// Dashboard API
export const dashboardAPI = {
  getStats: () => api.get('/dashboard/stats'),
  getSummary: () => api.get('/dashboard/summary'),
  getRecentLogins: (limit = 10) => api.get('/dashboard/recent-logins', { params: { limit } }),
  getAnalytics: () => api.get('/dashboard/analytics'),
};

// Groups API (scratch-3 compatible)
export const groupsAPI = {
  list: (params = {}) => api.get('/groups', { params }),
  count: (params = {}) => api.get('/groups/count', { params }),
  getTypes: () => api.get('/groups/types'),
  get: (id) => api.get(`/groups/${id}`),
  create: (data) => api.post('/groups', data),
  update: (id, data) => api.put(`/groups/${id}`, data),
  delete: (id) => api.delete(`/groups/${id}`),
  toggleStatus: (id) => api.post(`/groups/${id}/toggle-status`),
  getUsers: (id) => api.get(`/groups/${id}/users`),
};

// Activity Logs API
export const activityLogsAPI = {
  list: (params = {}) => api.get('/activity-logs', { params }),
  getStats: (days = 7) => api.get('/activity-logs/stats', { params: { days } }),
  getActions: () => api.get('/activity-logs/actions'),
  getEntityTypes: () => api.get('/activity-logs/entity-types'),
  getEntityHistory: (entityType, entityId) => api.get(`/activity-logs/entity/${entityType}/${entityId}`),
  getUserActivity: (userEmail, params = {}) => api.get(`/activity-logs/user/${userEmail}`, { params }),
};

// Error Logs API
export const errorLogsAPI = {
  list: (params = {}) => api.get('/error-logs', { params }),
  getStats: (days = 7) => api.get('/error-logs/stats', { params: { days } }),
  getLevels: () => api.get('/error-logs/levels'),
  getTypes: () => api.get('/error-logs/types'),
  getCurrentFile: (lines = 100) => api.get('/error-logs/current-file', { params: { lines } }),

  // Archives
  listArchives: () => api.get('/error-logs/archives'),
  getArchiveDownloadUrl: (archiveId, expirationMinutes = 60) =>
    api.get(`/error-logs/archives/${archiveId}/download`, { params: { expiration_minutes: expirationMinutes } }),
  deleteArchive: (archiveId) => api.delete(`/error-logs/archives/${archiveId}`),
  forceArchive: () => api.post('/error-logs/force-archive'),
  cleanup: (days = 90) => api.delete('/error-logs/cleanup', { params: { days } }),
};

// Bulk Upload API
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
  getGCSStatus: () => api.get('/bulk/gcs/status'),
  listGCSFiles: (prefix = '', bucketName = null) =>
    api.get('/bulk/gcs/list', { params: { prefix, bucket_name: bucketName } }),
};

// Export API (scratch-3 compatible)
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
  scenarios: {
    csv: (params = {}) => api.get('/export/scenarios/csv', { params, responseType: 'blob' }),
    json: (params = {}) => api.get('/export/scenarios/json', { params, responseType: 'blob' }),
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

// Scenario Request API
export const scenarioRequestAPI = {
  // CRUD operations
  getAll: (params = {}) => api.get('/ask_scenarios/all', { params }),
  get: (requestId) => api.get(`/ask_scenarios/${requestId}`),
  create: (data) => api.post('/ask_scenarios', data),
  update: (requestId, data) => api.put(`/ask_scenarios/${requestId}`, data),
  adminUpdate: (requestId, data) => api.put(`/ask_scenarios/${requestId}/admin`, data),
  
  // Lookup endpoints
  getStatuses: () => api.get('/ask_scenarios/lookup/statuses'),
  getRequestTypes: () => api.get('/ask_scenarios/lookup/request_types'),
  getDomains: () => api.get('/ask_scenarios/lookup/domains'),
  getDefaults: () => api.get('/ask_scenarios/lookup/defaults'),
  searchUsers: (query) => api.get('/ask_scenarios/lookup/users', { params: { q: query } }),
  
  // Comments and Workflow
  addComment: (requestId, comment) => {
    const formData = new FormData();
    formData.append('comment', comment);
    return api.post(`/ask_scenarios/${requestId}/comment`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  addWorkflow: (requestId, data) => {
    const formData = new FormData();
    if (data.assigned_to) formData.append('assigned_to', data.assigned_to);
    if (data.to_status) formData.append('to_status', data.to_status);
    if (data.comment) formData.append('comment', data.comment);
    return api.post(`/ask_scenarios/${requestId}/workflow`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  updateStatus: (requestId, status, comment = '') => {
    const formData = new FormData();
    formData.append('new_status', status);
    if (comment) formData.append('comment', comment);
    return api.put(`/ask_scenarios/${requestId}/status`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  
  // File operations
  uploadFile: (requestId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/ask_scenarios/${requestId}/files`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  uploadBucketFile: (requestId, file, comment = '') => {
    const formData = new FormData();
    formData.append('file', file);
    if (comment) {
      formData.append('comment', comment);
    }
    return api.post(`/ask_scenarios/${requestId}/buckets`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  previewFile: (requestId, filePath) => api.get(`/ask_scenarios/${requestId}/files/${encodeURIComponent(filePath)}/preview`),
  downloadFile: (requestId, filePath) => api.get(`/ask_scenarios/${requestId}/files/${encodeURIComponent(filePath)}/download`, {
    responseType: 'blob'
  }),
  
  // Stats for dashboard
  getStats: async () => {
    try {
      const response = await api.get('/ask_scenarios/all', { params: { limit: 1000 } });
      const data = response.data?.data || [];

      const stats = {
        total: data.length,
        submitted: data.filter(r => r.status === 'submitted').length,
        inProgress: data.filter(r => ['in-progress', 'development', 'review', 'testing', 'accepted'].includes(r.status)).length,
        deployed: data.filter(r => ['deployed', 'active', 'snapshot'].includes(r.status)).length,
        rejected: data.filter(r => ['rejected', 'inactive'].includes(r.status)).length,
        recent: data.slice(0, 5)
      };
      return { data: stats };
    } catch (error) {
      return { data: { total: 0, submitted: 0, inProgress: 0, deployed: 0, rejected: 0, recent: [] } };
    }
  },

  // Jira link operations
  addJiraLink: (requestId, jiraLink) => api.put(`/ask_scenarios/${requestId}/admin`, {
    jira_links: [jiraLink]
  }),
  removeJiraLink: (requestId, linkIndex) => api.put(`/ask_scenarios/${requestId}/admin`, {
    remove_jira_link_index: linkIndex
  })
};

// API Configurations API
export const apiConfigsAPI = {
  list: (params = {}) => api.get('/api-configs', { params }),
  count: (params = {}) => api.get('/api-configs/count', { params }),
  getTags: () => api.get('/api-configs/tags'),
  get: (id) => api.get(`/api-configs/${id}`),
  getByKey: (key) => api.get(`/api-configs/key/${key}`),
  create: (data) => api.post('/api-configs', data),
  update: (id, data) => api.put(`/api-configs/${id}`, data),
  delete: (id) => api.delete(`/api-configs/${id}`),
  toggleStatus: (id) => api.post(`/api-configs/${id}/toggle-status`),
  test: (data) => api.post('/api-configs/test', data),
  testById: (id, params = {}) => api.post(`/api-configs/${id}/test`, params),
  uploadCert: (id, formData) =>
    api.post(`/api-configs/${id}/upload-cert`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getGCSStatus: () => api.get('/api-configs/gcs/status'),
};

// Distribution Lists API
export const distributionListsAPI = {
  list: (params = {}) => api.get('/distribution-lists', { params }),
  getTypes: () => api.get('/distribution-lists/types'),
  get: (id) => api.get(`/distribution-lists/${id}`),
  getByKey: (key) => api.get(`/distribution-lists/by-key/${key}`),
  getByType: (type) => api.get(`/distribution-lists/by-type/${type}`),
  getEmails: (key) => api.get(`/distribution-lists/emails/${key}`),
  create: (data) => api.post('/distribution-lists', data),
  update: (id, data) => api.put(`/distribution-lists/${id}`, data),
  delete: (id, hardDelete = false) => api.delete(`/distribution-lists/${id}`, { params: { hard_delete: hardDelete } }),
  toggleStatus: (id) => api.post(`/distribution-lists/${id}/toggle-status`),
  addEmail: (id, email) => api.post(`/distribution-lists/${id}/emails`, { email }),
  removeEmail: (id, email) => api.delete(`/distribution-lists/${id}/emails`, { data: { email } }),
};

// Jira API
export const jiraAPI = {
  // Connection status
  getStatus: () => api.get('/jira/status'),

  // Projects
  getProjects: () => api.get('/jira/projects'),
  getLatestProject: () => api.get('/jira/projects/latest'),

  // Tasks
  getMyTasks: (params = {}) => api.get('/jira/tasks/my', { params }),
  getTasksByRequest: (requestId, projectKey = null) =>
    api.get(`/jira/tasks/by-request/${requestId}`, { params: { project_key: projectKey } }),

  // Create/Sync
  createTask: (scenarioRequestId, projectKey = null, issueType = null) =>
    api.post('/jira/tasks/create', {
      scenario_request_id: scenarioRequestId,
      project_key: projectKey,
      issue_type: issueType
    }),
  syncRequest: (requestId, projectKey = null) =>
    api.post(`/jira/sync/request/${requestId}`, null, { params: { project_key: projectKey } }),

  // Transitions
  transitionTask: (ticketKey, status) =>
    api.post('/jira/tasks/transition', { ticket_key: ticketKey, status }),

  // Attachments
  addAttachment: (ticketKey, fileUrl, fileName) =>
    api.post('/jira/attachments/add', { ticket_key: ticketKey, file_url: fileUrl, file_name: fileName }),

  // Lookups
  getIssueTypes: (projectKey = null) => api.get('/jira/issue-types', { params: { project_key: projectKey } }),
  getStatuses: (projectKey = null) => api.get('/jira/statuses', { params: { project_key: projectKey } }),

  // Boards (teams) and assignable users
  getBoards: (projectKey = null) => api.get('/jira/boards', { params: { project_key: projectKey } }),
  getAssignableUsers: (projectKey = null, query = null, maxResults = 50) =>
    api.get('/jira/assignable-users', { params: { project_key: projectKey, q: query, max_results: maxResults } })
};

export default api;
