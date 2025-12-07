import React, { useState, useEffect, useCallback } from 'react';
import { usersAPI, rolesAPI, groupsAPI, customersAPI, exportAPI } from '../../services/api';
import toast from 'react-hot-toast';
import {
  Users, Search, ChevronLeft, ChevronRight, Plus, Edit2,
  Power, Trash2, X, Key, Download, FileDown
} from 'lucide-react';

const UsersManagement = () => {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [groups, setGroups] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
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
      const [usersRes, rolesRes, groupsRes, customersRes] = await Promise.all([
        usersAPI.list({ search: search || undefined, page: pagination.page, limit: pagination.limit }),
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
  }, [search, pagination.page, pagination.limit]);

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

  // Select All / Clear All handlers
  const selectAllRoles = () => {
    setFormData(prev => ({
      ...prev,
      roles: roles.map(r => r.roleId)
    }));
  };

  const clearAllRoles = () => {
    setFormData(prev => ({ ...prev, roles: [] }));
  };

  const selectAllGroups = () => {
    setFormData(prev => ({
      ...prev,
      groups: groups.map(g => g.groupId)
    }));
  };

  const clearAllGroups = () => {
    setFormData(prev => ({ ...prev, groups: [] }));
  };

  const selectAllCustomers = () => {
    setFormData(prev => ({
      ...prev,
      customers: customers.map(c => c.customerId)
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
          <h1 className="text-2xl font-bold text-neutral-800">Users</h1>
          <p className="text-neutral-500 mt-1">Manage user accounts and access</p>
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

      {/* Search */}
      <div className="card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={20} />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPagination(prev => ({ ...prev, page: 0 })); }}
            placeholder="Search by email, username, or name..."
            className="input-field pl-10 w-full"
          />
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
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
                            <span key={r} className="badge badge-primary">{r}</span>
                          ))}
                          {(user.roles || []).length > 2 && (
                            <span className="badge badge-neutral">+{user.roles.length - 2}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`badge ${user.is_active ? 'badge-success' : 'bg-red-100 text-red-700'}`}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEditModal(user)}
                            className="p-2 text-neutral-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(user)}
                            className={`p-2 rounded-lg transition-colors ${user.is_active ? 'text-yellow-500 hover:text-yellow-600 hover:bg-yellow-50' : 'text-green-500 hover:text-green-600 hover:bg-green-50'}`}
                            title={user.is_active ? 'Disable' : 'Enable'}
                          >
                            <Power size={16} />
                          </button>
                          <button
                            onClick={() => handleSendPasswordReset(user)}
                            className="p-2 text-blue-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Send Password Reset"
                          >
                            <Key size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(user)}
                            className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={16} />
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
              <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-200">
                <p className="text-sm text-neutral-500">
                  Showing {pagination.page * pagination.limit + 1} to{' '}
                  {Math.min((pagination.page + 1) * pagination.limit, pagination.total)} of{' '}
                  {pagination.total} users
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 0}
                    className="p-2 rounded-lg hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed text-neutral-600"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <span className="text-sm text-neutral-600">
                    Page {pagination.page + 1} of {totalPages}
                  </span>
                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page >= totalPages - 1}
                    className="p-2 rounded-lg hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed text-neutral-600"
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
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-neutral-200">
              <h3 className="text-xl font-semibold text-neutral-800">
                {editingUser ? 'Edit User' : 'Add User'}
              </h3>
              <button onClick={() => { setModalOpen(false); resetForm(); }} className="p-2 hover:bg-neutral-100 rounded-lg text-neutral-500">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Email *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    disabled={!!editingUser}
                    className="input-field w-full disabled:bg-neutral-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Username *</label>
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
                <label className="block text-sm font-medium text-neutral-700 mb-1">Full Name *</label>
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
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Password *</label>
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
                  <label className="block text-sm font-medium text-neutral-700">
                    Roles ({formData.roles.length} selected)
                  </label>
                  <div className="space-x-2">
                    <button type="button" onClick={selectAllRoles} className="text-xs text-red-600 hover:text-red-700 font-medium">
                      Select All
                    </button>
                    <button type="button" onClick={clearAllRoles} className="text-xs text-neutral-600 hover:text-neutral-700 font-medium">
                      Clear All
                    </button>
                  </div>
                </div>
                <div className="border border-neutral-200 rounded-xl max-h-40 overflow-y-auto p-3 bg-neutral-50">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {roles.map((role) => (
                      <label
                        key={role.roleId}
                        className={`flex items-center p-2 rounded-lg border cursor-pointer transition-colors ${
                          formData.roles.includes(role.roleId)
                            ? 'bg-red-50 border-red-300'
                            : 'bg-white border-neutral-200 hover:border-neutral-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={formData.roles.includes(role.roleId)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({ ...formData, roles: [...formData.roles, role.roleId] });
                            } else {
                              setFormData({ ...formData, roles: formData.roles.filter(r => r !== role.roleId) });
                            }
                          }}
                          className="h-4 w-4 text-red-600 rounded"
                        />
                        <span className="ml-2 text-sm text-neutral-700">{role.name}</span>
                      </label>
                    ))}
                  </div>
                  {roles.length === 0 && (
                    <p className="text-neutral-500 text-sm text-center py-4">No roles available</p>
                  )}
                </div>
              </div>

              {/* Groups Selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-neutral-700">
                    Groups ({formData.groups.length} selected)
                  </label>
                  <div className="space-x-2">
                    <button type="button" onClick={selectAllGroups} className="text-xs text-red-600 hover:text-red-700 font-medium">
                      Select All
                    </button>
                    <button type="button" onClick={clearAllGroups} className="text-xs text-neutral-600 hover:text-neutral-700 font-medium">
                      Clear All
                    </button>
                  </div>
                </div>
                <div className="border border-neutral-200 rounded-xl max-h-40 overflow-y-auto p-3 bg-neutral-50">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {groups.map((group) => (
                      <label
                        key={group.groupId}
                        className={`flex items-center p-2 rounded-lg border cursor-pointer transition-colors ${
                          formData.groups.includes(group.groupId)
                            ? 'bg-green-50 border-green-300'
                            : 'bg-white border-neutral-200 hover:border-neutral-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={formData.groups.includes(group.groupId)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({ ...formData, groups: [...formData.groups, group.groupId] });
                            } else {
                              setFormData({ ...formData, groups: formData.groups.filter(g => g !== group.groupId) });
                            }
                          }}
                          className="h-4 w-4 text-green-600 rounded"
                        />
                        <span className="ml-2 text-sm text-neutral-700">{group.name}</span>
                      </label>
                    ))}
                  </div>
                  {groups.length === 0 && (
                    <p className="text-neutral-500 text-sm text-center py-4">No groups available</p>
                  )}
                </div>
              </div>

              {/* Customers Selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-neutral-700">
                    Customers ({formData.customers.length} selected)
                  </label>
                  <div className="space-x-2">
                    <button type="button" onClick={selectAllCustomers} className="text-xs text-red-600 hover:text-red-700 font-medium">
                      Select All
                    </button>
                    <button type="button" onClick={clearAllCustomers} className="text-xs text-neutral-600 hover:text-neutral-700 font-medium">
                      Clear All
                    </button>
                  </div>
                </div>
                <div className="border border-neutral-200 rounded-xl max-h-48 overflow-y-auto p-3 bg-neutral-50">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {customers.map((customer) => (
                      <label
                        key={customer.customerId}
                        className={`flex items-center p-2 rounded-lg border cursor-pointer transition-colors ${
                          formData.customers.includes(customer.customerId)
                            ? 'bg-blue-50 border-blue-300'
                            : 'bg-white border-neutral-200 hover:border-neutral-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={formData.customers.includes(customer.customerId)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({ ...formData, customers: [...formData.customers, customer.customerId] });
                            } else {
                              setFormData({ ...formData, customers: formData.customers.filter(c => c !== customer.customerId) });
                            }
                          }}
                          className="h-4 w-4 text-blue-600 rounded"
                        />
                        <span className="ml-2 text-sm text-neutral-700">{customer.name}</span>
                      </label>
                    ))}
                  </div>
                  {customers.length === 0 && (
                    <p className="text-neutral-500 text-sm text-center py-4">No customers available</p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="h-4 w-4 text-red-600 rounded"
                  />
                  <span className="text-sm text-neutral-700">Active</span>
                </label>
                {!editingUser && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.send_password_email}
                      onChange={(e) => setFormData({ ...formData, send_password_email: e.target.checked })}
                      className="h-4 w-4 text-red-600 rounded"
                    />
                    <span className="text-sm text-neutral-700">Send password email</span>
                  </label>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-neutral-200">
                <button type="button" onClick={() => { setModalOpen(false); resetForm(); }} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingUser ? 'Update' : 'Create'} User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersManagement;
