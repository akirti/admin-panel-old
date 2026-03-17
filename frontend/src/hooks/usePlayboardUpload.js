import { useState } from 'react';
import toast from 'react-hot-toast';
import { playboardsAPI } from '../services/api';

const usePlayboardUpload = (scenarioKey, fetchData) => {
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadName, setUploadName] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [jsonPreview, setJsonPreview] = useState(null);

  const resetUploadForm = () => {
    setUploadFile(null);
    setUploadName('');
    setUploadDescription('');
    setJsonPreview(null);
  };

  const handleFileSelect = async (file) => {
    setUploadFile(file);
    if (file?.name.endsWith('.json')) {
      try {
        const text = await file.text();
        const json = JSON.parse(text);
        setJsonPreview(json);
        if (json.key) setUploadName(json.key);
      } catch {
        toast.error('Invalid JSON file');
        setJsonPreview(null);
      }
    }
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      toast.error('Please select a file');
      return;
    }

    const formDataUpload = new FormData();
    formDataUpload.append('file', uploadFile);

    try {
      await playboardsAPI.upload(formDataUpload, {
        scenario_key: scenarioKey,
        name: uploadName || undefined,
        description: uploadDescription || undefined
      });
      toast.success('Playboard uploaded successfully');
      setUploadModalOpen(false);
      resetUploadForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Upload failed');
    }
  };

  return {
    uploadModalOpen, setUploadModalOpen,
    uploadFile, uploadName, setUploadName,
    uploadDescription, setUploadDescription,
    jsonPreview,
    handleFileSelect, handleFileUpload, resetUploadForm
  };
};

export default usePlayboardUpload;
