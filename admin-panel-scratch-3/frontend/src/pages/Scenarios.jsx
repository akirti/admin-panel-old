import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Input, Table, Modal, Badge, SearchInput, Toggle, Select, Pagination } from '../components/shared';
import { scenariosAPI, domainsAPI } from '../services/api';
import toast from 'react-hot-toast';

const Scenarios = () => {
  const [scenarios, setScenarios] = useState([]);
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingScenario, setEditingScenario] = useState(null);
  const [pagination, setPagination] = useState({ page: 0, limit: 25, total: 0, pages: 0 });
  const [formData, setFormData] = useState({
    key: '',
    name: '',
    description: '',
    dataDomain: '',
    path: '',
    icon: '',
    order: 0,
    status: 'active',
    defaultSelected: false,
    type: 'custom',
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [scenariosRes, domainsRes] = await Promise.all([
        scenariosAPI.list({ search: search || undefined, page: pagination.page, limit: pagination.limit }),
        domainsAPI.list({ limit: 100 }),
      ]);
      setScenarios(scenariosRes.data.data || scenariosRes.data);
      setPagination(prev => ({ ...prev, ...(scenariosRes.data.pagination || {}) }));
      setDomains(domainsRes.data.data || domainsRes.data);
    } catch (error) {
      toast.error('Failed to load scenarios');
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
      // Set domainKey from dataDomain
      const submitData = { 
        ...formData, 
        domainKey: formData.dataDomain  // Use dataDomain as domainKey
      };
      
      if (editingScenario) {
        await scenariosAPI.update(editingScenario.key, submitData);
        toast.success('Scenario updated successfully');
      } else {
        await scenariosAPI.create(submitData);
        toast.success('Scenario created successfully');
      }
      setModalOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Operation failed');
    }
  };

  const handleDelete = async (scenario) => {
    if (!window.confirm(`Are you sure you want to delete ${scenario.name}?`)) return;
    try {
      await scenariosAPI.delete(scenario.key);
      toast.success('Scenario deleted successfully');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete scenario');
    }
  };

  const handleToggleStatus = async (scenario) => {
    try {
      await scenariosAPI.toggleStatus(scenario.key);
      toast.success(`Scenario ${scenario.status === 'active' ? 'disabled' : 'enabled'} successfully`);
      fetchData();
    } catch (error) {
      toast.error('Failed to update scenario status');
    }
  };

  const resetForm = () => {
    setFormData({
      key: '',
      name: '',
      description: '',
      dataDomain: '',
      path: '',
      icon: '',
      order: 0,
      status: 'active',
      defaultSelected: false,
      type: 'custom',
    });
    setEditingScenario(null);
  };

  const openEditModal = (scenario) => {
    setEditingScenario(scenario);
    setFormData({
      key: scenario.key || '',
      name: scenario.name || '',
      description: scenario.description || '',
      dataDomain: scenario.dataDomain || scenario.domainKey || '',
      path: scenario.path || '',
      icon: scenario.icon || '',
      order: scenario.order || 0,
      status: scenario.status || 'active',
      defaultSelected: scenario.defaultSelected || false,
      type: scenario.type || 'custom',
    });
    setModalOpen(true);
  };

  // Get domain name by key
  const getDomainName = (key) => {
    const domain = domains.find(d => d.key === key);
    return domain ? domain.name : key;
  };

  const columns = [
    { key: 'key', title: 'Key' },
    { key: 'name', title: 'Name' },
    { 
      key: 'dataDomain', 
      title: 'Domain',
      render: (val, row) => getDomainName(val || row.domainKey),
    },
    { key: 'path', title: 'Path' },
    { key: 'order', title: 'Order' },
    {
      key: 'status',
      title: 'Status',
      render: (val) => (
        <Badge variant={val === 'active' ? 'success' : 'danger'}>
          {val || 'active'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      title: 'Actions',
      render: (_, scenario) => (
        <div className="flex items-center space-x-2">
          <button
            onClick={(e) => { e.stopPropagation(); openEditModal(scenario); }}
            className="p-1 text-gray-500 hover:text-primary-600"
            title="Edit"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleToggleStatus(scenario); }}
            className={`p-1 ${scenario.status === 'active' ? 'text-yellow-500 hover:text-yellow-600' : 'text-green-500 hover:text-green-600'}`}
            title={scenario.status === 'active' ? 'Disable' : 'Enable'}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={scenario.status === 'active' ? "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" : "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"} />
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleDelete(scenario); }}
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
          <h1 className="text-2xl font-bold text-gray-900">Domain Scenarios</h1>
          <p className="text-gray-500 mt-1">Manage domain scenarios and configurations</p>
        </div>
        <Button onClick={() => { resetForm(); setModalOpen(true); }}>
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Scenario
        </Button>
      </div>

      {/* Search */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <SearchInput
              value={search}
              onChange={(val) => { setSearch(val); setPagination(prev => ({ ...prev, page: 0 })); }}
              placeholder="Search by key or name..."
            />
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card>
        <Table columns={columns} data={scenarios} loading={loading} />
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

      {/* Scenario Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); resetForm(); }}
        title={editingScenario ? 'Edit Scenario' : 'Add Scenario'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Scenario Key *"
              value={formData.key}
              onChange={(e) => setFormData({ ...formData, key: e.target.value })}
              required
              disabled={!!editingScenario}
              placeholder="e.g., customer-analysis"
            />
            <Input
              label="Name *"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              placeholder="Scenario name"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              rows={3}
              placeholder="Scenario description..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data Domain *</label>
              <select
                value={formData.dataDomain}
                onChange={(e) => setFormData({ ...formData, dataDomain: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              >
                <option value="">Select Domain</option>
                {domains.map((domain) => (
                  <option key={domain.key} value={domain.key}>
                    {domain.name} ({domain.key})
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Path *"
              value={formData.path}
              onChange={(e) => setFormData({ ...formData, path: e.target.value })}
              required
              placeholder="/scenario-path"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Icon"
              value={formData.icon}
              onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
              placeholder="icon-name"
            />
            <Input
              label="Order"
              type="number"
              value={formData.order}
              onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
            />
            <Select
              label="Status"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Type"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              options={[
                { value: 'custom', label: 'Custom' },
                { value: 'system', label: 'System' },
              ]}
            />
            <div className="flex items-center pt-6">
              <Toggle
                enabled={formData.defaultSelected}
                onChange={(val) => setFormData({ ...formData, defaultSelected: val })}
                label="Default Selected"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button type="button" variant="secondary" onClick={() => { setModalOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button type="submit">
              {editingScenario ? 'Update' : 'Create'} Scenario
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Scenarios;
