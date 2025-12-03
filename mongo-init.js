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
