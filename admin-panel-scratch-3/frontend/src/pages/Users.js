import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Input, Table, Modal, Badge, SearchInput, Toggle, Select, Pagination, ExportButton } from '../components/shared';
import { usersAPI, rolesAPI, groupsAPI, customersAPI, exportAPI } from '../services/api';
import toast from 'react-hot-toast';

const Users = () => {
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

  const columns = [
    { key: 'email', title: 'Email' },
    { key: 'username', title: 'Username' },
    { key: 'full_name', title: 'Full Name' },
    {
      key: 'roles',
      title: 'Roles',
      render: (val) => (
        <div className="flex flex-wrap gap-1">
          {(val || []).slice(0, 2).map((r) => (
            <Badge key={r} variant="primary">{r}</Badge>
          ))}
          {(val || []).length > 2 && <Badge variant="default">+{val.length - 2}</Badge>}
        </div>
      ),
    },
    {
      key: 'is_active',
      title: 'Status',
      render: (val) => (
        <Badge variant={val ? 'success' : 'danger'}>
          {val ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      title: 'Actions',
      render: (_, user) => (
        <div className="flex items-center space-x-2">
          <button
            onClick={(e) => { e.stopPropagation(); openEditModal(user); }}
            className="p-1 text-gray-500 hover:text-primary-600"
            title="Edit"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleToggleStatus(user); }}
            className={`p-1 ${user.is_active ? 'text-yellow-500 hover:text-yellow-600' : 'text-green-500 hover:text-green-600'}`}
            title={user.is_active ? 'Disable' : 'Enable'}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={user.is_active ? "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" : "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"} />
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleSendPasswordReset(user); }}
            className="p-1 text-blue-500 hover:text-blue-600"
            title="Send Password Reset"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleDelete(user); }}
            className="p-1 text-red-500 hover:text-red-600"
            title="Delete"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-gray-500 mt-1">Manage user accounts and access</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton exportFn={exportAPI.users.csv} format="csv" label="Export CSV" />
          <ExportButton exportFn={exportAPI.users.json} format="json" label="Export JSON" />
          <Button onClick={() => { resetForm(); setModalOpen(true); }}>
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add User
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <SearchInput
              value={search}
              onChange={(val) => { setSearch(val); setPagination(prev => ({ ...prev, page: 0 })); }}
              placeholder="Search by email, username, or name..."
            />
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card>
        <Table columns={columns} data={users} loading={loading} />
        {pagination.pages > 1 && (
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.pages}
            total={pagination.total}
            limit={pagination.limit}
            onPageChange={handlePageChange}
          />
        )}
      </Card>

      {/* User Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); resetForm(); }}
        title={editingUser ? 'Edit User' : 'Add User'}
        size="xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              disabled={!!editingUser}
            />
            <Input
              label="Username"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              required
            />
          </div>
          
          <Input
            label="Full Name"
            value={formData.full_name}
            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
            required
          />
          
          {!editingUser && (
            <Input
              label="Password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
            />
          )}

          {/* Roles Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Roles ({formData.roles.length} selected)
              </label>
              <div className="space-x-2">
                <button type="button" onClick={selectAllRoles} className="text-xs text-primary-600 hover:text-primary-700 font-medium">
                  Select All
                </button>
                <button type="button" onClick={clearAllRoles} className="text-xs text-red-600 hover:text-red-700 font-medium">
                  Clear All
                </button>
              </div>
            </div>
            <div className="border rounded-lg max-h-40 overflow-y-auto p-3 bg-gray-50">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {roles.map((role) => (
                  <label
                    key={role.roleId}
                    className={`flex items-center p-2 rounded border cursor-pointer transition-colors ${
                      formData.roles.includes(role.roleId)
                        ? 'bg-primary-50 border-primary-300'
                        : 'bg-white border-gray-200 hover:border-gray-300'
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
                      className="h-4 w-4 text-primary-600 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">{role.name}</span>
                  </label>
                ))}
              </div>
              {roles.length === 0 && (
                <p className="text-gray-500 text-sm text-center py-4">No roles available</p>
              )}
            </div>
          </div>

          {/* Groups Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Groups ({formData.groups.length} selected)
              </label>
              <div className="space-x-2">
                <button type="button" onClick={selectAllGroups} className="text-xs text-primary-600 hover:text-primary-700 font-medium">
                  Select All
                </button>
                <button type="button" onClick={clearAllGroups} className="text-xs text-red-600 hover:text-red-700 font-medium">
                  Clear All
                </button>
              </div>
            </div>
            <div className="border rounded-lg max-h-40 overflow-y-auto p-3 bg-gray-50">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {groups.map((group) => (
                  <label
                    key={group.groupId}
                    className={`flex items-center p-2 rounded border cursor-pointer transition-colors ${
                      formData.groups.includes(group.groupId)
                        ? 'bg-green-50 border-green-300'
                        : 'bg-white border-gray-200 hover:border-gray-300'
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
                    <span className="ml-2 text-sm text-gray-700">{group.name}</span>
                  </label>
                ))}
              </div>
              {groups.length === 0 && (
                <p className="text-gray-500 text-sm text-center py-4">No groups available</p>
              )}
            </div>
          </div>

          {/* Customers Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Customers ({formData.customers.length} selected)
              </label>
              <div className="space-x-2">
                <button type="button" onClick={selectAllCustomers} className="text-xs text-primary-600 hover:text-primary-700 font-medium">
                  Select All
                </button>
                <button type="button" onClick={clearAllCustomers} className="text-xs text-red-600 hover:text-red-700 font-medium">
                  Clear All
                </button>
              </div>
            </div>
            <div className="border rounded-lg max-h-48 overflow-y-auto p-3 bg-gray-50">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {customers.map((customer) => (
                  <label
                    key={customer.customerId}
                    className={`flex items-center p-2 rounded border cursor-pointer transition-colors ${
                      formData.customers.includes(customer.customerId)
                        ? 'bg-blue-50 border-blue-300'
                        : 'bg-white border-gray-200 hover:border-gray-300'
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
                    <span className="ml-2 text-sm text-gray-700">{customer.name}</span>
                  </label>
                ))}
              </div>
              {customers.length === 0 && (
                <p className="text-gray-500 text-sm text-center py-4">No customers available</p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Toggle
              enabled={formData.is_active}
              onChange={(val) => setFormData({ ...formData, is_active: val })}
              label="Active"
            />
            {!editingUser && (
              <Toggle
                enabled={formData.send_password_email}
                onChange={(val) => setFormData({ ...formData, send_password_email: val })}
                label="Send password email"
              />
            )}
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button type="button" variant="secondary" onClick={() => { setModalOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button type="submit">
              {editingUser ? 'Update' : 'Create'} User
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Users;
