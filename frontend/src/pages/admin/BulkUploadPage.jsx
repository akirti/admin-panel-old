import React, { useState, useEffect } from 'react';
import { Badge } from '../../components/shared';
import { Upload, Download, FileSpreadsheet, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { bulkAPI } from '../../services/api';

const BulkUploadPage = () => {
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
    { value: 'domains', label: 'Domains' },
    { value: 'domain_scenarios', label: 'Domain Scenarios' },
    { value: 'customers', label: 'Customers' },
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

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
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
        <h1 className="text-2xl font-bold text-neutral-900">Bulk Upload</h1>
        <p className="text-neutral-500 mt-1">Import data from CSV or Excel files</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Form */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
            <Upload className="w-5 h-5 text-red-600" />
            Upload File
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Entity Type</label>
              <select
                value={entityType}
                onChange={(e) => {
                  setEntityType(e.target.value);
                  setFile(null);
                  setResult(null);
                }}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                {entityTypes.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">File</label>
              <div className="flex items-center justify-center w-full">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-neutral-300 border-dashed rounded-lg cursor-pointer bg-neutral-50 hover:bg-neutral-100">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <FileSpreadsheet className="w-8 h-8 mb-2 text-neutral-400" />
                    <p className="mb-2 text-sm text-neutral-500">
                      <span className="font-semibold">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-neutral-500">CSV, XLS, or XLSX</p>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileChange}
                  />
                </label>
              </div>
              {file && (
                <p className="mt-2 text-sm text-neutral-600 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Selected: {file.name}
                </p>
              )}
            </div>

            {entityType === 'users' && (
              <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                <span className="text-sm text-neutral-700">Send password emails to new users</span>
                <button
                  type="button"
                  onClick={() => setSendPasswordEmails(!sendPasswordEmails)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 ${sendPasswordEmails ? 'bg-red-600' : 'bg-neutral-200'}`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${sendPasswordEmails ? 'translate-x-5' : 'translate-x-0'}`}
                  />
                </button>
              </div>
            )}

            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload size={16} />
                  Upload
                </>
              )}
            </button>
          </div>
        </div>

        {/* Download Templates */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
            <Download className="w-5 h-5 text-red-600" />
            Download Templates
          </h3>
          <p className="text-sm text-neutral-500 mb-4">
            Download a template file with the correct columns for your selected entity type.
          </p>

          <div className="flex space-x-3">
            <button
              onClick={() => handleDownloadTemplate('xlsx')}
              className="flex items-center gap-2 px-4 py-2 border border-neutral-300 rounded-md text-neutral-700 hover:bg-neutral-50"
            >
              <FileSpreadsheet size={16} />
              Excel Template
            </button>
            <button
              onClick={() => handleDownloadTemplate('csv')}
              className="flex items-center gap-2 px-4 py-2 border border-neutral-300 rounded-md text-neutral-700 hover:bg-neutral-50"
            >
              <Download size={16} />
              CSV Template
            </button>
          </div>

          {/* GCS Upload */}
          <div className="mt-6 pt-6 border-t border-neutral-200">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-md font-medium text-neutral-900">Upload from GCS</h4>
              <Badge variant={gcsStatus?.configured ? 'success' : 'warning'}>
                {gcsStatus?.configured ? 'Configured' : 'Not Configured'}
              </Badge>
            </div>

            {gcsStatus?.configured ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">GCS File Path</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="path/to/file.csv"
                    value={gcsPath}
                    onChange={(e) => setGcsPath(e.target.value)}
                  />
                </div>
                <button
                  onClick={() => toast.error('GCS upload not implemented')}
                  disabled={!gcsPath || uploading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-neutral-300 rounded-md text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                >
                  Upload from GCS
                </button>
              </div>
            ) : (
              <p className="text-sm text-neutral-500">
                GCS is not configured. Set the GCS_CREDENTIALS_JSON environment variable to enable this feature.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">Upload Results</h3>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="p-4 bg-neutral-50 rounded-lg text-center">
              <p className="text-2xl font-bold text-neutral-900">{result.total}</p>
              <p className="text-sm text-neutral-500">Total Records</p>
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
              <h4 className="text-sm font-medium text-neutral-900 mb-2">Errors</h4>
              <div className="max-h-48 overflow-y-auto bg-red-50 rounded-lg p-3">
                {result.errors.map((error, index) => (
                  <div key={index} className="text-sm text-red-600 py-1 border-b border-red-100 last:border-0 flex items-start gap-2">
                    <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>Row {error.row}: {error.error}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-neutral-900 mb-4">Instructions</h3>
        <ul className="list-disc list-inside space-y-2 text-sm text-neutral-600">
          <li>Download the template for your entity type to see the required columns.</li>
          <li>Fill in the data following the column headers exactly.</li>
          <li>For array fields (like permissions, roles), use comma-separated values.</li>
          <li>Upload the file using the form above.</li>
          <li>Check the results for any errors.</li>
        </ul>
      </div>
    </div>
  );
};

export default BulkUploadPage;
