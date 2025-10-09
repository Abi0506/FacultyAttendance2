// app.js
const express = require("express");
const cookieParser = require('cookie-parser');
const cors = require("cors");
const session = require('express-session');
const passport = require('passport');
require('dotenv').config();
const app = express();
const { startPythonScript } = require('./server');
const PORT = 5050;
const corsOptions = {
  origin: ['http://10.10.33.251:8000', 'http://localhost:8000', 'http://localhost:3001','http://bio.psgitech.ac.in:8000','http://bio.psgitech.ac.in',"http://bio.psgitech.ac.in:8000/", 'http://10.10.33.251:3000', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// const pythonProcess = startPythonScript();

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// Session middleware (required for Passport)
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // set to true if using HTTPS
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

const googleAuthRouter = require('./routes/googleAuth');
app.use('/auth', googleAuthRouter);

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

process.on('SIGINT', () => {
  console.log('Shutting down Node.js server...');
  pythonProcess.kill(); // Terminate Python process
  process.exit();
});


const loginRouter = require("./routes/login");
const attendanceRouter = require("./routes/attendance");
const esslFunctionsRouter = require("./routes/essl_functions");
const leaveRouter = require("./routes/leave");
const instant = require("./routes/live_attendance");

app.use("/api/essl", esslFunctionsRouter);
app.use("/api/login", loginRouter);
app.use("/api/attendance", attendanceRouter);
app.use("/api/leave", leaveRouter);
app.use("/api/instant_attendance",instant)


app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
