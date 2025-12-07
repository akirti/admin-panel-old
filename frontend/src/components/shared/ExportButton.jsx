import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Download, Loader2 } from 'lucide-react';

const ExportButton = ({ exportFn, format = 'csv', filters = {}, label = 'Export', className = '' }) => {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    try {
      setExporting(true);
      const response = await exportFn(filters);

      // Create blob from response
      const blob = new Blob([response.data], {
        type: format === 'csv' ? 'text/csv' : 'application/json'
      });

      // Extract filename from content-disposition header or use default
      const contentDisposition = response.headers['content-disposition'];
      let filename = `export_${Date.now()}.${format}`;

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1];
        }
      }

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(`Data exported successfully as ${format.toUpperCase()}`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error(error.response?.data?.detail || 'Failed to export data');
    } finally {
      setExporting(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={exporting}
      className={`inline-flex items-center px-3 py-2 border border-neutral-300 shadow-sm text-sm font-medium rounded-md text-neutral-700 bg-white hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed ${exporting ? 'cursor-wait' : ''} ${className}`}
    >
      {exporting ? (
        <>
          <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4 text-neutral-700" />
          Exporting...
        </>
      ) : (
        <>
          <Download className="-ml-1 mr-2 h-4 w-4" />
          {label}
        </>
      )}
    </button>
  );
};

export default ExportButton;
