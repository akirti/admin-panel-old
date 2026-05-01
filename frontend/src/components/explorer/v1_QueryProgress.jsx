import React from 'react';

export default function V1QueryProgress({ progress, elapsed, onCancel }) {
  const { status, message, percent, stage } = progress;
  const isQueued = status === 'queued';

  const formatElapsed = (seconds) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 my-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-700">
          {isQueued ? 'Waiting in queue...' : 'Running query...'}
        </h3>
        <span className="text-xs text-gray-500">
          Elapsed: {formatElapsed(elapsed)}
        </span>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
        <div
          className={`h-2.5 rounded-full transition-all duration-500 ${
            isQueued ? 'bg-yellow-400 animate-pulse' : 'bg-blue-500'
          }`}
          style={{ width: `${Math.max(percent, isQueued ? 5 : 0)}%` }}
        />
      </div>

      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-gray-600">
          {stage && `Stage ${stage}: `}{message}
        </p>
        <span className="text-xs font-medium text-gray-500">{percent}%</span>
      </div>

      <button
        onClick={onCancel}
        className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded hover:bg-red-100 transition-colors"
      >
        Cancel
      </button>
    </div>
  );
}
