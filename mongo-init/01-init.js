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
    db.createCollection('feedback');
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
    roleId: 'super-admin',
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
    roleId: 'admin',
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
    roles: ['super-admin'],
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
    roles: ['admin'],
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
    data: {
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
        pagination: [{ name: 'limit', dataKey: 'limit', displayName: 'Page Size', index: 0, visible: true }]
      }
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
    data: {
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
      }
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
    data: {
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
      }
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
