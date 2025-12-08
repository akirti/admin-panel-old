/**
 * Validate bulk upload request
 * Ensures file is provided and has valid format
 */

var contentType = context.getVariable("request.header.Content-Type");

// Check content type for multipart form data
if (!contentType || contentType.indexOf("multipart/form-data") === -1) {
    // Also allow application/octet-stream for file uploads
    if (contentType.indexOf("application/octet-stream") === -1) {
        context.setVariable("validation.error", true);
        context.setVariable("validation.errorMessage", "Content-Type must be multipart/form-data");
        context.setVariable("validation.errorCode", "INVALID_CONTENT_TYPE");
        throw new Error("Invalid Content-Type for file upload");
    }
}

// Check file size (max 10MB)
var contentLength = context.getVariable("request.header.Content-Length");
if (contentLength) {
    var maxSize = 10 * 1024 * 1024; // 10MB
    if (parseInt(contentLength) > maxSize) {
        context.setVariable("validation.error", true);
        context.setVariable("validation.errorMessage", "File size exceeds maximum limit of 10MB");
        context.setVariable("validation.errorCode", "FILE_TOO_LARGE");
        throw new Error("File too large");
    }
}

// Log bulk upload attempt
context.setVariable("bulkupload.timestamp", new Date().toISOString());
context.setVariable("bulkupload.contentLength", contentLength);
