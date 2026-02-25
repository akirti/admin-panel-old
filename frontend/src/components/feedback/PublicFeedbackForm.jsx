import React, { useState } from 'react';
import { Star, Send, CheckCircle } from 'lucide-react';
import { feedbackAPI } from '../../services/api';

function PublicFeedbackForm({ onSuccess }) {
  const [formData, setFormData] = useState({
    email: '',
    rating: 0,
    improvements: '',
    suggestions: '',
  });
  const [hoveredRating, setHoveredRating] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleRatingClick = (rating) => {
    setFormData((prev) => ({ ...prev, rating }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.email) {
      setError('Email is required');
      return;
    }

    if (!formData.rating) {
      setError('Please select a rating');
      return;
    }

    setLoading(true);
    try {
      await feedbackAPI.submitPublic(formData);
      setSuccess(true);
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to submit feedback. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="text-xl font-semibold text-neutral-800 mb-2">Thank You!</h3>
        <p className="text-neutral-600">Your feedback has been submitted successfully.</p>
        <button
          onClick={() => {
            setSuccess(false);
            setFormData({ email: '', rating: 0, improvements: '', suggestions: '' });
          }}
          className="mt-4 text-red-600 hover:text-red-700 font-medium"
        >
          Submit another feedback
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Email */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-neutral-700 mb-1">
          Email Address <span className="text-red-500">*</span>
        </label>
        <input
          type="email"
          id="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-colors"
          placeholder="your@email.com"
          required
        />
      </div>

      {/* Rating */}
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          Rating <span className="text-red-500">*</span>
        </label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => handleRatingClick(star)}
              onMouseEnter={() => setHoveredRating(star)}
              onMouseLeave={() => setHoveredRating(0)}
              className="p-1 transition-transform hover:scale-110"
            >
              <Star
                className={`w-8 h-8 ${
                  star <= (hoveredRating || formData.rating)
                    ? 'fill-amber-400 text-amber-400'
                    : 'text-neutral-300'
                }`}
              />
            </button>
          ))}
        </div>
        {formData.rating > 0 && (
          <p className="text-sm text-neutral-500 mt-1">
            {formData.rating === 1 && 'Poor'}
            {formData.rating === 2 && 'Fair'}
            {formData.rating === 3 && 'Good'}
            {formData.rating === 4 && 'Very Good'}
            {formData.rating === 5 && 'Excellent'}
          </p>
        )}
      </div>

      {/* Improvements */}
      <div>
        <label htmlFor="improvements" className="block text-sm font-medium text-neutral-700 mb-1">
          What could we improve?
        </label>
        <textarea
          id="improvements"
          name="improvements"
          value={formData.improvements}
          onChange={handleChange}
          rows={3}
          className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-colors resize-none"
          placeholder="Share your thoughts on what we could do better..."
        />
      </div>

      {/* Suggestions */}
      <div>
        <label htmlFor="suggestions" className="block text-sm font-medium text-neutral-700 mb-1">
          Suggestions
        </label>
        <textarea
          id="suggestions"
          name="suggestions"
          value={formData.suggestions}
          onChange={handleChange}
          rows={3}
          className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-colors resize-none"
          placeholder="Any new features or ideas you'd like to see?"
        />
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-red-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? (
          <>
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Submitting...
          </>
        ) : (
          <>
            <Send size={20} />
            Submit Feedback
          </>
        )}
      </button>
    </form>
  );
}

export default PublicFeedbackForm;
