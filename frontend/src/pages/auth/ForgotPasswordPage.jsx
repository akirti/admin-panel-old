import React, { useState } from 'react';
import { Link } from 'react-router';
import { authAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';

function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await authAPI.forgotPassword(email, `${window.location.origin}/reset-password`);
      setSent(true);
      toast.success('Reset link sent to your email');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to send reset link');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="text-green-600" size={32} />
        </div>
        <h2 className="text-2xl font-bold text-neutral-900 mb-2">Check your email</h2>
        <p className="text-neutral-600 mb-6">
          We've sent a password reset link to <strong className="text-neutral-800">{email}</strong>
        </p>
        <Link to="/login" className="text-red-600 hover:text-red-700 font-medium">
          Back to login
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Link to="/login" className="flex items-center gap-2 text-neutral-500 hover:text-neutral-700 mb-6 text-sm">
        <ArrowLeft size={18} />
        Back to login
      </Link>

      <h2 className="text-2xl font-bold text-neutral-900 mb-2">Forgot password?</h2>
      <p className="text-neutral-500 mb-6">
        Enter your email and we'll send you a reset link.
      </p>
      
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="input-label">
            Email
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={20} />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field pl-10"
              placeholder="Enter your email"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full py-2.5"
        >
          {loading ? 'Sending...' : 'Send Reset Link'}
        </button>
      </form>
    </div>
  );
}

export default ForgotPasswordPage;
