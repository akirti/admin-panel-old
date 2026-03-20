import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Modal, Badge, Table } from '../../components/shared';
import { domainAPI } from '../../services/api';
import { Layers, Plus, Edit2, Trash2, X, Search, Image, AlertCircle, CheckCircle } from 'lucide-react';
import LucideIconPicker from '../../components/shared/LucideIconPicker';

/* ─── helpers (outside component) ─── */

function getSubmitLabel(saving, editing) {
  if (saving) return 'Saving...';
  return editing ? 'Update' : 'Create';
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
  } else {
    await domainAPI.create(formData);
  }
  onSuccess(editingDomain ? 'Domain updated successfully' : 'Domain created successfully');
}

/* ─── Form change handler (outside component) ─── */
function handleDomainFieldChange(e, setFormData) {
  const { name, value } = e.target;
  const parsedValue = name === 'order' ? parseInt(value) || 0 : value;
  setFormData(prev => ({ ...prev, [name]: parsedValue }));
}

// --- Sub-components ---

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

/* ─── Alert Messages ─── */
const AlertMessages = ({ error, success }) => (
  <>
    {error && (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
        <AlertCircle size={20} /> {error}
      </div>
    )}
    {success && (
      <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
        <CheckCircle size={20} /> {success}
      </div>
    )}
  </>
);

/* ─── Stats Widget ─── */
const DomainsStats = ({ domains, search }) => {
  if (search || domains.length === 0) return null;
  const active = domains.filter(d => d.status === 'active').length;
  const withSubs = domains.filter(d => d.subDomains && d.subDomains.length > 0).length;
  const types = {};
  domains.forEach(d => { const t = d.type || 'default'; types[t] = (types[t] || 0) + 1; });
  const topType = Object.entries(types).sort((a, b) => b[1] - a[1])[0];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="card p-4">
        <div className="text-sm text-content-muted">Total Domains</div>
        <div className="text-2xl font-bold text-content">{domains.length}</div>
      </div>
      <div className="card p-4">
        <div className="text-sm text-content-muted">Active</div>
        <div className="text-2xl font-bold text-green-600">{active}</div>
      </div>
      <div className="card p-4">
        <div className="text-sm text-content-muted">With Subdomains</div>
        <div className="text-2xl font-bold text-content">{withSubs}</div>
      </div>
      {topType && (
        <div className="card p-4">
          <div className="text-sm text-content-muted capitalize">{topType[0]}</div>
          <div className="text-2xl font-bold text-content">{topType[1]}</div>
          <div className="text-xs text-content-muted">domains</div>
        </div>
      )}
    </div>
  );
};

/* ─── Header ─── */
function DomainsHeader({ onAddNew, domainCount }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-content">Domains Management</h1>
        <p className="text-content-muted text-sm mt-1">Manage domain configuration ({domainCount} total)</p>
      </div>
      <div className="flex items-center gap-4">
        <button onClick={onAddNew} className="btn-primary flex items-center gap-2"><Plus size={18} />Add Domain</button>
      </div>
    </div>
  );
}

/* ─── Filter Bar ─── */
const DomainsFilterBar = ({ search, onSearchChange }) => (
  <div className="card !p-4">
    <div className="flex items-center gap-3">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted pointer-events-none" size={18} />
        <input type="text" placeholder="Search domains..." value={search} onChange={(e) => onSearchChange(e.target.value)} className="input !py-2 pl-10 w-full" />
      </div>
    </div>
  </div>
);

// --- Custom hooks ---

