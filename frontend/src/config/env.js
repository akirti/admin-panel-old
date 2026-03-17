const env = window.__env || {};

export const ENV = env.ENV || 'local';

// Base path for the app (Apigee proxy prefix, e.g. "/mine/tine/security").
// When set, all API calls go through this prefix so they route via Apigee.
// Defaults to empty string (no prefix — direct backend access).
export const APP_BASE_PATH = env.APP_BASE_PATH || '';

// API_BASE_URL: if explicitly set in env-config.js, use it as-is.
// Otherwise, construct from APP_BASE_PATH + /api/v1 so requests route
// through the Apigee proxy rather than hitting the backend directly.
export const API_BASE_URL = env.API_BASE_URL || `${APP_BASE_PATH}/api/v1`;
export const PREVAIL_API_BASE_URL = env.PREVAIL_API_BASE_URL || API_BASE_URL;
