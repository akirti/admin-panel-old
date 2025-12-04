"""Async New Scenario Request Service"""
from typing import Dict, Any, List, Optional
import re
from enum import Enum
from bson import ObjectId
from datetime import datetime, timezone

from ..db.db_manager import DatabaseManager, distribute_limit
from ..db.constants import EDITORS
from ..db.lookup import (
    ScenarioRequestStatusTypes, RequestType, REQUEST_STATUS_DESC,
    STATUS_TRANSITIONS
)
from ..models.scenario_request import (
    USER_EDITABLE_FIELDS, ADMIN_EDITABLE_FIELDS, TOGGLE_FIELDS
)
from .token_manager import TokenManager
from .email_service import EmailService
from .jira_service import JiraService
from .file_storage_service import FileStorageService
from ..errors.auth_error import AuthError


class NewScenarioService:
    """Enhanced Async Scenario Request Service"""
    
    def __init__(
        self,
        db: DatabaseManager,
        token_manager: TokenManager,
        email_service: Optional[EmailService] = None,
        jira_service: Optional[JiraService] = None,
        file_storage_service: Optional[FileStorageService] = None
    ):
        self.db = db
        self.token_manager = token_manager
        self.email_service = email_service
        self.jira_service = jira_service
        self.file_storage = file_storage_service

    async def generate_next_id(self, prefix: str = "REQ-SCR") -> str:
        """Generate next request ID"""
        pattern = re.compile(f"^{prefix}-\\d+$")
        
        cursor = self.db.scenario_requests.find(
            {"requestId": {"$regex": pattern.pattern}}
        ).sort("requestId", -1).limit(1)
        
        docs = await cursor.to_list(length=1)
        max_number = 0
        
        for doc in docs:
            match = re.search(rf"{prefix}-(\d+)", doc["requestId"])
            if match:
                num = int(match.group(1))
                max_number = max(max_number, num)
        
        next_number = max_number + 1
        new_id = f"{prefix}-{str(next_number).zfill(4)}"
        return new_id

    async def _get_domain_info(self, domain_key: str) -> Optional[Dict[str, Any]]:
        """Get domain information for validation"""
        domain = await self.db.easylife_domain.find_one(
            {"key": domain_key, "status": "A"}
        )
        return domain

    async def _get_user_info(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get user information by ID"""
        try:
            user = await self.db.users.find_one({"_id": ObjectId(user_id)})
            if user:
                return {
                    "user_id": str(user["_id"]),
                    "email": user.get("email"),
                    "full_name": user.get("full_name"),
                    "username": user.get("username")
                }
        except Exception:
            pass
        return None

    async def _get_users_for_autocomplete(
        self,
        search_term: str,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Get users for autocomplete (assigned_to field)"""
        cursor = self.db.users.find(
            {
                "$or": [
                    {"email": {"$regex": search_term, "$options": "i"}},
                    {"full_name": {"$regex": search_term, "$options": "i"}},
                    {"username": {"$regex": search_term, "$options": "i"}}
                ],
                "is_active": True
            },
            {"_id": 1, "email": 1, "full_name": 1, "username": 1}
        ).limit(limit)
        
        users = await cursor.to_list(length=limit)
        return [
            {
                "user_id": str(u["_id"]),
                "email": u.get("email"),
                "full_name": u.get("full_name"),
                "username": u.get("username"),
                "label": f"{u.get('full_name', u.get('username', ''))} ({u.get('email', '')})"
            }
            for u in users
        ]

    async def _send_notifications(
        self,
        scenario_request: Dict[str, Any],
        update_type: str = "created",
        additional_recipients: Optional[List[str]] = None
    ):
        """Send email notifications to all relevant parties"""
        if not self.email_service:
            return
        
        recipients = set()
        
        # Add request creator
        if scenario_request.get("email"):
            recipients.add(scenario_request["email"])
        
        # Add configured recipients
        if scenario_request.get("email_recipients"):
            for r in scenario_request["email_recipients"]:
                recipients.add(r)
        
        # Add additional recipients
        if additional_recipients:
            for r in additional_recipients:
                recipients.add(r)
        
        # Add workflow assignees
        work_flow = scenario_request.get("work_flow", [])
        for wf in work_flow:
            if isinstance(wf, dict) and wf.get("assigned_to_email"):
                recipients.add(wf["assigned_to_email"])
        
        # Send emails
        for email in recipients:
            try:
                await self.email_service.send_scenario_email(
                    to_email=email,
                    data={**scenario_request, "update_type": update_type}
                )
            except Exception as e:
                print(f"Failed to send notification to {email}: {e}")

    async def _create_jira_ticket(self, scenario_request: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Create Jira ticket for new request"""
        if not self.jira_service:
            return None
        
        try:
            jira_info = await self.jira_service.create_ticket(scenario_request)
            return jira_info
        except Exception as e:
            print(f"Failed to create Jira ticket: {e}")
            return {"sync_status": "failed", "error": str(e)}

    async def _update_jira_ticket(
        self,
        scenario_request: Dict[str, Any],
        update_type: str = "general"
    ):
        """Update Jira ticket"""
        if not self.jira_service:
            return
        
        jira_info = scenario_request.get("jira", {})
        ticket_key = jira_info.get("ticket_key") if jira_info else None
        
        if not ticket_key:
            return
        
        try:
            result = await self.jira_service.update_ticket(
                ticket_key, scenario_request, update_type
            )
            
            if result:
                # Update jira info in database
                await self.db.scenario_requests.update_one(
                    {"requestId": scenario_request["requestId"]},
                    {"$set": {
                        "jira.last_synced": result.get("last_synced"),
                        "jira.sync_status": result.get("sync_status")
                    }}
                )
        except Exception as e:
            print(f"Failed to update Jira ticket: {e}")

    async def _add_workflow_entry(
        self,
        request_id: str,
        from_status: str,
        to_status: str,
        assigned_by: Dict[str, Any],
        assigned_to: Optional[Dict[str, Any]] = None,
        comment: Optional[str] = None
    ) -> Dict[str, Any]:
        """Add workflow entry when status changes"""
        workflow_entry = {
            "from_status": from_status,
            "to_status": to_status,
            "assigned_by": assigned_by.get("user_id"),
            "assigned_by_email": assigned_by.get("email"),
            "assigned_by_name": assigned_by.get("full_name") or assigned_by.get("username"),
            "create_stp": datetime.now(timezone.utc).isoformat(),
            "update_stp": datetime.now(timezone.utc).isoformat()
        }
        
        if assigned_to:
            workflow_entry.update({
                "assigned_to": assigned_to.get("user_id"),
                "assigned_to_email": assigned_to.get("email"),
                "assigned_to_name": assigned_to.get("full_name") or assigned_to.get("username")
            })
        
        if comment:
            workflow_entry["comment"] = comment
        
        # Get current flow order
        request = await self.db.scenario_requests.find_one({"requestId": request_id})
        current_workflow = request.get("work_flow", []) if request else []
        workflow_entry["flowOrder"] = len(current_workflow) + 1
        
        # Add to workflow array
        await self.db.scenario_requests.update_one(
            {"requestId": request_id},
            {"$push": {"work_flow": workflow_entry}}
        )
        
        return workflow_entry

    def _can_edit_request(
        self,
        user_id: str,
        roles: List[str],
        scenario_request: Dict[str, Any]
    ) -> bool:
        """Check if user can edit the request"""
        # Admins and editors can edit all
        if any(r in roles for r in EDITORS):
            return True
        
        # Creator can edit their own request
        if scenario_request.get("user_id") == user_id:
            return True
        
        return False

    def _get_allowed_fields(
        self,
        user_id: str,
        roles: List[str],
        scenario_request: Dict[str, Any]
    ) -> set:
        """Get fields user is allowed to edit"""
        if any(r in roles for r in EDITORS):
            return ADMIN_EDITABLE_FIELDS
        
        if scenario_request.get("user_id") == user_id:
            return USER_EDITABLE_FIELDS
        
        return set()

    async def save(
        self,
        ask_scenario: Dict[str, Any],
        current_user: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Save new scenario request"""
        if not ask_scenario or not isinstance(ask_scenario, dict):
            raise AuthError("New scenario data is not provided", 400)
        
        # Validate required fields
        if not ask_scenario.get("dataDomain"):
            raise AuthError("dataDomain is required", 400)
        if not ask_scenario.get("name"):
            raise AuthError("name is required", 400)
        if not ask_scenario.get("description"):
            raise AuthError("description is required", 400)
        
        # Validate domain exists
        domain = await self._get_domain_info(ask_scenario["dataDomain"])
        if not domain:
            raise AuthError(f"Invalid domain: {ask_scenario['dataDomain']}", 400)
        
        # Generate request ID
        ask_scenario["requestId"] = await self.generate_next_id()
        ask_scenario["row_add_stp"] = datetime.now(timezone.utc).isoformat()
        ask_scenario["row_update_stp"] = datetime.now(timezone.utc).isoformat()
        ask_scenario["status"] = ScenarioRequestStatusTypes.SUBMITTED.value
        ask_scenario["statusDescription"] = REQUEST_STATUS_DESC.get(
            ScenarioRequestStatusTypes.SUBMITTED.value, "Submitted"
        )
        
        # Initialize empty arrays
        ask_scenario.setdefault("steps", [])
        ask_scenario.setdefault("comments", [])
        ask_scenario.setdefault("files", [])
        ask_scenario.setdefault("work_flow", [])
        ask_scenario.setdefault("buckets", [])
        ask_scenario.setdefault("email_recipients", [])
        
        # Insert into database
        result = await self.db.scenario_requests.insert_one(ask_scenario)
        new_scenario_id = str(result.inserted_id)
        
        # Get the created document
        out_result = await self.db.scenario_requests.find_one(
            {"_id": ObjectId(new_scenario_id)}
        )
        out_result["_id"] = str(out_result["_id"])
        
        # Create Jira ticket
        jira_info = await self._create_jira_ticket(out_result)
        if jira_info:
            await self.db.scenario_requests.update_one(
                {"_id": ObjectId(new_scenario_id)},
                {"$set": {"jira": jira_info}}
            )
            out_result["jira"] = jira_info
        
        # Send notifications
        await self._send_notifications(out_result, "created")
        
        return out_result

    async def update(
        self,
        update_data: Dict[str, Any],
        current_user: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Update scenario request"""
        if not update_data or not isinstance(update_data, dict):
            raise AuthError("No scenario update data provided", 400)

        request_id = update_data.get("request_id") or update_data.get("requestId")
        if not request_id:
            raise AuthError("request_id is required", 400)

        # Get current request
        current_request = await self.db.scenario_requests.find_one({"requestId": request_id})
        if not current_request:
            raise AuthError("Scenario request not found", 404)

        user_id = current_user.get("user_id")
        roles = current_user.get("roles", [])

        # Check if user can edit
        if not self._can_edit_request(user_id, roles, current_request):
            raise AuthError("You do not have permission to edit this request", 403)

        # Get allowed fields
        allowed_fields = self._get_allowed_fields(user_id, roles, current_request)
        
        # Track what was updated
        update_types = []
        update_fields = {}
        
        # Process each field
        for key, value in update_data.items():
            if key in allowed_fields:
                # Handle toggle fields (can only be set once or toggled)
                if key in TOGGLE_FIELDS:
                    current_value = current_request.get(key)
                    if current_value and value and current_value != value:
                        # Only admins can change toggle fields after initial set
                        if not any(r in roles for r in EDITORS):
                            continue
                
                update_fields[key] = value
        
        # Handle status change
        if "status" in update_data and any(r in roles for r in EDITORS):
            new_status = update_data["status"]
            old_status = current_request.get("status")
            
            if new_status != old_status:
                # Validate status transition
                old_status_enum = None
                try:
                    old_status_enum = ScenarioRequestStatusTypes(old_status) if old_status else None
                except ValueError:
                    pass
                
                valid_transitions = STATUS_TRANSITIONS.get(old_status_enum, list(ScenarioRequestStatusTypes))
                
                try:
                    new_status_enum = ScenarioRequestStatusTypes(new_status)
                    if new_status_enum in valid_transitions or not valid_transitions:
                        update_fields["status"] = new_status
                        update_fields["statusDescription"] = REQUEST_STATUS_DESC.get(new_status, "Unknown")
                        update_types.append("status_change")
                        
                        # Add workflow entry for status change
                        await self._add_workflow_entry(
                            request_id=request_id,
                            from_status=old_status,
                            to_status=new_status,
                            assigned_by=current_user,
                            comment=update_data.get("status_comment")
                        )
                except ValueError:
                    pass
        
        # Handle new comment
        if "new_comment" in update_data:
            comment_data = update_data["new_comment"]
            if isinstance(comment_data, dict):
                comment_data["user_id"] = user_id
                comment_data["username"] = current_user.get("full_name") or current_user.get("username") or current_user.get("email")
                comment_data["commentDate"] = datetime.now(timezone.utc).isoformat()
                
                current_comments = current_request.get("comments", [])
                comment_data["order"] = len(current_comments) + 1
                
                await self.db.scenario_requests.update_one(
                    {"requestId": request_id},
                    {"$push": {"comments": comment_data}}
                )
                update_types.append("comment")
        
        # Handle new workflow entry
        if "new_workflow" in update_data and any(r in roles for r in EDITORS):
            wf_data = update_data["new_workflow"]
            if isinstance(wf_data, dict):
                assigned_to = None
                if wf_data.get("assigned_to"):
                    assigned_to = await self._get_user_info(wf_data["assigned_to"])
                
                await self._add_workflow_entry(
                    request_id=request_id,
                    from_status=current_request.get("status"),
                    to_status=wf_data.get("to_status") or current_request.get("status"),
                    assigned_by=current_user,
                    assigned_to=assigned_to,
                    comment=wf_data.get("comment")
                )
                update_types.append("workflow")
        
        # Update timestamp
        update_fields["row_update_stp"] = datetime.now(timezone.utc).isoformat()
        update_fields["row_update_user_id"] = user_id

        if update_fields:
            await self.db.scenario_requests.update_one(
                {"requestId": request_id},
                {"$set": update_fields}
            )

        # Get updated request
        updated = await self.db.scenario_requests.find_one({"requestId": request_id})
        if updated:
            updated["_id"] = str(updated["_id"])
        
        # Update Jira if needed
        for update_type in update_types:
            await self._update_jira_ticket(updated, update_type)
        
        # Send notifications
        if update_types:
            await self._send_notifications(updated, update_types[0])
        else:
            await self._send_notifications(updated, "updated")

        return updated

    async def upload_file(
        self,
        request_id: str,
        file_name: str,
        file_content: bytes,
        folder: str,
        current_user: Dict[str, Any],
        comment: str = None
    ) -> Dict[str, Any]:
        """Upload a file to scenario request"""
        if not self.file_storage:
            raise AuthError("File storage not configured", 500)

        # Get current request
        request = await self.db.scenario_requests.find_one({"requestId": request_id})
        if not request:
            raise AuthError("Scenario request not found", 404)

        user_id = current_user.get("user_id")
        roles = current_user.get("roles", [])

        # Check permissions
        status = request.get("status")

        # For "files" folder - user samples - anyone can upload
        if folder == "files":
            if not self._can_edit_request(user_id, roles, request):
                raise AuthError("You do not have permission to upload files", 403)

        # For "buckets" folder - admin uploads after acceptance
        elif folder == "buckets":
            if not any(r in roles for r in EDITORS):
                raise AuthError("Only admins can upload bucket files", 403)

            if status not in [
                ScenarioRequestStatusTypes.ACCEPTED.value,
                ScenarioRequestStatusTypes.DEPLOYED.value,
                ScenarioRequestStatusTypes.FILES.value,
                ScenarioRequestStatusTypes.ACTIVE.value
            ]:
                raise AuthError("Bucket files can only be uploaded after acceptance", 400)

        # Upload file
        file_info = await self.file_storage.upload_file(
            request_id=request_id,
            file_name=file_name,
            file_content=file_content,
            folder=folder,
            uploaded_by=user_id
        )

        if not file_info:
            raise AuthError("Failed to upload file", 500)

        # Add comment if provided (for bucket files)
        if comment and folder == "buckets":
            file_info["comment"] = comment

        # Add to appropriate array
        array_field = "files" if folder == "files" else "buckets"
        await self.db.scenario_requests.update_one(
            {"requestId": request_id},
            {
                "$push": {array_field: file_info},
                "$set": {"row_update_stp": datetime.now(timezone.utc).isoformat()}
            }
        )

        # Update Jira
        updated = await self.db.scenario_requests.find_one({"requestId": request_id})
        if updated:
            updated["_id"] = str(updated["_id"])
            await self._update_jira_ticket(updated, "file_upload")

            # Try to attach file to Jira
            if self.jira_service and updated.get("jira", {}).get("ticket_key"):
                await self.jira_service.add_attachment(
                    updated["jira"]["ticket_key"],
                    file_content,
                    file_name
                )

        return file_info

    async def get_file_preview(
        self,
        request_id: str,
        file_path: str,
        current_user: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Get file content for preview"""
        if not self.file_storage:
            raise AuthError("File storage not configured", 500)
        
        # Get request to verify access
        request = await self.db.scenario_requests.find_one({"requestId": request_id})
        if not request:
            raise AuthError("Scenario request not found", 404)
        
        # Find file info
        file_info = None
        for f in request.get("files", []) + request.get("buckets", []):
            if f.get("gcs_path") == file_path:
                file_info = f
                break
        
        if not file_info:
            raise AuthError("File not found", 404)
        
        # Get preview
        preview = await self.file_storage.get_file_content_for_preview(
            file_path,
            file_info.get("file_type", "other")
        )
        
        return preview or {"type": "error", "message": "Preview not available"}

    async def download_file(
        self,
        request_id: str,
        file_path: str,
        current_user: Dict[str, Any]
    ) -> Optional[tuple]:
        """Download a file"""
        if not self.file_storage:
            raise AuthError("File storage not configured", 500)
        
        # Get request to verify access
        request = await self.db.scenario_requests.find_one({"requestId": request_id})
        if not request:
            raise AuthError("Scenario request not found", 404)
        
        return await self.file_storage.download_file(file_path)

    async def get(self, request_id: str) -> Dict[str, Any]:
        """Get scenario request by requestId"""
        if not request_id:
            raise AuthError("request_id is required", 400)

        result = await self.db.scenario_requests.find_one({"requestId": request_id})

        if not result:
            raise AuthError("Scenario not found", 404)

        result["_id"] = str(result["_id"])
        return result

    async def get_all(
        self,
        user_id: Optional[str] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Get all scenario requests with pagination"""
        query = {}
        if user_id is not None:
            query = {"user_id": user_id}
        
        limit = 25
        skip = 0
        page = 0
        total = None
        pages = []
        pagination = kwargs.get("pagination", {})
        
        if "limit" in pagination:
            limit = int(pagination["limit"]) if isinstance(pagination["limit"], str) else pagination["limit"]
        if "skip" in pagination:
            skip = int(pagination["skip"]) if isinstance(pagination["skip"], str) else pagination["skip"]
        if "page" in pagination:
            page = int(pagination["page"]) if isinstance(pagination["page"], str) else pagination["page"]
            skip = page * limit
        if "total" in pagination:
            total = int(pagination["total"]) if isinstance(pagination["total"], str) else pagination["total"]
        
        if total is None:
            total = await self.db.scenario_requests.count_documents(query)
            if total > 0:
                pages = distribute_limit(limit=total)
            else:
                pages = [limit]
        
        next_pagination = {
            **pagination,
            "page": page + 1,
            "skip": skip,
            "limit": limit,
            "total": total,
            "current": page,
            "pages": pages
        }
        
        cursor = self.db.scenario_requests.find(query).sort([
            ("row_update_stp", -1),
            ("requestId", -1)
        ]).skip(skip).limit(limit)
        
        result = await cursor.to_list(length=limit)
        
        # Convert ObjectIds to strings
        for r in result:
            r["_id"] = str(r["_id"])
        
        return {"data": result, "pagination": next_pagination}

    async def search_users(
        self,
        search_term: str,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Search users for autocomplete"""
        return await self._get_users_for_autocomplete(search_term, limit)

    async def get_domains(self) -> List[Dict[str, Any]]:
        """Get all active domains for dropdown"""
        cursor = self.db.easylife_domain.find(
            {"status": "A"},
            {"_id": 0, "key": 1, "name": 1}
        ).sort("order", 1)
        
        return await cursor.to_list(length=100)

    async def get_user_by_id(self, email: str) -> Optional[Dict[str, Any]]:
        """Get user by email"""
        try:
            user = await self.db.users.find_one({"email": email})
            if user:
                user["_id"] = str(user["_id"])
                user.pop("password_hash", None)
                return user
            return None
        except Exception:
            return None
