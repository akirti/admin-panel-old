import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Axios mock setup ---
// Use vi.hoisted() so these values exist when the hoisted vi.mock factory runs.
const {
  callableMockApi,
  mockApiInstance,
  getInterceptors,
} = vi.hoisted(() => {
  let reqFulfilled, reqRejected, resFulfilled, resRejected;

  const instance = {
    get: vi.fn(() => Promise.resolve({ data: {} })),
    post: vi.fn(() => Promise.resolve({ data: {} })),
    put: vi.fn(() => Promise.resolve({ data: {} })),
    delete: vi.fn(() => Promise.resolve({ data: {} })),
    patch: vi.fn(() => Promise.resolve({ data: {} })),
    interceptors: {
      request: {
        use: vi.fn((fulfilled, rejected) => {
          reqFulfilled = fulfilled;
          reqRejected = rejected;
        }),
      },
      response: {
        use: vi.fn((fulfilled, rejected) => {
          resFulfilled = fulfilled;
          resRejected = rejected;
        }),
      },
    },
    defaults: { headers: { common: {} } },
  };

  // Make the mock instance callable (for retrying requests like `api(originalRequest)`)
  const callable = Object.assign(
    vi.fn(() => Promise.resolve({ data: {} })),
    instance
  );

  return {
    callableMockApi: callable,
    mockApiInstance: instance,
    getInterceptors: () => ({
      requestFulfilled: reqFulfilled,
      requestRejected: reqRejected,
      responseFulfilled: resFulfilled,
      responseRejected: resRejected,
    }),
  };
});

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => callableMockApi),
    get: vi.fn(() => Promise.resolve({ data: {} })),
    post: vi.fn(() => Promise.resolve({ data: {} })),
  },
}));

vi.mock('../config/env', () => ({
  API_BASE_URL: '/api/v1',
}));

// Import after mocks are set up (vi.mock is hoisted)
import api, {
  authAPI, adminAPI, usersAPI, rolesAPI, permissionsAPI,
  groupsAPI, customersAPI, domainAPI, domainsAPI,
  scenarioAPI, scenariosAPI, playboardAPI, playboardsAPI,
  configurationsAPI, feedbackAPI, dashboardAPI,
  activityLogsAPI, errorLogsAPI, bulkAPI, exportAPI,
  scenarioRequestAPI, apiConfigsAPI, distributionListsAPI, jiraAPI,
} from './api.js';

import axios from 'axios';

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(document, 'cookie', {
    writable: true,
    value: '',
  });
});

// ─── API Exports ─────────────────────────────────────────────────────────────

describe('API module exports', () => {
  it('exports a default api instance', () => {
    expect(api).toBeDefined();
  });

  it.each([
    ['authAPI', authAPI],
    ['adminAPI', adminAPI],
    ['usersAPI', usersAPI],
    ['rolesAPI', rolesAPI],
    ['permissionsAPI', permissionsAPI],
    ['groupsAPI', groupsAPI],
    ['customersAPI', customersAPI],
    ['domainAPI', domainAPI],
    ['domainsAPI', domainsAPI],
    ['scenarioAPI', scenarioAPI],
    ['scenariosAPI', scenariosAPI],
    ['playboardAPI', playboardAPI],
    ['playboardsAPI', playboardsAPI],
    ['configurationsAPI', configurationsAPI],
    ['feedbackAPI', feedbackAPI],
    ['dashboardAPI', dashboardAPI],
    ['activityLogsAPI', activityLogsAPI],
    ['errorLogsAPI', errorLogsAPI],
    ['bulkAPI', bulkAPI],
    ['exportAPI', exportAPI],
    ['scenarioRequestAPI', scenarioRequestAPI],
    ['apiConfigsAPI', apiConfigsAPI],
    ['distributionListsAPI', distributionListsAPI],
    ['jiraAPI', jiraAPI],
  ])('exports %s', (name, apiObj) => {
    expect(apiObj).toBeDefined();
    expect(typeof apiObj).toBe('object');
  });
});

// ─── Axios Instance Setup ────────────────────────────────────────────────────

describe('axios instance creation', () => {
  it('creates an axios instance (api is the callableMockApi returned from axios.create)', () => {
    expect(api).toBe(callableMockApi);
  });

  it('interceptors were registered during module load', () => {
    const interceptors = getInterceptors();
    expect(interceptors.requestFulfilled).toBeDefined();
    expect(typeof interceptors.requestFulfilled).toBe('function');
    expect(interceptors.responseFulfilled).toBeDefined();
    expect(typeof interceptors.responseFulfilled).toBe('function');
    expect(interceptors.responseRejected).toBeDefined();
    expect(typeof interceptors.responseRejected).toBe('function');
  });
});

// ─── authAPI ─────────────────────────────────────────────────────────────────

describe('authAPI', () => {
  it('has expected methods', () => {
    ['login', 'register', 'logout', 'getProfile',
     'updateProfile', 'forgotPassword', 'resetPassword', 'updatePassword',
    ].forEach((method) => {
      expect(typeof authAPI[method]).toBe('function');
    });
  });

  it('login calls api.post with /auth/login', () => {
    authAPI.login('user@test.com', 'pass123');
    expect(callableMockApi.post).toHaveBeenCalledWith('/auth/login', {
      email: 'user@test.com',
      password: 'pass123',
    });
  });

  it('register calls api.post with /auth/register', () => {
    const data = { email: 'a@b.com', password: 'x' };
    authAPI.register(data);
    expect(callableMockApi.post).toHaveBeenCalledWith('/auth/register', data);
  });

  it('logout calls api.post with /auth/logout', () => {
    authAPI.logout();
    expect(callableMockApi.post).toHaveBeenCalledWith('/auth/logout');
  });

  it('getProfile calls api.get with /auth/profile', () => {
    authAPI.getProfile();
    expect(callableMockApi.get).toHaveBeenCalledWith('/auth/profile');
  });

  it('updateProfile calls api.put with /auth/profile', () => {
    const data = { name: 'New' };
    authAPI.updateProfile(data);
    expect(callableMockApi.put).toHaveBeenCalledWith('/auth/profile', data);
  });

  it('forgotPassword calls api.post with /auth/forgot_password', () => {
    authAPI.forgotPassword('a@b.com', 'http://reset');
    expect(callableMockApi.post).toHaveBeenCalledWith('/auth/forgot_password', {
      email: 'a@b.com',
      reset_url: 'http://reset',
    });
  });

  it('resetPassword calls api.post with /auth/reset_password', () => {
    authAPI.resetPassword('tok123', 'newPass');
    expect(callableMockApi.post).toHaveBeenCalledWith('/auth/reset_password', {
      token: 'tok123',
      new_password: 'newPass',
    });
  });

  it('updatePassword calls api.post with /auth/update_password', () => {
    authAPI.updatePassword('old', 'new');
    expect(callableMockApi.post).toHaveBeenCalledWith('/auth/update_password', {
      password: 'old',
      new_password: 'new',
    });
  });
});

// ─── adminAPI ────────────────────────────────────────────────────────────────

describe('adminAPI', () => {
  it('has expected methods', () => {
    ['getUsers', 'getUser', 'updateUserStatus', 'updateUserRoles',
     'updateUserGroups', 'updateUserDomains', 'deleteUser'].forEach((m) => {
      expect(typeof adminAPI[m]).toBe('function');
    });
  });

  it('getUsers calls api.get with params', () => {
    adminAPI.getUsers({ page: 1 });
    expect(callableMockApi.get).toHaveBeenCalledWith('/admin/management/users', { params: { page: 1 } });
  });

  it('getUsers uses default empty params', () => {
    adminAPI.getUsers();
    expect(callableMockApi.get).toHaveBeenCalledWith('/admin/management/users', { params: {} });
  });

  it('getUser calls api.get with userId', () => {
    adminAPI.getUser('u1');
    expect(callableMockApi.get).toHaveBeenCalledWith('/admin/management/users/u1');
  });

  it('deleteUser calls api.delete with userId', () => {
    adminAPI.deleteUser('u1');
    expect(callableMockApi.delete).toHaveBeenCalledWith('/admin/management/users/u1');
  });

  it('updateUserStatus calls api.put correctly', () => {
    adminAPI.updateUserStatus('u1', true);
    expect(callableMockApi.put).toHaveBeenCalledWith(
      '/admin/management/users/u1/status',
      { is_active: true }
    );
  });

  it('updateUserRoles calls api.put correctly', () => {
    adminAPI.updateUserRoles('u1', ['admin']);
    expect(callableMockApi.put).toHaveBeenCalledWith(
      '/admin/management/users/u1/roles',
      { roles: ['admin'] }
    );
  });

  it('updateUserGroups calls api.put correctly', () => {
    adminAPI.updateUserGroups('u1', ['group1']);
    expect(callableMockApi.put).toHaveBeenCalledWith(
      '/admin/management/users/u1/groups',
      { groups: ['group1'] }
    );
  });

  it('updateUserDomains calls api.put correctly', () => {
    adminAPI.updateUserDomains('u1', ['finance']);
    expect(callableMockApi.put).toHaveBeenCalledWith(
      '/admin/management/users/u1/domains',
      { domains: ['finance'] }
    );
  });
});

// ─── usersAPI ────────────────────────────────────────────────────────────────

