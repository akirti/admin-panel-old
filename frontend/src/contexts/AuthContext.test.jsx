import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import {
  AuthProvider,
  useAuth,
  ROLES,
  ADMIN_ROLES,
  GROUP_ADMIN_ROLES,
  EDITOR_ROLES,
} from './AuthContext';

// Mock the api module
jest.mock('../services/api', () => ({
  authAPI: {
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
    getProfile: jest.fn(),
    updateProfile: jest.fn(),
  },
}));

import { authAPI } from '../services/api';

// Helper wrapper for renderHook
function wrapper({ children }) {
  return <AuthProvider>{children}</AuthProvider>;
}

// Helper to create a user with specific roles/domains/permissions
function makeUser(overrides = {}) {
  return {
    email: 'user@test.com',
    name: 'Test User',
    roles: [],
    domains: [],
    permissions: [],
    ...overrides,
  };
}

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: getProfile rejects (no session)
    authAPI.getProfile.mockRejectedValue(new Error('No session'));
  });

  // -------------------------------------------------------------------
  // 1. Constant exports
  // -------------------------------------------------------------------
  describe('constant exports', () => {
    it('exports ROLES with all seven role strings', () => {
      expect(ROLES).toEqual({
        SUPER_ADMIN: 'super-administrator',
        ADMIN: 'administrator',
        GROUP_ADMIN: 'group-administrator',
        GROUP_EDITOR: 'group-editor',
        EDITOR: 'editor',
        USER: 'user',
        VIEWER: 'viewer',
      });
    });

    it('exports ADMIN_ROLES containing super-admin and admin', () => {
      expect(ADMIN_ROLES).toEqual([ROLES.SUPER_ADMIN, ROLES.ADMIN]);
    });

    it('exports GROUP_ADMIN_ROLES containing group-admin and group-editor', () => {
      expect(GROUP_ADMIN_ROLES).toEqual([ROLES.GROUP_ADMIN, ROLES.GROUP_EDITOR]);
    });

    it('exports EDITOR_ROLES combining admin, group-admin, and editor roles', () => {
      expect(EDITOR_ROLES).toEqual([
        ROLES.SUPER_ADMIN,
        ROLES.ADMIN,
        ROLES.GROUP_ADMIN,
        ROLES.GROUP_EDITOR,
        ROLES.EDITOR,
      ]);
    });
  });

  // -------------------------------------------------------------------
  // 2. Provider initialization
  // -------------------------------------------------------------------
  describe('initialization', () => {
    it('starts with loading=true and user=null then resolves', async () => {
      authAPI.getProfile.mockResolvedValueOnce({
        data: makeUser({ name: 'Init User' }),
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      // Initial state is loading
      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toEqual(
        expect.objectContaining({ name: 'Init User' }),
      );
      expect(authAPI.getProfile).toHaveBeenCalledTimes(1);
    });

    it('sets user to null when getProfile fails', async () => {
      authAPI.getProfile.mockRejectedValueOnce(new Error('401'));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toBeNull();
    });
  });

  // -------------------------------------------------------------------
  // 3. Login flow
  // -------------------------------------------------------------------
  describe('login', () => {
    it('calls authAPI.login and sets user (stripping tokens)', async () => {
      const userData = makeUser({ name: 'Logged In' });
      authAPI.login.mockResolvedValueOnce({
        data: { access_token: 'at', refresh_token: 'rt', ...userData },
      });

      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      let returnedUser;
      await act(async () => {
        returnedUser = await result.current.login('a@b.com', 'pass');
      });

      expect(authAPI.login).toHaveBeenCalledWith('a@b.com', 'pass');
      expect(result.current.user).toEqual(expect.objectContaining({ name: 'Logged In' }));
      // Tokens should not be in user state
      expect(result.current.user).not.toHaveProperty('access_token');
      expect(result.current.user).not.toHaveProperty('refresh_token');
      // Return value should also be token-free
      expect(returnedUser).not.toHaveProperty('access_token');
    });
  });

  // -------------------------------------------------------------------
  // 4. Register flow
  // -------------------------------------------------------------------
  describe('register', () => {
    it('calls authAPI.register, sets user, and returns user data', async () => {
      const userData = makeUser({ name: 'New User' });
      authAPI.register.mockResolvedValueOnce({
        data: { access_token: 'at', refresh_token: 'rt', ...userData },
      });

      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      let returnedUser;
      await act(async () => {
        returnedUser = await result.current.register({ email: 'new@b.com', password: 'p' });
      });

      expect(authAPI.register).toHaveBeenCalledWith({ email: 'new@b.com', password: 'p' });
      expect(result.current.user).toEqual(expect.objectContaining({ name: 'New User' }));
      expect(returnedUser).toEqual(expect.objectContaining({ name: 'New User' }));
    });
  });

  // -------------------------------------------------------------------
  // 5. Logout flow
  // -------------------------------------------------------------------
  describe('logout', () => {
    it('calls authAPI.logout and clears user', async () => {
      // Start logged in
      authAPI.getProfile.mockResolvedValueOnce({
        data: makeUser({ name: 'LoggedIn' }),
      });
      authAPI.logout.mockResolvedValueOnce({});

      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.user).not.toBeNull());

      await act(async () => {
        await result.current.logout();
      });

      expect(authAPI.logout).toHaveBeenCalled();
      expect(result.current.user).toBeNull();
    });

    it('clears user even when authAPI.logout rejects', async () => {
      authAPI.getProfile.mockResolvedValueOnce({
        data: makeUser({ name: 'LoggedIn' }),
      });
      authAPI.logout.mockRejectedValueOnce(new Error('network'));

      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.user).not.toBeNull());

      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.user).toBeNull();
    });
  });

  // -------------------------------------------------------------------
  // 6. updateProfile
  // -------------------------------------------------------------------
  describe('updateProfile', () => {
    it('calls authAPI.updateProfile and merges into existing user', async () => {
      authAPI.getProfile.mockResolvedValueOnce({
        data: makeUser({ name: 'Old Name', email: 'e@t.com' }),
      });
      authAPI.updateProfile.mockResolvedValueOnce({
        data: { name: 'New Name' },
      });

      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.user).not.toBeNull());

      await act(async () => {
        await result.current.updateProfile({ name: 'New Name' });
      });

      expect(authAPI.updateProfile).toHaveBeenCalledWith({ name: 'New Name' });
      expect(result.current.user.name).toBe('New Name');
      // Existing fields should be preserved
      expect(result.current.user.email).toBe('e@t.com');
    });
  });

  // -------------------------------------------------------------------
  // 7. Role checking functions
  // -------------------------------------------------------------------
  describe('role checking', () => {
    it('hasRole returns true when user has the role', async () => {
      authAPI.getProfile.mockResolvedValueOnce({
        data: makeUser({ roles: [ROLES.EDITOR] }),
      });
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.hasRole(ROLES.EDITOR)).toBe(true);
      expect(result.current.hasRole(ROLES.ADMIN)).toBeFalsy();
    });

    it('hasAnyRole returns true when user has at least one matching role', async () => {
      authAPI.getProfile.mockResolvedValueOnce({
        data: makeUser({ roles: [ROLES.GROUP_EDITOR] }),
      });
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.hasAnyRole([ROLES.ADMIN, ROLES.GROUP_EDITOR])).toBe(true);
      expect(result.current.hasAnyRole([ROLES.ADMIN, ROLES.SUPER_ADMIN])).toBe(false);
    });

    it('isSuperAdmin returns true only for super-administrator', async () => {
      authAPI.getProfile.mockResolvedValueOnce({
        data: makeUser({ roles: [ROLES.SUPER_ADMIN] }),
      });
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.isSuperAdmin()).toBe(true);
    });

    it('isSuperAdmin returns false for regular admin', async () => {
      authAPI.getProfile.mockResolvedValueOnce({
        data: makeUser({ roles: [ROLES.ADMIN] }),
      });
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.isSuperAdmin()).toBeFalsy();
    });

    it('isAdmin returns true for super-admin or admin', async () => {
      authAPI.getProfile.mockResolvedValueOnce({
        data: makeUser({ roles: [ROLES.ADMIN] }),
      });
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.isAdmin()).toBe(true);
    });

    it('isGroupAdmin returns true for group-administrator or group-editor', async () => {
      authAPI.getProfile.mockResolvedValueOnce({
        data: makeUser({ roles: [ROLES.GROUP_ADMIN] }),
      });
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.isGroupAdmin()).toBe(true);
    });

    it('isEditor returns true for any EDITOR_ROLES member', async () => {
      authAPI.getProfile.mockResolvedValueOnce({
        data: makeUser({ roles: [ROLES.EDITOR] }),
      });
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.isEditor()).toBe(true);
    });

    it('isEditor returns false for a plain user role', async () => {
      authAPI.getProfile.mockResolvedValueOnce({
        data: makeUser({ roles: [ROLES.USER] }),
      });
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.isEditor()).toBe(false);
    });
  });

  // -------------------------------------------------------------------
  // 8. Permission gate functions
  // -------------------------------------------------------------------
  describe('permission gate functions', () => {
    it('canAccessAdminPanel returns true only for super-admin', async () => {
      authAPI.getProfile.mockResolvedValueOnce({
        data: makeUser({ roles: [ROLES.SUPER_ADMIN] }),
      });
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.canAccessAdminPanel()).toBe(true);
    });

    it('canAccessAdminPanel returns false for regular admin', async () => {
      authAPI.getProfile.mockResolvedValueOnce({
        data: makeUser({ roles: [ROLES.ADMIN] }),
      });
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.canAccessAdminPanel()).toBeFalsy();
    });

    it('canManageUsers returns true for admin and group-admin roles', async () => {
      authAPI.getProfile.mockResolvedValueOnce({
        data: makeUser({ roles: [ROLES.GROUP_ADMIN] }),
      });
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.canManageUsers()).toBe(true);
    });

    it('canManageUsers returns false for editor-only user', async () => {
      authAPI.getProfile.mockResolvedValueOnce({
        data: makeUser({ roles: [ROLES.EDITOR] }),
      });
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.canManageUsers()).toBe(false);
    });

    it('canManageDomains delegates to isEditor', async () => {
      authAPI.getProfile.mockResolvedValueOnce({
        data: makeUser({ roles: [ROLES.EDITOR] }),
      });
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.canManageDomains()).toBe(true);
    });
  });

  // -------------------------------------------------------------------
  // 9-11. hasAccessToDomain
  // -------------------------------------------------------------------
  describe('hasAccessToDomain', () => {
    it('returns true for admin users regardless of domain', async () => {
      authAPI.getProfile.mockResolvedValueOnce({
        data: makeUser({ roles: [ROLES.ADMIN], domains: [] }),
      });
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.hasAccessToDomain('any-domain')).toBe(true);
    });

    it('returns true for super-admin regardless of domain', async () => {
      authAPI.getProfile.mockResolvedValueOnce({
        data: makeUser({ roles: [ROLES.SUPER_ADMIN], domains: [] }),
      });
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.hasAccessToDomain('secret-domain')).toBe(true);
    });

    it('returns true when user has the specific domain', async () => {
      authAPI.getProfile.mockResolvedValueOnce({
        data: makeUser({ roles: [ROLES.USER], domains: ['finance', 'hr'] }),
      });
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.hasAccessToDomain('finance')).toBe(true);
      expect(result.current.hasAccessToDomain('hr')).toBe(true);
      expect(result.current.hasAccessToDomain('engineering')).toBe(false);
    });

    it('returns true for any domain when user has "all" in domains', async () => {
      authAPI.getProfile.mockResolvedValueOnce({
        data: makeUser({ roles: [ROLES.USER], domains: ['all'] }),
      });
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.hasAccessToDomain('anything')).toBe(true);
    });

    it('returns false when user has no domains and is not admin', async () => {
      authAPI.getProfile.mockResolvedValueOnce({
        data: makeUser({ roles: [ROLES.USER], domains: [] }),
      });
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.hasAccessToDomain('finance')).toBe(false);
    });

    it('returns false when user has no domains property', async () => {
      authAPI.getProfile.mockResolvedValueOnce({
        data: { email: 'u@t.com', roles: [ROLES.USER] },
      });
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.hasAccessToDomain('finance')).toBe(false);
    });
  });

  // -------------------------------------------------------------------
  // 12. hasPermission and hasAnyPermission
  // -------------------------------------------------------------------
  describe('hasPermission / hasAnyPermission', () => {
    it('hasPermission returns true for super-admin regardless of actual permissions', async () => {
      authAPI.getProfile.mockResolvedValueOnce({
        data: makeUser({ roles: [ROLES.SUPER_ADMIN], permissions: [] }),
      });
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.hasPermission('anything')).toBe(true);
    });

    it('hasPermission checks user.permissions for non-super-admin', async () => {
      authAPI.getProfile.mockResolvedValueOnce({
        data: makeUser({
          roles: [ROLES.USER],
          permissions: ['read:scenarios', 'write:feedback'],
        }),
      });
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.hasPermission('read:scenarios')).toBe(true);
      expect(result.current.hasPermission('delete:users')).toBeFalsy();
    });

    it('hasAnyPermission returns true for super-admin', async () => {
      authAPI.getProfile.mockResolvedValueOnce({
        data: makeUser({ roles: [ROLES.SUPER_ADMIN], permissions: [] }),
      });
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.hasAnyPermission(['x', 'y'])).toBe(true);
    });

    it('hasAnyPermission returns true when at least one matches', async () => {
      authAPI.getProfile.mockResolvedValueOnce({
        data: makeUser({
          roles: [ROLES.USER],
          permissions: ['read:scenarios'],
        }),
      });
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(
        result.current.hasAnyPermission(['read:scenarios', 'write:scenarios']),
      ).toBe(true);
      expect(
        result.current.hasAnyPermission(['delete:users', 'write:users']),
      ).toBe(false);
    });
  });

  // -------------------------------------------------------------------
  // getUserDomains / getUserPermissions
  // -------------------------------------------------------------------
  describe('getUserDomains / getUserPermissions', () => {
    it('getUserDomains returns user domains or empty array', async () => {
      authAPI.getProfile.mockResolvedValueOnce({
        data: makeUser({ domains: ['finance', 'hr'] }),
      });
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.getUserDomains()).toEqual(['finance', 'hr']);
    });

    it('getUserDomains returns empty array when no user', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.getUserDomains()).toEqual([]);
    });

    it('getUserPermissions returns user permissions or empty array', async () => {
      authAPI.getProfile.mockResolvedValueOnce({
        data: makeUser({ permissions: ['read:x'] }),
      });
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.getUserPermissions()).toEqual(['read:x']);
    });
  });

  // -------------------------------------------------------------------
  // 13. useAuth without provider
  // -------------------------------------------------------------------
  describe('useAuth without provider', () => {
    it('throws an error when used outside AuthProvider', () => {
      // Suppress console.error for the expected error
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useAuth());
      }).toThrow('useAuth must be used within an AuthProvider');

      spy.mockRestore();
    });
  });
});
