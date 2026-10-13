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
