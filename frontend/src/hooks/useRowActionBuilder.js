import { useState } from 'react';
import { INITIAL_ROW_ACTION } from './usePlayboardModal';

function addRowActionToFormData(formData, currentRowAction) {
  const newAction = {
    key: currentRowAction.key,
    name: currentRowAction.name,
    path: currentRowAction.path,
    dataDomain: currentRowAction.dataDomain,
    status: currentRowAction.status,
    order: formData.widgets.grid.actions.rowActions.events.length,
    filters: currentRowAction.filters
  };

  return {
    ...formData,
    widgets: {
      ...formData.widgets,
      grid: {
        ...formData.widgets.grid,
        actions: {
          ...formData.widgets.grid.actions,
          rowActions: {
            ...formData.widgets.grid.actions.rowActions,
            events: [...formData.widgets.grid.actions.rowActions.events, newAction]
          }
        }
      }
    }
  };
}

function removeRowActionFromFormData(formData, index) {
  const newEvents = formData.widgets.grid.actions.rowActions.events.filter((_, i) => i !== index);
  return {
    ...formData,
    widgets: {
      ...formData.widgets,
      grid: {
        ...formData.widgets.grid,
        actions: {
          ...formData.widgets.grid.actions,
          rowActions: {
            ...formData.widgets.grid.actions.rowActions,
            events: newEvents.map((e, i) => ({ ...e, order: i }))
          }
        }
      }
    }
  };
}

const useRowActionBuilder = (formData, setFormData) => {
  const [currentRowAction, setCurrentRowAction] = useState({ ...INITIAL_ROW_ACTION });
  const [actionFilterInput, setActionFilterInput] = useState({ inputKey: '', dataKey: '' });

  const addRowAction = () => {
    setFormData(addRowActionToFormData(formData, currentRowAction));
    setCurrentRowAction({ ...INITIAL_ROW_ACTION });
  };

  const removeRowAction = (index) => {
    setFormData(removeRowActionFromFormData(formData, index));
  };

  const addActionFilter = () => {
    if (actionFilterInput.inputKey && actionFilterInput.dataKey) {
      setCurrentRowAction({
        ...currentRowAction,
        filters: [...currentRowAction.filters, { inputKey: actionFilterInput.inputKey, dataKey: actionFilterInput.dataKey }]
      });
      setActionFilterInput({ inputKey: '', dataKey: '' });
    }
  };

  const removeActionFilter = (index) => {
    setCurrentRowAction({
      ...currentRowAction,
      filters: currentRowAction.filters.filter((_, i) => i !== index)
    });
  };

  const resetRowAction = () => {
    setCurrentRowAction({ ...INITIAL_ROW_ACTION });
  };

  return {
    currentRowAction, setCurrentRowAction,
    actionFilterInput, setActionFilterInput,
    addRowAction, removeRowAction,
    addActionFilter, removeActionFilter,
    resetRowAction
  };
};

export default useRowActionBuilder;
