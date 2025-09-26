const express = require("express");
const multer = require("multer");
const path = require("path");

const app = express();

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

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

let tasks = [];

app.get("/", (req, res) => {
  const filter = req.query.status || "all";
  let filtered = tasks;
  if (filter !== "all") {
    filtered = tasks.filter(t => t.status === filter);
  }
  res.render("index", { tasks: filtered, filter });
});

app.post("/add", upload.single("file"), (req, res) => {
  const { title, date } = req.body;
  tasks.push({
    id: Date.now(),
    title,
    status: "pending",
    date,
    file: req.file ? req.file.filename : null
  });
  res.redirect("/");
});

app.post("/done/:id", (req, res) => {
  const id = parseInt(req.params.id);
  tasks = tasks.map(t => (t.id === id ? { ...t, status: "done" } : t));
  res.redirect("/");
});

app.listen(3000, () =>
  console.log("Server running on http://localhost:3000")
);
