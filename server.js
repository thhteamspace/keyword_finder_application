require("dotenv").config();  // Load environment variables
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// --- Connect to MongoDB Atlas using .env ---
const dbURI = "mongodb+srv://Jitesh001:Jitesh001@twicky.fxotzly.mongodb.net/?retryWrites=true&w=majority"
mongoose.connect(dbURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log("✅ MongoDB Connected..."))
  .catch(err => console.error("❌ MongoDB connection error:", err));

// API Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/chat", require("./routes/chat"));

// --- Serve Frontend Static Files ---
app.use(express.static(path.join(__dirname, "public")));

// Serve specific HTML files
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.get("/register", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "register.html"));
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Server Port
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => console.log(`🚀 Server started on port ${PORT}`));
