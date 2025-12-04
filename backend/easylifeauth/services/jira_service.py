"""Jira Integration Service"""
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone
import json
import aiohttp

from ..errors.auth_error import AuthError


class JiraService:
    """Async Jira Integration Service"""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.enabled = False
        self.base_url = None
        self.email = None
        self.api_token = None
        self.project_key = None
        self.issue_type = "Task"
        
        if config:
            self.base_url = config.get("base_url")
            self.email = config.get("email")
            self.api_token = config.get("api_token")
            self.project_key = config.get("project_key", "SCEN")
            self.issue_type = config.get("issue_type", "Task")
            
            if self.base_url and self.email and self.api_token:
                self.enabled = True
    
    def _get_auth(self) -> aiohttp.BasicAuth:
        """Get basic auth for Jira API"""
        return aiohttp.BasicAuth(self.email, self.api_token)
    
    def _get_headers(self) -> Dict[str, str]:
        """Get headers for Jira API"""
        return {
            "Accept": "application/json",
            "Content-Type": "application/json"
        }
    
    async def create_ticket(self, scenario_request: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Create a Jira ticket for a scenario request"""
        if not self.enabled:
            return None
        
        try:
            # Build description from scenario request
            description = self._build_description(scenario_request)
            
            # Create issue payload
            payload = {
                "fields": {
                    "project": {
                        "key": self.project_key
                    },
                    "summary": f"[{scenario_request.get('requestId')}] {scenario_request.get('name', 'New Scenario Request')}",
                    "description": {
                        "type": "doc",
                        "version": 1,
                        "content": [
                            {
                                "type": "paragraph",
                                "content": [
                                    {
                                        "type": "text",
                                        "text": description
                                    }
                                ]
                            }
                        ]
                    },
                    "issuetype": {
                        "name": self.issue_type
                    },
                    "labels": [
                        "scenario-request",
                        scenario_request.get("dataDomain", "unknown"),
                        scenario_request.get("requestType", "scenario").replace(" ", "-").lower()
                    ]
                }
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.base_url}/rest/api/3/issue",
                    auth=self._get_auth(),
                    headers=self._get_headers(),
                    json=payload
                ) as response:
                    if response.status == 201:
                        data = await response.json()
                        return {
                            "ticket_id": data.get("id"),
                            "ticket_key": data.get("key"),
                            "ticket_url": f"{self.base_url}/browse/{data.get('key')}",
                            "project_key": self.project_key,
                            "created_at": datetime.now(timezone.utc).isoformat(),
                            "last_synced": datetime.now(timezone.utc).isoformat(),
                            "sync_status": "synced"
                        }
                    else:
                        error_text = await response.text()
                        print(f"Jira create ticket failed: {response.status} - {error_text}")
                        return {
                            "sync_status": "failed",
                            "error": error_text
                        }
        except Exception as e:
            print(f"Jira create ticket error: {e}")
            return {
                "sync_status": "failed",
                "error": str(e)
            }
    
    async def update_ticket(
        self,
        ticket_key: str,
        scenario_request: Dict[str, Any],
        update_type: str = "general"
    ) -> Optional[Dict[str, Any]]:
        """Update a Jira ticket"""
        if not self.enabled or not ticket_key:
            return None
        
        try:
            # Build comment based on update type
            comment = self._build_update_comment(scenario_request, update_type)
            
            # Add comment to ticket
            payload = {
                "body": {
                    "type": "doc",
                    "version": 1,
                    "content": [
                        {
                            "type": "paragraph",
                            "content": [
                                {
                                    "type": "text",
                                    "text": comment
                                }
                            ]
                        }
                    ]
                }
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.base_url}/rest/api/3/issue/{ticket_key}/comment",
                    auth=self._get_auth(),
                    headers=self._get_headers(),
                    json=payload
                ) as response:
                    if response.status == 201:
                        return {
                            "last_synced": datetime.now(timezone.utc).isoformat(),
                            "sync_status": "synced"
                        }
                    else:
                        error_text = await response.text()
                        print(f"Jira update ticket failed: {response.status} - {error_text}")
                        return {
                            "sync_status": "failed",
                            "error": error_text
                        }
        except Exception as e:
            print(f"Jira update ticket error: {e}")
            return {
                "sync_status": "failed",
                "error": str(e)
            }
    
    async def add_attachment(
        self,
        ticket_key: str,
        file_content: bytes,
        file_name: str
    ) -> Optional[Dict[str, Any]]:
        """Add attachment to Jira ticket"""
        if not self.enabled or not ticket_key:
            return None
        
        try:
            headers = {
                "Accept": "application/json",
                "X-Atlassian-Token": "no-check"
            }
            
            form_data = aiohttp.FormData()
            form_data.add_field(
                'file',
                file_content,
                filename=file_name,
                content_type='application/octet-stream'
            )
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.base_url}/rest/api/3/issue/{ticket_key}/attachments",
                    auth=self._get_auth(),
                    headers=headers,
                    data=form_data
                ) as response:
                    if response.status == 200:
                        return await response.json()
                    else:
                        error_text = await response.text()
                        print(f"Jira add attachment failed: {response.status} - {error_text}")
                        return None
        except Exception as e:
            print(f"Jira add attachment error: {e}")
            return None
    
    async def transition_ticket(
        self,
        ticket_key: str,
        status: str
    ) -> Optional[Dict[str, Any]]:
        """Transition Jira ticket to new status"""
        if not self.enabled or not ticket_key:
            return None
        
        try:
            # First get available transitions
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.base_url}/rest/api/3/issue/{ticket_key}/transitions",
                    auth=self._get_auth(),
                    headers=self._get_headers()
                ) as response:
                    if response.status != 200:
                        return None
                    
                    transitions_data = await response.json()
                    transitions = transitions_data.get("transitions", [])
                    
                    # Find matching transition
                    transition_id = None
                    for t in transitions:
                        if t.get("name", "").lower() == status.lower():
                            transition_id = t.get("id")
                            break
                    
                    if not transition_id:
                        return None
                
                # Perform transition
                payload = {
                    "transition": {
                        "id": transition_id
                    }
                }
                
                async with session.post(
                    f"{self.base_url}/rest/api/3/issue/{ticket_key}/transitions",
                    auth=self._get_auth(),
                    headers=self._get_headers(),
                    json=payload
                ) as response:
                    if response.status == 204:
                        return {
                            "last_synced": datetime.now(timezone.utc).isoformat(),
                            "sync_status": "synced"
                        }
                    return None
        except Exception as e:
            print(f"Jira transition error: {e}")
            return None
    
    def _build_description(self, scenario_request: Dict[str, Any]) -> str:
        """Build Jira description from scenario request"""
        parts = [
            f"Request ID: {scenario_request.get('requestId', 'N/A')}",
            f"Type: {scenario_request.get('requestType', 'N/A')}",
            f"Domain: {scenario_request.get('dataDomain', 'N/A')}",
            f"Status: {scenario_request.get('status', 'N/A')}",
            "",
            "Description:",
            scenario_request.get('description', 'No description provided'),
            "",
            f"Requested by: {scenario_request.get('email', 'N/A')}",
            f"Created: {scenario_request.get('row_add_stp', 'N/A')}"
        ]
        
        # Add steps if provided
        steps = scenario_request.get('steps', [])
        if steps:
            parts.append("")
            parts.append("Steps:")
            for i, step in enumerate(steps, 1):
                if isinstance(step, dict):
                    parts.append(f"  {i}. {step.get('description', 'No description')}")
        
        return "\n".join(parts)
    
    def _build_update_comment(self, scenario_request: Dict[str, Any], update_type: str) -> str:
        """Build update comment for Jira"""
        now = datetime.now(timezone.utc).isoformat()
        
        if update_type == "status_change":
            return f"Status changed to: {scenario_request.get('status', 'N/A')} at {now}"
        elif update_type == "comment":
            comments = scenario_request.get('comments', [])
            if comments:
                latest = comments[-1] if isinstance(comments, list) else comments
                if isinstance(latest, dict):
                    return f"New comment by {latest.get('username', 'Unknown')}: {latest.get('comment', '')}"
            return f"Comment added at {now}"
        elif update_type == "workflow":
            work_flow = scenario_request.get('work_flow', [])
            if work_flow:
                latest = work_flow[-1] if isinstance(work_flow, list) else work_flow
                if isinstance(latest, dict):
                    return f"Workflow updated: Assigned to {latest.get('assigned_to_name', 'Unknown')} by {latest.get('assigned_by_name', 'Unknown')}"
            return f"Workflow updated at {now}"
        elif update_type == "file_upload":
            return f"New file uploaded at {now}"
        else:
            return f"Request updated at {now}"
