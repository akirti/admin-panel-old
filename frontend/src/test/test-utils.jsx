import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

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
    login: jest.fn().mockResolvedValue(defaultUser),
    register: jest.fn().mockResolvedValue(defaultUser),
    logout: jest.fn().mockResolvedValue(undefined),
    updateProfile: jest.fn().mockResolvedValue(defaultUser),
    hasRole: jest.fn((role) => defaultUser.roles?.includes(role)),
    hasAnyRole: jest.fn((roles) => roles.some(r => defaultUser.roles?.includes(r))),
    isSuperAdmin: jest.fn(() => defaultUser.roles?.includes('super-administrator')),
    isAdmin: jest.fn(() => ['super-administrator', 'administrator'].some(r => defaultUser.roles?.includes(r))),
    isGroupAdmin: jest.fn(() => ['group-administrator', 'group-editor'].some(r => defaultUser.roles?.includes(r))),
    isEditor: jest.fn(() => false),
    canAccessAdminPanel: jest.fn(() => defaultUser.roles?.includes('super-administrator')),
    canManageUsers: jest.fn(() => false),
    canManageDomains: jest.fn(() => false),
    hasAccessToDomain: jest.fn(() => true),
    hasPermission: jest.fn(() => false),
    hasAnyPermission: jest.fn(() => false),
    getUserDomains: jest.fn(() => defaultUser.domains || []),
    getUserPermissions: jest.fn(() => defaultUser.permissions || []),
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
