// app.js
const express = require("express");
const cookieParser = require('cookie-parser');
const cors = require("cors");
const app = express();

const PORT = 5050;
const corsOptions = {
  origin: ['http://10.10.33.251:8000','http://localhost:8000','http://localhost:3001' ,'http://10.10.33.251:3000',],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());



const loginRouter = require("./routes/login");
const attendanceRouter = require("./routes/attendance");
const esslFunctionsRouter = require("./routes/essl_functions");

app.use("/api/essl", esslFunctionsRouter);
app.use("/api/login", loginRouter);
app.use("/api/attendance", attendanceRouter);


app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
