/**
 * Validate registration request payload
 * Ensures all required fields are provided and valid
 */

var contentType = context.getVariable("request.header.Content-Type");
var requestBody = context.getVariable("request.content");

// Check content type
if (!contentType || contentType.indexOf("application/json") === -1) {
    context.setVariable("validation.error", true);
    context.setVariable("validation.errorMessage", "Content-Type must be application/json");
    context.setVariable("validation.errorCode", "INVALID_CONTENT_TYPE");
    throw new Error("Invalid Content-Type");
}

try {
    var payload = JSON.parse(requestBody);
    var errors = [];

    // Validate email
    if (!payload.email) {
        errors.push("Email is required");
    } else {
        var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(payload.email)) {
            errors.push("Invalid email format");
        }
    }

    // Validate username
    if (!payload.username) {
        errors.push("Username is required");
    } else if (payload.username.length < 3) {
        errors.push("Username must be at least 3 characters");
    } else if (!/^[a-zA-Z0-9_]+$/.test(payload.username)) {
        errors.push("Username can only contain letters, numbers, and underscores");
    }

    // Validate full_name
    if (!payload.full_name) {
        errors.push("Full name is required");
    } else if (payload.full_name.length < 2) {
        errors.push("Full name must be at least 2 characters");
    }

    // Validate password
    if (!payload.password) {
        errors.push("Password is required");
    } else if (payload.password.length < 8) {
        errors.push("Password must be at least 8 characters");
    }

    // Check for validation errors
    if (errors.length > 0) {
        context.setVariable("validation.error", true);
        context.setVariable("validation.errorMessage", errors.join(", "));
        context.setVariable("validation.errorCode", "VALIDATION_ERROR");
        throw new Error(errors.join(", "));
    }

    // Set validated data for logging
    context.setVariable("register.email", payload.email);
    context.setVariable("register.username", payload.username);

} catch (e) {
    if (!context.getVariable("validation.error")) {
        context.setVariable("validation.error", true);
        context.setVariable("validation.errorMessage", "Invalid JSON payload");
        context.setVariable("validation.errorCode", "INVALID_JSON");
    }
    throw e;
}
