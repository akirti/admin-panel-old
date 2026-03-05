const env = window.__env || {};

export const ENV = env.ENV || 'local';
export const API_BASE_URL = env.API_BASE_URL || '/api/v1';
export const PREVAIL_API_BASE_URL = env.PREVAIL_API_BASE_URL || API_BASE_URL;
