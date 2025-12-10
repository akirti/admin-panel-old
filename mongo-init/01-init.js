// MongoDB Initialization Script for Development
// This script runs automatically when the container starts with an empty data volume
// NOTE: This script only runs ONCE when the MongoDB container is first created with an empty volume
// To re-run this script, you must remove the mongodb_data volume: docker-compose down -v

print('========================================');
print('Starting database initialization...');
print('========================================');

// Switch to the easylife_auth database
db = db.getSiblingDB('easylife_auth');

// Check if database is already initialized
var collectionsCount = db.getCollectionNames().length;
if (collectionsCount > 0) {
    print('Database already initialized. Skipping...');
    print('To reinitialize, run: docker-compose down -v');
    quit();
}

print('Initializing fresh database...');

// Create collections
try {
    db.createCollection('users');
    db.createCollection('roles');
    db.createCollection('groups');
    db.createCollection('permissions');
    db.createCollection('customers');
    db.createCollection('domains');
    db.createCollection('domain_scenarios');
    db.createCollection('playboards');
    db.createCollection('configurations');
    db.createCollection('tokens');
    db.createCollection('audit_logs');
    db.createCollection('scenario_requests');
    db.createCollection('feedbacks');
    db.createCollection('bookmarks');
    db.createCollection('snapshots');
    db.createCollection('api_configs');
    print('Collections created successfully');
} catch (error) {
    print('Error creating collections: ' + error);
    throw error;
}

// ============================================
// PERMISSIONS
// ============================================
print('Inserting permissions...');
try {
    db.permissions.insertMany([
  // Users module
  { key: 'users.view', name: 'View Users', module: 'users', description: 'Can view user list', actions: ['read'], status: 'active', created_at: new Date(), updated_at: new Date() },
  { key: 'users.create', name: 'Create Users', module: 'users', description: 'Can create new users', actions: ['create'], status: 'active', created_at: new Date(), updated_at: new Date() },
  { key: 'users.edit', name: 'Edit Users', module: 'users', description: 'Can edit users', actions: ['update'], status: 'active', created_at: new Date(), updated_at: new Date() },
  { key: 'users.delete', name: 'Delete Users', module: 'users', description: 'Can delete users', actions: ['delete'], status: 'active', created_at: new Date(), updated_at: new Date() },

  // Roles module
  { key: 'roles.view', name: 'View Roles', module: 'roles', description: 'Can view roles', actions: ['read'], status: 'active', created_at: new Date(), updated_at: new Date() },
  { key: 'roles.create', name: 'Create Roles', module: 'roles', description: 'Can create roles', actions: ['create'], status: 'active', created_at: new Date(), updated_at: new Date() },
  { key: 'roles.edit', name: 'Edit Roles', module: 'roles', description: 'Can edit roles', actions: ['update'], status: 'active', created_at: new Date(), updated_at: new Date() },
  { key: 'roles.delete', name: 'Delete Roles', module: 'roles', description: 'Can delete roles', actions: ['delete'], status: 'active', created_at: new Date(), updated_at: new Date() },

  // Groups module
  { key: 'groups.view', name: 'View Groups', module: 'groups', description: 'Can view groups', actions: ['read'], status: 'active', created_at: new Date(), updated_at: new Date() },
  { key: 'groups.create', name: 'Create Groups', module: 'groups', description: 'Can create groups', actions: ['create'], status: 'active', created_at: new Date(), updated_at: new Date() },
  { key: 'groups.edit', name: 'Edit Groups', module: 'groups', description: 'Can edit groups', actions: ['update'], status: 'active', created_at: new Date(), updated_at: new Date() },
  { key: 'groups.delete', name: 'Delete Groups', module: 'groups', description: 'Can delete groups', actions: ['delete'], status: 'active', created_at: new Date(), updated_at: new Date() },

  // Domains module
  { key: 'domains.view', name: 'View Domains', module: 'domains', description: 'Can view domains', actions: ['read'], status: 'active', created_at: new Date(), updated_at: new Date() },
  { key: 'domains.create', name: 'Create Domains', module: 'domains', description: 'Can create domains', actions: ['create'], status: 'active', created_at: new Date(), updated_at: new Date() },
  { key: 'domains.edit', name: 'Edit Domains', module: 'domains', description: 'Can edit domains', actions: ['update'], status: 'active', created_at: new Date(), updated_at: new Date() },
  { key: 'domains.delete', name: 'Delete Domains', module: 'domains', description: 'Can delete domains', actions: ['delete'], status: 'active', created_at: new Date(), updated_at: new Date() },

  // Scenarios module
  { key: 'scenarios.view', name: 'View Scenarios', module: 'scenarios', description: 'Can view scenarios', actions: ['read'], status: 'active', created_at: new Date(), updated_at: new Date() },
  { key: 'scenarios.create', name: 'Create Scenarios', module: 'scenarios', description: 'Can create scenarios', actions: ['create'], status: 'active', created_at: new Date(), updated_at: new Date() },
  { key: 'scenarios.edit', name: 'Edit Scenarios', module: 'scenarios', description: 'Can edit scenarios', actions: ['update'], status: 'active', created_at: new Date(), updated_at: new Date() },
  { key: 'scenarios.delete', name: 'Delete Scenarios', module: 'scenarios', description: 'Can delete scenarios', actions: ['delete'], status: 'active', created_at: new Date(), updated_at: new Date() },

  // Playboards module
  { key: 'playboards.view', name: 'View Playboards', module: 'playboards', description: 'Can view playboards', actions: ['read'], status: 'active', created_at: new Date(), updated_at: new Date() },
  { key: 'playboards.create', name: 'Create Playboards', module: 'playboards', description: 'Can create playboards', actions: ['create'], status: 'active', created_at: new Date(), updated_at: new Date() },
  { key: 'playboards.edit', name: 'Edit Playboards', module: 'playboards', description: 'Can edit playboards', actions: ['update'], status: 'active', created_at: new Date(), updated_at: new Date() },
  { key: 'playboards.delete', name: 'Delete Playboards', module: 'playboards', description: 'Can delete playboards', actions: ['delete'], status: 'active', created_at: new Date(), updated_at: new Date() },

  // Configurations module
  { key: 'configurations.view', name: 'View Configurations', module: 'configurations', description: 'Can view configurations', actions: ['read'], status: 'active', created_at: new Date(), updated_at: new Date() },
  { key: 'configurations.create', name: 'Create Configurations', module: 'configurations', description: 'Can create configurations', actions: ['create'], status: 'active', created_at: new Date(), updated_at: new Date() },
  { key: 'configurations.edit', name: 'Edit Configurations', module: 'configurations', description: 'Can edit configurations', actions: ['update'], status: 'active', created_at: new Date(), updated_at: new Date() },
  { key: 'configurations.delete', name: 'Delete Configurations', module: 'configurations', description: 'Can delete configurations', actions: ['delete'], status: 'active', created_at: new Date(), updated_at: new Date() },

  // Dashboard module
  { key: 'dashboard.view', name: 'View Dashboard', module: 'dashboard', description: 'Can view dashboard', actions: ['read'], status: 'active', created_at: new Date(), updated_at: new Date() },

  // Customers module
  { key: 'customers.view', name: 'View Customers', module: 'customers', description: 'Can view customers', actions: ['read'], status: 'active', created_at: new Date(), updated_at: new Date() },
  { key: 'customers.create', name: 'Create Customers', module: 'customers', description: 'Can create customers', actions: ['create'], status: 'active', created_at: new Date(), updated_at: new Date() },
  { key: 'customers.edit', name: 'Edit Customers', module: 'customers', description: 'Can edit customers', actions: ['update'], status: 'active', created_at: new Date(), updated_at: new Date() },
  { key: 'customers.delete', name: 'Delete Customers', module: 'customers', description: 'Can delete customers', actions: ['delete'], status: 'active', created_at: new Date(), updated_at: new Date() },

  // Scenario Requests module
  { key: 'scenario_requests.view', name: 'View Scenario Requests', module: 'scenario_requests', description: 'Can view scenario requests', actions: ['read'], status: 'active', created_at: new Date(), updated_at: new Date() },
  { key: 'scenario_requests.create', name: 'Create Scenario Requests', module: 'scenario_requests', description: 'Can create scenario requests', actions: ['create'], status: 'active', created_at: new Date(), updated_at: new Date() },
  { key: 'scenario_requests.edit', name: 'Edit Scenario Requests', module: 'scenario_requests', description: 'Can edit scenario requests', actions: ['update'], status: 'active', created_at: new Date(), updated_at: new Date() },
  { key: 'scenario_requests.delete', name: 'Delete Scenario Requests', module: 'scenario_requests', description: 'Can delete scenario requests', actions: ['delete'], status: 'active', created_at: new Date(), updated_at: new Date() },
  { key: 'scenario_requests.approve', name: 'Approve Scenario Requests', module: 'scenario_requests', description: 'Can approve/reject scenario requests', actions: ['approve'], status: 'active', created_at: new Date(), updated_at: new Date() },

  // Bookmarks module
  { key: 'bookmarks.view', name: 'View Bookmarks', module: 'bookmarks', description: 'Can view bookmarks', actions: ['read'], status: 'active', created_at: new Date(), updated_at: new Date() },
  { key: 'bookmarks.create', name: 'Create Bookmarks', module: 'bookmarks', description: 'Can create bookmarks', actions: ['create'], status: 'active', created_at: new Date(), updated_at: new Date() },
  { key: 'bookmarks.edit', name: 'Edit Bookmarks', module: 'bookmarks', description: 'Can edit bookmarks', actions: ['update'], status: 'active', created_at: new Date(), updated_at: new Date() },
  { key: 'bookmarks.delete', name: 'Delete Bookmarks', module: 'bookmarks', description: 'Can delete bookmarks', actions: ['delete'], status: 'active', created_at: new Date(), updated_at: new Date() },

  // Snapshots module
  { key: 'snapshots.view', name: 'View Snapshots', module: 'snapshots', description: 'Can view snapshots', actions: ['read'], status: 'active', created_at: new Date(), updated_at: new Date() },
  { key: 'snapshots.create', name: 'Create Snapshots', module: 'snapshots', description: 'Can create snapshots', actions: ['create'], status: 'active', created_at: new Date(), updated_at: new Date() },
  { key: 'snapshots.edit', name: 'Edit Snapshots', module: 'snapshots', description: 'Can edit snapshots', actions: ['update'], status: 'active', created_at: new Date(), updated_at: new Date() },
  { key: 'snapshots.delete', name: 'Delete Snapshots', module: 'snapshots', description: 'Can delete snapshots', actions: ['delete'], status: 'active', created_at: new Date(), updated_at: new Date() },

  // Prevail module
  { key: 'prevail.view', name: 'View Prevail', module: 'prevail', description: 'Can view prevail data', actions: ['read'], status: 'active', created_at: new Date(), updated_at: new Date() },
  { key: 'prevail.create', name: 'Create Prevail', module: 'prevail', description: 'Can create prevail entries', actions: ['create'], status: 'active', created_at: new Date(), updated_at: new Date() },
  { key: 'prevail.edit', name: 'Edit Prevail', module: 'prevail', description: 'Can edit prevail entries', actions: ['update'], status: 'active', created_at: new Date(), updated_at: new Date() },
  { key: 'prevail.delete', name: 'Delete Prevail', module: 'prevail', description: 'Can delete prevail entries', actions: ['delete'], status: 'active', created_at: new Date(), updated_at: new Date() },
  { key: 'prevail.execute', name: 'Execute Prevail', module: 'prevail', description: 'Can execute prevail operations', actions: ['execute'], status: 'active', created_at: new Date(), updated_at: new Date() },

  // Jira module
  { key: 'jira.view', name: 'View Jira', module: 'jira', description: 'Can view Jira projects and tasks', actions: ['read'], status: 'active', created_at: new Date(), updated_at: new Date() },
  { key: 'jira.create', name: 'Create Jira Tasks', module: 'jira', description: 'Can create Jira tasks', actions: ['create'], status: 'active', created_at: new Date(), updated_at: new Date() },
  { key: 'jira.edit', name: 'Edit Jira Tasks', module: 'jira', description: 'Can edit and transition Jira tasks', actions: ['update'], status: 'active', created_at: new Date(), updated_at: new Date() },
  { key: 'jira.sync', name: 'Sync Jira', module: 'jira', description: 'Can sync scenario requests with Jira', actions: ['sync'], status: 'active', created_at: new Date(), updated_at: new Date() },

  // Admin module
  { key: 'admin.full', name: 'Full Admin Access', module: 'admin', description: 'Full administrative access', actions: ['read', 'create', 'update', 'delete'], status: 'active', created_at: new Date(), updated_at: new Date() }
]);
    print('Permissions inserted: ' + db.permissions.countDocuments());
} catch (error) {
    print('Error inserting permissions: ' + error);
    throw error;
}

