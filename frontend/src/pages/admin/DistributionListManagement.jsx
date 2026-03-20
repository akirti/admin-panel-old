import { useState, useEffect, useCallback } from 'react';
import { Input, Modal, Toggle, Badge, Table } from '../../components/shared';
import { distributionListsAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { Search, Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Mail, ChevronLeft, ChevronRight, X } from 'lucide-react';

const TYPE_BADGE_VARIANTS = {
  scenario_request: 'primary',
  feedback: 'info',
  system_alert: 'danger',
  system_notification: 'warning',
  configuration_update: 'secondary',
  no_reply: 'dark',
  support: 'success',
  custom: 'secondary',
};

const getTypeBadgeVariant = (type) => {
  return TYPE_BADGE_VARIANTS[type] || 'secondary';
};

const getTypeLabel = (listTypes, value) => {
  const typeObj = listTypes.find(t => t.value === value);
  return typeObj?.label || value;
};

const getDistributionColumns = (listTypes, onEdit, onToggleStatus, onDelete) => [
  {
    key: 'name',
    title: 'Name',
    render: (val, row) => (
      <div>
        <div className="font-medium text-content">{val}</div>
        <div className="text-xs text-content-muted">{row.key}</div>
      </div>
    ),
    sortValue: (val) => val?.toLowerCase(),
  },
  {
    key: 'type',
    title: 'Type',
    render: (val) => (
      <Badge variant={getTypeBadgeVariant(val)}>
        {getTypeLabel(listTypes, val)}
      </Badge>
    ),
    filterValue: (val) => getTypeLabel(listTypes, val),
  },
  {
    key: 'emails',
    title: 'Recipients',
    render: (val) => (
      <div className="flex items-center gap-1">
        <span className="font-medium">{val?.length || 0}</span>
        <span className="text-content-muted text-sm">emails</span>
      </div>
    ),
    sortValue: (val) => val?.length || 0,
    filterable: false,
  },
  {
    key: 'is_active',
    title: 'Status',
    render: (val) => (
      <Badge variant={val ? 'success' : 'warning'}>
        {val ? 'Active' : 'Inactive'}
      </Badge>
    ),
    filterValue: (val) => val ? 'Active' : 'Inactive',
  },
  {
    key: 'actions',
    title: 'Actions',
    render: (_, row) => (
      <div className="flex justify-end gap-1">
        <button
          className="w-9 h-9 flex items-center justify-center text-content-muted hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
          onClick={(e) => { e.stopPropagation(); onEdit(row); }}
          title="Edit"
        >
          <Edit2 size={18} />
        </button>
        <button
          className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${row.is_active ? 'text-content-muted hover:text-orange-600 hover:bg-orange-50' : 'text-content-muted hover:text-green-600 hover:bg-green-50'}`}
          onClick={(e) => { e.stopPropagation(); onToggleStatus(row); }}
          title={row.is_active ? 'Disable' : 'Enable'}
        >
          {row.is_active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
        </button>
        <button
          className="w-9 h-9 flex items-center justify-center text-content-muted hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          onClick={(e) => { e.stopPropagation(); onDelete(row); }}
          title="Delete"
        >
          <Trash2 size={18} />
        </button>
      </div>
    ),
  },
];

function EmailManager({ emails, newEmail, onNewEmailChange, onAddEmail, onRemoveEmail }) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-content-secondary">Email Recipients</label>
      <div className="flex gap-2">
        <input
          type="email"
          className="input flex-1"
          value={newEmail}
          onChange={(e) => onNewEmailChange(e.target.value)}
          placeholder="email@example.com"
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onAddEmail(); } }}
        />
        <button type="button" className="btn btn-secondary" onClick={onAddEmail}>Add</button>
      </div>

      {/* Email List */}
      {emails.length > 0 ? (
        <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
          {emails.map((email, index) => (
            <div key={index} className="flex items-center justify-between bg-surface-secondary rounded px-3 py-2">
              <span className="text-sm">{email}</span>
              <button
                type="button"
                onClick={() => onRemoveEmail(email)}
                className="text-red-500 hover:text-red-700"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-content-muted italic">No emails added yet</p>
      )}
      <p className="text-xs text-content-muted">
        {emails.length} recipient{emails.length !== 1 ? 's' : ''} in this list
      </p>
    </div>
  );
}

function DistributionForm({ formData, setFormData, listTypes, editingItem, newEmail, onNewEmailChange, onAddEmail, onRemoveEmail, onSubmit, onCancel }) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
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
          <label className="block text-sm font-medium text-content-secondary mb-1">Type</label>
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
            enabled={formData.is_active}
            onChange={(val) => setFormData(prev => ({ ...prev, is_active: val }))}
            label="Active"
          />
        </div>
      </div>

      {/* Email Management */}
      <EmailManager
        emails={formData.emails}
        newEmail={newEmail}
        onNewEmailChange={onNewEmailChange}
        onAddEmail={onAddEmail}
        onRemoveEmail={onRemoveEmail}
      />

      <div className="flex justify-end gap-2 pt-4 border-t">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary">
          {editingItem ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  );
}

/* ─── Default form data ─── */
const DEFAULT_DL_FORM = { key: '', name: '', description: '', type: 'custom', emails: [], is_active: true };

/* ─── Email validation helper ─── */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateAndAddEmail(newEmail, currentEmails) {
  if (!newEmail) return { valid: false };
  if (!EMAIL_REGEX.test(newEmail)) return { valid: false, error: 'Please enter a valid email address' };
  if (currentEmails.includes(newEmail)) return { valid: false, error: 'Email already in the list' };
  return { valid: true };
}

/* ─── Build form data from item ─── */
function buildDLFormData(item) {
  return {
    key: item.key || '', name: item.name || '', description: item.description || '',
    type: item.type || 'custom', emails: item.emails || [], is_active: item.is_active !== false,
  };
}

/* ─── Search and Filter Bar ─── */
function DLSearchFilter({ search, onSearchChange, typeFilter, onTypeFilterChange, listTypes }) {
  return (
    <div className="card">
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" size={20} />
          <input type="text" placeholder="Search by name or key..." className="input pl-10 w-full" value={search} onChange={(e) => onSearchChange(e.target.value)} />
        </div>
        <select className="input w-48" value={typeFilter} onChange={(e) => onTypeFilterChange(e.target.value)}>
          <option value="">All Types</option>
          {listTypes.map(type => (<option key={type.value} value={type.value}>{type.label}</option>))}
        </select>
      </div>
    </div>
  );
}

/* ─── Pagination Controls ─── */
function DLPagination({ pagination, onPrev, onNext }) {
  if (pagination.pages <= 1) return null;
  return (
    <div className="px-4 py-3 border-t flex items-center justify-between">
      <span className="text-sm text-content-muted">
        Showing {pagination.page * pagination.limit + 1} to {Math.min((pagination.page + 1) * pagination.limit, pagination.total)} of {pagination.total}
      </span>
      <div className="flex gap-2">
        <button className="btn btn-secondary btn-sm" onClick={onPrev} disabled={pagination.page === 0}><ChevronLeft size={16} /></button>
        <button className="btn btn-secondary btn-sm" onClick={onNext} disabled={pagination.page >= pagination.pages - 1}><ChevronRight size={16} /></button>
      </div>
    </div>
  );
}

/* ─── API helpers (outside component to reduce cognitive complexity) ─── */

async function createDistributionList(formData, onSuccess) {
  try {
    await distributionListsAPI.create(formData);
    toast.success('Distribution list created successfully');
    onSuccess();
  } catch (error) {
    toast.error(error.response?.data?.detail || 'Failed to create distribution list');
  }
}

async function updateDistributionList(id, formData, onSuccess) {
  try {
    await distributionListsAPI.update(id, formData);
    toast.success('Distribution list updated successfully');
    onSuccess();
  } catch (error) {
    toast.error(error.response?.data?.detail || 'Failed to update distribution list');
  }
}

async function deleteDistributionList(item, onSuccess) {
  if (!window.confirm(`Are you sure you want to delete "${item.name}"?`)) return;
  try {
    await distributionListsAPI.delete(item._id);
    toast.success('Distribution list deleted');
    onSuccess();
  } catch (error) { toast.error('Failed to delete distribution list'); }
}

async function toggleDistributionListStatus(item, onSuccess) {
  try {
    await distributionListsAPI.toggleStatus(item._id);
    toast.success(`Distribution list ${item.is_active ? 'deactivated' : 'activated'}`);
    onSuccess();
  } catch (error) { toast.error('Failed to toggle status'); }
}

function handleAddEmail(newEmail, formData, setFormData, setNewEmail) {
  const result = validateAndAddEmail(newEmail, formData.emails);
  if (!result.valid) {
    if (result.error) toast.error(result.error);
    return;
  }
  setFormData(prev => ({ ...prev, emails: [...prev.emails, newEmail] }));
  setNewEmail('');
}

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
  const [formData, setFormData] = useState({ ...DEFAULT_DL_FORM });
  const [newEmail, setNewEmail] = useState('');

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
        distributionListsAPI.list({ search: debouncedSearch || undefined, type: typeFilter || undefined, page: pagination.page, limit: pagination.limit, include_inactive: true }),
        distributionListsAPI.getTypes()
      ]);
      const listsData = listsRes?.data || {};
      setLists(listsData.data || []);
      setPagination(prev => ({ ...prev, ...(listsData.pagination || {}) }));
      setListTypes(typesRes?.data?.types || []);
    } catch (error) {
      toast.error('Failed to load distribution lists');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, typeFilter, pagination.page, pagination.limit]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const resetForm = () => {
    setFormData({ ...DEFAULT_DL_FORM });
    setEditingItem(null);
    setNewEmail('');
  };

  const closeModalAndReset = () => { setModalOpen(false); resetForm(); };

  const onSaveSuccess = () => { closeModalAndReset(); fetchData(); };

  const openCreateModal = () => { resetForm(); setModalOpen(true); };

  const openEditModal = (item) => {
    setEditingItem(item);
    setFormData(buildDLFormData(item));
    setNewEmail('');
    setModalOpen(true);
  };

  const handleCreate = (e) => { e.preventDefault(); createDistributionList(formData, onSaveSuccess); };
  const handleUpdate = (e) => { e.preventDefault(); updateDistributionList(editingItem._id, formData, onSaveSuccess); };
  const handleDelete = (item) => deleteDistributionList(item, fetchData);
  const handleToggleStatus = (item) => toggleDistributionListStatus(item, fetchData);
  const addEmail = () => handleAddEmail(newEmail, formData, setFormData, setNewEmail);

  const removeEmail = (emailToRemove) => {
    setFormData(prev => ({ ...prev, emails: prev.emails.filter(email => email !== emailToRemove) }));
  };

  const handlePrev = () => setPagination(prev => ({ ...prev, page: prev.page - 1 }));
  const handleNext = () => setPagination(prev => ({ ...prev, page: prev.page + 1 }));
  const modalTitle = editingItem ? 'Edit Distribution List' : 'Create Distribution List';
  const handleSubmit = editingItem ? handleUpdate : handleCreate;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-content">Distribution Lists</h1>
          <p className="text-content-muted text-sm mt-1">Manage email distribution lists for notifications ({pagination.total || 0} total)</p>
        </div>
        <button className="btn btn-primary flex items-center gap-2" onClick={openCreateModal}><Plus size={16} />Add Distribution List</button>
      </div>

      <DLSearchFilter search={search} onSearchChange={setSearch} typeFilter={typeFilter} onTypeFilterChange={setTypeFilter} listTypes={listTypes} />

      <div className="card overflow-hidden">
        <Table
          columns={getDistributionColumns(listTypes, openEditModal, handleToggleStatus, handleDelete)}
          data={lists}
          loading={loading}
          emptyMessage="No distribution lists found. Click 'Add Distribution List' to create one."
        />
        <DLPagination pagination={pagination} onPrev={handlePrev} onNext={handleNext} />
      </div>

      <Modal isOpen={modalOpen} onClose={closeModalAndReset} title={modalTitle} size="lg">
        <DistributionForm
          formData={formData} setFormData={setFormData} listTypes={listTypes} editingItem={editingItem}
          newEmail={newEmail} onNewEmailChange={setNewEmail} onAddEmail={addEmail} onRemoveEmail={removeEmail}
          onSubmit={handleSubmit} onCancel={closeModalAndReset}
        />
      </Modal>
    </div>
  );
};

export default DistributionListManagement;
