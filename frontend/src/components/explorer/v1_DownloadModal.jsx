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
      <div className="relative bg-surface rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-content">
            Download Data
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-surface-hover text-content-muted hover:text-content-secondary"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Download Type */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-content-secondary mb-2">
            Data Range
          </label>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border border-edge hover:bg-surface-hover">
              <input
                type="radio"
                name="downloadType"
                value="current"
                checked={downloadType === "current"}
                onChange={() => setDownloadType("current")}
                className="accent-blue-600 w-4 h-4"
              />
              <span className="text-sm text-content-secondary">Current Page</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border border-edge hover:bg-surface-hover">
              <input
                type="radio"
                name="downloadType"
                value="full"
                checked={downloadType === "full"}
                onChange={() => setDownloadType("full")}
                className="accent-blue-600 w-4 h-4"
              />
              <span className="text-sm text-content-secondary">Full Report</span>
            </label>
          </div>
        </div>

        {/* Format Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-content-secondary mb-2">
            Format
          </label>
          <div className="flex gap-3">
            <label className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border border-edge hover:bg-surface-hover flex-1 justify-center">
              <input
                type="radio"
                name="format"
                value="csv"
                checked={format === "csv"}
                onChange={() => setFormat("csv")}
                className="accent-blue-600 w-4 h-4"
              />
              <span className="text-sm text-content-secondary">CSV</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border border-edge hover:bg-surface-hover flex-1 justify-center">
              <input
                type="radio"
                name="format"
                value="json"
                checked={format === "json"}
                onChange={() => setFormat("json")}
                className="accent-blue-600 w-4 h-4"
              />
              <span className="text-sm text-content-secondary">JSON</span>
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-edge-light pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-content-secondary bg-neutral-100 rounded-lg hover:bg-neutral-200"
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
