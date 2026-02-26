import React, { useState, useEffect, useCallback } from 'react';
import { usersAPI, rolesAPI, groupsAPI, customersAPI, exportAPI } from '../../services/api';
import toast from 'react-hot-toast';
import {
  Users, Search, ChevronLeft, ChevronRight, Plus, Edit2,
  Power, Trash2, X, Key, Download, FileDown, Filter
} from 'lucide-react';
import { Badge, Modal } from '../../components/shared';

const UsersManagement = () => {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [groups, setGroups] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterGroup, setFilterGroup] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [pagination, setPagination] = useState({ page: 0, limit: 25, total: 0, pages: 0 });
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    full_name: '',
    password: '',
    roles: [],
    groups: [],
    customers: [],
    is_active: true,
    send_password_email: true,
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page: pagination.page, limit: pagination.limit };
      if (search) params.search = search;
      if (filterRole) params.role = filterRole;
      if (filterGroup) params.group = filterGroup;

      const [usersRes, rolesRes, groupsRes, customersRes] = await Promise.all([
        usersAPI.list(params),
        rolesAPI.list({ limit: 100 }),
        groupsAPI.list({ limit: 100 }),
        customersAPI.list({ limit: 100 }),
      ]);
      setUsers(usersRes.data.data || usersRes.data);
      setPagination(prev => ({ ...prev, ...usersRes.data.pagination }));
      setRoles(rolesRes.data.data || rolesRes.data);
      setGroups(groupsRes.data.data || groupsRes.data);
      setCustomers(customersRes.data.data || customersRes.data);
    } catch (error) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [search, filterRole, filterGroup, pagination.page, pagination.limit]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) {
        const { password, send_password_email, ...updateData } = formData;
        await usersAPI.update(editingUser.email, updateData);
        toast.success('User updated successfully');
      } else {
        await usersAPI.create(formData);
        toast.success('User created successfully');
      }
      setModalOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Operation failed');
    }
  };

  const handleDelete = async (user) => {
    if (!window.confirm(`Are you sure you want to delete ${user.email}?`)) return;
    try {
      await usersAPI.delete(user.email);
      toast.success('User deleted successfully');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete user');
    }
  };

  const handleToggleStatus = async (user) => {
    try {
      await usersAPI.toggleStatus(user.email);
      toast.success(`User ${user.is_active ? 'disabled' : 'enabled'} successfully`);
      fetchData();
    } catch (error) {
      toast.error('Failed to update user status');
    }
  };

  const handleSendPasswordReset = async (user, sendEmail = true) => {
    try {
      const response = await usersAPI.sendPasswordReset(user.email, sendEmail);
      if (sendEmail) {
        toast.success('Password reset email sent');
      } else {
        toast.success(`Reset token: ${response.data.token}`);
      }
    } catch (error) {
      toast.error('Failed to send password reset');
    }
  };

  const handleExport = async (format) => {
    try {
      const response = format === 'csv' ? await exportAPI.users.csv() : await exportAPI.users.json();
      const blob = new Blob([response.data], { type: format === 'csv' ? 'text/csv' : 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `users.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success(`Exported users as ${format.toUpperCase()}`);
    } catch (error) {
      toast.error('Failed to export users');
    }
  };

  const resetForm = () => {
    setFormData({
      email: '',
      username: '',
      full_name: '',
      password: '',
      roles: [],
      groups: [],
      customers: [],
      is_active: true,
      send_password_email: true,
    });
    setEditingUser(null);
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      username: user.username,
      full_name: user.full_name,
      password: '',
      roles: user.roles || [],
      groups: user.groups || [],
      customers: user.customers || [],
      is_active: user.is_active,
      send_password_email: false,
    });
    setModalOpen(true);
  };

  // Helper to check if a role is selected (by _id or roleId key)
  const isRoleSelected = (role) => {
    return formData.roles.includes(role._id) || formData.roles.includes(role.roleId);
  };

  // Helper to check if a group is selected (by _id or groupId key)
  const isGroupSelected = (group) => {
    return formData.groups.includes(group._id) || formData.groups.includes(group.groupId);
  };

  // Helper to check if a customer is selected (by _id or customerId key)
  const isCustomerSelected = (customer) => {
    return formData.customers.includes(customer._id) || formData.customers.includes(customer.customerId);
  };

  // Select All / Clear All handlers - use _id for API
  const selectAllRoles = () => {
    setFormData(prev => ({
      ...prev,
      roles: roles.map(r => r._id)
    }));
  };

  const clearAllRoles = () => {
    setFormData(prev => ({ ...prev, roles: [] }));
  };

  const selectAllGroups = () => {
    setFormData(prev => ({
      ...prev,
      groups: groups.map(g => g._id)
    }));
  };

  const clearAllGroups = () => {
    setFormData(prev => ({ ...prev, groups: [] }));
  };

  const selectAllCustomers = () => {
    setFormData(prev => ({
      ...prev,
      customers: customers.map(c => c._id)
    }));
  };

  const clearAllCustomers = () => {
    setFormData(prev => ({ ...prev, customers: [] }));
  };

  const totalPages = pagination.pages || Math.ceil(pagination.total / pagination.limit);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-content">Users</h1>
          <p className="text-content-muted mt-1">Manage user accounts and access</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExport('csv')}
            className="btn-secondary flex items-center gap-2"
          >
            <FileDown size={16} />
            CSV
          </button>
          <button
            onClick={() => handleExport('json')}
            className="btn-secondary flex items-center gap-2"
          >
            <Download size={16} />
            JSON
          </button>
          <button onClick={() => { resetForm(); setModalOpen(true); }} className="btn-primary flex items-center gap-2">
            <Plus size={16} />
            Add User
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" size={20} />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPagination(prev => ({ ...prev, page: 0 })); }}
              placeholder="Search by email, username, or name..."
              className="input-field pl-10 w-full"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-content-muted" />
            <select
              className="input-field min-w-[150px]"
              value={filterRole}
              onChange={(e) => {
                setFilterRole(e.target.value);
                setPagination(prev => ({ ...prev, page: 0 }));
              }}
            >
              <option value="">All Roles</option>
              {roles.map((role) => (
                <option key={role.roleId} value={role.roleId}>
                  {role.name}
                </option>
              ))}
            </select>
            <select
              className="input-field min-w-[150px]"
              value={filterGroup}
              onChange={(e) => {
                setFilterGroup(e.target.value);
                setPagination(prev => ({ ...prev, page: 0 }));
              }}
            >
              <option value="">All Groups</option>
              {groups.map((group) => (
                <option key={group.groupId} value={group.groupId}>
                  {group.name}
                </option>
              ))}
            </select>
            {(filterRole || filterGroup) && (
              <button
                className="btn-secondary text-sm py-2 px-3"
                onClick={() => {
                  setFilterRole('');
                  setFilterGroup('');
                  setPagination(prev => ({ ...prev, page: 0 }));
                }}
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="table-header">
                    <th className="text-left py-3 px-4">Email</th>
                    <th className="text-left py-3 px-4">Username</th>
                    <th className="text-left py-3 px-4">Full Name</th>
                    <th className="text-left py-3 px-4">Roles</th>
                    <th className="text-left py-3 px-4">Status</th>
                    <th className="text-left py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user._id || user.email} className="table-row">
                      <td className="py-3 px-4">{user.email}</td>
                      <td className="py-3 px-4">{user.username}</td>
                      <td className="py-3 px-4">{user.full_name}</td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {(user.roles || []).slice(0, 2).map((r) => (
                            <Badge key={r} variant="primary">{r}</Badge>
                          ))}
                          {(user.roles || []).length > 2 && (
                            <Badge variant="default">+{user.roles.length - 2}</Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={user.is_active ? 'success' : 'danger'}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEditModal(user)}
                            className="w-9 h-9 flex items-center justify-center text-content-muted hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(user)}
                            className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${user.is_active ? 'text-yellow-500 hover:text-yellow-600 hover:bg-yellow-50' : 'text-green-500 hover:text-green-600 hover:bg-green-50'}`}
                            title={user.is_active ? 'Disable' : 'Enable'}
                          >
                            <Power size={18} />
                          </button>
                          <button
                            onClick={() => handleSendPasswordReset(user)}
                            className="w-9 h-9 flex items-center justify-center text-blue-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Send Password Reset"
                          >
                            <Key size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(user)}
                            className="w-9 h-9 flex items-center justify-center text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-edge">
                <p className="text-sm text-content-muted">
                  Showing {pagination.page * pagination.limit + 1} to{' '}
                  {Math.min((pagination.page + 1) * pagination.limit, pagination.total)} of{' '}
                  {pagination.total} users
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 0}
                    className="p-2 rounded-lg hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed text-content-muted"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <span className="text-sm text-content-muted">
                    Page {pagination.page + 1} of {totalPages}
                  </span>
                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page >= totalPages - 1}
                    className="p-2 rounded-lg hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed text-content-muted"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* User Modal */}
      <Modal isOpen={modalOpen} onClose={() => { setModalOpen(false); resetForm(); }} title={editingUser ? 'Edit User' : 'Add User'} size="xl">
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-content-secondary mb-1">Email *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    disabled={!!editingUser}
                    className="input-field w-full disabled:bg-surface-hover"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-content-secondary mb-1">Username *</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    required
                    className="input-field w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-content-secondary mb-1">Full Name *</label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  required
                  className="input-field w-full"
                />
              </div>

              {!editingUser && (
                <div>
                  <label className="block text-sm font-medium text-content-secondary mb-1">Password *</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    className="input-field w-full"
                  />
                </div>
              )}

              {/* Roles Selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-content-secondary">
                    Roles ({formData.roles.length} selected)
                  </label>
                  <div className="space-x-2">
                    <button type="button" onClick={selectAllRoles} className="text-xs text-primary-600 hover:text-primary-700 font-medium">
                      Select All
                    </button>
                    <button type="button" onClick={clearAllRoles} className="text-xs text-content-muted hover:text-content-secondary font-medium">
                      Clear All
                    </button>
                  </div>
                </div>
                <div className="border border-edge rounded-xl max-h-40 overflow-y-auto p-3 bg-surface-secondary">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {roles.map((role) => (
                      <label
                        key={role._id || role.roleId}
                        className={`flex items-center p-2 rounded-lg border cursor-pointer transition-colors ${
                          isRoleSelected(role)
                            ? 'bg-primary-50 border-primary-300'
                            : 'bg-surface border-edge hover:border-edge'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isRoleSelected(role)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({ ...formData, roles: [...formData.roles, role._id] });
                            } else {
                              setFormData({ ...formData, roles: formData.roles.filter(r => r !== role._id && r !== role.roleId) });
                            }
                          }}
                          className="h-4 w-4 text-primary-600 rounded"
                        />
                        <span className="ml-2 text-sm text-content-secondary">{role.name}</span>
                      </label>
                    ))}
                  </div>
                  {roles.length === 0 && (
                    <p className="text-content-muted text-sm text-center py-4">No roles available</p>
                  )}
                </div>
              </div>

              {/* Groups Selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-content-secondary">
                    Groups ({formData.groups.length} selected)
                  </label>
                  <div className="space-x-2">
                    <button type="button" onClick={selectAllGroups} className="text-xs text-primary-600 hover:text-primary-700 font-medium">
                      Select All
                    </button>
                    <button type="button" onClick={clearAllGroups} className="text-xs text-content-muted hover:text-content-secondary font-medium">
                      Clear All
                    </button>
                  </div>
                </div>
                <div className="border border-edge rounded-xl max-h-40 overflow-y-auto p-3 bg-surface-secondary">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {groups.map((group) => (
                      <label
                        key={group._id || group.groupId}
                        className={`flex items-center p-2 rounded-lg border cursor-pointer transition-colors ${
                          isGroupSelected(group)
                            ? 'bg-green-50 border-green-300'
                            : 'bg-surface border-edge hover:border-edge'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isGroupSelected(group)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({ ...formData, groups: [...formData.groups, group._id] });
                            } else {
                              setFormData({ ...formData, groups: formData.groups.filter(g => g !== group._id && g !== group.groupId) });
                            }
                          }}
                          className="h-4 w-4 text-green-600 rounded"
                        />
                        <span className="ml-2 text-sm text-content-secondary">{group.name}</span>
                      </label>
                    ))}
                  </div>
                  {groups.length === 0 && (
                    <p className="text-content-muted text-sm text-center py-4">No groups available</p>
                  )}
                </div>
              </div>

              {/* Customers Selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-content-secondary">
                    Customers ({formData.customers.length} selected)
                  </label>
                  <div className="space-x-2">
                    <button type="button" onClick={selectAllCustomers} className="text-xs text-primary-600 hover:text-primary-700 font-medium">
                      Select All
                    </button>
                    <button type="button" onClick={clearAllCustomers} className="text-xs text-content-muted hover:text-content-secondary font-medium">
                      Clear All
                    </button>
                  </div>
                </div>
                <div className="border border-edge rounded-xl max-h-48 overflow-y-auto p-3 bg-surface-secondary">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {customers.map((customer) => (
                      <label
                        key={customer._id || customer.customerId}
                        className={`flex items-center p-2 rounded-lg border cursor-pointer transition-colors ${
                          isCustomerSelected(customer)
                            ? 'bg-blue-50 border-blue-300'
                            : 'bg-surface border-edge hover:border-edge'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isCustomerSelected(customer)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({ ...formData, customers: [...formData.customers, customer._id] });
                            } else {
                              setFormData({ ...formData, customers: formData.customers.filter(c => c !== customer._id && c !== customer.customerId) });
                            }
                          }}
                          className="h-4 w-4 text-blue-600 rounded"
                        />
                        <span className="ml-2 text-sm text-content-secondary">{customer.name}</span>
                      </label>
                    ))}
                  </div>
                  {customers.length === 0 && (
                    <p className="text-content-muted text-sm text-center py-4">No customers available</p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="h-4 w-4 text-primary-600 rounded"
                  />
                  <span className="text-sm text-content-secondary">Active</span>
                </label>
                {!editingUser && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.send_password_email}
                      onChange={(e) => setFormData({ ...formData, send_password_email: e.target.checked })}
                      className="h-4 w-4 text-primary-600 rounded"
                    />
                    <span className="text-sm text-content-secondary">Send password email</span>
                  </label>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-edge">
                <button type="button" onClick={() => { setModalOpen(false); resetForm(); }} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingUser ? 'Update' : 'Create'} User
                </button>
              </div>
            </form>
      </Modal>
    </div>
  );
};

export default UsersManagement;