// ============================================
// CUSTOMERS
// ============================================
print('Inserting customers...');
try {
    db.customers.insertMany([
  { customerId: 'customer-001', name: 'Acme Corporation', description: 'Main enterprise customer', status: 'active', created_at: new Date(), updated_at: new Date() },
  { customerId: 'customer-002', name: 'TechStart Inc', description: 'Technology startup', status: 'active', created_at: new Date(), updated_at: new Date() },
  { customerId: 'customer-003', name: 'Global Retail Ltd', description: 'Retail chain company', status: 'active', created_at: new Date(), updated_at: new Date() },
  { customerId: 'customer-004', name: 'HealthCare Plus', description: 'Healthcare provider', status: 'active', created_at: new Date(), updated_at: new Date() },
  { customerId: 'customer-005', name: 'EduLearn Academy', description: 'Educational institution', status: 'inactive', created_at: new Date(), updated_at: new Date() }
]);
    print('Customers inserted: ' + db.customers.countDocuments());
} catch (error) {
    print('Error inserting customers: ' + error);
    throw error;
}

// ============================================
// DOMAINS
// ============================================
print('Inserting domains...');
db.domains.insertMany([
  { key: 'sales', name: 'Sales', description: 'Sales and revenue management', path: '/sales', dataDomain: 'sales', icon: 'chart-line', order: 1, status: 'active', defaultSelected: true, type: 'custom', created_at: new Date(), updated_at: new Date() },
  { key: 'inventory', name: 'Inventory', description: 'Inventory and stock management', path: '/inventory', dataDomain: 'inventory', icon: 'box', order: 2, status: 'active', defaultSelected: false, type: 'custom', created_at: new Date(), updated_at: new Date() },
  { key: 'hr', name: 'Human Resources', description: 'HR and employee management', path: '/hr', dataDomain: 'hr', icon: 'users', order: 3, status: 'active', defaultSelected: false, type: 'custom', created_at: new Date(), updated_at: new Date() },
  { key: 'finance', name: 'Finance', description: 'Financial management and reporting', path: '/finance', dataDomain: 'finance', icon: 'dollar-sign', order: 4, status: 'active', defaultSelected: false, type: 'custom', created_at: new Date(), updated_at: new Date() },
  { key: 'operations', name: 'Operations', description: 'Operations and logistics', path: '/operations', dataDomain: 'operations', icon: 'cog', order: 5, status: 'active', defaultSelected: false, type: 'custom', created_at: new Date(), updated_at: new Date() },
  { key: 'analytics', name: 'Analytics', description: 'Business analytics and insights', path: '/analytics', dataDomain: 'analytics', icon: 'chart-bar', order: 6, status: 'active', defaultSelected: false, type: 'custom', created_at: new Date(), updated_at: new Date() }
]);
print('Domains inserted: ' + db.domains.countDocuments());

// ============================================
// ROLES
// ============================================
print('Preparing roles data...');
try {
    var allPermissions = db.permissions.find().toArray().map(function(p) { return p.key; });
    var viewPermissions = db.permissions.find({ 'actions': 'read' }).toArray().map(function(p) { return p.key; });
    var allDomains = db.domains.find().toArray().map(function(d) { return d.key; });
    print('Loaded ' + allPermissions.length + ' permissions, ' + allDomains.length + ' domains');
} catch (error) {
    print('Error preparing roles data: ' + error);
    throw error;
}

