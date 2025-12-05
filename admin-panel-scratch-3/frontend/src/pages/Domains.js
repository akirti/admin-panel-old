import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Input, Table, Modal, Badge, SearchInput, Select, Pagination, Toggle } from '../components/shared';
import { domainsAPI, scenariosAPI } from '../services/api';
import toast from 'react-hot-toast';

const Domains = () => {
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [subdomainModalOpen, setSubdomainModalOpen] = useState(false);
  const [scenarioModalOpen, setScenarioModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [selectedDomain, setSelectedDomain] = useState(null);
  const [domainScenarios, setDomainScenarios] = useState([]);
  const [pagination, setPagination] = useState({ page: 0, limit: 25, total: 0, pages: 0 });

  // Form state
  const [formData, setFormData] = useState({
    key: '',
    name: '',
    description: '',
    path: '',
    dataDomain: '',
    icon: '',
    order: 0,
    status: 'active',
    defaultSelected: false,
    type: 'custom',
    subDomains: []
  });

  // Subdomain form state
  const [subdomainData, setSubdomainData] = useState({
    key: '',
    name: '',
    description: '',
    path: '',
    icon: '',
    order: 0,
    defaultSelected: false
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await domainsAPI.list({
        search: search || undefined,
        page: pagination.page,
        limit: pagination.limit
      });
      setDomains(response.data.data || response.data);
      setPagination(prev => ({ ...prev, ...(response.data.pagination || {}) }));
    } catch (error) {
      toast.error('Failed to load domains');
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
      key: '',
      name: '',
      description: '',
      path: '',
      dataDomain: '',
      icon: '',
      order: 0,
      status: 'active',
      defaultSelected: false,
      type: 'custom',
      subDomains: []
    });
    setEditingItem(null);
  };

  const resetSubdomainForm = () => {
    setSubdomainData({
      key: '',
      name: '',
      description: '',
      path: '',
      icon: '',
      order: 0,
      defaultSelected: false
    });
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await domainsAPI.create(formData);
      toast.success('Domain created successfully');
      setModalOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create domain');
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await domainsAPI.update(editingItem.key, formData);
      toast.success('Domain updated successfully');
      setModalOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update domain');
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm('Are you sure you want to delete this domain? This will remove the domain from all roles and groups, and delete all associated scenarios.')) return;
    try {
      await domainsAPI.delete(item.key);
      toast.success('Domain deleted successfully');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete domain');
    }
  };

  const handleToggleStatus = async (item) => {
    try {
      await domainsAPI.toggleStatus(item.key);
      toast.success('Domain status updated');
      fetchData();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setFormData({
      key: item.key || '',
      name: item.name || '',
      description: item.description || '',
      path: item.path || '',
      dataDomain: item.dataDomain || '',
      icon: item.icon || '',
      order: item.order || 0,
      status: item.status || 'active',
      defaultSelected: item.defaultSelected || false,
      type: item.type || 'custom',
      subDomains: item.subDomains || []
    });
    setModalOpen(true);
  };

  const openSubdomainModal = (domain) => {
    setSelectedDomain(domain);
    resetSubdomainForm();
    setSubdomainModalOpen(true);
  };

  const openScenarioModal = async (domain) => {
    setSelectedDomain(domain);
    try {
      const response = await domainsAPI.getScenarios(domain.key);
      setDomainScenarios(response.data || []);
      setScenarioModalOpen(true);
    } catch (error) {
      toast.error('Failed to load domain scenarios');
    }
  };

  const handleAddSubdomain = async (e) => {
    e.preventDefault();
    try {
      await domainsAPI.addSubdomain(selectedDomain.key, subdomainData);
      toast.success('Subdomain added successfully');
      setSubdomainModalOpen(false);
      resetSubdomainForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add subdomain');
    }
  };

  const handleRemoveSubdomain = async (domainKey, subdomainKey) => {
    if (!window.confirm('Remove this subdomain?')) return;
    try {
      await domainsAPI.removeSubdomain(domainKey, subdomainKey);
      toast.success('Subdomain removed successfully');
      fetchData();
    } catch (error) {
      toast.error('Failed to remove subdomain');
    }
  };

  const handleAddSubdomainToForm = () => {
    if (!subdomainData.key || !subdomainData.name) {
      toast.error('Subdomain key and name are required');
      return;
    }
    setFormData(prev => ({
      ...prev,
      subDomains: [...prev.subDomains, { ...subdomainData }]
    }));
    resetSubdomainForm();
    toast.success('Subdomain added to form');
  };

  const handleRemoveSubdomainFromForm = (index) => {
    setFormData(prev => ({
      ...prev,
      subDomains: prev.subDomains.filter((_, i) => i !== index)
    }));
  };

  const columns = [
    { key: 'key', title: 'Key' },
    { key: 'name', title: 'Name' },
    {
      key: 'subDomains',
      title: 'Subdomains',
      render: (val) => (
        <Badge variant="info">
          {(val || []).length} subdomain{(val || []).length !== 1 ? 's' : ''}
        </Badge>
      ),
    },
    { key: 'path', title: 'Path' },
    { key: 'order', title: 'Order' },
    {
      key: 'defaultSelected',
      title: 'Default',
      render: (val) => val ? <Badge variant="primary">Yes</Badge> : <Badge variant="default">No</Badge>,
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
    {
      key: 'actions',
      title: 'Actions',
      render: (_, item) => (
        <div className="flex items-center space-x-2">
          <button
            onClick={(e) => { e.stopPropagation(); openScenarioModal(item); }}
            className="p-1 text-purple-500 hover:text-purple-600"
            title="View Scenarios"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); openSubdomainModal(item); }}
            className="p-1 text-blue-500 hover:text-blue-600"
            title="Manage Subdomains"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
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
            onClick={(e) => { e.stopPropagation(); handleToggleStatus(item); }}
            className="p-1 text-yellow-500 hover:text-yellow-600"
            title="Toggle Status"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
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
          <h1 className="text-2xl font-bold text-gray-900">Domains</h1>
          <p className="text-gray-500 mt-1">Manage application domains and navigation hierarchy</p>
        </div>
        <Button onClick={() => { resetForm(); setModalOpen(true); }}>
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Domain
        </Button>
      </div>

      {/* Search */}
      <Card className="p-4">
        <SearchInput
          value={search}
          onChange={(val) => { setSearch(val); setPagination(prev => ({ ...prev, page: 0 })); }}
          placeholder="Search by key or name..."
        />
      </Card>

      {/* Table */}
      <Card>
        <Table columns={columns} data={domains} loading={loading} />
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
        title={editingItem ? 'Edit Domain' : 'Add Domain'}
        size="xl"
      >
        <form onSubmit={editingItem ? handleUpdate : handleCreate}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Domain Key *"
                value={formData.key}
                onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                placeholder="sales"
                required
                disabled={!!editingItem}
              />
              <Input
                label="Name *"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Sales"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Path *"
                value={formData.path}
                onChange={(e) => setFormData({ ...formData, path: e.target.value })}
                placeholder="/sales"
                required
              />
              <Input
                label="Data Domain"
                value={formData.dataDomain}
                onChange={(e) => setFormData({ ...formData, dataDomain: e.target.value })}
                placeholder="sales-data"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                rows={2}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Domain description..."
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <Input
                label="Icon"
                value={formData.icon}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                placeholder="IconName"
              />
              <Input
                label="Order"
                type="number"
                value={formData.order}
                onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
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

            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Status"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                options={[
                  { value: 'active', label: 'Active' },
                  { value: 'inactive', label: 'Inactive' }
                ]}
              />
              <div className="flex items-end pb-2">
                <Toggle
                  enabled={formData.defaultSelected}
                  onChange={(val) => setFormData({ ...formData, defaultSelected: val })}
                  label="Default Selected"
                />
              </div>
            </div>

            {/* Subdomains Section (for new domains) */}
            {!editingItem && (
              <div className="border-t pt-4">
                <h3 className="text-lg font-semibold mb-3">Subdomains ({formData.subDomains.length})</h3>
                {formData.subDomains.length > 0 && (
                  <div className="mb-3 border rounded-lg divide-y max-h-40 overflow-y-auto">
                    {formData.subDomains.map((sd, index) => (
                      <div key={index} className="flex items-center justify-between p-2 hover:bg-gray-50">
                        <div>
                          <p className="font-medium text-sm">{sd.name}</p>
                          <p className="text-xs text-gray-500">{sd.key} - {sd.path}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveSubdomainFromForm(index)}
                          className="text-red-500 hover:text-red-600 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Subdomain Form */}
                <div className="bg-gray-50 p-3 rounded-lg space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <Input
                      label="Subdomain Key"
                      value={subdomainData.key}
                      onChange={(e) => setSubdomainData({ ...subdomainData, key: e.target.value })}
                      placeholder="analytics"
                      size="sm"
                    />
                    <Input
                      label="Name"
                      value={subdomainData.name}
                      onChange={(e) => setSubdomainData({ ...subdomainData, name: e.target.value })}
                      placeholder="Analytics"
                      size="sm"
                    />
                    <Input
                      label="Path"
                      value={subdomainData.path}
                      onChange={(e) => setSubdomainData({ ...subdomainData, path: e.target.value })}
                      placeholder="/analytics"
                      size="sm"
                    />
                  </div>
                  <Button type="button" onClick={handleAddSubdomainToForm} size="sm" variant="secondary">
                    Add Subdomain
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-3 pt-6 border-t mt-6">
            <Button type="button" variant="secondary" onClick={() => { setModalOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button type="submit">
              {editingItem ? 'Update Domain' : 'Create Domain'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Subdomain Management Modal */}
      <Modal
        isOpen={subdomainModalOpen}
        onClose={() => { setSubdomainModalOpen(false); resetSubdomainForm(); }}
        title={`Manage Subdomains - ${selectedDomain?.name}`}
        size="lg"
      >
        <div className="space-y-6">
          {/* Existing Subdomains */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Current Subdomains ({selectedDomain?.subDomains?.length || 0})</h3>
            {selectedDomain?.subDomains?.length > 0 ? (
              <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                {selectedDomain.subDomains.map((sd) => (
                  <div key={sd.key} className="flex items-center justify-between p-3 hover:bg-gray-50">
                    <div>
                      <p className="font-medium">{sd.name}</p>
                      <p className="text-sm text-gray-500">{sd.key} - {sd.path}</p>
                    </div>
                    <button
                      onClick={() => handleRemoveSubdomain(selectedDomain.key, sd.key)}
                      className="text-red-500 hover:text-red-600 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4 border rounded-lg">No subdomains</p>
            )}
          </div>

          {/* Add New Subdomain */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Add New Subdomain</h3>
            <form onSubmit={handleAddSubdomain} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Subdomain Key *"
                  value={subdomainData.key}
                  onChange={(e) => setSubdomainData({ ...subdomainData, key: e.target.value })}
                  placeholder="analytics"
                  required
                />
                <Input
                  label="Name *"
                  value={subdomainData.name}
                  onChange={(e) => setSubdomainData({ ...subdomainData, name: e.target.value })}
                  placeholder="Analytics"
                  required
                />
              </div>
              <Input
                label="Path *"
                value={subdomainData.path}
                onChange={(e) => setSubdomainData({ ...subdomainData, path: e.target.value })}
                placeholder="/analytics"
                required
              />
              <Input
                label="Description"
                value={subdomainData.description}
                onChange={(e) => setSubdomainData({ ...subdomainData, description: e.target.value })}
                placeholder="Subdomain description"
              />
              <div className="flex justify-end">
                <Button type="submit">Add Subdomain</Button>
              </div>
            </form>
          </div>
        </div>
      </Modal>

      {/* Scenarios Modal */}
      <Modal
        isOpen={scenarioModalOpen}
        onClose={() => setScenarioModalOpen(false)}
        title={`Scenarios - ${selectedDomain?.name}`}
        size="lg"
      >
        <div>
          <h3 className="text-lg font-semibold mb-3">Domain Scenarios ({domainScenarios.length})</h3>
          {domainScenarios.length > 0 ? (
            <div className="border rounded-lg divide-y max-h-96 overflow-y-auto">
              {domainScenarios.map((scenario) => (
                <div key={scenario._id} className="p-3 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{scenario.name}</p>
                      <p className="text-sm text-gray-500">{scenario.scenarioId}</p>
                      {scenario.description && (
                        <p className="text-sm text-gray-600 mt-1">{scenario.description}</p>
                      )}
                    </div>
                    <Badge variant={scenario.status === 'active' ? 'success' : 'danger'}>
                      {scenario.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8 border rounded-lg">No scenarios configured for this domain</p>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default Domains;
