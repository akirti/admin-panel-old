// MongoDB initialization script
// This script runs when MongoDB container starts for the first time

// Switch to the easylife_auth database
db = db.getSiblingDB('easylife_auth');

// Create collections
db.createCollection('users');
db.createCollection('tokens');
db.createCollection('reset_tokens');
db.createCollection('sessions');
db.createCollection('roles');
db.createCollection('groups');
db.createCollection('scenario_requests');
db.createCollection('feedbacks');
db.createCollection('easylife_domain');
db.createCollection('easylife_scenerios');
db.createCollection('easylife_sceneario_playboard');

// Create indexes for users collection
db.users.createIndex({ "email": 1 }, { unique: true });
db.users.createIndex({ "username": 1 });
db.users.createIndex({ "roles": 1 });
db.users.createIndex({ "groups": 1 });
db.users.createIndex({ "domains": 1 });
db.users.createIndex({ "is_active": 1 });

// Create indexes for tokens collection
db.tokens.createIndex({ "user_id": 1, "email": 1 });
db.tokens.createIndex({ "token_hash": 1 });
db.tokens.createIndex({ "refresh_token_hash": 1 });
db.tokens.createIndex({ "expires_at": 1 }, { expireAfterSeconds: 0 });

// Create indexes for reset_tokens collection
db.reset_tokens.createIndex({ "token_hash": 1 });
db.reset_tokens.createIndex({ "user_id": 1 });
db.reset_tokens.createIndex({ "expires_at": 1 }, { expireAfterSeconds: 0 });

// Create indexes for domains
db.easylife_domain.createIndex({ "key": 1 }, { unique: true });
db.easylife_domain.createIndex({ "status": 1 });
db.easylife_domain.createIndex({ "order": 1 });

// Create indexes for scenarios
db.easylife_scenerios.createIndex({ "key": 1 }, { unique: true });
db.easylife_scenerios.createIndex({ "dataDomain": 1 });
db.easylife_scenerios.createIndex({ "status": 1 });

// Create indexes for playboards
db.easylife_sceneario_playboard.createIndex({ "scenerioKey": 1 });
db.easylife_sceneario_playboard.createIndex({ "dataDomain": 1 });
db.easylife_sceneario_playboard.createIndex({ "status": 1 });

// Create indexes for scenario requests
db.scenario_requests.createIndex({ "requestId": 1 }, { unique: true });
db.scenario_requests.createIndex({ "user_id": 1 });
db.scenario_requests.createIndex({ "status": 1 });
db.scenario_requests.createIndex({ "dataDomain": 1 });

// Create indexes for feedback
db.feedbacks.createIndex({ "email": 1 });
db.feedbacks.createIndex({ "createdAt": -1 });

// Insert default super administrator user
// Password: Admin@123 (hashed with werkzeug)
db.users.insertOne({
    email: "admin@easylife.local",
    username: "superadmin",
    password_hash: "scrypt:32768:8:1$3EZXQRzu3Rcuu2aS$352c812fbbd6151b98248b96c82201b5944b9ffdafb4a716eb6bcf2faf5e377d2b1c4b0fac0de68ce8426248bf97aca62cb3b325319725ce7101fbb7fd47bbf7",
    full_name: "Super Administrator",
    roles: ["super-administrator", "administrator"],
    groups: ["all"],
    domains: ["all"],
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
    last_login: null
});

// Insert sample domains
db.easylife_domain.insertMany([
    {
        key: "finance",
        name: "Finance",
        description: "Financial data and reports",
        path: "/finance",
        icon: "dollar-sign",
        order: 1,
        status: "A",
        defaultSelected: false,
        row_add_stp: new Date(),
        row_update_stp: new Date()
    },
    {
        key: "hr",
        name: "Human Resources",
        description: "HR data and employee management",
        path: "/hr",
        icon: "users",
        order: 2,
        status: "A",
        defaultSelected: false,
        row_add_stp: new Date(),
        row_update_stp: new Date()
    },
    {
        key: "operations",
        name: "Operations",
        description: "Operational data and metrics",
        path: "/operations",
        icon: "settings",
        order: 3,
        status: "A",
        defaultSelected: false,
        row_add_stp: new Date(),
        row_update_stp: new Date()
    }
]);

// Create api_configs collection and indexes
db.createCollection('api_configs');
db.api_configs.createIndex({ "key": 1 }, { unique: true });
db.api_configs.createIndex({ "status": 1 });
db.api_configs.createIndex({ "tags": 1 });
db.api_configs.createIndex({ "auth_type": 1 });

