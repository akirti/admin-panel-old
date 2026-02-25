import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Modal, Badge } from '../../components/shared';
import { domainAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { Layers, Plus, Edit2, Trash2, X, Search, Image } from 'lucide-react';
import LucideIconPicker from '../../components/shared/LucideIconPicker';

function DomainsManagement() {
  const { isEditor } = useAuth();
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDomain, setEditingDomain] = useState(null);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [formData, setFormData] = useState({
    key: '',
    name: '',
    description: '',
    path: '',
    icon: '',
    order: 0,
    type: 'custom',
    dataDomain: '',
    status: 'active',
    defaultSelected: false,
    subDomains: [],
  });
  const [newSubDomain, setNewSubDomain] = useState({ key: '', name: '', path: '' });
  const [domainTypes, setDomainTypes] = useState([]);
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

  const fetchDomainTypes = async () => {
    try {
      const response = await domainAPI.getTypes();
      setDomainTypes(response.data || []);
    } catch (error) {
      console.error('Failed to fetch domain types:', error);
    }
  };

  useEffect(() => {
    fetchDomains();
    fetchDomainTypes();
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
      type: domainTypes.length > 0 ? domainTypes[0].value : 'custom',
      dataDomain: '',
      status: 'active',
      defaultSelected: false,
      subDomains: [],
    });
    setNewSubDomain({ key: '', name: '', path: '' });
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
      type: domain.type || 'custom',
      dataDomain: domain.dataDomain || '',
      status: domain.status === 'active' ? 'active' : (domain.status || 'active'),
      defaultSelected: domain.defaultSelected || false,
      subDomains: domain.subDomains || [],
    });
    setNewSubDomain({ key: '', name: '', path: '' });
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
      type: 'custom',
      dataDomain: '',
      status: 'active',
      defaultSelected: false,
      subDomains: [],
    });
    setNewSubDomain({ key: '', name: '', path: '' });
  };

  const addSubDomain = () => {
    if (newSubDomain.key && newSubDomain.name && newSubDomain.path) {
      setFormData(prev => ({
        ...prev,
        subDomains: [...prev.subDomains, { ...newSubDomain, status: 'active', order: prev.subDomains.length }],
      }));
      setNewSubDomain({ key: '', name: '', path: '' });
    }
  };

  const removeSubDomain = (index) => {
    setFormData(prev => ({
      ...prev,
      subDomains: prev.subDomains.filter((_, i) => i !== index),
    }));
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
        <Layers className="mx-auto text-neutral-400 mb-4" size={48} />
        <h2 className="text-xl font-semibold text-neutral-900 mb-2">Access Denied</h2>
        <p className="text-neutral-500">You don't have permission to manage domains.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-neutral-900">Domains Management</h1>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={20} />
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
            <Layers className="mx-auto text-neutral-400 mb-4" size={48} />
            <p className="text-neutral-500">No domains found</p>
          </div>
        ) : (
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
                  <tr key={domain.key} className="border-b hover:bg-neutral-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center overflow-hidden">
                          {domain.icon ? (
                            <img
                              src={domain.icon}
                              alt={domain.name}
                              className="w-6 h-6 object-contain"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'block';
                              }}
                            />
                          ) : null}
                          <Layers
                            className="text-blue-600"
                            size={20}
                            style={{ display: domain.icon ? 'none' : 'block' }}
                          />
                        </div>
                        <div>
                          <p className="font-medium text-neutral-900">{domain.name}</p>
                          {domain.description && (
                            <p className="text-sm text-neutral-500 line-clamp-1">
                              {domain.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <code className="text-sm bg-neutral-100 px-2 py-1 rounded">
                        {domain.key}
                      </code>
                    </td>
                    <td className="py-3 px-4 text-sm text-neutral-600">
                      {domain.path || '-'}
                    </td>
                    <td className="py-3 px-4 text-sm text-neutral-600">
                      {domain.order || 0}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={domain.status === 'active' ? 'success' : 'default'}>
                        {domain.status === 'active' ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditModal(domain)}
                          className="w-9 h-9 flex items-center justify-center text-neutral-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(domain)}
                          className="w-9 h-9 flex items-center justify-center text-neutral-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingDomain ? 'Edit Domain' : 'Create Domain'}
        size="lg"
      >
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
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
                <label className="block text-sm font-medium text-neutral-700 mb-1">
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
                <label className="block text-sm font-medium text-neutral-700 mb-1">
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

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Icon
                </label>
                <div className="flex gap-3 items-start">
                  <div className="flex-1">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        name="icon"
                        value={formData.icon}
                        onChange={handleChange}
                        className="input-field flex-1"
                        placeholder="Icon data URI or URL"
                      />
                      <button
                        type="button"
                        onClick={() => setIconPickerOpen(true)}
                        className="btn-secondary flex items-center gap-2 whitespace-nowrap"
                      >
                        <Image size={16} />
                        Select Icon
                      </button>
                      {formData.icon && (
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, icon: '' }))}
                          className="p-2 text-neutral-500 hover:text-red-600 hover:bg-red-50 rounded"
                          title="Clear icon"
                        >
                          <X size={18} />
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500 mt-1">
                      Click "Select Icon" to choose from Lucide icons, or paste a URL/data URI
                    </p>
                  </div>
                  {formData.icon && (
                    <div className="w-12 h-12 border rounded-lg flex items-center justify-center bg-neutral-50 flex-shrink-0">
                      <img
                        src={formData.icon}
                        alt="Icon preview"
                        className="max-w-full max-h-full object-contain"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                      <div className="hidden items-center justify-center text-neutral-400 text-xs">
                        Invalid
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
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
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Type
                  </label>
                  <select
                    name="type"
                    value={formData.type}
                    onChange={handleChange}
                    className="input-field"
                  >
                    {domainTypes.length > 0 ? (
                      domainTypes.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="authentication">Authentication</option>
                        <option value="custom">Custom</option>
                        <option value="system">System</option>
                      </>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Data Domain
                  </label>
                  <input
                    type="text"
                    name="dataDomain"
                    value={formData.dataDomain}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="data-domain-key"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Status
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="input-field"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="flex items-center pt-6">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      name="defaultSelected"
                      checked={formData.defaultSelected}
                      onChange={(e) => setFormData(prev => ({ ...prev, defaultSelected: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 border-neutral-300 rounded focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm font-medium text-neutral-700">Default Selected</span>
                  </label>
                </div>
              </div>

              {/* SubDomains Section */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Sub Domains
                </label>

                {/* Add SubDomain Form */}
                <div className="bg-neutral-50 p-3 rounded-lg mb-2">
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <input
                      type="text"
                      value={newSubDomain.key}
                      onChange={(e) => setNewSubDomain(prev => ({ ...prev, key: e.target.value }))}
                      className="input-field text-sm"
                      placeholder="Key"
                    />
                    <input
                      type="text"
                      value={newSubDomain.name}
                      onChange={(e) => setNewSubDomain(prev => ({ ...prev, name: e.target.value }))}
                      className="input-field text-sm"
                      placeholder="Name"
                    />
                    <input
                      type="text"
                      value={newSubDomain.path}
                      onChange={(e) => setNewSubDomain(prev => ({ ...prev, path: e.target.value }))}
                      className="input-field text-sm"
                      placeholder="Path"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={addSubDomain}
                    disabled={!newSubDomain.key || !newSubDomain.name || !newSubDomain.path}
                    className="btn-secondary text-sm py-1 px-3 flex items-center gap-1"
                  >
                    <Plus size={14} /> Add SubDomain
                  </button>
                </div>

                {/* SubDomains List */}
                {formData.subDomains.length > 0 && (
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {formData.subDomains.map((sub, index) => (
                      <div key={index} className="flex items-center justify-between bg-blue-50 px-3 py-2 rounded">
                        <div className="text-sm">
                          <span className="font-medium">{sub.name}</span>
                          <span className="text-neutral-500 ml-2">({sub.key})</span>
                          <span className="text-neutral-400 ml-2">{sub.path}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeSubDomain(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
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
      </Modal>

      {/* Icon Picker Modal */}
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
