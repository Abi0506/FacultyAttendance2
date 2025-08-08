# Attendance Backend

A Node.js (Express) backend for managing staff attendance, leave tracking, and user authentication, with MySQL as the database layer.

## Features

- **User Authentication:** Login with JWT-based sessions and password hashing (bcryptjs).
- **Staff Management:** Add/delete staff, assign departments, designations, and working categories.
- **Attendance Tracking:** View daily logs, department summaries, and individual records.
- **Exemption Handling:** Workflow for submitting, tracking, and approving/rejecting attendance exemptions.
- **Python Integration:** Uses a Python script for certain ESSL device functions.
- **API Security:** Uses CORS, cookies, and environment-based secrets.

## Tech Stack

- **Backend:** Node.js, Express.js
- **Database:** MySQL (with connection pooling)
- **Auth:** JWT, bcryptjs
- **Other:** node-cron, dotenv, cookie-parser, cors

## Getting Started

### Prerequisites

- Node.js v16+
- MySQL server
- Python (for ESSL script integration)
- An `.env` file with the following:
  ```
  DB_HOST=your_mysql_host
  DB_USER=your_mysql_user
  DB_PASS=your_mysql_password
  DB_NAME=your_database
  SECRET_KEY=your_jwt_secret
  ```

### Install

```bash
npm install
```

### Run

```bash
node main.js
# or for development
npx nodemon main.js
```

The server runs on `http://localhost:5000`.

## API Overview

Routes are prefixed with `/api`.

### Auth Routes (`routes/login.js`)

- `POST /api/login` - Authenticate user, returns JWT in cookie.
- `GET /api/check_session` - Checks and refreshes JWT session.
- `POST /api/logout` - Logs out the current user.

### Staff & Attendance (`routes/attendance.js`)

- `POST /api/attendance_viewer` - View attendance for a given date.
- `POST /api/dept_summary` - Department/category attendance summary.
- `POST /api/individual_data` - Individual staff attendance breakdown.
- `POST /api/applyExemption` - Apply for attendance exemption.
- `GET /api/hr_exemptions_all` - HR: Get all exemptions.
- `GET /api/staff_exemptions/:staffId` - Staff: Get own exemptions.
- `POST /api/hr_exemptions/approve` - HR: Approve exemption.
- `POST /api/hr_exemptions/reject` - HR: Reject exemption.
- `POST /api/search/getuser` - Get staff data by ID.

### ESSL Device Integration (`routes/essl_functions.js`)

- `POST /api/add_user` - Add a user (runs Python script).
- `POST /api/delete_user` - Delete a user (runs Python script).
- `POST /api/delete_logs` - Delete device logs (runs Python script).

## File Structure

- `main.js` — Entry point, sets up Express and API routes.
- `db.js` — MySQL connection pool using environment variables.
- `routes/` — All API endpoints grouped by function.
- `routes/passWord.js` — Exports async password hashing utility.

## Notes

- Python integration assumes a script at a hardcoded Windows path. Adjust `routes/essl_functions.js` as needed.
- All SQL queries are parameterized for security.
- Make sure your MySQL schema matches the expected tables and columns.
