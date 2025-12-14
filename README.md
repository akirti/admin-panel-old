# EasyLife Admin Panel

A comprehensive admin panel with FastAPI backend and React frontend, featuring role-based access control, playboard management with advanced widget configuration, and email distribution lists.

## Project Structure

```
admin-panel/
├── backend/
│   ├── src/easylifeauth/      # Main authentication package
│   │   ├── api/               # FastAPI route handlers
│   │   │   ├── auth_routes.py
│   │   │   ├── admin_routes.py
│   │   │   ├── domain_routes.py
│   │   │   ├── scenario_routes.py
│   │   │   ├── playboard_routes.py
│   │   │   ├── feedback_routes.py
│   │   │   ├── scenario_request_routes.py
│   │   │   ├── health_routes.py
│   │   │   ├── users_routes.py
│   │   │   ├── roles_routes.py
│   │   │   ├── groups_routes.py
│   │   │   ├── permissions_routes.py
│   │   │   ├── configurations_routes.py
│   │   │   ├── customers_routes.py
│   │   │   ├── jira_routes.py
│   │   │   ├── api_config_routes.py
│   │   │   ├── distribution_list_routes.py
│   │   │   ├── error_log_routes.py
│   │   │   ├── models.py
│   │   │   └── dependencies.py
│   │   ├── db/                # Database management
│   │   │   ├── db_manager.py
│   │   │   └── constants.py
│   │   ├── services/          # Business logic
│   │   │   ├── token_manager.py
│   │   │   ├── user_service.py
│   │   │   ├── admin_service.py
│   │   │   ├── email_service.py
│   │   │   ├── password_service.py
│   │   │   ├── domain_service.py
│   │   │   ├── scenario_service.py
│   │   │   ├── playboard_service.py
│   │   │   ├── feedback_service.py
│   │   │   ├── new_scenarios_service.py
│   │   │   ├── jira_service.py
│   │   │   ├── distribution_list_service.py
│   │   │   └── error_log_service.py
│   │   ├── middleware/        # Custom middleware
│   │   │   ├── csrf.py
│   │   │   ├── rate_limit.py
│   │   │   ├── security.py
│   │   │   └── db_health.py
│   │   ├── security/          # Access control
│   │   │   └── access_control.py
│   │   ├── errors/            # Custom exceptions
│   │   ├── utils/             # Utility functions
│   │   └── app.py             # FastAPI application factory
│   ├── config/
│   │   └── config.json        # Configuration file
│   ├── main.py                # Application entry point
│   └── requirements.txt
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── layout/
    │   │   │   ├── MainLayout.jsx
    │   │   │   └── AuthLayout.jsx
    │   │   └── shared/        # Reusable UI components
    │   │       ├── Input.jsx
    │   │       ├── Select.jsx
    │   │       ├── Modal.jsx
    │   │       ├── Toggle.jsx
    │   │       ├── Button.jsx
    │   │       └── Badge.jsx
    │   ├── contexts/
    │   │   └── AuthContext.jsx
    │   ├── pages/
    │   │   ├── auth/
    │   │   │   ├── LoginPage.jsx
    │   │   │   ├── RegisterPage.jsx
    │   │   │   ├── ForgotPasswordPage.jsx
    │   │   │   └── ResetPasswordPage.jsx
    │   │   ├── user/
    │   │   │   ├── DashboardPage.jsx
    │   │   │   ├── ProfilePage.jsx
    │   │   │   ├── DomainsPage.jsx
    │   │   │   └── DomainDetailPage.jsx
    │   │   └── admin/
    │   │       ├── AdminDashboard.jsx
    │   │       ├── UsersManagement.jsx
    │   │       ├── RolesManagement.jsx
    │   │       ├── GroupsManagement.jsx
    │   │       ├── PermissionsManagement.jsx
    │   │       ├── DomainsManagement.jsx
    │   │       ├── ScenariosManagement.jsx
    │   │       ├── PlayboardsManagement.jsx
    │   │       ├── ConfigurationsManagement.jsx
    │   │       ├── CustomersManagement.jsx
    │   │       ├── ApiConfigsManagement.jsx
    │   │       ├── DistributionListManagement.jsx
    │   │       ├── FeedbackManagement.jsx
    │   │       ├── ActivityLogsPage.jsx
    │   │       ├── ErrorLogsPage.jsx
    │   │       └── BulkUploadPage.jsx
    │   ├── services/
    │   │   └── api.js
    │   ├── App.jsx
    │   ├── main.jsx
    │   └── index.css
    ├── package.json
    ├── vite.config.js
    └── tailwind.config.js
```

