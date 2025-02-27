const express = require("express");
const app = express();
require("dotenv").config();
const os = require("os");
const hostname = os.hostname();
const { sanitizeInput } = require('./src/middleware/security');
const cors = require("cors");
const PORT = process.env.PORT || 4444;

if (!process.env.FRONTEND) {
  throw new Error("FRONTEND URL not defined in environment variables");
}

app.use(sanitizeInput); // sanitization middleware

//Middleware
app.use(
  cors({
    origin: process.env.FRONTEND,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);
app.use(express.json()); // Make sure this comes before routes
app.use(express.urlencoded({ extended: true }));

const routesPath = require("./src/routes/routes.js");
app.use("/", routesPath);



const {
  databaseUpdateConnection,
} = require("./src/configuration/database/databaseUpdate.js");
databaseUpdateConnection();

app.get("/", (req, res) => {
  console.log("welcome in docker");
  res.status(200).json({
    success: true,
    message: "done",
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: "Internal Server Error",
    error: err.message,
  });
});

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT} and hostname ${hostname}`);
});
