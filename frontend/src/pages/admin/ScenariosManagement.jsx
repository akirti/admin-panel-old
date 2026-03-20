import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { scenarioAPI, domainAPI } from '../../services/api';
import { FileText, Plus, Edit2, Trash2, Search, Filter, AlertCircle, CheckCircle } from 'lucide-react';
import { Modal, Table } from '../../components/shared';

// --- Helper functions ---

function getSubmitLabel(saving, editing) {
  if (saving) return 'Saving...';
  return editing ? 'Update' : 'Create';
}

const EMPTY_SCENARIO_FORM = {
  key: '', name: '', dataDomain: '', description: '', fullDescription: '', path: '', order: 0,
};

function buildScenarioFormData(scenario) {
  return {
    key: scenario.key, name: scenario.name, dataDomain: scenario.dataDomain,
    description: scenario.description || '', fullDescription: scenario.fullDescription || '',
    path: scenario.path || '', order: scenario.order || 0,
  };
}

// --- Sub-components ---

const getScenariosColumns = (onEdit, onDelete) => [
  {
    key: 'name',
    title: 'Scenario',
    render: (_, row) => (
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
          <FileText className="text-purple-600" size={20} />
        </div>
        <div>
          <p className="font-medium text-content">{row.name}</p>
          {row.description && (
            <p className="text-sm text-content-muted line-clamp-1">{row.description}</p>
          )}
        </div>
      </div>
    ),
    filterValue: (val) => val,
    sortValue: (val) => val?.toLowerCase(),
  },
  {
    key: 'key',
    title: 'Key',
    render: (val) => <code className="text-sm bg-surface-hover px-2 py-1 rounded">{val}</code>,
  },
  {
    key: 'dataDomain',
    title: 'Domain',
    render: (val) => <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">{val}</span>,
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
    render: (val) => {
      const isActive = val === 'A';
      return (
        <span className={`px-2 py-1 text-xs rounded-full ${isActive ? 'bg-green-100 text-green-800' : 'bg-surface-hover text-content'}`}>
          {isActive ? 'Active' : 'Inactive'}
        </span>
      );
    },
    filterValue: (val) => val === 'A' ? 'Active' : 'Inactive',
  },
  {
    key: 'actions',
    title: 'Actions',
    render: (_, row) => (
      <div className="flex items-center gap-1">
        <button onClick={(e) => { e.stopPropagation(); onEdit(row); }} className="w-9 h-9 flex items-center justify-center text-content-muted hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
          <Edit2 size={18} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onDelete(row); }} className="w-9 h-9 flex items-center justify-center text-content-muted hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
          <Trash2 size={18} />
        </button>
      </div>
    ),
  },
];

const ScenarioForm = ({ formData, editingScenario, domains, saving, handleChange, handleSubmit, closeModal }) => (
  <form onSubmit={handleSubmit} className="p-6 space-y-4">
    <div>
      <label className="block text-sm font-medium text-content-secondary mb-1">Key *</label>
      <input type="text" name="key" value={formData.key} onChange={handleChange} className="input-field" placeholder="scenario-key" required disabled={!!editingScenario} />
    </div>
    <div>
      <label className="block text-sm font-medium text-content-secondary mb-1">Name *</label>
      <input type="text" name="name" value={formData.name} onChange={handleChange} className="input-field" placeholder="Scenario Name" required />
    </div>
    <div>
      <label className="block text-sm font-medium text-content-secondary mb-1">Domain *</label>
      <select name="dataDomain" value={formData.dataDomain} onChange={handleChange} className="input-field" required>
        <option value="">Select a domain</option>
        {domains.map((domain) => (
          <option key={domain.key} value={domain.key}>{domain.name}</option>
        ))}
      </select>
    </div>
    <div>
      <label className="block text-sm font-medium text-content-secondary mb-1">Description</label>
      <textarea name="description" value={formData.description} onChange={handleChange} className="input-field" rows={2} placeholder="Short description..." />
    </div>
    <div>
      <label className="block text-sm font-medium text-content-secondary mb-1">Full Description</label>
      <textarea name="fullDescription" value={formData.fullDescription} onChange={handleChange} className="input-field" rows={4} placeholder="Detailed description..." />
    </div>
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
    <div className="flex justify-end gap-3 pt-4">
      <button type="button" onClick={closeModal} className="btn-secondary">Cancel</button>
      <button type="submit" disabled={saving} className="btn-primary">
        {getSubmitLabel(saving, editingScenario)}
      </button>
    </div>
  </form>
);

