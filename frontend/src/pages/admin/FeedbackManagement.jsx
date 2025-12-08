import React, { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Star, Search, Mail, Calendar, User, Globe, Eye, X, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { feedbackAPI } from '../../services/api';

const FeedbackManagement = () => {
  const [feedbackList, setFeedbackList] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [ratingFilter, setRatingFilter] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [pagination, setPagination] = useState({ page: 0, limit: 10, total: 0, pages: 0 });
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [listRes, statsRes] = await Promise.all([
        feedbackAPI.getAdminList({
          page: pagination.page,
          limit: pagination.limit,
          search: search || undefined,
          rating: ratingFilter ? parseInt(ratingFilter) : undefined,
          sort_by: sortBy,
          sort_order: sortOrder,
        }),
        feedbackAPI.getStats(),
      ]);

      setFeedbackList(listRes.data.data || []);
      setPagination((prev) => ({ ...prev, ...(listRes.data.pagination || {}) }));
      setStats(statsRes.data);
    } catch (error) {
      toast.error('Failed to load feedback');
    } finally {
      setLoading(false);
    }
  }, [search, ratingFilter, sortBy, sortOrder, pagination.page, pagination.limit]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePageChange = (newPage) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
  };

  const handleSearch = (e) => {
    setSearch(e.target.value);
    setPagination((prev) => ({ ...prev, page: 0 }));
  };

  const handleRatingFilter = (e) => {
    setRatingFilter(e.target.value);
    setPagination((prev) => ({ ...prev, page: 0 }));
  };

  const clearFilters = () => {
    setSearch('');
    setRatingFilter('');
    setPagination((prev) => ({ ...prev, page: 0 }));
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setPagination((prev) => ({ ...prev, page: 0 }));
  };

  const renderStars = (rating, size = 'w-4 h-4') => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${size} ${
              star <= rating ? 'fill-amber-400 text-amber-400' : 'text-neutral-300'
            }`}
          />
        ))}
      </div>
    );
  };

  const handleViewFeedback = (feedback) => {
    setSelectedFeedback(feedback);
    setDetailModalOpen(true);
  };

  const closeDetailModal = () => {
    setDetailModalOpen(false);
    setSelectedFeedback(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Feedback Management</h1>
          <p className="text-neutral-500 mt-1">View and manage user feedback submissions</p>
        </div>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <MessageSquare className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <div className="text-sm text-neutral-500">Total Feedback</div>
                <div className="text-2xl font-bold text-neutral-900">{stats.total_feedback}</div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Star className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <div className="text-sm text-neutral-500">Average Rating</div>
                <div className="text-2xl font-bold text-neutral-900">{stats.avg_rating.toFixed(1)}</div>
              </div>
            </div>
            <div className="mt-2">{renderStars(Math.round(stats.avg_rating))}</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Calendar className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <div className="text-sm text-neutral-500">This Week</div>
                <div className="text-2xl font-bold text-neutral-900">{stats.this_week_count}</div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Star className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-sm text-neutral-500">Rating Distribution</div>
                <div className="flex gap-1 mt-1">
                  {Object.entries(stats.rating_distribution).map(([rating, count]) => (
                    <div key={rating} className="text-center">
                      <div className="text-xs text-neutral-500">{rating}★</div>
                      <div className="text-sm font-medium">{count}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <input
              type="text"
              value={search}
              onChange={handleSearch}
              placeholder="Search by email..."
              className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
            />
          </div>

          {/* Rating Filter */}
          <div className="relative sm:w-48">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <select
              value={ratingFilter}
              onChange={handleRatingFilter}
              className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none appearance-none bg-white"
            >
              <option value="">All Ratings</option>
              <option value="5">5 Stars</option>
              <option value="4">4 Stars</option>
              <option value="3">3 Stars</option>
              <option value="2">2 Stars</option>
              <option value="1">1 Star</option>
            </select>
          </div>

          {/* Clear Filters */}
          {(search || ratingFilter) && (
            <button
              onClick={clearFilters}
              className="px-4 py-2 text-sm text-neutral-600 hover:text-neutral-800 hover:bg-neutral-100 rounded-lg transition-colors flex items-center gap-1"
            >
              <X className="w-4 h-4" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-200">
              <thead className="bg-neutral-50">
                <tr>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider cursor-pointer hover:bg-neutral-100"
                    onClick={() => handleSort('email')}
                  >
                    <div className="flex items-center gap-1">
                      <Mail className="w-4 h-4" />
                      Email
                      {sortBy === 'email' && <span>{sortOrder === 'desc' ? '↓' : '↑'}</span>}
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider cursor-pointer hover:bg-neutral-100"
                    onClick={() => handleSort('rating')}
                  >
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4" />
                      Rating
                      {sortBy === 'rating' && <span>{sortOrder === 'desc' ? '↓' : '↑'}</span>}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Improvements
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Suggestions
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider cursor-pointer hover:bg-neutral-100"
                    onClick={() => handleSort('createdAt')}
                  >
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      Date
                      {sortBy === 'createdAt' && <span>{sortOrder === 'desc' ? '↓' : '↑'}</span>}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-neutral-200">
                {feedbackList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-neutral-500">
                      No feedback found
                    </td>
                  </tr>
                ) : (
                  feedbackList.map((feedback) => (
                    <tr key={feedback._id} className="hover:bg-neutral-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900">
                        {feedback.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {feedback.rating ? renderStars(feedback.rating) : (
                          <span className="text-neutral-400 text-sm">No rating</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-600 max-w-xs">
                        <div className="truncate" title={feedback.improvements}>
                          {feedback.improvements || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-600 max-w-xs">
                        <div className="truncate" title={feedback.suggestions}>
                          {feedback.suggestions || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {feedback.is_public ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-blue-100 text-blue-800">
                            <Globe className="w-3 h-3" />
                            Public
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-green-100 text-green-800">
                            <User className="w-3 h-3" />
                            User
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                        {feedback.createdAt}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleViewFeedback(feedback)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination - Always show */}
        <div className="bg-neutral-50 px-4 py-3 border-t border-neutral-200 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-neutral-700">
              {pagination.total > 0 ? (
                <>
                  Showing <span className="font-medium">{pagination.page * pagination.limit + 1}</span> to{' '}
                  <span className="font-medium">{Math.min((pagination.page + 1) * pagination.limit, pagination.total)}</span> of{' '}
                  <span className="font-medium">{pagination.total}</span> results
                </>
              ) : (
                'No results'
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Page size selector */}
              <select
                value={pagination.limit}
                onChange={(e) => setPagination((prev) => ({ ...prev, limit: parseInt(e.target.value), page: 0 }))}
                className="px-2 py-1 border border-neutral-300 rounded text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
              >
                <option value={10}>10 per page</option>
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
              </select>

              {/* Page navigation */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handlePageChange(0)}
                  disabled={pagination.page === 0}
                  className="p-1.5 border border-neutral-300 rounded text-sm disabled:opacity-50 hover:bg-white disabled:hover:bg-transparent"
                  title="First page"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <ChevronLeft className="w-4 h-4 -ml-3" />
                </button>
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 0}
                  className="p-1.5 border border-neutral-300 rounded text-sm disabled:opacity-50 hover:bg-white disabled:hover:bg-transparent"
                  title="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <span className="px-3 py-1 text-sm text-neutral-700">
                  Page <span className="font-medium">{pagination.page + 1}</span> of{' '}
                  <span className="font-medium">{pagination.pages || 1}</span>
                </span>

                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.pages - 1}
                  className="p-1.5 border border-neutral-300 rounded text-sm disabled:opacity-50 hover:bg-white disabled:hover:bg-transparent"
                  title="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handlePageChange(pagination.pages - 1)}
                  disabled={pagination.page >= pagination.pages - 1}
                  className="p-1.5 border border-neutral-300 rounded text-sm disabled:opacity-50 hover:bg-white disabled:hover:bg-transparent"
                  title="Last page"
                >
                  <ChevronRight className="w-4 h-4" />
                  <ChevronRight className="w-4 h-4 -ml-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Feedback Detail Modal */}
      {detailModalOpen && selectedFeedback && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-neutral-200">
              <h2 className="text-xl font-semibold text-neutral-900">Feedback Details</h2>
              <button
                onClick={closeDetailModal}
                className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-neutral-500" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Email and Type */}
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-neutral-400" />
                  <span className="text-neutral-900 font-medium">{selectedFeedback.email}</span>
                </div>
                {selectedFeedback.is_public ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                    <Globe className="w-3 h-3" />
                    Public Submission
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full bg-green-100 text-green-800">
                    <User className="w-3 h-3" />
                    Authenticated User
                  </span>
                )}
              </div>

              {/* Rating */}
              <div>
                <label className="block text-sm font-medium text-neutral-500 mb-2">Rating</label>
                {selectedFeedback.rating ? (
                  <div className="flex items-center gap-2">
                    {renderStars(selectedFeedback.rating, 'w-6 h-6')}
                    <span className="text-lg font-semibold text-neutral-900">{selectedFeedback.rating}/5</span>
                  </div>
                ) : (
                  <span className="text-neutral-400">No rating provided</span>
                )}
              </div>

              {/* Improvements */}
              <div>
                <label className="block text-sm font-medium text-neutral-500 mb-2">Areas for Improvement</label>
                <div className="bg-neutral-50 rounded-lg p-4 text-neutral-700">
                  {selectedFeedback.improvements || <span className="text-neutral-400 italic">No improvements provided</span>}
                </div>
              </div>

              {/* Suggestions */}
              <div>
                <label className="block text-sm font-medium text-neutral-500 mb-2">Suggestions</label>
                <div className="bg-neutral-50 rounded-lg p-4 text-neutral-700">
                  {selectedFeedback.suggestions || <span className="text-neutral-400 italic">No suggestions provided</span>}
                </div>
              </div>

              {/* Metadata */}
              <div className="flex flex-wrap gap-6 pt-4 border-t border-neutral-200">
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-1">Submitted On</label>
                  <div className="flex items-center gap-1 text-sm text-neutral-600">
                    <Calendar className="w-4 h-4" />
                    {selectedFeedback.createdAt}
                  </div>
                </div>
                {selectedFeedback.user_id && (
                  <div>
                    <label className="block text-xs font-medium text-neutral-400 mb-1">User ID</label>
                    <span className="text-sm text-neutral-600 font-mono">{selectedFeedback.user_id}</span>
                  </div>
                )}
                {selectedFeedback._id && (
                  <div>
                    <label className="block text-xs font-medium text-neutral-400 mb-1">Feedback ID</label>
                    <span className="text-sm text-neutral-600 font-mono">{selectedFeedback._id}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end p-6 border-t border-neutral-200">
              <button
                onClick={closeDetailModal}
                className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeedbackManagement;
