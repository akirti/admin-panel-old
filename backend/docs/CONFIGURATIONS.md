# Configuration Management System

This document explains the configuration management system including GCS integration, data storage, and priority loading logic.

## Configuration Types

| Type | Enum Value | Description | Primary Fields |
|------|------------|-------------|----------------|
| Lookup Data | `lookup_data` | Reference/lookup tables | `lookups` |
| Process | `process` | Queries, logic rules, operations | `queries`, `logics`, `operations` |
| Snapshot | `snapshot` | Point-in-time data snapshots | `data` |
| GCS Data | `gcs_data` | Binary files (XLSX, CSV) stored in GCS | `gcs` |

## Data Storage

### MongoDB Structure

All configurations are stored in the `configurations` collection with the following structure:

```json
{
  "_id": "ObjectId",
  "config_id": "config_xxxxxxxxxxxx",
  "type": "process|lookup_data|snapshot|gcs_data",
  "key": "unique-config-key",
  "lookups": {},
  "queries": {},
  "logics": {},
  "operations": {},
  "data": {},
  "gcs": null,
  "gcs_sync": {
    "synced": true,
    "gcs_path": "configurations/{key}/config.json",
    "sync_date": "2024-12-07T..."
  },
  "row_add_userid": "user@example.com",
  "row_add_stp": "2024-12-07T...",
  "row_update_userid": "user@example.com",
  "row_update_stp": "2024-12-07T..."
}
```

### Field Defaults

All type-specific fields (`lookups`, `queries`, `logics`, `operations`, `data`) are initialized to empty objects `{}` instead of `null` to ensure consistent API responses.

## GCS Integration

### Automatic Sync

For non-GCS_DATA types (lookup_data, process, snapshot), configuration data is automatically synced to GCS on:

- **Create**: New configuration is synced to `configurations/{key}/config.json`
- **Update**: Modified configuration is re-synced to GCS
- **Delete**: GCS sync file is deleted along with MongoDB document

### GCS Data Type (Binary Files)

For `gcs_data` type configurations, binary files (XLSX, CSV) are stored directly in GCS with versioning:

```
configurations/{key}/v1_filename.xlsx
configurations/{key}/v2_filename.xlsx
...
```

Version history is maintained in the `gcs.versions` array.

## Priority Loading Logic

When fetching a configuration via `GET /configurations/{config_id}`:

| Configuration Type | Primary Source | Fallback |
|-------------------|----------------|----------|
| `gcs_data` | GCS (binary file) | MongoDB metadata |
| Others | MongoDB | GCS sync copy (via `?source=gcs`) |

### Query Parameters

- `?source=gcs` - Force load from GCS sync copy (for non-gcs_data types)
- `?source=mongo` - Force load from MongoDB (even for gcs_data types)

### Response Indicator

The response includes `_loaded_from` field indicating the data source:
- `"mongo"` - Loaded from MongoDB
- `"gcs"` - Loaded from GCS
- `"mongo_fallback"` - GCS failed, fell back to MongoDB

## Data Flow Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Add/Update     │────▶│    MongoDB      │────▶│      GCS        │
│  Configuration  │     │  (Primary)      │     │  (Sync Copy)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │                        │
                               ▼                        ▼
                        ┌─────────────────────────────────┐
                        │  GET /configurations/{id}       │
                        │  - gcs_data: GCS priority       │
                        │  - others: MongoDB priority     │
                        │  - ?source=gcs: Force GCS       │
                        └─────────────────────────────────┘
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/configurations` | List all configurations (paginated) |
| GET | `/configurations/{id}` | Get single configuration |
| POST | `/configurations` | Create new configuration |
| PUT | `/configurations/{id}` | Update configuration |
| DELETE | `/configurations/{id}` | Delete configuration |
| POST | `/configurations/upload` | Upload config file (JSON, XLSX, CSV) |
| GET | `/configurations/{id}/download` | Download GCS file |
| GET | `/configurations/{id}/versions` | Get version history |
| GET | `/configurations/types` | Get available types |
| GET | `/configurations/gcs/status` | Check GCS service status |

## File Upload Handling

### JSON Files
1. Parsed and validated
2. Type auto-detected from content structure
3. Stored in MongoDB with appropriate fields
4. Synced to GCS as `configurations/{key}/config.json`

### Binary Files (XLSX, CSV)
1. Requires GCS to be configured
2. Uploaded to GCS with versioning
3. Metadata stored in MongoDB `gcs` field
4. Type set to `gcs_data`

## Environment Configuration

```env
# GCS Configuration
GCS_CREDENTIALS_JSON={"type":"service_account",...}
GCS_BUCKET_NAME=your-bucket-name
```

## Security

All configuration endpoints require `super_admin` role for access.