const ScenariosAccessDenied = () => (
  <div className="text-center py-12">
    <FileText className="mx-auto text-content-muted mb-4" size={48} />
    <h2 className="text-xl font-semibold text-content mb-2">Access Denied</h2>
    <p className="text-content-muted">Only Super Administrators can manage scenarios.</p>
  </div>
);

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

const ScenariosStats = ({ scenarios, searchTerm, filterDomain }) => {
  if (searchTerm || filterDomain || scenarios.length === 0) return null;
  const active = scenarios.filter(s => s.status === 'A').length;
  const byDomain = {};
  scenarios.forEach(s => { const d = s.dataDomain || 'Unknown'; byDomain[d] = (byDomain[d] || 0) + 1; });
  const topDomains = Object.entries(byDomain).sort((a, b) => b[1] - a[1]).slice(0, 2);
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="card p-4">
        <div className="text-sm text-content-muted">Total Scenarios</div>
        <div className="text-2xl font-bold text-content">{scenarios.length}</div>
      </div>
      <div className="card p-4">
        <div className="text-sm text-content-muted">Active</div>
        <div className="text-2xl font-bold text-green-600">{active}</div>
      </div>
      <div className="card p-4">
        <div className="text-sm text-content-muted">Inactive</div>
        <div className="text-2xl font-bold text-red-600">{scenarios.length - active}</div>
      </div>
      {topDomains[0] && (
        <div className="card p-4">
          <div className="text-sm text-content-muted">{topDomains[0][0]}</div>
          <div className="text-2xl font-bold text-content">{topDomains[0][1]}</div>
          <div className="text-xs text-content-muted">scenarios</div>
        </div>
      )}
    </div>
  );
};

const ScenariosHeader = ({ onCreateClick, scenarioCount }) => (
  <div className="flex items-center justify-between">
    <div>
      <h1 className="text-2xl font-bold text-content">Scenarios Management</h1>
      <p className="text-content-muted text-sm mt-1">Manage scenario configuration ({scenarioCount} total)</p>
    </div>
    <button onClick={onCreateClick} className="btn-primary flex items-center gap-2">
      <Plus size={18} /> Add Scenario
    </button>
  </div>
);

const ScenariosFilterBar = ({ searchTerm, onSearchChange, filterDomain, onFilterDomainChange, domains }) => (
  <div className="card !p-4">
    <div className="flex items-center gap-3">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted pointer-events-none" size={18} />
        <input type="text" placeholder="Search scenarios..." value={searchTerm} onChange={(e) => onSearchChange(e.target.value)} className="input !py-2 pl-10 w-full" />
      </div>
      <div className="flex items-center gap-2">
        <Filter size={16} className="text-content-muted shrink-0" />
        <select className="input !py-2 min-w-[140px]" value={filterDomain} onChange={(e) => onFilterDomainChange(e.target.value)}>
          <option value="">All Domains</option>
          {domains.map((domain) => (
            <option key={domain.key} value={domain.key}>{domain.name}</option>
          ))}
        </select>
        {filterDomain && (
          <button className="text-sm text-primary-600 hover:underline whitespace-nowrap" onClick={() => onFilterDomainChange('')}>Clear</button>
        )}
      </div>
    </div>
  </div>
);

// --- Custom hooks ---

