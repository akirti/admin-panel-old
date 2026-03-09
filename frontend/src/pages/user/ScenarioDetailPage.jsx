import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Card, Button, Input, Modal, Badge, Select, Toggle, FileUpload } from '../../components/shared';
import {
  ArrowLeft,
  FileText,
  ChevronRight,
  Layout,
  Settings,
  Plus,
  Edit2,
  Download,
  Eye,
  Trash2,
  Upload,
  X
} from 'lucide-react';
import useScenarioData from '../../hooks/useScenarioData';
import usePlayboardModal from '../../hooks/usePlayboardModal';
import usePlayboardUpload from '../../hooks/usePlayboardUpload';
import useFilterBuilder from '../../hooks/useFilterBuilder';
import useRowActionBuilder from '../../hooks/useRowActionBuilder';
import useDescriptionBuilder from '../../hooks/useDescriptionBuilder';
import useAddonManager from '../../hooks/useAddonManager';

function getSubmitLabel(saving, editing) {
  if (saving) return 'Saving...';
  return editing ? 'Update Playboard' : 'Create Playboard';
}

function isStatusActive(status) {
  return status === 'active' || status === 'A';
}

const FORM_TABS = [
  { id: 'basic', label: 'Basic Info' },
  { id: 'filters', label: 'Filters' },
  { id: 'actions', label: 'Row Actions' },
  { id: 'grid', label: 'Grid Settings' },
  { id: 'description', label: 'Description' },
  { id: 'json', label: 'JSON Preview' }
];

