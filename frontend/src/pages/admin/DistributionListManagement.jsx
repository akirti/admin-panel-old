import { useState, useEffect, useCallback } from 'react';
import { Input, Modal, Toggle, Badge } from '../../components/shared';
import { distributionListsAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { Search, Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Mail, ChevronLeft, ChevronRight, X } from 'lucide-react';

const DistributionListManagement = () => {
  const [lists, setLists] = useState([]);
  const [listTypes, setListTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [pagination, setPagination] = useState({ page: 0, limit: 25, total: 0, pages: 0 });

  // Form state
  const [formData, setFormData] = useState({
    key: '',
    name: '',
    description: '',
    type: 'custom',
    emails: [],
    is_active: true
  });

  // Email input state
  const [newEmail, setNewEmail] = useState('');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPagination(prev => ({ ...prev, page: 0 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [listsRes, typesRes] = await Promise.all([
        distributionListsAPI.list({
          search: debouncedSearch || undefined,
          type: typeFilter || undefined,
          page: pagination.page,
          limit: pagination.limit,
          include_inactive: true
        }),
        distributionListsAPI.getTypes()
      ]);
      setLists(listsRes.data.data || []);
      setPagination(prev => ({ ...prev, ...(listsRes.data.pagination || {}) }));
      setListTypes(typesRes.data.types || []);
    } catch (error) {
      toast.error('Failed to load distribution lists');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, typeFilter, pagination.page, pagination.limit]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const resetForm = () => {
    setFormData({
      key: '',
      name: '',
      description: '',
      type: 'custom',
      emails: [],
      is_active: true
    });
    setEditingItem(null);
    setNewEmail('');
  };

  const openCreateModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setFormData({
      key: item.key || '',
      name: item.name || '',
      description: item.description || '',
      type: item.type || 'custom',
      emails: item.emails || [],
      is_active: item.is_active !== false
    });
    setNewEmail('');
    setModalOpen(true);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await distributionListsAPI.create(formData);
      toast.success('Distribution list created successfully');
      setModalOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create distribution list');
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await distributionListsAPI.update(editingItem._id, formData);
      toast.success('Distribution list updated successfully');
      setModalOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update distribution list');
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Are you sure you want to delete "${item.name}"?`)) return;
    try {
      await distributionListsAPI.delete(item._id);
      toast.success('Distribution list deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete distribution list');
    }
  };

  const handleToggleStatus = async (item) => {
    try {
      await distributionListsAPI.toggleStatus(item._id);
      toast.success(`Distribution list ${item.is_active ? 'deactivated' : 'activated'}`);
      fetchData();
    } catch (error) {
      toast.error('Failed to toggle status');
    }
  };

  const addEmail = () => {
    if (!newEmail) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      toast.error('Please enter a valid email address');
      return;
    }
    if (formData.emails.includes(newEmail)) {
      toast.error('Email already in the list');
      return;
    }
    setFormData(prev => ({
      ...prev,
      emails: [...prev.emails, newEmail]
    }));
    setNewEmail('');
  };

  const removeEmail = (emailToRemove) => {
    setFormData(prev => ({
      ...prev,
      emails: prev.emails.filter(email => email !== emailToRemove)
    }));
  };

  const getTypeLabel = (value) => {
    const typeObj = listTypes.find(t => t.value === value);
    return typeObj?.label || value;
  };

  const getTypeBadgeVariant = (type) => {
    const variants = {
      scenario_request: 'primary',
      feedback: 'info',
      system_alert: 'danger',
      system_notification: 'warning',
      configuration_update: 'secondary',
      no_reply: 'dark',
      support: 'success',
      custom: 'secondary'
    };
    return variants[type] || 'secondary';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Distribution Lists</h1>
          <p className="text-neutral-500 text-sm mt-1">
            Manage email distribution lists for notifications ({pagination.total || 0} total)
          </p>
        </div>
        <button className="btn btn-primary flex items-center gap-2" onClick={openCreateModal}>
          <Plus size={16} />
          Add Distribution List
        </button>
      </div>

      {/* Search and Filter */}
      <div className="card">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={20} />
            <input
              type="text"
              placeholder="Search by name or key..."
              className="input pl-10 w-full"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="input w-48"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">All Types</option>
            {listTypes.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Distribution Lists Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-neutral-500">Loading distribution lists...</div>
        ) : lists.length === 0 ? (
          <div className="p-8 text-center text-neutral-500">
            <Mail className="mx-auto mb-4 text-neutral-400" size={48} />
            <p>No distribution lists found. Click "Add Distribution List" to create one.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Recipients</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {lists.map((item) => (
                  <tr key={item._id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-neutral-900">{item.name}</div>
                      <div className="text-xs text-neutral-500">{item.key}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={getTypeBadgeVariant(item.type)}>
                        {getTypeLabel(item.type)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <span className="font-medium">{item.emails?.length || 0}</span>
                        <span className="text-neutral-500 text-sm">emails</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={item.is_active ? 'success' : 'warning'}>
                        {item.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          className="w-9 h-9 flex items-center justify-center text-neutral-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          onClick={() => openEditModal(item)}
                          title="Edit"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${item.is_active ? 'text-neutral-500 hover:text-orange-600 hover:bg-orange-50' : 'text-neutral-500 hover:text-green-600 hover:bg-green-50'}`}
                          onClick={() => handleToggleStatus(item)}
                          title={item.is_active ? 'Disable' : 'Enable'}
                        >
                          {item.is_active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                        </button>
                        <button
                          className="w-9 h-9 flex items-center justify-center text-neutral-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          onClick={() => handleDelete(item)}
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
        {pagination.pages > 1 && (
          <div className="px-4 py-3 border-t flex items-center justify-between">
            <span className="text-sm text-neutral-500">
              Showing {pagination.page * pagination.limit + 1} to {Math.min((pagination.page + 1) * pagination.limit, pagination.total)} of {pagination.total}
            </span>
            <div className="flex gap-2">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page === 0}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page >= pagination.pages - 1}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); resetForm(); }}
        title={editingItem ? 'Edit Distribution List' : 'Create Distribution List'}
        size="lg"
      >
        <form onSubmit={editingItem ? handleUpdate : handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Key"
              value={formData.key}
              onChange={(e) => setFormData(prev => ({ ...prev, key: e.target.value }))}
              placeholder="unique-key"
              required
              disabled={!!editingItem}
            />
            <Input
              label="Name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Distribution List Name"
              required
            />
          </div>

          <Input
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Optional description"
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Type</label>
              <select
                className="input w-full"
                value={formData.type}
                onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
              >
                {listTypes.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Toggle
                checked={formData.is_active}
                onChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
              />
              <span className="text-sm">Active</span>
            </div>
          </div>

          {/* Email Management */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-neutral-700">Email Recipients</label>
            <div className="flex gap-2">
              <input
                type="email"
                className="input flex-1"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="email@example.com"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEmail(); } }}
              />
              <button type="button" className="btn btn-secondary" onClick={addEmail}>Add</button>
            </div>

            {/* Email List */}
            {formData.emails.length > 0 ? (
              <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                {formData.emails.map((email, index) => (
                  <div key={index} className="flex items-center justify-between bg-neutral-50 rounded px-3 py-2">
                    <span className="text-sm">{email}</span>
                    <button
                      type="button"
                      onClick={() => removeEmail(email)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-neutral-500 italic">No emails added yet</p>
            )}
            <p className="text-xs text-neutral-500">
              {formData.emails.length} recipient{formData.emails.length !== 1 ? 's' : ''} in this list
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <button type="button" className="btn btn-secondary" onClick={() => { setModalOpen(false); resetForm(); }}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {editingItem ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default DistributionListManagement;
