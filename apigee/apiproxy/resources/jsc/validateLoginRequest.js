/**
 * Validate login request payload
 * Ensures email and password are provided and valid
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

    // Validate email
    if (!payload.email) {
        context.setVariable("validation.error", true);
        context.setVariable("validation.errorMessage", "Email is required");
        context.setVariable("validation.errorCode", "MISSING_EMAIL");
        throw new Error("Email is required");
    }

    // Basic email format validation
    var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(payload.email)) {
        context.setVariable("validation.error", true);
        context.setVariable("validation.errorMessage", "Invalid email format");
        context.setVariable("validation.errorCode", "INVALID_EMAIL");
        throw new Error("Invalid email format");
    }

    // Validate password
    if (!payload.password) {
        context.setVariable("validation.error", true);
        context.setVariable("validation.errorMessage", "Password is required");
        context.setVariable("validation.errorCode", "MISSING_PASSWORD");
        throw new Error("Password is required");
    }

    // Password minimum length
    if (payload.password.length < 6) {
        context.setVariable("validation.error", true);
        context.setVariable("validation.errorMessage", "Password must be at least 6 characters");
        context.setVariable("validation.errorCode", "INVALID_PASSWORD");
        throw new Error("Password too short");
    }

    // Set validated email for logging
    context.setVariable("login.email", payload.email);

} catch (e) {
    if (!context.getVariable("validation.error")) {
        context.setVariable("validation.error", true);
        context.setVariable("validation.errorMessage", "Invalid JSON payload");
        context.setVariable("validation.errorCode", "INVALID_JSON");
    }
    throw e;
}
