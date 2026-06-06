import "dotenv/config"; // Must be first — loads .env before any other module initializes
import express from "express";
import http from "http";
import cors from "cors";
import cookieParser from "cookie-parser";

import connectDB from "./config/db.js";
import { initSocket } from "./sockets/socketHandler.js";
import errorHandler from "./middlewares/error.js";
import User from "./models/User.js";

// Initialize database
connectDB();

const app = express();
const server = http.createServer(app);

// Initialize Sockets
const io = initSocket(server);

// Middleware config
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Enable CORS
const allowedOrigins = [
  "http://localhost:3000",
  "https://frontend-tau-ashen-61.vercel.app",
  "https://frontend-tau-ashen-61.vercel.app/",
];

if (process.env.CLIENT_URL) {
  allowedOrigins.push(process.env.CLIENT_URL);
  if (process.env.CLIENT_URL.endsWith("/")) {
    allowedOrigins.push(process.env.CLIENT_URL.slice(0, -1));
  } else {
    allowedOrigins.push(process.env.CLIENT_URL + "/");
  }
}

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// Seed admin and user accounts if DB is empty
const seedDatabase = async () => {
  try {
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log(
        "No user accounts found in database. Seeding initial accounts...",
      );

      console.log("Seeding completed successfully!");
      console.log("Admin Login: admin@saas.com / password123");
      console.log("User Login: user@saas.com / password123");
    } else {
      console.log("Users already exist in DB. Skipping seeding.");
    }
  } catch (seedErr) {
    console.error(`Database seeding failed: ${seedErr.message}`);
  }
};

// Execute Seeder
seedDatabase();

// Route files imports
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import projectRoutes from "./routes/projectRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import activityLogRoutes from "./routes/activityLogRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";

// Mount routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/activity-logs", activityLogRoutes);
app.use("/api/dashboard", dashboardRoutes);

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Project Management API is running",
  });
});

// Catch all unhandled routes
app.use("*", (req, res, next) => {
  res.status(404).json({
    success: false,
    error: `Endpoint ${req.originalUrl} not found`,
  });
});

// Global error handler middleware
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(
    `Server running in ${process.env.NODE_ENV || "development"} mode on port ${PORT}`,
  );
});
