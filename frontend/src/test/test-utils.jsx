import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

// Mock auth context value factory
export function createMockAuthContext(overrides = {}) {
  const defaultUser = {
    email: 'test@example.com',
    first_name: 'Test',
    last_name: 'User',
    roles: ['user'],
    domains: [],
    permissions: [],
    groups: [],
    ...overrides.user,
  };

  return {
    user: overrides.user === null ? null : defaultUser,
    loading: false,
    login: vi.fn().mockResolvedValue(defaultUser),
    register: vi.fn().mockResolvedValue(defaultUser),
    logout: vi.fn().mockResolvedValue(undefined),
    updateProfile: vi.fn().mockResolvedValue(defaultUser),
    hasRole: vi.fn((role) => defaultUser.roles?.includes(role)),
    hasAnyRole: vi.fn((roles) => roles.some(r => defaultUser.roles?.includes(r))),
    isSuperAdmin: vi.fn(() => defaultUser.roles?.includes('super-administrator')),
    isAdmin: vi.fn(() => ['super-administrator', 'administrator'].some(r => defaultUser.roles?.includes(r))),
    isGroupAdmin: vi.fn(() => ['group-administrator', 'group-editor'].some(r => defaultUser.roles?.includes(r))),
    isEditor: vi.fn(() => false),
    canAccessAdminPanel: vi.fn(() => defaultUser.roles?.includes('super-administrator')),
    canManageUsers: vi.fn(() => false),
    canManageDomains: vi.fn(() => false),
    hasAccessToDomain: vi.fn(() => true),
    hasPermission: vi.fn(() => false),
    hasAnyPermission: vi.fn(() => false),
    getUserDomains: vi.fn(() => defaultUser.domains || []),
    getUserPermissions: vi.fn(() => defaultUser.permissions || []),
    ROLES: {
      SUPER_ADMIN: 'super-administrator',
      ADMIN: 'administrator',
      GROUP_ADMIN: 'group-administrator',
      GROUP_EDITOR: 'group-editor',
      EDITOR: 'editor',
      USER: 'user',
      VIEWER: 'viewer',
    },
    ADMIN_ROLES: ['super-administrator', 'administrator'],
    GROUP_ADMIN_ROLES: ['group-administrator', 'group-editor'],
    EDITOR_ROLES: ['super-administrator', 'administrator', 'group-administrator', 'group-editor', 'editor'],
    ...overrides,
  };
}

// Mock AuthContext provider wrapper
const MockAuthContext = React.createContext(null);

export function MockAuthProvider({ value, children }) {
  return (
    <MockAuthContext.Provider value={value}>
      {children}
    </MockAuthContext.Provider>
  );
}

// Render with common providers (Router + Auth)
export function renderWithProviders(ui, options = {}) {
  const {
    route = '/',
    authContext = createMockAuthContext(),
    ...renderOptions
  } = options;

  function Wrapper({ children }) {
    return (
      <MemoryRouter initialEntries={[route]}>
        {children}
      </MemoryRouter>
    );
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    authContext,
  };
}

// Helper to create mock API responses
export function mockApiResponse(data, status = 200) {
  return Promise.resolve({ data, status, headers: {} });
}

export function mockApiError(status = 400, detail = 'Error') {
  const error = new Error(detail);
  error.response = { status, data: { detail } };
  return Promise.reject(error);
}
