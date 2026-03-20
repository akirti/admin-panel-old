import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI, clearAccessToken, scheduleProactiveRefresh, clearProactiveRefresh } from '../services/api';

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
      // Try to restore session from httpOnly cookies
      const attemptProfile = async () => {
        const response = await authAPI.getProfile();
        return response.data;
      };

      try {
        const userData = await attemptProfile();
        setUser(userData);
        // Schedule proactive refresh if we got a valid session
        scheduleProactiveRefresh(900); // default 15 min, will be corrected on next refresh
      } catch (error) {
        const status = error?.response?.status;
        const isNetworkError = error?.code === 'ERR_NETWORK' || error?.code === 'ECONNABORTED'
          || error?.message?.includes('proxy') || error?.message?.includes('Network Error');

        if (isNetworkError) {
          // Network/proxy error — retry once after short delay
          try {
            await new Promise(resolve => setTimeout(resolve, 2000));
            const userData = await attemptProfile();
            setUser(userData);
            scheduleProactiveRefresh(900);
          } catch {
            // Retry also failed — session unrecoverable
            setUser(null);
          }
        } else if (status === 401 || status === 403) {
          // Auth failed — interceptor already tried refresh
          setUser(null);
        } else if (status === 502 || status === 503 || status === 504) {
          // Backend down — retry once
          try {
            await new Promise(resolve => setTimeout(resolve, 3000));
            const userData = await attemptProfile();
            setUser(userData);
            scheduleProactiveRefresh(900);
          } catch {
            setUser(null);
          }
        } else {
          // Unknown error — treat as logged out
          setUser(null);
        }
      }
      setLoading(false);
    };
    initAuth();
  }, []);

  const login = async (email, password) => {
    const response = await authAPI.login(email, password);
    const { access_token: _at, refresh_token: _rt, expires_in, ...userData } = response.data;
    setUser(userData);
    // Schedule proactive refresh
    if (expires_in) {
      scheduleProactiveRefresh(expires_in);
    } else {
      scheduleProactiveRefresh(900); // default 15 min
    }
    return userData;
  };

  const register = async (data) => {
    const response = await authAPI.register(data);
    const { access_token: _at, refresh_token: _rt, ...userData } = response.data;
    setUser(userData);
    return userData;
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch {
      // Ignore logout errors
    } finally {
      clearAccessToken();
      clearProactiveRefresh();
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

  const getUserGroups = () => {
    return user?.groups || [];
  };

  const hasGroup = (group) => {
    return user?.groups?.includes(group) || false;
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
    getUserGroups,
    hasGroup,
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
