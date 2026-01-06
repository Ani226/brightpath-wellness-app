const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

/* =========================
   MIDDLEWARE (CRITICAL)
========================= */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "brightpath_secret",
    resave: false,
    saveUninitialized: false,
  })
);

/* =========================
   STATIC FILES
========================= */
app.use(express.static(path.join(__dirname, "public")));

/* =========================
   DATABASE
========================= */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err));

/* =========================
   SCHEMAS
========================= */
const UserSchema = new mongoose.Schema({
  username: String,
  password: String,
  role: { type: String, default: "user" }, // user | admin
});

const MoodSchema = new mongoose.Schema({
  username: String,
  mood: String,
  createdAt: { type: Date, default: Date.now },
});

const ConfessionSchema = new mongoose.Schema({
  message: String,
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.model("User", UserSchema);
const Mood = mongoose.model("Mood", MoodSchema);
const Confession = mongoose.model("Confession", ConfessionSchema);

/* =========================
   AUTH MIDDLEWARE
========================= */
function isLoggedIn(req, res, next) {
  if (req.session.user) return next();
  res.redirect("/login.html");
}

function isAdmin(req, res, next) {
  if (req.session.user && req.session.role === "admin") return next();
  res.redirect("/login.html");
}

/* =========================
   ROUTES
========================= */

// Default
app.get("/", (req, res) => {
  res.redirect("/login.html");
});

/* ---------- SIGNUP ---------- */
app.post("/signup", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password)
    return res.send("All fields required");

  const exists = await User.findOne({ username });
  if (exists) return res.send("User already exists");

  await User.create({ username, password });
  res.redirect("/login.html");
});

/* ---------- LOGIN ---------- */
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  const user = await User.findOne({ username, password });
  if (!user) return res.send("Invalid credentials");

  req.session.user = user.username;
  req.session.role = user.role;

  if (user.role === "admin") {
    res.redirect("/admin");
  } else {
    res.redirect("/dashboard.html");
  }
});

/* ---------- LOGOUT ---------- */
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login.html");
  });
});

/* ---------- DASHBOARD ---------- */
app.get("/dashboard", isLoggedIn, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

/* ---------- MOOD SUBMIT ---------- */
app.post("/submit-mood", isLoggedIn, async (req, res) => {
  const { mood } = req.body;
  if (!mood) return res.send("Mood missing");

  await Mood.create({
    username: req.session.user,
    mood,
  });

  res.redirect("/dashboard.html");
});

/* ---------- CONFESSION ---------- */
app.post("/confession", async (req, res) => {
  const { message } = req.body;
  if (!message) return res.send("Message missing");

  await Confession.create({ message });
  res.redirect("/dashboard.html");
});

/* ---------- ADMIN PANEL ---------- */
app.get("/admin", isAdmin, async (req, res) => {
  const moods = await Mood.find().sort({ createdAt: -1 });
  const confessions = await Confession.find().sort({ createdAt: -1 });

  res.send(`
    <h1>Admin Panel</h1>

    <h2>Moods</h2>
    <ul>
      ${moods.map(m => `<li>${m.username}: ${m.mood}</li>`).join("")}
    </ul>

    <h2>Anonymous Confessions</h2>
    <ul>
      ${confessions.map(c => `<li>${c.message}</li>`).join("")}
    </ul>

    <a href="/logout">Logout</a>
  `);
});

/* =========================
   START SERVER
========================= */
app.listen(PORT, () => {
  console.log(`🚀 BrightPath running on port ${PORT}`);
});
