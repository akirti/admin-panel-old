"""Async Scenario Routes"""
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status

from .models import ScenarioCreate, ScenarioUpdate, ScenarioResponse, MessageResponse
from .dependencies import get_current_user, get_scenario_service, get_db, get_user_service
from ..services.scenario_service import ScenarioService
from ..services.user_service import UserService
from ..db.db_manager import DatabaseManager
from ..security.access_control import CurrentUser, require_admin_or_editor
from ..errors.scenario_error import ScenarioError, ScenarioNotFoundError, ScenarioBadError

router = APIRouter(prefix="/scenarios", tags=["Scenarios"])


async def get_user_accessible_domains(
    current_user: CurrentUser,
    db: DatabaseManager,
    user_service: UserService
) -> List[str]:
    """Get list of domain keys the user can access."""
    if "super-administrator" in current_user.roles:
        return ["all"]

    user = await db.users.find_one({"email": current_user.email})
    if not user:
        return []

    resolved_domains = await user_service.resolve_user_domains(user)
    return resolved_domains


def check_domain_access(user_domains: List[str], domain_key: str) -> bool:
    """Check if user has access to a specific domain."""
    if "all" in user_domains:
        return True
    return domain_key in user_domains


# IMPORTANT: /all routes must come BEFORE /{key} routes
@router.get("/all")
async def get_all_scenarios(
    current_user: CurrentUser = Depends(get_current_user),
    db: DatabaseManager = Depends(get_db),
    user_service: UserService = Depends(get_user_service)
) -> List[Dict[str, Any]]:
    """Get all scenarios filtered by user's accessible domains"""
    # Get user's accessible domains
    user_domains = await get_user_accessible_domains(current_user, db, user_service)

    if not user_domains:
        return []

    # Build query based on user's accessible domains
    query = {"status": {"$in": ["A", "active"]}}

    # Filter by user's accessible domains (unless super admin with "all")
    if "all" not in user_domains:
        query["dataDomain"] = {"$in": user_domains}

    cursor = db.domain_scenarios.find(
        filter=query,
        projection={"_id": 0}
    ).sort("order", 1)

    result = await cursor.to_list(length=1000)
    return result


@router.get("/all/{domain_key}")
async def get_scenarios_by_domain(
    domain_key: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: DatabaseManager = Depends(get_db),
    user_service: UserService = Depends(get_user_service)
) -> List[Dict[str, Any]]:
    """Get all scenarios for a domain (if user has access to that domain)"""
    # Get user's accessible domains
    user_domains = await get_user_accessible_domains(current_user, db, user_service)

    if not user_domains:
        return []

    # Check if user has access to the requested domain
    if not check_domain_access(user_domains, domain_key):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this domain"
        )

    # Query scenarios for the specified domain
    cursor = db.domain_scenarios.find(
        filter={"dataDomain": domain_key, "status": {"$in": ["A", "active"]}},
        projection={"_id": 0}
    ).sort("order", 1)

    result = await cursor.to_list(length=1000)
    return result


@router.post("", response_model=ScenarioResponse, status_code=status.HTTP_201_CREATED)
async def create_scenario(
    data: ScenarioCreate,
    current_user: CurrentUser = Depends(require_admin_or_editor),
    scenario_service: ScenarioService = Depends(get_scenario_service)
):
    """Create a new scenario"""
    try:
        result = await scenario_service.save(
            data.model_dump(),
            user_id=current_user.user_id
        )
        return result
    except (ScenarioError, ScenarioBadError) as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.put("/{key}", response_model=ScenarioResponse)
async def update_scenario(
    key: str,
    data: ScenarioUpdate,
    current_user: CurrentUser = Depends(require_admin_or_editor),
    scenario_service: ScenarioService = Depends(get_scenario_service)
):
    """Update a scenario"""
    if data.id and data.id != key:
        raise HTTPException(status_code=400, detail="ID mismatch")
    
    try:
        update_data = data.model_dump(exclude_unset=True)
        update_data["_id"] = key
        result = await scenario_service.update(update_data, user_id=current_user.user_id)
        return result
    except ScenarioNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
    except (ScenarioError, ScenarioBadError) as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.get("/{key}", response_model=ScenarioResponse)
async def get_scenario(
    key: str,
    current_user: CurrentUser = Depends(get_current_user),
    scenario_service: ScenarioService = Depends(get_scenario_service),
    db: DatabaseManager = Depends(get_db),
    user_service: UserService = Depends(get_user_service)
):
    """Get scenario by key or ID (if user has access to its domain)"""
    try:
        result = await scenario_service.get(key)
        if not result:
            raise HTTPException(status_code=404, detail="Scenario not found")

        # Check domain access
        user_domains = await get_user_accessible_domains(current_user, db, user_service)
        scenario_domain = result.get("dataDomain", "")
        if scenario_domain and not check_domain_access(user_domains, scenario_domain):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this scenario's domain"
            )

        return result
    except ScenarioNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
    except (ScenarioError, ScenarioBadError) as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.delete("/{key}", response_model=MessageResponse)
async def delete_scenario(
    key: str,
    current_user: CurrentUser = Depends(require_admin_or_editor),
    scenario_service: ScenarioService = Depends(get_scenario_service)
):
    """Delete scenario (set to inactive)"""
    try:
        result = await scenario_service.delete(key)
        return result
    except ScenarioNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
    except (ScenarioError, ScenarioBadError) as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
