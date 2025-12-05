# Pagination Implementation Summary

## Overview

Complete pagination implementation across all backend routers and frontend pages.

## Backend Changes

### Models (`app/models.py`)

Added pagination models:

```python
class PaginationMeta(BaseModel):
    total: int       # Total number of items
    page: int        # Current page (0-indexed)
    limit: int       # Items per page
    pages: int       # Total number of pages
    has_next: bool   # Whether there is a next page
    has_prev: bool   # Whether there is a previous page

class PaginatedResponse(BaseModel, Generic[T]):
    data: List[T]
    pagination: PaginationMeta
```

Helper function:
```python
def create_pagination_meta(total: int, page: int, limit: int) -> PaginationMeta:
    pages = math.ceil(total / limit) if limit > 0 else 0
    return PaginationMeta(
        total=total,
        page=page,
        limit=limit,
        pages=pages,
        has_next=page < pages - 1,
        has_prev=page > 0
    )
```

### Routers Updated (9 total)

| Router | File | Sort Order | Filters |
|--------|------|-----------|---------|
| Users | `routers/users.py` | created_at desc | search |
| Roles | `routers/roles.py` | priority asc | status, search |
| Groups | `routers/groups.py` | priority asc | status, search |
| Permissions | `routers/permissions.py` | module asc | module, search |
| Customers | `routers/customers.py` | name asc | status, search |
| Domains | `routers/domains.py` | order asc | status, search |
| Domain Scenarios | `routers/domain_scenarios.py` | order asc | status, domain_key, search |
| Playboards | `routers/playboards.py` | created_at desc | status, scenario_key, search |
| Configurations | `routers/configurations.py` | row_update_stp desc | type, search |

### API Response Format

All paginated endpoints return:
```json
{
  "data": [...],
  "pagination": {
    "total": 150,
    "page": 0,
    "limit": 25,
    "pages": 6,
    "has_next": true,
    "has_prev": false
  }
}
```

### Query Parameters

- `page`: Page number (0-indexed, default: 0)
- `limit`: Items per page (default: 25, max: 100)
- `search`: Search term (optional)
- Additional filters vary by endpoint

## Frontend Changes

### Pagination Component (`components/shared/index.js`)

Updated features:
- Accepts 0-indexed page from API
- Displays 1-indexed pages to users
- Smart page button generation (max 7 visible)
- Shows ellipsis (...) for skipped pages
- First/last page quick jump buttons
- Info display: "Showing X to Y of Z results"

Props:
```javascript
{
  currentPage,  // 0-indexed from API
  totalPages,   // Total number of pages
  total,        // Total items
  limit,        // Items per page (default 25)
  onPageChange, // Callback with 0-indexed page
  showInfo      // Show "Showing X to Y" text
}
```

### Pages Updated

All pages now support pagination:

1. **Users.js** - Direct pagination implementation
2. **Roles.js** - Direct pagination implementation
3. **Groups.js** - Direct pagination implementation
4. **Permissions.js** - Via GenericCRUD
5. **Customers.js** - Via GenericCRUD
6. **Domains.js** - Via GenericCRUD
7. **Scenarios.js** - Direct pagination implementation + domain dropdown select
8. **Playboards.js** - Direct pagination implementation
9. **Configurations.js** - Direct pagination implementation

### GenericCRUD Component

Updated to handle pagination automatically:
- Fetches with page/limit params
- Updates pagination state from response
- Resets to page 0 on search
- Shows pagination when pages > 1

## Scenarios Page Special Updates

Additional changes to Scenarios.js:
- Removed `domainKey` text input field
- Added `dataDomain` as select dropdown
- Dropdown shows: "Domain Name (domain-key)"
- On submit: automatically sets `domainKey = dataDomain`
- Table displays domain name instead of key using lookup function

```javascript
const getDomainName = (key) => {
  const domain = domains.find(d => d.key === key);
  return domain ? domain.name : key;
};
```

## Usage Examples

### Frontend - Fetching paginated data:
```javascript
const [pagination, setPagination] = useState({ 
  page: 0, limit: 25, total: 0, pages: 0 
});

const fetchData = async () => {
  const response = await api.list({ 
    search, 
    page: pagination.page, 
    limit: pagination.limit 
  });
  setData(response.data.data || response.data);
  setPagination(prev => ({ ...prev, ...response.data.pagination }));
};
```

### Frontend - Search with page reset:
```javascript
<SearchInput
  value={search}
  onChange={(val) => { 
    setSearch(val); 
    setPagination(prev => ({ ...prev, page: 0 })); 
  }}
/>
```

### Frontend - Rendering pagination:
```javascript
{pagination.pages > 1 && (
  <Pagination
    currentPage={pagination.page}
    totalPages={pagination.pages}
    total={pagination.total}
    limit={pagination.limit}
    onPageChange={handlePageChange}
  />
)}
```

## Backward Compatibility

Frontend handles both old and new response formats:
```javascript
setData(response.data.data || response.data);
```

This allows gradual migration if needed.

## Configuration

- Default page size: 25 items
- Maximum page size: 100 items
- Page indexing: 0-based in API, 1-based in UI
