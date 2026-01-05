// ================= IMPORTS =================
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const session = require("express-session");
const path = require("path");

const app = express();

// ================= MIDDLEWARE =================
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    secret: "brightpath_secret_key",
    resave: false,
    saveUninitialized: false
  })
);

// ================= MONGODB =================
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("✅ MongoDB connected"))
.catch(err => console.log("❌ MongoDB error:", err));

// ================= SCHEMAS =================

// User
const UserSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  role: { type: String, default: "student" }
});

// Mood
const MoodSchema = new mongoose.Schema({
  userEmail: String,
  mood: String,
  stressLevel: Number,
  createdAt: { type: Date, default: Date.now }
});

// Journal
const JournalSchema = new mongoose.Schema({
  userEmail: String,
  content: String,
  createdAt: { type: Date, default: Date.now }
});

// Feedback (identified)
const FeedbackSchema = new mongoose.Schema({
  userEmail: String,
  message: String,
  createdAt: { type: Date, default: Date.now }
});

// Anonymous Confession
const AnonymousSchema = new mongoose.Schema({
  message: String,
  createdAt: { type: Date, default: Date.now }
});

// ================= MODELS =================
const User = mongoose.model("User", UserSchema);
const Mood = mongoose.model("Mood", MoodSchema);
const Journal = mongoose.model("Journal", JournalSchema);
const Feedback = mongoose.model("Feedback", FeedbackSchema);
const Anonymous = mongoose.model("Anonymous", AnonymousSchema);

// ================= AUTH =================
function isLoggedIn(req, res, next) {
  req.session.user ? next() : res.redirect("/login.html");
}

function isAdmin(req, res, next) {
  req.session.role === "admin" ? next() : res.send("❌ Access denied");
}

// ================= ROUTES =================

// Home
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ================= AUTH =================
app.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;
  if (await User.findOne({ email })) return res.send("User exists");

  const hashed = await bcrypt.hash(password, 10);
  await User.create({ name, email, password: hashed });
  res.redirect("/login.html");
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.send("Invalid credentials");

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.send("Invalid credentials");

  req.session.user = user.email;
  req.session.role = user.role;

  user.role === "admin"
    ? res.redirect("/admin")
    : res.redirect("/dashboard.html");
});

app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/login.html");
});

// ================= DASHBOARD =================
app.get("/dashboard", isLoggedIn, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

// ================= MOOD =================
app.post("/mood", isLoggedIn, async (req, res) => {
  await Mood.create({
    userEmail: req.session.user,
    mood: req.body.mood,
    stressLevel: req.body.stressLevel
  });
  res.send("Mood saved");
});

app.get("/my-moods", isLoggedIn, async (req, res) => {
  const moods = await Mood.find({ userEmail: req.session.user })
    .sort({ createdAt: -1 });
  res.json(moods);
});

// ================= JOURNAL =================
app.post("/journal", isLoggedIn, async (req, res) => {
  await Journal.create({
    userEmail: req.session.user,
    content: req.body.content
  });
  res.send("Journal saved");
});

app.get("/my-journals", isLoggedIn, async (req, res) => {
  const journals = await Journal.find({ userEmail: req.session.user })
    .sort({ createdAt: -1 });
  res.json(journals);
});

// ================= FEEDBACK =================
app.post("/feedback", isLoggedIn, async (req, res) => {
  await Feedback.create({
    userEmail: req.session.user,
    message: req.body.message
  });
  res.send("Feedback saved");
});

// ================= ANONYMOUS =================
app.post("/anonymous", async (req, res) => {
  await Anonymous.create({ message: req.body.message });
  res.send("Anonymous message received");
});

// ================= ADMIN =================
app.get("/admin", isLoggedIn, isAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.get("/admin/data", isLoggedIn, isAdmin, async (req, res) => {
  const moods = await Mood.find().sort({ createdAt: -1 });
  const feedbacks = await Feedback.find().sort({ createdAt: -1 });
  res.json({ moods, feedbacks });
});

app.get("/admin/anonymous", isLoggedIn, isAdmin, async (req, res) => {
  const messages = await Anonymous.find().sort({ createdAt: -1 });
  res.json(messages);
});

// ================= SERVER =================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 BrightPath running on port ${PORT}`);
});

