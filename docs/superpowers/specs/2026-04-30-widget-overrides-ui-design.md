# Widget Overrides UI — Design Spec

**Date:** 2026-04-30
**Status:** Approved

***

## Summary

Add override management to the widget editor in `UISchemaManagement.jsx`. Each widget gets a tab-based UI: a "Base" tab for the current widget fields, plus one tab per override key. Override keys come from a hardcoded predefined list. Each override tab shows the same widget fields (key, displayName, datakey, value, attributes) starting empty. On save, empty fields are stripped — only explicitly-set values persist.

## Key Decisions

| Decision             | Choice                                                                 | Reason                                                 |
| -------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------ |
| Override value shape | Full widget-like object (key, displayName, datakey, value, attributes) | Consistency — overrides can change any widget property |
| Initial state        | Start empty                                                            | User only fills what they want to override             |
| Editor layout        | Tab-based within expanded widget card                                  | Clean UX — Base + override tabs side by side           |
| Override key source  | Hardcoded constant                                                     | Simple, no backend changes needed                      |
| Save behavior        | Strip empty fields before save                                         | Only persist meaningful overrides                      |

***

## Section 1: Data Model

### Backend — `WidgetOverride` Model Change

**File:** `backend/src/easylifeauth/models/ui_template.py`

Current:

```Python
class WidgetOverride(BaseModel):
    attributes: List[WidgetAttribute] = []
    model_config = {"extra": "allow"}
```

New:

```Python
class WidgetOverride(BaseModel):
    key: Optional[str] = None
    displayName: Optional[str] = None
    datakey: Optional[str] = None
    value: Optional[str] = None
    attributes: List[WidgetAttribute] = []
    model_config = {"extra": "allow"}
```

All fields optional — only populated fields are stored.

### Backend Service — Strip Empty Fields on Save

**File:** `backend/src/easylifeauth/services/ui_template_service.py`

The `set_widget_override` method should strip empty/null fields from the override before persisting. The `create_template` and `update_template` methods should also strip empty override fields from incoming widget data.

Stripping logic:

1. Remove top-level fields where value is `None`, `""`, or (for lists) `[]`
2. Remove attributes where both `key` and `value` are empty
3. If the override has no remaining fields — remove the entire override key from the dict

***

## Section 2: Frontend Constants

**File:** `frontend/src/pages/admin/UISchemaManagement.jsx`

Add predefined override key options:

```JavaScript
const OVERRIDE_KEY_OPTIONS = [
  'mobile', 'tablet', 'compact', 'readonly', 'print', 'export', 'embedded'
];
```

***

## Section 3: Frontend UI — Tab-Based Widget Editor

### Current WidgetEditor Structure

```
[Widget collapsed header]
  └─ [Expanded body]
       ├─ Key / DisplayName / DataKey inputs
       └─ Attributes list
```

### New WidgetEditor Structure

```
[Widget collapsed header]  (unchanged — shows summary + move/delete buttons)
  └─ [Expanded body]
       ├─ Tab bar: [Base] [mobile] [compact] [+ Add Override ▾]
       ├─ Tab content:
       │    Base tab → current fields (key, displayName, datakey) + attributes
       │    Override tab → same fields but all start empty + attributes
       └─ Override tab has (x) delete button on the tab
```

### Tab Bar Behavior

* "Base" tab is always present, cannot be removed
* Override tabs appear for each key in `widget.overrides`
* "+" button shows a dropdown of `OVERRIDE_KEY_OPTIONS` minus already-used keys
* When all predefined keys are used, "+" button is disabled/hidden
* Clicking an override key in the dropdown creates an empty override and switches to that tab
* Each override tab shows a small (x) icon to delete the override (with confirmation)

### Override Tab Content

Same layout as Base tab but all fields start empty:

* `key` input (placeholder: "Override key")
* `displayName` input (placeholder: "Override display name")
* `datakey` input (placeholder: "Override data key")
* `value` input (placeholder: "Override value")
* Attributes list with "+ attr" button (starts with zero attributes)

Y/N dropdown behavior applies to override attributes too (same `YN_ATTRIBUTE_KEYS` set).

