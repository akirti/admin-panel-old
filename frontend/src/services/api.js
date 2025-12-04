import axios from 'axios';

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

const fetchCSRFToken = async () => {
  try {
    // First call sets the cookie, second call returns the token
    let response = await axios.get(`${API_BASE_URL}/auth/csrf-token`, {
      withCredentials: true
    });

    // If no token returned, retry (first call sets cookie)
    if (!response.data.csrf_token) {
      response = await axios.get(`${API_BASE_URL}/auth/csrf-token`, {
        withCredentials: true
      });
    }

    csrfToken = response.data.csrf_token;
    return csrfToken;
  } catch (error) {
    console.error('Failed to fetch CSRF token:', error);
    return null;
  }
};

// Request interceptor for auth token and CSRF token
api.interceptors.request.use(
  async (config) => {
    // Add auth token
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

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

    // Handle 401 Unauthorized - refresh JWT token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refresh_token: refreshToken
          }, {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('access_token')}`
            },
            withCredentials: true
          });

          const { access_token, refresh_token } = response.data;
          localStorage.setItem('access_token', access_token);
          localStorage.setItem('refresh_token', refresh_token);

          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }

    // Handle 403 CSRF errors - refresh CSRF token and retry
    if (error.response?.status === 403 &&
        error.response?.data?.error?.includes('CSRF') &&
        !originalRequest._csrfRetry) {
      originalRequest._csrfRetry = true;

      // Fetch new CSRF token
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

// Domain API
export const domainAPI = {
  getAll: () => api.get('/domains/all'),
  get: (key) => api.get(`/domains/${key}`),
  create: (data) => api.post('/domains', data),
  update: (key, data) => api.put(`/domains/${key}`, data),
  delete: (key) => api.delete(`/domains/${key}`),
};

// Scenario API
export const scenarioAPI = {
  getAll: () => api.get('/scenarios/all'),
  getByDomain: (domainKey) => api.get(`/scenarios/all/${domainKey}`),
  get: (key) => api.get(`/scenarios/${key}`),
  create: (data) => api.post('/scenarios', data),
  update: (key, data) => api.put(`/scenarios/${key}`, data),
  delete: (key) => api.delete(`/scenarios/${key}`),
};

// Playboard API
export const playboardAPI = {
  getAll: () => api.get('/playboards/all'),
  getByDomain: (domainKey) => api.get(`/playboards/all/${domainKey}`),
  get: (key) => api.get(`/playboards/${key}`),
  create: (data) => api.post('/playboards', data),
  update: (key, data) => api.put(`/playboards/${key}`, data),
  delete: (key) => api.delete(`/playboards/${key}`),
};

// Feedback API
export const feedbackAPI = {
  getAll: () => api.get('/feedback/all'),
  get: (id) => api.get(`/feedback/${id}`),
  create: (data) => api.post('/feedback', data),
  update: (id, data) => api.put(`/feedback/${id}`, data),
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
  }
};

export default api;
