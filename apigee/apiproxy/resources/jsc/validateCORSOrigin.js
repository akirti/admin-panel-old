/**
 * Validate the request Origin header against an allowed list.
 *
 * Allowed origins are read from the KVM variable "kvm.cors.allowed_origins"
 * (comma-separated) with a sensible default fallback.
 *
 * Sets flow variables:
 *   "cors.allowed_origin" — the validated origin (or empty if not allowed)
 *   "cors.is_valid_origin" — "true" / "false" for use in Conditions
 */

var origin = context.getVariable("request.header.origin") || "";
var allowedOriginsRaw = context.getVariable("kvm.cors.allowed_origins") || "";

// Default allowed origins when KVM entry is not configured.
// Keep this list updated with all environments.
var DEFAULT_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:8000",
    "http://localhost",
    "http://localhost:80",
    "https://akirtidev.mydomain.com",
    "https://easylifeqa.localhost.net",
    "https://easylifestg.localhost.net"
];

// Wildcard patterns: origins ending with these suffixes are also allowed.
// This handles subdomains and varying ports in dev/staging.
var ALLOWED_SUFFIXES = [
    ".mydomain.com",
    ".localhost.net"
];

var allowedOrigins;
if (allowedOriginsRaw && allowedOriginsRaw.trim().length > 0) {
    allowedOrigins = allowedOriginsRaw.split(",").map(function (o) {
        return o.trim();
    });
} else {
    allowedOrigins = DEFAULT_ORIGINS;
}

var validatedOrigin = "";
var isValid = false;

if (origin) {
    // Exact match
    for (var i = 0; i < allowedOrigins.length; i++) {
        if (allowedOrigins[i] === origin) {
            validatedOrigin = origin;
            isValid = true;
            break;
        }
    }

    // Suffix match (wildcard subdomains)
    if (!isValid) {
        for (var j = 0; j < ALLOWED_SUFFIXES.length; j++) {
            var suffix = ALLOWED_SUFFIXES[j];
            // Check if origin's hostname ends with the suffix
            // origin format: https://sub.domain.com or https://sub.domain.com:port
            var originWithoutProto = origin.replace(/^https?:\/\//, "");
            var hostname = originWithoutProto.split(":")[0]; // strip port
            if (hostname.length > suffix.length && hostname.substring(hostname.length - suffix.length) === suffix) {
                validatedOrigin = origin;
                isValid = true;
                break;
            }
        }
    }
}

context.setVariable("cors.allowed_origin", validatedOrigin);
context.setVariable("cors.is_valid_origin", isValid ? "true" : "false");
