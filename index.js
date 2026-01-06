const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const path = require("path");

const app = express();

/* =======================
   BASIC MIDDLEWARE (VERY IMPORTANT)
======================= */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =======================
   SESSION (OK FOR NOW)
======================= */
app.use(
  session({
    secret: "brightpath_secret_key",
    resave: false,
    saveUninitialized: false,
  })
);

/* =======================
   STATIC FILES
======================= */
app.use(express.static(path.join(__dirname, "public")));

/* =======================
   MONGODB CONNECTION
======================= */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err));

/* =======================
   SCHEMAS & MODELS
======================= */

// Mood
const MoodSchema = new mongoose.Schema({
  mood: String,
  createdAt: { type: Date, default: Date.now },
});
const Mood = mongoose.model("Mood", MoodSchema);

// Confession
const ConfessionSchema = new mongoose.Schema({
  message: String,
  createdAt: { type: Date, default: Date.now },
});
const Confession = mongoose.model("Confession", ConfessionSchema);

// Users (for admin login)
const UserSchema = new mongoose.Schema({
  username: String,
  password: String,
});
const User = mongoose.model("User", UserSchema);

/* =======================
   AUTH MIDDLEWARE
======================= */
function isAdmin(req, res, next) {
  if (req.session && req.session.admin) return next();
  res.redirect("/admin-login.html");
}

/* =======================
   ROUTES
======================= */

// Home
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

/* ---------- LOGIN ---------- */
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  const admin = await User.findOne({ username, password });
  if (!admin) return res.send("Invalid credentials");

  req.session.admin = true;
  res.redirect("/admin");
});

/* ---------- ADMIN DASHBOARD ---------- */
app.get("/admin", isAdmin, async (req, res) => {
  const moods = await Mood.find().sort({ createdAt: -1 });
  const confessions = await Confession.find().sort({ createdAt: -1 });

  res.send(`
    <h1>Admin Panel</h1>

    <h2>Moods</h2>
    <ul>
      ${moods.map((m) => `<li>${m.mood}</li>`).join("")}
    </ul>

    <h2>Anonymous Confessions</h2>
    <ul>
      ${confessions.map((c) => `<li>${c.message}</li>`).join("")}
    </ul>

    <a href="/logout">Logout</a>
  `);
});

/* ---------- LOGOUT ---------- */
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

/* ---------- MOOD SUBMIT ---------- */
app.post("/submit-mood", async (req, res) => {
  const { mood } = req.body;

  if (!mood) return res.status(400).send("Mood missing");

  await Mood.create({ mood });
  res.redirect("/dashboard.html");
});

/* ---------- CONFESSION SUBMIT ---------- */
app.post("/confess", async (req, res) => {
  const { message } = req.body;

  if (!message) return res.status(400).send("Message missing");

  await Confession.create({ message });
  res.redirect("/dashboard.html");
});

/* =======================
   SERVER START
======================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 BrightPath running on port ${PORT}`);
});