describe('usersAPI', () => {
  it('has expected methods', () => {
    ['list', 'count', 'get', 'create', 'update', 'delete',
     'toggleStatus', 'sendPasswordReset', 'adminResetPassword',
     'getAssignedCustomers', 'getCustomerTags'].forEach((m) => {
      expect(typeof usersAPI[m]).toBe('function');
    });
  });

  it('list calls api.get /users with params', () => {
    usersAPI.list({ skip: 0 });
    expect(callableMockApi.get).toHaveBeenCalledWith('/users', { params: { skip: 0 } });
  });

  it('create calls api.post /users', () => {
    const d = { email: 'x@y.com' };
    usersAPI.create(d);
    expect(callableMockApi.post).toHaveBeenCalledWith('/users', d);
  });

  it('update calls api.put /users/:id', () => {
    usersAPI.update('id1', { name: 'A' });
    expect(callableMockApi.put).toHaveBeenCalledWith('/users/id1', { name: 'A' });
  });

  it('delete calls api.delete /users/:id', () => {
    usersAPI.delete('id1');
    expect(callableMockApi.delete).toHaveBeenCalledWith('/users/id1');
  });

  it('toggleStatus calls api.post /users/:id/toggle-status', () => {
    usersAPI.toggleStatus('id1');
    expect(callableMockApi.post).toHaveBeenCalledWith('/users/id1/toggle-status');
  });

  it('sendPasswordReset passes sendEmail param', () => {
    usersAPI.sendPasswordReset('id1', false);
    expect(callableMockApi.post).toHaveBeenCalledWith(
      '/users/id1/send-password-reset',
      null,
      { params: { send_email: false } }
    );
  });

  it('count calls api.get /users/count', () => {
    usersAPI.count({ role: 'admin' });
    expect(callableMockApi.get).toHaveBeenCalledWith('/users/count', { params: { role: 'admin' } });
  });

  it('get calls api.get /users/:id', () => {
    usersAPI.get('id1');
    expect(callableMockApi.get).toHaveBeenCalledWith('/users/id1');
  });

  it('adminResetPassword passes sendEmail param', () => {
    usersAPI.adminResetPassword('id1', false);
    expect(callableMockApi.post).toHaveBeenCalledWith(
      '/users/id1/reset-password',
      null,
      { params: { send_email: false } }
    );
  });

  it('adminResetPassword defaults sendEmail to true', () => {
    usersAPI.adminResetPassword('id1');
    expect(callableMockApi.post).toHaveBeenCalledWith(
      '/users/id1/reset-password',
      null,
      { params: { send_email: true } }
    );
  });

  it('getAssignedCustomers calls api.get with params', () => {
    usersAPI.getAssignedCustomers({ skip: 0 });
    expect(callableMockApi.get).toHaveBeenCalledWith('/users/me/assigned-customers', { params: { skip: 0 } });
  });

  it('getCustomerTags calls api.get', () => {
    usersAPI.getCustomerTags();
    expect(callableMockApi.get).toHaveBeenCalledWith('/users/me/customer-tags');
  });
});

// ─── rolesAPI ────────────────────────────────────────────────────────────────

describe('rolesAPI', () => {
  it('has list, count, get, create, update, delete, toggleStatus, getUsers', () => {
    ['list', 'count', 'get', 'create', 'update', 'delete', 'toggleStatus', 'getUsers'].forEach((m) => {
      expect(typeof rolesAPI[m]).toBe('function');
    });
  });

  it('list calls api.get /roles', () => {
    rolesAPI.list();
    expect(callableMockApi.get).toHaveBeenCalledWith('/roles', { params: {} });
  });

  it('getUsers calls api.get /roles/:id/users', () => {
    rolesAPI.getUsers('r1');
    expect(callableMockApi.get).toHaveBeenCalledWith('/roles/r1/users');
  });

  it('count calls api.get /roles/count', () => {
    rolesAPI.count({ active: true });
    expect(callableMockApi.get).toHaveBeenCalledWith('/roles/count', { params: { active: true } });
  });

  it('get calls api.get /roles/:id', () => {
    rolesAPI.get('r1');
    expect(callableMockApi.get).toHaveBeenCalledWith('/roles/r1');
  });

  it('create calls api.post /roles', () => {
    rolesAPI.create({ name: 'Admin' });
    expect(callableMockApi.post).toHaveBeenCalledWith('/roles', { name: 'Admin' });
  });

  it('update calls api.put /roles/:id', () => {
    rolesAPI.update('r1', { name: 'SuperAdmin' });
    expect(callableMockApi.put).toHaveBeenCalledWith('/roles/r1', { name: 'SuperAdmin' });
  });

  it('delete calls api.delete /roles/:id', () => {
    rolesAPI.delete('r1');
    expect(callableMockApi.delete).toHaveBeenCalledWith('/roles/r1');
  });

  it('toggleStatus calls api.post /roles/:id/toggle-status', () => {
    rolesAPI.toggleStatus('r1');
    expect(callableMockApi.post).toHaveBeenCalledWith('/roles/r1/toggle-status');
  });
});

// ─── permissionsAPI ──────────────────────────────────────────────────────────

describe('permissionsAPI', () => {
  it('has list, getModules, count, get, create, update, delete, getRoles, getGroups', () => {
    ['list', 'getModules', 'count', 'get', 'create', 'update', 'delete', 'getRoles', 'getGroups'].forEach((m) => {
      expect(typeof permissionsAPI[m]).toBe('function');
    });
  });

  it('getModules calls api.get /permissions/modules', () => {
    permissionsAPI.getModules();
    expect(callableMockApi.get).toHaveBeenCalledWith('/permissions/modules');
  });

  it('list calls api.get /permissions', () => {
    permissionsAPI.list({ module: 'users' });
    expect(callableMockApi.get).toHaveBeenCalledWith('/permissions', { params: { module: 'users' } });
  });

  it('count calls api.get /permissions/count', () => {
    permissionsAPI.count();
    expect(callableMockApi.get).toHaveBeenCalledWith('/permissions/count', { params: {} });
  });

  it('get calls api.get /permissions/:id', () => {
    permissionsAPI.get('p1');
    expect(callableMockApi.get).toHaveBeenCalledWith('/permissions/p1');
  });

  it('create calls api.post /permissions', () => {
    permissionsAPI.create({ name: 'read' });
    expect(callableMockApi.post).toHaveBeenCalledWith('/permissions', { name: 'read' });
  });

  it('update calls api.put /permissions/:id', () => {
    permissionsAPI.update('p1', { name: 'write' });
    expect(callableMockApi.put).toHaveBeenCalledWith('/permissions/p1', { name: 'write' });
  });

  it('delete calls api.delete /permissions/:id', () => {
    permissionsAPI.delete('p1');
    expect(callableMockApi.delete).toHaveBeenCalledWith('/permissions/p1');
  });

  it('getRoles calls api.get /permissions/:id/roles', () => {
    permissionsAPI.getRoles('p1');
    expect(callableMockApi.get).toHaveBeenCalledWith('/permissions/p1/roles');
  });

  it('getGroups calls api.get /permissions/:id/groups', () => {
    permissionsAPI.getGroups('p1');
    expect(callableMockApi.get).toHaveBeenCalledWith('/permissions/p1/groups');
  });
});

// ─── groupsAPI ───────────────────────────────────────────────────────────────

describe('groupsAPI', () => {
  it('has expected CRUD + toggleStatus + getUsers + getTypes', () => {
    ['list', 'count', 'getTypes', 'get', 'create', 'update', 'delete', 'toggleStatus', 'getUsers'].forEach((m) => {
      expect(typeof groupsAPI[m]).toBe('function');
    });
  });

  it('getTypes calls api.get /groups/types', () => {
    groupsAPI.getTypes();
    expect(callableMockApi.get).toHaveBeenCalledWith('/groups/types');
  });

  it('list calls api.get /groups', () => {
    groupsAPI.list({ skip: 0 });
    expect(callableMockApi.get).toHaveBeenCalledWith('/groups', { params: { skip: 0 } });
  });

  it('count calls api.get /groups/count', () => {
    groupsAPI.count();
    expect(callableMockApi.get).toHaveBeenCalledWith('/groups/count', { params: {} });
  });

  it('get calls api.get /groups/:id', () => {
    groupsAPI.get('g1');
    expect(callableMockApi.get).toHaveBeenCalledWith('/groups/g1');
  });

  it('create calls api.post /groups', () => {
    groupsAPI.create({ name: 'Team A' });
    expect(callableMockApi.post).toHaveBeenCalledWith('/groups', { name: 'Team A' });
  });

  it('update calls api.put /groups/:id', () => {
    groupsAPI.update('g1', { name: 'Team B' });
    expect(callableMockApi.put).toHaveBeenCalledWith('/groups/g1', { name: 'Team B' });
  });

  it('delete calls api.delete /groups/:id', () => {
    groupsAPI.delete('g1');
    expect(callableMockApi.delete).toHaveBeenCalledWith('/groups/g1');
  });

  it('toggleStatus calls api.post /groups/:id/toggle-status', () => {
    groupsAPI.toggleStatus('g1');
    expect(callableMockApi.post).toHaveBeenCalledWith('/groups/g1/toggle-status');
  });

  it('getUsers calls api.get /groups/:id/users', () => {
    groupsAPI.getUsers('g1');
    expect(callableMockApi.get).toHaveBeenCalledWith('/groups/g1/users');
  });
});

// ─── customersAPI ────────────────────────────────────────────────────────────

describe('customersAPI', () => {
  it('has expected methods', () => {
    ['list', 'count', 'getFilters', 'get', 'create', 'update', 'delete',
     'toggleStatus', 'getUsers', 'assignUsers', 'removeUsers'].forEach((m) => {
      expect(typeof customersAPI[m]).toBe('function');
    });
  });

  it('assignUsers calls api.post /customers/:id/assign-users', () => {
    customersAPI.assignUsers('c1', ['u1', 'u2']);
    expect(callableMockApi.post).toHaveBeenCalledWith('/customers/c1/assign-users', ['u1', 'u2']);
  });

  it('list calls api.get /customers', () => {
    customersAPI.list({ skip: 0 });
    expect(callableMockApi.get).toHaveBeenCalledWith('/customers', { params: { skip: 0 } });
  });

  it('count calls api.get /customers/count', () => {
    customersAPI.count();
    expect(callableMockApi.get).toHaveBeenCalledWith('/customers/count', { params: {} });
  });

  it('getFilters calls api.get /customers/filters', () => {
    customersAPI.getFilters();
    expect(callableMockApi.get).toHaveBeenCalledWith('/customers/filters');
  });

  it('get calls api.get /customers/:id', () => {
    customersAPI.get('c1');
    expect(callableMockApi.get).toHaveBeenCalledWith('/customers/c1');
  });

  it('create calls api.post /customers', () => {
    customersAPI.create({ name: 'Acme' });
    expect(callableMockApi.post).toHaveBeenCalledWith('/customers', { name: 'Acme' });
  });

  it('update calls api.put /customers/:id', () => {
    customersAPI.update('c1', { name: 'Acme Corp' });
    expect(callableMockApi.put).toHaveBeenCalledWith('/customers/c1', { name: 'Acme Corp' });
  });

  it('delete calls api.delete /customers/:id', () => {
    customersAPI.delete('c1');
    expect(callableMockApi.delete).toHaveBeenCalledWith('/customers/c1');
  });

  it('toggleStatus calls api.post /customers/:id/toggle-status', () => {
    customersAPI.toggleStatus('c1');
    expect(callableMockApi.post).toHaveBeenCalledWith('/customers/c1/toggle-status');
  });

  it('getUsers calls api.get /customers/:id/users', () => {
    customersAPI.getUsers('c1');
    expect(callableMockApi.get).toHaveBeenCalledWith('/customers/c1/users');
  });

  it('removeUsers calls api.post /customers/:id/remove-users', () => {
    customersAPI.removeUsers('c1', ['u1']);
    expect(callableMockApi.post).toHaveBeenCalledWith('/customers/c1/remove-users', ['u1']);
  });
});

