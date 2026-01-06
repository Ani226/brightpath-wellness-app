
// ========================
// BrightPath Backend
// ========================

const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

// ========================
// Middleware (IMPORTANT)
// ========================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "brightpath_secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Render handles HTTPS
      maxAge: 1000 * 60 * 60 * 24,
    },
  })
);

// ========================
// Static files
// ========================
app.use(express.static(path.join(__dirname, "public")));

// ========================
// MongoDB Connection
// ========================
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err));

// ========================
// Schemas
// ========================
const UserSchema = new mongoose.Schema({
  email: String,
  password: String,
});

const MoodSchema = new mongoose.Schema({
  userEmail: String,
  mood: String,
  createdAt: { type: Date, default: Date.now },
});

const ConfessionSchema = new mongoose.Schema({
  message: String,
  createdAt: { type: Date, default: Date.now },
});

const FeedbackSchema = new mongoose.Schema({
  message: String,
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.model("User", UserSchema);
const Mood = mongoose.model("Mood", MoodSchema);
const Confession = mongoose.model("Confession", ConfessionSchema);
const Feedback = mongoose.model("Feedback", FeedbackSchema);

// ========================
// Auth Middleware
// ========================
function isLoggedIn(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  res.redirect("/login.html");
}

// ========================
// Routes
// ========================

// Home
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Login page
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// Signup page
app.get("/signup", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "signup.html"));
});

// Dashboard
app.get("/dashboard", isLoggedIn, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

// Admin panel
app.get("/admin", async (req, res) => {
  const moods = await Mood.find().sort({ createdAt: -1 });
  const confessions = await Confession.find().sort({ createdAt: -1 });
  const feedbacks = await Feedback.find().sort({ createdAt: -1 });

  res.json({ moods, confessions, feedbacks });
});

// ========================
// Auth APIs
// ========================
app.post("/signup", async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).send("Missing fields");
  }

  const exists = await User.findOne({ email });
  if (exists) return res.send("User already exists");

  await User.create({ email, password });
  res.redirect("/login.html");
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.redirect("/login.html");
  }

  const user = await User.findOne({ email, password });
  if (!user) return res.redirect("/login.html");

  req.session.user = user.email;
  res.redirect("/dashboard");
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login.html");
  });
});

// ========================
// Wellness APIs
// ========================

// Mood submit (SAFE)
app.post("/submit-mood", isLoggedIn, async (req, res) => {
  const mood = req.body?.mood;

  if (!mood) {
    return res.status(400).send("Mood is required");
  }

  await Mood.create({
    userEmail: req.session.user,
    mood,
  });

  res.redirect("/dashboard");
});

// Anonymous confession (SAFE)
app.post("/confession", async (req, res) => {
  const message = req.body?.message;

  if (!message) {
    return res.status(400).send("Message required");
  }

  await Confession.create({ message });
  res.redirect("/dashboard");
});

// Feedback (SAFE)
app.post("/feedback", async (req, res) => {
  const message = req.body?.message;

  if (!message) {
    return res.status(400).send("Message required");
  }

  await Feedback.create({ message });
  res.redirect("/dashboard");
});

// ========================
// Server Start
// ========================
app.listen(PORT, () => {
  console.log(`🚀 BrightPath running on port ${PORT}`);
});

