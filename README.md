# Faculty Attendance

**Faculty Attendance** is a full-stack web application for tracking faculty attendance using data from an **eSSL face recognition device**. A Python script pulls attendance logs from the device, processes late minutes, and stores records in a MySQL database. An HR portal allows for approving exemptions and viewing complete attendance data.

---

## 📌 Features

- Attendance data sourced directly from **eSSL face monitoring device**
- Python scripts automatically fetch and process logs
- Calculates **late minutes** based on check-in times
- HR dashboard to:
  - View attendance data
  - Approve exemptions
  - Monitor late arrivals
- Modular frontend (React) and backend (Node.js + Express)
- MySQL for secure data persistence

---

## 📁 Project Structure

```

FacultyAttendance2/
├── frontend/         # React-based frontend
├── backend/          # Node.js backend with Express
│   └── dumps/        # MySQL database scripts
├── FaceMachine/      # Python scripts (auto-called, no manual setup needed)
└── README.md

```

---

## 🚀 Installation & Setup

Follow the steps below to run the application locally.

### 1. Clone the Repository

```bash
git clone https://github.com/Abi0506/FacultyAttendance2.git
cd FacultyAttendance2
```

---

### 2. Frontend Setup

Open a new terminal

```bash
cd frontend
npm install
npm start
```

> Frontend runs at: `http://localhost:3000`

---

### 3. Backend Setup

Open a new terminal

```bash
cd backend
npm install
nodemon main.js
```

> Backend runs at: `http://localhost:5500`

---

### 4. Create a `.env` File

Inside the `backend` folder, the frontend folder and the FaceMachine folder, create a `.env` file with the following contents:

```env

//Required
DB_HOST=your_mysql_host
DB_USER=your_mysql_user
DB_PASS=your_mysql_password
DB_NAME=your_database
REACT_APP_NODE_ENV = "development"
SECRET_KEY=your_jwt_secret -- Some random long string
FRONTEND_URL="http://192.168.29.77:8000"


// Optional For basic functinalities
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_CALLBACK_URL=google_callback_url
SESSION_SECRET=your_google_secret
EMAIL_USER=your_email_id
EMAIL_PASS=your_email_app_password

PYTHON_PATH_VENV = "C:\Users\aryaa\Desktop\Arya.A\Projects\SDC Projects\FacultyAtt\FacultyAttendance2\FaceMachine\venv\Scripts\python.exe"
PYTHON_SCRIPT_PATH = "C:\Users\aryaa\Desktop\Arya.A\Projects\SDC Projects\FacultyAtt\FacultyAttendance2\FaceMachine"
PYTHON_SCRIPT_PATH1 = "C:\Users\aryaa\Desktop\Arya.A\Projects\SDC Projects\FacultyAtt\FacultyAttendance2\FaceMachine\instant_logs.py"
PYTHON_PROCESS_PATH = "C:\Users\aryaa\AppData\Local\Programs\Python\Python313\python.exe"


```

> Replace `your_mysql_username` and `your_mysql_password` and other required fields with your actual MySQL credentials.

---

### 5. MySQL Database Setup

The full database schema is available in the folder:
📂 `backend/dumps/`

You can import the SQL file using your MySQL client (like MySQL Workbench, phpMyAdmin, or CLI), or execute the commands manually. Here's a basic example:

```sql
-- Create the database
CREATE DATABASE faculty_attendance;

-- Use the database
USE faculty_attendance;

-- Example table for faculty and attendance
-- (Full schema and sample data are available in backend/dumps/)
```

---

## ⚙️ System Requirements

Ensure the following are installed:

* **Node.js** (v14 or later)
* **npm** (v6 or later)
* **MySQL Server**
* **eSSL face monitoring device** connected via network
* **nodemon** (install globally if not already: `npm install -g nodemon`)

---

## 📌 Usage

1. Connect the eSSL face device to your local network.
2. Start the backend and frontend as described above.
3. The backend will automatically fetch attendance logs via Python.
4. HR can log in via the frontend to:

   * View attendance records
   * See calculated **late minutes**
   * Approve or deny **exemptions**

---

## 📄 License

This project is licensed under the MIT License.

---

## 👤 Authors

* **Arya A** -  – [@aryaanand055](https://github.com/aryaanand055)