/* ─── Data-fetching hook ─── */
function useDomainsData() {
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [domainTypes, setDomainTypes] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');

  const fetchDomains = useCallback(async () => {
    setLoading(true);
    try {
      const response = await domainAPI.getAll();
      setDomains(response?.data || []);
    } catch { setError('Failed to fetch domains'); }
    finally { setLoading(false); }
  }, []);

  const fetchDomainTypes = useCallback(async () => {
    try {
      const response = await domainAPI.getTypes();
      setDomainTypes(response?.data || []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchDomains(); fetchDomainTypes(); }, [fetchDomains, fetchDomainTypes]);

  useEffect(() => {
    if (!error && !success) return;
    const timer = setTimeout(() => { setError(''); setSuccess(''); }, 5000);
    return () => clearTimeout(timer);
  }, [error, success]);

  const filteredDomains = domains.filter(domain =>
    domain.name.toLowerCase().includes(search.toLowerCase()) ||
    domain.key.toLowerCase().includes(search.toLowerCase())
  );

  return {
    domains, loading, domainTypes, error, success, setError, setSuccess,
    search, setSearch, filteredDomains, fetchDomains,
  };
}

/* ─── Actions hook ─── */
function useDomainActions(data) {
  const handleDelete = async (domain) => {
    if (!confirm(`Are you sure you want to delete "${domain.name}"?`)) return;
    try {
      await domainAPI.delete(domain._id || domain.key);
      data.setSuccess('Domain deleted successfully');
      data.fetchDomains();
    } catch (error) { data.setError(error.response?.data?.error || 'Failed to delete domain'); }
  };

  return { handleDelete };
}

/* ─── Modal / form management hook ─── */
function useDomainFormModal(data) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDomain, setEditingDomain] = useState(null);
  const [formData, setFormData] = useState({
    key: '', name: '', description: '', path: '', icon: '', order: 0,
    type: 'custom', dataDomain: '', status: 'active', defaultSelected: false, subDomains: [],
  });
  const [newSubDomain, setNewSubDomain] = useState({ ...EMPTY_SUBDOMAIN });
  const [saving, setSaving] = useState(false);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);

  const resetModalState = () => { setNewSubDomain({ ...EMPTY_SUBDOMAIN }); };

  const openCreateModal = () => {
    setEditingDomain(null);
    setFormData(getDefaultDomainFormData(data.domainTypes));
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
    setFormData(getDefaultDomainFormData(data.domainTypes));
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
      await submitDomain(editingDomain, formData, (msg) => { data.setSuccess(msg); data.fetchDomains(); closeModal(); });
    } catch (error) { data.setError(error.response?.data?.error || 'Failed to save domain'); }
    finally { setSaving(false); }
  };

  const handleChange = (e) => handleDomainFieldChange(e, setFormData);

  const openIconPicker = () => setIconPickerOpen(true);
  const closeIconPicker = () => setIconPickerOpen(false);
  const handleIconSelect = (iconDataUri) => setFormData(prev => ({ ...prev, icon: iconDataUri }));

  return {
    modalOpen, editingDomain, formData, setFormData,
    newSubDomain, setNewSubDomain, saving,
    openCreateModal, openEditModal, closeModal,
    addSubDomain, removeSubDomain, handleSubmit, handleChange,
    iconPickerOpen, openIconPicker, closeIconPicker, handleIconSelect,
  };
}

// --- Main Component ---

function DomainsManagement() {
  const { isEditor } = useAuth();
  const data = useDomainsData();
  const actions = useDomainActions(data);
  const modal = useDomainFormModal(data);

  const canAccess = isEditor();
  if (!canAccess) return <DomainsAccessDenied />;

  const modalTitle = modal.editingDomain ? 'Edit Domain' : 'Create Domain';

  return (
    <div className="space-y-6">
      <DomainsHeader onAddNew={modal.openCreateModal} domainCount={data.domains.length} />

      <AlertMessages error={data.error} success={data.success} />

      <DomainsStats domains={data.domains} search={data.search} />

      <DomainsFilterBar search={data.search} onSearchChange={data.setSearch} />

      <div className="card overflow-hidden">
        <Table
          columns={[
            {
              key: 'name',
              title: 'Domain',
              render: (_val, row) => (
                <div className="flex items-center gap-3">
                  <DomainIconCell domain={row} />
                  <div>
                    <p className="font-medium text-content">{row.name}</p>
                    {row.description && <p className="text-sm text-content-muted line-clamp-1">{row.description}</p>}
                  </div>
                </div>
              ),
            },
            {
              key: 'key',
              title: 'Key',
              render: (val) => <code className="text-sm bg-surface-hover px-2 py-1 rounded">{val}</code>,
            },
            {
              key: 'path',
              title: 'Path',
              render: (val) => <span className="text-sm text-content-muted">{val || '-'}</span>,
            },
            {
              key: 'order',
              title: 'Order',
              render: (val) => <span className="text-sm text-content-muted">{val || 0}</span>,
              sortValue: (val) => val || 0,
            },
            {
              key: 'status',
              title: 'Status',
              render: (val) => (
                <Badge variant={val === 'active' ? 'success' : 'default'}>
                  {val === 'active' ? 'Active' : 'Inactive'}
                </Badge>
              ),
            },
            {
              key: 'actions',
              title: 'Actions',
              render: (_val, row) => (
                <div className="flex items-center gap-1">
                  <button onClick={() => modal.openEditModal(row)} className="w-9 h-9 flex items-center justify-center text-content-muted hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors" title="Edit"><Edit2 size={18} /></button>
                  <button onClick={() => actions.handleDelete(row)} className="w-9 h-9 flex items-center justify-center text-content-muted hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><Trash2 size={18} /></button>
                </div>
              ),
            },
          ]}
          data={data.filteredDomains}
          loading={data.loading}
        />
      </div>

      <Modal isOpen={modal.modalOpen} onClose={modal.closeModal} title={modalTitle} size="lg">
        <DomainForm
          formData={modal.formData} handleChange={modal.handleChange} setFormData={modal.setFormData}
          editingDomain={modal.editingDomain} saving={modal.saving} domainTypes={data.domainTypes}
          newSubDomain={modal.newSubDomain} setNewSubDomain={modal.setNewSubDomain}
          addSubDomain={modal.addSubDomain} removeSubDomain={modal.removeSubDomain}
          onSubmit={modal.handleSubmit} onCancel={modal.closeModal}
          onOpenIconPicker={modal.openIconPicker}
        />
      </Modal>

      {modal.iconPickerOpen && (
        <LucideIconPicker
          value={modal.formData.icon}
          onChange={modal.handleIconSelect}
          onClose={modal.closeIconPicker}
        />
      )}
    </div>
  );
}

export default DomainsManagement;