print('Inserting roles...');
try {
db.roles.insertMany([
  {
    roleId: 'super-administrator',
    name: 'Super Administrator',
    description: 'Full system access with all permissions',
    permissions: allPermissions,
    domains: allDomains,
    status: 'active',
    priority: 1,
    type: 'system',
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    roleId: 'administrator',
    name: 'Administrator',
    description: 'Administrative access',
    permissions: ['users.view', 'users.create', 'users.edit', 'roles.view', 'groups.view', 'domains.view', 'scenarios.view', 'playboards.view', 'configurations.view', 'dashboard.view'],
    domains: allDomains,
    status: 'active',
    priority: 2,
    type: 'system',
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    roleId: 'editor',
    name: 'Editor',
    description: 'Can view and edit most resources',
    permissions: ['users.view', 'domains.view', 'domains.edit', 'scenarios.view', 'scenarios.create', 'scenarios.edit', 'playboards.view', 'playboards.create', 'playboards.edit', 'configurations.view', 'dashboard.view'],
    domains: ['sales', 'inventory', 'analytics'],
    status: 'active',
    priority: 3,
    type: 'custom',
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    roleId: 'viewer',
    name: 'Viewer',
    description: 'Read-only access',
    permissions: viewPermissions,
    domains: allDomains,
    status: 'active',
    priority: 4,
    type: 'custom',
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    roleId: 'sales-manager',
    name: 'Sales Manager',
    description: 'Sales domain manager',
    permissions: ['domains.view', 'scenarios.view', 'scenarios.create', 'scenarios.edit', 'playboards.view', 'dashboard.view'],
    domains: ['sales'],
    status: 'active',
    priority: 5,
    type: 'custom',
    created_at: new Date(),
    updated_at: new Date()
  }
]);
    print('Roles inserted: ' + db.roles.countDocuments());
} catch (error) {
    print('Error inserting roles: ' + error);
    throw error;
}

// ============================================
// GROUPS
// ============================================
print('Inserting groups...');
try {
    db.groups.insertMany([
  {
    groupId: 'administrators',
    name: 'Administrators',
    description: 'System administrators group',
    permissions: allPermissions,
    domains: allDomains,
    status: 'active',
    priority: 1,
    type: 'system',
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    groupId: 'managers',
    name: 'Managers',
    description: 'Department managers',
    permissions: ['users.view', 'domains.view', 'scenarios.view', 'scenarios.edit', 'playboards.view', 'playboards.edit', 'dashboard.view'],
    domains: allDomains,
    status: 'active',
    priority: 2,
    type: 'custom',
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    groupId: 'analysts',
    name: 'Analysts',
    description: 'Data analysts',
    permissions: ['domains.view', 'scenarios.view', 'playboards.view', 'configurations.view', 'dashboard.view'],
    domains: ['analytics', 'sales', 'finance'],
    status: 'active',
    priority: 3,
    type: 'custom',
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    groupId: 'sales-team',
    name: 'Sales Team',
    description: 'Sales department team',
    permissions: ['domains.view', 'scenarios.view', 'playboards.view', 'dashboard.view'],
    domains: ['sales'],
    status: 'active',
    priority: 4,
    type: 'custom',
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    groupId: 'hr-team',
    name: 'HR Team',
    description: 'Human resources team',
    permissions: ['users.view', 'domains.view', 'dashboard.view'],
    domains: ['hr'],
    status: 'active',
    priority: 5,
    type: 'custom',
    created_at: new Date(),
    updated_at: new Date()
  }
]);
    print('Groups inserted: ' + db.groups.countDocuments());
} catch (error) {
    print('Error inserting groups: ' + error);
    throw error;
}

// ============================================
// USERS
// Password hash is for 'password123' using werkzeug scrypt
// Backend supports: bcrypt ($2b$), pbkdf2 (pbkdf2:), and scrypt (scrypt:)
// Generated with: python3 -c "from werkzeug.security import generate_password_hash; print(generate_password_hash('password123'))"
// Email domain: @easylife.local for Mailpit testing
// ============================================
var passwordHash = 'scrypt:32768:8:1$XY91vHSFfC2BNgR5$70208ea010f35a93f2ecb3169c4201f5d18197372dd6288649e95db200cabbe6cd787e91f6680d996ea9287acf904394b273bfcbd412ec5c5209dc5dea823434';

print('Inserting users...');
try {
    db.users.insertMany([
  {
    email: 'admin@easylife.local',
    username: 'admin',
    full_name: 'System Administrator',
    name: 'System Administrator',
    password_hash: passwordHash,
    roles: ['super-administrator'],
    groups: ['administrators'],
    customers: ['customer-001', 'customer-002', 'customer-003', 'customer-004', 'customer-005'],
    is_active: true,
    is_super_admin: true,
    email_verified: true,
    created_at: new Date(),
    updated_at: new Date(),
    last_login: null
  },
  {
    email: 'manager@easylife.local',
    username: 'manager',
    full_name: 'John Manager',
    name: 'John Manager',
    password_hash: passwordHash,
    roles: ['administrator'],
    groups: ['managers'],
    customers: ['customer-001', 'customer-002'],
    is_active: true,
    is_super_admin: false,
    email_verified: true,
    created_at: new Date(),
    updated_at: new Date(),
    last_login: null
  },
  {
    email: 'editor@easylife.local',
    username: 'editor',
    full_name: 'Jane Editor',
    name: 'Jane Editor',
    password_hash: passwordHash,
    roles: ['editor'],
    groups: ['analysts'],
    customers: ['customer-001'],
    is_active: true,
    is_super_admin: false,
    email_verified: true,
    created_at: new Date(),
    updated_at: new Date(),
    last_login: null
  },
  {
    email: 'viewer@easylife.local',
    username: 'viewer',
    full_name: 'Bob Viewer',
    name: 'Bob Viewer',
    password_hash: passwordHash,
    roles: ['viewer'],
    groups: ['sales-team'],
    customers: ['customer-001'],
    is_active: true,
    is_super_admin: false,
    email_verified: true,
    created_at: new Date(),
    updated_at: new Date(),
    last_login: null
  },
  {
    email: 'sales@easylife.local',
    username: 'salesuser',
    full_name: 'Sales User',
    name: 'Sales User',
    password_hash: passwordHash,
    roles: ['sales-manager'],
    groups: ['sales-team'],
    customers: ['customer-001', 'customer-003'],
    is_active: true,
    is_super_admin: false,
    email_verified: true,
    created_at: new Date(),
    updated_at: new Date(),
    last_login: null
  },
  {
    email: 'inactive@easylife.local',
    username: 'inactive',
    full_name: 'Inactive User',
    name: 'Inactive User',
    password_hash: passwordHash,
    roles: ['viewer'],
    groups: [],
    customers: [],
    is_active: false,
    is_super_admin: false,
    email_verified: false,
    created_at: new Date(),
    updated_at: new Date(),
    last_login: null
  }
]);

    print('Users inserted: ' + db.users.countDocuments());
} catch (error) {
    print('Error inserting users: ' + error);
    throw error;
}

