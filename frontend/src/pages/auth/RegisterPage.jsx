import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Mail, Lock, User } from 'lucide-react';

function RegisterPage() {
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    full_name: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};
    if (!formData.username) newErrors.username = 'Username is required';
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const clearError = (field) => {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);

    try {
      const { confirmPassword: _confirmPassword, ...registerData } = formData;
      await register(registerData);
      toast.success('Account created successfully!');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-content mb-2">Create Account</h2>
      <p className="text-content-muted mb-6">Start your journey with us</p>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="input-label">
            Full Name
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" size={20} />
            <input
              type="text"
              name="full_name"
              value={formData.full_name}
              onChange={handleChange}
              className="input-field pl-10"
              placeholder="Enter your full name"
            />
          </div>
        </div>

        <div>
          <label htmlFor="reg-username" className="input-label">
            Username <span className="text-red-500" aria-hidden="true">*</span>
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" size={20} aria-hidden="true" />
            <input
              id="reg-username"
              type="text"
              name="username"
              value={formData.username}
              onChange={(e) => { handleChange(e); clearError('username'); }}
              className={`input-field pl-10 ${errors.username ? 'border-red-500' : ''}`}
              placeholder="Choose a username"
              required
              aria-invalid={errors.username ? 'true' : undefined}
              aria-describedby={errors.username ? 'reg-username-error' : undefined}
              autoComplete="username"
            />
          </div>
          {errors.username && <p id="reg-username-error" className="mt-1 text-sm text-red-600" role="alert">{errors.username}</p>}
        </div>

        <div>
          <label htmlFor="reg-email" className="input-label">
            Email <span className="text-red-500" aria-hidden="true">*</span>
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" size={20} aria-hidden="true" />
            <input
              id="reg-email"
              type="email"
              name="email"
              value={formData.email}
              onChange={(e) => { handleChange(e); clearError('email'); }}
              className={`input-field pl-10 ${errors.email ? 'border-red-500' : ''}`}
              placeholder="Enter your email"
              required
              aria-invalid={errors.email ? 'true' : undefined}
              aria-describedby={errors.email ? 'reg-email-error' : undefined}
              autoComplete="email"
            />
          </div>
          {errors.email && <p id="reg-email-error" className="mt-1 text-sm text-red-600" role="alert">{errors.email}</p>}
        </div>

        <div>
          <label htmlFor="reg-password" className="input-label">
            Password <span className="text-red-500" aria-hidden="true">*</span>
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" size={20} aria-hidden="true" />
            <input
              id="reg-password"
              type={showPassword ? 'text' : 'password'}
              name="password"
              value={formData.password}
              onChange={(e) => { handleChange(e); clearError('password'); }}
              className={`input-field pl-10 pr-10 ${errors.password ? 'border-red-500' : ''}`}
              placeholder="Create a password (min 8 characters)"
              required
              minLength={8}
              aria-invalid={errors.password ? 'true' : undefined}
              aria-describedby={errors.password ? 'reg-password-error' : 'reg-password-hint'}
              autoComplete="new-password"
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
          <p id="reg-password-hint" className="mt-1 text-xs text-content-muted">Minimum 8 characters</p>
          {errors.password && <p id="reg-password-error" className="mt-1 text-sm text-red-600" role="alert">{errors.password}</p>}
        </div>

        <div>
          <label htmlFor="reg-confirm-password" className="input-label">
            Confirm Password <span className="text-red-500" aria-hidden="true">*</span>
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" size={20} aria-hidden="true" />
            <input
              id="reg-confirm-password"
              type={showPassword ? 'text' : 'password'}
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={(e) => { handleChange(e); clearError('confirmPassword'); }}
              className={`input-field pl-10 ${errors.confirmPassword ? 'border-red-500' : ''}`}
              placeholder="Confirm your password"
              required
              aria-invalid={errors.confirmPassword ? 'true' : undefined}
              aria-describedby={errors.confirmPassword ? 'reg-confirm-error' : undefined}
              autoComplete="new-password"
            />
          </div>
          {errors.confirmPassword && <p id="reg-confirm-error" className="mt-1 text-sm text-red-600" role="alert">{errors.confirmPassword}</p>}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full py-2.5"
        >
          {loading ? 'Creating account...' : 'Create Account'}
        </button>
      </form>

      <div className="mt-6 text-center">
        <span className="text-sm text-content-muted">Already have an account?</span>{' '}
        <Link to="/login" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
          Sign in
        </Link>
      </div>
    </div>
  );
}

export default RegisterPage;
