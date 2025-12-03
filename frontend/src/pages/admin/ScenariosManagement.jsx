import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { scenarioAPI, domainAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { FileText, Plus, Edit2, Trash2, X, Search, Filter } from 'lucide-react';

function ScenariosManagement() {
  const { isSuperAdmin } = useAuth();
  const [scenarios, setScenarios] = useState([]);
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDomain, setFilterDomain] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingScenario, setEditingScenario] = useState(null);
  const [formData, setFormData] = useState({
    key: '',
    name: '',
    dataDomain: '',
    description: '',
    fullDescription: '',
    path: '',
    order: 0,
  });
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [scenariosRes, domainsRes] = await Promise.all([
        scenarioAPI.getAll(),
        domainAPI.getAll(),
      ]);
      setScenarios(scenariosRes.data);
      setDomains(domainsRes.data);
    } catch (error) {
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'order' ? parseInt(value) || 0 : value,
    }));
  };

  const openCreateModal = () => {
    setEditingScenario(null);
    setFormData({
      key: '',
      name: '',
      dataDomain: domains[0]?.key || '',
      description: '',
      fullDescription: '',
      path: '',
      order: 0,
    });
    setModalOpen(true);
  };

  const openEditModal = (scenario) => {
    setEditingScenario(scenario);
    setFormData({
      key: scenario.key,
      name: scenario.name,
      dataDomain: scenario.dataDomain,
      description: scenario.description || '',
      fullDescription: scenario.fullDescription || '',
      path: scenario.path || '',
      order: scenario.order || 0,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingScenario(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (editingScenario) {
        await scenarioAPI.update(editingScenario._id, {
          _id: editingScenario._id,
          ...formData,
        });
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
    if (!confirm(`Are you sure you want to delete "${scenario.name}"?`)) {
      return;
    }

    try {
      await scenarioAPI.delete(scenario._id || scenario.key);
      toast.success('Scenario deleted successfully');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to delete scenario');
    }
  };

  const filteredScenarios = scenarios.filter(scenario => {
    const matchesSearch =
      scenario.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      scenario.key.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDomain = !filterDomain || scenario.dataDomain === filterDomain;
    return matchesSearch && matchesDomain;
  });

  if (!isSuperAdmin()) {
    return (
      <div className="text-center py-12">
        <FileText className="mx-auto text-gray-400 mb-4" size={48} />
        <h2 className="text-xl font-semibold text-gray-800 mb-2">Access Denied</h2>
        <p className="text-gray-500">Only Super Administrators can manage scenarios.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Scenarios Management</h1>
        <button onClick={openCreateModal} className="btn-primary flex items-center gap-2">
          <Plus size={18} />
          Add Scenario
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search scenarios..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-10"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <select
            value={filterDomain}
            onChange={(e) => setFilterDomain(e.target.value)}
            className="input-field pl-10 pr-8"
          >
            <option value="">All Domains</option>
            {domains.map((domain) => (
              <option key={domain.key} value={domain.key}>
                {domain.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Scenarios Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredScenarios.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="mx-auto text-gray-400 mb-4" size={48} />
            <p className="text-gray-500">No scenarios found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Scenario</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Key</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Domain</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Order</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredScenarios.map((scenario) => (
                  <tr key={scenario.key} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                          <FileText className="text-purple-600" size={20} />
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">{scenario.name}</p>
                          {scenario.description && (
                            <p className="text-sm text-gray-500 line-clamp-1">
                              {scenario.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                        {scenario.key}
                      </code>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                        {scenario.dataDomain}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {scenario.order || 0}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          scenario.status === 'A'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {scenario.status === 'A' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditModal(scenario)}
                          className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="Edit"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(scenario)}
                          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
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
      </div>

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                {editingScenario ? 'Edit Scenario' : 'Create Scenario'}
              </h3>
              <button onClick={closeModal} className="p-1 hover:bg-gray-100 rounded">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Key *
                </label>
                <input
                  type="text"
                  name="key"
                  value={formData.key}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="scenario-key"
                  required
                  disabled={!!editingScenario}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="Scenario Name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Domain *
                </label>
                <select
                  name="dataDomain"
                  value={formData.dataDomain}
                  onChange={handleChange}
                  className="input-field"
                  required
                >
                  <option value="">Select a domain</option>
                  {domains.map((domain) => (
                    <option key={domain.key} value={domain.key}>
                      {domain.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  className="input-field"
                  rows={2}
                  placeholder="Short description..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Description
                </label>
                <textarea
                  name="fullDescription"
                  value={formData.fullDescription}
                  onChange={handleChange}
                  className="input-field"
                  rows={4}
                  placeholder="Detailed description..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Path
                  </label>
                  <input
                    type="text"
                    name="path"
                    value={formData.path}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="/path"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Order
                  </label>
                  <input
                    type="number"
                    name="order"
                    value={formData.order}
                    onChange={handleChange}
                    className="input-field"
                    min={0}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={closeModal} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? 'Saving...' : editingScenario ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ScenariosManagement;
