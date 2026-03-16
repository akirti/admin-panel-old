"""Atlassian Lookup Service for team (board) and user search.

Uses atlassian-python-api for server-side search support that jira-python lacks.
This service is separate from JiraService and only handles board/user lookups.
"""
from typing import Dict, Any, Optional, List
import asyncio
from concurrent.futures import ThreadPoolExecutor


class AtlassianLookupService:
    """Lightweight Atlassian service for team (board) and user search.

    Uses atlassian-python-api for server-side search support.
    Kept separate from JiraService which uses jira-python for all other operations.
    """

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.enabled = False
        self.base_url = None
        self.jira_type = "cloud"
        self._client = None
        self._client_initialized = False
        self._executor = ThreadPoolExecutor(max_workers=2)

        if config:
            self.base_url = config.get("base_url")
            self.jira_type = config.get("jira_type", "cloud")
            self._username = config.get("email") or config.get("username")
            self._password = config.get("api_token") or config.get("password")

            if self.base_url and self._username and self._password:
                self.enabled = True

    def _get_client(self):
        """Get or initialize Atlassian Jira client lazily"""
        if not self.enabled:
            return None

        if not self._client_initialized:
            try:
                self._init_client()
            except Exception as e:
                print(f"Failed to initialize Atlassian lookup client: {e}")
                self.enabled = False
                self._client = None
            self._client_initialized = True

        return self._client

    def _init_client(self):
        """Initialize atlassian-python-api Jira client"""
        try:
            from atlassian import Jira

            is_cloud = self.jira_type == "cloud"
            self._client = Jira(
                url=self.base_url,
                username=self._username,
                password=self._password,
                cloud=is_cloud,
            )
            print(f"✓ Atlassian lookup client connected to {self.base_url} (type={self.jira_type})")
        except Exception as e:
            print(f"Failed to initialize Atlassian lookup client: {e}")
            self.enabled = False
            self._client = None

    async def _run_sync(self, func, *args, **kwargs):
        """Run synchronous calls in thread pool"""
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(self._executor, lambda: func(*args, **kwargs))

    async def search_boards(
        self,
        project_key: Optional[str] = None,
        search: Optional[str] = None,
        max_results: int = 50,
    ) -> List[Dict[str, Any]]:
        """Search boards by name using server-side filtering.

        Uses atlassian-python-api's board_name parameter for server-side search,
        which jira-python's client.boards() does not support.
        """
        client = self._get_client()
        if not self.enabled or not client:
            return []

        try:
            kwargs: Dict[str, Any] = {"maxResults": max_results}
            if project_key:
                kwargs["projectKeyOrID"] = project_key
            if search:
                kwargs["board_name"] = search

            data = await self._run_sync(client.get_all_boards, **kwargs)

            # atlassian-python-api returns dict with 'values' key
            boards_list = data.get("values", []) if isinstance(data, dict) else data

            return [
                {
                    "id": board.get("id"),
                    "name": board.get("name", ""),
                    "type": board.get("type", "scrum"),
                }
                for board in boards_list
            ]
        except Exception as e:
            print(f"Atlassian board search error: {e}")
            return []

    async def search_users(
        self,
        query: Optional[str] = None,
        max_results: int = 50,
    ) -> List[Dict[str, Any]]:
        """Search users by name/email.

        Cloud uses query= param, Server uses username= param.
        """
        client = self._get_client()
        if not self.enabled or not client:
            return []

        try:
            if self.jira_type == "cloud":
                users = await self._run_sync(
                    client.user_find_by_user_string,
                    query=query or "",
                    maxResults=max_results,
                )
            else:
                users = await self._run_sync(
                    client.user_find_by_user_string,
                    username=query or "",
                    maxResults=max_results,
                )

            if not isinstance(users, list):
                return []

            result = []
            for user in users:
                active = user.get("active", True)
                if active:
                    result.append({
                        "accountId": user.get("accountId") or user.get("key"),
                        "displayName": user.get("displayName", ""),
                        "emailAddress": user.get("emailAddress", ""),
                        "avatarUrl": (
                            user.get("avatarUrls", {}).get("48x48", "")
                            if isinstance(user.get("avatarUrls"), dict)
                            else ""
                        ),
                    })
            return result
        except Exception as e:
            print(f"Atlassian user search error: {e}")
            return []

    def close(self):
        """Close the thread pool executor"""
        self._executor.shutdown(wait=False)
