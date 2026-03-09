import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Modal, Badge } from '../../components/shared';
import { domainAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { Layers, Plus, Edit2, Trash2, X, Search, Image } from 'lucide-react';
import LucideIconPicker from '../../components/shared/LucideIconPicker';

/* ─── helpers (outside component) ─── */

function getSubmitLabel(saving, editing) {
  if (saving) return 'Saving...';
  return editing ? 'Update' : 'Create';
}

/* ─── Domain Icon Cell ─── */
function DomainIconCell({ domain }) {
  return (
    <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center overflow-hidden">
      {domain.icon ? (
        <img
          src={domain.icon}
          alt={domain.name}
          className="w-6 h-6 object-contain"
          onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
        />
      ) : null}
      <Layers className="text-primary-600" size={20} style={{ display: domain.icon ? 'none' : 'block' }} />
    </div>
  );
}

/* ─── Domain Row ─── */
function DomainRow({ domain, onEdit, onDelete }) {
  return (
    <tr className="border-b hover:bg-surface-hover">
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          <DomainIconCell domain={domain} />
          <div>
            <p className="font-medium text-content">{domain.name}</p>
            {domain.description && <p className="text-sm text-content-muted line-clamp-1">{domain.description}</p>}
          </div>
        </div>
      </td>
      <td className="py-3 px-4"><code className="text-sm bg-surface-hover px-2 py-1 rounded">{domain.key}</code></td>
      <td className="py-3 px-4 text-sm text-content-muted">{domain.path || '-'}</td>
      <td className="py-3 px-4 text-sm text-content-muted">{domain.order || 0}</td>
      <td className="py-3 px-4">
        <Badge variant={domain.status === 'active' ? 'success' : 'default'}>
          {domain.status === 'active' ? 'Active' : 'Inactive'}
        </Badge>
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-1">
          <button onClick={() => onEdit(domain)} className="w-9 h-9 flex items-center justify-center text-content-muted hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors" title="Edit"><Edit2 size={18} /></button>
          <button onClick={() => onDelete(domain)} className="w-9 h-9 flex items-center justify-center text-content-muted hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><Trash2 size={18} /></button>
        </div>
      </td>
    </tr>
  );
}

/* ─── Domains Table ─── */
function DomainsTable({ loading, filteredDomains, onEdit, onDelete }) {
  if (loading) {
    return (
      <div className="card overflow-hidden">
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      </div>
    );
  }

  if (filteredDomains.length === 0) {
    return (
      <div className="card overflow-hidden">
        <div className="text-center py-12">
          <Layers className="mx-auto text-content-muted mb-4" size={48} />
          <p className="text-content-muted">No domains found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="table-header">
              <th className="text-left py-3 px-4">Domain</th>
              <th className="text-left py-3 px-4">Key</th>
              <th className="text-left py-3 px-4">Path</th>
              <th className="text-left py-3 px-4">Order</th>
              <th className="text-left py-3 px-4">Status</th>
              <th className="text-left py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredDomains.map((domain) => (
              <DomainRow key={domain.key} domain={domain} onEdit={onEdit} onDelete={onDelete} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── SubDomains Section ─── */
function SubDomainsSection({ subDomains, newSubDomain, setNewSubDomain, addSubDomain, removeSubDomain }) {
  return (
    <div>
      <label className="block text-sm font-medium text-content-secondary mb-2">Sub Domains</label>
      <div className="bg-surface-secondary p-3 rounded-lg mb-2">
        <div className="grid grid-cols-3 gap-2 mb-2">
          <input type="text" value={newSubDomain.key} onChange={(e) => setNewSubDomain(prev => ({ ...prev, key: e.target.value }))} className="input-field text-sm" placeholder="Key" />
          <input type="text" value={newSubDomain.name} onChange={(e) => setNewSubDomain(prev => ({ ...prev, name: e.target.value }))} className="input-field text-sm" placeholder="Name" />
          <input type="text" value={newSubDomain.path} onChange={(e) => setNewSubDomain(prev => ({ ...prev, path: e.target.value }))} className="input-field text-sm" placeholder="Path" />
        </div>
        <button type="button" onClick={addSubDomain} disabled={!newSubDomain.key || !newSubDomain.name || !newSubDomain.path} className="btn-secondary text-sm py-1 px-3 flex items-center gap-1">
          <Plus size={14} /> Add SubDomain
        </button>
      </div>
      {subDomains.length > 0 && (
        <div className="space-y-2 max-h-32 overflow-y-auto">
          {subDomains.map((sub, index) => (
            <div key={index} className="flex items-center justify-between bg-primary-50 px-3 py-2 rounded">
              <div className="text-sm">
                <span className="font-medium">{sub.name}</span>
                <span className="text-content-muted ml-2">({sub.key})</span>
                <span className="text-content-muted ml-2">{sub.path}</span>
              </div>
              <button type="button" onClick={() => removeSubDomain(index)} className="text-red-500 hover:text-red-700"><X size={16} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Icon Picker Field ─── */
function IconPickerField({ icon, onChange, onOpenPicker }) {
  return (
    <div>
      <label className="block text-sm font-medium text-content-secondary mb-1">Icon</label>
      <div className="flex gap-3 items-start">
        <div className="flex-1">
          <div className="flex gap-2">
            <input type="text" name="icon" value={icon} onChange={onChange} className="input-field flex-1" placeholder="Icon data URI or URL" />
            <button type="button" onClick={onOpenPicker} className="btn-secondary flex items-center gap-2 whitespace-nowrap"><Image size={16} />Select Icon</button>
            {icon && (
              <button type="button" onClick={() => onChange({ target: { name: 'icon', value: '' } })} className="p-2 text-content-muted hover:text-red-600 hover:bg-red-50 rounded" title="Clear icon"><X size={18} /></button>
            )}
          </div>
          <p className="text-xs text-content-muted mt-1">Click "Select Icon" to choose from Lucide icons, or paste a URL/data URI</p>
        </div>
        {icon && (
          <div className="w-12 h-12 border rounded-lg flex items-center justify-center bg-surface-secondary flex-shrink-0">
            <img src={icon} alt="Icon preview" className="max-w-full max-h-full object-contain" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
            <div className="hidden items-center justify-center text-content-muted text-xs">Invalid</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Domain Type Select ─── */
function DomainTypeSelect({ value, onChange, domainTypes }) {
  return (
    <select name="type" value={value} onChange={onChange} className="input-field">
      {domainTypes.length > 0 ? (
        domainTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)
      ) : (
        <>
          <option value="authentication">Authentication</option>
          <option value="custom">Custom</option>
          <option value="system">System</option>
        </>
      )}
    </select>
  );
}

/* ─── Domain Form (modal body) ─── */
function DomainForm({ formData, handleChange, setFormData, editingDomain, saving, domainTypes, newSubDomain, setNewSubDomain, addSubDomain, removeSubDomain, onSubmit, onCancel, onOpenIconPicker }) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-content-secondary mb-1">Key *</label>
        <input type="text" name="key" value={formData.key} onChange={handleChange} className="input-field" placeholder="domain-key" required disabled={!!editingDomain} />
      </div>
      <div>
        <label className="block text-sm font-medium text-content-secondary mb-1">Name *</label>
        <input type="text" name="name" value={formData.name} onChange={handleChange} className="input-field" placeholder="Domain Name" required />
      </div>
      <div>
        <label className="block text-sm font-medium text-content-secondary mb-1">Description</label>
        <textarea name="description" value={formData.description} onChange={handleChange} className="input-field" rows={3} placeholder="Domain description..." />
      </div>

      <IconPickerField icon={formData.icon} onChange={handleChange} onOpenPicker={onOpenIconPicker} />

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-content-secondary mb-1">Path</label>
          <input type="text" name="path" value={formData.path} onChange={handleChange} className="input-field" placeholder="/path" />
        </div>
        <div>
          <label className="block text-sm font-medium text-content-secondary mb-1">Order</label>
          <input type="number" name="order" value={formData.order} onChange={handleChange} className="input-field" min={0} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-content-secondary mb-1">Type</label>
          <DomainTypeSelect value={formData.type} onChange={handleChange} domainTypes={domainTypes} />
        </div>
        <div>
          <label className="block text-sm font-medium text-content-secondary mb-1">Data Domain</label>
          <input type="text" name="dataDomain" value={formData.dataDomain} onChange={handleChange} className="input-field" placeholder="data-domain-key" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-content-secondary mb-1">Status</label>
          <select name="status" value={formData.status} onChange={handleChange} className="input-field">
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div className="flex items-center pt-6">
          <label className="flex items-center cursor-pointer">
            <input type="checkbox" name="defaultSelected" checked={formData.defaultSelected} onChange={(e) => setFormData(prev => ({ ...prev, defaultSelected: e.target.checked }))} className="w-4 h-4 text-primary-600 border-edge rounded focus:ring-primary-500" />
            <span className="ml-2 text-sm font-medium text-content-secondary">Default Selected</span>
          </label>
        </div>
      </div>

      <SubDomainsSection subDomains={formData.subDomains} newSubDomain={newSubDomain} setNewSubDomain={setNewSubDomain} addSubDomain={addSubDomain} removeSubDomain={removeSubDomain} />

      <div className="flex justify-end gap-3 pt-4">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
        <button type="submit" disabled={saving} className="btn-primary">{getSubmitLabel(saving, editingDomain)}</button>
      </div>
    </form>
  );
}

/* ─── Default sub-domain ─── */
const EMPTY_SUBDOMAIN = { key: '', name: '', path: '' };

/* ─── Default form data factory ─── */
function getDefaultDomainFormData(domainTypes) {
  return {
    key: '', name: '', description: '', path: '', icon: '', order: 0,
    type: domainTypes.length > 0 ? domainTypes[0].value : 'custom',
    dataDomain: '', status: 'active', defaultSelected: false, subDomains: [],
  };
}

/* ─── Build form data from existing domain ─── */
function buildDomainFormData(domain) {
  return {
    key: domain.key, name: domain.name, description: domain.description || '',
    path: domain.path || '', icon: domain.icon || '', order: domain.order || 0,
    type: domain.type || 'custom', dataDomain: domain.dataDomain || '',
    status: domain.status === 'active' ? 'active' : (domain.status || 'active'),
    defaultSelected: domain.defaultSelected || false, subDomains: domain.subDomains || [],
  };
}

/* ─── Domain submit handler (outside component) ─── */
async function submitDomain(editingDomain, formData, onSuccess) {
  if (editingDomain) {
    await domainAPI.update(editingDomain._id, { _id: editingDomain._id, ...formData });
    toast.success('Domain updated successfully');
  } else {
    await domainAPI.create(formData);
    toast.success('Domain created successfully');
  }
  onSuccess();
}

/* ─── Domain delete handler (outside component) ─── */
async function deleteDomain(domain, onSuccess) {
  if (!confirm(`Are you sure you want to delete "${domain.name}"?`)) return;
  try {
    await domainAPI.delete(domain._id || domain.key);
    toast.success('Domain deleted successfully');
    onSuccess();
  } catch (error) { toast.error(error.response?.data?.error || 'Failed to delete domain'); }
}

/* ─── Form change handler (outside component) ─── */
function handleDomainFieldChange(e, setFormData) {
  const { name, value } = e.target;
  const parsedValue = name === 'order' ? parseInt(value) || 0 : value;
  setFormData(prev => ({ ...prev, [name]: parsedValue }));
}

/* ─── Access Denied view ─── */
function DomainsAccessDenied() {
  return (
    <div className="text-center py-12">
      <Layers className="mx-auto text-content-muted mb-4" size={48} />
      <h2 className="text-xl font-semibold text-content mb-2">Access Denied</h2>
      <p className="text-content-muted">You don't have permission to manage domains.</p>
    </div>
  );
}

/* ─── Header with search ─── */
function DomainsHeader({ searchTerm, onSearchChange, onAddNew }) {
  return (
    <div className="flex items-center justify-between">
      <h1 className="text-2xl font-bold text-content">Domains Management</h1>
      <div className="flex items-center gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" size={20} />
          <input type="text" placeholder="Search domains..." value={searchTerm} onChange={(e) => onSearchChange(e.target.value)} className="input-field pl-10 w-64" />
        </div>
        <button onClick={onAddNew} className="btn-primary flex items-center gap-2"><Plus size={18} />Add Domain</button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════ */
function DomainsManagement() {
  const { isEditor } = useAuth();
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDomain, setEditingDomain] = useState(null);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [formData, setFormData] = useState({
    key: '', name: '', description: '', path: '', icon: '', order: 0,
    type: 'custom', dataDomain: '', status: 'active', defaultSelected: false, subDomains: [],
  });
  const [newSubDomain, setNewSubDomain] = useState({ ...EMPTY_SUBDOMAIN });
  const [domainTypes, setDomainTypes] = useState([]);
  const [saving, setSaving] = useState(false);

  const fetchDomains = async () => {
    setLoading(true);
    try {
      const response = await domainAPI.getAll();
      setDomains(response?.data || []);
    } catch (error) { toast.error('Failed to fetch domains'); }
    finally { setLoading(false); }
  };

  const fetchDomainTypes = async () => {
    try {
      const response = await domainAPI.getTypes();
      setDomainTypes(response?.data || []);
    } catch (error) { /* silent */ }
  };

  useEffect(() => { fetchDomains(); fetchDomainTypes(); }, []);

  const handleChange = (e) => handleDomainFieldChange(e, setFormData);

  const resetModalState = () => {
    setNewSubDomain({ ...EMPTY_SUBDOMAIN });
  };

  const openCreateModal = () => {
    setEditingDomain(null);
    setFormData(getDefaultDomainFormData(domainTypes));
    resetModalState();
    setModalOpen(true);
  };

  const openEditModal = (domain) => {
    setEditingDomain(domain);
    setFormData(buildDomainFormData(domain));
    resetModalState();
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingDomain(null);
    setFormData(getDefaultDomainFormData(domainTypes));
    resetModalState();
  };

  const addSubDomain = () => {
    if (!newSubDomain.key || !newSubDomain.name || !newSubDomain.path) return;
    setFormData(prev => ({ ...prev, subDomains: [...prev.subDomains, { ...newSubDomain, status: 'active', order: prev.subDomains.length }] }));
    setNewSubDomain({ ...EMPTY_SUBDOMAIN });
  };

  const removeSubDomain = (index) => {
    setFormData(prev => ({ ...prev, subDomains: prev.subDomains.filter((_, i) => i !== index) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await submitDomain(editingDomain, formData, () => { fetchDomains(); closeModal(); });
    } catch (error) { toast.error(error.response?.data?.error || 'Failed to save domain'); }
    finally { setSaving(false); }
  };

  const handleDelete = (domain) => deleteDomain(domain, fetchDomains);

  const filteredDomains = domains.filter(domain =>
    domain.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    domain.key.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isEditor()) return <DomainsAccessDenied />;

  const modalTitle = editingDomain ? 'Edit Domain' : 'Create Domain';

  return (
    <div className="space-y-6">
      <DomainsHeader searchTerm={searchTerm} onSearchChange={setSearchTerm} onAddNew={openCreateModal} />

      <DomainsTable loading={loading} filteredDomains={filteredDomains} onEdit={openEditModal} onDelete={handleDelete} />

      <Modal isOpen={modalOpen} onClose={closeModal} title={modalTitle} size="lg">
        <DomainForm
          formData={formData} handleChange={handleChange} setFormData={setFormData}
          editingDomain={editingDomain} saving={saving} domainTypes={domainTypes}
          newSubDomain={newSubDomain} setNewSubDomain={setNewSubDomain}
          addSubDomain={addSubDomain} removeSubDomain={removeSubDomain}
          onSubmit={handleSubmit} onCancel={closeModal}
          onOpenIconPicker={() => setIconPickerOpen(true)}
        />
      </Modal>

      {iconPickerOpen && (
        <LucideIconPicker
          value={formData.icon}
          onChange={(iconDataUri) => setFormData(prev => ({ ...prev, icon: iconDataUri }))}
          onClose={() => setIconPickerOpen(false)}
        />
      )}
    </div>
  );
}

export default DomainsManagement;
