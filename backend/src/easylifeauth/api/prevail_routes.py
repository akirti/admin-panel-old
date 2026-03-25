"""
Prevail API Proxy Routes.
Proxies requests from the Explorer playboard to an external Prevail service.
The Prevail service URL, auth, and SSL are configured via the api_configs collection
with key="prevail".
"""
import logging

from fastapi import APIRouter, Depends, HTTPException, status, Request

from easylifeauth.api.dependencies import get_db, get_gcs_service, get_handshake_secret, get_prevail_api_key
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
    handshake_secret: str = Depends(get_handshake_secret),
    prevail_api_key: str = Depends(get_prevail_api_key),
):
    """
    Proxy a playboard query to the external Prevail service.

    Looks up the api_config with the configured prevail key for the target URL and auth.
    Appends /{scenario_key} to the configured endpoint and forwards the
    JSON payload.
    """
    # Get the prevail API configuration using key from config/env
    api_key = prevail_api_key or "prevail"
    config = await service.get_config_by_key(api_key)
    if not config:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Prevail service is not configured. Create an api_config with key='prevail'.",
        )

    if config.get("status") not in ["A", "active"]:
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

    # Use the api_config_service test_api infrastructure to make the call.
    # Auth uses the api_config's own credentials (service-to-service),
    # NOT the user's JWT — forwarding it caused 401 from Prevail service
    # due to aud/iss claim mismatch. See features/issue2/prevail-401-issuefix.md.
    call_config = {
        **config,
        "endpoint": target_url,
        "method": "POST",
        "body": payload,
        "ping_endpoint": None,  # force test_api to use endpoint
        "timeout": config.get("timeout", 120),
    }

    # Pass authenticated user identity as custom headers so the Prevail
    # service knows who initiated the request without re-verifying the JWT.
    # Prevail's access_control.py accepts these headers for service-to-service auth.
    user_headers = {
        "X-User-Id": current_user.user_id,
        "X-User-Email": current_user.email,
        "X-User-Roles": ",".join(current_user.roles),
    }

    # If a shared service secret is configured, include it so Prevail can
    # verify this is a trusted internal caller (not a spoofed request).
    if handshake_secret:
        user_headers["X-Service-Secret"] = handshake_secret

    existing_headers = call_config.get("headers") or {}
    call_config["headers"] = {**existing_headers, **user_headers}

    # Set auth_type to "none" — Prevail will authenticate via X-User-* headers,
    # not via a bearer token. The api_config's auth_type/auth_config are ignored.
    call_config["auth_type"] = "none"
    call_config["auth_config"] = {}

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