### Active Tab State

* `activeTab` state per widget: `"base"` or an override key string (e.g. `"mobile"`)
* Defaults to `"base"` when widget is expanded
* When an override is added, switches to the new tab
* When an override is deleted, switches back to `"base"`

***

## Section 4: Save / Stripping Logic

### Frontend — Before Form Submit

When `handleCreate` or `handleUpdate` fires, process each widget's overrides:

```JavaScript
function stripOverrides(widgets) {
  return widgets.map(w => {
    const cleanOverrides = {};
    for (const [overrideKey, override] of Object.entries(w.overrides || {})) {
      // Strip attributes where both key and value are empty
      const cleanAttrs = (override.attributes || []).filter(
        a => (a.key && a.key.trim()) || (a.value && a.value.trim())
      );

      // Build clean override with only non-empty fields
      const clean = {};
      if (override.key?.trim()) clean.key = override.key.trim();
      if (override.displayName?.trim()) clean.displayName = override.displayName.trim();
      if (override.datakey?.trim()) clean.datakey = override.datakey.trim();
      if (override.value?.trim()) clean.value = override.value.trim();
      if (cleanAttrs.length > 0) clean.attributes = cleanAttrs;

      // Only keep the override if it has at least one field
      if (Object.keys(clean).length > 0) {
        cleanOverrides[overrideKey] = clean;
      }
    }
    return { ...w, overrides: cleanOverrides };
  });
}
```

### Backend — Belt-and-Suspenders

The service layer also strips empty fields on save (same logic) to protect against direct API calls that skip the frontend.

***

## Section 5: State Management

### Widget State Shape (unchanged + overrides)

```JavaScript
{
  key: 'customer_name',
  displayName: 'Customer Name',
  index: 0,
  datakey: 'customer_name',
  value: '',
  attributes: [ { key: 'width', value: '120' }, ... ],
  overrides: {
    mobile: {
      displayName: 'Name',
      attributes: [ { key: 'width', value: '60' } ]
    }
  }
}
```

### Override CRUD in WidgetEditor

New helper functions:

* `addOverride(wIdx, overrideKey)` — adds empty override: `widget.overrides[overrideKey] = { attributes: [] }`
* `removeOverride(wIdx, overrideKey)` — deletes `widget.overrides[overrideKey]`
* `updateOverrideField(wIdx, overrideKey, field, value)` — updates a top-level field on the override
* `updateOverrideAttr(wIdx, overrideKey, aIdx, field, value)` — updates an attribute within an override
* `addOverrideAttr(wIdx, overrideKey)` — appends `{ key: '', value: '' }` to override's attributes
* `removeOverrideAttr(wIdx, overrideKey, aIdx)` — removes an attribute from override

***

## Section 6: Files to Modify

| File                                                       | Change                                                                                                                    |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `backend/src/easylifeauth/models/ui_template.py`           | Expand `WidgetOverride` with optional widget fields                                                                       |
| `backend/src/easylifeauth/services/ui_template_service.py` | Add stripping logic for empty override fields on save                                                                     |
| `frontend/src/pages/admin/UISchemaManagement.jsx`          | Add `OVERRIDE_KEY_OPTIONS`, refactor `WidgetEditor` to tab-based, add override CRUD helpers, add `stripOverrides` on save |

### Files NOT Changed

* `backend/src/easylifeauth/api/ui_template_routes.py` — no route changes needed
* `frontend/src/services/api.js` — existing `uiTemplatesAPI.create/update` already sends full widget data including overrides
* `frontend/src/components/admin/UITemplatePreview.jsx` — out of scope (preview doesn't need override-awareness yet)

***

## Section 7: Edge Cases

* **No overrides** — works exactly as today, `overrides: {}` sent on save
* **All override fields empty** — override key is stripped entirely on save
* **Duplicate override key** — impossible since predefined list and already-used keys are filtered out
* **Override with only attributes, no top-level fields** — valid, saved with just `{ attributes: [...] }`
* **Widget deleted while override tab is active** — widget removal already resets expanded state
* **Loading existing template with overrides** — override tabs auto-appear for each key in `widget.overrides`

