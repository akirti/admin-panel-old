import { useState, useEffect, useCallback } from 'react';
import { Card, Button, Input, Table, Modal, Badge, SearchInput, Select, Toggle, FileUpload, Pagination } from '../../components/shared';
import { playboardsAPI, scenariosAPI, domainsAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { Eye, Download, Pencil, Trash2, X, Plus, Upload, ChevronUp, ChevronDown, Copy, ChevronRight } from 'lucide-react';

// Collapsible section component
const CollapsibleSection = ({ title, defaultOpen = false, children, badge }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border rounded-lg">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 text-sm font-medium text-content-secondary hover:bg-surface-secondary rounded-t-lg"
      >
        <div className="flex items-center gap-2">
          <ChevronRight size={14} className={`transition-transform ${isOpen ? 'rotate-90' : ''}`} />
          {title}
          {badge}
        </div>
      </button>
      {isOpen && <div className="p-3 pt-0 border-t">{children}</div>}
    </div>
  );
};

// Filter type icon helper
const filterTypeIcon = (type) => {
  const icons = {
    'input': 'Aa',
    'select': '\u25BC',
    'dropdown': '\u25BC',
    'multi-select': '\u2630',
    'date-picker': '\uD83D\uDCC5',
    'date-range': '\uD83D\uDCC5\u2194',
    'radioButton': '\u25C9',
    'toggleButton': '\u21C6',
    'checkbox': '\u2611',
  };
  return icons[type] || '\u25A0';
};

// Types that support value/name options
const OPTION_TYPES = ['select', 'dropdown', 'multi-select', 'radioButton'];
// Toggle button has special options
const TOGGLE_TYPE = 'toggleButton';

// All available filter types
const FILTER_TYPE_OPTIONS = [
  { value: 'input', label: 'Text Input' },
  { value: 'select', label: 'Select Dropdown' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'multi-select', label: 'Multi-Select' },
  { value: 'date-picker', label: 'Date Picker' },
  { value: 'date-range', label: 'Date Range' },
  { value: 'radioButton', label: 'Radio Button' },
  { value: 'toggleButton', label: 'Toggle Button' },
  { value: 'checkbox', label: 'Checkbox' },
];

// Validator type options
const VALIDATOR_TYPE_OPTIONS = [
  { value: 'number', label: 'Number' },
  { value: 'regex', label: 'Regex' },
  { value: 'multi-select', label: 'Multi-Select' },
  { value: 'text', label: 'Text' },
  { value: 'userIdOrEmail', label: 'User ID or Email' },
  { value: 'stringValidator', label: 'String Validator' },
  { value: 'numberOfDigits', label: 'Number of Digits' },
  { value: 'customerNumber', label: 'Customer Number' },
  { value: 'greaterThan', label: 'Greater Than' },
  { value: 'lessThan', label: 'Less Than' },
  { value: 'range', label: 'Range' },
  { value: 'format', label: 'Format' },
];

// Available attribute names from WidgetAttributeKeyTypes enum
const ATTRIBUTE_NAME_OPTIONS = [
  'type', 'options', 'defaultValue', 'width', 'validate', 'regex',
  'format', 'min', 'max', 'placeholder', 'multiselect', 'clearable', 'searchable'
];

const TABS = [
  { id: 'basic', label: 'Basic Info' },
  { id: 'filters', label: 'Filters' },
  { id: 'grid', label: 'Grid & Actions' },
  { id: 'description', label: 'Description' },
  { id: 'json', label: 'JSON Preview' }
];

// --- Extracted Tab Sub-components ---

const BasicInfoTab = ({ formData, setFormData, scenarios, domains, addonInput, setAddonInput, addAddon, removeAddon }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 gap-4">
      <Input label="Key *" value={formData.key} onChange={(e) => setFormData({ ...formData, key: e.target.value })} placeholder="customers_scenario_playboard_1" required />
      <Input label="Name *" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Customer Search Playboard" required />
    </div>
    <div className="grid grid-cols-2 gap-4">
      <Select label="Scenario *" value={formData.scenarioKey} onChange={(e) => setFormData({ ...formData, scenarioKey: e.target.value })} options={[{ value: '', label: 'Select Scenario' }, ...scenarios.map(s => ({ value: s.key, label: s.name }))]} />
      <Select label="Data Domain" value={formData.dataDomain} onChange={(e) => setFormData({ ...formData, dataDomain: e.target.value })} options={[{ value: '', label: 'Select Domain' }, ...domains.map(d => ({ value: d.key, label: d.name }))]} />
    </div>
    <div className="grid grid-cols-3 gap-4">
      <Input label="Program Key" value={formData.program_key} onChange={(e) => setFormData({ ...formData, program_key: e.target.value })} placeholder="generic_search_logic" />
      <Select label="Config Type" value={formData.config_type} onChange={(e) => setFormData({ ...formData, config_type: e.target.value })} options={[{ value: 'db', label: 'Database' }, { value: 'gcs', label: 'GCS' }, { value: 'db+gcs', label: 'DB+GCS' }]} />
      <Input label="Order" type="number" value={formData.order} onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })} />
    </div>
    <div className="grid grid-cols-2 gap-4">
      <Select label="Status" value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} />
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

const FilterCard = ({ filter, idx, editingFilterIndex, filtersLength, onEdit, onMoveFilter, onRemoveFilter }) => {
  const getFilterType = () => {
    if (filter.type) return filter.type;
    if (Array.isArray(filter.attributes)) {
      const typeAttr = filter.attributes.find(a => a.name === 'type' || a.key === 'type');
      return typeAttr?.value || 'input';
    }
    if (filter.attributes && typeof filter.attributes === 'object') {
      return filter.attributes.value || filter.attributes.name || 'input';
    }
    return 'input';
  };
  const filterType = getFilterType();
  const attrCount = Array.isArray(filter.attributes) ? filter.attributes.length : 0;
  const validatorCount = Array.isArray(filter.validators) ? filter.validators.length : 0;
  const isEditing = editingFilterIndex === idx;

  return (
    <div
      className={`flex items-center justify-between bg-surface p-3 rounded border cursor-pointer hover:bg-surface-secondary ${isEditing ? 'ring-2 ring-blue-500' : ''}`}
      onClick={() => onEdit(idx)}
    >
      <div className="flex items-center gap-2">
        <span className="text-lg w-6 text-center" title={filterType}>{filterTypeIcon(filterType)}</span>
        <div>
          <span className="font-medium">{filter.displayName}</span>
          <span className="text-content-muted text-xs ml-2">{filter.dataKey}</span>
        </div>
        <Badge variant="default" className="ml-1 text-xs">{filterType}</Badge>
        {attrCount > 0 && <Badge variant="primary" className="text-xs">{attrCount} attrs</Badge>}
        {validatorCount > 0 && <Badge variant="warning" className="text-xs">{validatorCount} validators</Badge>}
        {isEditing && <Badge variant="warning" className="text-xs">Editing</Badge>}
      </div>
      <div className="flex items-center space-x-1">
        {idx > 0 && (
          <button type="button" onClick={(e) => { e.stopPropagation(); onMoveFilter(idx, -1); }} className="p-1 text-content-muted hover:text-content" title="Move up"><ChevronUp size={14} /></button>
        )}
        {idx < filtersLength - 1 && (
          <button type="button" onClick={(e) => { e.stopPropagation(); onMoveFilter(idx, 1); }} className="p-1 text-content-muted hover:text-content" title="Move down"><ChevronDown size={14} /></button>
        )}
        <button type="button" onClick={(e) => { e.stopPropagation(); onEdit(idx); }} className="p-1 text-blue-500 hover:text-blue-700" title="Edit"><Pencil size={14} /></button>
        <button type="button" onClick={(e) => { e.stopPropagation(); onRemoveFilter(idx); }} className="p-1 text-red-500 hover:text-red-700" title="Delete"><X size={14} /></button>
      </div>
    </div>
  );
};