// ============================================
// DOMAIN SCENARIOS
// ============================================
print('Inserting domain scenarios...');
try {
    db.domain_scenarios.insertMany([
  { key: 'sales-overview', name: 'Sales Overview', description: 'Overview of sales performance', dataDomain: 'sales', domainKey: 'sales', path: '/sales/overview', icon: 'chart-pie', order: 1, status: 'active', defaultSelected: true, type: 'custom', subDomains: [], created_at: new Date(), updated_at: new Date() },
  { key: 'sales-by-region', name: 'Sales by Region', description: 'Regional sales breakdown', dataDomain: 'sales', domainKey: 'sales', path: '/sales/by-region', icon: 'map', order: 2, status: 'active', defaultSelected: false, type: 'custom', subDomains: [], created_at: new Date(), updated_at: new Date() },
  { key: 'sales-trends', name: 'Sales Trends', description: 'Historical sales trends', dataDomain: 'sales', domainKey: 'sales', path: '/sales/trends', icon: 'trending-up', order: 3, status: 'active', defaultSelected: false, type: 'custom', subDomains: [], created_at: new Date(), updated_at: new Date() },
  { key: 'inventory-stock', name: 'Stock Levels', description: 'Current inventory stock levels', dataDomain: 'inventory', domainKey: 'inventory', path: '/inventory/stock', icon: 'package', order: 1, status: 'active', defaultSelected: true, type: 'custom', subDomains: [], created_at: new Date(), updated_at: new Date() },
  { key: 'inventory-movement', name: 'Stock Movement', description: 'Inventory movement tracking', dataDomain: 'inventory', domainKey: 'inventory', path: '/inventory/movement', icon: 'truck', order: 2, status: 'active', defaultSelected: false, type: 'custom', subDomains: [], created_at: new Date(), updated_at: new Date() },
  { key: 'hr-employees', name: 'Employee Directory', description: 'Employee information', dataDomain: 'hr', domainKey: 'hr', path: '/hr/employees', icon: 'users', order: 1, status: 'active', defaultSelected: true, type: 'custom', subDomains: [], created_at: new Date(), updated_at: new Date() },
  { key: 'hr-attendance', name: 'Attendance', description: 'Employee attendance tracking', dataDomain: 'hr', domainKey: 'hr', path: '/hr/attendance', icon: 'clock', order: 2, status: 'active', defaultSelected: false, type: 'custom', subDomains: [], created_at: new Date(), updated_at: new Date() },
  { key: 'finance-reports', name: 'Financial Reports', description: 'Financial statements and reports', dataDomain: 'finance', domainKey: 'finance', path: '/finance/reports', icon: 'file-text', order: 1, status: 'active', defaultSelected: true, type: 'custom', subDomains: [], created_at: new Date(), updated_at: new Date() },
  { key: 'finance-budgets', name: 'Budget Management', description: 'Budget planning and tracking', dataDomain: 'finance', domainKey: 'finance', path: '/finance/budgets', icon: 'calculator', order: 2, status: 'active', defaultSelected: false, type: 'custom', subDomains: [], created_at: new Date(), updated_at: new Date() },
  { key: 'analytics-dashboard', name: 'Analytics Dashboard', description: 'Business intelligence dashboard', dataDomain: 'analytics', domainKey: 'analytics', path: '/analytics/dashboard', icon: 'activity', order: 1, status: 'active', defaultSelected: true, type: 'custom', subDomains: [], created_at: new Date(), updated_at: new Date() }
]);

    print('Domain Scenarios inserted: ' + db.domain_scenarios.countDocuments());
} catch (error) {
    print('Error inserting domain scenarios: ' + error);
    throw error;
}

// ============================================
// PLAYBOARDS
// ============================================
print('Inserting playboards...');
try {
    db.playboards.insertMany([
  {
    key: 'sales-overview-board',
    name: 'Sales Overview Board',
    description: 'Main sales dashboard playboard',
    scenarioKey: 'sales-overview',
    status: 'active',
    data: {},
    dataDomain: 'sales',
    scenerioKey: 'sales-overview',
    order: 1,
    status: 'A',
    widgets: {
        filters: [
            { name: 'dateRange', dataKey: 'date_range', displayName: 'Date Range', type: 'daterange', visible: true, index: 0 },
            { name: 'region', dataKey: 'region', displayName: 'Region', type: 'select', visible: true, index: 1 }
        ],
        grid: {
            layout: { columns: ['date', 'region', 'amount', 'quantity'], headers: ['Date', 'Region', 'Amount', 'Quantity'], ispaginated: true, defaultSize: 25 },
            actions: { rowActions: { renderAs: 'button', attributes: [], events: [] } }
        },
        pagination: { name: 'limit', dataKey: 'limit', displayName: 'Page Size', index: 0, visible: true }
    },
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    key: 'inventory-stock-board',
    name: 'Inventory Stock Board',
    description: 'Stock levels playboard',
    scenarioKey: 'inventory-stock',
    status: 'active',
    data: {},
    dataDomain: 'inventory',
    scenerioKey: 'inventory-stock',
    order: 1,
    status: 'A',
    widgets: {
    filters: [
        { name: 'warehouse', dataKey: 'warehouse', displayName: 'Warehouse', type: 'select', visible: true, index: 0 },
        { name: 'category', dataKey: 'category', displayName: 'Category', type: 'select', visible: true, index: 1 }
    ],
    grid: {
        layout: { columns: ['sku', 'name', 'quantity', 'warehouse'], headers: ['SKU', 'Product Name', 'Quantity', 'Warehouse'], ispaginated: true, defaultSize: 25 },
        actions: { rowActions: { renderAs: 'button', attributes: [], events: [] } }
    },
    pagination: [{ name: 'limit', dataKey: 'limit', displayName: 'Page Size', index: 0, visible: true }]
    },
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    key: 'hr-employees-board',
    name: 'Employee Directory Board',
    description: 'Employee information playboard',
    scenarioKey: 'hr-employees',
    status: 'active',
    data: {},
    dataDomain: 'hr',
    scenerioKey: 'hr-employees',
    order: 1,
    status: 'A',
    widgets: {
    filters: [
        { name: 'department', dataKey: 'department', displayName: 'Department', type: 'select', visible: true, index: 0 },
        { name: 'status', dataKey: 'status', displayName: 'Status', type: 'select', visible: true, index: 1 }
    ],
    grid: {
        layout: { columns: ['emp_id', 'name', 'department', 'position', 'status'], headers: ['ID', 'Name', 'Department', 'Position', 'Status'], ispaginated: true, defaultSize: 25 },
        actions: { rowActions: { renderAs: 'button', attributes: [], events: [] } }
    },
    pagination: [{ name: 'limit', dataKey: 'limit', displayName: 'Page Size', index: 0, visible: true }]
    },
    created_at: new Date(),
    updated_at: new Date()
  }
]);

    print('Playboards inserted: ' + db.playboards.countDocuments());
} catch (error) {
    print('Error inserting playboards: ' + error);
    throw error;
}

// ============================================
// CONFIGURATIONS
// ============================================
print('Inserting configurations...');
try {
    db.configurations.insertMany([
  {
    config_id: 'config-process-001',
    key: 'sales-etl-process',
    type: 'process-config',
    queries: {
      extract: 'SELECT * FROM sales WHERE date >= :start_date',
      transform: 'AGGREGATE BY region, product',
      load: 'INSERT INTO sales_summary'
    },
    logics: {
      validation: ['check_nulls', 'check_duplicates'],
      transformation: ['normalize_amounts', 'calculate_totals']
    },
    operations: {
      schedule: 'daily',
      retry_count: 3,
      timeout: 3600
    },
    lookups: {},
    data: {},
    row_add_stp: new Date(),
    row_update_stp: new Date()
  },
  {
    config_id: 'config-lookup-001',
    key: 'region-codes',
    type: 'lookup-data',
    queries: {},
    logics: {},
    operations: {},
    lookups: {
      NA: 'North America',
      EU: 'Europe',
      APAC: 'Asia Pacific',
      LATAM: 'Latin America',
      MEA: 'Middle East & Africa'
    },
    data: {},
    row_add_stp: new Date(),
    row_update_stp: new Date()
  },
  {
    config_id: 'config-app-001',
    key: 'app-settings',
    type: 'snapshot-data',
    queries: {},
    logics: {},
    operations: {},
    lookups: {},
    data: {
      theme: 'light',
      language: 'en',
      timezone: 'UTC',
      date_format: 'YYYY-MM-DD',
      currency: 'USD',
      pagination_size: 25
    },
    row_add_stp: new Date(),
    row_update_stp: new Date()
  },
  {
    config_id: 'config-jira-001',
    key: 'jira-integration',
    type: 'jira',
    queries: {},
    logics: {},
    operations: {},
    lookups: {},
    data: {
      base_url: 'https://your-domain.atlassian.net',
      email: 'your-email@example.com',
      api_token: 'your-jira-api-token',
      project_key: 'SCEN',
      issue_type: 'Task',
      enabled: false,
      description: 'Jira integration for scenario requests. Update with your Jira credentials to enable.'
    },
    row_add_stp: new Date(),
    row_update_stp: new Date()
  },
  {
    config_id: 'config-jira-sales',
    key: 'jira-sales-domain',
    type: 'jira',
    queries: {},
    logics: {},
    operations: {},
    lookups: {},
    data: {
      domain: 'sales',
      project_key: 'SALES',
      issue_type: 'Story',
      description: 'Jira project mapping for Sales domain requests'
    },
    row_add_stp: new Date(),
    row_update_stp: new Date()
  }
]);

    print('Configurations inserted: ' + db.configurations.countDocuments());
} catch (error) {
    print('Error inserting configurations: ' + error);
    throw error;
}

