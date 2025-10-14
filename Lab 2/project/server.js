const express = require("express");
const multer = require("multer");
const path = require("path");
const cors = require("cors");

const app = express();
app.use(cors()); 
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

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


app.get("/api/tasks", (req, res) => {
  const filter = req.query.status || "all";
  let filtered = tasks;
  if (filter !== "all") {
    filtered = tasks.filter(t => t.status === filter);
  }
  res.status(200).json(filtered);
});


app.post("/api/tasks", upload.single("file"), (req, res) => {
  const { title, date } = req.body;
  const newTask = {
    id: Date.now(),
    title,
    status: "pending",
    date,
    file: req.file ? req.file.filename : null
  };
  tasks.push(newTask);
  res.status(201).json(newTask);
});


app.put("/api/tasks/:id/done", (req, res) => {
  const id = parseInt(req.params.id);
  let task = tasks.find(t => t.id === id);
  if (!task) return res.status(404).json({ error: "Not found" });

  task.status = "done";
  res.status(200).json(task);
});


app.delete("/api/tasks/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const initialLength = tasks.length;
  tasks = tasks.filter(t => t.id !== id);

  if (tasks.length === initialLength) {
    return res.status(404).json({ error: "Not found" });
  }
  res.status(204).send();
});

app.listen(3000, () => {
  console.log("REST API running on http://localhost:3000");
});