## Features

### Role-Based Access Control

| Role | Access |
|------|--------|
| `super-administrator` | Full system access, manages all users and settings |
| `administrator` | Manages users (except super-admins), full domain access |
| `group-administrator` | Manages users in their groups/domains |
| `group-editor` | Edits resources in assigned groups/domains |
| `editor` | Creates/edits scenarios and playboards |
| `user` | Views domains and submits requests |
| `viewer` | Read-only access |

### Access Matrix

| Feature | Super Admin | Admin | Group Admin | Editor | User | Viewer |
|---------|-------------|-------|-------------|--------|------|--------|
| **Panels** |
| Admin Panel (`/admin`) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Management Panel (`/management`) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **User Management** |
| Manage All Users | ✅ | ✅* | ❌ | ❌ | ❌ | ❌ |
| Manage Group Users | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Manage Roles | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manage Groups | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manage Permissions | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Content Management** |
| Create/Edit Domains | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Create/Edit Scenarios | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Create/Edit Playboards | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Manage Configurations | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manage API Configs | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Customer & Communication** |
| Manage Customers | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manage Distribution Lists | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View/Manage Feedback | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Scenario Requests** |
| Submit Scenario Request | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| View All Requests | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| View Own Requests | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Monitoring** |
| View Activity Logs | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View Error Logs | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Bulk Upload | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **User Features** |
| View Domains | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Edit Profile | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Submit Feedback | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

*Admin cannot manage super-administrators

## API Endpoints

### Authentication (`/api/v1/auth`)
- `POST /register` - Register new user
- `POST /login` - Login user
- `POST /logout` - Logout user
- `GET /profile` - Get current user profile
- `PUT /profile` - Update profile
- `POST /refresh` - Refresh JWT token
- `POST /forgot_password` - Request password reset
- `POST /reset_password` - Reset password with token
- `POST /update_password` - Update password (authenticated)

### Admin Management (`/api/v1/admin/management`)
- `GET /users` - Get all users (paginated)
- `GET /users/{user_id}` - Get user by ID
- `PUT /users/{user_id}/status` - Activate/deactivate user
- `PUT /users/{user_id}/roles` - Update user roles
- `PUT /users/{user_id}/groups` - Update user groups
- `PUT /users/{user_id}/domains` - Update user domains
- `DELETE /users/{user_id}` - Delete user (super-admin only)

### Domains (`/api/v1/domains`)
- `GET /all` - Get all domains
- `GET /{key}` - Get domain by key
- `POST /` - Create domain
- `PUT /{key}` - Update domain
- `DELETE /{key}` - Delete domain

### Scenarios (`/api/v1/scenarios`)
- `GET /all` - Get all scenarios
- `GET /all/{domain_key}` - Get scenarios by domain
- `GET /{key}` - Get scenario by key
- `POST /` - Create scenario
- `PUT /{key}` - Update scenario
- `DELETE /{key}` - Delete scenario

### Playboards (`/api/v1/playboards`)
- `GET /all` - Get all playboards
- `GET /all/{domain_key}` - Get playboards by domain
- `GET /{key}` - Get playboard by key
- `POST /` - Create playboard
- `PUT /{key}` - Update playboard
- `DELETE /{key}` - Delete playboard

