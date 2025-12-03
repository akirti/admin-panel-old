import axios from 'axios';

const API_BASE_URL = '/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
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
            }
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
  getAll: (params = {}) => api.get('/ask_scenarios/all', { params }),
  get: (requestId) => api.get(`/ask_scenarios/${requestId}`),
  create: (data) => api.post('/ask_scenarios', data),
  update: (requestId, data) => api.put(`/ask_scenarios/${requestId}`, data),
};

export default api;