// ============================================
// AUDIT LOGS (Sample Activity Data)
// ============================================
print('Inserting audit logs...');
try {
    var now = new Date();
var oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
var twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
var threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
var fourDaysAgo = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);
var fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
var sixDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);

db.audit_logs.insertMany([
  // Today's activities
  { action: 'login', entity_type: 'auth', entity_id: 'admin@easylife.local', user_id: 'admin@easylife.local', user_email: 'admin@easylife.local', changes: {}, timestamp: now },
  { action: 'create', entity_type: 'users', entity_id: 'test@easylife.local', user_id: 'admin@easylife.local', user_email: 'admin@easylife.local', changes: { email: { new: 'test@easylife.local' } }, timestamp: now },
  { action: 'update', entity_type: 'roles', entity_id: 'editor', user_id: 'admin@easylife.local', user_email: 'admin@easylife.local', changes: { permissions: { old: 5, new: 7 } }, timestamp: now },

  // 1 day ago
  { action: 'login', entity_type: 'auth', entity_id: 'manager@easylife.local', user_id: 'manager@easylife.local', user_email: 'manager@easylife.local', changes: {}, timestamp: oneDayAgo },
  { action: 'create', entity_type: 'groups', entity_id: 'test-group', user_id: 'admin@easylife.local', user_email: 'admin@easylife.local', changes: { name: { new: 'Test Group' } }, timestamp: oneDayAgo },

  // 2 days ago
  { action: 'login', entity_type: 'auth', entity_id: 'admin@easylife.local', user_id: 'admin@easylife.local', user_email: 'admin@easylife.local', changes: {}, timestamp: twoDaysAgo },
  { action: 'login', entity_type: 'auth', entity_id: 'editor@easylife.local', user_id: 'editor@easylife.local', user_email: 'editor@easylife.local', changes: {}, timestamp: twoDaysAgo },
  { action: 'create', entity_type: 'domains', entity_id: 'test-domain', user_id: 'admin@easylife.local', user_email: 'admin@easylife.local', changes: { key: { new: 'test-domain' } }, timestamp: twoDaysAgo },

  // 3 days ago
  { action: 'login', entity_type: 'auth', entity_id: 'admin@easylife.local', user_id: 'admin@easylife.local', user_email: 'admin@easylife.local', changes: {}, timestamp: threeDaysAgo },
  { action: 'create', entity_type: 'scenarios', entity_id: 'test-scenario', user_id: 'editor@easylife.local', user_email: 'editor@easylife.local', changes: { name: { new: 'Test Scenario' } }, timestamp: threeDaysAgo },

  // 4 days ago
  { action: 'login', entity_type: 'auth', entity_id: 'manager@easylife.local', user_id: 'manager@easylife.local', user_email: 'manager@easylife.local', changes: {}, timestamp: fourDaysAgo },
  { action: 'login', entity_type: 'auth', entity_id: 'sales@easylife.local', user_id: 'sales@easylife.local', user_email: 'sales@easylife.local', changes: {}, timestamp: fourDaysAgo },

  // 5 days ago
  { action: 'login', entity_type: 'auth', entity_id: 'admin@easylife.local', user_id: 'admin@easylife.local', user_email: 'admin@easylife.local', changes: {}, timestamp: fiveDaysAgo },

  // 6 days ago
  { action: 'login', entity_type: 'auth', entity_id: 'viewer@easylife.local', user_id: 'viewer@easylife.local', user_email: 'viewer@easylife.local', changes: {}, timestamp: sixDaysAgo }
]);

    print('Audit logs inserted: ' + db.audit_logs.countDocuments());
} catch (error) {
    print('Error inserting audit logs: ' + error);
    throw error;
}

// ============================================
// FEEDBACK (Sample Feedback Data)
// ============================================
print('Inserting feedback...');
try {
    var now = new Date();
    var oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
    var twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    var threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    var oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    var twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    function formatDate(date) {
        var year = date.getFullYear();
        var month = String(date.getMonth() + 1).padStart(2, '0');
        var day = String(date.getDate()).padStart(2, '0');
        var hours = date.getHours();
        var minutes = String(date.getMinutes()).padStart(2, '0');
        var seconds = String(date.getSeconds()).padStart(2, '0');
        var ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
        return year + '-' + month + '-' + day + ' ' + String(hours).padStart(2, '0') + ':' + minutes + ':' + seconds + ' ' + ampm;
    }

    db.feedbacks.insertMany([
        {
            email: 'john.doe@example.com',
            rating: 5,
            improvements: 'The dashboard is very intuitive and easy to use.',
            suggestions: 'Would love to see more chart types in the analytics section.',
            is_public: true,
            createdAt: formatDate(now)
        },
        {
            email: 'jane.smith@example.com',
            rating: 4,
            improvements: 'Navigation could be slightly faster.',
            suggestions: 'Add keyboard shortcuts for power users.',
            is_public: true,
            createdAt: formatDate(oneDayAgo)
        },
        {
            email: 'admin@easylife.local',
            rating: 5,
            improvements: 'Great system overall!',
            suggestions: 'Consider adding dark mode.',
            is_public: false,
            user_id: 'admin@easylife.local',
            createdAt: formatDate(twoDaysAgo)
        },
        {
            email: 'mike.wilson@example.com',
            rating: 3,
            improvements: 'Search functionality could be improved.',
            suggestions: 'Add advanced search filters.',
            is_public: true,
            createdAt: formatDate(threeDaysAgo)
        },
        {
            email: 'sarah.johnson@example.com',
            rating: 4,
            improvements: 'Documentation is helpful but could be more detailed.',
            suggestions: 'Video tutorials would be great.',
            is_public: true,
            createdAt: formatDate(oneWeekAgo)
        },
        {
            email: 'robert.brown@example.com',
            rating: 5,
            improvements: 'Love the export functionality!',
            suggestions: 'Add scheduled reports feature.',
            is_public: true,
            createdAt: formatDate(oneWeekAgo)
        },
        {
            email: 'manager@easylife.local',
            rating: 4,
            improvements: 'The user management interface is very clean.',
            suggestions: 'Bulk operations would save time.',
            is_public: false,
            user_id: 'manager@easylife.local',
            createdAt: formatDate(twoWeeksAgo)
        },
        {
            email: 'alex.martinez@example.com',
            rating: 2,
            improvements: 'Mobile responsiveness needs work.',
            suggestions: 'Please add a mobile app.',
            is_public: true,
            createdAt: formatDate(twoWeeksAgo)
        },
        {
            email: 'lisa.anderson@example.com',
            rating: 5,
            improvements: 'Best admin panel I have used!',
            suggestions: 'Integration with Slack would be awesome.',
            is_public: true,
            createdAt: formatDate(twoWeeksAgo)
        },
        {
            email: 'editor@easylife.local',
            rating: 4,
            improvements: 'Configuration management is straightforward.',
            suggestions: 'Version comparison tool would help.',
            is_public: false,
            user_id: 'editor@easylife.local',
            createdAt: formatDate(twoWeeksAgo)
        }
    ]);

    print('Feedback inserted: ' + db.feedbacks.countDocuments());
} catch (error) {
    print('Error inserting feedback: ' + error);
    throw error;
}