### Feedback (`/api/v1/feedback`)
- `GET /all` - Get all feedback
- `GET /{id}` - Get feedback by ID
- `POST /` - Create feedback
- `PUT /{id}` - Update feedback

### Scenario Requests (`/api/v1/ask_scenarios`)
- `GET /all` - Get all scenario requests
- `GET /{request_id}` - Get request by ID
- `POST /` - Create scenario request
- `PUT /{request_id}` - Update scenario request

### Distribution Lists (`/api/v1/distribution-lists`)
- `GET /` - Get all distribution lists (paginated)
- `GET /types` - Get available list types
- `GET /{list_id}` - Get distribution list by ID
- `POST /` - Create distribution list
- `PUT /{list_id}` - Update distribution list
- `DELETE /{list_id}` - Delete distribution list
- `PATCH /{list_id}/toggle` - Toggle list active status

### API Configurations (`/api/v1/api-configs`)
- `GET /` - Get all API configurations
- `GET /{config_id}` - Get API config by ID
- `POST /` - Create API configuration
- `PUT /{config_id}` - Update API configuration
- `DELETE /{config_id}` - Delete API configuration

### Customers (`/api/v1/customers`)
- `GET /` - Get all customers
- `GET /{customer_id}` - Get customer by ID
- `POST /` - Create customer
- `PUT /{customer_id}` - Update customer
- `DELETE /{customer_id}` - Delete customer

### Error Logs (`/api/v1/error-logs`)
- `GET /` - Get error logs (paginated, filterable)
- `GET /{log_id}` - Get error log by ID
- `GET /stats` - Get error statistics
- `DELETE /{log_id}` - Delete error log

### Jira Integration (`/api/v1/jira`)
- `POST /create-issue` - Create Jira issue from scenario request
- `GET /issue/{issue_key}` - Get Jira issue details
- `POST /sync/{request_id}` - Sync scenario request with Jira

### Health (`/api/v1`)
- `GET /health` - Comprehensive health check
- `GET /health/live` - Liveness probe
- `GET /health/ready` - Readiness probe
- `GET /health/metrics` - System metrics
- `GET /info` - Application info

## Quick Start with Docker

### Prerequisites
- Docker 20.10+
- Docker Compose 2.0+

### Production Deployment

```bash
# 1. Clone and navigate to project
cd admin-panel

# 2. Copy environment file and configure
cp .env.example .env
# Edit .env with your settings (especially JWT_SECRET_KEY!)

# 3. Start all services
docker-compose up -d

# Or use Make
make up
```

**Access the application:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/api/v1/docs

**Default Admin Login:**
- Email: `admin@easylife.local`
- Password: `Admin@123` (change immediately!)

### Development Environment

```bash
# Start with hot reload and dev tools
docker-compose -f docker-compose.dev.yml up -d

# Or use Make
make dev
```

**Development URLs:**
- **App (recommended)**: http://localhost:3000 (Nginx proxy - handles API correctly)
- Frontend (direct Vite): http://localhost:5173 (API calls may fail)
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/api/v1/docs
- MailHog (Email testing): http://localhost:8025
- Mongo Express (DB UI): http://localhost:8081

> **Note:** Use http://localhost:3000 for development. The Nginx reverse proxy correctly forwards `/api/*` requests to the backend container.

### Docker Commands

```bash
# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild images
docker-compose build --no-cache

# Clean everything
docker-compose down -v --rmi all

# Or use Make commands
make help          # Show all commands
make up            # Start production
make dev           # Start development
make logs          # View logs
make shell-backend # Shell into backend
make shell-mongo   # MongoDB shell
make clean         # Remove everything
```

## Manual Installation (Without Docker)

### Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# or
venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt

# Configure database (edit config/config.json)

# Run the server
python main.py
# or
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

## Configuration

### Backend (`config/config.json`)

