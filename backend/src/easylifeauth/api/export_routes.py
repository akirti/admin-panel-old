"""
Data export API routes for various formats (CSV, Excel, JSON).
"""
from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import StreamingResponse
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
import json
import csv
import io

from .dependencies import get_db
from ..db.db_manager import DatabaseManager
from ..security.access_control import CurrentUser, require_super_admin

router = APIRouter(prefix="/export", tags=["Export"])


def serialize_document(doc: Any) -> Any:
    """Convert MongoDB document to JSON-serializable format."""
    if isinstance(doc, dict):
        return {k: serialize_document(v) for k, v in doc.items()}
    elif isinstance(doc, list):
        return [serialize_document(item) for item in doc]
    elif isinstance(doc, datetime):
        return doc.isoformat()
    elif hasattr(doc, '__dict__'):
        return str(doc)
    else:
        return doc


def flatten_dict(d: Dict[str, Any], parent_key: str = '', sep: str = '_') -> Dict[str, Any]:
    """Flatten nested dictionary for CSV export."""
    items = []
    for k, v in d.items():
        new_key = f"{parent_key}{sep}{k}" if parent_key else k
        if isinstance(v, dict):
            items.extend(flatten_dict(v, new_key, sep=sep).items())
        elif isinstance(v, list):
            items.append((new_key, ', '.join(str(item) for item in v)))
        else:
            items.append((new_key, v))
    return dict(items)


async def get_collection_data(
    db: DatabaseManager,
    collection_name: str,
    filters: Dict[str, Any] = None
) -> List[Dict[str, Any]]:
    """Retrieve data from collection with optional filters."""
    collection = db.db[collection_name] if hasattr(db, 'db') else None

    if collection is None:
        return []

    query = filters or {}
    cursor = collection.find(query)

    documents = []
    async for doc in cursor:
        # Convert ObjectId to string
        doc['_id'] = str(doc['_id'])
        # Serialize datetime objects
        doc = serialize_document(doc)
        documents.append(doc)

    return documents


def create_csv_response(documents: List[Dict[str, Any]], filename: str) -> StreamingResponse:
    """Create CSV streaming response from documents."""
    if not documents:
        raise HTTPException(status_code=404, detail="No data to export")

    # Flatten nested structures
    flattened_docs = [flatten_dict(doc) for doc in documents]

    # Create CSV
    output = io.StringIO()
    if flattened_docs:
        # Get all unique keys across all documents
        all_keys = set()
        for doc in flattened_docs:
            all_keys.update(doc.keys())
        fieldnames = sorted(all_keys)

        writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction='ignore')
        writer.writeheader()
        writer.writerows(flattened_docs)

    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


