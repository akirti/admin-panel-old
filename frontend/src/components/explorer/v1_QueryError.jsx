import React, { useState } from 'react';

export default function V1QueryError({ error, onRetry, onCancel }) {
  const [showTechnical, setShowTechnical] = useState(false);

  if (!error) return null;

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-5 my-4">
      <div className="flex items-start gap-3">
        <span className="text-red-500 text-lg mt-0.5">!</span>
        <div className="flex-1">
          <p className="text-sm font-medium text-red-800">
            {error.message || 'An error occurred'}
          </p>

          {error.suggestions?.length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-red-700 font-medium">Suggestions:</p>
              <ul className="list-disc list-inside mt-1">
                {error.suggestions.map((s, i) => (
                  <li key={i} className="text-xs text-red-600">{s}</li>
                ))}
              </ul>
            </div>
          )}

          {error.technical && (
            <div className="mt-3">
              <button
                onClick={() => setShowTechnical(!showTechnical)}
                className="text-xs text-red-600 underline hover:text-red-800"
              >
                {showTechnical ? 'Hide' : 'Show'} Technical Details
              </button>

              {showTechnical && (
                <div className="mt-2 bg-red-100 rounded p-3 font-mono text-xs text-red-800">
                  {error.code && <div>Error Code: {error.code}</div>}
                  {error.stage && <div>Stage: {error.stage}</div>}
                  {Object.entries(error.technical).map(([key, val]) => (
                    <div key={key}>{key}: {typeof val === 'object' ? JSON.stringify(val) : String(val)}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <button
              onClick={onRetry}
              className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
            <button
              onClick={onCancel}
              className="px-3 py-1.5 text-xs font-medium text-red-600 bg-white border border-red-300 rounded hover:bg-red-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