// ============================================
// SCENARIO REQUESTS (Sample Requests Data)
// ============================================
print('Inserting scenario requests...');
try {
    var now = new Date();
    var oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
    var twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    var threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    var oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    var twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    db.scenario_requests.insertMany([
        {
            requestId: 'REQ-2024-001',
            requestType: 'scenario',
            dataDomain: 'sales',
            name: 'Sales Performance Dashboard',
            description: '<p>Need a dashboard showing quarterly sales performance with regional breakdown and YoY comparison.</p><ul><li>Regional breakdown by territory</li><li>Year-over-year comparison charts</li><li>Top performers list</li></ul>',
            status: 'submitted',
            statusDescription: 'Request has been submitted and is awaiting review',
            has_suggestion: true,
            knows_steps: false,
            steps: [],
            files: [],
            comments: [],
            work_flow: [],
            user_id: 'user-editor-001',
            email: 'editor@easylife.local',
            reason: 'Need to track quarterly sales performance for executive reporting.',
            jira_links: [],
            email_recipients: [],
            row_add_user_id: 'user-editor-001',
            row_add_stp: now.toISOString(),
            row_update_user_id: 'user-editor-001',
            row_update_stp: now.toISOString()
        },
        {
            requestId: 'REQ-2024-002',
            requestType: 'scenario',
            dataDomain: 'inventory',
            name: 'Inventory Reorder Alert System',
            description: '<p>Create a scenario that alerts when inventory levels fall below minimum thresholds.</p><p>Should include:</p><ul><li>Email notifications</li><li>Dashboard widget</li><li>Historical trend analysis</li></ul>',
            status: 'in-progress',
            statusDescription: 'Request is being worked on',
            has_suggestion: true,
            knows_steps: true,
            steps: [
                {
                    description: '<p>Configure threshold parameters for each product category</p>',
                    database: 'inventory_db',
                    dbSchema: 'public',
                    table: 'products',
                    query: ['SELECT * FROM products WHERE stock_level < min_threshold'],
                    params: [],
                    sampleFiles: [],
                    order: 1
                }
            ],
            files: [],
            comments: [
                {
                    comment: '<p>Working on the threshold configuration. Will have initial version ready by end of week.</p>',
                    username: 'Admin User',
                    user_id: 'user-admin-001',
                    commentDate: oneDayAgo.toISOString(),
                    order: 1
                }
            ],
            work_flow: [
                {
                    assigned_to: 'user-admin-001',
                    assigned_to_email: 'admin@easylife.local',
                    assigned_to_name: 'Admin User',
                    assigned_by: 'user-admin-001',
                    assigned_by_email: 'admin@easylife.local',
                    assigned_by_name: 'Admin User',
                    from_status: 'submitted',
                    to_status: 'in-progress',
                    start_date: twoDaysAgo.toISOString(),
                    comment: '<p>Starting development work</p>',
                    flowOrder: 1,
                    create_stp: twoDaysAgo.toISOString(),
                    update_stp: twoDaysAgo.toISOString()
                }
            ],
            user_id: 'user-manager-001',
            email: 'manager@easylife.local',
            reason: 'Reduce stockouts and improve inventory management efficiency.',
            jira_links: [
                {
                    ticket_key: 'INV-123',
                    ticket_url: 'https://jira.example.com/browse/INV-123',
                    title: 'Inventory Alert System Design',
                    link_type: 'related',
                    added_by: 'admin@easylife.local',
                    added_at: twoDaysAgo.toISOString()
                }
            ],
            email_recipients: ['admin@easylife.local', 'manager@easylife.local'],
            row_add_user_id: 'user-manager-001',
            row_add_stp: twoDaysAgo.toISOString(),
            row_update_user_id: 'user-admin-001',
            row_update_stp: oneDayAgo.toISOString()
        },
        {
            requestId: 'REQ-2024-003',
            requestType: 'scenario',
            dataDomain: 'hr',
            name: 'Employee Attendance Report',
            description: '<p>Monthly attendance report with overtime calculations and department-wise breakdown.</p>',
            status: 'deployed',
            statusDescription: 'Scenario has been deployed to production',
            has_suggestion: false,
            knows_steps: false,
            steps: [],
            files: [],
            comments: [
                {
                    comment: '<p>Report template created and tested.</p>',
                    username: 'Jane Editor',
                    user_id: 'user-editor-001',
                    commentDate: oneWeekAgo.toISOString(),
                    order: 1
                },
                {
                    comment: '<p>Approved and deployed to production environment.</p>',
                    username: 'Admin User',
                    user_id: 'user-admin-001',
                    commentDate: threeDaysAgo.toISOString(),
                    order: 2
                }
            ],
            work_flow: [
                {
                    assigned_to: 'user-editor-001',
                    assigned_to_email: 'editor@easylife.local',
                    assigned_to_name: 'Jane Editor',
                    assigned_by: 'user-admin-001',
                    assigned_by_email: 'admin@easylife.local',
                    assigned_by_name: 'Admin User',
                    from_status: 'submitted',
                    to_status: 'in-progress',
                    start_date: twoWeeksAgo.toISOString(),
                    flowOrder: 1,
                    create_stp: twoWeeksAgo.toISOString(),
                    update_stp: twoWeeksAgo.toISOString()
                },
                {
                    assigned_to: 'user-admin-001',
                    assigned_to_email: 'admin@easylife.local',
                    assigned_to_name: 'Admin User',
                    assigned_by: 'user-editor-001',
                    assigned_by_email: 'editor@easylife.local',
                    assigned_by_name: 'Jane Editor',
                    from_status: 'in-progress',
                    to_status: 'deployed',
                    start_date: threeDaysAgo.toISOString(),
                    comment: '<p>Ready for deployment</p>',
                    flowOrder: 2,
                    create_stp: threeDaysAgo.toISOString(),
                    update_stp: threeDaysAgo.toISOString()
                }
            ],
            scenarioKey: 'hr-attendance-report',
            configName: 'HR Attendance Monthly',
            fulfilmentDate: threeDaysAgo.toISOString(),
            buckets: [],
            user_id: 'user-viewer-001',
            email: 'viewer@easylife.local',
            reason: 'HR needs monthly attendance tracking for payroll processing.',
            jira_integration: {
                ticket_id: '10001',
                ticket_key: 'HR-456',
                ticket_url: 'https://jira.example.com/browse/HR-456',
                project_key: 'HR',
                created_at: twoWeeksAgo.toISOString(),
                last_synced: threeDaysAgo.toISOString(),
                sync_status: 'synced'
            },
            jira_links: [],
            email_recipients: ['hr@easylife.local'],
            row_add_user_id: 'user-viewer-001',
            row_add_stp: twoWeeksAgo.toISOString(),
            row_update_user_id: 'user-admin-001',
            row_update_stp: threeDaysAgo.toISOString()
        },
        {
            requestId: 'REQ-2024-004',
            requestType: 'enhancement',
            dataDomain: 'finance',
            name: 'Financial Budget Tracker',
            description: '<p>Real-time budget tracking with variance analysis and forecasting capabilities.</p><p><strong>Requirements:</strong></p><ul><li>Real-time data sync</li><li>Variance analysis dashboard</li><li>Budget vs Actual charts</li><li>Forecasting module</li></ul>',
            status: 'submitted',
            statusDescription: 'Request has been submitted and is awaiting review',
            has_suggestion: false,
            knows_steps: false,
            steps: [],
            files: [],
            comments: [],
            work_flow: [],
            user_id: 'user-sales-001',
            email: 'sales@easylife.local',
            reason: 'Finance team needs better budget tracking and forecasting tools.',
            jira_links: [],
            email_recipients: [],
            row_add_user_id: 'user-sales-001',
            row_add_stp: oneDayAgo.toISOString(),
            row_update_user_id: 'user-sales-001',
            row_update_stp: oneDayAgo.toISOString()
        },
        {
            requestId: 'REQ-2024-005',
            requestType: 'scenario',
            dataDomain: 'analytics',
            name: 'Customer Segmentation Analysis',
            description: '<p>Scenario to analyze customers by purchase behavior, demographics, and engagement level.</p>',
            status: 'rejected',
            statusDescription: 'Request has been rejected',
            has_suggestion: true,
            knows_steps: false,
            steps: [],
            files: [],
            comments: [
                {
                    comment: '<p>Reviewing existing scenarios for potential overlap with this request.</p>',
                    username: 'Admin User',
                    user_id: 'user-admin-001',
                    commentDate: oneWeekAgo.toISOString(),
                    order: 1
                },
                {
                    comment: '<p>Found duplicate functionality - this request overlaps with existing Customer Analytics scenario. Please use that instead.</p>',
                    username: 'Admin User',
                    user_id: 'user-admin-001',
                    commentDate: threeDaysAgo.toISOString(),
                    order: 2
                }
            ],
            work_flow: [
                {
                    assigned_to: 'user-admin-001',
                    assigned_to_email: 'admin@easylife.local',
                    assigned_to_name: 'Admin User',
                    assigned_by: 'user-admin-001',
                    assigned_by_email: 'admin@easylife.local',
                    assigned_by_name: 'Admin User',
                    from_status: 'submitted',
                    to_status: 'review',
                    start_date: oneWeekAgo.toISOString(),
                    flowOrder: 1,
                    create_stp: oneWeekAgo.toISOString(),
                    update_stp: oneWeekAgo.toISOString()
                },
                {
                    assigned_to: 'user-editor-001',
                    assigned_to_email: 'editor@easylife.local',
                    assigned_to_name: 'Jane Editor',
                    assigned_by: 'user-admin-001',
                    assigned_by_email: 'admin@easylife.local',
                    assigned_by_name: 'Admin User',
                    from_status: 'review',
                    to_status: 'rejected',
                    start_date: threeDaysAgo.toISOString(),
                    comment: '<p>Similar scenario already exists in the analytics domain. Please use the existing Customer Analytics scenario.</p>',
                    flowOrder: 2,
                    create_stp: threeDaysAgo.toISOString(),
                    update_stp: threeDaysAgo.toISOString()
                }
            ],
            user_id: 'user-editor-001',
            email: 'editor@easylife.local',
            reason: 'Marketing team needs customer segmentation for targeted campaigns.',
            jira_links: [],
            email_recipients: [],
            row_add_user_id: 'user-editor-001',
            row_add_stp: twoWeeksAgo.toISOString(),
            row_update_user_id: 'user-admin-001',
            row_update_stp: threeDaysAgo.toISOString()
        },
        {
            requestId: 'REQ-2024-006',
            requestType: 'scenario',
            dataDomain: 'operations',
            name: 'Operations Workflow Automation',
            description: '<p>Automate daily operations reporting and task assignment workflow.</p><p>Key features needed:</p><ul><li>Automated daily report generation</li><li>Task queue management</li><li>SLA tracking</li><li>Escalation rules</li></ul>',
            status: 'development',
            statusDescription: 'Request is in development phase',
            has_suggestion: true,
            knows_steps: true,
            steps: [
                {
                    description: '<p>Set up automated report scheduler</p>',
                    order: 1
                },
                {
                    description: '<p>Configure task queue and assignment rules</p>',
                    order: 2
                },
                {
                    description: '<p>Implement SLA tracking and escalation</p>',
                    order: 3
                }
            ],
            files: [],
            comments: [
                {
                    comment: '<p>Started development. Initial framework is ready.</p>',
                    username: 'Jane Editor',
                    user_id: 'user-editor-001',
                    commentDate: twoDaysAgo.toISOString(),
                    order: 1
                }
            ],
            work_flow: [
                {
                    assigned_to: 'user-editor-001',
                    assigned_to_email: 'editor@easylife.local',
                    assigned_to_name: 'Jane Editor',
                    assigned_by: 'user-admin-001',
                    assigned_by_email: 'admin@easylife.local',
                    assigned_by_name: 'Admin User',
                    from_status: 'submitted',
                    to_status: 'development',
                    start_date: oneWeekAgo.toISOString(),
                    comment: '<p>Assigned for development</p>',
                    flowOrder: 1,
                    create_stp: oneWeekAgo.toISOString(),
                    update_stp: oneWeekAgo.toISOString()
                }
            ],
            user_id: 'user-manager-001',
            email: 'manager@easylife.local',
            reason: 'Operations team needs automation to improve efficiency and reduce manual work.',
            jira_links: [
                {
                    ticket_key: 'OPS-789',
                    ticket_url: 'https://jira.example.com/browse/OPS-789',
                    title: 'Ops Automation Phase 1',
                    link_type: 'dependency',
                    added_by: 'editor@easylife.local',
                    added_at: oneWeekAgo.toISOString()
                },
                {
                    ticket_key: 'OPS-790',
                    ticket_url: 'https://jira.example.com/browse/OPS-790',
                    title: 'SLA Module Development',
                    link_type: 'blocks',
                    added_by: 'editor@easylife.local',
                    added_at: twoDaysAgo.toISOString()
                }
            ],
            email_recipients: ['ops@easylife.local', 'manager@easylife.local'],
            row_add_user_id: 'user-manager-001',
            row_add_stp: oneWeekAgo.toISOString(),
            row_update_user_id: 'user-editor-001',
            row_update_stp: twoDaysAgo.toISOString()
        }
    ]);

    print('Scenario requests inserted: ' + db.scenario_requests.countDocuments());
} catch (error) {
    print('Error inserting scenario requests: ' + error);
    throw error;
}

