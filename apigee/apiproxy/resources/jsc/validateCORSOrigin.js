/**
 * Validate the request Origin header against an allowed list.
 *
 * Allowed origins are read from the KVM variable "kvm.cors.allowed_origins"
 * (comma-separated) with a sensible default fallback.
 *
 * Sets flow variable "cors.allowed_origin":
 *   - The origin itself if it is in the allowed list
 *   - Empty string if the origin is not allowed
 */

var origin = context.getVariable("request.header.origin") || "";
var allowedOriginsRaw = context.getVariable("kvm.cors.allowed_origins") || "";

// Default allowed origins when KVM entry is not configured
var DEFAULT_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173"
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

if (origin) {
    for (var i = 0; i < allowedOrigins.length; i++) {
        if (allowedOrigins[i] === origin) {
            validatedOrigin = origin;
            break;
        }
    }
}

context.setVariable("cors.allowed_origin", validatedOrigin);