// Insert sample API configurations
db.api_configs.insertMany([
    {
        key: "jsonplaceholder-posts",
        name: "JSONPlaceholder Posts API",
        description: "Sample REST API for testing - returns fake posts data",
        endpoint: "https://jsonplaceholder.typicode.com/posts",
        method: "GET",
        headers: {
            "Accept": "application/json"
        },
        params: {},
        body: {},
        auth_type: "none",
        auth_config: {},
        ssl_verify: true,
        timeout: 30,
        retry_count: 0,
        retry_delay: 1,
        use_proxy: false,
        proxy_url: null,
        ping_endpoint: "https://jsonplaceholder.typicode.com/posts/1",
        ping_method: "GET",
        ping_expected_status: 200,
        ping_timeout: 5,
        cache_enabled: false,
        cache_ttl: 300,
        status: "active",
        tags: ["sample", "rest", "public"],
        created_at: new Date(),
        created_by: "system",
        updated_at: new Date(),
        updated_by: "system"
    },
    {
        key: "httpbin-get",
        name: "HTTPBin GET Test",
        description: "HTTPBin service for testing HTTP requests",
        endpoint: "https://httpbin.org/get",
        method: "GET",
        headers: {
            "Accept": "application/json",
            "X-Custom-Header": "test-value"
        },
        params: {
            "foo": "bar"
        },
        body: {},
        auth_type: "none",
        auth_config: {},
        ssl_verify: true,
        timeout: 30,
        retry_count: 1,
        retry_delay: 2,
        use_proxy: false,
        proxy_url: null,
        ping_endpoint: null,
        ping_method: "GET",
        ping_expected_status: 200,
        ping_timeout: 5,
        cache_enabled: true,
        cache_ttl: 60,
        status: "active",
        tags: ["sample", "testing", "httpbin"],
        created_at: new Date(),
        created_by: "system",
        updated_at: new Date(),
        updated_by: "system"
    },
    {
        key: "httpbin-post",
        name: "HTTPBin POST Test",
        description: "HTTPBin POST endpoint for testing request bodies",
        endpoint: "https://httpbin.org/post",
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        params: {},
        body: {
            "message": "Hello from EasyLife",
            "timestamp": "{{timestamp}}"
        },
        auth_type: "none",
        auth_config: {},
        ssl_verify: true,
        timeout: 30,
        retry_count: 0,
        retry_delay: 1,
        use_proxy: false,
        proxy_url: null,
        ping_endpoint: "https://httpbin.org/get",
        ping_method: "GET",
        ping_expected_status: 200,
        ping_timeout: 5,
        cache_enabled: false,
        cache_ttl: 300,
        status: "active",
        tags: ["sample", "testing", "httpbin", "post"],
        created_at: new Date(),
        created_by: "system",
        updated_at: new Date(),
        updated_by: "system"
    },
    {
        key: "httpbin-basic-auth",
        name: "HTTPBin Basic Auth Test",
        description: "HTTPBin endpoint for testing Basic Authentication",
        endpoint: "https://httpbin.org/basic-auth/testuser/testpass",
        method: "GET",
        headers: {
            "Accept": "application/json"
        },
        params: {},
        body: {},
        auth_type: "basic",
        auth_config: {
            "username": "testuser",
            "password": "testpass"
        },
        ssl_verify: true,
        timeout: 30,
        retry_count: 0,
        retry_delay: 1,
        use_proxy: false,
        proxy_url: null,
        ping_endpoint: "https://httpbin.org/get",
        ping_method: "GET",
        ping_expected_status: 200,
        ping_timeout: 5,
        cache_enabled: false,
        cache_ttl: 300,
        status: "active",
        tags: ["sample", "testing", "httpbin", "auth", "basic"],
        created_at: new Date(),
        created_by: "system",
        updated_at: new Date(),
        updated_by: "system"
    },
    {
        key: "github-api",
        name: "GitHub Public API",
        description: "GitHub REST API - public endpoints (rate limited)",
        endpoint: "https://api.github.com/users/octocat",
        method: "GET",
        headers: {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "EasyLife-Admin-Panel"
        },
        params: {},
        body: {},
        auth_type: "none",
        auth_config: {},
        ssl_verify: true,
        timeout: 30,
        retry_count: 2,
        retry_delay: 5,
        use_proxy: false,
        proxy_url: null,
        ping_endpoint: "https://api.github.com",
        ping_method: "GET",
        ping_expected_status: 200,
        ping_timeout: 10,
        cache_enabled: true,
        cache_ttl: 600,
        status: "active",
        tags: ["external", "github", "public"],
        created_at: new Date(),
        created_by: "system",
        updated_at: new Date(),
        updated_by: "system"
    },
    {
        key: "internal-service-example",
        name: "Internal Service (Inactive)",
        description: "Example of an internal service API configuration - currently inactive",
        endpoint: "http://internal-service:8080/api/health",
        method: "GET",
        headers: {
            "Accept": "application/json"
        },
        params: {},
        body: {},
        auth_type: "bearer",
        auth_config: {
            "token": "your-bearer-token-here"
        },
        ssl_verify: false,
        timeout: 10,
        retry_count: 3,
        retry_delay: 1,
        use_proxy: false,
        proxy_url: null,
        ping_endpoint: null,
        ping_method: "GET",
        ping_expected_status: 200,
        ping_timeout: 5,
        cache_enabled: false,
        cache_ttl: 300,
        status: "inactive",
        tags: ["internal", "service", "example"],
        created_at: new Date(),
        created_by: "system",
        updated_at: new Date(),
        updated_by: "system"
    },
    {
        key: "login-token-example",
        name: "Login Token Auth Example",
        description: "Example API that uses login endpoint to obtain bearer token before calling main API",
        endpoint: "https://api.example.com/v1/data",
        method: "GET",
        headers: {
            "Accept": "application/json"
        },
        params: {},
        body: {},
        auth_type: "login_token",
        auth_config: {
            "login_endpoint": "https://api.example.com/auth/login",
            "login_method": "POST",
            "username_field": "email",
            "password_field": "password",
            "username": "user@example.com",
            "password": "your-password-here",
            "extra_body": {},
            "token_response_path": "access_token",
            "token_type": "Bearer",
            "token_header_name": "Authorization"
        },
        ssl_verify: true,
        timeout: 30,
        retry_count: 1,
        retry_delay: 2,
        use_proxy: false,
        proxy_url: null,
        ping_endpoint: null,
        ping_method: "GET",
        ping_expected_status: 200,
        ping_timeout: 5,
        cache_enabled: false,
        cache_ttl: 300,
        status: "inactive",
        tags: ["example", "login_token", "auth"],
        created_at: new Date(),
        created_by: "system",
        updated_at: new Date(),
        updated_by: "system"
    },
    {
        key: "oauth2-example",
        name: "OAuth2 Client Credentials Example",
        description: "Example API that uses OAuth2 client credentials flow to obtain access token",
        endpoint: "https://api.example.com/v1/resources",
        method: "GET",
        headers: {
            "Accept": "application/json"
        },
        params: {},
        body: {},
        auth_type: "oauth2",
        auth_config: {
            "token_endpoint": "https://auth.example.com/oauth/token",
            "client_id": "your-client-id",
            "client_secret": "your-client-secret",
            "scope": "read write",
            "grant_type": "client_credentials",
            "audience": "",
            "extra_params": {},
            "token_response_path": "access_token",
            "token_type": "Bearer",
            "token_header_name": "Authorization"
        },
        ssl_verify: true,
        timeout: 30,
        retry_count: 1,
        retry_delay: 2,
        use_proxy: false,
        proxy_url: null,
        ping_endpoint: null,
        ping_method: "GET",
        ping_expected_status: 200,
        ping_timeout: 5,
        cache_enabled: false,
        cache_ttl: 300,
        status: "inactive",
        tags: ["example", "oauth2", "auth"],
        created_at: new Date(),
        created_by: "system",
        updated_at: new Date(),
        updated_by: "system"
    }
]);

// Insert sample scenarios
db.easylife_scenerios.insertMany([
    {
        key: "finance-monthly-report",
        name: "Monthly Financial Report",
        dataDomain: "finance",
        description: "Generate monthly financial summary",
        fullDescription: "Comprehensive monthly financial report including revenue, expenses, and profit margins",
        path: "/finance/monthly-report",
        order: 1,
        status: "A",
        defaultSelected: false,
        row_add_stp: new Date(),
        row_update_stp: new Date()
    },
    {
        key: "hr-employee-report",
        name: "Employee Report",
        dataDomain: "hr",
        description: "Employee data analysis",
        fullDescription: "Detailed employee statistics and workforce analytics",
        path: "/hr/employee-report",
        order: 1,
        status: "A",
        defaultSelected: false,
        row_add_stp: new Date(),
        row_update_stp: new Date()
    }
]);

print('MongoDB initialization completed successfully!');
print('Default admin user created: admin@easylife.local');
print('Note: Please change the admin password after first login!');
