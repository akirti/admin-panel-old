import React, { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Star, Search, Mail, Calendar, User, Globe, Eye, X, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { feedbackAPI } from '../../services/api';
import { Modal } from '../../components/shared';

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

  const renderStars = (rating, iconSize = 16) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={iconSize}
            className={
              star <= rating ? 'fill-amber-400 text-amber-400' : 'text-content-muted'
            }
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
          <h1 className="text-2xl font-bold text-content">Feedback Management</h1>
          <p className="text-content-muted mt-1">View and manage user feedback submissions</p>
        </div>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <MessageSquare size={20} className="text-amber-600" />
              </div>
              <div>
                <div className="text-sm text-content-muted">Total Feedback</div>
                <div className="text-2xl font-bold text-content">{stats.total_feedback}</div>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Star size={20} className="text-yellow-600" />
              </div>
              <div>
                <div className="text-sm text-content-muted">Average Rating</div>
                <div className="text-2xl font-bold text-content">{stats.avg_rating.toFixed(1)}</div>
              </div>
            </div>
            <div className="mt-2">{renderStars(Math.round(stats.avg_rating))}</div>
          </div>
          <div className="card">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Calendar size={20} className="text-green-600" />
              </div>
              <div>
                <div className="text-sm text-content-muted">This Week</div>
                <div className="text-2xl font-bold text-content">{stats.this_week_count}</div>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Star size={20} className="text-blue-600" />
              </div>
              <div>
                <div className="text-sm text-content-muted">Rating Distribution</div>
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
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-content-muted" />
            <input
              type="text"
              value={search}
              onChange={handleSearch}
              placeholder="Search by email..."
              className="w-full pl-10 pr-4 py-2 border border-edge rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
          </div>

          {/* Rating Filter */}
          <div className="relative sm:w-48">
            <Filter size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-content-muted" />
            <select
              value={ratingFilter}
              onChange={handleRatingFilter}
              className="w-full pl-10 pr-4 py-2 border border-edge rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none appearance-none bg-white"
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
              className="px-4 py-2 text-sm text-content-muted hover:text-content hover:bg-surface-hover rounded-lg transition-colors flex items-center gap-1"
            >
              <X size={16} />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-edge">
              <thead>
                <tr className="table-header">
                  <th
                    className="px-6 py-3 text-left cursor-pointer hover:bg-surface-hover"
                    onClick={() => handleSort('email')}
                  >
                    <div className="flex items-center gap-1">
                      <Mail size={16} />
                      Email
                      {sortBy === 'email' && <span>{sortOrder === 'desc' ? '↓' : '↑'}</span>}
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-left cursor-pointer hover:bg-surface-hover"
                    onClick={() => handleSort('rating')}
                  >
                    <div className="flex items-center gap-1">
                      <Star size={16} />
                      Rating
                      {sortBy === 'rating' && <span>{sortOrder === 'desc' ? '↓' : '↑'}</span>}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left">
                    Improvements
                  </th>
                  <th className="px-6 py-3 text-left">
                    Suggestions
                  </th>
                  <th className="px-6 py-3 text-left">
                    Type
                  </th>
                  <th
                    className="px-6 py-3 text-left cursor-pointer hover:bg-surface-hover"
                    onClick={() => handleSort('createdAt')}
                  >
                    <div className="flex items-center gap-1">
                      <Calendar size={16} />
                      Date
                      {sortBy === 'createdAt' && <span>{sortOrder === 'desc' ? '↓' : '↑'}</span>}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-surface divide-y divide-edge">
                {feedbackList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-content-muted">
                      No feedback found
                    </td>
                  </tr>
                ) : (
                  feedbackList.map((feedback) => (
                    <tr key={feedback._id} className="hover:bg-surface-hover">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-content">
                        {feedback.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {feedback.rating ? renderStars(feedback.rating) : (
                          <span className="text-content-muted text-sm">No rating</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-content-muted max-w-xs">
                        <div className="truncate" title={feedback.improvements}>
                          {feedback.improvements || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-content-muted max-w-xs">
                        <div className="truncate" title={feedback.suggestions}>
                          {feedback.suggestions || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {feedback.is_public ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-blue-100 text-blue-800">
                            <Globe size={12} />
                            Public
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-green-100 text-green-800">
                            <User size={12} />
                            User
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-content-muted">
                        {feedback.createdAt}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleViewFeedback(feedback)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Eye size={16} />
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
        <div className="bg-surface-secondary px-4 py-3 border-t border-edge sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-content-secondary">
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
                className="px-2 py-1 border border-edge rounded text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
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
                  className="p-1.5 border border-edge rounded text-sm disabled:opacity-50 hover:bg-surface disabled:hover:bg-transparent"
                  title="First page"
                >
                  <ChevronLeft size={16} />
                  <ChevronLeft className="w-4 h-4 -ml-3" />
                </button>
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 0}
                  className="p-1.5 border border-edge rounded text-sm disabled:opacity-50 hover:bg-surface disabled:hover:bg-transparent"
                  title="Previous page"
                >
                  <ChevronLeft size={16} />
                </button>

                <span className="px-3 py-1 text-sm text-content-secondary">
                  Page <span className="font-medium">{pagination.page + 1}</span> of{' '}
                  <span className="font-medium">{pagination.pages || 1}</span>
                </span>

                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.pages - 1}
                  className="p-1.5 border border-edge rounded text-sm disabled:opacity-50 hover:bg-surface disabled:hover:bg-transparent"
                  title="Next page"
                >
                  <ChevronRight size={16} />
                </button>
                <button
                  onClick={() => handlePageChange(pagination.pages - 1)}
                  disabled={pagination.page >= pagination.pages - 1}
                  className="p-1.5 border border-edge rounded text-sm disabled:opacity-50 hover:bg-surface disabled:hover:bg-transparent"
                  title="Last page"
                >
                  <ChevronRight size={16} />
                  <ChevronRight className="w-4 h-4 -ml-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Feedback Detail Modal */}
      <Modal isOpen={detailModalOpen && !!selectedFeedback} onClose={closeDetailModal} title="Feedback Details" size="lg">
        {selectedFeedback && (
          <div className="space-y-6">
            {/* Email and Type */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Mail size={20} className="text-content-muted" />
                <span className="text-content font-medium">{selectedFeedback.email}</span>
              </div>
              {selectedFeedback.is_public ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                  <Globe size={12} />
                  Public Submission
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full bg-green-100 text-green-800">
                  <User size={12} />
                  Authenticated User
                </span>
              )}
            </div>

            {/* Rating */}
            <div>
              <label className="block text-sm font-medium text-content-muted mb-2">Rating</label>
              {selectedFeedback.rating ? (
                <div className="flex items-center gap-2">
                  {renderStars(selectedFeedback.rating, 24)}
                  <span className="text-lg font-semibold text-content">{selectedFeedback.rating}/5</span>
                </div>
              ) : (
                <span className="text-content-muted">No rating provided</span>
              )}
            </div>

            {/* Improvements */}
            <div>
              <label className="block text-sm font-medium text-content-muted mb-2">Areas for Improvement</label>
              <div className="bg-surface-secondary rounded-lg p-4 text-content-secondary">
                {selectedFeedback.improvements || <span className="text-content-muted italic">No improvements provided</span>}
              </div>
            </div>

            {/* Suggestions */}
            <div>
              <label className="block text-sm font-medium text-content-muted mb-2">Suggestions</label>
              <div className="bg-surface-secondary rounded-lg p-4 text-content-secondary">
                {selectedFeedback.suggestions || <span className="text-content-muted italic">No suggestions provided</span>}
              </div>
            </div>

            {/* Metadata */}
            <div className="flex flex-wrap gap-6 pt-4 border-t border-edge">
              <div>
                <label className="block text-xs font-medium text-content-muted mb-1">Submitted On</label>
                <div className="flex items-center gap-1 text-sm text-content-muted">
                  <Calendar size={16} />
                  {selectedFeedback.createdAt}
                </div>
              </div>
              {selectedFeedback.user_id && (
                <div>
                  <label className="block text-xs font-medium text-content-muted mb-1">User ID</label>
                  <span className="text-sm text-content-muted font-mono">{selectedFeedback.user_id}</span>
                </div>
              )}
              {selectedFeedback._id && (
                <div>
                  <label className="block text-xs font-medium text-content-muted mb-1">Feedback ID</label>
                  <span className="text-sm text-content-muted font-mono">{selectedFeedback._id}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end pt-4 border-t border-edge">
              <button
                onClick={closeDetailModal}
                className="px-4 py-2 bg-surface-hover hover:bg-base-secondary text-content-secondary rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default FeedbackManagement;
