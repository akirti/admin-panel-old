import { useState } from 'react';

const useAddonManager = (formData, setFormData) => {
  const [addonInput, setAddonInput] = useState('');

  const addAddon = () => {
    if (addonInput && !formData.addon_configurations.includes(addonInput)) {
      setFormData({
        ...formData,
        addon_configurations: [...formData.addon_configurations, addonInput]
      });
      setAddonInput('');
    }
  };

  const removeAddon = (index) => {
    setFormData({
      ...formData,
      addon_configurations: formData.addon_configurations.filter((_, i) => i !== index)
    });
  };

  return { addonInput, setAddonInput, addAddon, removeAddon };
};

export default useAddonManager;
