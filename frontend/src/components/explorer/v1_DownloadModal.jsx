import React, { useState } from "react";
import { X, Download } from "lucide-react";

const V1DownloadModal = ({ isOpen, onClose, onDownload }) => {
  const [downloadType, setDownloadType] = useState("current");
  const [format, setFormat] = useState("csv");

  if (!isOpen) return null;

  const handleDownload = () => {
    onDownload({ type: downloadType, format });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-gray-900">
            Download Data
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Download Type */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Data Range
          </label>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50">
              <input
                type="radio"
                name="downloadType"
                value="current"
                checked={downloadType === "current"}
                onChange={() => setDownloadType("current")}
                className="accent-blue-600 w-4 h-4"
              />
              <span className="text-sm text-gray-700">Current Page</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50">
              <input
                type="radio"
                name="downloadType"
                value="full"
                checked={downloadType === "full"}
                onChange={() => setDownloadType("full")}
                className="accent-blue-600 w-4 h-4"
              />
              <span className="text-sm text-gray-700">Full Report</span>
            </label>
          </div>
        </div>

        {/* Format Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Format
          </label>
          <div className="flex gap-3">
            <label className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 flex-1 justify-center">
              <input
                type="radio"
                name="format"
                value="csv"
                checked={format === "csv"}
                onChange={() => setFormat("csv")}
                className="accent-blue-600 w-4 h-4"
              />
              <span className="text-sm text-gray-700">CSV</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 flex-1 justify-center">
              <input
                type="radio"
                name="format"
                value="json"
                checked={format === "json"}
                onChange={() => setFormat("json")}
                className="accent-blue-600 w-4 h-4"
              />
              <span className="text-sm text-gray-700">JSON</span>
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Download size={16} />
            Download
          </button>
        </div>
      </div>
    </div>
  );
};

export default V1DownloadModal;
