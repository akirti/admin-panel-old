# File Naming Guide

Quick reference for naming conventions in this React project.

## File Extension Rules

### Use `.jsx` for:
- ✅ React components (files that return JSX)
- ✅ Pages/views
- ✅ Layout components
- ✅ Context providers that render components
- ✅ HOCs (Higher-Order Components) that return JSX

**Examples:**
```
src/
├── App.jsx
├── pages/
│   ├── Dashboard.jsx
│   └── Users.jsx
├── components/
│   ├── Button.jsx
│   └── Modal.jsx
└── contexts/
    └── AuthContext.jsx
```

### Use `.js` for:
- ✅ Entry points (index.js)
- ✅ Services/API clients
- ✅ Utility functions
- ✅ Configuration files
- ✅ Constants
- ✅ Hooks (custom hooks without JSX)
- ✅ Barrel exports (re-export files)

**Examples:**
```
src/
├── index.js                 (entry point)
├── services/
│   └── api.js              (API client)
├── utils/
│   └── formatters.js       (utility functions)
├── constants/
│   └── routes.js           (constants)
└── components/shared/
    └── index.js            (barrel export)
```

## Quick Decision Tree

```
Does the file contain JSX syntax?
├─ Yes → Use .jsx
└─ No → Is it a React component?
    ├─ Yes, but no JSX yet → Use .jsx (future-proof)
    └─ No, it's a utility → Use .js
```

## Examples

### ✅ Correct Naming

```javascript
// Button.jsx - React component
import React from 'react';
export const Button = ({ children }) => <button>{children}</button>;

// api.js - Service
export const fetchUsers = () => axios.get('/users');

// useDebounce.js - Custom hook (no JSX)
export const useDebounce = (value, delay) => { /* ... */ };

// Modal.jsx - Component with JSX
export const Modal = ({ children }) => <div>{children}</div>;
```

### ❌ Incorrect Naming

```javascript
// Button.js - Should be .jsx (contains JSX)
export const Button = ({ children }) => <button>{children}</button>;

// api.jsx - Should be .js (no JSX)
export const fetchUsers = () => axios.get('/users');
```

## Migration Reference

19 files migrated to `.jsx`:
- All page components (14 files)
- All UI components (3 files)
- App.jsx (1 file)
- AuthContext.jsx (1 file)

3 files kept as `.js`:
- index.js (entry point)
- api.js (service)
- components/shared/index.js (barrel export)

## Need Help?

See [JSX_MIGRATION_SUMMARY.md](../JSX_MIGRATION_SUMMARY.md) for complete documentation.
