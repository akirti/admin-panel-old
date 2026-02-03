import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { rolesAPI, permissionsAPI, domainsAPI, exportAPI } from '../../services/api';
import {
  Shield,
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Download,
  ChevronLeft,
  ChevronRight,
  ToggleLeft,
  ToggleRight,
  Users,
  AlertCircle,
  CheckCircle,
  Filter,
} from 'lucide-react';

const RolesManagement = () => {
  const { isSuperAdmin } = useAuth();

  // Data state
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Pagination state
  const [page, setPage] = useState(0);
  const [limit] = useState(25);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);

  // Search and filter state
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterDomain, setFilterDomain] = useState('');
  const [filterPermission, setFilterPermission] = useState('');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [formData, setFormData] = useState({
    roleId: '',
    name: '',
    description: '',
    type: 'custom',
    permissions: [],
    domains: [],
    status: 'active',
    priority: 0,
  });

  // Users modal state
  const [usersModalOpen, setUsersModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);
  const [roleUsers, setRoleUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch roles
  const fetchRoles = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit };
      if (debouncedSearch) params.search = debouncedSearch;
      if (filterDomain) params.domain = filterDomain;
      if (filterPermission) params.permission = filterPermission;

      const response = await rolesAPI.list(params);
      setRoles(response.data.data || []);
      if (response.data.pagination) {
        setTotalPages(response.data.pagination.pages || 0);
        setTotal(response.data.pagination.total || 0);
      }
    } catch (err) {
      setError('Failed to fetch roles');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, filterDomain, filterPermission]);

  // Fetch permissions and domains for the form
  const fetchFormData = useCallback(async () => {
    try {
      const [permRes, domRes] = await Promise.all([
        permissionsAPI.list({ limit: 1000 }),
        domainsAPI.list({ limit: 1000 }),
      ]);
      setPermissions(permRes.data.data || []);
      setDomains(domRes.data.data || []);
    } catch (err) {
      console.error('Failed to fetch form data:', err);
    }
  }, []);

  useEffect(() => {
    if (isSuperAdmin()) {
      fetchRoles();
      fetchFormData();
    }
  }, [fetchRoles, fetchFormData, isSuperAdmin]);

  // Clear messages after timeout
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError('');
        setSuccess('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  // Group permissions by module
  const groupedPermissions = permissions.reduce((acc, perm) => {
    const module = perm.module || 'Other';
    if (!acc[module]) acc[module] = [];
    acc[module].push(perm);
    return acc;
  }, {});

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value, 10) : value,
    }));
  };

  // Helper to check if permission is selected (by _id or key)
  const isPermissionSelected = (perm) => {
    return formData.permissions.includes(perm._id) ||
           formData.permissions.includes(perm.permissionId) ||
           formData.permissions.includes(perm.key);
  };

  // Helper to check if domain is selected (by _id or key)
  const isDomainSelected = (domain) => {
    return formData.domains.includes(domain._id) ||
           formData.domains.includes(domain.domainId) ||
           formData.domains.includes(domain.domainKey) ||
           formData.domains.includes(domain.key);
  };

  // Handle permission toggle - use _id for API
  const handlePermissionToggle = (perm) => {
    const isSelected = isPermissionSelected(perm);
    setFormData((prev) => ({
      ...prev,
      permissions: isSelected
        ? prev.permissions.filter((p) => p !== perm._id && p !== perm.permissionId && p !== perm.key)
        : [...prev.permissions, perm._id],
    }));
  };

  // Handle domain toggle - use _id for API
  const handleDomainToggle = (domain) => {
    const isSelected = isDomainSelected(domain);
    setFormData((prev) => ({
      ...prev,
      domains: isSelected
        ? prev.domains.filter((d) => d !== domain._id && d !== domain.domainId && d !== domain.domainKey && d !== domain.key)
        : [...prev.domains, domain._id],
    }));
  };

  // Select/clear all permissions for a module - use _id for API
  const handleSelectAllModule = (module, selected) => {
    const modulePerms = groupedPermissions[module];
    const modulePermIds = modulePerms.map((p) => p._id);
    const modulePermKeys = modulePerms.map((p) => p.key);
    setFormData((prev) => ({
      ...prev,
      permissions: selected
        ? [...new Set([...prev.permissions, ...modulePermIds])]
        : prev.permissions.filter((p) => !modulePermIds.includes(p) && !modulePermKeys.includes(p)),
    }));
  };

  // Select/clear all domains - use _id for API
  const handleSelectAllDomains = (selected) => {
    setFormData((prev) => ({
      ...prev,
      domains: selected ? domains.map((d) => d._id) : [],
    }));
  };

  // Select/clear all permissions - use _id for API
  const handleSelectAllPermissions = (selected) => {
    setFormData((prev) => ({
      ...prev,
      permissions: selected ? permissions.map((p) => p._id) : [],
    }));
  };

  // Open create modal
  const openCreateModal = () => {
    setEditingRole(null);
    setFormData({
      roleId: '',
      name: '',
      description: '',
      type: 'custom',
      permissions: [],
      domains: [],
      status: 'active',
      priority: 0,
    });
    setModalOpen(true);
  };

  // Open edit modal
  const openEditModal = (role) => {
    setEditingRole(role);
    setFormData({
      roleId: role.roleId || '',
      name: role.name || '',
      description: role.description || '',
      type: role.type || 'custom',
      permissions: role.permissions || [],
      domains: role.domains || [],
      status: role.status || 'active',
      priority: role.priority || 0,
    });
    setModalOpen(true);
  };

  // Handle form submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingRole) {
        await rolesAPI.update(editingRole._id || editingRole.roleId, formData);
        setSuccess('Role updated successfully');
      } else {
        await rolesAPI.create(formData);
        setSuccess('Role created successfully');
      }
      setModalOpen(false);
      fetchRoles();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save role');
    }
  };

  // Handle delete
  const handleDelete = async (role) => {
    if (!window.confirm(`Are you sure you want to delete role "${role.name}"?`)) {
      return;
    }
    try {
      await rolesAPI.delete(role._id || role.roleId);
      setSuccess('Role deleted successfully');
      fetchRoles();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete role');
    }
  };

  // Handle toggle status
  const handleToggleStatus = async (role) => {
    try {
      await rolesAPI.toggleStatus(role._id || role.roleId);
      setSuccess(`Role ${role.status === 'active' ? 'deactivated' : 'activated'} successfully`);
      fetchRoles();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to toggle role status');
    }
  };

  // Show users modal
  const showUsers = async (role) => {
    setSelectedRole(role);
    setUsersModalOpen(true);
    setLoadingUsers(true);
    try {
      const response = await rolesAPI.getUsers(role._id || role.roleId);
      setRoleUsers(response.data || []);
    } catch (err) {
      console.error('Failed to fetch role users:', err);
      setRoleUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  // Export functions
  const handleExport = async (format) => {
    try {
      const response = format === 'csv'
        ? await exportAPI.roles.csv()
        : await exportAPI.roles.json();

      const blob = new Blob([response.data], {
        type: format === 'csv' ? 'text/csv' : 'application/json',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `roles_export.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setSuccess(`Exported roles as ${format.toUpperCase()}`);
    } catch (err) {
      setError('Failed to export roles');
    }
  };

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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Roles Management</h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage roles and their permissions ({total} total)
          </p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <button
              className="btn btn-secondary flex items-center gap-2"
              onClick={() => document.getElementById('export-menu').classList.toggle('hidden')}
            >
              <Download size={16} />
              Export
            </button>
            <div
              id="export-menu"
              className="hidden absolute right-0 mt-1 bg-white border rounded-lg shadow-lg z-10"
            >
              <button
                className="block w-full px-4 py-2 text-left hover:bg-gray-100"
                onClick={() => {
                  handleExport('csv');
                  document.getElementById('export-menu').classList.add('hidden');
                }}
              >
                Export as CSV
              </button>
              <button
                className="block w-full px-4 py-2 text-left hover:bg-gray-100"
                onClick={() => {
                  handleExport('json');
                  document.getElementById('export-menu').classList.add('hidden');
                }}
              >
                Export as JSON
              </button>
            </div>
          </div>
          <button className="btn btn-primary flex items-center gap-2" onClick={openCreateModal}>
            <Plus size={16} />
            Add Role
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle size={20} />
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <CheckCircle size={20} />
          {success}
        </div>
      )}

      {/* Search and Filters */}
      <div className="card">
        <div className="flex flex-wrap gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search roles by name or ID..."
              className="input pl-10 w-full"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-gray-400" />
            <select
              className="input min-w-[150px]"
              value={filterDomain}
              onChange={(e) => {
                setFilterDomain(e.target.value);
                setPage(0);
              }}
            >
              <option value="">All Domains</option>
              {domains.map((domain) => (
                <option key={domain.key || domain._id} value={domain.key || domain._id}>
                  {domain.name}
                </option>
              ))}
            </select>
            <select
              className="input min-w-[150px]"
              value={filterPermission}
              onChange={(e) => {
                setFilterPermission(e.target.value);
                setPage(0);
              }}
            >
              <option value="">All Permissions</option>
              {permissions.map((perm) => (
                <option key={perm.key} value={perm.key}>
                  {perm.name || perm.key}
                </option>
              ))}
            </select>
            {(filterDomain || filterPermission) && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setFilterDomain('');
                  setFilterPermission('');
                  setPage(0);
                }}
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Roles Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading roles...</div>
        ) : roles.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No roles found. Click "Add Role" to create one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Role ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Permissions
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Domains
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Priority
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {roles.map((role) => (
                  <tr key={role._id || role.roleId} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm text-gray-600">{role.roleId}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <div className="font-medium text-gray-800">{role.name}</div>
                        {role.description && (
                          <div className="text-xs text-gray-500 truncate max-w-xs">
                            {role.description}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          role.type === 'system'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {role.type || 'custom'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {(role.permissions || []).slice(0, 3).map((perm, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded"
                          >
                            {perm}
                          </span>
                        ))}
                        {(role.permissions || []).length > 3 && (
                          <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                            +{role.permissions.length - 3} more
                          </span>
                        )}
                        {(role.permissions || []).length === 0 && (
                          <span className="text-xs text-gray-400">None</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {(role.domains || []).slice(0, 3).map((dom, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded"
                          >
                            {dom}
                          </span>
                        ))}
                        {(role.domains || []).length > 3 && (
                          <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                            +{role.domains.length - 3} more
                          </span>
                        )}
                        {(role.domains || []).length === 0 && (
                          <span className="text-xs text-gray-400">None</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600">{role.priority || 0}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          role.status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {role.status || 'active'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          className="w-9 h-9 flex items-center justify-center text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          onClick={() => showUsers(role)}
                          title="View Users"
                        >
                          <Users size={18} />
                        </button>
                        <button
                          className="w-9 h-9 flex items-center justify-center text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          onClick={() => openEditModal(role)}
                          title="Edit"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${
                            role.status === 'active'
                              ? 'text-green-600 hover:bg-green-50'
                              : 'text-gray-400 hover:bg-gray-50'
                          }`}
                          onClick={() => handleToggleStatus(role)}
                          title={role.status === 'active' ? 'Deactivate' : 'Activate'}
                        >
                          {role.status === 'active' ? (
                            <ToggleRight size={18} />
                          ) : (
                            <ToggleLeft size={18} />
                          )}
                        </button>
                        <button
                          className="w-9 h-9 flex items-center justify-center text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          onClick={() => handleDelete(role)}
                          title="Delete"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-200">
            <p className="text-sm text-neutral-500">
              Showing {page * limit + 1} to{' '}
              {Math.min((page + 1) * limit, total)} of{' '}
              {total} roles
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-2 rounded-lg hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed text-neutral-600"
              >
                <ChevronLeft size={20} />
              </button>
              <span className="text-sm text-neutral-600">
                Page {page + 1} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-2 rounded-lg hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed text-neutral-600"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                {editingRole ? 'Edit Role' : 'Create Role'}
              </h2>
              <button
                className="p-1 hover:bg-gray-100 rounded"
                onClick={() => setModalOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="roleId"
                    className="input w-full"
                    value={formData.roleId}
                    onChange={handleInputChange}
                    required
                    disabled={!!editingRole}
                    placeholder="e.g., custom-role"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    className="input w-full"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    placeholder="Role Name"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    name="description"
                    className="input w-full"
                    rows={2}
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="Brief description of the role..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    name="type"
                    className="input w-full"
                    value={formData.type}
                    onChange={handleInputChange}
                  >
                    <option value="custom">Custom</option>
                    <option value="system">System</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <input
                    type="number"
                    name="priority"
                    className="input w-full"
                    value={formData.priority}
                    onChange={handleInputChange}
                    min={0}
                  />
                  <p className="text-xs text-gray-500 mt-1">Lower values = higher priority</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    name="status"
                    className="input w-full"
                    value={formData.status}
                    onChange={handleInputChange}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Permissions Section */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Permissions ({formData.permissions.length} selected)
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="text-xs text-blue-600 hover:underline"
                      onClick={() => handleSelectAllPermissions(true)}
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      className="text-xs text-gray-600 hover:underline"
                      onClick={() => handleSelectAllPermissions(false)}
                    >
                      Clear All
                    </button>
                  </div>
                </div>
                <div className="border rounded-lg p-4 max-h-64 overflow-y-auto bg-gray-50">
                  {Object.keys(groupedPermissions).length === 0 ? (
                    <p className="text-sm text-gray-500">No permissions available</p>
                  ) : (
                    Object.entries(groupedPermissions).map(([module, perms]) => (
                      <div key={module} className="mb-4 last:mb-0">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">{module}</span>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="text-xs text-blue-600 hover:underline"
                              onClick={() => handleSelectAllModule(module, true)}
                            >
                              All
                            </button>
                            <button
                              type="button"
                              className="text-xs text-gray-600 hover:underline"
                              onClick={() => handleSelectAllModule(module, false)}
                            >
                              None
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {perms.map((perm) => (
                              <label
                                key={perm._id || perm.key}
                                className="flex items-center gap-2 text-sm cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={isPermissionSelected(perm)}
                                  onChange={() => handlePermissionToggle(perm)}
                                  className="rounded border-gray-300"
                                />
                                <span className="truncate" title={perm.description}>
                                  {perm.name || perm.key}
                                </span>
                              </label>
                            ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Domains Section */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Domains ({formData.domains.length} selected)
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="text-xs text-blue-600 hover:underline"
                      onClick={() => handleSelectAllDomains(true)}
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      className="text-xs text-gray-600 hover:underline"
                      onClick={() => handleSelectAllDomains(false)}
                    >
                      Clear All
                    </button>
                  </div>
                </div>
                <div className="border rounded-lg p-4 max-h-48 overflow-y-auto bg-gray-50">
                  {domains.length === 0 ? (
                    <p className="text-sm text-gray-500">No domains available</p>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {domains.map((domain) => (
                          <label
                            key={domain._id || domain.domainId || domain.key}
                            className="flex items-center gap-2 text-sm cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={isDomainSelected(domain)}
                              onChange={() => handleDomainToggle(domain)}
                              className="rounded border-gray-300"
                            />
                            <span className="truncate" title={domain.description}>
                              {domain.name || domain.domainId || domain.key}
                            </span>
                          </label>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingRole ? 'Update Role' : 'Create Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Users Modal */}
      {usersModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                Users with Role: {selectedRole?.name}
              </h2>
              <button
                className="p-1 hover:bg-gray-100 rounded"
                onClick={() => setUsersModalOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
              {loadingUsers ? (
                <div className="text-center py-8 text-gray-500">Loading users...</div>
              ) : roleUsers.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No users have this role assigned.
                </div>
              ) : (
                <div className="space-y-3">
                  {roleUsers.map((user) => (
                    <div
                      key={user._id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <div className="font-medium text-gray-800">
                          {user.full_name || user.username || user.email}
                        </div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          user.is_active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t flex justify-end">
              <button
                className="btn btn-secondary"
                onClick={() => setUsersModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RolesManagement;