function ScenarioDetailPage() {
  const { scenarioKey, domainKey } = useParams();
  const { isSuperAdmin, isEditor, hasPermission } = useAuth();

  const [activeTab, setActiveTab] = React.useState('playboards');

  // Permission checks
  const canEdit = isSuperAdmin() || isEditor() || hasPermission('scenarios.edit');
  const canAdd = isSuperAdmin() || hasPermission('playboards.create');
  const canDelete = isSuperAdmin() || hasPermission('playboards.delete');

  // Custom hooks
  const { scenario, playboards, domains, loading, fetchData } = useScenarioData(scenarioKey);

  const {
    modalOpen, setModalOpen, editingItem,
    formData, setFormData, saving,
    formActiveTab, setFormActiveTab,
    selectedPlayboard, detailModalOpen, setDetailModalOpen,
    resetForm,
    handleAddPlayboard, openEditModal,
    handleCreate, handleUpdate,
    handleDeletePlayboard, handleDownloadPlayboard,
    handleViewDetails,
    updateRowActionsRenderAs, updateGridLayout
  } = usePlayboardModal(scenarioKey, fetchData);

  const {
    uploadModalOpen, setUploadModalOpen,
    uploadFile, uploadName, setUploadName,
    uploadDescription, setUploadDescription,
    jsonPreview,
    handleFileSelect, handleFileUpload, resetUploadForm
  } = usePlayboardUpload(scenarioKey, fetchData);

  const {
    currentFilter, setCurrentFilter,
    optionInput, setOptionInput,
    addFilter, removeFilter,
    addOption, removeOption,
    resetFilter
  } = useFilterBuilder(formData, setFormData);

  const {
    currentRowAction, setCurrentRowAction,
    actionFilterInput, setActionFilterInput,
    addRowAction, removeRowAction,
    addActionFilter, removeActionFilter,
    resetRowAction
  } = useRowActionBuilder(formData, setFormData);

  const {
    currentDescription, setCurrentDescription,
    addDescription, removeDescription,
    resetDescription
  } = useDescriptionBuilder(formData, setFormData);

  const { addonInput, setAddonInput, addAddon, removeAddon } = useAddonManager(formData, setFormData);

  const formTabs = FORM_TABS;

  const handleCloseModal = () => {
    setModalOpen(false);
    resetForm();
    resetFilter();
    resetRowAction();
    resetDescription();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!scenario) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-content mb-2">Scenario Not Found</h2>
        <p className="text-content-muted mb-4">The scenario you're looking for doesn't exist.</p>
        <Link to="/domains" className="btn-primary">
          Back to Domains
        </Link>
      </div>
    );
  }

  const effectiveDomainKey = domainKey || scenario.domainKey;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <ScenarioBreadcrumb domainKey={effectiveDomainKey} scenarioName={scenario.name} />

      {/* Scenario Header */}
      <ScenarioHeader scenario={scenario} canEdit={canEdit} isSuperAdmin={isSuperAdmin} />

      {/* Tabs */}
      <ScenarioTabs activeTab={activeTab} setActiveTab={setActiveTab} playboardCount={playboards.length} />

      {/* Tab Content */}
      {activeTab === 'playboards' && (
        <PlayboardsTabContent
          playboards={playboards}
          canAdd={canAdd}
          canEdit={canEdit}
          canDelete={canDelete}
          onAddPlayboard={handleAddPlayboard}
          onUploadJson={() => { resetUploadForm(); setUploadModalOpen(true); }}
          onViewDetails={handleViewDetails}
          onDownload={handleDownloadPlayboard}
          onEdit={openEditModal}
          onDelete={handleDeletePlayboard}
        />
      )}

      {activeTab === 'details' && (
        <ScenarioDetailsTab scenario={scenario} />
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        title={editingItem ? 'Edit Playboard' : 'Create Playboard'}
        size="xl"
      >
        <form onSubmit={editingItem ? handleUpdate : handleCreate}>
          <FormTabNav tabs={formTabs} activeTab={formActiveTab} onTabChange={setFormActiveTab} />

          {formActiveTab === 'basic' && (
            <BasicInfoTab
              formData={formData}
              setFormData={setFormData}
              scenarioKey={scenarioKey}
              domains={domains}
              addonInput={addonInput}
              setAddonInput={setAddonInput}
              addAddon={addAddon}
              removeAddon={removeAddon}
            />
          )}

          {formActiveTab === 'filters' && (
            <FiltersTab
              filters={formData.widgets.filters}
              currentFilter={currentFilter}
              setCurrentFilter={setCurrentFilter}
              addFilter={addFilter}
              removeFilter={removeFilter}
              optionInput={optionInput}
              setOptionInput={setOptionInput}
              addOption={addOption}
              removeOption={removeOption}
            />
          )}

          {formActiveTab === 'actions' && (
            <RowActionsTab
              events={formData.widgets.grid.actions.rowActions.events}
              currentRowAction={currentRowAction}
              setCurrentRowAction={setCurrentRowAction}
              addRowAction={addRowAction}
              removeRowAction={removeRowAction}
              actionFilterInput={actionFilterInput}
              setActionFilterInput={setActionFilterInput}
              addActionFilter={addActionFilter}
              removeActionFilter={removeActionFilter}
              domains={domains}
            />
          )}

          {formActiveTab === 'grid' && (
            <GridSettingsTab
              formData={formData}
              onRenderAsChange={(e) => updateRowActionsRenderAs(e.target.value)}
              onDefaultSizeChange={(e) => updateGridLayout('defaultSize', parseInt(e.target.value) || 25)}
              onPaginatedChange={(val) => updateGridLayout('ispaginated', val)}
            />
          )}

          {formActiveTab === 'description' && (
            <DescriptionTab
              descriptions={formData.scenarioDescription}
              currentDescription={currentDescription}
              setCurrentDescription={setCurrentDescription}
              addDescription={addDescription}
              removeDescription={removeDescription}
            />
          )}

          {formActiveTab === 'json' && (
            <JsonPreviewTab formData={formData} scenarioKey={scenarioKey} />
          )}

          {/* Form Actions */}
          <div className="flex justify-end space-x-3 pt-6 border-t mt-6">
            <Button type="button" variant="secondary" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {getSubmitLabel(saving, editingItem)}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Upload JSON Modal */}
      <UploadJsonModal
        isOpen={uploadModalOpen}
        onClose={() => { setUploadModalOpen(false); resetUploadForm(); }}
        onSubmit={handleFileUpload}
        onFileSelect={handleFileSelect}
        uploadFile={uploadFile}
        uploadName={uploadName}
        setUploadName={setUploadName}
        uploadDescription={uploadDescription}
        setUploadDescription={setUploadDescription}
        scenarioKey={scenarioKey}
        jsonPreview={jsonPreview}
      />

      {/* Detail View Modal */}
      <Modal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title="Playboard Details"
        size="xl"
      >
        {selectedPlayboard && (
          <div>
            <div className="mb-4">
              <h3 className="font-medium text-content">{selectedPlayboard.name}</h3>
              <p className="text-content-muted text-sm">{selectedPlayboard.description}</p>
            </div>
            <pre className="bg-neutral-900 text-green-400 p-4 rounded-lg overflow-auto max-h-[60vh] text-xs">
              {JSON.stringify(selectedPlayboard.data || selectedPlayboard, null, 2)}
            </pre>
            <div className="flex justify-end mt-4">
              <Button variant="secondary" onClick={() => setDetailModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// --- Extracted sub-components ---

function ScenarioBreadcrumb({ domainKey, scenarioName }) {
  return (
    <div className="flex items-center gap-2 text-sm text-content-muted">
      <Link to="/domains" className="hover:text-blue-600 flex items-center gap-1">
        <ArrowLeft size={16} />
        Domains
      </Link>
      <ChevronRight size={16} />
      {domainKey && (
        <>
          <Link to={`/domains/${domainKey}`} className="hover:text-blue-600">
            {domainKey}
          </Link>
          <ChevronRight size={16} />
        </>
      )}
      <span className="text-content">{scenarioName}</span>
    </div>
  );
}

function ScenarioHeader({ scenario, canEdit, isSuperAdmin }) {
  const statusLabel = isStatusActive(scenario.status) ? 'Active' : 'Inactive';
  const statusVariant = isStatusActive(scenario.status) ? 'success' : 'default';
  return (
    <Card className="p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 bg-purple-100 rounded-lg flex items-center justify-center">
            <FileText className="text-purple-600" size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-content">{scenario.name}</h1>
            <p className="text-content-muted">{scenario.key}</p>
            {scenario.description && (
              <p className="text-content-secondary mt-2">{scenario.description}</p>
            )}
            <div className="flex items-center gap-4 mt-3">
              <Badge variant={statusVariant}>{statusLabel}</Badge>
              {scenario.domainKey && (
                <span className="text-sm text-content-muted">
                  Domain: <span className="font-medium">{scenario.domainKey}</span>
                </span>
              )}
            </div>
          </div>
        </div>
        {canEdit && (
          <Link to={isSuperAdmin() ? `/admin/scenarios` : '#'} className="btn-secondary text-sm">
            <Edit2 size={16} className="mr-1" />
            Edit Scenario
          </Link>
        )}
      </div>
    </Card>
  );
}

function ScenarioTabs({ activeTab, setActiveTab, playboardCount }) {
  const getTabClass = (tabId) =>
    `pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${
      activeTab === tabId
        ? 'border-blue-500 text-blue-600'
        : 'border-transparent text-content-muted hover:text-content-secondary'
    }`;
  return (
    <div className="border-b border-edge">
      <nav className="flex gap-4">
        <button onClick={() => setActiveTab('playboards')} className={getTabClass('playboards')}>
          <Layout size={16} className="inline mr-2" />
          Playboards ({playboardCount})
        </button>
        <button onClick={() => setActiveTab('details')} className={getTabClass('details')}>
          <Settings size={16} className="inline mr-2" />
          Details
        </button>
      </nav>
    </div>
  );
}

function PlayboardActions({ canAdd, onUploadJson, onAddPlayboard }) {
  if (!canAdd) return null;
  return (
    <div className="flex space-x-3">
      <Button variant="secondary" onClick={onUploadJson}>
        <Upload size={16} className="mr-2" />
        Upload JSON
      </Button>
      <Button onClick={onAddPlayboard}>
        <Plus size={16} className="mr-2" />
        Build Playboard
      </Button>
    </div>
  );
}

function PlayboardsTabContent({ playboards, canAdd, canEdit, canDelete, onAddPlayboard, onUploadJson, onViewDetails, onDownload, onEdit, onDelete }) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-content">Playboards</h2>
        <PlayboardActions canAdd={canAdd} onUploadJson={onUploadJson} onAddPlayboard={onAddPlayboard} />
      </div>

      {playboards.length === 0 ? (
        <div className="text-center py-8">
          <Layout className="mx-auto text-content-muted mb-4" size={48} />
          <p className="text-content-muted">No playboards available for this scenario.</p>
          {canAdd && (
            <div className="flex justify-center space-x-3 mt-4">
              <PlayboardActions canAdd={canAdd} onUploadJson={onUploadJson} onAddPlayboard={onAddPlayboard} />
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {playboards.map((playboard) => (
            <PlayboardRow
              key={playboard._id || playboard.id}
              playboard={playboard}
              canEdit={canEdit}
              canDelete={canDelete}
              onViewDetails={onViewDetails}
              onDownload={onDownload}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

function PlayboardRow({ playboard, canEdit, canDelete, onViewDetails, onDownload, onEdit, onDelete }) {
  return (
    <div className="flex items-center gap-4 p-4 border rounded-lg hover:border-blue-300 transition-colors">
      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
        <Layout className="text-blue-600" size={20} />
      </div>
      <div className="flex-1">
        <h3 className="font-medium text-content">{playboard.name}</h3>
        <p className="text-sm text-content-muted">{playboard.data?.key || playboard.key || playboard._id}</p>
        {playboard.description && (
          <p className="text-sm text-content-secondary mt-1 line-clamp-1">{playboard.description}</p>
        )}
        <div className="flex items-center gap-2 mt-2">
          <Badge variant="primary">{playboard.data?.widgets?.filters?.length || 0} Filters</Badge>
          <Badge variant="success">{playboard.data?.widgets?.grid?.actions?.rowActions?.events?.length || 0} Actions</Badge>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={playboard.status === 'active' ? 'success' : 'danger'}>
          {playboard.status === 'active' ? 'Active' : 'Inactive'}
        </Badge>
        <button onClick={() => onViewDetails(playboard)} className="p-2 text-content-muted hover:text-blue-600 hover:bg-blue-50 rounded" title="View JSON">
          <Eye size={16} />
        </button>
        <button onClick={() => onDownload(playboard)} className="p-2 text-content-muted hover:text-green-600 hover:bg-green-50 rounded" title="Download JSON">
          <Download size={16} />
        </button>
        {canEdit && (
          <button onClick={() => onEdit(playboard)} className="p-2 text-content-muted hover:text-blue-600 hover:bg-blue-50 rounded" title="Edit">
            <Edit2 size={16} />
          </button>
        )}
        {canDelete && (
          <button onClick={() => onDelete(playboard)} className="p-2 text-content-muted hover:text-red-600 hover:bg-red-50 rounded" title="Delete">
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

function ScenarioDetailField({ label, children }) {
  return (
    <div>
      <dt className="text-sm text-content-muted">{label}</dt>
      <dd className="text-content">{children}</dd>
    </div>
  );
}

function ScenarioDetailsTab({ scenario }) {
  const statusLabel = isStatusActive(scenario.status) ? 'Active' : 'Inactive';
  const statusVariant = isStatusActive(scenario.status) ? 'success' : 'default';
  const optionalFields = [
    { key: 'domainKey', label: 'Domain Key' },
    { key: 'dataDomain', label: 'Data Domain' },
    { key: 'path', label: 'Path' },
    { key: 'icon', label: 'Icon' },
    { key: 'type', label: 'Type' },
  ];

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-content mb-4">Scenario Information</h2>
      <dl className="grid grid-cols-2 gap-4">
        <ScenarioDetailField label="Key">
          <span className="font-mono">{scenario.key}</span>
        </ScenarioDetailField>
        <div>
          <dt className="text-sm text-content-muted">Status</dt>
          <dd><Badge variant={statusVariant}>{statusLabel}</Badge></dd>
        </div>
        {optionalFields.map(({ key, label }) =>
          scenario[key] ? <ScenarioDetailField key={key} label={label}>{scenario[key]}</ScenarioDetailField> : null
        )}
        {scenario.order !== undefined && (
          <ScenarioDetailField label="Order">{scenario.order}</ScenarioDetailField>
        )}
      </dl>

      {scenario.subDomains && scenario.subDomains.length > 0 && (
        <div className="mt-6">
          <h3 className="text-md font-semibold text-content mb-3">Sub-Domains</h3>
          <div className="space-y-2">
            {scenario.subDomains.map((subDomain, index) => (
              <div key={index} className="p-3 bg-surface-secondary rounded-lg">
                <p className="font-medium text-content">{subDomain.name}</p>
                <p className="text-sm text-content-muted">{subDomain.key}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function FormTabNav({ tabs, activeTab, onTabChange }) {
  return (
    <div className="border-b border-edge mb-4">
      <nav className="flex space-x-4 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`py-2 px-3 text-sm font-medium border-b-2 whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-content-muted hover:text-content-secondary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

function BasicInfoTab({ formData, setFormData, scenarioKey, domains, addonInput, setAddonInput, addAddon, removeAddon }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input label="Key *" value={formData.key} onChange={(e) => setFormData({ ...formData, key: e.target.value })} placeholder="customers_scenario_playboard_1" required />
        <Input label="Name *" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Customer Search Playboard" required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Scenario Key" value={formData.scenarioKey || scenarioKey} disabled />
        <Select label="Data Domain" value={formData.dataDomain} onChange={(e) => setFormData({ ...formData, dataDomain: e.target.value })} options={[{ value: '', label: 'Select Domain' }, ...domains.map(d => ({ value: d.key, label: d.name }))]} />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Input label="Program Key" value={formData.program_key} onChange={(e) => setFormData({ ...formData, program_key: e.target.value })} placeholder="generic_search_logic" />
        <Select label="Config Type" value={formData.config_type} onChange={(e) => setFormData({ ...formData, config_type: e.target.value })} options={[{ value: 'db', label: 'Database' }, { value: 'gcs', label: 'GCS' }, { value: 'db or gcs', label: 'DB or GCS' }]} />
        <Input label="Order" type="number" value={formData.order} onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Select label="Status" value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} options={[{ value: 'A', label: 'Active' }, { value: 'I', label: 'Inactive' }]} />
      </div>
      <div>
        <label className="block text-sm font-medium text-content-secondary mb-1">Description</label>
        <textarea className="w-full px-3 py-2 border border-edge rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" rows={3} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Playboard description..." />
      </div>
      <div>
        <label className="block text-sm font-medium text-content-secondary mb-2">Addon Configurations</label>
        <div className="flex space-x-2 mb-2">
          <Input value={addonInput} onChange={(e) => setAddonInput(e.target.value)} placeholder="customer-api_v2" />
          <Button type="button" onClick={addAddon} variant="secondary">Add</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {formData.addon_configurations.map((addon, idx) => (
            <Badge key={idx} variant="primary" className="flex items-center">
              {addon}
              <button type="button" onClick={() => removeAddon(idx)} className="ml-1 text-red-500 hover:text-red-700">x</button>
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}

function FiltersTab({ filters, currentFilter, setCurrentFilter, addFilter, removeFilter, optionInput, setOptionInput, addOption, removeOption }) {
  return (
    <div className="space-y-4">
      {filters.length > 0 && (
        <div className="bg-surface-secondary rounded-lg p-4 mb-4">
          <h4 className="font-medium text-content mb-2">Configured Filters ({filters.length})</h4>
          <div className="space-y-2">
            {filters.map((filter, idx) => (
              <div key={idx} className="flex items-center justify-between bg-surface p-3 rounded border">
                <div>
                  <span className="font-medium">{filter.displayName}</span>
                  <span className="text-content-muted text-sm ml-2">({filter.name})</span>
                  <Badge variant="default" className="ml-2">{filter.attributes?.find(a => a.key === 'type')?.value || 'input'}</Badge>
                </div>
                <button type="button" onClick={() => removeFilter(idx)} className="text-red-500 hover:text-red-700"><X size={16} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border rounded-lg p-4">
        <h4 className="font-medium text-content mb-3">Add New Filter</h4>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Name (key)" value={currentFilter.name} onChange={(e) => setCurrentFilter({ ...currentFilter, name: e.target.value, dataKey: e.target.value })} placeholder="query_text" />
          <Input label="Display Name" value={currentFilter.displayName} onChange={(e) => setCurrentFilter({ ...currentFilter, displayName: e.target.value })} placeholder="Customer#" />
        </div>
        <div className="grid grid-cols-3 gap-4 mt-4">
          <Select label="Type" value={currentFilter.type} onChange={(e) => setCurrentFilter({ ...currentFilter, type: e.target.value })} options={[{ value: 'input', label: 'Text Input' }, { value: 'select', label: 'Select Dropdown' }, { value: 'date', label: 'Date Picker' }, { value: 'checkbox', label: 'Checkbox' }, { value: 'radio', label: 'Radio' }]} />
          <Input label="Default Value" value={currentFilter.defaultValue} onChange={(e) => setCurrentFilter({ ...currentFilter, defaultValue: e.target.value })} />
          <Input label="Regex Pattern" value={currentFilter.regex} onChange={(e) => setCurrentFilter({ ...currentFilter, regex: e.target.value })} placeholder="[A-Za-z0-9]" />
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <Input label="Input Hint" value={currentFilter.inputHint} onChange={(e) => setCurrentFilter({ ...currentFilter, inputHint: e.target.value })} placeholder="Enter Customer# or name" />
          <Input label="Title" value={currentFilter.title} onChange={(e) => setCurrentFilter({ ...currentFilter, title: e.target.value })} placeholder="Enter Customer#'s or name" />
        </div>
        {currentFilter.type === 'select' && (
          <div className="mt-4 border-t pt-4">
            <label className="block text-sm font-medium text-content-secondary mb-2">Options</label>
            <div className="flex space-x-2 mb-2">
              <Input placeholder="Value (e.g., 01)" value={optionInput.value} onChange={(e) => setOptionInput({ ...optionInput, value: e.target.value })} />
              <Input placeholder="Display Name (e.g., 01 - Option)" value={optionInput.name} onChange={(e) => setOptionInput({ ...optionInput, name: e.target.value })} />
              <Button type="button" onClick={addOption} variant="secondary">Add</Button>
            </div>
            {currentFilter.options.length > 0 && (
              <div className="bg-surface-secondary rounded p-2 max-h-32 overflow-y-auto">
                {currentFilter.options.map((opt, idx) => (
                  <div key={idx} className="flex items-center justify-between py-1">
                    <span className="text-sm">{opt.value} - {opt.name}</span>
                    <button type="button" onClick={() => removeOption(idx)} className="text-red-500">x</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="flex items-center space-x-4 mt-4">
          <Toggle enabled={currentFilter.visible} onChange={(val) => setCurrentFilter({ ...currentFilter, visible: val })} label="Visible" />
        </div>
        <Button type="button" onClick={addFilter} variant="secondary" className="mt-4" disabled={!currentFilter.name || !currentFilter.displayName}>
          Add Filter
        </Button>
      </div>
    </div>
  );
}

function RowActionsTab({ events, currentRowAction, setCurrentRowAction, addRowAction, removeRowAction, actionFilterInput, setActionFilterInput, addActionFilter, removeActionFilter, domains }) {
  return (
    <div className="space-y-4">
      {events.length > 0 && (
        <div className="bg-surface-secondary rounded-lg p-4 mb-4">
          <h4 className="font-medium text-content mb-2">Configured Row Actions ({events.length})</h4>
          <div className="space-y-2">
            {events.map((action, idx) => {
              const isActive = action.status === 'A';
              return (
              <div key={idx} className="bg-surface p-3 rounded border">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">{action.name}</span>
                    <span className="text-content-muted text-sm ml-2">-&gt; {action.path}</span>
                    <Badge variant={isActive ? 'success' : 'danger'} className="ml-2">{isActive ? 'Active' : 'Inactive'}</Badge>
                    {action.filters && action.filters.length > 0 && (
                      <Badge variant="primary" className="ml-2">{action.filters.length} filters</Badge>
                    )}
                  </div>
                  <button type="button" onClick={() => removeRowAction(idx)} className="text-red-500 hover:text-red-700"><X size={16} /></button>
                </div>
                {action.filters && action.filters.length > 0 && (
                  <div className="mt-2 pt-2 border-t text-xs text-content-muted">
                    {action.filters.map((f, i) => (
                      <span key={i} className="mr-3">{f.inputKey} -&gt; {f.dataKey}</span>
                    ))}
                  </div>
                )}
              </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="border rounded-lg p-4">
        <h4 className="font-medium text-content mb-3">Add New Row Action</h4>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Key" value={currentRowAction.key} onChange={(e) => setCurrentRowAction({ ...currentRowAction, key: e.target.value })} placeholder="orders_scenario_6" />
          <Input label="Button Name" value={currentRowAction.name} onChange={(e) => setCurrentRowAction({ ...currentRowAction, name: e.target.value })} placeholder="Orders" />
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <Input label="Path" value={currentRowAction.path} onChange={(e) => setCurrentRowAction({ ...currentRowAction, path: e.target.value })} placeholder="/report/orders_scenario_6" />
          <Select label="Data Domain" value={currentRowAction.dataDomain} onChange={(e) => setCurrentRowAction({ ...currentRowAction, dataDomain: e.target.value })} options={[{ value: '', label: 'Select Domain' }, ...domains.map(d => ({ value: d.key, label: d.name }))]} />
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <Select label="Status" value={currentRowAction.status} onChange={(e) => setCurrentRowAction({ ...currentRowAction, status: e.target.value })} options={[{ value: 'A', label: 'Active' }, { value: 'I', label: 'Inactive' }]} />
        </div>
        <div className="mt-4 border-t pt-4">
          <label className="block text-sm font-medium text-content-secondary mb-2">Filters (maps row data to navigation params)</label>
          <div className="flex space-x-2 mb-2">
            <Input placeholder="inputKey (e.g., query_customer)" value={actionFilterInput.inputKey} onChange={(e) => setActionFilterInput({ ...actionFilterInput, inputKey: e.target.value })} />
            <Input placeholder="dataKey (e.g., customer)" value={actionFilterInput.dataKey} onChange={(e) => setActionFilterInput({ ...actionFilterInput, dataKey: e.target.value })} />
            <Button type="button" onClick={addActionFilter} variant="secondary">Add</Button>
          </div>
          {currentRowAction.filters.length > 0 && (
            <div className="bg-surface-secondary rounded p-2 space-y-1">
              {currentRowAction.filters.map((filter, idx) => (
                <div key={idx} className="flex items-center justify-between bg-surface p-2 rounded border text-sm">
                  <span>
                    <span className="text-content-muted">inputKey:</span> <span className="font-medium">{filter.inputKey}</span>
                    <span className="mx-2">-&gt;</span>
                    <span className="text-content-muted">dataKey:</span> <span className="font-medium">{filter.dataKey}</span>
                  </span>
                  <button type="button" onClick={() => removeActionFilter(idx)} className="text-red-500 hover:text-red-700">x</button>
                </div>
              ))}
            </div>
          )}
        </div>
        <Button type="button" onClick={addRowAction} variant="secondary" className="mt-4" disabled={!currentRowAction.key || !currentRowAction.name}>
          Add Row Action
        </Button>
      </div>
    </div>
  );
}

function GridSettingsTab({ formData, onRenderAsChange, onDefaultSizeChange, onPaginatedChange }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Select label="Row Actions Render As" value={formData.widgets.grid.actions.rowActions.renderAs} onChange={onRenderAsChange} options={[{ value: 'button', label: 'Buttons' }, { value: 'dropdown', label: 'Dropdown Menu' }, { value: 'icons', label: 'Icon Buttons' }]} />
        <Input label="Default Page Size" type="number" value={formData.widgets.grid.layout.defaultSize} onChange={onDefaultSizeChange} />
      </div>
      <Toggle enabled={formData.widgets?.grid?.layout?.ispaginated === true} onChange={onPaginatedChange} label="Enable Pagination" />
    </div>
  );
}

function DescriptionTab({ descriptions, currentDescription, setCurrentDescription, addDescription, removeDescription }) {
  return (
    <div className="space-y-4">
      {descriptions.length > 0 && (
        <div className="bg-surface-secondary rounded-lg p-4 mb-4">
          <h4 className="font-medium text-content mb-2">Scenario Description Items</h4>
          <div className="space-y-2">
            {descriptions.map((desc, idx) => (
              <div key={idx} className="flex items-center justify-between bg-surface p-3 rounded border">
                <div>
                  <Badge variant="default" className="mr-2">{desc.type}</Badge>
                  <span className="text-content-secondary">{desc.text || '(empty)'}</span>
                </div>
                <button type="button" onClick={() => removeDescription(idx)} className="text-red-500 hover:text-red-700"><X size={16} /></button>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="border rounded-lg p-4">
        <h4 className="font-medium text-content mb-3">Add Description Element</h4>
        <div className="grid grid-cols-4 gap-4">
          <Select label="Type" value={currentDescription.type} onChange={(e) => setCurrentDescription({ ...currentDescription, type: e.target.value })} options={[{ value: 'h3', label: 'Heading 3' }, { value: 'h4', label: 'Heading 4' }, { value: 'p', label: 'Paragraph' }, { value: 'ol', label: 'Ordered List' }, { value: 'ul', label: 'Unordered List' }, { value: 'br', label: 'Line Break' }, { value: 'code', label: 'Code Block' }]} />
          <div className="col-span-3">
            <Input label="Text" value={currentDescription.text} onChange={(e) => setCurrentDescription({ ...currentDescription, text: e.target.value })} placeholder="Description text..." />
          </div>
        </div>
        <Button type="button" onClick={addDescription} variant="secondary" className="mt-4">Add Description</Button>
      </div>
    </div>
  );
}

function JsonPreviewTab({ formData, scenarioKey }) {
  return (
    <div>
      <pre className="bg-neutral-900 text-green-400 p-4 rounded-lg overflow-auto max-h-96 text-xs">
        {JSON.stringify({
          key: formData.key,
          dataDomain: formData.dataDomain,
          scenarioKey: formData.scenarioKey || scenarioKey,
          order: formData.order,
          status: formData.status,
          program_key: formData.program_key,
          config_type: formData.config_type,
          addon_configurations: formData.addon_configurations,
          widgets: formData.widgets,
          scenarioDescription: formData.scenarioDescription
        }, null, 2)}
      </pre>
    </div>
  );
}

function UploadJsonModal({ isOpen, onClose, onSubmit, onFileSelect, uploadFile, uploadName, setUploadName, uploadDescription, setUploadDescription, scenarioKey, jsonPreview }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Upload Playboard JSON" size="xl">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-content-secondary mb-2">JSON File *</label>
          <FileUpload accept=".json" label="Select playboard JSON file" onFileSelect={onFileSelect} />
          {uploadFile && <p className="mt-2 text-sm text-green-600">Selected: {uploadFile.name}</p>}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Name (optional, auto-detected from JSON)" value={uploadName} onChange={(e) => setUploadName(e.target.value)} placeholder="Playboard name" />
          <Input label="Scenario Key" value={scenarioKey} disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-content-secondary mb-1">Description (optional)</label>
          <textarea className="w-full px-3 py-2 border border-edge rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" rows={2} value={uploadDescription} onChange={(e) => setUploadDescription(e.target.value)} placeholder="Playboard description..." />
        </div>
        {jsonPreview && <JsonPreviewSummary jsonPreview={jsonPreview} />}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
          <p className="font-medium text-blue-800 mb-2">Expected JSON Structure:</p>
          <pre className="text-blue-700 text-xs overflow-auto">
{`{
  "key": "playboard_key",
  "dataDomain": "customers",
  "scenarioKey": "scenario_key",
  "status": "A",
  "widgets": {
    "filters": [...],
    "grid": { "actions": {...}, "layout": {...} },
    "pagination": [...]
  },
  "scenarioDescription": [...]
}`}
          </pre>
        </div>
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={!uploadFile}>Upload Playboard</Button>
        </div>
      </form>
    </Modal>
  );
}

function JsonPreviewSummary({ jsonPreview }) {
  const isActive = jsonPreview.status === 'A';
  return (
    <div>
      <label className="block text-sm font-medium text-content-secondary mb-2">JSON Preview</label>
      <div className="bg-surface-secondary rounded-lg p-4 border">
        <div className="grid grid-cols-2 gap-4 text-sm mb-3">
          <div><span className="text-content-muted">Key:</span>{' '}<span className="font-medium">{jsonPreview.key || '-'}</span></div>
          <div><span className="text-content-muted">Scenario:</span>{' '}<span className="font-medium">{jsonPreview.scenarioKey || '-'}</span></div>
          <div><span className="text-content-muted">Data Domain:</span>{' '}<span className="font-medium">{jsonPreview.dataDomain || '-'}</span></div>
          <div><span className="text-content-muted">Status:</span>{' '}<Badge variant={isActive ? 'success' : 'danger'}>{isActive ? 'Active' : 'Inactive'}</Badge></div>
          <div><span className="text-content-muted">Filters:</span>{' '}<Badge variant="primary">{jsonPreview.widgets?.filters?.length || 0}</Badge></div>
          <div><span className="text-content-muted">Row Actions:</span>{' '}<Badge variant="success">{jsonPreview.widgets?.grid?.actions?.rowActions?.events?.length || 0}</Badge></div>
        </div>
        <details className="mt-2">
          <summary className="cursor-pointer text-sm text-primary-600 hover:text-primary-700">View Full JSON</summary>
          <pre className="mt-2 bg-neutral-900 text-green-400 p-3 rounded text-xs overflow-auto max-h-48">{JSON.stringify(jsonPreview, null, 2)}</pre>
        </details>
      </div>
    </div>
  );
}

export default ScenarioDetailPage;
