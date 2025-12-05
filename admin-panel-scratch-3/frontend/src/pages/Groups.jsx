import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Input, Table, Modal, Badge, SearchInput, Select, Pagination } from '../components/shared';
import { groupsAPI, permissionsAPI, domainsAPI } from '../services/api';
import toast from 'react-hot-toast';

const Groups = () => {
  const [groups, setGroups] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [pagination, setPagination] = useState({ page: 0, limit: 25, total: 0, pages: 0 });

  // Form state
  const [formData, setFormData] = useState({
    groupId: '',
    name: '',
    description: '',
    permissions: [],
    domains: [],
    status: 'active',
    priority: 0,
    type: 'custom'
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [groupsRes, permissionsRes, domainsRes] = await Promise.all([
        groupsAPI.list({ search: search || undefined, page: pagination.page, limit: pagination.limit }),
        permissionsAPI.list({ limit: 100 }),
        domainsAPI.list({ limit: 100 })
      ]);
      setGroups(groupsRes.data.data || groupsRes.data);
      setPagination(prev => ({ ...prev, ...(groupsRes.data.pagination || {}) }));
      setPermissions(permissionsRes.data.data || permissionsRes.data);
      setDomains(domainsRes.data.data || domainsRes.data);
    } catch (error) {
      toast.error('Failed to load data');
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

  const resetForm = () => {
    setFormData({
      groupId: '',
      name: '',
      description: '',
      permissions: [],
      domains: [],
      status: 'active',
      priority: 0,
      type: 'custom'
    });
    setEditingItem(null);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await groupsAPI.create(formData);
      toast.success('Group created successfully');
      setModalOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create group');
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await groupsAPI.update(editingItem.groupId, formData);
      toast.success('Group updated successfully');
      setModalOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update group');
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm('Are you sure you want to delete this group?')) return;
    try {
      await groupsAPI.delete(item.groupId);
      toast.success('Group deleted successfully');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete group');
    }
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setFormData({
      groupId: item.groupId || '',
      name: item.name || '',
      description: item.description || '',
      permissions: item.permissions || [],
      domains: item.domains || [],
      status: item.status || 'active',
      priority: item.priority || 0,
      type: item.type || 'custom'
    });
    setModalOpen(true);
  };

  const handlePermissionToggle = (permissionKey) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permissionKey)
        ? prev.permissions.filter(p => p !== permissionKey)
        : [...prev.permissions, permissionKey]
    }));
  };

  const handleDomainToggle = (domainKey) => {
    setFormData(prev => ({
      ...prev,
      domains: prev.domains.includes(domainKey)
        ? prev.domains.filter(d => d !== domainKey)
        : [...prev.domains, domainKey]
    }));
  };

  const selectAllPermissions = () => {
    setFormData(prev => ({
      ...prev,
      permissions: permissions.map(p => p.key || p.permissionId)
    }));
  };

  const clearAllPermissions = () => {
    setFormData(prev => ({ ...prev, permissions: [] }));
  };

  const selectAllDomains = () => {
    setFormData(prev => ({
      ...prev,
      domains: domains.map(d => d.key)
    }));
  };

  const clearAllDomains = () => {
    setFormData(prev => ({ ...prev, domains: [] }));
  };

  // Group permissions by module
  const permissionsByModule = permissions.reduce((acc, perm) => {
    const module = perm.module || 'Other';
    if (!acc[module]) acc[module] = [];
    acc[module].push(perm);
    return acc;
  }, {});

  const columns = [
    { key: 'groupId', title: 'Group ID' },
    { key: 'name', title: 'Name' },
    { key: 'description', title: 'Description' },
    {
      key: 'permissions',
      title: 'Permissions',
      render: (val) => (
        <div className="flex flex-wrap gap-1">
          {(val || []).slice(0, 2).map((p) => (
            <Badge key={p} variant="primary">{p}</Badge>
          ))}
          {(val || []).length > 2 && <Badge variant="default">+{val.length - 2}</Badge>}
        </div>
      ),
    },
    {
      key: 'domains',
      title: 'Domains',
      render: (val) => (
        <div className="flex flex-wrap gap-1">
          {(val || []).slice(0, 2).map((d) => (
            <Badge key={d} variant="success">{d}</Badge>
          ))}
          {(val || []).length > 2 && <Badge variant="default">+{val.length - 2}</Badge>}
        </div>
      ),
    },
    {
      key: 'status',
      title: 'Status',
      render: (val) => (
        <Badge variant={val === 'active' ? 'success' : 'danger'}>
          {val || 'active'}
        </Badge>
      ),
    },
    { key: 'priority', title: 'Priority' },
    {
      key: 'actions',
      title: 'Actions',
      render: (_, item) => (
        <div className="flex items-center space-x-2">
          <button
            onClick={(e) => { e.stopPropagation(); openEditModal(item); }}
            className="p-1 text-gray-500 hover:text-primary-600"
            title="Edit"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleDelete(item); }}
            className="p-1 text-red-500 hover:text-red-600"
            title="Delete"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Groups</h1>
          <p className="text-gray-500 mt-1">Manage user groups and their permissions</p>
        </div>
        <Button onClick={() => { resetForm(); setModalOpen(true); }}>
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Group
        </Button>
      </div>

      {/* Search */}
      <Card className="p-4">
        <SearchInput
          value={search}
          onChange={(val) => { setSearch(val); setPagination(prev => ({ ...prev, page: 0 })); }}
          placeholder="Search by group ID or name..."
        />
      </Card>

      {/* Table */}
      <Card>
        <Table columns={columns} data={groups} loading={loading} />
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

      {/* Create/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); resetForm(); }}
        title={editingItem ? 'Edit Group' : 'Add Group'}
        size="xl"
      >
        <form onSubmit={editingItem ? handleUpdate : handleCreate}>
          <div className="space-y-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Group ID *"
                value={formData.groupId}
                onChange={(e) => setFormData({ ...formData, groupId: e.target.value })}
                placeholder="admin-group"
                required
                disabled={!!editingItem}
              />
              <Input
                label="Name *"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Administrators"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                rows={2}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Group description..."
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <Select
                label="Status"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                options={[
                  { value: 'active', label: 'Active' },
                  { value: 'inactive', label: 'Inactive' }
                ]}
              />
              <Input
                label="Priority"
                type="number"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
              />
              <Select
                label="Type"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                options={[
                  { value: 'custom', label: 'Custom' },
                  { value: 'system', label: 'System' }
                ]}
              />
            </div>

            {/* Permissions Selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Permissions ({formData.permissions.length} selected)
                </label>
                <div className="space-x-2">
                  <button type="button" onClick={selectAllPermissions} className="text-xs text-primary-600 hover:text-primary-700">
                    Select All
                  </button>
                  <button type="button" onClick={clearAllPermissions} className="text-xs text-red-600 hover:text-red-700">
                    Clear All
                  </button>
                </div>
              </div>
              <div className="border rounded-lg max-h-48 overflow-y-auto p-3 bg-gray-50">
                {Object.entries(permissionsByModule).map(([module, perms]) => (
                  <div key={module} className="mb-3 last:mb-0">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">{module}</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {perms.map((perm) => {
                        const permKey = perm.key || perm.permissionId;
                        return (
                          <label
                            key={permKey}
                            className={`flex items-center p-2 rounded border cursor-pointer transition-colors ${
                              formData.permissions.includes(permKey)
                                ? 'bg-primary-50 border-primary-300'
                                : 'bg-white border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={formData.permissions.includes(permKey)}
                              onChange={() => handlePermissionToggle(permKey)}
                              className="h-4 w-4 text-primary-600 rounded"
                            />
                            <span className="ml-2 text-sm text-gray-700">{perm.name || permKey}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {permissions.length === 0 && (
                  <p className="text-gray-500 text-sm text-center py-4">No permissions available</p>
                )}
              </div>
            </div>

            {/* Domains Selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Domains ({formData.domains.length} selected)
                </label>
                <div className="space-x-2">
                  <button type="button" onClick={selectAllDomains} className="text-xs text-primary-600 hover:text-primary-700">
                    Select All
                  </button>
                  <button type="button" onClick={clearAllDomains} className="text-xs text-red-600 hover:text-red-700">
                    Clear All
                  </button>
                </div>
              </div>
              <div className="border rounded-lg max-h-40 overflow-y-auto p-3 bg-gray-50">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {domains.map((domain) => (
                    <label
                      key={domain.key}
                      className={`flex items-center p-2 rounded border cursor-pointer transition-colors ${
                        formData.domains.includes(domain.key)
                          ? 'bg-green-50 border-green-300'
                          : 'bg-white border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={formData.domains.includes(domain.key)}
                        onChange={() => handleDomainToggle(domain.key)}
                        className="h-4 w-4 text-green-600 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">{domain.name}</span>
                    </label>
                  ))}
                </div>
                {domains.length === 0 && (
                  <p className="text-gray-500 text-sm text-center py-4">No domains available</p>
                )}
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-3 pt-6 border-t mt-6">
            <Button type="button" variant="secondary" onClick={() => { setModalOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button type="submit">
              {editingItem ? 'Update Group' : 'Create Group'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Groups;
