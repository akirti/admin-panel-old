import { useState } from 'react';
import toast from 'react-hot-toast';
import { scenarioRequestAPI } from '../services/api';

function extractErrorMessage(error, fallback) {
  const errorMsg = error.response?.data?.detail || error.response?.data?.error || fallback;
  return typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg);
}

function triggerFileDownload(blob, fileName) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  window.URL.revokeObjectURL(url);
}

const useRequestFiles = (requestId, loadRequest) => {
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewPage, setPreviewPage] = useState(0);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadComment, setUploadComment] = useState('');
  const [uploading, setUploading] = useState(false);

  const handlePreviewFile = async (filePath) => {
    setPreviewLoading(true);
    setPreviewPage(0);
    try {
      const response = await scenarioRequestAPI.previewFile(requestId, filePath);
      setPreviewData({ ...response.data, fileName: filePath.split('/').pop() });
    } catch {
      toast.error('Failed to load preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDownloadFile = async (filePath) => {
    try {
      const response = await scenarioRequestAPI.downloadFile(requestId, filePath);
      triggerFileDownload(new Blob([response.data]), filePath.split('/').pop());
    } catch {
      toast.error('Failed to download file');
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }
    setUploadFile(file);
  };

  const handleUploadBucketFile = async () => {
    if (!uploadFile) return;

    setUploading(true);
    try {
      await scenarioRequestAPI.uploadBucketFile(requestId, uploadFile, uploadComment);
      toast.success('Data snapshot uploaded successfully');
      setShowUploadModal(false);
      setUploadFile(null);
      setUploadComment('');
      loadRequest();
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Failed to upload file'));
    } finally {
      setUploading(false);
    }
  };

  const closeUploadModal = () => {
    setShowUploadModal(false);
    setUploadFile(null);
    setUploadComment('');
  };

  const closePreviewModal = () => {
    setPreviewData(null);
    setPreviewPage(0);
  };

  return {
    previewData,
    previewLoading,
    previewPage,
    setPreviewPage,
    showUploadModal,
    setShowUploadModal,
    uploadFile,
    uploadComment,
    setUploadComment,
    uploading,
    handlePreviewFile,
    handleDownloadFile,
    handleFileSelect,
    handleUploadBucketFile,
    closeUploadModal,
    closePreviewModal
  };
};

export default useRequestFiles;
