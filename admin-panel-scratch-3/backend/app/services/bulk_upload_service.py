"""
Bulk upload service for processing CSV/Excel files.
"""
import pandas as pd
from io import BytesIO
from typing import List, Dict, Any, Tuple
from datetime import datetime
import logging
from app.database import get_database, COLLECTIONS
from app.auth import get_password_hash, generate_temp_password
from app.services.email_service import email_service
from app.models import BulkUploadResult

logger = logging.getLogger(__name__)


class BulkUploadService:
    """Service for handling bulk uploads."""

    SUPPORTED_FORMATS = [".csv", ".xlsx", ".xls"]

    # Field mappings for each entity type
    ENTITY_FIELDS = {
        "users": ["email", "username", "full_name", "roles", "groups", "customers", "is_active"],
        "roles": ["roleId", "name", "description", "permissions", "domains", "status", "priority", "type"],
        "groups": ["groupId", "name", "description", "permissions", "domains", "status", "priority", "type"],
        "permissions": ["key", "name", "description", "module", "actions"],
        "customers": ["customerId", "name", "description", "status"],
        "domains": ["key", "name", "description", "path", "dataDomain", "status", "defaultSelected", "order", "icon", "type"],
        "domain_scenarios": ["key", "name", "description", "path", "dataDomain", "status", "defaultSelected", "order", "icon", "type", "domainKey"],
    }

    # Required fields for each entity type
    REQUIRED_FIELDS = {
        "users": ["email"],
        "roles": ["roleId", "name"],
        "groups": ["groupId", "name"],
        "permissions": ["key", "name", "module"],
        "customers": ["customerId", "name"],
        "domains": ["key", "name"],
        "domain_scenarios": ["key", "name", "domainKey"],
    }
    
    def validate_columns(self, df: pd.DataFrame, entity_type: str) -> List[str]:
        """Validate that DataFrame has required columns."""
        required_fields = self.REQUIRED_FIELDS.get(entity_type, [])
        missing_fields = [field for field in required_fields if field not in df.columns]
        return missing_fields

    def parse_file(self, file_content: bytes, filename: str) -> pd.DataFrame:
        """Parse uploaded file into DataFrame."""
        file_ext = "." + filename.split(".")[-1].lower()

        if file_ext not in self.SUPPORTED_FORMATS:
            raise ValueError(f"Unsupported file format: {file_ext}")

        try:
            if file_ext == ".csv":
                df = pd.read_csv(BytesIO(file_content))
            else:
                df = pd.read_excel(BytesIO(file_content))

            # Remove completely empty rows
            df = df.dropna(how='all')

            # Strip whitespace from column names
            df.columns = df.columns.str.strip()

            return df
        except Exception as e:
            raise ValueError(f"Failed to parse file: {str(e)}")
    
    def _parse_list_field(self, value: Any) -> List[str]:
        """Parse a list field from string or list."""
        if pd.isna(value) or value == "":
            return []
        if isinstance(value, list):
            return value
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return []
    
    def _parse_bool_field(self, value: Any) -> bool:
        """Parse a boolean field."""
        if pd.isna(value):
            return True
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            return value.lower() in ["true", "1", "yes", "active"]
        return bool(value)
    
    def _parse_int_field(self, value: Any, default: int = 0) -> int:
        """Parse an integer field."""
        if pd.isna(value):
            return default
        try:
            return int(value)
        except (ValueError, TypeError):
            return default
    
    def _validate_email(self, email: str) -> bool:
        """Validate email format."""
        import re
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return bool(re.match(pattern, email))

    async def process_users(
        self,
        df: pd.DataFrame,
        send_password_emails: bool = True
    ) -> BulkUploadResult:
        """Process bulk user upload."""
        db = get_database()
        result = BulkUploadResult(total=len(df), successful=0, failed=0, errors=[])

        for idx, row in df.iterrows():
            row_num = idx + 2  # Excel row number (1-indexed + header)
            try:
                # Validate required fields
                email = str(row.get("email", "")).strip()
                if not email:
                    raise ValueError("Email is required")

                if not self._validate_email(email):
                    raise ValueError(f"Invalid email format: {email}")

                # Check if user exists
                existing = await db[COLLECTIONS["users"]].find_one({"email": email})

                temp_password = generate_temp_password()
                user_data = {
                    "email": email,
                    "username": str(row.get("username", email.split("@")[0])).strip(),
                    "full_name": str(row.get("full_name", "")).strip(),
                    "roles": self._parse_list_field(row.get("roles")),
                    "groups": self._parse_list_field(row.get("groups")),
                    "customers": self._parse_list_field(row.get("customers")),
                    "is_active": self._parse_bool_field(row.get("is_active", True)),
                    "updated_at": datetime.utcnow(),
                }

                # Validate username doesn't contain special characters
                if user_data["username"] and not user_data["username"].replace("_", "").replace("-", "").isalnum():
                    raise ValueError("Username can only contain letters, numbers, hyphens, and underscores")

                if existing:
                    # Update existing user
                    await db[COLLECTIONS["users"]].update_one(
                        {"email": email},
                        {"$set": user_data}
                    )
                    logger.info(f"Row {row_num}: Updated existing user {email}")
                else:
                    # Create new user
                    user_data["password_hash"] = get_password_hash(temp_password)
                    user_data["created_at"] = datetime.utcnow()
                    user_data["is_super_admin"] = False
                    user_data["last_login"] = None
                    await db[COLLECTIONS["users"]].insert_one(user_data)

                    # Send welcome email
                    if send_password_emails:
                        try:
                            await email_service.send_welcome_email(
                                email, user_data["full_name"], temp_password
                            )
                            logger.info(f"Row {row_num}: Created user {email} and sent welcome email")
                        except Exception as email_error:
                            logger.warning(f"Row {row_num}: Created user {email} but failed to send email: {email_error}")
                    else:
                        logger.info(f"Row {row_num}: Created user {email} without sending email")

                result.successful += 1
            except Exception as e:
                result.failed += 1
                error_msg = f"Row {row_num}: {str(e)}"
                result.errors.append({"row": row_num, "error": str(e), "email": row.get("email", "N/A")})
                logger.error(f"Failed to process user at {error_msg}")

        return result
    
    async def process_roles(self, df: pd.DataFrame) -> BulkUploadResult:
        """Process bulk role upload."""
        db = get_database()
        result = BulkUploadResult(total=len(df), successful=0, failed=0, errors=[])
        
        for idx, row in df.iterrows():
            try:
                role_id = str(row.get("roleId", "")).strip()
                if not role_id:
                    raise ValueError("roleId is required")
                
                existing = await db[COLLECTIONS["roles"]].find_one({"roleId": role_id})
                
                role_data = {
                    "roleId": role_id,
                    "name": str(row.get("name", "")).strip(),
                    "description": str(row.get("description", "")).strip() if pd.notna(row.get("description")) else None,
                    "permissions": self._parse_list_field(row.get("permissions")),
                    "domains": self._parse_list_field(row.get("domains")),
                    "status": str(row.get("status", "active")).lower(),
                    "priority": self._parse_int_field(row.get("priority")),
                    "type": str(row.get("type", "custom")).lower(),
                    "updated_at": datetime.utcnow(),
                }
                
                if existing:
                    await db[COLLECTIONS["roles"]].update_one(
                        {"roleId": role_id},
                        {"$set": role_data}
                    )
                else:
                    role_data["created_at"] = datetime.utcnow()
                    await db[COLLECTIONS["roles"]].insert_one(role_data)
                
                result.successful += 1
            except Exception as e:
                result.failed += 1
                result.errors.append({"row": idx + 2, "error": str(e)})
                logger.error(f"Failed to process role at row {idx + 2}: {e}")
        
        return result
    
    async def process_groups(self, df: pd.DataFrame) -> BulkUploadResult:
        """Process bulk group upload."""
        db = get_database()
        result = BulkUploadResult(total=len(df), successful=0, failed=0, errors=[])
        
        for idx, row in df.iterrows():
            try:
                group_id = str(row.get("groupId", "")).strip()
                if not group_id:
                    raise ValueError("groupId is required")
                
                existing = await db[COLLECTIONS["groups"]].find_one({"groupId": group_id})
                
                group_data = {
                    "groupId": group_id,
                    "name": str(row.get("name", "")).strip(),
                    "description": str(row.get("description", "")).strip() if pd.notna(row.get("description")) else None,
                    "permissions": self._parse_list_field(row.get("permissions")),
                    "domains": self._parse_list_field(row.get("domains")),
                    "status": str(row.get("status", "active")).lower(),
                    "priority": self._parse_int_field(row.get("priority")),
                    "type": str(row.get("type", "custom")).lower(),
                    "updated_at": datetime.utcnow(),
                }
                
                if existing:
                    await db[COLLECTIONS["groups"]].update_one(
                        {"groupId": group_id},
                        {"$set": group_data}
                    )
                else:
                    group_data["created_at"] = datetime.utcnow()
                    await db[COLLECTIONS["groups"]].insert_one(group_data)
                
                result.successful += 1
            except Exception as e:
                result.failed += 1
                result.errors.append({"row": idx + 2, "error": str(e)})
                logger.error(f"Failed to process group at row {idx + 2}: {e}")
        
        return result
    
    async def process_permissions(self, df: pd.DataFrame) -> BulkUploadResult:
        """Process bulk permission upload."""
        db = get_database()
        result = BulkUploadResult(total=len(df), successful=0, failed=0, errors=[])
        
        for idx, row in df.iterrows():
            try:
                key = str(row.get("key", "")).strip()
                if not key:
                    raise ValueError("key is required")
                
                existing = await db[COLLECTIONS["permissions"]].find_one({"key": key})
                
                perm_data = {
                    "key": key,
                    "name": str(row.get("name", "")).strip(),
                    "description": str(row.get("description", "")).strip() if pd.notna(row.get("description")) else None,
                    "module": str(row.get("module", "")).strip(),
                    "actions": self._parse_list_field(row.get("actions")),
                    "updated_at": datetime.utcnow(),
                }
                
                if existing:
                    await db[COLLECTIONS["permissions"]].update_one(
                        {"key": key},
                        {"$set": perm_data}
                    )
                else:
                    perm_data["created_at"] = datetime.utcnow()
                    await db[COLLECTIONS["permissions"]].insert_one(perm_data)
                
                result.successful += 1
            except Exception as e:
                result.failed += 1
                result.errors.append({"row": idx + 2, "error": str(e)})
                logger.error(f"Failed to process permission at row {idx + 2}: {e}")
        
        return result
    
    async def process_customers(self, df: pd.DataFrame) -> BulkUploadResult:
        """Process bulk customer upload."""
        db = get_database()
        result = BulkUploadResult(total=len(df), successful=0, failed=0, errors=[])
        
        for idx, row in df.iterrows():
            try:
                customer_id = str(row.get("customerId", "")).strip()
                if not customer_id:
                    raise ValueError("customerId is required")
                
                existing = await db[COLLECTIONS["customers"]].find_one({"customerId": customer_id})
                
                customer_data = {
                    "customerId": customer_id,
                    "name": str(row.get("name", "")).strip(),
                    "description": str(row.get("description", "")).strip() if pd.notna(row.get("description")) else None,
                    "status": str(row.get("status", "active")).lower(),
                    "settings": {},
                    "updated_at": datetime.utcnow(),
                }
                
                if existing:
                    await db[COLLECTIONS["customers"]].update_one(
                        {"customerId": customer_id},
                        {"$set": customer_data}
                    )
                else:
                    customer_data["created_at"] = datetime.utcnow()
                    await db[COLLECTIONS["customers"]].insert_one(customer_data)
                
                result.successful += 1
            except Exception as e:
                result.failed += 1
                result.errors.append({"row": idx + 2, "error": str(e)})
                logger.error(f"Failed to process customer at row {idx + 2}: {e}")
        
        return result
    
    async def process_domains(self, df: pd.DataFrame) -> BulkUploadResult:
        """Process bulk domain upload."""
        db = get_database()
        result = BulkUploadResult(total=len(df), successful=0, failed=0, errors=[])
        
        for idx, row in df.iterrows():
            try:
                key = str(row.get("key", "")).strip()
                if not key:
                    raise ValueError("key is required")
                
                existing = await db[COLLECTIONS["domains"]].find_one({"key": key})
                
                domain_data = {
                    "key": key,
                    "name": str(row.get("name", "")).strip(),
                    "description": str(row.get("description", "")).strip() if pd.notna(row.get("description")) else None,
                    "path": str(row.get("path", "")).strip(),
                    "dataDomain": str(row.get("dataDomain", "")).strip() if pd.notna(row.get("dataDomain")) else None,
                    "status": str(row.get("status", "active")).lower(),
                    "defaultSelected": self._parse_bool_field(row.get("defaultSelected", False)),
                    "order": self._parse_int_field(row.get("order")),
                    "icon": str(row.get("icon", "")).strip() if pd.notna(row.get("icon")) else None,
                    "type": str(row.get("type", "custom")).lower(),
                    "subDomains": [],
                    "updated_at": datetime.utcnow(),
                }
                
                if existing:
                    await db[COLLECTIONS["domains"]].update_one(
                        {"key": key},
                        {"$set": domain_data}
                    )
                else:
                    domain_data["created_at"] = datetime.utcnow()
                    await db[COLLECTIONS["domains"]].insert_one(domain_data)
                
                result.successful += 1
            except Exception as e:
                result.failed += 1
                result.errors.append({"row": idx + 2, "error": str(e)})
                logger.error(f"Failed to process domain at row {idx + 2}: {e}")
        
        return result
    
    async def process_domain_scenarios(self, df: pd.DataFrame) -> BulkUploadResult:
        """Process bulk domain scenario upload."""
        db = get_database()
        result = BulkUploadResult(total=len(df), successful=0, failed=0, errors=[])
        
        for idx, row in df.iterrows():
            try:
                key = str(row.get("key", "")).strip()
                if not key:
                    raise ValueError("key is required")
                
                existing = await db[COLLECTIONS["domain_scenarios"]].find_one({"key": key})
                
                scenario_data = {
                    "key": key,
                    "name": str(row.get("name", "")).strip(),
                    "description": str(row.get("description", "")).strip() if pd.notna(row.get("description")) else None,
                    "path": str(row.get("path", "")).strip(),
                    "dataDomain": str(row.get("dataDomain", "")).strip() if pd.notna(row.get("dataDomain")) else None,
                    "status": str(row.get("status", "active")).lower(),
                    "defaultSelected": self._parse_bool_field(row.get("defaultSelected", False)),
                    "order": self._parse_int_field(row.get("order")),
                    "icon": str(row.get("icon", "")).strip() if pd.notna(row.get("icon")) else None,
                    "type": str(row.get("type", "custom")).lower(),
                    "domainKey": str(row.get("domainKey", "")).strip(),
                    "subDomains": [],
                    "updated_at": datetime.utcnow(),
                }
                
                if existing:
                    await db[COLLECTIONS["domain_scenarios"]].update_one(
                        {"key": key},
                        {"$set": scenario_data}
                    )
                else:
                    scenario_data["created_at"] = datetime.utcnow()
                    await db[COLLECTIONS["domain_scenarios"]].insert_one(scenario_data)
                
                result.successful += 1
            except Exception as e:
                result.failed += 1
                result.errors.append({"row": idx + 2, "error": str(e)})
                logger.error(f"Failed to process domain scenario at row {idx + 2}: {e}")
        
        return result
    
    async def process_entity(
        self,
        entity_type: str,
        file_content: bytes,
        filename: str,
        send_password_emails: bool = True
    ) -> BulkUploadResult:
        """Process bulk upload for any entity type."""
        # Parse the file
        df = self.parse_file(file_content, filename)

        # Validate file is not empty
        if len(df) == 0:
            raise ValueError("File is empty or contains no valid data rows")

        # Validate required columns
        missing_fields = self.validate_columns(df, entity_type)
        if missing_fields:
            raise ValueError(f"Missing required columns: {', '.join(missing_fields)}")

        # Log file processing start
        logger.info(f"Starting bulk upload for {entity_type}: {len(df)} rows to process")

        processors = {
            "users": lambda df: self.process_users(df, send_password_emails),
            "roles": self.process_roles,
            "groups": self.process_groups,
            "permissions": self.process_permissions,
            "customers": self.process_customers,
            "domains": self.process_domains,
            "domain_scenarios": self.process_domain_scenarios,
        }

        if entity_type not in processors:
            raise ValueError(f"Unknown entity type: {entity_type}")

        result = await processors[entity_type](df)

        # Log completion
        logger.info(f"Bulk upload completed for {entity_type}: {result.successful} successful, {result.failed} failed")

        return result
    
    def get_template(self, entity_type: str) -> pd.DataFrame:
        """Get template DataFrame for an entity type."""
        if entity_type not in self.ENTITY_FIELDS:
            raise ValueError(f"Unknown entity type: {entity_type}")
        
        return pd.DataFrame(columns=self.ENTITY_FIELDS[entity_type])


# Global bulk upload service instance
bulk_upload_service = BulkUploadService()