def create_json_response(documents: List[Dict[str, Any]], filename: str) -> StreamingResponse:
    """Create JSON streaming response from documents."""
    if not documents:
        raise HTTPException(status_code=404, detail="No data to export")

    json_str = json.dumps(documents, indent=2, default=str)

    return StreamingResponse(
        iter([json_str]),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/users/csv")
async def export_users_csv(
    is_active: Optional[bool] = None,
    current_user: CurrentUser = Depends(require_super_admin),
    db: DatabaseManager = Depends(get_db)
):
    """Export users data to CSV format."""
    filters = {}
    if is_active is not None:
        filters['is_active'] = is_active

    documents = await get_collection_data(db, "users", filters)

    # Remove password_hash from export
    for doc in documents:
        doc.pop('password_hash', None)

    filename = f"users_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return create_csv_response(documents, filename)


@router.get("/users/json")
async def export_users_json(
    is_active: Optional[bool] = None,
    current_user: CurrentUser = Depends(require_super_admin),
    db: DatabaseManager = Depends(get_db)
):
    """Export users data to JSON format."""
    filters = {}
    if is_active is not None:
        filters['is_active'] = is_active

    documents = await get_collection_data(db, "users", filters)

    # Remove password_hash from export
    for doc in documents:
        doc.pop('password_hash', None)

    filename = f"users_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    return create_json_response(documents, filename)


@router.get("/roles/csv")
async def export_roles_csv(
    status: Optional[str] = None,
    current_user: CurrentUser = Depends(require_super_admin),
    db: DatabaseManager = Depends(get_db)
):
    """Export roles data to CSV format."""
    filters = {}
    if status:
        filters['status'] = status

    documents = await get_collection_data(db, "roles", filters)
    filename = f"roles_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return create_csv_response(documents, filename)


@router.get("/roles/json")
async def export_roles_json(
    status: Optional[str] = None,
    current_user: CurrentUser = Depends(require_super_admin),
    db: DatabaseManager = Depends(get_db)
):
    """Export roles data to JSON format."""
    filters = {}
    if status:
        filters['status'] = status

    documents = await get_collection_data(db, "roles", filters)
    filename = f"roles_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    return create_json_response(documents, filename)


@router.get("/groups/csv")
async def export_groups_csv(
    status: Optional[str] = None,
    current_user: CurrentUser = Depends(require_super_admin),
    db: DatabaseManager = Depends(get_db)
):
    """Export groups data to CSV format."""
    filters = {}
    if status:
        filters['status'] = status

    documents = await get_collection_data(db, "groups", filters)
    filename = f"groups_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return create_csv_response(documents, filename)


@router.get("/groups/json")
async def export_groups_json(
    status: Optional[str] = None,
    current_user: CurrentUser = Depends(require_super_admin),
    db: DatabaseManager = Depends(get_db)
):
    """Export groups data to JSON format."""
    filters = {}
    if status:
        filters['status'] = status

    documents = await get_collection_data(db, "groups", filters)
    filename = f"groups_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    return create_json_response(documents, filename)


@router.get("/domains/csv")
async def export_domains_csv(
    status: Optional[str] = None,
    current_user: CurrentUser = Depends(require_super_admin),
    db: DatabaseManager = Depends(get_db)
):
    """Export domains data to CSV format."""
    filters = {}
    if status:
        filters['status'] = status

    documents = await get_collection_data(db, "domains", filters)
    filename = f"domains_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return create_csv_response(documents, filename)


@router.get("/domains/json")
async def export_domains_json(
    status: Optional[str] = None,
    current_user: CurrentUser = Depends(require_super_admin),
    db: DatabaseManager = Depends(get_db)
):
    """Export domains data to JSON format."""
    filters = {}
    if status:
        filters['status'] = status

    documents = await get_collection_data(db, "domains", filters)
    filename = f"domains_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    return create_json_response(documents, filename)


@router.get("/scenarios/csv")
async def export_scenarios_csv(
    status: Optional[str] = None,
    domain_key: Optional[str] = None,
    current_user: CurrentUser = Depends(require_super_admin),
    db: DatabaseManager = Depends(get_db)
):
    """Export scenarios data to CSV format."""
    filters = {}
    if status:
        filters['status'] = status
    if domain_key:
        filters['domainKey'] = domain_key

    documents = await get_collection_data(db, "domain_scenarios", filters)
    filename = f"scenarios_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return create_csv_response(documents, filename)


@router.get("/scenarios/json")
async def export_scenarios_json(
    status: Optional[str] = None,
    domain_key: Optional[str] = None,
    current_user: CurrentUser = Depends(require_super_admin),
    db: DatabaseManager = Depends(get_db)
):
    """Export scenarios data to JSON format."""
    filters = {}
    if status:
        filters['status'] = status
    if domain_key:
        filters['domainKey'] = domain_key

    documents = await get_collection_data(db, "domain_scenarios", filters)
    filename = f"scenarios_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    return create_json_response(documents, filename)


@router.get("/activity-logs/csv")
async def export_activity_logs_csv(
    days: Optional[int] = 30,
    current_user: CurrentUser = Depends(require_super_admin),
    db: DatabaseManager = Depends(get_db)
):
    """Export activity logs to CSV format."""
    filters = {}
    if days:
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        filters['timestamp'] = {'$gte': cutoff_date}

    documents = await get_collection_data(db, "activity_logs", filters)
    filename = f"activity_logs_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return create_csv_response(documents, filename)


@router.get("/activity-logs/json")
async def export_activity_logs_json(
    days: Optional[int] = 30,
    current_user: CurrentUser = Depends(require_super_admin),
    db: DatabaseManager = Depends(get_db)
):
    """Export activity logs to JSON format."""
    filters = {}
    if days:
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        filters['timestamp'] = {'$gte': cutoff_date}

    documents = await get_collection_data(db, "activity_logs", filters)
    filename = f"activity_logs_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    return create_json_response(documents, filename)
