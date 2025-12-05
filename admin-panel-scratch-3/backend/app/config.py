"""
Configuration settings for the Admin Panel application.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional
import json
import os


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # MongoDB settings
    MONGODB_URL: str = "mongodb://localhost:27017"
    DATABASE_NAME: str = "admin_panel"
    
    # JWT settings
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Email settings
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    EMAIL_FROM: str = "admin@example.com"
    EMAIL_FROM_NAME: str = "Admin Panel"
    
    # GCS settings
    GCS_CREDENTIALS_JSON: str = "{}"
    GCS_BUCKET_NAME: str = "admin-panel-bucket"
    
    # Application settings
    APP_NAME: str = "Admin Panel API"
    DEBUG: bool = True
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )
    
    def get_gcs_credentials(self) -> dict:
        """Parse GCS credentials from JSON string."""
        try:
            creds = self.GCS_CREDENTIALS_JSON
            if not creds or creds == "{}":
                return {}
            # Handle escaped JSON strings
            if creds.startswith('"') and creds.endswith('"'):
                creds = creds[1:-1]
            # Handle escaped quotes
            creds = creds.replace('\\"', '"')
            return json.loads(creds)
        except json.JSONDecodeError as e:
            print(f"Failed to parse GCS credentials: {e}")
            print(f"Raw value: {self.GCS_CREDENTIALS_JSON[:100]}...")
            return {}


# Create settings instance
settings = Settings()

# Debug: Print loaded settings (remove in production)
if settings.DEBUG:
    print(f"Loaded settings:")
    print(f"  MONGODB_URL: {settings.MONGODB_URL}")
    print(f"  DATABASE_NAME: {settings.DATABASE_NAME}")
    print(f"  SMTP_HOST: {settings.SMTP_HOST}")
    print(f"  GCS_BUCKET_NAME: {settings.GCS_BUCKET_NAME}")
    print(f"  GCS_CREDENTIALS_JSON length: {len(settings.GCS_CREDENTIALS_JSON)}")
    gcs_creds = settings.get_gcs_credentials()
    print(f"  GCS credentials parsed: {'type' in gcs_creds}")