// ─── domainAPI (legacy) ──────────────────────────────────────────────────────

describe('domainAPI (legacy)', () => {
  it('has getAll, getAllAdmin, getTypes, get, create, update, delete', () => {
    ['getAll', 'getAllAdmin', 'getTypes', 'get', 'create', 'update', 'delete'].forEach((m) => {
      expect(typeof domainAPI[m]).toBe('function');
    });
  });

  it('getAll calls api.get /domains/all', () => {
    domainAPI.getAll();
    expect(callableMockApi.get).toHaveBeenCalledWith('/domains/all');
  });

  it('getAllAdmin calls api.get /domains/admin/all', () => {
    domainAPI.getAllAdmin();
    expect(callableMockApi.get).toHaveBeenCalledWith('/domains/admin/all');
  });

  it('getTypes calls api.get /domains/types', () => {
    domainAPI.getTypes();
    expect(callableMockApi.get).toHaveBeenCalledWith('/domains/types');
  });

  it('get calls api.get /domains/:key', () => {
    domainAPI.get('finance');
    expect(callableMockApi.get).toHaveBeenCalledWith('/domains/finance');
  });

  it('create calls api.post /domains', () => {
    domainAPI.create({ key: 'hr', name: 'HR' });
    expect(callableMockApi.post).toHaveBeenCalledWith('/domains', { key: 'hr', name: 'HR' });
  });

  it('update calls api.put /domains/:key', () => {
    domainAPI.update('hr', { name: 'Human Resources' });
    expect(callableMockApi.put).toHaveBeenCalledWith('/domains/hr', { name: 'Human Resources' });
  });

  it('delete calls api.delete /domains/:key', () => {
    domainAPI.delete('hr');
    expect(callableMockApi.delete).toHaveBeenCalledWith('/domains/hr');
  });
});

// ─── domainsAPI (scratch-3) ──────────────────────────────────────────────────

describe('domainsAPI (scratch-3)', () => {
  it('has expected methods including subdomain and scenario helpers', () => {
    ['list', 'count', 'get', 'create', 'update', 'delete',
     'toggleStatus', 'addSubdomain', 'removeSubdomain', 'getScenarios'].forEach((m) => {
      expect(typeof domainsAPI[m]).toBe('function');
    });
  });

  it('addSubdomain calls api.post /domains/:id/subdomains', () => {
    domainsAPI.addSubdomain('d1', { key: 'sub1' });
    expect(callableMockApi.post).toHaveBeenCalledWith('/domains/d1/subdomains', { key: 'sub1' });
  });

  it('removeSubdomain calls api.delete /domains/:id/subdomains/:key', () => {
    domainsAPI.removeSubdomain('d1', 'sub1');
    expect(callableMockApi.delete).toHaveBeenCalledWith('/domains/d1/subdomains/sub1');
  });

  it('list calls api.get /domains', () => {
    domainsAPI.list({ skip: 0 });
    expect(callableMockApi.get).toHaveBeenCalledWith('/domains', { params: { skip: 0 } });
  });

  it('count calls api.get /domains/count', () => {
    domainsAPI.count();
    expect(callableMockApi.get).toHaveBeenCalledWith('/domains/count', { params: {} });
  });

  it('get calls api.get /domains/:id', () => {
    domainsAPI.get('d1');
    expect(callableMockApi.get).toHaveBeenCalledWith('/domains/d1');
  });

  it('create calls api.post /domains', () => {
    domainsAPI.create({ key: 'fin' });
    expect(callableMockApi.post).toHaveBeenCalledWith('/domains', { key: 'fin' });
  });

  it('update calls api.put /domains/:id', () => {
    domainsAPI.update('d1', { name: 'Finance' });
    expect(callableMockApi.put).toHaveBeenCalledWith('/domains/d1', { name: 'Finance' });
  });

  it('delete calls api.delete /domains/:id', () => {
    domainsAPI.delete('d1');
    expect(callableMockApi.delete).toHaveBeenCalledWith('/domains/d1');
  });

  it('toggleStatus calls api.post /domains/:id/toggle-status', () => {
    domainsAPI.toggleStatus('d1');
    expect(callableMockApi.post).toHaveBeenCalledWith('/domains/d1/toggle-status');
  });

  it('getScenarios calls api.get /domains/:id/scenarios', () => {
    domainsAPI.getScenarios('d1');
    expect(callableMockApi.get).toHaveBeenCalledWith('/domains/d1/scenarios');
  });
});

// ─── scenariosAPI ────────────────────────────────────────────────────────────

describe('scenariosAPI (scratch-3)', () => {
  it('has expected methods', () => {
    ['list', 'count', 'get', 'create', 'update', 'delete', 'toggleStatus', 'getPlayboards'].forEach((m) => {
      expect(typeof scenariosAPI[m]).toBe('function');
    });
  });

  it('getPlayboards calls api.get /domain-scenarios/:id/playboards', () => {
    scenariosAPI.getPlayboards('s1');
    expect(callableMockApi.get).toHaveBeenCalledWith('/domain-scenarios/s1/playboards');
  });

  it('list calls api.get /domain-scenarios', () => {
    scenariosAPI.list({ skip: 0 });
    expect(callableMockApi.get).toHaveBeenCalledWith('/domain-scenarios', { params: { skip: 0 } });
  });

  it('count calls api.get /domain-scenarios/count', () => {
    scenariosAPI.count();
    expect(callableMockApi.get).toHaveBeenCalledWith('/domain-scenarios/count', { params: {} });
  });

  it('get calls api.get /domain-scenarios/:id', () => {
    scenariosAPI.get('s1');
    expect(callableMockApi.get).toHaveBeenCalledWith('/domain-scenarios/s1');
  });

  it('create calls api.post /domain-scenarios', () => {
    scenariosAPI.create({ name: 'Test' });
    expect(callableMockApi.post).toHaveBeenCalledWith('/domain-scenarios', { name: 'Test' });
  });

  it('update calls api.put /domain-scenarios/:id', () => {
    scenariosAPI.update('s1', { name: 'Updated' });
    expect(callableMockApi.put).toHaveBeenCalledWith('/domain-scenarios/s1', { name: 'Updated' });
  });

  it('delete calls api.delete /domain-scenarios/:id', () => {
    scenariosAPI.delete('s1');
    expect(callableMockApi.delete).toHaveBeenCalledWith('/domain-scenarios/s1');
  });

  it('toggleStatus calls api.post /domain-scenarios/:id/toggle-status', () => {
    scenariosAPI.toggleStatus('s1');
    expect(callableMockApi.post).toHaveBeenCalledWith('/domain-scenarios/s1/toggle-status');
  });
});

// ─── playboardsAPI ───────────────────────────────────────────────────────────

