// Vercel serverless function entry point
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB Atlas
const dbURI = "mongodb+srv://Jitesh001:Jitesh001@twicky.fxotzly.mongodb.net/?retryWrites=true&w=majority";

// MongoDB connection with error handling
mongoose.connect(dbURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log("✅ MongoDB Connected..."))
  .catch(err => {
    console.error("❌ MongoDB connection error:", err);
    // Don't crash the function if DB connection fails
  });

// Import routes with proper error handling
try {
  const authRoutes = require('../routes/auth');
  const chatRoutes = require('../routes/chat');
  
  // API Routes
  app.use("/api/auth", authRoutes);
  app.use("/api/chat", chatRoutes);
} catch (error) {
  console.error("Error loading routes:", error);
}

// Serve static files
app.use(express.static(path.join(__dirname, "../public")));

// Serve specific HTML files
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "../public", "login.html"));
});

app.get("/register", (req, res) => {
  res.sendFile(path.join(__dirname, "../public", "register.html"));
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public", "index.html"));
});

// Catch-all handler for client-side routing
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../public", "index.html"));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

module.exports = app;