const FilterOptionsSection = ({ currentFilter, optionInput, setOptionInput, addOption, removeOption, toggleOptionInput, setToggleOptionInput, addToggleOption }) => {
  if (!OPTION_TYPES.includes(currentFilter.type) && currentFilter.type !== TOGGLE_TYPE) return null;

  return (
    <div className="mt-3">
      <CollapsibleSection title="Options" defaultOpen={true} badge={currentFilter.options.length > 0 ? <Badge variant="primary" className="text-xs">{currentFilter.options.length}</Badge> : null}>
        <div className="mt-3">
          {OPTION_TYPES.includes(currentFilter.type) && (
            <>
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
            </>
          )}
          {currentFilter.type === TOGGLE_TYPE && (
            <>
              <div className="grid grid-cols-4 gap-2 mb-2">
                <Input placeholder="Data Key" value={toggleOptionInput.dataKey} onChange={(e) => setToggleOptionInput({ ...toggleOptionInput, dataKey: e.target.value })} />
                <Input placeholder="Name" value={toggleOptionInput.name} onChange={(e) => setToggleOptionInput({ ...toggleOptionInput, name: e.target.value })} />
                <Input placeholder="On Value" value={toggleOptionInput.onValue} onChange={(e) => setToggleOptionInput({ ...toggleOptionInput, onValue: e.target.value })} />
                <div className="flex space-x-2">
                  <Input placeholder="Off Value" value={toggleOptionInput.offValue} onChange={(e) => setToggleOptionInput({ ...toggleOptionInput, offValue: e.target.value })} />
                  <Button type="button" onClick={addToggleOption} variant="secondary">Add</Button>
                </div>
              </div>
              {currentFilter.options.length > 0 && (
                <div className="bg-surface-secondary rounded p-2 max-h-32 overflow-y-auto">
                  {currentFilter.options.map((opt, idx) => (
                    <div key={idx} className="flex items-center justify-between py-1 text-sm">
                      <span>{opt.dataKey || opt.value}: {opt.name} (on={opt.onValue}, off={opt.offValue})</span>
                      <button type="button" onClick={() => removeOption(idx)} className="text-red-500">x</button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </CollapsibleSection>
    </div>
  );
};

const FilterValidationSection = ({ currentFilter, validatorInput, setValidatorInput, addValidator, removeValidator }) => (
  <div className="mt-3">
    <CollapsibleSection title="Validation" badge={currentFilter.validators.length > 0 ? <Badge variant="warning" className="text-xs">{currentFilter.validators.length}</Badge> : null}>
      <div className="mt-3 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <Select label="Type" value={validatorInput.type} onChange={(e) => setValidatorInput({ ...validatorInput, type: e.target.value })} options={VALIDATOR_TYPE_OPTIONS} />
          <Input label="Expression" value={validatorInput.expression} onChange={(e) => setValidatorInput({ ...validatorInput, expression: e.target.value })} placeholder="e.g., ^[0-9]+$" />
          <div className="flex items-end space-x-2">
            <Input label="Message" value={validatorInput.message} onChange={(e) => setValidatorInput({ ...validatorInput, message: e.target.value })} placeholder="Invalid input" />
            <Button type="button" onClick={addValidator} variant="secondary" className="mb-0">Add</Button>
          </div>
        </div>
        {currentFilter.validators.length > 0 && (
          <div className="bg-surface-secondary rounded p-2 max-h-32 overflow-y-auto space-y-1">
            {currentFilter.validators.map((v, idx) => (
              <div key={idx} className="flex items-center justify-between bg-surface p-2 rounded border text-sm">
                <span>
                  <Badge variant="default" className="mr-2 text-xs">{v.type}</Badge>
                  {v.expression && <span className="text-content-muted mr-2">{v.expression}</span>}
                  {v.message && <span className="text-content-secondary italic">&quot;{v.message}&quot;</span>}
                </span>
                <button type="button" onClick={() => removeValidator(idx)} className="text-red-500 hover:text-red-700"><X size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </CollapsibleSection>
  </div>
);

const FilterAttributesSection = ({ currentFilter, filterAttributeInput, setFilterAttributeInput, addFilterAttribute, removeFilterAttribute }) => (
  <div className="mt-3">
    <CollapsibleSection title="Advanced Attributes" badge={currentFilter.attributes.length > 0 ? <Badge variant="primary" className="text-xs">{currentFilter.attributes.length}</Badge> : null}>
      <div className="mt-3">
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div>
            <input list="attribute-names" type="text" className="w-full px-3 py-2 border border-edge rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="Name (e.g., width)" value={filterAttributeInput.name} onChange={(e) => setFilterAttributeInput({ ...filterAttributeInput, name: e.target.value })} />
            <datalist id="attribute-names">
              {ATTRIBUTE_NAME_OPTIONS.map(opt => <option key={opt} value={opt} />)}
            </datalist>
          </div>
          <div className="flex space-x-2">
            <input type="text" className="flex-1 px-3 py-2 border border-edge rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="Value (e.g., 200px)" value={filterAttributeInput.value} onChange={(e) => setFilterAttributeInput({ ...filterAttributeInput, value: e.target.value })} />
            <Button type="button" onClick={addFilterAttribute} variant="secondary">Add</Button>
          </div>
        </div>
        {currentFilter.attributes.length > 0 && (
          <div className="bg-surface-secondary rounded p-2 max-h-32 overflow-y-auto space-y-1">
            {currentFilter.attributes.map((attr, idx) => (
              <div key={idx} className="flex items-center justify-between bg-surface p-2 rounded border text-sm">
                <span>
                  <span className="font-medium text-content-secondary">{attr.name}</span>
                  <span className="mx-2">:</span>
                  <span className="text-content-muted">{typeof attr.value === 'object' ? JSON.stringify(attr.value) : attr.value}</span>
                </span>
                <button type="button" onClick={() => removeFilterAttribute(idx)} className="text-red-500 hover:text-red-700"><X size={16} /></button>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-content-muted mt-1">Standard attributes (type, defaultValue, regex, options) are auto-managed from the form fields above.</p>
      </div>
    </CollapsibleSection>
  </div>
);

const RowActionCard = ({ action, idx, editingRowActionIndex, eventsLength, onEdit, onMoveRowAction, onRemoveRowAction }) => {
  const isEditing = editingRowActionIndex === idx;
  return (
    <div
      className={`bg-surface p-3 rounded border cursor-pointer hover:bg-surface-secondary ${isEditing ? 'ring-2 ring-blue-500' : ''}`}
      onClick={() => onEdit(idx)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium">{action.name}</span>
          <span className="text-content-muted text-xs">({action.key})</span>
          <span className="text-content-muted text-xs">-&gt; {action.path}</span>
          <Badge variant={action.status === 'active' ? 'success' : 'danger'} className="text-xs">{action.status === 'active' ? 'Active' : 'Inactive'}</Badge>
          {action.filters && action.filters.length > 0 && <Badge variant="primary" className="text-xs">{action.filters.length} filters</Badge>}
          {isEditing && <Badge variant="warning" className="text-xs">Editing</Badge>}
        </div>
        <div className="flex items-center space-x-1">
          {idx > 0 && <button type="button" onClick={(e) => { e.stopPropagation(); onMoveRowAction(idx, -1); }} className="p-1 text-content-muted hover:text-content" title="Move up"><ChevronUp size={14} /></button>}
          {idx < eventsLength - 1 && <button type="button" onClick={(e) => { e.stopPropagation(); onMoveRowAction(idx, 1); }} className="p-1 text-content-muted hover:text-content" title="Move down"><ChevronDown size={14} /></button>}
          <button type="button" onClick={(e) => { e.stopPropagation(); onEdit(idx); }} className="p-1 text-blue-500 hover:text-blue-700" title="Edit"><Pencil size={14} /></button>
          <button type="button" onClick={(e) => { e.stopPropagation(); onRemoveRowAction(idx); }} className="p-1 text-red-500 hover:text-red-700" title="Delete"><X size={14} /></button>
        </div>
      </div>
      {action.filters && action.filters.length > 0 && (
        <div className="mt-2 pt-2 border-t text-xs text-content-muted">
          {action.filters.map((f, i) => <span key={i} className="mr-3">{f.inputKey} -&gt; {f.dataKey}</span>)}
        </div>
      )}
    </div>
  );
};

const GridColumnsSection = ({ formData, columnInput, setColumnInput, addColumn, removeColumn, moveColumn }) => {
  const colums = formData.widgets?.grid?.layout?.colums || [];
  const headers = formData.widgets?.grid?.layout?.headers || [];

  return (
    <div className="border-t pt-4 mt-4">
      <h4 className="font-medium text-content mb-3">
        Grid Columns
        {colums.length > 0 && <Badge variant="primary" className="ml-2 text-xs">{colums.length}</Badge>}
      </h4>
      <div className="flex space-x-2 mb-3">
        <Input placeholder="Column Key (e.g., customerNumber)" value={columnInput.key} onChange={(e) => setColumnInput({ ...columnInput, key: e.target.value })} />
        <Input placeholder="Header Label (e.g., Customer #)" value={columnInput.header} onChange={(e) => setColumnInput({ ...columnInput, header: e.target.value })} />
        <Button type="button" onClick={addColumn} variant="secondary">Add</Button>
      </div>
      {colums.length > 0 && (
        <div className="bg-surface-secondary rounded p-2 max-h-48 overflow-y-auto space-y-1">
          {colums.map((col, idx) => (
            <div key={idx} className="flex items-center justify-between bg-surface p-2 rounded border text-sm">
              <span>
                <span className="font-medium text-content-secondary">{col}</span>
                <span className="mx-2">&rarr;</span>
                <span className="text-content-muted">{headers[idx] || '-'}</span>
              </span>
              <div className="flex items-center space-x-1">
                {idx > 0 && <button type="button" onClick={() => moveColumn(idx, -1)} className="p-1 text-content-muted hover:text-content" title="Move up"><ChevronUp size={14} /></button>}
                {idx < colums.length - 1 && <button type="button" onClick={() => moveColumn(idx, 1)} className="p-1 text-content-muted hover:text-content" title="Move down"><ChevronDown size={14} /></button>}
                <button type="button" onClick={() => removeColumn(idx)} className="p-1 text-red-500 hover:text-red-700" title="Remove"><X size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const PaginationWidgetSection = ({ formData, setFormData }) => {
  const paginationItem = formData.widgets?.pagination?.[0] || {
    name: 'pagination_limit', dataKey: 'pagination_limit', displayName: 'Pagination', index: 0, visible: true, attributes: []
  };

  const getAttrValue = (attrName) => {
    const attr = paginationItem.attributes?.find(a => (a.name === attrName || a.key === attrName));
    return attr?.value || '';
  };

  const updatePaginationAttr = (attrName, value) => {
    const currentAttrs = paginationItem.attributes || [];
    const existingIdx = currentAttrs.findIndex(a => (a.name === attrName || a.key === attrName));
    let newAttrs;
    if (existingIdx >= 0) {
      newAttrs = [...currentAttrs];
      newAttrs[existingIdx] = { name: attrName, key: attrName, value };
    } else {
      newAttrs = [...currentAttrs, { name: attrName, key: attrName, value }];
    }
    setFormData({ ...formData, widgets: { ...formData.widgets, pagination: [{ ...paginationItem, attributes: newAttrs }] } });
  };

  const updatePaginationField = (field, value) => {
    setFormData({ ...formData, widgets: { ...formData.widgets, pagination: [{ ...paginationItem, [field]: value }] } });
  };

  return (
    <div className="border-t pt-4 mt-4">
      <h4 className="font-medium text-content mb-3">Pagination Widget</h4>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <Input label="Name" value={paginationItem.name || ''} onChange={(e) => updatePaginationField('name', e.target.value)} placeholder="pagination_limit" />
          <Input label="Data Key" value={paginationItem.dataKey || ''} onChange={(e) => updatePaginationField('dataKey', e.target.value)} placeholder="pagination_limit" />
          <Input label="Display Name" value={paginationItem.displayName || ''} onChange={(e) => updatePaginationField('displayName', e.target.value)} placeholder="Pagination" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Select label="Type" value={getAttrValue('type') || 'dropdown'} onChange={(e) => updatePaginationAttr('type', e.target.value)} options={[{ value: 'dropdown', label: 'Dropdown' }, { value: 'input', label: 'Input' }, { value: 'buttons', label: 'Buttons' }]} />
          <Input label="Width" value={getAttrValue('width') || ''} onChange={(e) => updatePaginationAttr('width', e.target.value)} placeholder="10em" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Options (comma-separated)" value={getAttrValue('options') || ''} onChange={(e) => updatePaginationAttr('options', e.target.value)} placeholder="25,50,75,100" />
          <Input label="Default Value" value={getAttrValue('defaultValue') || ''} onChange={(e) => updatePaginationAttr('defaultValue', e.target.value)} placeholder="25" />
        </div>
        <Toggle enabled={paginationItem.visible !== false} onChange={(val) => updatePaginationField('visible', val)} label="Visible" />
        {paginationItem.attributes && paginationItem.attributes.length > 0 && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-content-secondary mb-2">All Attributes</label>
            <div className="bg-surface-secondary rounded p-2 max-h-32 overflow-y-auto space-y-1">
              {paginationItem.attributes.map((attr, idx) => (
                <div key={idx} className="flex items-center justify-between bg-surface p-2 rounded border text-sm">
                  <span>
                    <span className="font-medium text-content-secondary">{attr.name || attr.key}</span>
                    <span className="mx-2">:</span>
                    <span className="text-content-muted">{typeof attr.value === 'object' ? JSON.stringify(attr.value) : attr.value}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const DescriptionTab = ({ formData, currentDescription, setCurrentDescription, addDescription, removeDescription }) => (
  <div className="space-y-4">
    {formData.scenarioDescription.length > 0 && (
      <div className="bg-surface-secondary rounded-lg p-4 mb-4">
        <h4 className="font-medium text-content mb-2">Scenario Description Items</h4>
        <div className="space-y-2">
          {formData.scenarioDescription.map((desc, idx) => (
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

const JsonPreviewTab = ({ formData, copyJsonToClipboard }) => {
  const jsonData = {
    key: formData.key, name: formData.name, description: formData.description,
    dataDomain: formData.dataDomain, scenarioKey: formData.scenarioKey, scenerioKey: formData.scenarioKey,
    order: formData.order, status: formData.status, program_key: formData.program_key,
    config_type: formData.config_type, addon_configurations: formData.addon_configurations,
    widgets: formData.widgets, scenarioDescription: formData.scenarioDescription
  };
  return (
    <div>
      <div className="flex justify-end mb-2">
        <Button type="button" variant="secondary" onClick={copyJsonToClipboard} className="flex items-center gap-1">
          <Copy size={14} /> Copy JSON
        </Button>
      </div>
      <pre className="bg-neutral-900 text-green-400 p-4 rounded-lg overflow-auto max-h-96 text-xs">
        {JSON.stringify(jsonData, null, 2)}
      </pre>
    </div>
  );
};

const UploadModal = ({ isOpen, onClose, scenarios, uploadFile, uploadScenarioKey, setUploadScenarioKey, uploadName, setUploadName, uploadDescription, setUploadDescription, jsonPreview, handleFileSelect, handleFileUpload }) => (
  <Modal isOpen={isOpen} onClose={onClose} title="Upload Playboard JSON" size="xl">
    <form onSubmit={handleFileUpload} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-content-secondary mb-2">JSON File *</label>
        <FileUpload accept=".json" label="Select playboard JSON file" onFileSelect={handleFileSelect} />
        {uploadFile && <p className="mt-2 text-sm text-green-600">Selected: {uploadFile.name}</p>}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Name (optional, auto-detected from JSON)" value={uploadName} onChange={(e) => setUploadName(e.target.value)} placeholder="Playboard name" />
        <Select label="Scenario (optional, auto-detected from JSON)" value={uploadScenarioKey} onChange={(e) => setUploadScenarioKey(e.target.value)} options={[{ value: '', label: 'Auto-detect from JSON' }, ...scenarios.map(s => ({ value: s.key, label: s.name }))]} />
      </div>
      <div>
        <label className="block text-sm font-medium text-content-secondary mb-1">Description (optional)</label>
        <textarea className="w-full px-3 py-2 border border-edge rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" rows={2} value={uploadDescription} onChange={(e) => setUploadDescription(e.target.value)} placeholder="Playboard description..." />
      </div>
      {jsonPreview && <JsonPreviewPanel jsonPreview={jsonPreview} />}
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

const JsonPreviewPanel = ({ jsonPreview }) => (
  <div>
    <label className="block text-sm font-medium text-content-secondary mb-2">JSON Preview</label>
    <div className="bg-surface-secondary rounded-lg p-4 border">
      <div className="grid grid-cols-2 gap-4 text-sm mb-3">
        <div><span className="text-content-muted">Key:</span> <span className="font-medium">{jsonPreview.key || '-'}</span></div>
        <div><span className="text-content-muted">Scenario:</span> <span className="font-medium">{jsonPreview.scenarioKey || '-'}</span></div>
        <div><span className="text-content-muted">Data Domain:</span> <span className="font-medium">{jsonPreview.dataDomain || '-'}</span></div>
        <div><span className="text-content-muted">Status:</span> <Badge variant={jsonPreview.status === 'active' ? 'success' : 'danger'}>{jsonPreview.status === 'active' ? 'Active' : 'Inactive'}</Badge></div>
        <div><span className="text-content-muted">Filters:</span> <Badge variant="primary">{jsonPreview.widgets?.filters?.length || 0}</Badge></div>
        <div><span className="text-content-muted">Row Actions:</span> <Badge variant="success">{jsonPreview.widgets?.grid?.actions?.rowActions?.events?.length || 0}</Badge></div>
      </div>
      <details className="mt-2">
        <summary className="cursor-pointer text-sm text-primary-600 hover:text-primary-700">View Full JSON</summary>
        <pre className="mt-2 bg-neutral-900 text-green-400 p-3 rounded text-xs overflow-auto max-h-48">{JSON.stringify(jsonPreview, null, 2)}</pre>
      </details>
    </div>
  </div>
);

const DetailViewModal = ({ isOpen, onClose, selectedPlayboard }) => (
  <Modal isOpen={isOpen} onClose={onClose} title="Playboard Details" size="xl">
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
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </div>
      </div>
    )}
  </Modal>
);

// --- Custom hooks extracted to reduce cognitive complexity ---

const DEFAULT_WIDGETS = {
  filters: [],
  grid: { actions: { rowActions: { renderAs: 'button', attributes: [], events: [] }, headerActions: {} }, layout: { colums: [], headers: [], footer: [], ispaginated: true, defaultSize: 25 } },
  pagination: [{ name: 'pagination_limit', dataKey: 'pagination_limit', displayName: 'Pagination', index: 0, visible: true, attributes: [{ key: 'type', value: 'dropdown' }, { key: 'options', value: '25,50,75,100' }, { key: 'defaultValue', value: '25' }, { key: 'width', value: '10em' }] }]
};

const DEFAULT_FORM = {
  key: '', name: '', description: '', scenarioKey: '', dataDomain: '', status: 'active', order: 0,
  program_key: '', config_type: 'db', addon_configurations: [],
  widgets: { ...DEFAULT_WIDGETS },
  scenarioDescription: []
};

const DEFAULT_FILTER = {
  name: '', dataKey: '', displayName: '', index: 0, visible: true, status: 'Y', inputHint: '', title: '',
  type: 'input', defaultValue: '', regex: '', options: [], attributes: [], validators: [], styleClasses: ''
};

function buildFormPayload(formData) {
  return {
    name: formData.name, description: formData.description, scenarioKey: formData.scenarioKey,
    scenerioKey: formData.scenarioKey, status: formData.status, key: formData.key,
    dataDomain: formData.dataDomain, order: formData.order, program_key: formData.program_key,
    config_type: formData.config_type, addon_configurations: formData.addon_configurations,
    widgets: formData.widgets, scenarioDescription: formData.scenarioDescription,
  };
}

function buildWidgetsFromSource(sourceWidgets) {
  if (!sourceWidgets) return { ...DEFAULT_WIDGETS, pagination: [] };
  return {
    filters: (sourceWidgets.filters || []).map(f => ({ ...f, validators: f.validators || [], description: f.description || [], styleClasses: f.styleClasses || '' })),
    grid: {
      actions: {
        rowActions: { renderAs: sourceWidgets.grid?.actions?.rowActions?.renderAs || 'button', attributes: sourceWidgets.grid?.actions?.rowActions?.attributes || [], events: sourceWidgets.grid?.actions?.rowActions?.events || [] },
        headerActions: sourceWidgets.grid?.actions?.headerActions || {},
      },
      layout: { colums: sourceWidgets.grid?.layout?.colums || [], headers: sourceWidgets.grid?.layout?.headers || [], footer: sourceWidgets.grid?.layout?.footer || [], ispaginated: sourceWidgets.grid?.layout?.ispaginated !== undefined ? sourceWidgets.grid.layout.ispaginated : true, defaultSize: sourceWidgets.grid?.layout?.defaultSize || 25 },
    },
    pagination: sourceWidgets.pagination || [],
  };
}

function usePlayboardsData() {
  const [playboards, setPlayboards] = useState([]);
  const [scenarios, setScenarios] = useState([]);
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({ page: 0, limit: 25, total: 0, pages: 0 });

  const fetchData = useCallback(async () => {
    try {
      const [playboardsRes, scenariosRes, domainsRes] = await Promise.all([
        playboardsAPI.list({ search: search || undefined, page: pagination.page, limit: pagination.limit }),
        scenariosAPI.list({ limit: 100 }),
        domainsAPI.list({ limit: 100 }),
      ]);
      setPlayboards(playboardsRes.data.data || playboardsRes.data);
      setPagination(prev => ({ ...prev, ...(playboardsRes.data.pagination || {}) }));
      setScenarios(scenariosRes.data.data || scenariosRes.data);
      setDomains(domainsRes.data.data || domainsRes.data);
    } catch { toast.error('Failed to load data'); }
    finally { setLoading(false); }
  }, [search, pagination.page, pagination.limit]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handlePageChange = (newPage) => setPagination(prev => ({ ...prev, page: newPage }));

  return { playboards, scenarios, domains, loading, search, setSearch, pagination, setPagination, fetchData, handlePageChange };
}

function useFilterBuilder(formData, setFormData) {
  const [currentFilter, setCurrentFilter] = useState({ ...DEFAULT_FILTER });
  const [editingFilterIndex, setEditingFilterIndex] = useState(null);
  const [filterAttributeInput, setFilterAttributeInput] = useState({ name: '', value: '' });
  const [validatorInput, setValidatorInput] = useState({ type: 'number', expression: '', message: '' });
  const [optionInput, setOptionInput] = useState({ value: '', name: '' });
  const [toggleOptionInput, setToggleOptionInput] = useState({ dataKey: '', name: '', onValue: '', offValue: '' });

  const resetCurrentFilter = () => {
    setCurrentFilter({ ...DEFAULT_FILTER });
    setEditingFilterIndex(null);
    setFilterAttributeInput({ name: '', value: '' });
    setValidatorInput({ type: 'number', expression: '', message: '' });
  };

  const addFilterAttribute = () => {
    if (!filterAttributeInput.name || !filterAttributeInput.value) return;
    const existingIndex = currentFilter.attributes.findIndex(a => a.name === filterAttributeInput.name);
    const newAttr = { name: filterAttributeInput.name, key: filterAttributeInput.name, value: filterAttributeInput.value };
    if (existingIndex >= 0) {
      const newAttrs = [...currentFilter.attributes];
      newAttrs[existingIndex] = newAttr;
      setCurrentFilter({ ...currentFilter, attributes: newAttrs });
    } else {
      setCurrentFilter({ ...currentFilter, attributes: [...currentFilter.attributes, newAttr] });
    }
    setFilterAttributeInput({ name: '', value: '' });
  };

  const removeFilterAttribute = (index) => setCurrentFilter({ ...currentFilter, attributes: currentFilter.attributes.filter((_, i) => i !== index) });

  const addValidator = () => {
    if (!validatorInput.type) return;
    setCurrentFilter({ ...currentFilter, validators: [...currentFilter.validators, { ...validatorInput }] });
    setValidatorInput({ type: 'number', expression: '', message: '' });
  };

  const removeValidator = (index) => setCurrentFilter({ ...currentFilter, validators: currentFilter.validators.filter((_, i) => i !== index) });

  const addOption = () => {
    if (!optionInput.value || !optionInput.name) return;
    setCurrentFilter({ ...currentFilter, options: [...currentFilter.options, { ...optionInput }] });
    setOptionInput({ value: '', name: '' });
  };

  const removeOption = (index) => setCurrentFilter({ ...currentFilter, options: currentFilter.options.filter((_, i) => i !== index) });

  const addToggleOption = () => {
    if (!toggleOptionInput.dataKey || !toggleOptionInput.name) return;
    setCurrentFilter({ ...currentFilter, options: [...currentFilter.options, { ...toggleOptionInput }] });
    setToggleOptionInput({ dataKey: '', name: '', onValue: '', offValue: '' });
  };

  const addFilter = () => {
    let attributes = currentFilter.attributes.map(a => ({ name: a.name, key: a.key || a.name, value: a.value }));
    const updateOrAddAttr = (attrName, value) => {
      const existingIdx = attributes.findIndex(a => a.name === attrName);
      if (existingIdx >= 0) { attributes[existingIdx] = { name: attrName, key: attrName, value }; }
      else if (value !== undefined && value !== '' && value !== null) { attributes.push({ name: attrName, key: attrName, value }); }
    };
    updateOrAddAttr('type', currentFilter.type);
    if (currentFilter.defaultValue) updateOrAddAttr('defaultValue', currentFilter.defaultValue);
    if (currentFilter.regex) updateOrAddAttr('regex', currentFilter.regex);
    if ([...OPTION_TYPES, TOGGLE_TYPE].includes(currentFilter.type) && currentFilter.options.length > 0) updateOrAddAttr('options', currentFilter.options);

    const newFilter = {
      name: currentFilter.name, dataKey: currentFilter.dataKey || currentFilter.name, displayName: currentFilter.displayName,
      index: editingFilterIndex !== null ? editingFilterIndex : formData.widgets.filters.length,
      visible: currentFilter.visible, status: currentFilter.status, inputHint: currentFilter.inputHint, title: currentFilter.title,
      type: currentFilter.type, attributes, description: [], validators: currentFilter.validators || [], styleClasses: currentFilter.styleClasses || '',
    };

    const newFilters = editingFilterIndex !== null
      ? formData.widgets.filters.map((f, i) => i === editingFilterIndex ? newFilter : f)
      : [...formData.widgets.filters, newFilter];
    setFormData({ ...formData, widgets: { ...formData.widgets, filters: newFilters } });
    resetCurrentFilter();
  };

  const editFilter = (index) => {
    const filter = formData.widgets.filters[index];
    const getAttrValue = (attrName) => {
      if (!Array.isArray(filter.attributes)) return '';
      const attr = filter.attributes.find(a => (a.name === attrName || a.key === attrName));
      return attr?.value || '';
    };
    const filterType = filter.type || getAttrValue('type') || 'input';
    const options = getAttrValue('options');
    const allAttributes = Array.isArray(filter.attributes) ? filter.attributes.map(a => ({ name: a.name || a.key, key: a.key || a.name, value: a.value })) : [];
    setCurrentFilter({
      name: filter.name || '', dataKey: filter.dataKey || filter.name || '', displayName: filter.displayName || '',
      index: filter.index || index, visible: filter.visible !== false, status: filter.status || 'Y',
      inputHint: filter.inputHint || '', title: filter.title || '', type: filterType,
      defaultValue: getAttrValue('defaultValue'), regex: getAttrValue('regex'),
      options: Array.isArray(options) ? options : [], attributes: allAttributes,
      validators: filter.validators || [], styleClasses: filter.styleClasses || '',
    });
    setEditingFilterIndex(index);
  };

  const removeFilter = (index) => {
    const newFilters = formData.widgets.filters.filter((_, i) => i !== index);
    setFormData({ ...formData, widgets: { ...formData.widgets, filters: newFilters.map((f, i) => ({ ...f, index: i })) } });
    if (editingFilterIndex === index) resetCurrentFilter();
  };

  const moveFilter = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= formData.widgets.filters.length) return;
    const newFilters = [...formData.widgets.filters];
    [newFilters[index], newFilters[newIndex]] = [newFilters[newIndex], newFilters[index]];
    setFormData({ ...formData, widgets: { ...formData.widgets, filters: newFilters.map((f, i) => ({ ...f, index: i })) } });
  };

  return {
    currentFilter, setCurrentFilter, editingFilterIndex, filterAttributeInput, setFilterAttributeInput,
    validatorInput, setValidatorInput, optionInput, setOptionInput, toggleOptionInput, setToggleOptionInput,
    resetCurrentFilter, addFilterAttribute, removeFilterAttribute, addValidator, removeValidator,
    addOption, removeOption, addToggleOption, addFilter, editFilter, removeFilter, moveFilter,
  };
}

function useRowActionBuilder(formData, setFormData) {
  const [currentRowAction, setCurrentRowAction] = useState({ key: '', name: '', path: '', dataDomain: '', status: 'active', order: 0, filters: [] });
  const [actionFilterInput, setActionFilterInput] = useState({ inputKey: '', dataKey: '' });
  const [editingRowActionIndex, setEditingRowActionIndex] = useState(null);

  const getGridParts = () => {
    const rowActionsObj = formData.widgets?.grid?.actions?.rowActions || { renderAs: 'button', attributes: [], events: [] };
    const actionsObj = formData.widgets?.grid?.actions || { rowActions: rowActionsObj, headerActions: {} };
    const gridObj = formData.widgets?.grid || { actions: actionsObj, layout: { colums: [], headers: [], footer: [], ispaginated: true, defaultSize: 25 } };
    const events = rowActionsObj.events || [];
    return { rowActionsObj, actionsObj, gridObj, events };
  };

  const resetCurrentRowAction = () => {
    setCurrentRowAction({ key: '', name: '', path: '', dataDomain: '', status: 'active', order: 0, filters: [] });
    setEditingRowActionIndex(null);
    setActionFilterInput({ inputKey: '', dataKey: '' });
  };

  const addRowAction = () => {
    const { rowActionsObj, actionsObj, gridObj, events } = getGridParts();
    const newAction = { ...currentRowAction, order: editingRowActionIndex !== null ? editingRowActionIndex : events.length };
    const newEvents = editingRowActionIndex !== null
      ? events.map((e, i) => i === editingRowActionIndex ? newAction : e)
      : [...events, newAction];
    setFormData({ ...formData, widgets: { ...formData.widgets, grid: { ...gridObj, actions: { ...actionsObj, rowActions: { ...rowActionsObj, events: newEvents } } } } });
    resetCurrentRowAction();
  };

  const editRowAction = (index) => {
    const action = formData.widgets?.grid?.actions?.rowActions?.events?.[index];
    if (!action) return;
    setCurrentRowAction({ key: action.key || '', name: action.name || '', path: action.path || '', dataDomain: action.dataDomain || '', status: action.status || 'active', order: action.order || index, filters: action.filters || [] });
    setEditingRowActionIndex(index);
  };

  const removeRowAction = (index) => {
    const { rowActionsObj, actionsObj, gridObj, events } = getGridParts();
    const newEvents = events.filter((_, i) => i !== index).map((e, i) => ({ ...e, order: i }));
    setFormData({ ...formData, widgets: { ...formData.widgets, grid: { ...gridObj, actions: { ...actionsObj, rowActions: { ...rowActionsObj, events: newEvents } } } } });
    if (editingRowActionIndex === index) resetCurrentRowAction();
  };

  const moveRowAction = (index, direction) => {
    const events = formData.widgets?.grid?.actions?.rowActions?.events || [];
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= events.length) return;
    const newEvents = [...events];
    [newEvents[index], newEvents[newIndex]] = [newEvents[newIndex], newEvents[index]];
    setFormData({ ...formData, widgets: { ...formData.widgets, grid: { ...formData.widgets.grid, actions: { ...formData.widgets.grid.actions, rowActions: { ...formData.widgets.grid.actions.rowActions, events: newEvents.map((e, i) => ({ ...e, order: i })) } } } } });
  };

  const addActionFilter = () => {
    if (!actionFilterInput.inputKey || !actionFilterInput.dataKey) return;
    setCurrentRowAction({ ...currentRowAction, filters: [...currentRowAction.filters, { ...actionFilterInput }] });
    setActionFilterInput({ inputKey: '', dataKey: '' });
  };

  const removeActionFilter = (index) => setCurrentRowAction({ ...currentRowAction, filters: currentRowAction.filters.filter((_, i) => i !== index) });

  return {
    currentRowAction, setCurrentRowAction, actionFilterInput, setActionFilterInput, editingRowActionIndex,
    resetCurrentRowAction, addRowAction, editRowAction, removeRowAction, moveRowAction, addActionFilter, removeActionFilter,
  };
}

function useGridColumns(formData, setFormData) {
  const [columnInput, setColumnInput] = useState({ key: '', header: '' });

  const getLayoutAndGrid = () => {
    const layout = formData.widgets?.grid?.layout || { colums: [], headers: [], footer: [], ispaginated: true, defaultSize: 25 };
    const grid = formData.widgets?.grid || { actions: { rowActions: { renderAs: 'button', attributes: [], events: [] }, headerActions: {} }, layout };
    return { layout, grid };
  };

  const addColumn = () => {
    if (!columnInput.key || !columnInput.header) return;
    const { layout, grid } = getLayoutAndGrid();
    setFormData({ ...formData, widgets: { ...formData.widgets, grid: { ...grid, layout: { ...layout, colums: [...(layout.colums || []), columnInput.key], headers: [...(layout.headers || []), columnInput.header] } } } });
    setColumnInput({ key: '', header: '' });
  };

  const removeColumn = (index) => {
    const { layout, grid } = getLayoutAndGrid();
    setFormData({ ...formData, widgets: { ...formData.widgets, grid: { ...grid, layout: { ...layout, colums: (layout.colums || []).filter((_, i) => i !== index), headers: (layout.headers || []).filter((_, i) => i !== index) } } } });
  };

  const moveColumn = (index, direction) => {
    const { layout, grid } = getLayoutAndGrid();
    const colums = [...(layout.colums || [])];
    const headers = [...(layout.headers || [])];
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= colums.length) return;
    [colums[index], colums[newIndex]] = [colums[newIndex], colums[index]];
    [headers[index], headers[newIndex]] = [headers[newIndex], headers[index]];
    setFormData({ ...formData, widgets: { ...formData.widgets, grid: { ...grid, layout: { ...layout, colums, headers } } } });
  };

  return { columnInput, setColumnInput, addColumn, removeColumn, moveColumn };
}

// --- Main Component ---

const PlayboardsManagement = () => {
  const pbData = usePlayboardsData();
  const [modalOpen, setModalOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [selectedPlayboard, setSelectedPlayboard] = useState(null);
  const [activeTab, setActiveTab] = useState('basic');

  // Upload state
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadScenarioKey, setUploadScenarioKey] = useState('');
  const [uploadName, setUploadName] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [jsonPreview, setJsonPreview] = useState(null);

  const [formData, setFormData] = useState({ ...DEFAULT_FORM });
  const [currentDescription, setCurrentDescription] = useState({ index: 0, type: 'h3', text: '', nodes: [] });
  const [addonInput, setAddonInput] = useState('');

  const filterBuilder = useFilterBuilder(formData, setFormData);
  const rowActionBuilder = useRowActionBuilder(formData, setFormData);
  const gridColumns = useGridColumns(formData, setFormData);

  const resetForm = () => { setFormData({ ...DEFAULT_FORM }); setEditingItem(null); setActiveTab('basic'); };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await playboardsAPI.create(buildFormPayload(formData));
      toast.success('Playboard created successfully');
      setModalOpen(false); resetForm(); pbData.fetchData();
    } catch (error) { toast.error(error.response?.data?.detail || 'Failed to create playboard'); }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await playboardsAPI.update(editingItem.id || editingItem._id, buildFormPayload(formData));
      toast.success('Playboard updated successfully');
      setModalOpen(false); resetForm(); pbData.fetchData();
    } catch (error) { toast.error(error.response?.data?.detail || 'Failed to update playboard'); }
  };

  const handleDelete = async (item) => {
    if (!window.confirm('Are you sure you want to delete this playboard?')) return;
    try {
      await playboardsAPI.delete(item.id || item._id);
      toast.success('Playboard deleted successfully'); pbData.fetchData();
    } catch { toast.error('Failed to delete playboard'); }
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    const itemData = item.data || {};
    const sourceWidgets = item.widgets || itemData.widgets;
    const widgets = buildWidgetsFromSource(sourceWidgets);
    setFormData({
      key: item.key || itemData.key || item.name || '', name: item.name || '', description: item.description || '',
      scenarioKey: item.scenarioKey || itemData.scenarioKey || '', dataDomain: item.dataDomain || itemData.dataDomain || '',
      status: itemData.status || (item.status === 'active' ? 'active' : 'inactive'), order: item.order || itemData.order || 0,
      program_key: item.program_key || itemData.program_key || '', config_type: item.config_type || itemData.config_type || 'db',
      addon_configurations: item.addon_configurations || itemData.addon_configurations || [], widgets,
      scenarioDescription: item.scenarioDescription || itemData.scenarioDescription || [],
    });
    setModalOpen(true);
  };

  const handleViewDetails = (item) => { setSelectedPlayboard(item); setDetailModalOpen(true); };

  const handleFileSelect = async (file) => {
    setUploadFile(file);
    if (file && file.name.endsWith('.json')) {
      try {
        const text = await file.text();
        const json = JSON.parse(text);
        setJsonPreview(json);
        if (json.scenarioKey) setUploadScenarioKey(json.scenarioKey);
        if (json.key) setUploadName(json.key);
      } catch (e) { toast.error('Invalid JSON file'); setJsonPreview(null); }
    }
  };

  const resetUploadForm = () => { setUploadFile(null); setUploadScenarioKey(''); setUploadName(''); setUploadDescription(''); setJsonPreview(null); };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile) { toast.error('Please select a file'); return; }
    const formDataUpload = new FormData();
    formDataUpload.append('file', uploadFile);
    try {
      await playboardsAPI.upload(formDataUpload, { scenario_key: uploadScenarioKey || undefined, name: uploadName || undefined, description: uploadDescription || undefined });
      toast.success('Playboard uploaded successfully');
      setUploadModalOpen(false); resetUploadForm(); pbData.fetchData();
    } catch (error) { toast.error(error.response?.data?.detail || 'Upload failed'); }
  };

  const handleDownload = async (item) => {
    try {
      const response = await playboardsAPI.download(item.id || item._id);
      const dataStr = JSON.stringify(response.data, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${item.data?.key || item.name || 'playboard'}.json`; a.click();
      URL.revokeObjectURL(url);
      toast.success('Download started');
    } catch (error) { toast.error('Failed to download playboard'); }
  };

  const addDescription = () => {
    setFormData({ ...formData, scenarioDescription: [...formData.scenarioDescription, { index: formData.scenarioDescription.length, type: currentDescription.type, text: currentDescription.text, nodes: currentDescription.nodes }] });
    setCurrentDescription({ index: 0, type: 'h3', text: '', nodes: [] });
  };

  const removeDescription = (index) => {
    setFormData({ ...formData, scenarioDescription: formData.scenarioDescription.filter((_, i) => i !== index).map((d, i) => ({ ...d, index: i })) });
  };

  const addAddon = () => {
    if (addonInput && !formData.addon_configurations.includes(addonInput)) {
      setFormData({ ...formData, addon_configurations: [...formData.addon_configurations, addonInput] });
      setAddonInput('');
    }
  };

  const removeAddon = (index) => setFormData({ ...formData, addon_configurations: formData.addon_configurations.filter((_, i) => i !== index) });

  const copyJsonToClipboard = () => {
    const jsonStr = JSON.stringify(buildFormPayload(formData), null, 2);
    navigator.clipboard.writeText(jsonStr).then(() => toast.success('JSON copied to clipboard')).catch(() => toast.error('Failed to copy JSON'));
  };

  const columns = [
    { key: 'name', title: 'Name' },
    { key: 'data', title: 'Key', render: (val) => val?.key || '-' },
    { key: 'scenarioKey', title: 'Scenario' },
    { key: 'data', title: 'Data Domain', render: (val) => val?.dataDomain || '-' },
    { key: 'data', title: 'Filters', render: (val) => <Badge variant="primary">{val?.widgets?.filters?.length || 0}</Badge> },
    { key: 'data', title: 'Actions', render: (val) => <Badge variant="success">{val?.widgets?.grid?.actions?.rowActions?.events?.length || 0}</Badge> },
    { key: 'status', title: 'Status', render: (val) => <Badge variant={val === 'active' ? 'success' : 'danger'}>{val === 'active' ? 'Active' : 'Inactive'}</Badge> },
    { key: 'actions', title: 'Actions', render: (_, item) => (
      <div className="flex items-center space-x-2">
        <button onClick={(e) => { e.stopPropagation(); handleViewDetails(item); }} className="p-1 text-content-muted hover:text-blue-600" title="View JSON"><Eye size={16} /></button>
        <button onClick={(e) => { e.stopPropagation(); handleDownload(item); }} className="p-1 text-content-muted hover:text-green-600" title="Download JSON"><Download size={16} /></button>
        <button onClick={(e) => { e.stopPropagation(); openEditModal(item); }} className="p-1 text-content-muted hover:text-primary-600" title="Edit"><Pencil size={16} /></button>
        <button onClick={(e) => { e.stopPropagation(); handleDelete(item); }} className="p-1 text-red-500 hover:text-red-600" title="Delete"><Trash2 size={16} /></button>
      </div>
    )}
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-content">Playboards</h1>
          <p className="text-content-muted mt-1">Manage playboard configurations with widgets, filters, and actions</p>
        </div>
        <div className="flex space-x-3">
          <Button variant="secondary" onClick={() => { resetUploadForm(); setUploadModalOpen(true); }}><Upload size={16} className="mr-2" />Upload JSON</Button>
          <Button onClick={() => { resetForm(); setModalOpen(true); }}><Plus size={16} className="mr-2" />Build Playboard</Button>
        </div>
      </div>

      <Card className="p-4">
        <SearchInput value={pbData.search} onChange={(val) => { pbData.setSearch(val); pbData.setPagination(prev => ({ ...prev, page: 0 })); }} placeholder="Search playboards..." />
      </Card>

      <Card>
        <Table columns={columns} data={pbData.playboards} loading={pbData.loading} />
        {pbData.pagination.pages > 1 && <Pagination currentPage={pbData.pagination.page} totalPages={pbData.pagination.pages} total={pbData.pagination.total} limit={pbData.pagination.limit} onPageChange={pbData.handlePageChange} />}
      </Card>

      {/* Create/Edit Modal */}
      <Modal isOpen={modalOpen} onClose={() => { setModalOpen(false); resetForm(); }} title={editingItem ? 'Edit Playboard' : 'Create Playboard'} size="xl">
        <form onSubmit={editingItem ? handleUpdate : handleCreate}>
          <div className="border-b border-edge mb-4">
            <nav className="flex space-x-4 overflow-x-auto">
              {TABS.map((tab) => (
                <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`py-2 px-3 text-sm font-medium border-b-2 whitespace-nowrap ${activeTab === tab.id ? 'border-primary-500 text-primary-600' : 'border-transparent text-content-muted hover:text-content-secondary'}`}>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {activeTab === 'basic' && <BasicInfoTab formData={formData} setFormData={setFormData} scenarios={pbData.scenarios} domains={pbData.domains} addonInput={addonInput} setAddonInput={setAddonInput} addAddon={addAddon} removeAddon={removeAddon} />}

          {activeTab === 'filters' && (
            <div className="space-y-4">
              {formData.widgets.filters.length > 0 && (
                <div className="bg-surface-secondary rounded-lg p-4 mb-4">
                  <h4 className="font-medium text-content mb-2">Configured Filters ({formData.widgets.filters.length})</h4>
                  <div className="space-y-2">
                    {formData.widgets.filters.map((filter, idx) => (
                      <FilterCard key={idx} filter={filter} idx={idx} editingFilterIndex={filterBuilder.editingFilterIndex} filtersLength={formData.widgets.filters.length} onEdit={filterBuilder.editFilter} onMoveFilter={filterBuilder.moveFilter} onRemoveFilter={filterBuilder.removeFilter} />
                    ))}
                  </div>
                </div>
              )}
              <div className={`border rounded-lg p-4 ${filterBuilder.editingFilterIndex !== null ? 'border-blue-500 bg-blue-50' : ''}`}>
                <h4 className="font-medium text-content mb-3">{filterBuilder.editingFilterIndex !== null ? `Edit Filter: ${filterBuilder.currentFilter.displayName || filterBuilder.currentFilter.name}` : 'Add New Filter'}</h4>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="Name (key) *" value={filterBuilder.currentFilter.name} onChange={(e) => filterBuilder.setCurrentFilter({ ...filterBuilder.currentFilter, name: e.target.value, dataKey: e.target.value })} placeholder="query_text" />
                    <Input label="Display Name *" value={filterBuilder.currentFilter.displayName} onChange={(e) => filterBuilder.setCurrentFilter({ ...filterBuilder.currentFilter, displayName: e.target.value })} placeholder="Customer#" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="Data Key" value={filterBuilder.currentFilter.dataKey} onChange={(e) => filterBuilder.setCurrentFilter({ ...filterBuilder.currentFilter, dataKey: e.target.value })} placeholder="query_text" />
                    <Select label="Type" value={filterBuilder.currentFilter.type} onChange={(e) => filterBuilder.setCurrentFilter({ ...filterBuilder.currentFilter, type: e.target.value })} options={FILTER_TYPE_OPTIONS} />
                  </div>
                </div>
                <div className="mt-4">
                  <CollapsibleSection title="Appearance" badge={(filterBuilder.currentFilter.inputHint || filterBuilder.currentFilter.title || filterBuilder.currentFilter.styleClasses) ? <Badge variant="primary" className="text-xs">configured</Badge> : null}>
                    <div className="space-y-4 mt-3">
                      <div className="grid grid-cols-2 gap-4">
                        <Input label="Input Hint" value={filterBuilder.currentFilter.inputHint} onChange={(e) => filterBuilder.setCurrentFilter({ ...filterBuilder.currentFilter, inputHint: e.target.value })} placeholder="Enter Customer# or name" />
                        <Input label="Title" value={filterBuilder.currentFilter.title} onChange={(e) => filterBuilder.setCurrentFilter({ ...filterBuilder.currentFilter, title: e.target.value })} placeholder="Enter Customer#'s or name" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <Input label="Default Value" value={filterBuilder.currentFilter.defaultValue} onChange={(e) => filterBuilder.setCurrentFilter({ ...filterBuilder.currentFilter, defaultValue: e.target.value })} />
                        <Input label="Regex Pattern" value={filterBuilder.currentFilter.regex} onChange={(e) => filterBuilder.setCurrentFilter({ ...filterBuilder.currentFilter, regex: e.target.value })} placeholder="[A-Za-z0-9]" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <Input label="Style Classes" value={filterBuilder.currentFilter.styleClasses} onChange={(e) => filterBuilder.setCurrentFilter({ ...filterBuilder.currentFilter, styleClasses: e.target.value })} placeholder="col-md-4 custom-filter" />
                        <div className="flex items-end pb-2"><Toggle enabled={filterBuilder.currentFilter.visible} onChange={(val) => filterBuilder.setCurrentFilter({ ...filterBuilder.currentFilter, visible: val })} label="Visible" /></div>
                      </div>
                    </div>
                  </CollapsibleSection>
                </div>
                <FilterOptionsSection currentFilter={filterBuilder.currentFilter} optionInput={filterBuilder.optionInput} setOptionInput={filterBuilder.setOptionInput} addOption={filterBuilder.addOption} removeOption={filterBuilder.removeOption} toggleOptionInput={filterBuilder.toggleOptionInput} setToggleOptionInput={filterBuilder.setToggleOptionInput} addToggleOption={filterBuilder.addToggleOption} />
                <FilterValidationSection currentFilter={filterBuilder.currentFilter} validatorInput={filterBuilder.validatorInput} setValidatorInput={filterBuilder.setValidatorInput} addValidator={filterBuilder.addValidator} removeValidator={filterBuilder.removeValidator} />
                <FilterAttributesSection currentFilter={filterBuilder.currentFilter} filterAttributeInput={filterBuilder.filterAttributeInput} setFilterAttributeInput={filterBuilder.setFilterAttributeInput} addFilterAttribute={filterBuilder.addFilterAttribute} removeFilterAttribute={filterBuilder.removeFilterAttribute} />
                <div className="flex space-x-2 mt-4">
                  <Button type="button" onClick={filterBuilder.addFilter} variant={filterBuilder.editingFilterIndex !== null ? 'primary' : 'secondary'} disabled={!filterBuilder.currentFilter.name || !filterBuilder.currentFilter.displayName}>{filterBuilder.editingFilterIndex !== null ? 'Update Filter' : 'Add Filter'}</Button>
                  {filterBuilder.editingFilterIndex !== null && <Button type="button" onClick={filterBuilder.resetCurrentFilter} variant="secondary">Cancel Edit</Button>}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'grid' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-content mb-3">Row Actions</h3>
                {(formData.widgets?.grid?.actions?.rowActions?.events?.length || 0) > 0 && (
                  <div className="bg-surface-secondary rounded-lg p-4 mb-4">
                    <h4 className="font-medium text-content mb-2">Configured Row Actions ({formData.widgets?.grid?.actions?.rowActions?.events?.length || 0})</h4>
                    <div className="space-y-2">
                      {(formData.widgets?.grid?.actions?.rowActions?.events || []).map((action, idx) => (
                        <RowActionCard key={idx} action={action} idx={idx} editingRowActionIndex={rowActionBuilder.editingRowActionIndex} eventsLength={(formData.widgets?.grid?.actions?.rowActions?.events || []).length} onEdit={rowActionBuilder.editRowAction} onMoveRowAction={rowActionBuilder.moveRowAction} onRemoveRowAction={rowActionBuilder.removeRowAction} />
                      ))}
                    </div>
                  </div>
                )}
                <div className={`border rounded-lg p-4 ${rowActionBuilder.editingRowActionIndex !== null ? 'border-blue-500 bg-blue-50' : ''}`}>
                  <h4 className="font-medium text-content mb-3">{rowActionBuilder.editingRowActionIndex !== null ? `Edit Row Action: ${rowActionBuilder.currentRowAction.name}` : 'Add New Row Action'}</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="Key" value={rowActionBuilder.currentRowAction.key} onChange={(e) => rowActionBuilder.setCurrentRowAction({ ...rowActionBuilder.currentRowAction, key: e.target.value })} placeholder="orders_scenario_6" />
                    <Input label="Button Name" value={rowActionBuilder.currentRowAction.name} onChange={(e) => rowActionBuilder.setCurrentRowAction({ ...rowActionBuilder.currentRowAction, name: e.target.value })} placeholder="Orders" />
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <Input label="Path" value={rowActionBuilder.currentRowAction.path} onChange={(e) => rowActionBuilder.setCurrentRowAction({ ...rowActionBuilder.currentRowAction, path: e.target.value })} placeholder="/report/orders_scenario_6" />
                    <Select label="Data Domain" value={rowActionBuilder.currentRowAction.dataDomain} onChange={(e) => rowActionBuilder.setCurrentRowAction({ ...rowActionBuilder.currentRowAction, dataDomain: e.target.value })} options={[{ value: '', label: 'Select Domain' }, ...pbData.domains.map(d => ({ value: d.key, label: d.name }))]} />
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <Select label="Status" value={rowActionBuilder.currentRowAction.status} onChange={(e) => rowActionBuilder.setCurrentRowAction({ ...rowActionBuilder.currentRowAction, status: e.target.value })} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} />
                  </div>
                  <div className="mt-4 border-t pt-4">
                    <label className="block text-sm font-medium text-content-secondary mb-2">Filters (maps row data to navigation params)</label>
                    <div className="flex space-x-2 mb-2">
                      <Input placeholder="inputKey (e.g., query_customer)" value={rowActionBuilder.actionFilterInput.inputKey} onChange={(e) => rowActionBuilder.setActionFilterInput({ ...rowActionBuilder.actionFilterInput, inputKey: e.target.value })} />
                      <Input placeholder="dataKey (e.g., customer)" value={rowActionBuilder.actionFilterInput.dataKey} onChange={(e) => rowActionBuilder.setActionFilterInput({ ...rowActionBuilder.actionFilterInput, dataKey: e.target.value })} />
                      <Button type="button" onClick={rowActionBuilder.addActionFilter} variant="secondary">Add</Button>
                    </div>
                    {rowActionBuilder.currentRowAction.filters.length > 0 && (
                      <div className="bg-surface-secondary rounded p-2 space-y-1">
                        {rowActionBuilder.currentRowAction.filters.map((filter, idx) => (
                          <div key={idx} className="flex items-center justify-between bg-surface p-2 rounded border text-sm">
                            <span><span className="text-content-muted">inputKey:</span> <span className="font-medium">{filter.inputKey}</span><span className="mx-2">-&gt;</span><span className="text-content-muted">dataKey:</span> <span className="font-medium">{filter.dataKey}</span></span>
                            <button type="button" onClick={() => rowActionBuilder.removeActionFilter(idx)} className="text-red-500 hover:text-red-700">x</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex space-x-2 mt-4">
                    <Button type="button" onClick={rowActionBuilder.addRowAction} variant={rowActionBuilder.editingRowActionIndex !== null ? 'primary' : 'secondary'} disabled={!rowActionBuilder.currentRowAction.key || !rowActionBuilder.currentRowAction.name}>{rowActionBuilder.editingRowActionIndex !== null ? 'Update Row Action' : 'Add Row Action'}</Button>
                    {rowActionBuilder.editingRowActionIndex !== null && <Button type="button" onClick={rowActionBuilder.resetCurrentRowAction} variant="secondary">Cancel Edit</Button>}
                  </div>
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="text-lg font-medium text-content mb-3">Grid Settings</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Select label="Row Actions Render As" value={formData.widgets?.grid?.actions?.rowActions?.renderAs || 'button'}
                      onChange={(e) => {
                        const ra = formData.widgets?.grid?.actions?.rowActions || { renderAs: 'button', attributes: [], events: [] };
                        const act = formData.widgets?.grid?.actions || { rowActions: ra, headerActions: {} };
                        const g = formData.widgets?.grid || { actions: act, layout: { colums: [], headers: [], footer: [], ispaginated: true, defaultSize: 25 } };
                        setFormData({ ...formData, widgets: { ...formData.widgets, grid: { ...g, actions: { ...act, rowActions: { ...ra, renderAs: e.target.value } } } } });
                      }}
                      options={[{ value: 'button', label: 'Buttons' }, { value: 'dropdown', label: 'Dropdown Menu' }, { value: 'icons', label: 'Icon Buttons' }]}
                    />
                    <Input label="Default Page Size" type="number" value={formData.widgets?.grid?.layout?.defaultSize || 25}
                      onChange={(e) => {
                        const l = formData.widgets?.grid?.layout || { colums: [], headers: [], footer: [], ispaginated: true, defaultSize: 25 };
                        const g = formData.widgets?.grid || { actions: { rowActions: { renderAs: 'button', attributes: [], events: [] }, headerActions: {} }, layout: l };
                        setFormData({ ...formData, widgets: { ...formData.widgets, grid: { ...g, layout: { ...l, defaultSize: parseInt(e.target.value) || 25 } } } });
                      }}
                    />
                  </div>
                  <Toggle enabled={formData.widgets?.grid?.layout?.ispaginated === true}
                    onChange={(val) => {
                      const l = formData.widgets?.grid?.layout || { colums: [], headers: [], footer: [], ispaginated: true, defaultSize: 25 };
                      const g = formData.widgets?.grid || { actions: { rowActions: { renderAs: 'button', attributes: [], events: [] }, headerActions: {} }, layout: l };
                      setFormData({ ...formData, widgets: { ...formData.widgets, grid: { ...g, layout: { ...l, ispaginated: val } } } });
                    }}
                    label="Enable Pagination"
                  />
                  <GridColumnsSection formData={formData} columnInput={columnInput} setColumnInput={setColumnInput} addColumn={addColumn} removeColumn={removeColumn} moveColumn={moveColumn} />
                  <PaginationWidgetSection formData={formData} setFormData={setFormData} />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'description' && <DescriptionTab formData={formData} currentDescription={currentDescription} setCurrentDescription={setCurrentDescription} addDescription={addDescription} removeDescription={removeDescription} />}
          {activeTab === 'json' && <JsonPreviewTab formData={formData} copyJsonToClipboard={copyJsonToClipboard} />}

          <div className="flex justify-end space-x-3 pt-6 border-t mt-6">
            <Button type="button" variant="secondary" onClick={() => { setModalOpen(false); resetForm(); }}>Cancel</Button>
            <Button type="submit">{editingItem ? 'Update Playboard' : 'Create Playboard'}</Button>
          </div>
        </form>
      </Modal>

      <UploadModal isOpen={uploadModalOpen} onClose={() => { setUploadModalOpen(false); resetUploadForm(); }} scenarios={scenarios} uploadFile={uploadFile} uploadScenarioKey={uploadScenarioKey} setUploadScenarioKey={setUploadScenarioKey} uploadName={uploadName} setUploadName={setUploadName} uploadDescription={uploadDescription} setUploadDescription={setUploadDescription} jsonPreview={jsonPreview} handleFileSelect={handleFileSelect} handleFileUpload={handleFileUpload} />
      <DetailViewModal isOpen={detailModalOpen} onClose={() => setDetailModalOpen(false)} selectedPlayboard={selectedPlayboard} />
    </div>
  );
};

export default PlayboardsManagement;
