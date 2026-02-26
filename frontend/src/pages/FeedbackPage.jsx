import React from 'react';
import { Link } from 'react-router';
import { MessageSquare, ArrowLeft } from 'lucide-react';
import PublicFeedbackForm from '../components/feedback/PublicFeedbackForm';

function FeedbackPage() {
  return (
    <div className="min-h-screen bg-base-secondary flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-600 to-primary-700 items-center justify-center p-12">
        <div className="max-w-md text-center">
          <div className="w-20 h-20 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-8">
            <MessageSquare className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">We Value Your Feedback</h1>
          <p className="text-primary-100 text-lg">
            Help us improve EasyLife by sharing your thoughts, suggestions, and ideas.
          </p>
          <div className="mt-12 grid grid-cols-2 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-white">1000+</div>
              <div className="text-primary-200 text-sm">Feedback Received</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-white">4.8</div>
              <div className="text-primary-200 text-sm">Average Rating</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Feedback form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="w-16 h-16 bg-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-primary-600">Share Your Feedback</h1>
          </div>

          <div className="card p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-content">Share Your Feedback</h2>
              <p className="text-content-muted mt-1">
                Your feedback helps us improve our services.
              </p>
            </div>

            <PublicFeedbackForm />
          </div>

          <div className="text-center mt-6">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-content-muted hover:text-primary-600 transition-colors"
            >
              <ArrowLeft size={16} />
              Back to Login
            </Link>
          </div>

          <p className="text-center text-content-muted text-sm mt-8">
            © 2024 EasyLife. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}

export default FeedbackPage;
