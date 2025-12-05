"""
Data export API routes for various formats (CSV, Excel, JSON).
"""
from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import StreamingResponse
from app.models import UserInDB
from app.auth import get_super_admin_user
from app.database import get_database, COLLECTIONS
from typing import Optional
from datetime import datetime
import json
import csv
import io

router = APIRouter(prefix="/export", tags=["Export"])


def serialize_document(doc):
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


def flatten_dict(d, parent_key='', sep='_'):
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


async def get_collection_data(collection_name: str, filters: dict = None):
    """Retrieve data from collection with optional filters."""
    db = get_database()

    if collection_name not in COLLECTIONS.values():
        raise HTTPException(status_code=400, detail=f"Invalid collection: {collection_name}")

    query = filters or {}
    cursor = db[collection_name].find(query)

    documents = []
    async for doc in cursor:
        # Convert ObjectId to string
        doc['_id'] = str(doc['_id'])
        # Serialize datetime objects
        doc = serialize_document(doc)
        documents.append(doc)

    return documents


@router.get("/users/csv")
async def export_users_csv(
    is_active: Optional[bool] = None,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Export users data to CSV format."""
    filters = {}
    if is_active is not None:
        filters['is_active'] = is_active

    documents = await get_collection_data(COLLECTIONS["users"], filters)

    if not documents:
        raise HTTPException(status_code=404, detail="No data to export")

    # Remove password_hash from export
    for doc in documents:
        doc.pop('password_hash', None)

    # Flatten nested structures
    flattened_docs = [flatten_dict(doc) for doc in documents]

    # Create CSV
    output = io.StringIO()
    if flattened_docs:
        writer = csv.DictWriter(output, fieldnames=flattened_docs[0].keys())
        writer.writeheader()
        writer.writerows(flattened_docs)

    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=users_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"}
    )


@router.get("/users/json")
async def export_users_json(
    is_active: Optional[bool] = None,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Export users data to JSON format."""
    filters = {}
    if is_active is not None:
        filters['is_active'] = is_active

    documents = await get_collection_data(COLLECTIONS["users"], filters)

    if not documents:
        raise HTTPException(status_code=404, detail="No data to export")

    # Remove password_hash from export
    for doc in documents:
        doc.pop('password_hash', None)

    json_str = json.dumps(documents, indent=2, default=str)

    return StreamingResponse(
        iter([json_str]),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename=users_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"}
    )


@router.get("/roles/csv")
async def export_roles_csv(
    status: Optional[str] = None,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Export roles data to CSV format."""
    filters = {}
    if status:
        filters['status'] = status

    documents = await get_collection_data(COLLECTIONS["roles"], filters)

    if not documents:
        raise HTTPException(status_code=404, detail="No data to export")

    flattened_docs = [flatten_dict(doc) for doc in documents]

    output = io.StringIO()
    if flattened_docs:
        writer = csv.DictWriter(output, fieldnames=flattened_docs[0].keys())
        writer.writeheader()
        writer.writerows(flattened_docs)

    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=roles_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"}
    )


@router.get("/roles/json")
async def export_roles_json(
    status: Optional[str] = None,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Export roles data to JSON format."""
    filters = {}
    if status:
        filters['status'] = status

    documents = await get_collection_data(COLLECTIONS["roles"], filters)

    if not documents:
        raise HTTPException(status_code=404, detail="No data to export")

    json_str = json.dumps(documents, indent=2, default=str)

    return StreamingResponse(
        iter([json_str]),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename=roles_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"}
    )


@router.get("/groups/csv")
async def export_groups_csv(
    status: Optional[str] = None,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Export groups data to CSV format."""
    filters = {}
    if status:
        filters['status'] = status

    documents = await get_collection_data(COLLECTIONS["groups"], filters)

    if not documents:
        raise HTTPException(status_code=404, detail="No data to export")

    flattened_docs = [flatten_dict(doc) for doc in documents]

    output = io.StringIO()
    if flattened_docs:
        writer = csv.DictWriter(output, fieldnames=flattened_docs[0].keys())
        writer.writeheader()
        writer.writerows(flattened_docs)

    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=groups_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"}
    )


@router.get("/groups/json")
async def export_groups_json(
    status: Optional[str] = None,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Export groups data to JSON format."""
    filters = {}
    if status:
        filters['status'] = status

    documents = await get_collection_data(COLLECTIONS["groups"], filters)

    if not documents:
        raise HTTPException(status_code=404, detail="No data to export")

    json_str = json.dumps(documents, indent=2, default=str)

    return StreamingResponse(
        iter([json_str]),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename=groups_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"}
    )


@router.get("/customers/csv")
async def export_customers_csv(
    status: Optional[str] = None,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Export customers data to CSV format."""
    filters = {}
    if status:
        filters['status'] = status

    documents = await get_collection_data(COLLECTIONS["customers"], filters)

    if not documents:
        raise HTTPException(status_code=404, detail="No data to export")

    flattened_docs = [flatten_dict(doc) for doc in documents]

    output = io.StringIO()
    if flattened_docs:
        writer = csv.DictWriter(output, fieldnames=flattened_docs[0].keys())
        writer.writeheader()
        writer.writerows(flattened_docs)

    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=customers_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"}
    )


@router.get("/customers/json")
async def export_customers_json(
    status: Optional[str] = None,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Export customers data to JSON format."""
    filters = {}
    if status:
        filters['status'] = status

    documents = await get_collection_data(COLLECTIONS["customers"], filters)

    if not documents:
        raise HTTPException(status_code=404, detail="No data to export")

    json_str = json.dumps(documents, indent=2, default=str)

    return StreamingResponse(
        iter([json_str]),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename=customers_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"}
    )


@router.get("/domains/csv")
async def export_domains_csv(
    status: Optional[str] = None,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Export domains data to CSV format."""
    filters = {}
    if status:
        filters['status'] = status

    documents = await get_collection_data(COLLECTIONS["domains"], filters)

    if not documents:
        raise HTTPException(status_code=404, detail="No data to export")

    flattened_docs = [flatten_dict(doc) for doc in documents]

    output = io.StringIO()
    if flattened_docs:
        writer = csv.DictWriter(output, fieldnames=flattened_docs[0].keys())
        writer.writeheader()
        writer.writerows(flattened_docs)

    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=domains_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"}
    )


@router.get("/domains/json")
async def export_domains_json(
    status: Optional[str] = None,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Export domains data to JSON format."""
    filters = {}
    if status:
        filters['status'] = status

    documents = await get_collection_data(COLLECTIONS["domains"], filters)

    if not documents:
        raise HTTPException(status_code=404, detail="No data to export")

    json_str = json.dumps(documents, indent=2, default=str)

    return StreamingResponse(
        iter([json_str]),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename=domains_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"}
    )


@router.get("/activity-logs/csv")
async def export_activity_logs_csv(
    days: Optional[int] = 30,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Export activity logs to CSV format."""
    from datetime import timedelta

    filters = {}
    if days:
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        filters['timestamp'] = {'$gte': cutoff_date}

    documents = await get_collection_data(COLLECTIONS["audit_logs"], filters)

    if not documents:
        raise HTTPException(status_code=404, detail="No data to export")

    flattened_docs = [flatten_dict(doc) for doc in documents]

    output = io.StringIO()
    if flattened_docs:
        writer = csv.DictWriter(output, fieldnames=flattened_docs[0].keys())
        writer.writeheader()
        writer.writerows(flattened_docs)

    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=activity_logs_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"}
    )


@router.get("/activity-logs/json")
async def export_activity_logs_json(
    days: Optional[int] = 30,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Export activity logs to JSON format."""
    from datetime import timedelta

    filters = {}
    if days:
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        filters['timestamp'] = {'$gte': cutoff_date}

    documents = await get_collection_data(COLLECTIONS["audit_logs"], filters)

    if not documents:
        raise HTTPException(status_code=404, detail="No data to export")

    json_str = json.dumps(documents, indent=2, default=str)

    return StreamingResponse(
        iter([json_str]),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename=activity_logs_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"}
    )


@router.get("/permissions/csv")
async def export_permissions_csv(
    module: Optional[str] = None,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Export permissions data to CSV format."""
    filters = {}
    if module:
        filters['module'] = module

    documents = await get_collection_data(COLLECTIONS["permissions"], filters)

    if not documents:
        raise HTTPException(status_code=404, detail="No data to export")

    flattened_docs = [flatten_dict(doc) for doc in documents]

    output = io.StringIO()
    if flattened_docs:
        writer = csv.DictWriter(output, fieldnames=flattened_docs[0].keys())
        writer.writeheader()
        writer.writerows(flattened_docs)

    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=permissions_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"}
    )


@router.get("/permissions/json")
async def export_permissions_json(
    module: Optional[str] = None,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Export permissions data to JSON format."""
    filters = {}
    if module:
        filters['module'] = module

    documents = await get_collection_data(COLLECTIONS["permissions"], filters)

    if not documents:
        raise HTTPException(status_code=404, detail="No data to export")

    json_str = json.dumps(documents, indent=2, default=str)

    return StreamingResponse(
        iter([json_str]),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename=permissions_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"}
    )
