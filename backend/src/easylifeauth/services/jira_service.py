"""Jira Integration Service using official jira library"""
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone, timedelta
import asyncio
from concurrent.futures import ThreadPoolExecutor
import io

from jira import JIRA
from jira.exceptions import JIRAError

from ..errors.auth_error import AuthError


# Mapping from scenario request status to Jira status names
# These should match the Jira workflow statuses in your project
STATUS_TO_JIRA = {
    "submitted": "To Do",
    "review": "In Review",
    "rejected": "Rejected",
    "accepted": "Accepted",
    "in-progress": "In Progress",
    "development": "In Development",
    "testing": "Testing",
    "deployed": "Deployed",
    "snapshot": "Snapshot",
    "active": "Done",
    "inactive": "Inactive"
}

# Default target days from creation
DEFAULT_TARGET_DAYS = 7


class JiraService:
    """Jira Integration Service using official jira-python library"""

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.enabled = False
        self.base_url = None
        self.email = None
        self.api_token = None
        self.project_key = None
        self.issue_type = "Task"
        self.default_team = None
        self.default_assignee = None
        self.default_assignee_name = None
        self._client: Optional[JIRA] = None
        self._client_initialized = False
        self._executor = ThreadPoolExecutor(max_workers=3)

        if config:
            self.base_url = config.get("base_url")
            self.email = config.get("email")
            self.api_token = config.get("api_token")
            self.project_key = config.get("project_key", "SCEN")
            self.issue_type = config.get("issue_type", "Task")
            self.default_team = config.get("default_team")
            self.default_assignee = config.get("default_assignee")
            self.default_assignee_name = config.get("default_assignee_name")
            self.target_days = config.get("target_days", DEFAULT_TARGET_DAYS)

            if self.base_url and self.email and self.api_token:
                self.enabled = True
                # Don't initialize client here - do it lazily on first use

    def _get_client(self) -> Optional[JIRA]:
        """Get or initialize Jira client lazily"""
        if not self.enabled:
            return None

        if not self._client_initialized:
            self._init_client()
            self._client_initialized = True

        return self._client

    def _init_client(self):
        """Initialize Jira client"""
        try:
            # Set timeout options to prevent hanging on invalid credentials
            self._client = JIRA(
                server=self.base_url,
                basic_auth=(self.email, self.api_token),
                options={
                    'verify': True,
                    'timeout': 10  # 10 second timeout
                }
            )
            print(f"✓ Jira client connected to {self.base_url}")
        except JIRAError as e:
            print(f"Failed to initialize Jira client: {e}")
            self.enabled = False
            self._client = None
        except Exception as e:
            print(f"Failed to initialize Jira client: {e}")
            self.enabled = False
            self._client = None

    async def _run_sync(self, func, *args, **kwargs):
        """Run synchronous Jira library calls in thread pool"""
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(self._executor, lambda: func(*args, **kwargs))

    async def test_connection(self) -> Dict[str, Any]:
        """Test Jira connection"""
        client = self._get_client()
        if not self.enabled or not client:
            return {"connected": False, "error": "Jira not configured"}

        try:
            myself = await self._run_sync(client.myself)
            return {
                "connected": True,
                "user": myself.get("displayName"),
                "email": myself.get("emailAddress")
            }
        except JIRAError as e:
            return {"connected": False, "error": str(e)}

    async def get_projects(self, user_email: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get list of projects accessible to user"""
        client = self._get_client()
        if not self.enabled or not client:
            return []

        try:
            projects = await self._run_sync(client.projects)
            result = []
            for project in projects:
                result.append({
                    "id": project.id,
                    "key": project.key,
                    "name": project.name,
                    "project_type": getattr(project, 'projectTypeKey', 'software')
                })
            return result
        except JIRAError as e:
            print(f"Error fetching projects: {e}")
            return []

    async def get_latest_project(self) -> Optional[Dict[str, Any]]:
        """Get the most recently created project"""
        projects = await self.get_projects()
        if projects:
            return projects[0]
        return None

    async def get_user_tasks(
        self,
        user_email: str,
        project_key: Optional[str] = None,
        status: Optional[str] = None,
        max_results: int = 50
    ) -> List[Dict[str, Any]]:
        """Get tasks created by or assigned to user"""
        client = self._get_client()
        if not self.enabled or not client:
            return []

        try:
            # Build JQL query
            jql_parts = [f'(reporter = "{user_email}" OR assignee = "{user_email}")']

            if project_key:
                jql_parts.append(f'project = "{project_key}"')

            if status:
                jql_parts.append(f'status = "{status}"')

            jql = " AND ".join(jql_parts)
            jql += " ORDER BY created DESC"

            issues = await self._run_sync(
                client.search_issues,
                jql,
                maxResults=max_results
            )

            result = []
            for issue in issues:
                result.append({
                    "id": issue.id,
                    "key": issue.key,
                    "summary": issue.fields.summary,
                    "status": issue.fields.status.name,
                    "issue_type": issue.fields.issuetype.name,
                    "priority": getattr(issue.fields.priority, 'name', 'Medium') if issue.fields.priority else 'Medium',
                    "created": str(issue.fields.created),
                    "updated": str(issue.fields.updated),
                    "reporter": issue.fields.reporter.displayName if issue.fields.reporter else None,
                    "assignee": issue.fields.assignee.displayName if issue.fields.assignee else None,
                    "url": f"{self.base_url}/browse/{issue.key}"
                })

            return result
        except JIRAError as e:
            print(f"Error fetching user tasks: {e}")
            return []

    async def get_tasks_by_request_id(
        self,
        request_id: str,
        project_key: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get tasks linked to a scenario request ID"""
        client = self._get_client()
        if not self.enabled or not client:
            return []

        try:
            jql_parts = [f'summary ~ "{request_id}"']

            if project_key:
                jql_parts.append(f'project = "{project_key}"')

            jql = " AND ".join(jql_parts)

            issues = await self._run_sync(
                client.search_issues,
                jql,
                maxResults=10
            )

            result = []
            for issue in issues:
                result.append({
                    "id": issue.id,
                    "key": issue.key,
                    "summary": issue.fields.summary,
                    "status": issue.fields.status.name,
                    "url": f"{self.base_url}/browse/{issue.key}"
                })

            return result
        except JIRAError as e:
            print(f"Error fetching tasks by request ID: {e}")
            return []

    async def create_ticket(
        self,
        scenario_request: Dict[str, Any],
        project_key: Optional[str] = None,
        file_storage_service=None,
        target_days: Optional[int] = None
    ) -> Optional[Dict[str, Any]]:
        """Create a Jira ticket for a scenario request

        Args:
            scenario_request: The scenario request data
            project_key: Override project key
            file_storage_service: File storage service for attachments
            target_days: Days from creation for target/due date (defaults to 7)
        """
        client = self._get_client()
        if not self.enabled or not client:
            return None

        try:
            # Use provided project_key or configured one, or get latest project
            target_project = project_key or self.project_key

            if not target_project:
                latest = await self.get_latest_project()
                if latest:
                    target_project = latest["key"]
                else:
                    return {"sync_status": "failed", "error": "No project available"}

            # Build description from scenario request
            description = self._build_description(scenario_request)

            # Create issue - use name as the title/summary
            request_name = scenario_request.get('name', 'New Scenario Request')
            request_id = scenario_request.get('requestId', '')

            # Calculate start date (creation date) and due date (target date)
            creation_date = scenario_request.get('row_add_stp')
            if creation_date:
                if isinstance(creation_date, str):
                    try:
                        start_date = datetime.fromisoformat(creation_date.replace('Z', '+00:00'))
                    except ValueError:
                        start_date = datetime.now(timezone.utc)
                else:
                    start_date = creation_date
            else:
                start_date = datetime.now(timezone.utc)

            # Target/due date: target_days from start date
            days = target_days or self.target_days or DEFAULT_TARGET_DAYS
            due_date = start_date + timedelta(days=days)

            issue_dict = {
                "project": {"key": target_project},
                "summary": f"[{request_id}] {request_name}",
                "description": description,
                "issuetype": {"name": self.issue_type},
                "labels": [
                    "scenario-request",
                    scenario_request.get("dataDomain", "unknown").replace(" ", "-").lower(),
                    scenario_request.get("requestType", "scenario").replace(" ", "-").lower()
                ],
                # Set due date (duedate field)
                "duedate": due_date.strftime("%Y-%m-%d")
            }

            new_issue = await self._run_sync(client.create_issue, fields=issue_dict)

            # Try to set start date if the field exists (custom field varies by Jira instance)
            try:
                # Common custom field names for start date
                await self._set_start_date(new_issue.key, start_date)
            except Exception as e:
                print(f"Could not set start date (field may not exist): {e}")
            ticket_key = new_issue.key

            # Add comments if any exist
            comments = scenario_request.get('comments', [])
            for comment in comments:
                if isinstance(comment, dict) and comment.get('comment'):
                    comment_text = self._strip_html(comment.get('comment', ''))
                    username = comment.get('username', 'Unknown')
                    comment_date = comment.get('commentDate', '')
                    formatted_comment = f"*Comment by {username}* ({comment_date}):\n{comment_text}"
                    try:
                        await self._run_sync(client.add_comment, ticket_key, formatted_comment)
                    except Exception as e:
                        print(f"Failed to add comment to Jira: {e}")

            # Attach files if any exist and file_storage_service is provided
            files = scenario_request.get('files', [])
            if files and file_storage_service:
                for file_info in files:
                    if isinstance(file_info, dict) and file_info.get('gcs_path'):
                        try:
                            # Download file from storage - returns (bytes, filename) tuple
                            download_result = await file_storage_service.download_file(file_info['gcs_path'])
                            if download_result:
                                file_content, downloaded_name = download_result
                                # Prefer file name from file_info, fallback to downloaded name
                                file_name = file_info.get('file_name') or file_info.get('name') or downloaded_name or 'attachment'
                                await self.add_attachment(ticket_key, file_content, file_name)
                        except Exception as e:
                            print(f"Failed to attach file to Jira: {e}")

            return {
                "ticket_id": new_issue.id,
                "ticket_key": ticket_key,
                "ticket_url": f"{self.base_url}/browse/{ticket_key}",
                "project_key": target_project,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "last_synced": datetime.now(timezone.utc).isoformat(),
                "sync_status": "synced"
            }
        except JIRAError as e:
            print(f"Jira create ticket error: {e}")
            return {
                "sync_status": "failed",
                "error": str(e)
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
        """Update a Jira ticket with a comment"""
        client = self._get_client()
        if not self.enabled or not client or not ticket_key:
            return None

        try:
            # Build comment based on update type
            comment = self._build_update_comment(scenario_request, update_type)

            # Add comment to ticket
            await self._run_sync(
                client.add_comment,
                ticket_key,
                comment
            )

            return {
                "last_synced": datetime.now(timezone.utc).isoformat(),
                "sync_status": "synced"
            }
        except JIRAError as e:
            print(f"Jira update ticket error: {e}")
            return {
                "sync_status": "failed",
                "error": str(e)
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
        client = self._get_client()
        if not self.enabled or not client or not ticket_key:
            return None

        try:
            # Create file-like object from bytes
            file_obj = io.BytesIO(file_content)
            file_obj.name = file_name

            attachment = await self._run_sync(
                client.add_attachment,
                issue=ticket_key,
                attachment=file_obj,
                filename=file_name
            )

            return {
                "attachment_id": attachment.id if hasattr(attachment, 'id') else None,
                "filename": file_name,
                "uploaded_at": datetime.now(timezone.utc).isoformat()
            }
        except JIRAError as e:
            print(f"Jira add attachment error: {e}")
            return None
        except Exception as e:
            print(f"Jira add attachment error: {e}")
            return None

    async def add_attachment_from_url(
        self,
        ticket_key: str,
        file_url: str,
        file_name: str,
        gcs_client=None
    ) -> Optional[Dict[str, Any]]:
        """Add attachment from URL (supports GCS URLs)"""
        client = self._get_client()
        if not self.enabled or not client or not ticket_key:
            return None

        try:
            # If GCS URL and client provided, download from GCS
            if file_url.startswith("gs://") and gcs_client:
                # Parse GCS URL: gs://bucket-name/path/to/file
                parts = file_url[5:].split("/", 1)
                bucket_name = parts[0]
                blob_name = parts[1] if len(parts) > 1 else ""

                bucket = gcs_client.bucket(bucket_name)
                blob = bucket.blob(blob_name)
                file_content = blob.download_as_bytes()
            elif file_url.startswith("http"):
                import aiohttp
                async with aiohttp.ClientSession() as session:
                    async with session.get(file_url) as response:
                        if response.status == 200:
                            file_content = await response.read()
                        else:
                            return None
            else:
                return None

            return await self.add_attachment(ticket_key, file_content, file_name)
        except Exception as e:
            print(f"Error adding attachment from URL: {e}")
            return None

    async def transition_ticket(
        self,
        ticket_key: str,
        status: str
    ) -> Optional[Dict[str, Any]]:
        """Transition Jira ticket to new status"""
        client = self._get_client()
        if not self.enabled or not client or not ticket_key:
            return None

        try:
            # Get available transitions
            transitions = await self._run_sync(client.transitions, ticket_key)

            # Find matching transition
            transition_id = None
            for t in transitions:
                if t['name'].lower() == status.lower():
                    transition_id = t['id']
                    break

            if not transition_id:
                return {"sync_status": "failed", "error": f"Transition '{status}' not found"}

            # Perform transition
            await self._run_sync(
                client.transition_issue,
                ticket_key,
                transition_id
            )

            return {
                "last_synced": datetime.now(timezone.utc).isoformat(),
                "sync_status": "synced"
            }
        except JIRAError as e:
            print(f"Jira transition error: {e}")
            return {"sync_status": "failed", "error": str(e)}
        except Exception as e:
            print(f"Jira transition error: {e}")
            return {"sync_status": "failed", "error": str(e)}

    async def get_issue_types(self, project_key: Optional[str] = None) -> List[Dict[str, str]]:
        """Get available issue types for a project"""
        client = self._get_client()
        if not self.enabled or not client:
            return []

        try:
            if project_key:
                project = await self._run_sync(client.project, project_key)
                issue_types = project.issueTypes
            else:
                issue_types = await self._run_sync(client.issue_types)

            return [
                {"id": it.id, "name": it.name, "description": getattr(it, 'description', '')}
                for it in issue_types
            ]
        except JIRAError as e:
            print(f"Error fetching issue types: {e}")
            return []

    async def get_statuses(self, project_key: Optional[str] = None) -> List[Dict[str, str]]:
        """Get available statuses for a project"""
        client = self._get_client()
        if not self.enabled or not client:
            return []

        try:
            if project_key:
                statuses = await self._run_sync(client.statuses)
            else:
                statuses = await self._run_sync(client.statuses)

            return [
                {"id": s.id, "name": s.name, "category": getattr(s.statusCategory, 'name', 'Unknown')}
                for s in statuses
            ]
        except JIRAError as e:
            print(f"Error fetching statuses: {e}")
            return []

    def _build_description(self, scenario_request: Dict[str, Any]) -> str:
        """Build Jira description from scenario request"""
        # Strip HTML tags for cleaner Jira display
        description_text = self._strip_html(scenario_request.get('description', 'No description provided'))

        parts = [
            f"*Request ID:* {scenario_request.get('requestId', 'N/A')}",
            f"*Type:* {scenario_request.get('requestType', 'N/A')}",
            f"*Domain:* {scenario_request.get('dataDomain', 'N/A')}",
            f"*Status:* {scenario_request.get('status', 'N/A')}",
            "",
            "*Description:*",
            description_text,
        ]

        # Add business reason/justification if provided
        reason = scenario_request.get('reason')
        if reason:
            reason_text = self._strip_html(reason)
            parts.extend([
                "",
                "*Business Justification:*",
                reason_text
            ])

        # Add steps if provided
        steps = scenario_request.get('steps', [])
        if steps:
            parts.append("")
            parts.append("*Implementation Steps:*")
            for i, step in enumerate(steps, 1):
                if isinstance(step, dict):
                    step_desc = self._strip_html(step.get('description', 'No description'))
                    parts.append(f"# {step_desc}")
                    if step.get('database'):
                        parts.append(f"   - Database: {step['database']}")
                    if step.get('table'):
                        parts.append(f"   - Table: {step['table']}")
                    if step.get('query'):
                        query = step['query']
                        if isinstance(query, list):
                            query = '\n'.join(query)
                        parts.append(f"   - Query: {{code}}{query}{{code}}")

        # Add requester info
        parts.extend([
            "",
            "----",
            f"*Requested by:* {scenario_request.get('email', 'N/A')}",
            f"*Created:* {scenario_request.get('row_add_stp', 'N/A')}"
        ])

        return "\n".join(parts)

    def _strip_html(self, html_text: str) -> str:
        """Strip HTML tags from text for cleaner Jira display"""
        if not html_text:
            return ""
        import re
        # Remove HTML tags
        clean = re.sub(r'<[^>]+>', '', html_text)
        # Convert common HTML entities
        clean = clean.replace('&nbsp;', ' ')
        clean = clean.replace('&amp;', '&')
        clean = clean.replace('&lt;', '<')
        clean = clean.replace('&gt;', '>')
        clean = clean.replace('&quot;', '"')
        # Clean up whitespace
        clean = re.sub(r'\s+', ' ', clean).strip()
        return clean

    def _build_update_comment(self, scenario_request: Dict[str, Any], update_type: str) -> str:
        """Build update comment for Jira"""
        now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

        if update_type == "status_change":
            return f"*Status changed to:* {scenario_request.get('status', 'N/A')} at {now}"
        elif update_type == "comment":
            comments = scenario_request.get('comments', [])
            if comments:
                latest = comments[-1] if isinstance(comments, list) else comments
                if isinstance(latest, dict):
                    return f"*New comment by {latest.get('username', 'Unknown')}:*\n{latest.get('comment', '')}"
            return f"Comment added at {now}"
        elif update_type == "workflow":
            work_flow = scenario_request.get('work_flow', [])
            if work_flow:
                latest = work_flow[-1] if isinstance(work_flow, list) else work_flow
                if isinstance(latest, dict):
                    return f"*Workflow updated:* Assigned to {latest.get('assigned_to_name', 'Unknown')} by {latest.get('assigned_by_name', 'Unknown')}"
            return f"Workflow updated at {now}"
        elif update_type == "file_upload":
            return f"*New file uploaded at {now}*"
        else:
            return f"Request updated at {now}"

    async def _set_start_date(self, ticket_key: str, start_date: datetime) -> bool:
        """Try to set start date on a Jira issue

        Note: Start date is often a custom field. This method tries common field names.
        """
        client = self._get_client()
        if not client:
            return False

        try:
            issue = await self._run_sync(client.issue, ticket_key)
            start_date_str = start_date.strftime("%Y-%m-%d")

            # Try to find the start date field - common custom field IDs
            # This varies by Jira instance
            fields_to_try = [
                "customfield_10015",  # Common for Jira Software
                "customfield_10016",
                "customfield_10024",  # Start date in some instances
            ]

            for field_id in fields_to_try:
                try:
                    await self._run_sync(
                        issue.update,
                        fields={field_id: start_date_str}
                    )
                    print(f"Set start date using field {field_id}")
                    return True
                except Exception:
                    continue

            return False
        except Exception as e:
            print(f"Error setting start date: {e}")
            return False

    async def update_due_date(
        self,
        ticket_key: str,
        due_date: datetime
    ) -> Optional[Dict[str, Any]]:
        """Update the due date of a Jira ticket"""
        client = self._get_client()
        if not self.enabled or not client or not ticket_key:
            return None

        try:
            issue = await self._run_sync(client.issue, ticket_key)
            due_date_str = due_date.strftime("%Y-%m-%d")

            await self._run_sync(
                issue.update,
                fields={"duedate": due_date_str}
            )

            return {
                "last_synced": datetime.now(timezone.utc).isoformat(),
                "sync_status": "synced",
                "due_date": due_date_str
            }
        except JIRAError as e:
            print(f"Jira update due date error: {e}")
            return {"sync_status": "failed", "error": str(e)}
        except Exception as e:
            print(f"Jira update due date error: {e}")
            return {"sync_status": "failed", "error": str(e)}

    async def update_description(
        self,
        ticket_key: str,
        scenario_request: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Update the description of a Jira ticket based on scenario request changes"""
        client = self._get_client()
        if not self.enabled or not client or not ticket_key:
            return None

        try:
            issue = await self._run_sync(client.issue, ticket_key)

            # Rebuild full description from current scenario request
            new_description = self._build_description(scenario_request)

            # Update summary (title) if name changed
            request_name = scenario_request.get('name', 'Scenario Request')
            request_id = scenario_request.get('requestId', '')
            new_summary = f"[{request_id}] {request_name}"

            await self._run_sync(
                issue.update,
                fields={
                    "summary": new_summary,
                    "description": new_description
                }
            )

            return {
                "last_synced": datetime.now(timezone.utc).isoformat(),
                "sync_status": "synced"
            }
        except JIRAError as e:
            print(f"Jira update description error: {e}")
            return {"sync_status": "failed", "error": str(e)}
        except Exception as e:
            print(f"Jira update description error: {e}")
            return {"sync_status": "failed", "error": str(e)}

    async def add_comment(
        self,
        ticket_key: str,
        comment_text: str,
        author_name: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Add a comment to a Jira ticket"""
        client = self._get_client()
        if not self.enabled or not client or not ticket_key:
            return None

        try:
            # Format comment with author if provided
            if author_name:
                formatted_comment = f"*Comment by {author_name}:*\n{comment_text}"
            else:
                formatted_comment = comment_text

            await self._run_sync(
                client.add_comment,
                ticket_key,
                formatted_comment
            )

            return {
                "last_synced": datetime.now(timezone.utc).isoformat(),
                "sync_status": "synced"
            }
        except JIRAError as e:
            print(f"Jira add comment error: {e}")
            return {"sync_status": "failed", "error": str(e)}
        except Exception as e:
            print(f"Jira add comment error: {e}")
            return {"sync_status": "failed", "error": str(e)}

    async def sync_status_change(
        self,
        ticket_key: str,
        new_status: str,
        comment: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Sync status change from scenario request to Jira ticket

        Maps scenario request status to Jira workflow status and transitions the ticket.
        """
        client = self._get_client()
        if not self.enabled or not client or not ticket_key:
            return None

        try:
            # Map scenario status to Jira status
            jira_status = STATUS_TO_JIRA.get(new_status, new_status)

            # Get available transitions
            transitions = await self._run_sync(client.transitions, ticket_key)

            # Find matching transition
            transition_id = None
            for t in transitions:
                # Check both exact match and case-insensitive match
                t_name = t['name']
                t_to_status = t.get('to', {}).get('name', '')

                if (t_name.lower() == jira_status.lower() or
                    t_to_status.lower() == jira_status.lower()):
                    transition_id = t['id']
                    break

            if not transition_id:
                # Try a partial match
                for t in transitions:
                    t_name = t['name'].lower()
                    t_to_status = t.get('to', {}).get('name', '').lower()
                    jira_status_lower = jira_status.lower()

                    if (jira_status_lower in t_name or
                        jira_status_lower in t_to_status or
                        t_name in jira_status_lower):
                        transition_id = t['id']
                        break

            if transition_id:
                # Perform transition
                await self._run_sync(
                    client.transition_issue,
                    ticket_key,
                    transition_id
                )

                # Add status change comment if provided
                if comment:
                    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
                    status_comment = f"*Status changed to {new_status}* at {now}\n\n{comment}"
                    await self._run_sync(
                        client.add_comment,
                        ticket_key,
                        status_comment
                    )

                return {
                    "last_synced": datetime.now(timezone.utc).isoformat(),
                    "sync_status": "synced",
                    "jira_status": jira_status
                }
            else:
                # No matching transition - just add comment
                now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
                status_comment = f"*Status changed to {new_status}* at {now}"
                if comment:
                    status_comment += f"\n\n{comment}"
                status_comment += f"\n\n(Note: No matching Jira transition found for '{jira_status}')"

                await self._run_sync(
                    client.add_comment,
                    ticket_key,
                    status_comment
                )

                return {
                    "last_synced": datetime.now(timezone.utc).isoformat(),
                    "sync_status": "partial",
                    "message": f"Status comment added, but no transition found for '{jira_status}'"
                }
        except JIRAError as e:
            print(f"Jira sync status error: {e}")
            return {"sync_status": "failed", "error": str(e)}
        except Exception as e:
            print(f"Jira sync status error: {e}")
            return {"sync_status": "failed", "error": str(e)}

    async def get_boards(self, project_key: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get Scrum/Kanban boards (teams) for a project"""
        client = self._get_client()
        if not self.enabled or not client:
            return []

        try:
            if project_key:
                boards = await self._run_sync(
                    client.boards,
                    projectKeyOrID=project_key
                )
            else:
                boards = await self._run_sync(client.boards)

            result = []
            for board in boards:
                result.append({
                    "id": board.id,
                    "name": board.name,
                    "type": getattr(board, 'type', 'scrum')
                })
            return result
        except JIRAError as e:
            print(f"Error fetching boards: {e}")
            return []
        except Exception as e:
            print(f"Error fetching boards: {e}")
            return []

    async def get_assignable_users(
        self,
        project_key: Optional[str] = None,
        query: Optional[str] = None,
        max_results: int = 50
    ) -> List[Dict[str, Any]]:
        """Get users assignable to issues in a project"""
        client = self._get_client()
        if not self.enabled or not client:
            return []

        try:
            target_project = project_key or self.project_key
            if not target_project:
                return []

            users = await self._run_sync(
                client.search_assignable_users_for_projects,
                username=query or '',
                projectKeys=target_project,
                maxResults=max_results
            )

            result = []
            for user in users:
                account_id = getattr(user, 'accountId', None)
                display_name = getattr(user, 'displayName', '')
                email = getattr(user, 'emailAddress', '')
                active = getattr(user, 'active', True)
                if active:
                    result.append({
                        "accountId": account_id,
                        "displayName": display_name,
                        "emailAddress": email,
                        "avatarUrl": getattr(user, 'avatarUrls', {}).get('48x48', '') if hasattr(user, 'avatarUrls') else ''
                    })
            return result
        except JIRAError as e:
            print(f"Error fetching assignable users: {e}")
            return []
        except Exception as e:
            print(f"Error fetching assignable users: {e}")
            return []

    def close(self):
        """Close the thread pool executor"""
        self._executor.shutdown(wait=False)