```json
{
  "databases": {
    "authentication": {
      "db_info": {
        "connectionScheme": "mongodb",
        "username": "admin",
        "password": "password",
        "host": "localhost:27017",
        "database": "easylife_auth",
        "collections": ["users", "tokens", "reset_tokens", ...]
      }
    }
  },
  "specs": {
    "app_secrets": {
      "auth_secret_key": "your-secret-key"
    },
    "smtp": {
      "smtp_server": "localhost",
      "smtp_port": 25,
      "email": "noreply@example.com"
    }
  }
}
```

### Environment Variables

- `EASYLIFE_SPECS_APP_SECRETS_AUTH_SECRET_KEY` - JWT secret key
- `EASYLIFE_SPECS_AUTH_TOKEN_TIMEOUT` - Token timeout in minutes (default: 15)

## Frontend Routes

| Route | Component | Access |
|-------|-----------|--------|
| `/login` | LoginPage | Public |
| `/register` | RegisterPage | Public |
| `/forgot-password` | ForgotPasswordPage | Public |
| `/reset-password` | ResetPasswordPage | Public |
| `/dashboard` | DashboardPage | Authenticated |
| `/profile` | ProfilePage | Authenticated |
| `/domains` | DomainsPage | Authenticated |
| `/domains/:key` | DomainDetailPage | Authenticated |
| `/ask-scenario` | AskScenarioPage | Authenticated |
| `/my-requests` | MyRequestsPage | Authenticated |
| `/feedback` | FeedbackPage | Authenticated |
| `/admin` | AdminDashboard | Super Admin |
| `/admin/users` | UsersManagement | Super Admin |
| `/admin/roles` | RolesManagement | Super Admin |
| `/admin/groups` | GroupsManagement | Super Admin |
| `/admin/permissions` | PermissionsManagement | Super Admin |
| `/admin/customers` | CustomersManagement | Super Admin |
| `/admin/domains` | DomainsManagement | Super Admin |
| `/admin/scenarios` | ScenariosManagement | Super Admin |
| `/admin/playboards` | PlayboardsManagement | Super Admin |
| `/admin/configurations` | ConfigurationsManagement | Super Admin |
| `/admin/api-configs` | ApiConfigsManagement | Super Admin |
| `/admin/scenario-requests` | ScenarioRequestsManagement | Super Admin |
| `/admin/feedback` | FeedbackManagement | Super Admin |
| `/admin/activity-logs` | ActivityLogsPage | Super Admin |
| `/admin/error-logs` | ErrorLogsPage | Super Admin |
| `/admin/bulk-upload` | BulkUploadPage | Super Admin |
| `/admin/distribution-lists` | DistributionListManagement | Super Admin |
| `/management` | AdminDashboard | Group Admin+ |
| `/management/users` | UsersManagement | Group Admin+ |
| `/management/domains` | DomainsManagement | Group Admin+ |
| `/management/scenario-requests` | ScenarioRequestsManagement | Group Admin+ |

## Playboard Widget Configuration

Playboards support advanced widget configuration with the following features:

### Filters
- **Basic Properties**: name, dataKey, displayName, index, visible, status
- **Filter Types**: input, select, date, daterange, number
- **Attributes**: type, defaultValue, regex, options, width, placeholder, min, max, etc.
- **Custom Attributes**: Autocomplete from WidgetAttributeKeyTypes enum

### Row Actions
- **Properties**: key, name, path, dataDomain, status, order
- **Filters**: Map row data to navigation params (inputKey -> dataKey)
- **Render Options**: button, dropdown, icons

### Grid Settings
- **Layout**: pagination, default page size
- **Row Actions Render As**: button, dropdown, icons

### Pagination Widget
- **Properties**: name, dataKey, displayName, visible
- **Attributes**: type (dropdown/input/buttons), options, defaultValue, width

## Distribution Lists

Email distribution lists for notifications with the following types:
- `scenario_request` - Scenario request notifications
- `feedback` - Feedback notifications
- `system_alert` - System alerts
- `system_notification` - System notifications
- `configuration_update` - Configuration updates
- `no_reply` - No-reply emails
- `support` - Support requests
- `custom` - Custom lists

## License

MIT