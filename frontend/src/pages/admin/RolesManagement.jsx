import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Shield, Info } from 'lucide-react';

const ROLE_DESCRIPTIONS = {
  'super-administrator': {
    description: 'Full system access. Can manage all users, roles, domains, and configurations.',
    permissions: [
      'Manage all users including other admins',
      'Assign any role to any user',
      'Full access to all domains',
      'System configuration access',
    ],
  },
  'administrator': {
    description: 'System administrator with broad access. Cannot manage super-administrators.',
    permissions: [
      'Manage users (except super-admins)',
      'Assign roles (except super-admin)',
      'Full access to all domains',
      'Create and modify domains/scenarios',
    ],
  },
  'group-administrator': {
    description: 'Manages users and resources within assigned groups/domains.',
    permissions: [
      'Manage users in their groups/domains',
      'Assign viewer, user, editor roles',
      'Access to assigned domains only',
      'Cannot manage administrators',
    ],
  },
  'group-editor': {
    description: 'Can edit resources within assigned groups/domains.',
    permissions: [
      'Edit scenarios in assigned domains',
      'View users in their groups',
      'Limited user management',
    ],
  },
  'editor': {
    description: 'Can create and edit scenarios and playboards.',
    permissions: [
      'Create and edit scenarios',
      'Manage playboards',
      'Access to assigned domains',
    ],
  },
  'user': {
    description: 'Standard user with access to assigned domains.',
    permissions: [
      'View domains and scenarios',
      'Submit scenario requests',
      'Manage own profile',
    ],
  },
  'viewer': {
    description: 'Read-only access to authorized content.',
    permissions: [
      'View authorized reports',
      'Access to login and profile',
    ],
  },
};

function RolesManagement() {
  const { isSuperAdmin } = useAuth();

  if (!isSuperAdmin()) {
    return (
      <div className="text-center py-12">
        <Shield className="mx-auto text-gray-400 mb-4" size={48} />
        <h2 className="text-xl font-semibold text-gray-800 mb-2">Access Denied</h2>
        <p className="text-gray-500">Only Super Administrators can access this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Roles Management</h1>
      </div>

      <div className="card">
        <div className="flex items-start gap-3 mb-6 p-4 bg-blue-50 rounded-lg">
          <Info className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <p className="text-sm text-blue-800">
              Roles are predefined and cannot be created or deleted. You can assign these roles
              to users through the Users Management page.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {Object.entries(ROLE_DESCRIPTIONS).map(([role, info]) => (
            <div
              key={role}
              className="border rounded-lg p-4 hover:border-blue-300 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Shield className="text-blue-600" size={20} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-800">{role}</h3>
                  <p className="text-sm text-gray-600 mt-1">{info.description}</p>
                  
                  <div className="mt-3">
                    <p className="text-xs font-medium text-gray-500 mb-2">Permissions:</p>
                    <ul className="space-y-1">
                      {info.permissions.map((permission, index) => (
                        <li key={index} className="text-sm text-gray-600 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                          {permission}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default RolesManagement;