function useScenariosData(isSuperAdmin) {
  const [scenarios, setScenarios] = useState([]);
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDomain, setFilterDomain] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [scenariosRes, domainsRes] = await Promise.all([scenarioAPI.getAll(), domainAPI.getAll()]);
      setScenarios(scenariosRes.data);
      setDomains(domainsRes.data);
    } catch {
      setError('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (isSuperAdmin()) fetchData(); }, [fetchData, isSuperAdmin]);

  useEffect(() => {
    if (!error && !success) return;
    const timer = setTimeout(() => { setError(''); setSuccess(''); }, 5000);
    return () => clearTimeout(timer);
  }, [error, success]);

  const filteredScenarios = scenarios.filter(scenario => {
    const lowerSearch = searchTerm.toLowerCase();
    const matchesSearch = scenario.name.toLowerCase().includes(lowerSearch) || scenario.key.toLowerCase().includes(lowerSearch);
    const matchesDomain = !filterDomain || scenario.dataDomain === filterDomain;
    return matchesSearch && matchesDomain;
  });

  return {
    scenarios, domains, loading, error, success, setError, setSuccess,
    searchTerm, setSearchTerm, filterDomain, setFilterDomain,
    filteredScenarios, fetchData,
  };
}

function useScenarioActions(data) {
  const handleDelete = async (scenario) => {
    if (!confirm(`Are you sure you want to delete "${scenario.name}"?`)) return;
    try {
      await scenarioAPI.delete(scenario._id || scenario.key);
      data.setSuccess('Scenario deleted successfully');
      data.fetchData();
    } catch (error) {
      data.setError(error.response?.data?.error || 'Failed to delete scenario');
    }
  };

  return { handleDelete };
}

function useScenarioFormModal(data) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingScenario, setEditingScenario] = useState(null);
  const [formData, setFormData] = useState({ ...EMPTY_SCENARIO_FORM });
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const parsedValue = name === 'order' ? parseInt(value) || 0 : value;
    setFormData(prev => ({ ...prev, [name]: parsedValue }));
  };

  const openCreateModal = () => {
    setEditingScenario(null);
    setFormData({ ...EMPTY_SCENARIO_FORM, dataDomain: data.domains[0]?.key || '' });
    setModalOpen(true);
  };

  const openEditModal = (scenario) => {
    setEditingScenario(scenario);
    setFormData(buildScenarioFormData(scenario));
    setModalOpen(true);
  };

  const closeModal = () => { setModalOpen(false); setEditingScenario(null); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingScenario) {
        await scenarioAPI.update(editingScenario._id, { _id: editingScenario._id, ...formData });
        data.setSuccess('Scenario updated successfully');
      } else {
        await scenarioAPI.create(formData);
        data.setSuccess('Scenario created successfully');
      }
      data.fetchData();
      closeModal();
    } catch (error) {
      data.setError(error.response?.data?.error || 'Failed to save scenario');
    } finally {
      setSaving(false);
    }
  };

  return {
    modalOpen, editingScenario, formData, saving,
    handleChange, openCreateModal, openEditModal, closeModal, handleSubmit,
  };
}

// --- Main Component ---

const ScenariosManagement = () => {
  const { isSuperAdmin } = useAuth();
  const data = useScenariosData(isSuperAdmin);
  const actions = useScenarioActions(data);
  const modal = useScenarioFormModal(data);

  if (!isSuperAdmin()) return <ScenariosAccessDenied />;

  return (
    <div className="space-y-6">
      <ScenariosHeader onCreateClick={modal.openCreateModal} scenarioCount={data.scenarios.length} />

      <AlertMessages error={data.error} success={data.success} />

      <ScenariosStats scenarios={data.scenarios} searchTerm={data.searchTerm} filterDomain={data.filterDomain} />

      <ScenariosFilterBar
        searchTerm={data.searchTerm} onSearchChange={data.setSearchTerm}
        filterDomain={data.filterDomain} onFilterDomainChange={data.setFilterDomain}
        domains={data.domains}
      />

      <div className="card overflow-hidden">
        <Table
          columns={getScenariosColumns(modal.openEditModal, actions.handleDelete)}
          data={data.filteredScenarios}
          loading={data.loading}
          emptyMessage="No scenarios found"
        />
      </div>

      <Modal isOpen={modal.modalOpen} onClose={modal.closeModal} title={modal.editingScenario ? 'Edit Scenario' : 'Create Scenario'} size="md">
        <ScenarioForm
          formData={modal.formData} editingScenario={modal.editingScenario} domains={data.domains}
          saving={modal.saving} handleChange={modal.handleChange} handleSubmit={modal.handleSubmit} closeModal={modal.closeModal}
        />
      </Modal>
    </div>
  );
};

export default ScenariosManagement;
