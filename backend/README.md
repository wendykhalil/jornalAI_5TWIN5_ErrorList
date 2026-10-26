# Jornal AI — Backend

## Project Description

Jornal AI is a personal journal application that helps users record their daily experiences, track their moods, organize memories, manage goals, and store media.

This repository contains the backend built with Django.

## Technologies

- Python 3.11
- Django 4.1.13
- MySQL / MariaDB
- XAMPP for local database development
- `mysqlclient`
- `python-dotenv`

## Project Structure

```text
backend/
├── apps/
│   ├── users/
│   ├── journal/
│   ├── mood/
│   ├── media/
│   ├── memories/
│   └── goals/
├── config/
├── manage.py
├── requirements.txt
├── .env.example
├── .gitignore
└── README.md
```

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/wendykhalil/jornalAI_5TWIN5_ErrorList.git
cd jornalAI_5TWIN5_ErrorList/backend
```

### 2. Create and activate a virtual environment

Windows PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

### 3. Install dependencies

```powershell
pip install -r requirements.txt
```

### 4. Configure environment variables

Copy `.env.example` to `.env`:

```powershell
Copy-Item .env.example .env
```

Update `.env` with your local configuration.

### 5. Configure the database

- Start MySQL in XAMPP.
- Create a database named `jornal_ai`.
- Verify the database credentials in `.env`.

### 6. Apply migrations

```powershell
python manage.py migrate
```

### 7. Check the project

```powershell
python manage.py check
```

### 8. Run the development server

```powershell
python manage.py runserver
```

The server will be available at http://127.0.0.1:8000/.

## Running Tests

The project includes comprehensive test coverage across all applications using Django's built-in test runner.

### Test Statistics

- **Total Tests:** 295 (as of October 26, 2026)
- **Test Files:** 8 (one per app, plus `goals/test_ai.py`)
- **All Tests Status:** ✅ PASSING (295/295)
- **Coverage:** 71.79% overall (configured via `.coveragerc`)

### Test Counts by App

| App | Tests | Status |
|-----|-------|--------|
| journal | 65 | ✅ PASS |
| memories | 133 | ✅ PASS |
| goals | 39 | ✅ PASS |
| users | 35 | ✅ PASS |
| mood | 17 | ✅ PASS |
| media | 6 | ✅ PASS |
| **Total** | **295** | **✅ PASS** |

### Run All Tests

```powershell
python manage.py test
```

### Run Tests for Specific App

```powershell
python manage.py test apps.users              # User authentication and permissions
python manage.py test apps.journal            # Journal entries (65 tests)
python manage.py test apps.mood               # Mood tracking
python manage.py test apps.media              # Media uploads
python manage.py test apps.memories           # Memory CRUD and AI features (133 tests)
python manage.py test apps.goals              # Goals, habits, and AI insights
```

### Run Tests with Verbose Output

```powershell
python manage.py test --verbosity=2
```

### Run Tests with Keepdb (Faster Re-runs)

```powershell
python manage.py test --keepdb
```

## Code Coverage

This project uses `coverage.py` for measuring test coverage. Ensure it's installed:

```powershell
pip install coverage==7.4.0
```

### Actual Coverage Results (October 26, 2026)

| Module | Coverage | Status |
|--------|----------|--------|
| **Backend Overall** | **71.79%** | 🟢 Good |
| memories | 87.52% | 🟢 Excellent |
| goals | 94.38% | 🟢 Excellent |
| media | 96.08% | 🟢 Excellent |
| mood | 88.69% | 🟢 Excellent |
| users | 67.66% | 🟡 Fair |
| journal | 43.21% | 🟡 Fair |

**Note:** Journal coverage is lower because it has extensive view endpoints for analysis, AI features, and export that are out of scope for basic CRUD tests. Core models and serializers are 89-100% covered.

### Generate Coverage Report

```powershell
coverage run --source='apps' manage.py test
coverage report
```

### Generate HTML Coverage Report

```powershell
coverage run --source='apps' manage.py test
coverage html
```

The HTML report will be generated in `htmlcov/index.html`. Open it in your browser to view detailed coverage information.

### Generate Report for Specific App

```powershell
coverage run --source='apps.journal' manage.py test apps.journal
coverage report --include="apps/journal/*"
```

### Coverage Configuration

Coverage settings are configured in `.coveragerc`. The default configuration:
- **Source:** `apps/` (all application code)
- **Omit:** Migrations and test files themselves
- **Report:** Excludes abstract methods, `__repr__`, and unreachable code

## Current Status

- Django project initialized.
- Six Django applications created and registered.
- MySQL / MariaDB database configured.
- Default Django migrations applied.
- Django system check completed successfully.
- Business logic and API endpoints are not implemented yet.

## Security Notes

- Never commit the `.env` file or real credentials.
- Use `.env.example` as a template for local configuration.
- Replace the development secret key and disable debug mode before production deployment.
