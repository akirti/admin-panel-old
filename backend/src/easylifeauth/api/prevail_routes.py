"""
Prevail API Proxy Routes.
Proxies requests from the Explorer playboard to an external Prevail service.
The Prevail service URL, auth, and SSL are configured via the api_configs collection
with key="prevail".
"""
import time
import logging
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import JSONResponse

from easylifeauth.api.dependencies import get_db, get_gcs_service
from easylifeauth.security.access_control import get_current_user, CurrentUser
from easylifeauth.services.api_config_service import ApiConfigService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/prevail", tags=["Prevail Proxy"])


def get_api_config_service(db=Depends(get_db), gcs_service=Depends(get_gcs_service)):
    return ApiConfigService(db, gcs_service)


@router.post("/{scenario_key}")
async def execute_prevail_query(
    scenario_key: str,
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
    service: ApiConfigService = Depends(get_api_config_service),
):
    """
    Proxy a playboard query to the external Prevail service.

    Looks up the api_config with key="prevail" for the target URL and auth.
    Appends /{scenario_key} to the configured endpoint and forwards the
    JSON payload.
    """
    # Get the prevail API configuration
    config = await service.get_config_by_key("prevail")
    if not config:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Prevail service is not configured. Create an api_config with key='prevail'.",
        )

    if config.get("status") != "active":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Prevail service configuration is inactive.",
        )

    endpoint = config.get("endpoint")
    if not endpoint:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Prevail service endpoint is not configured.",
        )

    # Build the target URL: base endpoint + /scenario_key
    target_url = f"{endpoint.rstrip('/')}/{scenario_key}"

    # Read the request body
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON payload.",
        )

    # Forward the logged-in user's Bearer token to the Prevail service
    auth_header = request.headers.get("authorization", "")
    token = auth_header.replace("Bearer ", "", 1) if auth_header.startswith("Bearer ") else auth_header

    # Use the api_config_service test_api infrastructure to make the call
    # Override auth_type to "bearer" so the user's token is forwarded
    call_config = {
        **config,
        "endpoint": target_url,
        "method": "POST",
        "body": payload,
        "ping_endpoint": None,  # force test_api to use endpoint
        "timeout": config.get("timeout", 120),
        "auth_type": "bearer",
        "auth_config": {"token": token},
    }

    result = await service.test_api(call_config)

    if result.get("error"):
        logger.error(
            "Prevail proxy error for scenario %s: %s",
            scenario_key,
            result["error"],
        )
        raise HTTPException(
            status_code=result.get("status_code") or 502,
            detail=f"Prevail service error: {result['error']}",
        )

    # Return the response body from the external service
    response_body = result.get("response_body")
    if response_body is None:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="No response from Prevail service.",
        )

    return response_body
