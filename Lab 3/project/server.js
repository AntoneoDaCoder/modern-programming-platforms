const express = require("express");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const app = express();

const JWT_SECRET = "replace_this_with_a_real_secret";
const JWT_EXPIRES_IN = "1h"; // или '3600s'

app.use(cors({
  origin: "http://localhost:4200",
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const users = [
  {
    id: 1,
    username: "student",
    passwordHash: "$2b$10$2V6aRzYGqIlEMKFky4BWee7hGPKiE2p0ihb3uJ5Bna3T0pDYIjZ52"
  }
];

function authMiddleware(req, res, next) {
  const token = req.cookies && req.cookies.token;
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; // { id, username, iat, exp }
    next();
  } catch (err) {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

let tasks = [];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "uploads"));
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });


app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username);
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

  res.cookie("token", token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 1000
  });

  return res.status(200).json({ message: "Logged in" });
});

app.post("/api/auth/logout", (req, res) => {
  res.clearCookie("token");
  return res.status(200).json({ message: "Logged out" });
});


app.get("/api/tasks", authMiddleware, (req, res) => {
  const filter = req.query.status || "all";
  let filtered = tasks;
  if (filter !== "all") {
    filtered = tasks.filter(t => t.status === filter);
  }
  res.status(200).json(filtered);
});

app.post("/api/tasks", authMiddleware, upload.single("file"), (req, res) => {
  const { title, date } = req.body;
  const newTask = {
    id: Date.now(),
    title,
    status: "pending",
    date,
    file: req.file ? req.file.filename : null,
    createdBy: req.user.username
  };
  tasks.push(newTask);
  res.status(201).json(newTask);
});

app.put("/api/tasks/:id/done", authMiddleware, (req, res) => {
  const id = parseInt(req.params.id);
  let task = tasks.find(t => t.id === id);
  if (!task) return res.status(404).json({ error: "Not found" });

  task.status = "done";
  res.status(200).json(task);
});

app.delete("/api/tasks/:id", authMiddleware, (req, res) => {
  const id = parseInt(req.params.id);
  const initialLength = tasks.length;
  tasks = tasks.filter(t => t.id !== id);

  if (tasks.length === initialLength) {
    return res.status(404).json({ error: "Not found" });
  }
  res.status(204).send();
});

app.listen(3000, () => {
  console.log("REST API with JWT auth running on http://localhost:3000");
});
