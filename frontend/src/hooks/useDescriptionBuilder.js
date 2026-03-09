import { useState } from 'react';
import { INITIAL_DESCRIPTION } from './usePlayboardModal';

const useDescriptionBuilder = (formData, setFormData) => {
  const [currentDescription, setCurrentDescription] = useState({ ...INITIAL_DESCRIPTION });

  const addDescription = () => {
    const newDesc = {
      index: formData.scenarioDescription.length,
      type: currentDescription.type,
      text: currentDescription.text,
      nodes: currentDescription.nodes
    };

    setFormData({
      ...formData,
      scenarioDescription: [...formData.scenarioDescription, newDesc]
    });

    setCurrentDescription({ ...INITIAL_DESCRIPTION });
  };

  const removeDescription = (index) => {
    const newDescs = formData.scenarioDescription.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      scenarioDescription: newDescs.map((d, i) => ({ ...d, index: i }))
    });
  };

  const resetDescription = () => {
    setCurrentDescription({ ...INITIAL_DESCRIPTION });
  };

  return {
    currentDescription, setCurrentDescription,
    addDescription, removeDescription,
    resetDescription
  };
};

export default useDescriptionBuilder;