// ============================================
// BOOKMARKS (Sample Bookmarks Data)
// ============================================
print('Inserting bookmarks...');
try {
    var now = new Date();
    var oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
    var oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    db.bookmarks.insertMany([
        {
            user_id: 'admin@easylife.local',
            user_email: 'admin@easylife.local',
            title: 'Sales Overview Dashboard',
            description: 'Main sales dashboard for quick access',
            type: 'scenario',
            reference_id: 'sales-overview',
            reference_type: 'domain_scenario',
            url: '/sales/overview',
            tags: ['sales', 'dashboard', 'daily'],
            is_favorite: true,
            order: 1,
            created_at: oneWeekAgo,
            updated_at: oneWeekAgo
        },
        {
            user_id: 'admin@easylife.local',
            user_email: 'admin@easylife.local',
            title: 'User Management',
            description: 'Quick access to user administration',
            type: 'admin',
            reference_id: 'users',
            reference_type: 'admin_page',
            url: '/admin/users',
            tags: ['admin', 'users'],
            is_favorite: true,
            order: 2,
            created_at: oneWeekAgo,
            updated_at: oneWeekAgo
        },
        {
            user_id: 'editor@easylife.local',
            user_email: 'editor@easylife.local',
            title: 'Inventory Stock Levels',
            description: 'Monitor stock levels',
            type: 'scenario',
            reference_id: 'inventory-stock',
            reference_type: 'domain_scenario',
            url: '/inventory/stock',
            tags: ['inventory', 'stock'],
            is_favorite: true,
            order: 1,
            created_at: oneDayAgo,
            updated_at: oneDayAgo
        },
        {
            user_id: 'manager@easylife.local',
            user_email: 'manager@easylife.local',
            title: 'HR Employee Directory',
            description: 'Employee lookup',
            type: 'scenario',
            reference_id: 'hr-employees',
            reference_type: 'domain_scenario',
            url: '/hr/employees',
            tags: ['hr', 'employees'],
            is_favorite: false,
            order: 1,
            created_at: now,
            updated_at: now
        },
        {
            user_id: 'sales@easylife.local',
            user_email: 'sales@easylife.local',
            title: 'Sales by Region',
            description: 'Regional sales breakdown',
            type: 'scenario',
            reference_id: 'sales-by-region',
            reference_type: 'domain_scenario',
            url: '/sales/by-region',
            tags: ['sales', 'regional'],
            is_favorite: true,
            order: 1,
            created_at: oneWeekAgo,
            updated_at: oneWeekAgo
        }
    ]);

    print('Bookmarks inserted: ' + db.bookmarks.countDocuments());
} catch (error) {
    print('Error inserting bookmarks: ' + error);
    throw error;
}

