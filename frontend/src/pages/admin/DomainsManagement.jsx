import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { domainAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { Layers, Plus, Edit2, Trash2, X, Search } from 'lucide-react';

function DomainsManagement() {
  const { isEditor } = useAuth();
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDomain, setEditingDomain] = useState(null);
  const [formData, setFormData] = useState({
    key: '',
    name: '',
    description: '',
    path: '',
    icon: '',
    order: 0,
  });
  const [saving, setSaving] = useState(false);

  const fetchDomains = async () => {
    setLoading(true);
    try {
      const response = await domainAPI.getAll();
      setDomains(response.data);
    } catch (error) {
      toast.error('Failed to fetch domains');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDomains();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'order' ? parseInt(value) || 0 : value,
    }));
  };

  const openCreateModal = () => {
    setEditingDomain(null);
    setFormData({
      key: '',
      name: '',
      description: '',
      path: '',
      icon: '',
      order: 0,
    });
    setModalOpen(true);
  };

  const openEditModal = (domain) => {
    setEditingDomain(domain);
    setFormData({
      key: domain.key,
      name: domain.name,
      description: domain.description || '',
      path: domain.path || '',
      icon: domain.icon || '',
      order: domain.order || 0,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingDomain(null);
    setFormData({
      key: '',
      name: '',
      description: '',
      path: '',
      icon: '',
      order: 0,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (editingDomain) {
        await domainAPI.update(editingDomain._id, {
          _id: editingDomain._id,
          ...formData,
        });
        toast.success('Domain updated successfully');
      } else {
        await domainAPI.create(formData);
        toast.success('Domain created successfully');
      }
      fetchDomains();
      closeModal();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save domain');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (domain) => {
    if (!confirm(`Are you sure you want to delete "${domain.name}"?`)) {
      return;
    }

    try {
      await domainAPI.delete(domain._id || domain.key);
      toast.success('Domain deleted successfully');
      fetchDomains();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to delete domain');
    }
  };

  const filteredDomains = domains.filter(domain =>
    domain.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    domain.key.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isEditor()) {
    return (
      <div className="text-center py-12">
        <Layers className="mx-auto text-gray-400 mb-4" size={48} />
        <h2 className="text-xl font-semibold text-gray-800 mb-2">Access Denied</h2>
        <p className="text-gray-500">You don't have permission to manage domains.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Domains Management</h1>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search domains..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-10 w-64"
            />
          </div>
          <button onClick={openCreateModal} className="btn-primary flex items-center gap-2">
            <Plus size={18} />
            Add Domain
          </button>
        </div>
      </div>

      {/* Domains Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredDomains.length === 0 ? (
          <div className="text-center py-12">
            <Layers className="mx-auto text-gray-400 mb-4" size={48} />
            <p className="text-gray-500">No domains found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Domain</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Key</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Path</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Order</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDomains.map((domain) => (
                  <tr key={domain.key} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Layers className="text-blue-600" size={20} />
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">{domain.name}</p>
                          {domain.description && (
                            <p className="text-sm text-gray-500 line-clamp-1">
                              {domain.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                        {domain.key}
                      </code>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {domain.path || '-'}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {domain.order || 0}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          domain.status === 'A'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {domain.status === 'A' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditModal(domain)}
                          className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="Edit"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(domain)}
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
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                {editingDomain ? 'Edit Domain' : 'Create Domain'}
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
                  placeholder="domain-key"
                  required
                  disabled={!!editingDomain}
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
                  placeholder="Domain Name"
                  required
                />
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
                  rows={3}
                  placeholder="Domain description..."
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
                  {saving ? 'Saving...' : editingDomain ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default DomainsManagement;
