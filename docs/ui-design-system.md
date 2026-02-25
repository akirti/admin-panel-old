# EasyLife Admin Panel — UI Design System

This document defines the visual standards for the EasyLife Admin Panel frontend. All components and pages must follow these conventions to ensure a consistent user experience.

---

## 1. Color Palette

### Brand Colors
| Token | Value | Usage |
|-------|-------|-------|
| `red-600` | `#dc2626` | Primary brand, buttons, active states |
| `red-700` | `#b91c1c` | Primary hover states |
| `red-500` | `#ef4444` | Focus rings |
| `red-50` | `#fef2f2` | Primary light backgrounds (active nav, icon bg) |
| `red-100` | `#fee2e2` | Primary badges |

### Neutral Colors (use `neutral-*`, never `gray-*`)
| Token | Value | Usage |
|-------|-------|-------|
| `neutral-50` | `#fafafa` | Table header bg, subtle backgrounds |
| `neutral-100` | `#f5f5f5` | Hover states, disabled toggle bg, badge bg |
| `neutral-200` | `#e5e5e5` | Borders, dividers |
| `neutral-300` | `#d4d4d4` | Input borders, dashed borders |
| `neutral-400` | `#a3a3a3` | Placeholder text, muted icons |
| `neutral-500` | `#737373` | Secondary text, labels |
| `neutral-600` | `#525252` | Body text, table header text |
| `neutral-700` | `#404040` | Input labels, pagination text |
| `neutral-800` | `#262626` | Section titles |
| `neutral-900` | `#171717` | Page titles, headings, table cell text |

### Semantic Colors
| Context | Background | Text |
|---------|-----------|------|
| Success | `green-100` | `green-800` |
| Warning | `amber-100` | `amber-800` |
| Danger | `red-100` | `red-800` |
| Info | `blue-100` | `blue-800` |

> **Rule**: Never use Tailwind's default `gray-*` classes. Always use `neutral-*` which maps to our custom palette in `tailwind.config.js`.

---

## 2. Typography

### Scale
| Element | Classes | Example |
|---------|---------|---------|
| Page title | `text-2xl font-bold text-neutral-900` | Dashboard heading |
| Section title | `text-lg font-semibold text-neutral-800` | Card headers |
| Body text | `text-sm text-neutral-600` | Descriptions |
| Muted text | `text-sm text-neutral-500` | Timestamps, help text |
| Small text | `text-xs text-neutral-400` | Footnotes |
| Table cell | `text-sm text-neutral-900` | Data values |
| Input label | `text-sm font-medium text-neutral-700` | Form labels |

### CSS Utility Classes (defined in `index.css`)
- `.page-title` — Page-level heading
- `.section-title` — Section-level heading
- `.text-muted` — Muted helper text
- `.input-label` — Form field label

### Font Stack
```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
  'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
```

---

## 3. Icons