// ============================================
// SNAPSHOTS (Sample Snapshots Data)
// ============================================
print('Inserting snapshots...');
try {
    var now = new Date();
    var oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
    var oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    var twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    db.snapshots.insertMany([
        {
            snapshot_id: 'snap-001',
            name: 'Q4 2024 Sales Report',
            description: 'Quarterly sales snapshot for Q4 2024',
            type: 'report',
            scenario_key: 'sales-overview',
            domain: 'sales',
            user_id: 'admin@easylife.local',
            user_email: 'admin@easylife.local',
            data: {
                total_sales: 1250000,
                regions: ['NA', 'EU', 'APAC'],
                period: 'Q4-2024',
                generated_at: twoWeeksAgo
            },
            filters: {
                date_range: { start: '2024-10-01', end: '2024-12-31' },
                region: 'all'
            },
            status: 'active',
            is_shared: true,
            shared_with: ['manager@easylife.local', 'editor@easylife.local'],
            created_at: twoWeeksAgo,
            updated_at: twoWeeksAgo
        },
        {
            snapshot_id: 'snap-002',
            name: 'December Inventory Check',
            description: 'Monthly inventory snapshot',
            type: 'inventory',
            scenario_key: 'inventory-stock',
            domain: 'inventory',
            user_id: 'manager@easylife.local',
            user_email: 'manager@easylife.local',
            data: {
                total_items: 15420,
                low_stock_alerts: 23,
                warehouses: 5,
                generated_at: oneWeekAgo
            },
            filters: {
                warehouse: 'all',
                category: 'all'
            },
            status: 'active',
            is_shared: false,
            shared_with: [],
            created_at: oneWeekAgo,
            updated_at: oneWeekAgo
        },
        {
            snapshot_id: 'snap-003',
            name: 'Employee Headcount Report',
            description: 'Current employee headcount by department',
            type: 'report',
            scenario_key: 'hr-employees',
            domain: 'hr',
            user_id: 'editor@easylife.local',
            user_email: 'editor@easylife.local',
            data: {
                total_employees: 342,
                departments: 8,
                active: 328,
                on_leave: 14,
                generated_at: oneDayAgo
            },
            filters: {
                department: 'all',
                status: 'all'
            },
            status: 'active',
            is_shared: true,
            shared_with: ['admin@easylife.local'],
            created_at: oneDayAgo,
            updated_at: oneDayAgo
        },
        {
            snapshot_id: 'snap-004',
            name: 'Regional Sales Comparison',
            description: 'Sales comparison across regions for planning',
            type: 'analysis',
            scenario_key: 'sales-by-region',
            domain: 'sales',
            user_id: 'sales@easylife.local',
            user_email: 'sales@easylife.local',
            data: {
                NA: 450000,
                EU: 380000,
                APAC: 290000,
                LATAM: 130000,
                generated_at: now
            },
            filters: {
                date_range: { start: '2024-01-01', end: '2024-12-31' },
                product_category: 'all'
            },
            status: 'active',
            is_shared: false,
            shared_with: [],
            created_at: now,
            updated_at: now
        },
        {
            snapshot_id: 'snap-005',
            name: 'Archived Q3 Report',
            description: 'Q3 2024 archived snapshot',
            type: 'report',
            scenario_key: 'sales-overview',
            domain: 'sales',
            user_id: 'admin@easylife.local',
            user_email: 'admin@easylife.local',
            data: {
                total_sales: 980000,
                period: 'Q3-2024'
            },
            filters: {},
            status: 'archived',
            is_shared: false,
            shared_with: [],
            created_at: twoWeeksAgo,
            updated_at: oneWeekAgo
        }
    ]);

    print('Snapshots inserted: ' + db.snapshots.countDocuments());
} catch (error) {
    print('Error inserting snapshots: ' + error);
    throw error;
}

// Create api_configs collection and indexes
try {


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
        // Add more sample API configurations as needed
        {
        key: "jsonplaceholder-posts-08",
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
        key: "httpbin-get-07",
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
        key: "httpbin-post-06",
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
        key: "httpbin-basic-auth-05",
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
        key: "github-api-04",
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
        key: "internal-service-example-03",
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
        key: "login-token-example-02",
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
        key: "oauth2-example-01",
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
    print('api_configs inserted: ' + db.snapshots.countDocuments());
} catch (error) {
    print('Error inserting api_configs: ' + error);
    throw error;
}
// ============================================
// CREATE INDEXES
// ============================================
print('Creating indexes...');
try {
    db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ username: 1 }, { unique: true });
db.users.createIndex({ is_active: 1 });
db.users.createIndex({ created_at: -1 });

db.roles.createIndex({ roleId: 1 }, { unique: true });
db.roles.createIndex({ status: 1 });
db.roles.createIndex({ priority: 1 });

db.groups.createIndex({ groupId: 1 }, { unique: true });
db.groups.createIndex({ status: 1 });
db.groups.createIndex({ priority: 1 });

db.permissions.createIndex({ key: 1 }, { unique: true });
db.permissions.createIndex({ module: 1 });

db.customers.createIndex({ customerId: 1 }, { unique: true });
db.customers.createIndex({ status: 1 });

db.domains.createIndex({ key: 1 }, { unique: true });
db.domains.createIndex({ status: 1 });
db.domains.createIndex({ order: 1 });

db.domain_scenarios.createIndex({ key: 1 }, { unique: true });
db.domain_scenarios.createIndex({ domainKey: 1 });
db.domain_scenarios.createIndex({ status: 1 });

db.playboards.createIndex({ key: 1 }, { unique: true });
db.playboards.createIndex({ scenarioKey: 1 });
db.playboards.createIndex({ status: 1 });

db.configurations.createIndex({ config_id: 1 }, { unique: true });
db.configurations.createIndex({ key: 1 });
db.configurations.createIndex({ type: 1 });

db.tokens.createIndex({ user_id: 1 });
db.tokens.createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 });

db.audit_logs.createIndex({ timestamp: -1 });
db.audit_logs.createIndex({ user_email: 1 });
db.audit_logs.createIndex({ entity_type: 1 });
db.audit_logs.createIndex({ action: 1 });

db.scenario_requests.createIndex({ user_id: 1 });
db.scenario_requests.createIndex({ status: 1 });
db.scenario_requests.createIndex({ created_at: -1 });

db.feedbacks.createIndex({ email: 1 });
db.feedbacks.createIndex({ createdAt: -1 });
db.feedbacks.createIndex({ is_public: 1 });
db.feedbacks.createIndex({ rating: 1 });

db.bookmarks.createIndex({ user_id: 1 });
db.bookmarks.createIndex({ user_email: 1 });
db.bookmarks.createIndex({ reference_id: 1 });
db.bookmarks.createIndex({ is_favorite: 1 });
db.bookmarks.createIndex({ created_at: -1 });

db.snapshots.createIndex({ snapshot_id: 1 }, { unique: true });
db.snapshots.createIndex({ user_id: 1 });
db.snapshots.createIndex({ user_email: 1 });
db.snapshots.createIndex({ scenario_key: 1 });
db.snapshots.createIndex({ domain: 1 });
db.snapshots.createIndex({ status: 1 });
db.snapshots.createIndex({ created_at: -1 });

db.api_configs.createIndex({ "key": 1 }, { unique: true });
db.api_configs.createIndex({ "status": 1 });
db.api_configs.createIndex({ "tags": 1 });
db.api_configs.createIndex({ "auth_type": 1 });

    print('Indexes created successfully');
} catch (error) {
    print('Error creating indexes: ' + error);
    // Don't throw - indexes might fail if they already exist
}

// ============================================
// SUMMARY
// ============================================
print('');
print('========================================');
print('DATABASE INITIALIZATION COMPLETE');
print('========================================');
print('Collections created:');
print('  - users: ' + db.users.countDocuments());
print('  - roles: ' + db.roles.countDocuments());
print('  - groups: ' + db.groups.countDocuments());
print('  - permissions: ' + db.permissions.countDocuments());
print('  - customers: ' + db.customers.countDocuments());
print('  - domains: ' + db.domains.countDocuments());
print('  - domain_scenarios: ' + db.domain_scenarios.countDocuments());
print('  - playboards: ' + db.playboards.countDocuments());
print('  - configurations: ' + db.configurations.countDocuments());
print('  - audit_logs: ' + db.audit_logs.countDocuments());
print('  - feedbacks: ' + db.feedbacks.countDocuments());
print('  - scenario_requests: ' + db.scenario_requests.countDocuments());
print('  - bookmarks: ' + db.bookmarks.countDocuments());
print('  - snapshots: ' + db.snapshots.countDocuments());
print('');
print('Test Users (password: password123):');
print('  - admin@easylife.local (Super Admin)');
print('  - manager@easylife.local (Admin)');
print('  - editor@easylife.local (Editor)');
print('  - viewer@easylife.local (Viewer)');
print('  - sales@easylife.local (Sales Manager)');
print('  - inactive@easylife.local (Inactive)');
print('');
print('Mailpit Web UI: http://localhost:8025');
print('========================================');
