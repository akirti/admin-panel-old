"""
Centralized file upload validation utility.

Validates file extension, MIME type, and magic bytes (file signature)
to prevent malicious file uploads.
"""
import os
from typing import Optional, Set
from fastapi import UploadFile, HTTPException, status


# File type definitions: extension -> {allowed MIME types, magic byte signatures}
ALLOWED_FILE_TYPES = {
    ".csv": {
        "mimes": {"text/csv", "application/csv", "text/plain", "application/vnd.ms-excel"},
        "magic": [],  # Text files have no magic bytes
    },
    ".xlsx": {
        "mimes": {"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/octet-stream"},
        "magic": [b"PK\x03\x04"],  # ZIP-based format
    },
    ".xls": {
        "mimes": {"application/vnd.ms-excel", "application/octet-stream"},
        "magic": [b"\xd0\xcf\x11\xe0"],  # OLE2 compound document
    },
    ".json": {
        "mimes": {"application/json", "text/plain"},
        "magic": [],  # Text files have no fixed magic bytes
    },
    ".pdf": {
        "mimes": {"application/pdf"},
        "magic": [b"%PDF"],
    },
    ".png": {
        "mimes": {"image/png"},
        "magic": [b"\x89PNG"],
    },
    ".jpg": {
        "mimes": {"image/jpeg"},
        "magic": [b"\xff\xd8\xff"],
    },
    ".jpeg": {
        "mimes": {"image/jpeg"},
        "magic": [b"\xff\xd8\xff"],
    },
}

# Maximum file size: 10MB
MAX_FILE_SIZE = 10 * 1024 * 1024


def validate_upload(
    file: UploadFile,
    allowed_extensions: Set[str],
    content: Optional[bytes] = None,
    max_size: int = MAX_FILE_SIZE,
) -> None:
    """
    Validate an uploaded file's extension, MIME type, and magic bytes.

    Args:
        file: The FastAPI UploadFile object.
        allowed_extensions: Set of allowed extensions (e.g., {".csv", ".xlsx"}).
        content: File content bytes (if already read). Used for magic byte check.
        max_size: Maximum file size in bytes.

    Raises:
        HTTPException: If validation fails.
    """
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Filename is required"
        )

    # 1. Validate extension
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type '{file_ext}'. Allowed: {', '.join(sorted(allowed_extensions))}"
        )

    # 2. Validate file size (if content provided)
    if content is not None and len(content) > max_size:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum size is {max_size // (1024 * 1024)}MB"
        )

    # 3. Validate MIME type
    file_type_info = ALLOWED_FILE_TYPES.get(file_ext)
    if file_type_info and file.content_type:
        if file.content_type not in file_type_info["mimes"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid MIME type '{file.content_type}' for {file_ext} file"
            )

    # 4. Validate magic bytes (file signature)
    if content is not None and file_type_info and file_type_info["magic"]:
        if not any(content.startswith(sig) for sig in file_type_info["magic"]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File content does not match expected {file_ext} format"
            )