describe('playboardsAPI (scratch-3)', () => {
  it('has expected methods including upload and download', () => {
    ['list', 'count', 'get', 'create', 'upload', 'update', 'updateJson',
     'delete', 'toggleStatus', 'download'].forEach((m) => {
      expect(typeof playboardsAPI[m]).toBe('function');
    });
  });

  it('upload sends multipart/form-data header', () => {
    const fd = new FormData();
    playboardsAPI.upload(fd, { scenario_id: 's1' });
    expect(callableMockApi.post).toHaveBeenCalledWith(
      '/playboards/upload',
      fd,
      expect.objectContaining({
        headers: { 'Content-Type': 'multipart/form-data' },
        params: { scenario_id: 's1' },
      })
    );
  });

  it('download calls api.get /playboards/:id/download', () => {
    playboardsAPI.download('p1');
    expect(callableMockApi.get).toHaveBeenCalledWith('/playboards/p1/download');
  });

  it('list calls api.get /playboards', () => {
    playboardsAPI.list({ skip: 0 });
    expect(callableMockApi.get).toHaveBeenCalledWith('/playboards', { params: { skip: 0 } });
  });

  it('count calls api.get /playboards/count', () => {
    playboardsAPI.count();
    expect(callableMockApi.get).toHaveBeenCalledWith('/playboards/count', { params: {} });
  });

  it('get calls api.get /playboards/:id', () => {
    playboardsAPI.get('p1');
    expect(callableMockApi.get).toHaveBeenCalledWith('/playboards/p1');
  });

  it('create calls api.post /playboards', () => {
    playboardsAPI.create({ name: 'PB1' });
    expect(callableMockApi.post).toHaveBeenCalledWith('/playboards', { name: 'PB1' });
  });

  it('update calls api.put /playboards/:id', () => {
    playboardsAPI.update('p1', { name: 'Updated' });
    expect(callableMockApi.put).toHaveBeenCalledWith('/playboards/p1', { name: 'Updated' });
  });

  it('updateJson sends multipart header', () => {
    const fd = new FormData();
    playboardsAPI.updateJson('p1', fd);
    expect(callableMockApi.put).toHaveBeenCalledWith(
      '/playboards/p1/upload',
      fd,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
  });

  it('delete calls api.delete /playboards/:id', () => {
    playboardsAPI.delete('p1');
    expect(callableMockApi.delete).toHaveBeenCalledWith('/playboards/p1');
  });

  it('toggleStatus calls api.post /playboards/:id/toggle-status', () => {
    playboardsAPI.toggleStatus('p1');
    expect(callableMockApi.post).toHaveBeenCalledWith('/playboards/p1/toggle-status');
  });
});

// ─── configurationsAPI ───────────────────────────────────────────────────────

describe('configurationsAPI', () => {
  it('has expected methods', () => {
    ['list', 'count', 'getTypes', 'get', 'create', 'update', 'delete',
     'upload', 'download', 'downloadJson', 'getVersions'].forEach((m) => {
      expect(typeof configurationsAPI[m]).toBe('function');
    });
  });

  it('download passes version param and blob responseType', () => {
    configurationsAPI.download('c1', 'v2');
    expect(callableMockApi.get).toHaveBeenCalledWith('/configurations/c1/download', {
      params: { version: 'v2' },
      responseType: 'blob',
    });
  });

  it('download without version sends empty params', () => {
    configurationsAPI.download('c1');
    expect(callableMockApi.get).toHaveBeenCalledWith('/configurations/c1/download', {
      params: {},
      responseType: 'blob',
    });
  });

  it('list calls api.get /configurations', () => {
    configurationsAPI.list({ skip: 0 });
    expect(callableMockApi.get).toHaveBeenCalledWith('/configurations', { params: { skip: 0 } });
  });

  it('count calls api.get /configurations/count', () => {
    configurationsAPI.count();
    expect(callableMockApi.get).toHaveBeenCalledWith('/configurations/count', { params: {} });
  });

  it('getTypes calls api.get /configurations/types', () => {
    configurationsAPI.getTypes();
    expect(callableMockApi.get).toHaveBeenCalledWith('/configurations/types');
  });

  it('get calls api.get /configurations/:id', () => {
    configurationsAPI.get('c1');
    expect(callableMockApi.get).toHaveBeenCalledWith('/configurations/c1');
  });

  it('create calls api.post /configurations', () => {
    configurationsAPI.create({ key: 'cfg1' });
    expect(callableMockApi.post).toHaveBeenCalledWith('/configurations', { key: 'cfg1' });
  });

  it('update calls api.put /configurations/:id', () => {
    configurationsAPI.update('c1', { key: 'cfg2' });
    expect(callableMockApi.put).toHaveBeenCalledWith('/configurations/c1', { key: 'cfg2' });
  });

  it('delete calls api.delete /configurations/:id', () => {
    configurationsAPI.delete('c1');
    expect(callableMockApi.delete).toHaveBeenCalledWith('/configurations/c1');
  });

  it('upload sends multipart header', () => {
    const fd = new FormData();
    configurationsAPI.upload(fd, 'key1', 'json');
    expect(callableMockApi.post).toHaveBeenCalledWith(
      '/configurations/upload',
      fd,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
  });

  it('downloadJson calls api.get /configurations/:id/download', () => {
    configurationsAPI.downloadJson('c1');
    expect(callableMockApi.get).toHaveBeenCalledWith('/configurations/c1/download');
  });

  it('getVersions calls api.get /configurations/:id/versions', () => {
    configurationsAPI.getVersions('c1');
    expect(callableMockApi.get).toHaveBeenCalledWith('/configurations/c1/versions');
  });
});

// ─── feedbackAPI ─────────────────────────────────────────────────────────────

describe('feedbackAPI', () => {
  it('has expected methods', () => {
    ['getAll', 'get', 'create', 'update', 'submitPublic', 'getAdminList', 'getStats'].forEach((m) => {
      expect(typeof feedbackAPI[m]).toBe('function');
    });
  });

  it('submitPublic calls api.post /feedback/public', () => {
    feedbackAPI.submitPublic({ message: 'hi' });
    expect(callableMockApi.post).toHaveBeenCalledWith('/feedback/public', { message: 'hi' });
  });

  it('getAll calls api.get /feedback/all', () => {
    feedbackAPI.getAll();
    expect(callableMockApi.get).toHaveBeenCalledWith('/feedback/all');
  });

  it('get calls api.get /feedback/:id', () => {
    feedbackAPI.get('f1');
    expect(callableMockApi.get).toHaveBeenCalledWith('/feedback/f1');
  });

  it('create calls api.post /feedback', () => {
    feedbackAPI.create({ rating: 5 });
    expect(callableMockApi.post).toHaveBeenCalledWith('/feedback', { rating: 5 });
  });

  it('update calls api.put /feedback/:id', () => {
    feedbackAPI.update('f1', { rating: 4 });
    expect(callableMockApi.put).toHaveBeenCalledWith('/feedback/f1', { rating: 4 });
  });

  it('getAdminList calls api.get /feedback/admin/list with params', () => {
    feedbackAPI.getAdminList({ page: 1 });
    expect(callableMockApi.get).toHaveBeenCalledWith('/feedback/admin/list', { params: { page: 1 } });
  });

  it('getStats calls api.get /feedback/stats', () => {
    feedbackAPI.getStats();
    expect(callableMockApi.get).toHaveBeenCalledWith('/feedback/stats');
  });
});

// ─── dashboardAPI ────────────────────────────────────────────────────────────

describe('dashboardAPI', () => {
  it('has getStats, getSummary, getRecentLogins, getAnalytics', () => {
    ['getStats', 'getSummary', 'getRecentLogins', 'getAnalytics'].forEach((m) => {
      expect(typeof dashboardAPI[m]).toBe('function');
    });
  });

  it('getRecentLogins passes limit param', () => {
    dashboardAPI.getRecentLogins(5);
    expect(callableMockApi.get).toHaveBeenCalledWith('/dashboard/recent-logins', { params: { limit: 5 } });
  });

  it('getRecentLogins uses default limit of 10', () => {
    dashboardAPI.getRecentLogins();
    expect(callableMockApi.get).toHaveBeenCalledWith('/dashboard/recent-logins', { params: { limit: 10 } });
  });

  it('getStats calls api.get /dashboard/stats', () => {
    dashboardAPI.getStats();
    expect(callableMockApi.get).toHaveBeenCalledWith('/dashboard/stats');
  });

  it('getSummary calls api.get /dashboard/summary', () => {
    dashboardAPI.getSummary();
    expect(callableMockApi.get).toHaveBeenCalledWith('/dashboard/summary');
  });

  it('getAnalytics calls api.get /dashboard/analytics', () => {
    dashboardAPI.getAnalytics();
    expect(callableMockApi.get).toHaveBeenCalledWith('/dashboard/analytics');
  });
});

// ─── activityLogsAPI ─────────────────────────────────────────────────────────

describe('activityLogsAPI', () => {
  it('has expected methods', () => {
    ['list', 'getStats', 'getActions', 'getEntityTypes', 'getEntityHistory', 'getUserActivity'].forEach((m) => {
      expect(typeof activityLogsAPI[m]).toBe('function');
    });
  });

  it('getEntityHistory calls correct path', () => {
    activityLogsAPI.getEntityHistory('user', 'e1');
    expect(callableMockApi.get).toHaveBeenCalledWith('/activity-logs/entity/user/e1');
  });

  it('getUserActivity passes params', () => {
    activityLogsAPI.getUserActivity('a@b.com', { skip: 0 });
    expect(callableMockApi.get).toHaveBeenCalledWith('/activity-logs/user/a@b.com', { params: { skip: 0 } });
  });

  it('getStats defaults to 7 days', () => {
    activityLogsAPI.getStats();
    expect(callableMockApi.get).toHaveBeenCalledWith('/activity-logs/stats', { params: { days: 7 } });
  });

  it('getStats accepts custom days', () => {
    activityLogsAPI.getStats(30);
    expect(callableMockApi.get).toHaveBeenCalledWith('/activity-logs/stats', { params: { days: 30 } });
  });

  it('list calls api.get /activity-logs', () => {
    activityLogsAPI.list({ page: 1 });
    expect(callableMockApi.get).toHaveBeenCalledWith('/activity-logs', { params: { page: 1 } });
  });

  it('getActions calls api.get /activity-logs/actions', () => {
    activityLogsAPI.getActions();
    expect(callableMockApi.get).toHaveBeenCalledWith('/activity-logs/actions');
  });

  it('getEntityTypes calls api.get /activity-logs/entity-types', () => {
    activityLogsAPI.getEntityTypes();
    expect(callableMockApi.get).toHaveBeenCalledWith('/activity-logs/entity-types');
  });
});

// ─── errorLogsAPI ────────────────────────────────────────────────────────────

describe('errorLogsAPI', () => {
  it('has expected methods', () => {
    ['list', 'getStats', 'getLevels', 'getTypes', 'getCurrentFile',
     'listArchives', 'getArchiveDownloadUrl', 'deleteArchive', 'forceArchive', 'cleanup'].forEach((m) => {
      expect(typeof errorLogsAPI[m]).toBe('function');
    });
  });

  it('cleanup passes days param', () => {
    errorLogsAPI.cleanup(30);
    expect(callableMockApi.delete).toHaveBeenCalledWith('/error-logs/cleanup', { params: { days: 30 } });
  });

  it('forceArchive calls api.post /error-logs/force-archive', () => {
    errorLogsAPI.forceArchive();
    expect(callableMockApi.post).toHaveBeenCalledWith('/error-logs/force-archive');
  });

  it('list calls api.get /error-logs', () => {
    errorLogsAPI.list({ level: 'error' });
    expect(callableMockApi.get).toHaveBeenCalledWith('/error-logs', { params: { level: 'error' } });
  });

  it('getStats defaults to 7 days', () => {
    errorLogsAPI.getStats();
    expect(callableMockApi.get).toHaveBeenCalledWith('/error-logs/stats', { params: { days: 7 } });
  });

  it('getStats accepts custom days', () => {
    errorLogsAPI.getStats(14);
    expect(callableMockApi.get).toHaveBeenCalledWith('/error-logs/stats', { params: { days: 14 } });
  });

  it('getLevels calls api.get /error-logs/levels', () => {
    errorLogsAPI.getLevels();
    expect(callableMockApi.get).toHaveBeenCalledWith('/error-logs/levels');
  });

  it('getTypes calls api.get /error-logs/types', () => {
    errorLogsAPI.getTypes();
    expect(callableMockApi.get).toHaveBeenCalledWith('/error-logs/types');
  });

  it('getCurrentFile defaults to 100 lines', () => {
    errorLogsAPI.getCurrentFile();
    expect(callableMockApi.get).toHaveBeenCalledWith('/error-logs/current-file', { params: { lines: 100 } });
  });

  it('getCurrentFile accepts custom lines', () => {
    errorLogsAPI.getCurrentFile(50);
    expect(callableMockApi.get).toHaveBeenCalledWith('/error-logs/current-file', { params: { lines: 50 } });
  });

  it('listArchives calls api.get /error-logs/archives', () => {
    errorLogsAPI.listArchives();
    expect(callableMockApi.get).toHaveBeenCalledWith('/error-logs/archives');
  });

  it('getArchiveDownloadUrl passes expiration param', () => {
    errorLogsAPI.getArchiveDownloadUrl('a1', 30);
    expect(callableMockApi.get).toHaveBeenCalledWith('/error-logs/archives/a1/download', {
      params: { expiration_minutes: 30 },
    });
  });

  it('getArchiveDownloadUrl defaults expiration to 60', () => {
    errorLogsAPI.getArchiveDownloadUrl('a1');
    expect(callableMockApi.get).toHaveBeenCalledWith('/error-logs/archives/a1/download', {
      params: { expiration_minutes: 60 },
    });
  });

  it('deleteArchive calls api.delete /error-logs/archives/:id', () => {
    errorLogsAPI.deleteArchive('a1');
    expect(callableMockApi.delete).toHaveBeenCalledWith('/error-logs/archives/a1');
  });

  it('cleanup defaults to 90 days', () => {
    errorLogsAPI.cleanup();
    expect(callableMockApi.delete).toHaveBeenCalledWith('/error-logs/cleanup', { params: { days: 90 } });
  });
});

// ─── bulkAPI ─────────────────────────────────────────────────────────────────

describe('bulkAPI', () => {
  it('has upload, getTemplate, getGCSStatus, listGCSFiles', () => {
    ['upload', 'getTemplate', 'getGCSStatus', 'listGCSFiles'].forEach((m) => {
      expect(typeof bulkAPI[m]).toBe('function');
    });
  });

  it('upload sends multipart with entityType path', () => {
    const fd = new FormData();
    bulkAPI.upload('users', fd, false);
    expect(callableMockApi.post).toHaveBeenCalledWith(
      '/bulk/upload/users',
      fd,
      expect.objectContaining({
        headers: { 'Content-Type': 'multipart/form-data' },
        params: { send_password_emails: false },
      })
    );
  });

  it('getTemplate passes format and responseType blob', () => {
    bulkAPI.getTemplate('roles', 'csv');
    expect(callableMockApi.get).toHaveBeenCalledWith('/bulk/template/roles', {
      params: { format: 'csv' },
      responseType: 'blob',
    });
  });

  it('getTemplate defaults format to xlsx', () => {
    bulkAPI.getTemplate('users');
    expect(callableMockApi.get).toHaveBeenCalledWith('/bulk/template/users', {
      params: { format: 'xlsx' },
      responseType: 'blob',
    });
  });

  it('upload defaults sendPasswordEmails to true', () => {
    const fd = new FormData();
    bulkAPI.upload('users', fd);
    expect(callableMockApi.post).toHaveBeenCalledWith(
      '/bulk/upload/users',
      fd,
      expect.objectContaining({
        params: { send_password_emails: true },
      })
    );
  });

  it('getGCSStatus calls api.get /bulk/gcs/status', () => {
    bulkAPI.getGCSStatus();
    expect(callableMockApi.get).toHaveBeenCalledWith('/bulk/gcs/status');
  });

  it('listGCSFiles calls api.get with params', () => {
    bulkAPI.listGCSFiles('uploads/', 'my-bucket');
    expect(callableMockApi.get).toHaveBeenCalledWith('/bulk/gcs/list', {
      params: { prefix: 'uploads/', bucket_name: 'my-bucket' },
    });
  });

  it('listGCSFiles uses defaults', () => {
    bulkAPI.listGCSFiles();
    expect(callableMockApi.get).toHaveBeenCalledWith('/bulk/gcs/list', {
      params: { prefix: '', bucket_name: null },
    });
  });
});

// ─── exportAPI ───────────────────────────────────────────────────────────────

describe('exportAPI', () => {
  it('has sub-objects for users, roles, groups, customers, domains, scenarios, activityLogs, permissions', () => {
    ['users', 'roles', 'groups', 'customers', 'domains', 'scenarios', 'activityLogs', 'permissions'].forEach((key) => {
      expect(exportAPI[key]).toBeDefined();
      expect(typeof exportAPI[key].csv).toBe('function');
      expect(typeof exportAPI[key].json).toBe('function');
    });
  });

  it('users.csv calls api.get with blob responseType', () => {
    exportAPI.users.csv({ search: 'test' });
    expect(callableMockApi.get).toHaveBeenCalledWith('/export/users/csv', {
      params: { search: 'test' },
      responseType: 'blob',
    });
  });

  it('roles.json calls correct path', () => {
    exportAPI.roles.json();
    expect(callableMockApi.get).toHaveBeenCalledWith('/export/roles/json', {
      params: {},
      responseType: 'blob',
    });
  });

  it('groups.csv calls correct path', () => {
    exportAPI.groups.csv({ active: true });
    expect(callableMockApi.get).toHaveBeenCalledWith('/export/groups/csv', {
      params: { active: true },
      responseType: 'blob',
    });
  });

  it('customers.json calls correct path', () => {
    exportAPI.customers.json();
    expect(callableMockApi.get).toHaveBeenCalledWith('/export/customers/json', {
      params: {},
      responseType: 'blob',
    });
  });

  it('domains.csv calls correct path', () => {
    exportAPI.domains.csv();
    expect(callableMockApi.get).toHaveBeenCalledWith('/export/domains/csv', {
      params: {},
      responseType: 'blob',
    });
  });

  it('scenarios.json calls correct path', () => {
    exportAPI.scenarios.json();
    expect(callableMockApi.get).toHaveBeenCalledWith('/export/scenarios/json', {
      params: {},
      responseType: 'blob',
    });
  });

  it('activityLogs.csv calls correct path', () => {
    exportAPI.activityLogs.csv({ days: 7 });
    expect(callableMockApi.get).toHaveBeenCalledWith('/export/activity-logs/csv', {
      params: { days: 7 },
      responseType: 'blob',
    });
  });

  it('permissions.json calls correct path', () => {
    exportAPI.permissions.json();
    expect(callableMockApi.get).toHaveBeenCalledWith('/export/permissions/json', {
      params: {},
      responseType: 'blob',
    });
  });

  it('users.json calls correct path', () => {
    exportAPI.users.json({ role: 'admin' });
    expect(callableMockApi.get).toHaveBeenCalledWith('/export/users/json', {
      params: { role: 'admin' },
      responseType: 'blob',
    });
  });

  it('roles.csv calls correct path', () => {
    exportAPI.roles.csv();
    expect(callableMockApi.get).toHaveBeenCalledWith('/export/roles/csv', {
      params: {},
      responseType: 'blob',
    });
  });

  it('groups.json calls correct path', () => {
    exportAPI.groups.json();
    expect(callableMockApi.get).toHaveBeenCalledWith('/export/groups/json', {
      params: {},
      responseType: 'blob',
    });
  });

  it('customers.csv calls correct path', () => {
    exportAPI.customers.csv();
    expect(callableMockApi.get).toHaveBeenCalledWith('/export/customers/csv', {
      params: {},
      responseType: 'blob',
    });
  });

  it('domains.json calls correct path', () => {
    exportAPI.domains.json();
    expect(callableMockApi.get).toHaveBeenCalledWith('/export/domains/json', {
      params: {},
      responseType: 'blob',
    });
  });

  it('scenarios.csv calls correct path', () => {
    exportAPI.scenarios.csv();
    expect(callableMockApi.get).toHaveBeenCalledWith('/export/scenarios/csv', {
      params: {},
      responseType: 'blob',
    });
  });

  it('activityLogs.json calls correct path', () => {
    exportAPI.activityLogs.json();
    expect(callableMockApi.get).toHaveBeenCalledWith('/export/activity-logs/json', {
      params: {},
      responseType: 'blob',
    });
  });

  it('permissions.csv calls correct path', () => {
    exportAPI.permissions.csv();
    expect(callableMockApi.get).toHaveBeenCalledWith('/export/permissions/csv', {
      params: {},
      responseType: 'blob',
    });
  });
});

// ─── scenarioRequestAPI ──────────────────────────────────────────────────────

describe('scenarioRequestAPI', () => {
  it('has expected methods', () => {
    ['getAll', 'get', 'create', 'update', 'adminUpdate',
     'getStatuses', 'getRequestTypes', 'getDomains', 'getDefaults', 'searchUsers',
     'addComment', 'addWorkflow', 'updateStatus',
     'uploadFile', 'uploadBucketFile', 'previewFile', 'downloadFile',
     'getStats', 'addJiraLink', 'removeJiraLink'].forEach((m) => {
      expect(typeof scenarioRequestAPI[m]).toBe('function');
    });
  });

  it('getAll passes params', () => {
    scenarioRequestAPI.getAll({ limit: 10 });
    expect(callableMockApi.get).toHaveBeenCalledWith('/ask_scenarios/all', { params: { limit: 10 } });
  });

  it('get calls api.get /ask_scenarios/:id', () => {
    scenarioRequestAPI.get('req1');
    expect(callableMockApi.get).toHaveBeenCalledWith('/ask_scenarios/req1');
  });

  it('addComment sends FormData with multipart header', () => {
    scenarioRequestAPI.addComment('req1', 'my comment');
    expect(callableMockApi.post).toHaveBeenCalledWith(
      '/ask_scenarios/req1/comment',
      expect.any(FormData),
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
  });

  it('addJiraLink calls adminUpdate endpoint', () => {
    scenarioRequestAPI.addJiraLink('req1', 'https://jira/PROJ-1');
    expect(callableMockApi.put).toHaveBeenCalledWith('/ask_scenarios/req1/admin', {
      jira_links: ['https://jira/PROJ-1'],
    });
  });

  it('removeJiraLink calls adminUpdate with remove_jira_link_index', () => {
    scenarioRequestAPI.removeJiraLink('req1', 0);
    expect(callableMockApi.put).toHaveBeenCalledWith('/ask_scenarios/req1/admin', {
      remove_jira_link_index: 0,
    });
  });

  it('searchUsers passes query as q param', () => {
    scenarioRequestAPI.searchUsers('john');
    expect(callableMockApi.get).toHaveBeenCalledWith('/ask_scenarios/lookup/users', {
      params: { q: 'john' },
    });
  });

  it('downloadFile passes responseType blob', () => {
    scenarioRequestAPI.downloadFile('req1', 'path/to/file.pdf');
    expect(callableMockApi.get).toHaveBeenCalledWith(
      `/ask_scenarios/req1/files/${encodeURIComponent('path/to/file.pdf')}/download`,
      { responseType: 'blob' }
    );
  });

  it('getStats returns computed stats on success', async () => {
    callableMockApi.get.mockResolvedValueOnce({
      data: {
        data: [
          { status: 'submitted' },
          { status: 'in-progress' },
          { status: 'deployed' },
          { status: 'rejected' },
          { status: 'submitted' },
        ],
      },
    });
    const result = await scenarioRequestAPI.getStats();
    expect(result.data.total).toBe(5);
    expect(result.data.submitted).toBe(2);
    expect(result.data.inProgress).toBe(1);
    expect(result.data.deployed).toBe(1);
    expect(result.data.rejected).toBe(1);
  });

  it('getStats returns zeros on error', async () => {
    callableMockApi.get.mockRejectedValueOnce(new Error('fail'));
    const result = await scenarioRequestAPI.getStats();
    expect(result.data.total).toBe(0);
  });

  it('getStats counts all status categories correctly', async () => {
    callableMockApi.get.mockResolvedValueOnce({
      data: {
        data: [
          { status: 'submitted' },
          { status: 'development' },
          { status: 'review' },
          { status: 'testing' },
          { status: 'accepted' },
          { status: 'deployed' },
          { status: 'active' },
          { status: 'snapshot' },
          { status: 'rejected' },
          { status: 'inactive' },
        ],
      },
    });
    const result = await scenarioRequestAPI.getStats();
    expect(result.data.total).toBe(10);
    expect(result.data.submitted).toBe(1);
    expect(result.data.inProgress).toBe(4); // development, review, testing, accepted
    expect(result.data.deployed).toBe(3); // deployed, active, snapshot
    expect(result.data.rejected).toBe(2); // rejected, inactive
    expect(result.data.recent).toHaveLength(5);
  });

  it('getStats handles empty data array', async () => {
    callableMockApi.get.mockResolvedValueOnce({
      data: { data: [] },
    });
    const result = await scenarioRequestAPI.getStats();
    expect(result.data.total).toBe(0);
    expect(result.data.recent).toHaveLength(0);
  });

  it('getStats handles missing data field', async () => {
    callableMockApi.get.mockResolvedValueOnce({
      data: {},
    });
    const result = await scenarioRequestAPI.getStats();
    expect(result.data.total).toBe(0);
  });

  it('create calls api.post /ask_scenarios', () => {
    scenarioRequestAPI.create({ name: 'Test' });
    expect(callableMockApi.post).toHaveBeenCalledWith('/ask_scenarios', { name: 'Test' });
  });

  it('update calls api.put /ask_scenarios/:id', () => {
    scenarioRequestAPI.update('req1', { name: 'Updated' });
    expect(callableMockApi.put).toHaveBeenCalledWith('/ask_scenarios/req1', { name: 'Updated' });
  });

  it('adminUpdate calls api.put /ask_scenarios/:id/admin', () => {
    scenarioRequestAPI.adminUpdate('req1', { status: 'review' });
    expect(callableMockApi.put).toHaveBeenCalledWith('/ask_scenarios/req1/admin', { status: 'review' });
  });

  it('getStatuses calls api.get /ask_scenarios/lookup/statuses', () => {
    scenarioRequestAPI.getStatuses();
    expect(callableMockApi.get).toHaveBeenCalledWith('/ask_scenarios/lookup/statuses');
  });

  it('getRequestTypes calls api.get /ask_scenarios/lookup/request_types', () => {
    scenarioRequestAPI.getRequestTypes();
    expect(callableMockApi.get).toHaveBeenCalledWith('/ask_scenarios/lookup/request_types');
  });

  it('getDomains calls api.get /ask_scenarios/lookup/domains', () => {
    scenarioRequestAPI.getDomains();
    expect(callableMockApi.get).toHaveBeenCalledWith('/ask_scenarios/lookup/domains');
  });

  it('getDefaults calls api.get /ask_scenarios/lookup/defaults', () => {
    scenarioRequestAPI.getDefaults();
    expect(callableMockApi.get).toHaveBeenCalledWith('/ask_scenarios/lookup/defaults');
  });

  it('addWorkflow sends FormData with all fields', () => {
    scenarioRequestAPI.addWorkflow('req1', {
      assigned_to: 'user1',
      to_status: 'review',
      comment: 'Moving to review',
    });
    expect(callableMockApi.post).toHaveBeenCalledWith(
      '/ask_scenarios/req1/workflow',
      expect.any(FormData),
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
  });

  it('addWorkflow sends FormData with partial fields', () => {
    scenarioRequestAPI.addWorkflow('req1', { to_status: 'review' });
    expect(callableMockApi.post).toHaveBeenCalledWith(
      '/ask_scenarios/req1/workflow',
      expect.any(FormData),
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
  });

  it('addWorkflow sends FormData with empty data', () => {
    scenarioRequestAPI.addWorkflow('req1', {});
    expect(callableMockApi.post).toHaveBeenCalledWith(
      '/ask_scenarios/req1/workflow',
      expect.any(FormData),
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
  });

  it('updateStatus sends FormData with status and comment', () => {
    scenarioRequestAPI.updateStatus('req1', 'review', 'Needs review');
    expect(callableMockApi.put).toHaveBeenCalledWith(
      '/ask_scenarios/req1/status',
      expect.any(FormData),
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
  });

  it('updateStatus sends FormData without comment when empty', () => {
    scenarioRequestAPI.updateStatus('req1', 'deployed');
    expect(callableMockApi.put).toHaveBeenCalledWith(
      '/ask_scenarios/req1/status',
      expect.any(FormData),
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
  });

  it('uploadFile sends FormData with file', () => {
    const file = new File(['content'], 'test.csv', { type: 'text/csv' });
    scenarioRequestAPI.uploadFile('req1', file);
    expect(callableMockApi.post).toHaveBeenCalledWith(
      '/ask_scenarios/req1/files',
      expect.any(FormData),
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
  });

  it('uploadBucketFile sends FormData with file and comment', () => {
    const file = new File(['content'], 'snapshot.xlsx', { type: 'application/xlsx' });
    scenarioRequestAPI.uploadBucketFile('req1', file, 'Initial upload');
    expect(callableMockApi.post).toHaveBeenCalledWith(
      '/ask_scenarios/req1/buckets',
      expect.any(FormData),
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
  });

  it('uploadBucketFile sends FormData without comment when empty', () => {
    const file = new File(['content'], 'snapshot.xlsx');
    scenarioRequestAPI.uploadBucketFile('req1', file);
    expect(callableMockApi.post).toHaveBeenCalledWith(
      '/ask_scenarios/req1/buckets',
      expect.any(FormData),
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
  });

  it('previewFile calls api.get with encoded path', () => {
    scenarioRequestAPI.previewFile('req1', 'path/to/file.csv');
    expect(callableMockApi.get).toHaveBeenCalledWith(
      `/ask_scenarios/req1/files/${encodeURIComponent('path/to/file.csv')}/preview`
    );
  });
});

// ─── apiConfigsAPI ───────────────────────────────────────────────────────────

describe('apiConfigsAPI', () => {
  it('has expected methods', () => {
    ['list', 'count', 'getTags', 'get', 'getByKey', 'create', 'update', 'delete',
     'toggleStatus', 'test', 'testById', 'uploadCert', 'getGCSStatus'].forEach((m) => {
      expect(typeof apiConfigsAPI[m]).toBe('function');
    });
  });

  it('getByKey calls api.get /api-configs/key/:key', () => {
    apiConfigsAPI.getByKey('my-key');
    expect(callableMockApi.get).toHaveBeenCalledWith('/api-configs/key/my-key');
  });

  it('test calls api.post /api-configs/test', () => {
    apiConfigsAPI.test({ url: 'http://x' });
    expect(callableMockApi.post).toHaveBeenCalledWith('/api-configs/test', { url: 'http://x' });
  });

  it('uploadCert sends multipart header', () => {
    const fd = new FormData();
    apiConfigsAPI.uploadCert('c1', fd);
    expect(callableMockApi.post).toHaveBeenCalledWith(
      '/api-configs/c1/upload-cert',
      fd,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
  });

  it('list calls api.get /api-configs', () => {
    apiConfigsAPI.list({ skip: 0 });
    expect(callableMockApi.get).toHaveBeenCalledWith('/api-configs', { params: { skip: 0 } });
  });

  it('count calls api.get /api-configs/count', () => {
    apiConfigsAPI.count();
    expect(callableMockApi.get).toHaveBeenCalledWith('/api-configs/count', { params: {} });
  });

  it('getTags calls api.get /api-configs/tags', () => {
    apiConfigsAPI.getTags();
    expect(callableMockApi.get).toHaveBeenCalledWith('/api-configs/tags');
  });

  it('get calls api.get /api-configs/:id', () => {
    apiConfigsAPI.get('ac1');
    expect(callableMockApi.get).toHaveBeenCalledWith('/api-configs/ac1');
  });

  it('create calls api.post /api-configs', () => {
    apiConfigsAPI.create({ key: 'cfg1' });
    expect(callableMockApi.post).toHaveBeenCalledWith('/api-configs', { key: 'cfg1' });
  });

  it('update calls api.put /api-configs/:id', () => {
    apiConfigsAPI.update('ac1', { key: 'cfg2' });
    expect(callableMockApi.put).toHaveBeenCalledWith('/api-configs/ac1', { key: 'cfg2' });
  });

  it('delete calls api.delete /api-configs/:id', () => {
    apiConfigsAPI.delete('ac1');
    expect(callableMockApi.delete).toHaveBeenCalledWith('/api-configs/ac1');
  });

  it('toggleStatus calls api.post /api-configs/:id/toggle-status', () => {
    apiConfigsAPI.toggleStatus('ac1');
    expect(callableMockApi.post).toHaveBeenCalledWith('/api-configs/ac1/toggle-status');
  });

  it('testById calls api.post /api-configs/:id/test', () => {
    apiConfigsAPI.testById('ac1', { timeout: 5000 });
    expect(callableMockApi.post).toHaveBeenCalledWith('/api-configs/ac1/test', { timeout: 5000 });
  });

  it('getGCSStatus calls api.get /api-configs/gcs/status', () => {
    apiConfigsAPI.getGCSStatus();
    expect(callableMockApi.get).toHaveBeenCalledWith('/api-configs/gcs/status');
  });
});

// ─── distributionListsAPI ────────────────────────────────────────────────────

describe('distributionListsAPI', () => {
  it('has expected methods', () => {
    ['list', 'getTypes', 'get', 'getByKey', 'getByType', 'getEmails',
     'create', 'update', 'delete', 'toggleStatus', 'addEmail', 'removeEmail'].forEach((m) => {
      expect(typeof distributionListsAPI[m]).toBe('function');
    });
  });

  it('delete passes hardDelete as query param', () => {
    distributionListsAPI.delete('dl1', true);
    expect(callableMockApi.delete).toHaveBeenCalledWith('/distribution-lists/dl1', {
      params: { hard_delete: true },
    });
  });

  it('addEmail calls api.post with email payload', () => {
    distributionListsAPI.addEmail('dl1', 'a@b.com');
    expect(callableMockApi.post).toHaveBeenCalledWith('/distribution-lists/dl1/emails', { email: 'a@b.com' });
  });

  it('removeEmail calls api.delete with data payload', () => {
    distributionListsAPI.removeEmail('dl1', 'a@b.com');
    expect(callableMockApi.delete).toHaveBeenCalledWith('/distribution-lists/dl1/emails', {
      data: { email: 'a@b.com' },
    });
  });

  it('list calls api.get /distribution-lists', () => {
    distributionListsAPI.list({ skip: 0 });
    expect(callableMockApi.get).toHaveBeenCalledWith('/distribution-lists', { params: { skip: 0 } });
  });

  it('getTypes calls api.get /distribution-lists/types', () => {
    distributionListsAPI.getTypes();
    expect(callableMockApi.get).toHaveBeenCalledWith('/distribution-lists/types');
  });

  it('get calls api.get /distribution-lists/:id', () => {
    distributionListsAPI.get('dl1');
    expect(callableMockApi.get).toHaveBeenCalledWith('/distribution-lists/dl1');
  });

  it('getByKey calls api.get /distribution-lists/by-key/:key', () => {
    distributionListsAPI.getByKey('my-list');
    expect(callableMockApi.get).toHaveBeenCalledWith('/distribution-lists/by-key/my-list');
  });

  it('getByType calls api.get /distribution-lists/by-type/:type', () => {
    distributionListsAPI.getByType('email');
    expect(callableMockApi.get).toHaveBeenCalledWith('/distribution-lists/by-type/email');
  });

  it('getEmails calls api.get /distribution-lists/emails/:key', () => {
    distributionListsAPI.getEmails('my-list');
    expect(callableMockApi.get).toHaveBeenCalledWith('/distribution-lists/emails/my-list');
  });

  it('create calls api.post /distribution-lists', () => {
    distributionListsAPI.create({ key: 'new-list' });
    expect(callableMockApi.post).toHaveBeenCalledWith('/distribution-lists', { key: 'new-list' });
  });

  it('update calls api.put /distribution-lists/:id', () => {
    distributionListsAPI.update('dl1', { name: 'Updated' });
    expect(callableMockApi.put).toHaveBeenCalledWith('/distribution-lists/dl1', { name: 'Updated' });
  });

  it('toggleStatus calls api.post /distribution-lists/:id/toggle-status', () => {
    distributionListsAPI.toggleStatus('dl1');
    expect(callableMockApi.post).toHaveBeenCalledWith('/distribution-lists/dl1/toggle-status');
  });

  it('delete with default hardDelete=false', () => {
    distributionListsAPI.delete('dl1');
    expect(callableMockApi.delete).toHaveBeenCalledWith('/distribution-lists/dl1', {
      params: { hard_delete: false },
    });
  });
});

// ─── jiraAPI ─────────────────────────────────────────────────────────────────

describe('jiraAPI', () => {
  it('has expected methods', () => {
    ['getStatus', 'getProjects', 'getLatestProject', 'getMyTasks',
     'getTasksByRequest', 'createTask', 'syncRequest', 'transitionTask',
     'addAttachment', 'getIssueTypes', 'getStatuses',
     'getBoards', 'getAssignableUsers'].forEach((m) => {
      expect(typeof jiraAPI[m]).toBe('function');
    });
  });

  it('createTask sends correct payload', () => {
    jiraAPI.createTask('sr1', 'PROJ', 'Bug');
    expect(callableMockApi.post).toHaveBeenCalledWith('/jira/tasks/create', {
      scenario_request_id: 'sr1',
      project_key: 'PROJ',
      issue_type: 'Bug',
    });
  });

  it('transitionTask sends correct payload', () => {
    jiraAPI.transitionTask('PROJ-1', 'Done');
    expect(callableMockApi.post).toHaveBeenCalledWith('/jira/tasks/transition', {
      ticket_key: 'PROJ-1',
      status: 'Done',
    });
  });

  it('getAssignableUsers passes query params', () => {
    jiraAPI.getAssignableUsers('PROJ', 'john', 10);
    expect(callableMockApi.get).toHaveBeenCalledWith('/jira/assignable-users', {
      params: { project_key: 'PROJ', q: 'john', max_results: 10 },
    });
  });

  it('getAssignableUsers uses defaults', () => {
    jiraAPI.getAssignableUsers();
    expect(callableMockApi.get).toHaveBeenCalledWith('/jira/assignable-users', {
      params: { project_key: null, q: null, max_results: 50 },
    });
  });

  it('getStatus calls api.get /jira/status', () => {
    jiraAPI.getStatus();
    expect(callableMockApi.get).toHaveBeenCalledWith('/jira/status');
  });

  it('getProjects calls api.get /jira/projects', () => {
    jiraAPI.getProjects();
    expect(callableMockApi.get).toHaveBeenCalledWith('/jira/projects');
  });

  it('getLatestProject calls api.get /jira/projects/latest', () => {
    jiraAPI.getLatestProject();
    expect(callableMockApi.get).toHaveBeenCalledWith('/jira/projects/latest');
  });

  it('getMyTasks calls api.get /jira/tasks/my', () => {
    jiraAPI.getMyTasks({ status: 'open' });
    expect(callableMockApi.get).toHaveBeenCalledWith('/jira/tasks/my', { params: { status: 'open' } });
  });

  it('getTasksByRequest calls api.get with request id and project key', () => {
    jiraAPI.getTasksByRequest('req1', 'PROJ');
    expect(callableMockApi.get).toHaveBeenCalledWith('/jira/tasks/by-request/req1', {
      params: { project_key: 'PROJ' },
    });
  });

  it('getTasksByRequest defaults project_key to null', () => {
    jiraAPI.getTasksByRequest('req1');
    expect(callableMockApi.get).toHaveBeenCalledWith('/jira/tasks/by-request/req1', {
      params: { project_key: null },
    });
  });

  it('createTask defaults optional params to null', () => {
    jiraAPI.createTask('sr1');
    expect(callableMockApi.post).toHaveBeenCalledWith('/jira/tasks/create', {
      scenario_request_id: 'sr1',
      project_key: null,
      issue_type: null,
    });
  });

  it('syncRequest calls api.post with request id', () => {
    jiraAPI.syncRequest('req1', 'PROJ');
    expect(callableMockApi.post).toHaveBeenCalledWith('/jira/sync/request/req1', null, {
      params: { project_key: 'PROJ' },
    });
  });

  it('syncRequest defaults project_key to null', () => {
    jiraAPI.syncRequest('req1');
    expect(callableMockApi.post).toHaveBeenCalledWith('/jira/sync/request/req1', null, {
      params: { project_key: null },
    });
  });

  it('addAttachment calls api.post /jira/attachments/add', () => {
    jiraAPI.addAttachment('PROJ-1', 'http://file.url', 'file.pdf');
    expect(callableMockApi.post).toHaveBeenCalledWith('/jira/attachments/add', {
      ticket_key: 'PROJ-1',
      file_url: 'http://file.url',
      file_name: 'file.pdf',
    });
  });

  it('getIssueTypes calls api.get /jira/issue-types', () => {
    jiraAPI.getIssueTypes('PROJ');
    expect(callableMockApi.get).toHaveBeenCalledWith('/jira/issue-types', {
      params: { project_key: 'PROJ' },
    });
  });

  it('getIssueTypes defaults project_key to null', () => {
    jiraAPI.getIssueTypes();
    expect(callableMockApi.get).toHaveBeenCalledWith('/jira/issue-types', {
      params: { project_key: null },
    });
  });

  it('getStatuses calls api.get /jira/statuses', () => {
    jiraAPI.getStatuses('PROJ');
    expect(callableMockApi.get).toHaveBeenCalledWith('/jira/statuses', {
      params: { project_key: 'PROJ' },
    });
  });

  it('getBoards calls api.get /jira/boards', () => {
    jiraAPI.getBoards('PROJ');
    expect(callableMockApi.get).toHaveBeenCalledWith('/jira/boards', {
      params: { project_key: 'PROJ' },
    });
  });

  it('getBoards defaults project_key to null', () => {
    jiraAPI.getBoards();
    expect(callableMockApi.get).toHaveBeenCalledWith('/jira/boards', {
      params: { project_key: null },
    });
  });
});

// ─── Request Interceptor (CSRF) ──────────────────────────────────────────────

describe('request interceptor - CSRF', () => {
  it('adds X-CSRF-Token header for POST requests when token exists in cookie', async () => {
    Object.defineProperty(document, 'cookie', {
      writable: true,
      value: 'csrf_token=test-csrf-123; other=val',
    });

    const config = { method: 'post', headers: {} };
    const interceptors = getInterceptors();
    const result = await interceptors.requestFulfilled(config);
    expect(result.headers['X-CSRF-Token']).toBe('test-csrf-123');
  });

  it('adds X-CSRF-Token for PUT requests', async () => {
    // The csrfToken module variable persists. After the POST test above sets it,
    // subsequent state-changing requests re-use the cached value.
    const config = { method: 'put', headers: {} };
    const interceptors = getInterceptors();
    const result = await interceptors.requestFulfilled(config);
    expect(result.headers['X-CSRF-Token']).toBeDefined();
    expect(typeof result.headers['X-CSRF-Token']).toBe('string');
  });

  it('adds X-CSRF-Token for DELETE requests', async () => {
    const config = { method: 'delete', headers: {} };
    const interceptors = getInterceptors();
    const result = await interceptors.requestFulfilled(config);
    expect(result.headers['X-CSRF-Token']).toBeDefined();
  });

  it('adds X-CSRF-Token for PATCH requests', async () => {
    const config = { method: 'patch', headers: {} };
    const interceptors = getInterceptors();
    const result = await interceptors.requestFulfilled(config);
    expect(result.headers['X-CSRF-Token']).toBeDefined();
  });

  it('does NOT add CSRF token for GET requests', async () => {
    const config = { method: 'get', headers: {} };
    const interceptors = getInterceptors();
    const result = await interceptors.requestFulfilled(config);
    expect(result.headers['X-CSRF-Token']).toBeUndefined();
  });

  it('request interceptor rejects on error', async () => {
    const interceptors = getInterceptors();
    const err = new Error('request fail');
    await expect(interceptors.requestRejected(err)).rejects.toThrow('request fail');
  });
});

// ─── Response Interceptor ────────────────────────────────────────────────────

describe('response interceptor', () => {
  it('passes successful responses through', () => {
    const interceptors = getInterceptors();
    const response = { data: { ok: true }, status: 200 };
    expect(interceptors.responseFulfilled(response)).toEqual(response);
  });

  it('handles 401 by attempting token refresh', async () => {
    const interceptors = getInterceptors();
    axios.post.mockResolvedValueOnce({ data: {} }); // refresh call
    callableMockApi.mockResolvedValueOnce({ data: { refreshed: true } }); // retry

    const error = {
      config: { _retry: false, headers: {} },
      response: { status: 401 },
    };

    const result = await interceptors.responseRejected(error);
    expect(axios.post).toHaveBeenCalledWith(
      '/api/v1/auth/refresh',
      {},
      { withCredentials: true, timeout: 10000 }
    );
    expect(result).toEqual({ data: { refreshed: true } });
  });

  it('does not retry 401 if _retry is already set', async () => {
    const interceptors = getInterceptors();
    const error = {
      config: { _retry: true, headers: {} },
      response: { status: 401 },
    };

    await expect(interceptors.responseRejected(error)).rejects.toEqual(error);
  });

  it('redirects to /login when refresh fails on non-public page', async () => {
    const interceptors = getInterceptors();
    const originalLocation = window.location;
    delete window.location;
    window.location = { pathname: '/dashboard', href: '' };

    axios.post.mockRejectedValueOnce(new Error('refresh failed'));

    const error = {
      config: { _retry: false, headers: {} },
      response: { status: 401 },
    };

    await expect(interceptors.responseRejected(error)).rejects.toThrow('refresh failed');
    expect(window.location.href).toBe('/login');

    window.location = originalLocation;
  });

  it('does NOT redirect to /login when already on a public page', async () => {
    const interceptors = getInterceptors();
    const originalLocation = window.location;
    delete window.location;
    window.location = { pathname: '/login', href: '' };

    axios.post.mockRejectedValueOnce(new Error('refresh failed'));

    const error = {
      config: { _retry: false, headers: {} },
      response: { status: 401 },
    };

    await expect(interceptors.responseRejected(error)).rejects.toThrow('refresh failed');
    expect(window.location.href).toBe('');

    window.location = originalLocation;
  });

  it('does not retry cancelled/aborted requests on 401', async () => {
    const interceptors = getInterceptors();
    const error = {
      code: 'ERR_CANCELED',
      config: { _retry: false, headers: {} },
      response: { status: 401 },
    };

    await expect(interceptors.responseRejected(error)).rejects.toEqual(error);
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('also skips retry for CanceledError name', async () => {
    const interceptors = getInterceptors();
    const error = {
      name: 'CanceledError',
      config: { _retry: false, headers: {} },
      response: { status: 401 },
    };

    await expect(interceptors.responseRejected(error)).rejects.toEqual(error);
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('handles 403 CSRF error by refreshing CSRF token and retrying', async () => {
    const interceptors = getInterceptors();
    Object.defineProperty(document, 'cookie', {
      writable: true,
      value: 'csrf_token=new-csrf-tok',
    });
    axios.get.mockResolvedValueOnce({ data: {} }); // csrf-token endpoint
    callableMockApi.mockResolvedValueOnce({ data: { retried: true } }); // retry call

    const error = {
      config: { _csrfRetry: false, headers: {} },
      response: { status: 403, data: { detail: 'CSRF token invalid' } },
    };

    const result = await interceptors.responseRejected(error);
    expect(axios.get).toHaveBeenCalledWith('/api/v1/auth/csrf-token', { withCredentials: true });
    expect(result).toEqual({ data: { retried: true } });
  });

  it('rejects non-CSRF 403 errors without retrying', async () => {
    const interceptors = getInterceptors();
    const error = {
      config: { headers: {} },
      response: { status: 403, data: { detail: 'Forbidden' } },
    };

    await expect(interceptors.responseRejected(error)).rejects.toEqual(error);
  });

  it('rejects 500 errors', async () => {
    const interceptors = getInterceptors();
    const error = {
      config: { headers: {} },
      response: { status: 500, data: { detail: 'Server error' } },
    };

    await expect(interceptors.responseRejected(error)).rejects.toEqual(error);
  });

  it('does not retry 403 CSRF if _csrfRetry already set', async () => {
    const interceptors = getInterceptors();
    const error = {
      config: { _csrfRetry: true, headers: {} },
      response: { status: 403, data: { detail: 'CSRF token invalid' } },
    };

    await expect(interceptors.responseRejected(error)).rejects.toEqual(error);
  });

  it('handles 403 CSRF error with "csrf" lowercase in error detail', async () => {
    const interceptors = getInterceptors();
    Object.defineProperty(document, 'cookie', {
      writable: true,
      value: 'csrf_token=new-csrf-lower',
    });
    axios.get.mockResolvedValueOnce({ data: {} });
    callableMockApi.mockResolvedValueOnce({ data: { retried: true } });

    const error = {
      config: { _csrfRetry: false, headers: {} },
      response: { status: 403, data: { error: 'csrf validation failed' } },
    };

    const result = await interceptors.responseRejected(error);
    expect(result).toEqual({ data: { retried: true } });
  });

  it('rejects 403 CSRF if no new token available after refresh', async () => {
    const interceptors = getInterceptors();
    Object.defineProperty(document, 'cookie', {
      writable: true,
      value: '', // No cookie
    });
    axios.get.mockResolvedValueOnce({ data: {} }); // csrf endpoint
    // fetchCSRFToken tries cookie (empty), then calls API, then retries cookie
    axios.get.mockResolvedValueOnce({ data: {} }); // fetchCSRFToken fallback call
    axios.get.mockResolvedValueOnce({ data: {} }); // fetchCSRFToken retry call (no token returned)

    const error = {
      config: { _csrfRetry: false, headers: {} },
      response: { status: 403, data: { detail: 'CSRF token missing' } },
    };

    await expect(interceptors.responseRejected(error)).rejects.toEqual(error);
  });

  it('handles 403 CSRF when csrf-token endpoint call fails', async () => {
    const interceptors = getInterceptors();
    Object.defineProperty(document, 'cookie', {
      writable: true,
      value: 'csrf_token=recovered-token',
    });
    axios.get.mockRejectedValueOnce(new Error('network error')); // csrf endpoint fails (ignored)
    callableMockApi.mockResolvedValueOnce({ data: { retried: true } });

    const error = {
      config: { _csrfRetry: false, headers: {} },
      response: { status: 403, data: { detail: 'CSRF token invalid' } },
    };

    const result = await interceptors.responseRejected(error);
    expect(result).toEqual({ data: { retried: true } });
  });

  it('does not redirect when on /register page', async () => {
    const interceptors = getInterceptors();
    const originalLocation = window.location;
    delete window.location;
    window.location = { pathname: '/register', href: '' };

    axios.post.mockRejectedValueOnce(new Error('refresh failed'));

    const error = {
      config: { _retry: false, headers: {} },
      response: { status: 401 },
    };

    await expect(interceptors.responseRejected(error)).rejects.toThrow('refresh failed');
    expect(window.location.href).toBe('');

    window.location = originalLocation;
  });

  it('does not redirect when on /forgot-password page', async () => {
    const interceptors = getInterceptors();
    const originalLocation = window.location;
    delete window.location;
    window.location = { pathname: '/forgot-password', href: '' };

    axios.post.mockRejectedValueOnce(new Error('refresh failed'));

    const error = {
      config: { _retry: false, headers: {} },
      response: { status: 401 },
    };

    await expect(interceptors.responseRejected(error)).rejects.toThrow('refresh failed');
    expect(window.location.href).toBe('');

    window.location = originalLocation;
  });

  it('does not redirect when on /reset-password page', async () => {
    const interceptors = getInterceptors();
    const originalLocation = window.location;
    delete window.location;
    window.location = { pathname: '/reset-password/token123', href: '' };

    axios.post.mockRejectedValueOnce(new Error('refresh failed'));

    const error = {
      config: { _retry: false, headers: {} },
      response: { status: 401 },
    };

    await expect(interceptors.responseRejected(error)).rejects.toThrow('refresh failed');
    expect(window.location.href).toBe('');

    window.location = originalLocation;
  });
});

// ─── scenarioAPI (legacy) ────────────────────────────────────────────────────

describe('scenarioAPI (legacy)', () => {
  it('has getAll, getByDomain, get, create, update, delete', () => {
    ['getAll', 'getByDomain', 'get', 'create', 'update', 'delete'].forEach((m) => {
      expect(typeof scenarioAPI[m]).toBe('function');
    });
  });

  it('getByDomain calls api.get /scenarios/all/:domainKey', () => {
    scenarioAPI.getByDomain('finance');
    expect(callableMockApi.get).toHaveBeenCalledWith('/scenarios/all/finance');
  });

  it('getAll calls api.get /scenarios/all', () => {
    scenarioAPI.getAll();
    expect(callableMockApi.get).toHaveBeenCalledWith('/scenarios/all');
  });

  it('get calls api.get /scenarios/:key', () => {
    scenarioAPI.get('s1');
    expect(callableMockApi.get).toHaveBeenCalledWith('/scenarios/s1');
  });

  it('create calls api.post /scenarios', () => {
    scenarioAPI.create({ name: 'Test' });
    expect(callableMockApi.post).toHaveBeenCalledWith('/scenarios', { name: 'Test' });
  });

  it('update calls api.put /scenarios/:key', () => {
    scenarioAPI.update('s1', { name: 'Updated' });
    expect(callableMockApi.put).toHaveBeenCalledWith('/scenarios/s1', { name: 'Updated' });
  });

  it('delete calls api.delete /scenarios/:key', () => {
    scenarioAPI.delete('s1');
    expect(callableMockApi.delete).toHaveBeenCalledWith('/scenarios/s1');
  });
});

// ─── playboardAPI (legacy) ───────────────────────────────────────────────────

describe('playboardAPI (legacy)', () => {
  it('has getAll, getByDomain, get, create, update, delete', () => {
    ['getAll', 'getByDomain', 'get', 'create', 'update', 'delete'].forEach((m) => {
      expect(typeof playboardAPI[m]).toBe('function');
    });
  });

  it('getByDomain calls api.get /playboards/all/:domainKey', () => {
    playboardAPI.getByDomain('health');
    expect(callableMockApi.get).toHaveBeenCalledWith('/playboards/all/health');
  });

  it('getAll calls api.get /playboards/all', () => {
    playboardAPI.getAll();
    expect(callableMockApi.get).toHaveBeenCalledWith('/playboards/all');
  });

  it('get calls api.get /playboards/:key', () => {
    playboardAPI.get('p1');
    expect(callableMockApi.get).toHaveBeenCalledWith('/playboards/p1');
  });

  it('create calls api.post /playboards', () => {
    playboardAPI.create({ name: 'PB' });
    expect(callableMockApi.post).toHaveBeenCalledWith('/playboards', { name: 'PB' });
  });

  it('update calls api.put /playboards/:key', () => {
    playboardAPI.update('p1', { name: 'Updated' });
    expect(callableMockApi.put).toHaveBeenCalledWith('/playboards/p1', { name: 'Updated' });
  });

  it('delete calls api.delete /playboards/:key', () => {
    playboardAPI.delete('p1');
    expect(callableMockApi.delete).toHaveBeenCalledWith('/playboards/p1');
  });
});
