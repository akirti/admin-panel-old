import React, { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";

const V1Pagination = ({
  page = 1,
  totalPages = 1,
  pageSize = 10,
  totalRecords,
  onPageChange,
  onPageSizeChange,
  paginationOptions = [10, 25, 50, 100],
  onDownloadClick,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [dropdownOpen]);

  const handlePrev = () => {
    if (page > 1) onPageChange(page - 1);
  };

  const handleNext = () => {
    if (page < totalPages) onPageChange(page + 1);
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between mt-4 gap-3 bg-surface px-4 py-3 rounded-lg shadow-sm border border-edge">
      {/* Left: Items per page + Download */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-content-secondary">Rows per page:</span>
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            className="border border-edge rounded-md px-3 py-1.5 text-sm bg-surface hover:bg-surface-hover flex items-center gap-1 min-w-[60px] justify-between focus:outline-none focus:ring-2 focus:ring-blue-500"
            onClick={() => setDropdownOpen((o) => !o)}
          >
            {pageSize}
            <svg
              className={`w-3.5 h-3.5 text-content-muted transition-transform ${
                dropdownOpen ? "rotate-180" : ""
              }`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
          {dropdownOpen && (
            <ul className="absolute z-10 bottom-full mb-1 w-full bg-surface border border-edge rounded-md shadow-lg max-h-48 overflow-auto">
              {paginationOptions.map((size) => (
                <li
                  key={size}
                  className={`px-3 py-1.5 cursor-pointer text-sm hover:bg-blue-50 ${
                    size === pageSize
                      ? "bg-blue-100 font-semibold text-blue-700"
                      : "text-content-secondary"
                  }`}
                  onClick={() => {
                    setDropdownOpen(false);
                    if (size !== pageSize) onPageSizeChange(size);
                  }}
                >
                  {size}
                </li>
              ))}
            </ul>
          )}
        </div>
        {onDownloadClick && (
          <button
            type="button"
            onClick={() => onDownloadClick(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition"
            title="Download data"
          >
            <Download size={14} />
            Download
          </button>
        )}
      </div>

      {/* Center: Total records */}
      {totalRecords !== undefined && totalRecords >= 0 && (
        <span className="text-sm text-content-muted">
          {totalRecords.toLocaleString()} total records
        </span>
      )}

      {/* Right: Page navigation */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-content-secondary">
          Page{" "}
          <span className="font-semibold text-content">{page}</span> of{" "}
          <span className="font-semibold text-content">{totalPages}</span>
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={handlePrev}
            disabled={page <= 1}
            className="p-1.5 rounded-md border border-edge bg-surface hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition"
            aria-label="Previous page"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={page >= totalPages}
            className="p-1.5 rounded-md border border-edge bg-surface hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition"
            aria-label="Next page"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default V1Pagination;
