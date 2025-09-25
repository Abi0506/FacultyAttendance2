# Attendance Backend

A Node.js (Express) backend for managing staff attendance, leave tracking, and user authentication, with MySQL as the database layer.

## Features

- **User Authentication:**
  - Login with JWT-based sessions and password hashing (bcryptjs).
  - Login with Google (OAuth 2.0) using Passport.js.
  - Password reset via email (reset link sent to user).
- **Staff Management:** Add/delete staff, assign departments, designations, and working categories.
- **Attendance Tracking:** View daily logs, department summaries, and individual records.
- **Exemption Handling:** Workflow for submitting, tracking, and approving/rejecting attendance exemptions.
- **Python Integration:** Uses a Python script for certain ESSL device functions.
- **API Security:** Uses CORS, cookies, and environment-based secrets.
- **Frontend Integration:**
  - React frontend with custom alerts, Google login button, and password reset modal.
  - Role-based routing for HR and staff dashboards.

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
  GOOGLE_CLIENT_ID=your_client_id
  GOOGLE_CLIENT_SECRET=your_client_secret
  GOOGLE_CALLBACK_URL=google_callback_url
  SESSION_SECRET=your_google_secret
  EMAIL_USER=your_email_id
  EMAIL_PASS=your_email_app_password
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

### Auth Routes (`routes/login.js` & `routes/googleAuth.js`)

- `POST /api/login/login` - Authenticate user, returns JWT in cookie.
- `GET /api/login/check_session` - Checks and refreshes JWT session.
- `POST /api/login/logout` - Logs out the current user.
- `POST /api/login/reset-password` - Sends password reset link to user's email.
- `GET /auth/google` - Initiates Google OAuth login.
- `GET /auth/google/callback` - Handles Google OAuth callback, sets JWT cookie, redirects to frontend.
- `GET /auth/logout` - Logs out Google user.

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
- `routes/login.js` — Login, session, logout, and password reset routes.
- `routes/googleAuth.js` — Google OAuth login/logout routes and Passport strategy.
- `routes/passWord.js` — Exports async password hashing utility.

## Notes

- Python integration assumes a script at a hardcoded Windows path. Adjust `routes/essl_functions.js` as needed.
- All SQL queries are parameterized for security.
- Make sure your MySQL schema matches the expected tables and columns.
- For Google login, set up OAuth credentials in Google Cloud Console and update `.env` accordingly.
- Frontend uses a custom axios instance for API requests; update base URL as needed.
