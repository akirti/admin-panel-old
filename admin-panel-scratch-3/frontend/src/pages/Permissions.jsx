import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Input, Table, Modal, Badge, SearchInput, Select, Pagination } from '../components/shared';
import { permissionsAPI } from '../services/api';
import toast from 'react-hot-toast';

const Permissions = () => {
  const [permissions, setPermissions] = useState([]);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [relationshipModalOpen, setRelationshipModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [selectedPermission, setSelectedPermission] = useState(null);
  const [permissionRoles, setPermissionRoles] = useState([]);
  const [permissionGroups, setPermissionGroups] = useState([]);
  const [pagination, setPagination] = useState({ page: 0, limit: 25, total: 0, pages: 0 });

  // Form state
  const [formData, setFormData] = useState({
    key: '',
    name: '',
    description: '',
    module: '',
    actions: ['read']
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [permsRes, modulesRes] = await Promise.all([
        permissionsAPI.list({
          search: search || undefined,
          module: moduleFilter || undefined,
          page: pagination.page,
          limit: pagination.limit
        }),
        permissionsAPI.getModules()
      ]);
      setPermissions(permsRes.data.data || permsRes.data);
      setPagination(prev => ({ ...prev, ...(permsRes.data.pagination || {}) }));
      setModules(modulesRes.data.modules || []);
    } catch (error) {
      toast.error('Failed to load permissions');
    } finally {
      setLoading(false);
    }
  }, [search, moduleFilter, pagination.page, pagination.limit]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const resetForm = () => {
    setFormData({
      key: '',
      name: '',
      description: '',
      module: '',
      actions: ['read']
    });
    setEditingItem(null);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await permissionsAPI.create(formData);
      toast.success('Permission created successfully');
      setModalOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create permission');
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await permissionsAPI.update(editingItem.key, formData);
      toast.success('Permission updated successfully');
      setModalOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update permission');
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm('Are you sure you want to delete this permission? This will remove it from all roles and groups.')) return;
    try {
      await permissionsAPI.delete(item.key);
      toast.success('Permission deleted successfully');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete permission');
    }
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setFormData({
      key: item.key || '',
      name: item.name || '',
      description: item.description || '',
      module: item.module || '',
      actions: item.actions || ['read']
    });
    setModalOpen(true);
  };

  const openRelationshipModal = async (permission) => {
    setSelectedPermission(permission);
    try {
      const [rolesRes, groupsRes] = await Promise.all([
        permissionsAPI.getRoles(permission.key),
        permissionsAPI.getGroups(permission.key)
      ]);
      setPermissionRoles(rolesRes.data || []);
      setPermissionGroups(groupsRes.data || []);
      setRelationshipModalOpen(true);
    } catch (error) {
      toast.error('Failed to load relationships');
    }
  };

  const handleActionChange = (action, checked) => {
    setFormData(prev => ({
      ...prev,
      actions: checked
        ? [...prev.actions, action]
        : prev.actions.filter(a => a !== action)
    }));
  };

  const commonActions = ['create', 'read', 'update', 'delete', 'list', 'export', 'import'];

  // Group permissions by module
  const permissionsByModule = permissions.reduce((acc, perm) => {
    const module = perm.module || 'Other';
    if (!acc[module]) acc[module] = [];
    acc[module].push(perm);
    return acc;
  }, {});

  const columns = [
    { key: 'key', title: 'Key' },
    { key: 'name', title: 'Name' },
    { key: 'module', title: 'Module', render: (val) => <Badge variant="info">{val}</Badge> },
    {
      key: 'actions',
      title: 'Actions',
      render: (val) => (
        <div className="flex flex-wrap gap-1">
          {(val || []).slice(0, 3).map((a) => (
            <Badge key={a} variant="primary">{a}</Badge>
          ))}
          {(val || []).length > 3 && <Badge variant="default">+{val.length - 3}</Badge>}
        </div>
      ),
    },
    {
      key: 'created_at',
      title: 'Created',
      render: (val) => val ? new Date(val).toLocaleDateString() : 'N/A',
    },
    {
      key: 'actions_col',
      title: 'Manage',
      render: (_, item) => (
        <div className="flex items-center space-x-2">
          <button
            onClick={(e) => { e.stopPropagation(); openRelationshipModal(item); }}
            className="p-1 text-purple-500 hover:text-purple-600"
            title="View Roles & Groups"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </button>
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
          <h1 className="text-2xl font-bold text-gray-900">Permissions</h1>
          <p className="text-gray-500 mt-1">Manage granular system permissions by module</p>
        </div>
        <Button onClick={() => { resetForm(); setModalOpen(true); }}>
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Permission
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SearchInput
            value={search}
            onChange={(val) => { setSearch(val); setPagination(prev => ({ ...prev, page: 0 })); }}
            placeholder="Search by key or name..."
          />
          <Select
            label="Filter by Module"
            value={moduleFilter}
            onChange={(e) => { setModuleFilter(e.target.value); setPagination(prev => ({ ...prev, page: 0 })); }}
            options={[
              { value: '', label: 'All Modules' },
              ...modules.map(m => ({ value: m, label: m }))
            ]}
          />
        </div>
      </Card>

      {/* Module Statistics */}
      {!moduleFilter && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(permissionsByModule).slice(0, 4).map(([module, perms]) => (
            <Card key={module} className="p-4">
              <div className="text-sm text-gray-500">{module}</div>
              <div className="text-2xl font-bold text-gray-900">{perms.length}</div>
              <div className="text-xs text-gray-400">permissions</div>
            </Card>
          ))}
        </div>
      )}

      {/* Table */}
      <Card>
        <Table columns={columns} data={permissions} loading={loading} />
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
        title={editingItem ? 'Edit Permission' : 'Add Permission'}
        size="lg"
      >
        <form onSubmit={editingItem ? handleUpdate : handleCreate}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Permission Key *"
                value={formData.key}
                onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                placeholder="users.create"
                required
                disabled={!!editingItem}
              />
              <Input
                label="Name *"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Create Users"
                required
              />
            </div>

            <Input
              label="Module *"
              value={formData.module}
              onChange={(e) => setFormData({ ...formData, module: e.target.value })}
              placeholder="Users"
              required
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                rows={2}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Permission description..."
              />
            </div>

            {/* Actions Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Actions ({formData.actions.length} selected)
              </label>
              <div className="border rounded-lg p-3 bg-gray-50">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {commonActions.map((action) => (
                    <label
                      key={action}
                      className={`flex items-center p-2 rounded border cursor-pointer transition-colors ${
                        formData.actions.includes(action)
                          ? 'bg-primary-50 border-primary-300'
                          : 'bg-white border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={formData.actions.includes(action)}
                        onChange={(e) => handleActionChange(action, e.target.checked)}
                        className="h-4 w-4 text-primary-600 rounded mr-2"
                      />
                      <span className="text-sm capitalize">{action}</span>
                    </label>
                  ))}
                </div>

                {/* Custom action input */}
                <div className="mt-3 pt-3 border-t">
                  <Input
                    label="Add Custom Action"
                    placeholder="custom-action"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const value = e.target.value.trim();
                        if (value && !formData.actions.includes(value)) {
                          setFormData(prev => ({
                            ...prev,
                            actions: [...prev.actions, value]
                          }));
                          e.target.value = '';
                        }
                      }
                    }}
                  />
                  <p className="text-xs text-gray-500 mt-1">Press Enter to add custom actions</p>
                </div>

                {/* Display selected actions */}
                {formData.actions.length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs font-medium text-gray-700 mb-2">Selected Actions:</p>
                    <div className="flex flex-wrap gap-1">
                      {formData.actions.map((action) => (
                        <Badge
                          key={action}
                          variant="primary"
                          className="cursor-pointer"
                          onClick={() => handleActionChange(action, false)}
                        >
                          {action} ×
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-6 border-t mt-6">
            <Button type="button" variant="secondary" onClick={() => { setModalOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button type="submit">
              {editingItem ? 'Update Permission' : 'Create Permission'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Relationship Modal */}
      <Modal
        isOpen={relationshipModalOpen}
        onClose={() => setRelationshipModalOpen(false)}
        title={`Permission Usage - ${selectedPermission?.name}`}
        size="xl"
      >
        <div className="space-y-6">
          {/* Roles using this permission */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Roles with this Permission ({permissionRoles.length})</h3>
            {permissionRoles.length > 0 ? (
              <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                {permissionRoles.map((role) => (
                  <div key={role.roleId} className="p-3 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{role.name}</p>
                        <p className="text-sm text-gray-500">{role.roleId}</p>
                      </div>
                      <Badge variant={role.status === 'active' ? 'success' : 'danger'}>
                        {role.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4 border rounded-lg">No roles have this permission</p>
            )}
          </div>

          {/* Groups using this permission */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Groups with this Permission ({permissionGroups.length})</h3>
            {permissionGroups.length > 0 ? (
              <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                {permissionGroups.map((group) => (
                  <div key={group.groupId} className="p-3 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{group.name}</p>
                        <p className="text-sm text-gray-500">{group.groupId}</p>
                      </div>
                      <Badge variant={group.status === 'active' ? 'success' : 'danger'}>
                        {group.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4 border rounded-lg">No groups have this permission</p>
            )}
          </div>

          {/* Permission Details */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-semibold mb-2">Permission Details</h4>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-gray-600">Key:</dt>
              <dd className="font-mono">{selectedPermission?.key}</dd>
              <dt className="text-gray-600">Module:</dt>
              <dd>{selectedPermission?.module}</dd>
              <dt className="text-gray-600">Actions:</dt>
              <dd className="flex flex-wrap gap-1">
                {(selectedPermission?.actions || []).map(a => (
                  <Badge key={a} variant="primary" size="sm">{a}</Badge>
                ))}
              </dd>
            </dl>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Permissions;
