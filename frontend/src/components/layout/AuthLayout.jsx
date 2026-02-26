import React from 'react';
import { Outlet } from 'react-router';
import ThemeSwitcher from '../shared/ThemeSwitcher';

function AuthLayout() {
  return (
    <div className="min-h-screen bg-base-secondary flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-600 to-primary-700 items-center justify-center p-12">
        <div className="max-w-md text-center">
          <div className="w-20 h-20 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-8">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">EasyLife</h1>
          <p className="text-primary-100 text-lg">
            Streamline your workflow with our powerful admin panel
          </p>
          <div className="mt-12 grid grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-white">99%</div>
              <div className="text-primary-200 text-sm">Uptime</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-white">24/7</div>
              <div className="text-primary-200 text-sm">Support</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-white">500+</div>
              <div className="text-primary-200 text-sm">Users</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Auth form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="w-16 h-16 bg-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-primary-600">EasyLife</h1>
          </div>

          <div className="bg-surface rounded-2xl shadow-sm border border-edge p-8">
            <Outlet />
          </div>

          <div className="flex items-center justify-between mt-8">
            <p className="text-content-muted text-sm">
              © 2024 EasyLife. All rights reserved.
            </p>
            <ThemeSwitcher compact />
          </div>
        </div>
      </div>
    </div>
  );
}

export default AuthLayout;
