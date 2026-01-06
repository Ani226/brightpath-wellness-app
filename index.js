// ================== IMPORTS ==================
const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const path = require("path");

// ================== APP INIT ==================
const app = express();

// ================== MIDDLEWARE (VERY IMPORTANT) ==================
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "brightpath_secret",
    resave: false,
    saveUninitialized: false
  })
);

// ================== MONGODB CONNECT ==================
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB error:", err));

// ================== SCHEMAS ==================
const UserSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String
});

const MoodSchema = new mongoose.Schema({
  userEmail: String,
  mood: String,
  stressLevel: Number,
  createdAt: { type: Date, default: Date.now }
});

const JournalSchema = new mongoose.Schema({
  userEmail: String,
  content: String,
  createdAt: { type: Date, default: Date.now }
});

const AnonymousSchema = new mongoose.Schema({
  message: String,
  createdAt: { type: Date, default: Date.now }
});

// ================== MODELS ==================
const User = mongoose.model("User", UserSchema);
const Mood = mongoose.model("Mood", MoodSchema);
const Journal = mongoose.model("Journal", JournalSchema);
const Anonymous = mongoose.model("Anonymous", AnonymousSchema);

// ================== AUTH MIDDLEWARE ==================
function isLoggedIn(req, res, next) {
  if (!req.session.user) {
    return res.redirect("/login.html");
  }
  next();
}

// ================== ROUTES ==================

// HOME
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// SIGNUP
app.post("/signup", async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!email || !password) return res.send("Missing fields");

  const exists = await User.findOne({ email });
  if (exists) return res.send("User already exists");

  await User.create({ name, email, password });
  res.redirect("/login.html");
});

// LOGIN
app.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.send("Missing credentials");

  const user = await User.findOne({ email, password });
  if (!user) return res.send("Invalid credentials");

  req.session.user = user;
  res.redirect("/dashboard.html");
});

// LOGOUT
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login.html");
  });
});

// ================== MOOD ==================
app.post("/mood", isLoggedIn, async (req, res) => {
  const body = req.body || {};
  const mood = body.mood;
  const stressLevel = body.stressLevel;

  if (!mood) {
    return res.status(400).send("Mood is required");
  }

  await Mood.create({
    userEmail: req.session.user.email,
    mood,
    stressLevel
  });

  res.sendStatus(200);
});

// ================== JOURNAL ==================
app.post("/journal", isLoggedIn, async (req, res) => {
  const { content } = req.body || {};
  if (!content) return res.status(400).send("Content required");

  await Journal.create({
    userEmail: req.session.user.email,
    content
  });

  res.sendStatus(200);
});

// ================== ANONYMOUS ==================
app.post("/anonymous", async (req, res) => {
  const body = req.body || {};
  const message = body.message;

  if (!message || message.trim() === "") {
    return res.status(400).send("Message is required");
  }

  await Anonymous.create({ message });
  res.sendStatus(200);
});

// ================== ADMIN ==================
app.get("/admin/data", async (req, res) => {
  const { email, mood } = req.query;

  const moodQuery = {};
  if (email) moodQuery.userEmail = email;
  if (mood) moodQuery.mood = mood;

  const moods = await Mood.find(moodQuery).sort({ createdAt: -1 });
  const feedbacks = await Journal.find().sort({ createdAt: -1 });

  res.json({ moods, feedbacks });
});

app.get("/admin/anonymous", async (req, res) => {
  const data = await Anonymous.find().sort({ createdAt: -1 });
  res.json(data);
});

// ================== SERVER ==================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 BrightPath running on port ${PORT}`);
});

