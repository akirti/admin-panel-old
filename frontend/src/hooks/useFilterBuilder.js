import { useState } from 'react';
import { INITIAL_FILTER } from './usePlayboardModal';

function buildNewFilter(currentFilter, existingFiltersCount) {
  const newFilter = {
    name: currentFilter.name,
    dataKey: currentFilter.dataKey || currentFilter.name,
    displayName: currentFilter.displayName,
    index: existingFiltersCount,
    visible: currentFilter.visible,
    status: currentFilter.status,
    inputHint: currentFilter.inputHint,
    title: currentFilter.title,
    attributes: [
      { key: 'type', value: currentFilter.type },
      { key: 'defaultValue', value: currentFilter.defaultValue },
      { key: 'regex', value: currentFilter.regex }
    ],
    description: [],
    validators: []
  };

  if (currentFilter.type === 'select' && currentFilter.options.length > 0) {
    newFilter.attributes.push({ key: 'options', value: currentFilter.options });
  }

  return newFilter;
}

function addFilterToFormData(formData, newFilter) {
  return {
    ...formData,
    widgets: {
      ...formData.widgets,
      filters: [...formData.widgets.filters, newFilter]
    }
  };
}

function removeFilterFromFormData(formData, index) {
  const newFilters = formData.widgets.filters.filter((_, i) => i !== index);
  return {
    ...formData,
    widgets: {
      ...formData.widgets,
      filters: newFilters.map((f, i) => ({ ...f, index: i }))
    }
  };
}

const useFilterBuilder = (formData, setFormData) => {
  const [currentFilter, setCurrentFilter] = useState({ ...INITIAL_FILTER });
  const [optionInput, setOptionInput] = useState({ value: '', name: '' });

  const addFilter = () => {
    const newFilter = buildNewFilter(currentFilter, formData.widgets.filters.length);
    setFormData(addFilterToFormData(formData, newFilter));
    setCurrentFilter({ ...INITIAL_FILTER });
  };

  const removeFilter = (index) => {
    setFormData(removeFilterFromFormData(formData, index));
  };

  const addOption = () => {
    if (optionInput.value && optionInput.name) {
      setCurrentFilter({
        ...currentFilter,
        options: [...currentFilter.options, { value: optionInput.value, name: optionInput.name }]
      });
      setOptionInput({ value: '', name: '' });
    }
  };

  const removeOption = (index) => {
    setCurrentFilter({
      ...currentFilter,
      options: currentFilter.options.filter((_, i) => i !== index)
    });
  };

  const resetFilter = () => {
    setCurrentFilter({ ...INITIAL_FILTER });
  };

  return {
    currentFilter, setCurrentFilter,
    optionInput, setOptionInput,
    addFilter, removeFilter,
    addOption, removeOption,
    resetFilter
  };
};

export default useFilterBuilder;
