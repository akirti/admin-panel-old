# Admin Panel - React + FastAPI + MongoDB

A comprehensive administration panel for managing users, roles, groups, permissions, customers, domains, and scenarios.

## Features

- **Authentication**: JWT-based authentication with role-based access control
- **User Management**: Create, update, delete, enable/disable users
- **Role Management**: Define roles with permissions and domain access
- **Group Management**: Organize users into groups with shared permissions
- **Permission Management**: Granular permission system by module
- **Customer Management**: Multi-tenant customer association
- **Domain Management**: Hierarchical domain structure with sub-domains
- **Domain Scenarios**: Configure scenarios for each domain
- **Playboards**: Upload JSON playboard configurations
- **Bulk Operations**: Import/export data via CSV/Excel files
- **GCS Integration**: Read bulk data from Google Cloud Storage
- **Email Notifications**: Automatic notifications for account changes

## Technology Stack

- **Frontend**: React 18, Tailwind CSS, React Router
- **Backend**: FastAPI, Pydantic, Motor (async MongoDB)
- **Database**: MongoDB
- **Authentication**: JWT (python-jose)
- **Testing**: Pytest with 100% coverage target

## Project Structure

```
admin-panel/
├── backend/
│   ├── app/
│   │   ├── routers/          # API route handlers
│   │   ├── services/         # Business logic services
│   │   ├── auth.py           # Authentication utilities
│   │   ├── config.py         # Configuration settings
│   │   ├── database.py       # MongoDB connection
│   │   ├── models.py         # Pydantic models
│   │   └── main.py           # FastAPI application
│   ├── tests/                # Pytest test files
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   ├── contexts/         # React contexts
│   │   ├── pages/            # Page components
│   │   └── services/         # API services
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
└── README.md
```

## Quick Start

### Using Docker Compose (Recommended)

```bash
# Clone and navigate to project
cd admin-panel

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f
```

Access the application:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs

### Manual Setup

#### Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start MongoDB (ensure it's running)
# Start the API server
uvicorn app.main:app --reload --port 8000
```

#### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm start
```

## Default Credentials

### MongoDB
- **Username**: admin
- **Password**: admin123
- **Database**: admin_panel

### Test Users (password: `password123` for all)

| Email | Role | Description |
|-------|------|-------------|
| admin@example.com | Super Admin | Full system access |
| manager@example.com | Admin | Administrative access |
| editor@example.com | Editor | Can edit resources |
| viewer@example.com | Viewer | Read-only access |
| sales@example.com | Sales Manager | Sales domain access |
| inactive@example.com | Viewer | Inactive account |

**Important**: Change the default passwords after first login!

## Environment Variables

### Backend (.env)

```env
# MongoDB (with authentication)
MONGODB_URL=mongodb://admin:admin123@localhost:27017/admin_panel?authSource=admin
DATABASE_NAME=admin_panel

# JWT
SECRET_KEY=your-super-secret-key-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
EMAIL_FROM=admin@example.com

# GCS (Optional)
GCS_CREDENTIALS_JSON={"type": "service_account", ...}
GCS_BUCKET_NAME=your-bucket-name
```

### Frontend (.env)

```env
REACT_APP_API_URL=http://localhost:8000/api
```

## API Documentation

The API documentation is automatically generated and available at:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### Key Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/login` | POST | User login |
| `/api/auth/me` | GET | Get current user |
| `/api/users` | GET/POST | List/Create users |
| `/api/users/{id}` | GET/PUT/DELETE | User operations |
| `/api/roles` | GET/POST | List/Create roles |
| `/api/groups` | GET/POST | List/Create groups |
| `/api/permissions` | GET/POST | List/Create permissions |
| `/api/customers` | GET/POST | List/Create customers |
| `/api/domains` | GET/POST | List/Create domains |
| `/api/domain-scenarios` | GET/POST | List/Create scenarios |
| `/api/playboards` | GET/POST | List/Create playboards |
| `/api/playboards/upload` | POST | Upload JSON playboard |
| `/api/bulk/upload/{type}` | POST | Bulk upload entities |
| `/api/bulk/template/{type}` | GET | Download template |
| `/api/dashboard/stats` | GET | Dashboard statistics |

## Running Tests

```bash
cd backend

# Run all tests with coverage
pytest --cov=app --cov-report=html

# Run specific test file
pytest tests/test_auth.py -v

# Run with verbose output
pytest -v --cov=app
```

## Bulk Upload

### Supported Entity Types
- users
- roles
- groups
- permissions
- customers
- domains
- domain_scenarios

### File Formats
- CSV (.csv)
- Excel (.xlsx, .xls)

### Download Templates
Use the "Download Template" feature in the Bulk Upload page or API:
```bash
GET /api/bulk/template/{entity_type}?format=xlsx
```

### GCS Integration

To enable GCS bulk upload:
1. Set `GCS_CREDENTIALS_JSON` with your service account JSON
2. Set `GCS_BUCKET_NAME` with your bucket name
3. Use the `/api/bulk/gcs/upload/{type}` endpoint

## Email Notifications

The system sends email notifications for:
- Welcome emails with temporary passwords
- Password reset links
- Role/Group/Permission changes
- Customer association changes

Configure SMTP settings in environment variables to enable email functionality.

## Color Theme

- **Primary**: Red (#dc2626)
- **Background**: White (#ffffff)
- **Text**: Gray (#374151)
- **Accent**: Various shades of red

## Security Features

- JWT token authentication
- Password hashing with bcrypt
- Super admin access control for admin panel
- CORS configuration
- Input validation with Pydantic

## License

MIT License
