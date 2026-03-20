import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Mail, Lock, MessageSquare } from 'lucide-react';

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const { login } = useAuth();
  const navigate = useNavigate();

  const validate = () => {
    const newErrors = {};
    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);

    try {
      await login(email, password);
      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-content mb-2">Welcome Back</h2>
      <p className="text-content-muted mb-6">Sign in to your account</p>
      
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="login-email" className="input-label">
            Email <span className="text-red-500" aria-hidden="true">*</span>
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted pointer-events-none" size={20} aria-hidden="true" />
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors((prev) => ({ ...prev, email: '' })); }}
              className={`input-field pl-10 ${errors.email ? 'border-red-500' : ''}`}
              placeholder="Enter your email"
              required
              aria-invalid={errors.email ? 'true' : undefined}
              aria-describedby={errors.email ? 'login-email-error' : undefined}
              autoComplete="email"
            />
          </div>
          {errors.email && <p id="login-email-error" className="mt-1 text-sm text-red-600" role="alert">{errors.email}</p>}
        </div>

        <div>
          <label htmlFor="login-password" className="input-label">
            Password <span className="text-red-500" aria-hidden="true">*</span>
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted pointer-events-none" size={20} aria-hidden="true" />
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => { setPassword(e.target.value); if (errors.password) setErrors((prev) => ({ ...prev, password: '' })); }}
              className={`input-field pl-10 pr-10 ${errors.password ? 'border-red-500' : ''}`}
              placeholder="Enter your password"
              required
              aria-invalid={errors.password ? 'true' : undefined}
              aria-describedby={errors.password ? 'login-password-error' : undefined}
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-content-muted hover:text-content-secondary"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          {errors.password && <p id="login-password-error" className="mt-1 text-sm text-red-600" role="alert">{errors.password}</p>}
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center cursor-pointer">
            <input type="checkbox" className="rounded border-edge text-primary-600 focus:ring-primary-500" />
            <span className="ml-2 text-sm text-content-secondary">Remember me</span>
          </label>
          <Link to="/forgot-password" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full py-2.5"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <div className="mt-6 text-center">
        <span className="text-sm text-content-muted">Don't have an account?</span>{' '}
        <Link to="/register" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
          Sign up
        </Link>
      </div>

      <div className="mt-4 pt-4 border-t border-edge text-center">
        <Link
          to="/feedback"
          className="inline-flex items-center gap-2 text-sm text-content-muted hover:text-primary-600 transition-colors"
        >
          <MessageSquare size={16} />
          Share your feedback
        </Link>
      </div>
    </div>
  );
}

export default LoginPage;
