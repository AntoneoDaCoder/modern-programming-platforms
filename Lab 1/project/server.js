const express = require("express");
const multer = require("multer");
const path = require("path");

const app = express();
const upload = multer({ dest: "uploads/" });

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));

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

app.listen(3000, () => console.log("Server running on http://localhost:3000"));
