import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { scenarioAPI, domainAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { FileText, Plus, Edit2, Trash2, Search, Filter } from 'lucide-react';
import { Modal } from '../../components/shared';

function getSubmitLabel(saving, editing) {
  if (saving) return 'Saving...';
  return editing ? 'Update' : 'Create';
}

// --- Sub-components extracted to reduce cognitive complexity ---

const ScenarioRow = ({ scenario, onEdit, onDelete }) => {
  const statusClass = scenario.status === 'A'
    ? 'bg-green-100 text-green-800'
    : 'bg-surface-hover text-content';
  const statusLabel = scenario.status === 'A' ? 'Active' : 'Inactive';

  return (
    <tr className="border-b hover:bg-surface-hover">
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <FileText className="text-purple-600" size={20} />
          </div>
          <div>
            <p className="font-medium text-content">{scenario.name}</p>
            {scenario.description && (
              <p className="text-sm text-content-muted line-clamp-1">{scenario.description}</p>
            )}
          </div>
        </div>
      </td>
      <td className="py-3 px-4">
        <code className="text-sm bg-surface-hover px-2 py-1 rounded">{scenario.key}</code>
      </td>
      <td className="py-3 px-4">
        <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">{scenario.dataDomain}</span>
      </td>
      <td className="py-3 px-4 text-sm text-content-muted">{scenario.order || 0}</td>
      <td className="py-3 px-4">
        <span className={`px-2 py-1 text-xs rounded-full ${statusClass}`}>{statusLabel}</span>
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-1">
          <button onClick={() => onEdit(scenario)} className="w-9 h-9 flex items-center justify-center text-content-muted hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
            <Edit2 size={18} />
          </button>
          <button onClick={() => onDelete(scenario)} className="w-9 h-9 flex items-center justify-center text-content-muted hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
            <Trash2 size={18} />
          </button>
        </div>
      </td>
    </tr>
  );
};

const ScenariosTable = ({ scenarios, loading, onEdit, onDelete }) => {
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (scenarios.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="mx-auto text-content-muted mb-4" size={48} />
        <p className="text-content-muted">No scenarios found</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="table-header">
            <th className="text-left py-3 px-4">Scenario</th>
            <th className="text-left py-3 px-4">Key</th>
            <th className="text-left py-3 px-4">Domain</th>
            <th className="text-left py-3 px-4">Order</th>
            <th className="text-left py-3 px-4">Status</th>
            <th className="text-left py-3 px-4">Actions</th>
          </tr>
        </thead>
        <tbody>
          {scenarios.map((scenario) => (
            <ScenarioRow key={scenario.key} scenario={scenario} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </tbody>
      </table>
    </div>
  );
};

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

// --- Helper functions outside component ---

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

function filterScenariosList(scenarios, searchTerm, filterDomain) {
  return scenarios.filter(scenario => {
    const lowerSearch = searchTerm.toLowerCase();
    const matchesSearch = scenario.name.toLowerCase().includes(lowerSearch) || scenario.key.toLowerCase().includes(lowerSearch);
    const matchesDomain = !filterDomain || scenario.dataDomain === filterDomain;
    return matchesSearch && matchesDomain;
  });
}

const ScenariosAccessDenied = () => (
  <div className="text-center py-12">
    <FileText className="mx-auto text-content-muted mb-4" size={48} />
    <h2 className="text-xl font-semibold text-content mb-2">Access Denied</h2>
    <p className="text-content-muted">Only Super Administrators can manage scenarios.</p>
  </div>
);

const ScenariosFilterBar = ({ searchTerm, onSearchChange, filterDomain, onFilterDomainChange, domains }) => (
  <div className="flex items-center gap-4">
    <div className="relative flex-1 max-w-xs">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" size={20} />
      <input type="text" placeholder="Search scenarios..." value={searchTerm} onChange={(e) => onSearchChange(e.target.value)} className="input-field pl-10" />
    </div>
    <div className="relative">
      <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" size={20} />
      <select value={filterDomain} onChange={(e) => onFilterDomainChange(e.target.value)} className="input-field pl-10 pr-8">
        <option value="">All Domains</option>
        {domains.map((domain) => (
          <option key={domain.key} value={domain.key}>{domain.name}</option>
        ))}
      </select>
    </div>
  </div>
);

// --- Custom hook for CRUD operations ---

function useScenarioCrud(fetchData) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingScenario, setEditingScenario] = useState(null);
  const [formData, setFormData] = useState({ ...EMPTY_SCENARIO_FORM });
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const parsedValue = name === 'order' ? parseInt(value) || 0 : value;
    setFormData(prev => ({ ...prev, [name]: parsedValue }));
  };

  const openCreateModal = (domains) => {
    setEditingScenario(null);
    setFormData({ ...EMPTY_SCENARIO_FORM, dataDomain: domains[0]?.key || '' });
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
        toast.success('Scenario updated successfully');
      } else {
        await scenarioAPI.create(formData);
        toast.success('Scenario created successfully');
      }
      fetchData();
      closeModal();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save scenario');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (scenario) => {
    if (!confirm(`Are you sure you want to delete "${scenario.name}"?`)) return;
    try {
      await scenarioAPI.delete(scenario._id || scenario.key);
      toast.success('Scenario deleted successfully');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to delete scenario');
    }
  };

  return {
    modalOpen, editingScenario, formData, saving,
    handleChange, openCreateModal, openEditModal, closeModal,
    handleSubmit, handleDelete
  };
}

// --- Main Component ---

function ScenariosManagement() {
  const { isSuperAdmin } = useAuth();
  const [scenarios, setScenarios] = useState([]);
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDomain, setFilterDomain] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [scenariosRes, domainsRes] = await Promise.all([scenarioAPI.getAll(), domainAPI.getAll()]);
      setScenarios(scenariosRes.data);
      setDomains(domainsRes.data);
    } catch {
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const {
    modalOpen, editingScenario, formData, saving,
    handleChange, openCreateModal, openEditModal, closeModal,
    handleSubmit, handleDelete
  } = useScenarioCrud(fetchData);

  if (!isSuperAdmin()) {
    return <ScenariosAccessDenied />;
  }

  const filteredScenarios = filterScenariosList(scenarios, searchTerm, filterDomain);
  const modalTitle = editingScenario ? 'Edit Scenario' : 'Create Scenario';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-content">Scenarios Management</h1>
        <button onClick={() => openCreateModal(domains)} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> Add Scenario
        </button>
      </div>

      <ScenariosFilterBar
        searchTerm={searchTerm} onSearchChange={setSearchTerm}
        filterDomain={filterDomain} onFilterDomainChange={setFilterDomain}
        domains={domains}
      />

      <div className="card overflow-hidden">
        <ScenariosTable scenarios={filteredScenarios} loading={loading} onEdit={openEditModal} onDelete={handleDelete} />
      </div>

      <Modal isOpen={modalOpen} onClose={closeModal} title={modalTitle} size="md">
        <ScenarioForm
          formData={formData} editingScenario={editingScenario} domains={domains}
          saving={saving} handleChange={handleChange} handleSubmit={handleSubmit} closeModal={closeModal}
        />
      </Modal>
    </div>
  );
}

export default ScenariosManagement;
