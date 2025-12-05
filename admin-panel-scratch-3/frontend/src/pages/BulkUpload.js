import React, { useState, useEffect } from 'react';
import { Card, Button, Select, FileUpload, Toggle, Badge } from '../components/shared';
import { bulkAPI } from '../services/api';
import toast from 'react-hot-toast';

const BulkUpload = () => {
  const [entityType, setEntityType] = useState('users');
  const [file, setFile] = useState(null);
  const [sendPasswordEmails, setSendPasswordEmails] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [gcsStatus, setGcsStatus] = useState(null);
  const [gcsPath, setGcsPath] = useState('');

  const entityTypes = [
    { value: 'users', label: 'Users' },
    { value: 'roles', label: 'Roles' },
    { value: 'groups', label: 'Groups' },
    { value: 'permissions', label: 'Permissions' },
    { value: 'customers', label: 'Customers' },
    { value: 'domains', label: 'Domains' },
    { value: 'domain_scenarios', label: 'Domain Scenarios' },
  ];

  useEffect(() => {
    checkGcsStatus();
  }, []);

  const checkGcsStatus = async () => {
    try {
      const response = await bulkAPI.getGCSStatus();
      setGcsStatus(response.data);
    } catch (error) {
      console.error('Failed to check GCS status');
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select a file');
      return;
    }

    setUploading(true);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await bulkAPI.upload(entityType, formData, sendPasswordEmails);
      setResult(response.data);
      if (response.data.successful > 0) {
        toast.success(`Successfully processed ${response.data.successful} records`);
      }
      if (response.data.failed > 0) {
        toast.error(`Failed to process ${response.data.failed} records`);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleGcsUpload = async () => {
    if (!gcsPath) {
      toast.error('Please enter a GCS file path');
      return;
    }

    setUploading(true);
    setResult(null);

    try {
      const response = await bulkAPI.uploadFromGCS(entityType, {
        file_path: gcsPath,
        entity_type: entityType,
      }, sendPasswordEmails);
      setResult(response.data);
      toast.success('GCS upload completed');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'GCS upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadTemplate = async (format) => {
    try {
      const response = await bulkAPI.getTemplate(entityType, format);
      const blob = new Blob([response.data]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${entityType}_template.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Template downloaded');
    } catch (error) {
      toast.error('Failed to download template');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Bulk Upload</h1>
        <p className="text-gray-500 mt-1">Import data from CSV or Excel files</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Form */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Upload File</h3>
          
          <div className="space-y-4">
            <Select
              label="Entity Type"
              value={entityType}
              onChange={(e) => {
                setEntityType(e.target.value);
                setFile(null);
                setResult(null);
              }}
              options={entityTypes}
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">File</label>
              <FileUpload
                accept=".csv,.xlsx,.xls"
                label="Select CSV or Excel file"
                onFileSelect={(f) => setFile(f)}
              />
              {file && (
                <p className="mt-2 text-sm text-gray-500">Selected: {file.name}</p>
              )}
            </div>

            {entityType === 'users' && (
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-700">Send password emails to new users</span>
                <Toggle
                  enabled={sendPasswordEmails}
                  onChange={setSendPasswordEmails}
                />
              </div>
            )}

            <Button
              onClick={handleUpload}
              loading={uploading}
              disabled={!file}
              className="w-full"
            >
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Upload
            </Button>
          </div>
        </Card>

        {/* Download Templates */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Download Templates</h3>
          <p className="text-sm text-gray-500 mb-4">
            Download a template file with the correct columns for your selected entity type.
          </p>
          
          <div className="flex space-x-3">
            <Button variant="secondary" onClick={() => handleDownloadTemplate('xlsx')}>
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Excel Template
            </Button>
            <Button variant="secondary" onClick={() => handleDownloadTemplate('csv')}>
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              CSV Template
            </Button>
          </div>

          {/* GCS Upload */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-md font-medium text-gray-900">Upload from GCS</h4>
              <Badge variant={gcsStatus?.configured ? 'success' : 'warning'}>
                {gcsStatus?.configured ? 'Configured' : 'Not Configured'}
              </Badge>
            </div>
            
            {gcsStatus?.configured ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">GCS File Path</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="path/to/file.csv"
                    value={gcsPath}
                    onChange={(e) => setGcsPath(e.target.value)}
                  />
                </div>
                <Button
                  variant="secondary"
                  onClick={handleGcsUpload}
                  loading={uploading}
                  disabled={!gcsPath}
                  className="w-full"
                >
                  Upload from GCS
                </Button>
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                GCS is not configured. Set the GCS_CREDENTIALS_JSON environment variable to enable this feature.
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* Results */}
      {result && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Upload Results</h3>
          
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="p-4 bg-gray-50 rounded-lg text-center">
              <p className="text-2xl font-bold text-gray-900">{result.total}</p>
              <p className="text-sm text-gray-500">Total Records</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg text-center">
              <p className="text-2xl font-bold text-green-600">{result.successful}</p>
              <p className="text-sm text-green-700">Successful</p>
            </div>
            <div className="p-4 bg-red-50 rounded-lg text-center">
              <p className="text-2xl font-bold text-red-600">{result.failed}</p>
              <p className="text-sm text-red-700">Failed</p>
            </div>
          </div>

          {result.errors && result.errors.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-2">Errors</h4>
              <div className="max-h-48 overflow-y-auto">
                {result.errors.map((error, index) => (
                  <div key={index} className="text-sm text-red-600 py-1 border-b border-gray-100 last:border-0">
                    Row {error.row}: {error.error}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Instructions */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Instructions</h3>
        <div className="prose prose-sm text-gray-600">
          <ul className="space-y-2">
            <li>Download the template for your entity type to see the required columns.</li>
            <li>Fill in the data following the column headers exactly.</li>
            <li>For array fields (like permissions, roles), use comma-separated values.</li>
            <li>Upload the file using the form above.</li>
            <li>Check the results for any errors.</li>
          </ul>
        </div>
      </Card>
    </div>
  );
};

export default BulkUpload;
