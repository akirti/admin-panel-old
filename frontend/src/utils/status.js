/**
 * Standardized status constants and helpers.
 *
 * New canonical values: 'A' (Active) / 'I' (Inactive).
 * The helpers accept legacy values ('active', 'inactive', 'Y', 'N', true/false)
 * for backward compatibility with existing backend data.
 */

export const STATUS = { ACTIVE: 'A', INACTIVE: 'I' };

export const isActive = (status) =>
  status === 'A' || status === 'active' || status === 'Y' || status === true;

export const statusLabel = (status) => (isActive(status) ? 'Active' : 'Inactive');

export const statusVariant = (status) => (isActive(status) ? 'success' : 'danger');
