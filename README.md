
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

````

---

## 🚀 Installation & Setup

Follow the steps below to run the application locally.

### 1. Clone the Repository

```bash
git clone https://github.com/Abi0506/FacultyAttendance2.git
cd FacultyAttendance2
````

---

### 2. Frontend Setup

```bash
cd frontend
npm install
npm start
```

> Frontend runs at: `http://localhost:3000`

---

### 3. Backend Setup

```bash
cd ../backend
npm install
nodemon main.js
```

> Backend runs at: `http://localhost:5500`

---

### 4. Create a `.env` File

Inside the `backend` folder, create a `.env` file with the following contents:

```env
DB_HOST=localhost
DB_USER=your_mysql_username
DB_PASSWORD=your_mysql_password
DB_NAME=faculty_attendance
```

> Replace `your_mysql_username` and `your_mysql_password` with your actual MySQL credentials.

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

---

```

---

Let me know if you'd like help generating a `.env.example`, or if you'd like to automate the SQL import process as part of the setup!
```
