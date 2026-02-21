import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export const ROLES = {
  SUPER_ADMIN: 'super-administrator',
  ADMIN: 'administrator',
  GROUP_ADMIN: 'group-administrator',
  GROUP_EDITOR: 'group-editor',
  EDITOR: 'editor',
  USER: 'user',
  VIEWER: 'viewer',
};

export const ADMIN_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN];
export const GROUP_ADMIN_ROLES = [ROLES.GROUP_ADMIN, ROLES.GROUP_EDITOR];
export const EDITOR_ROLES = [...ADMIN_ROLES, ...GROUP_ADMIN_ROLES, ROLES.EDITOR];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        // Verify session via httpOnly cookie (no localStorage token needed)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const response = await authAPI.getProfile();
        clearTimeout(timeoutId);

        const userData = response.data;
        setUser(userData);
      } catch (error) {
        // No valid session - user needs to log in
        setUser(null);
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email, password) => {
    const response = await authAPI.login(email, password);
    const { access_token, refresh_token, ...userData } = response.data;

    // Tokens are now set as httpOnly cookies by the backend
    setUser(userData);
    return userData;
  };

  const register = async (data) => {
    const response = await authAPI.register(data);
    const { access_token, refresh_token, ...userData } = response.data;

    // Tokens are now set as httpOnly cookies by the backend
    setUser(userData);
    return userData;
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      // Ignore logout errors - cookies are cleared server-side
    } finally {
      setUser(null);
    }
  };

  const updateProfile = async (data) => {
    const response = await authAPI.updateProfile(data);
    const userData = response.data;
    setUser(prev => ({ ...prev, ...userData }));
    return userData;
  };

  const hasRole = (role) => {
    return user?.roles?.includes(role);
  };

  const hasAnyRole = (roles) => {
    return roles.some(role => user?.roles?.includes(role));
  };

  const isSuperAdmin = () => hasRole(ROLES.SUPER_ADMIN);
  const isAdmin = () => hasAnyRole(ADMIN_ROLES);
  const isGroupAdmin = () => hasAnyRole(GROUP_ADMIN_ROLES);
  const isEditor = () => hasAnyRole(EDITOR_ROLES);

  const canAccessAdminPanel = () => {
    return isSuperAdmin();
  };

  const canManageUsers = () => {
    return hasAnyRole([...ADMIN_ROLES, ...GROUP_ADMIN_ROLES]);
  };

  const canManageDomains = () => {
    return isEditor();
  };

  const hasAccessToDomain = (domain) => {
    if (isAdmin()) return true;
    if (!user?.domains || user.domains.length === 0) return false;
    if (user.domains.includes('all')) return true;
    return user.domains.includes(domain);
  };

  const hasPermission = (permission) => {
    if (isSuperAdmin()) return true;
    return user?.permissions?.includes(permission);
  };

  const hasAnyPermission = (permissions) => {
    if (isSuperAdmin()) return true;
    return permissions.some(p => user?.permissions?.includes(p));
  };

  const getUserDomains = () => {
    return user?.domains || [];
  };

  const getUserPermissions = () => {
    return user?.permissions || [];
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    updateProfile,
    hasRole,
    hasAnyRole,
    isSuperAdmin,
    isAdmin,
    isGroupAdmin,
    isEditor,
    canAccessAdminPanel,
    canManageUsers,
    canManageDomains,
    hasAccessToDomain,
    hasPermission,
    hasAnyPermission,
    getUserDomains,
    getUserPermissions,
    ROLES,
    ADMIN_ROLES,
    GROUP_ADMIN_ROLES,
    EDITOR_ROLES,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