### Library
All icons use [lucide-react](https://lucide.dev/). Never use inline SVG icons.

### Size Standards
| Context | Size Prop | Pixel Size |
|---------|-----------|------------|
| Empty state hero | `size={48}` | 48px |
| Loading spinner | `size={32}` | 32px |
| Stat card icon | `size={24}` | 24px |
| Page header / section icon | `size={20}` | 20px |
| Button inline icon | `size={18}` | 18px |
| Table action icon | `size={16}` | 16px |
| Small inline / tag icon | `size={14}` | 14px |
| Tiny indicator | `size={12}` | 12px |

### Usage Rules
- Always use the `size={N}` prop, never `className="w-N h-N"`
- Import icons individually: `import { Search, X, Plus } from 'lucide-react';`
- Icon color inherits from parent `text-*` class via `currentColor`

---

## 4. Components

### 4.1 Button (`<Button>`)
Import: `import { Button } from '../../components/shared';`

| Variant | Usage |
|---------|-------|
| `primary` | Main actions (Save, Create, Submit) |
| `secondary` | Secondary actions (Cancel, Back, pagination) |
| `danger` | Destructive actions (Delete, Remove) |
| `success` | Positive confirmations |
| `ghost` | Tertiary/subtle actions |

| Size | Usage |
|------|-------|
| `sm` | Table actions, compact UI |
| `md` | Standard buttons (default) |
| `lg` | Hero/prominent actions |

### 4.2 Card (`.card` CSS class)
```jsx
<div className="card">              {/* Default: p-6, rounded-xl */}
<div className="card p-4">          {/* Filter/toolbar cards */}
<div className="card p-0 overflow-hidden">  {/* Table wrapper */}
<div className="card p-8">          {/* Auth forms */}
```

The `<Card>` React component wraps the `.card` class:
```jsx
import { Card } from '../../components/shared';
<Card className="p-4">...</Card>
```

| Card Type | Padding |
|-----------|---------|
| Content card | `p-6` (default) |
| Stat card | `p-5` (use `.stat-card` class) |
| Filter/toolbar | `p-4` |
| Table wrapper | `p-0 overflow-hidden` |
| Auth form | `p-8` |

### 4.3 Badge (`<Badge>`)
Import: `import { Badge } from '../../components/shared';`

```jsx
<Badge variant="success">Active</Badge>
<Badge variant="danger">Error</Badge>
<Badge variant="warning">Pending</Badge>
<Badge variant="info">In Progress</Badge>
<Badge variant="default">Draft</Badge>
<Badge variant="primary">Admin</Badge>
```

| Variant | Background | Text |
|---------|-----------|------|
| `default` | `neutral-100` | `neutral-800` |
| `success` | `green-100` | `green-800` |
| `warning` | `amber-100` | `amber-800` |
| `danger` | `red-100` | `red-800` |
| `primary` | `red-100` | `red-800` |
| `info` | `blue-100` | `blue-800` |

> **Rule**: Never use inline badge `<span>` styling or `.badge` CSS classes. Always use the `<Badge>` component.

### 4.4 Modal (`<Modal>`)
Import: `import { Modal } from '../../components/shared';`

```jsx
<Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Edit Item" size="lg">
  {/* Modal body content */}
</Modal>
```

| Size | Max Width | Usage |
|------|-----------|-------|
| `sm` | `max-w-md` | Confirmations, simple forms |
| `md` | `max-w-lg` | Standard forms (default) |
| `lg` | `max-w-2xl` | Complex forms, detail views |
| `xl` | `max-w-4xl` | Wide forms, multi-column |
| `full` | `max-w-6xl` | Data previews, large tables |

Standard styling:
- Backdrop: `bg-black/50`
- Container: `rounded-xl`, `shadow-xl`
- Title: `text-lg font-semibold text-neutral-900`
- Close button: lucide `<X size={20} />`

> **Rule**: Never create inline modal markup. Always use the `<Modal>` component.

### 4.5 Table
Import: `import { Table } from '../../components/shared';`

For the shared `Table` component, pass `columns` and `data` props.

For custom tables, use the `.table-header` CSS class:
```jsx
<thead>
  <tr className="table-header">
    <th className="px-6 py-3 text-left">Name</th>
    <th className="px-6 py-3 text-left">Status</th>
  </tr>
</thead>
```

Table row styling: use `.table-row` class or `border-b border-neutral-100 hover:bg-neutral-50`.

### 4.6 Input / Select
Import: `import { Input, Select } from '../../components/shared';`

Or use CSS classes:
- `.input` / `.input-field` — Standard input
- `.input-sm` — Compact input
- `.input-label` — Field label
- `.textarea` — Multi-line input

### 4.7 Toggle (`<Toggle>`)
Import: `import { Toggle } from '../../components/shared';`

Active: `bg-red-600`, Inactive: `bg-neutral-200`

### 4.8 Pagination (`<Pagination>`)
Import: `import { Pagination } from '../../components/shared';`

Props: `currentPage`, `totalPages`, `total`, `limit`, `onPageChange`

---

## 5. Layout

### Page Structure
```
┌─────────────────────────────────────────────┐
│ Header (h-16, bg-white, border-b)           │
├──────┬──────────────────────────────────────┤
│ Side │ Content Area (p-6, bg-neutral-50)    │
│ bar  │                                      │
│ w-64 │  ┌─ Page Title ──────────────────┐   │
│ or   │  │ text-2xl font-bold            │   │
│ w-20 │  └───────────────────────────────┘   │
│      │                                      │
│      │  ┌─ Cards / Tables ──────────────┐   │
│      │  │ .card class                   │   │
│      │  └───────────────────────────────┘   │
└──────┴──────────────────────────────────────┘
```

### Sidebar
- Expanded: `w-64`, Collapsed: `w-20`
- Nav links: `.sidebar-link` class
- Active state: `.sidebar-link.active` (red-50 bg, red-600 text)
- Icons: lucide-react `size={20}`

### Spacing
| Context | Value |
|---------|-------|
| Content area padding | `p-6` |
| Card internal padding | `p-6` (default) |
| Gap between cards | `gap-6` or `space-y-6` |
| Section gap | `mb-6` |

---

## 6. CSS Utility Classes Reference

All defined in `frontend/src/index.css` under `@layer components`:

| Class | Purpose |
|-------|---------|
| `.btn` | Base button styles |
| `.btn-primary` | Red primary button |
| `.btn-secondary` | Neutral secondary button |
| `.btn-outline` | Red outline button |
| `.btn-danger` | Dark red danger button |
| `.btn-ghost` | Ghost/text button |
| `.input` / `.input-field` | Standard input field |
| `.input-sm` | Compact input |
| `.input-label` | Form label |
| `.textarea` | Text area |
| `.form-group` | Form field wrapper |
| `.card` | Card container |
| `.card-header` | Card header section |
| `.card-body` | Card body section |
| `.sidebar-link` | Sidebar navigation link |
| `.badge` | Badge (prefer `<Badge>` component) |
| `.table-header` | Table header row |
| `.table-row` | Table body row |
| `.page-title` | Page heading |
| `.section-title` | Section heading |
| `.text-muted` | Muted text |
| `.divider` | Horizontal divider |
| `.avatar` | User avatar circle |
| `.stat-card` | Stat card container |
| `.stat-value` | Stat large number |
| `.stat-label` | Stat description |
| `.stat-icon` | Stat icon container |

---

## 7. File Organization

```
frontend/src/
├── components/
│   ├── shared/
│   │   ├── index.jsx          # All shared components
│   │   └── ExportButton.jsx   # Export button component
│   ├── layout/
│   │   ├── MainLayout.jsx     # App shell (sidebar + header)
│   │   └── AuthLayout.jsx     # Auth page layout
│   └── explorer/
│       ├── v1_DataTable.jsx
│       └── v1_FilterSection.jsx
├── pages/
│   ├── admin/     # Admin management pages
│   ├── auth/      # Login, register, password reset
│   ├── user/      # User-facing pages
│   └── root/      # Public pages (feedback form)
├── index.css      # Global styles + CSS utility classes
└── App.jsx        # Route definitions
```

---

## 8. Do's and Don'ts

### Do
- Use `neutral-*` for all gray tones
- Use the `<Badge>`, `<Modal>`, `<Card>` shared components
- Use lucide-react icons with `size={N}` prop
- Use `.table-header` class for table headers
- Use `.card` class for card containers
- Follow the icon size standards table
- Keep page titles as `text-2xl font-bold text-neutral-900`

### Don't
- Use Tailwind's default `gray-*` palette
- Create inline SVG icons
- Build inline modal/badge/card markup
- Use `className="w-N h-N"` for lucide icon sizing
- Use `.badge-*` CSS classes (use `<Badge>` component)
- Mix `gray-800` and `neutral-900` for headings
- Use `rounded-2xl` for modals (use `rounded-xl`)
- Use `bg-gray-500 bg-opacity-75` for backdrops (use `bg-black/50`)
