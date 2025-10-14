const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');

const APP_PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'replace_this_with_a_real_secret';
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, true);
  }
});

const app = express();
const httpServer = http.createServer(app);

const cors = require('cors');
const cookieParser = require('cookie-parser');

const CLIENT_ORIGIN = 'http://localhost:4200'; // если фронт на другом хосте — замените

app.use(cookieParser());
app.use(cors({
  origin: CLIENT_ORIGIN,
  credentials: true, 
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

const io = new Server(httpServer, {
  cors: { origin: 'http://localhost:4200', credentials: true },
  maxHttpBufferSize: 100 * 1024 * 1024,
  perMessageDeflate: false
});

app.use('/uploads', express.static(UPLOAD_DIR));

const users = [
  {
    id: 1,
    username: 'student',
    //password123
    passwordHash: '$2b$10$2V6aRzYGqIlEMKFky4BWee7hGPKiE2p0ihb3uJ5Bna3T0pDYIjZ52'
  }
];
let tasks = [];


function verifyJwtFromHeader(req) {
  const auth = req.headers['authorization'] || '';
  if (!auth) return null;
  const m = auth.match(/^Bearer (.+)$/);
  if (!m) return null;
  const token = m[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return { id: payload.id, username: payload.username };
  } catch (err) {
    return null;
  }
}


app.post('/api/upload', (req, res, next) => {
  const user = verifyJwtFromHeader(req);
  if (!user) {
    console.log('UPLOAD: unauthorized request, headers=', req.headers);
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.user = user;
  next();
}, upload.single('file'), (req, res) => {
  if (!req.file) {
    console.log('UPLOAD: no file, user=', req.user);
    return res.status(400).json({ error: 'No file' });
  }
  console.log('UPLOAD: user=', req.user.username, 'saved=', req.file.filename, 'orig=', req.file.originalname);
  const fileUrl = `/uploads/${req.file.filename}`;
  return res.status(200).json({ ok: true, filename: req.file.filename, url: fileUrl });
});


io.use((socket, next) => {
  const token = socket.handshake.auth && socket.handshake.auth.token;
  if (!token) return next();
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    socket.user = { id: payload.id, username: payload.username };
    return next();
  } catch (err) {
    return next();
  }
});

io.on('connection', (socket) => {
  console.log('Client connected', socket.id, 'user=', socket.user && socket.user.username);

  socket.on('login', (payload, cb) => {
    const { username, password } = payload || {};
    const user = users.find(u => u.username === username);
    if (!user) return cb && cb({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });
    socket.user = { id: user.id, username: user.username };
    cb && cb({ token, user: socket.user });
    socket.emit('auth:ok', { user: socket.user });
  });

  socket.on('addTask', (payload, cb) => {
    console.log('SOCKET addTask called by', socket.id, 'user=', socket.user && socket.user.username, 'payload=', payload);
    if (!socket.user) {
      console.log('SOCKET addTask denied: unauthorized');
      return cb && cb({ error: 'Unauthorized' });
    }
    const { title, date, fileName } = payload || {};
    if (!title) return cb && cb({ error: 'Missing title' });

    const newTask = {
      id: Date.now(),
      title,
      status: 'pending',
      date,
      file: fileName || null,
      createdBy: socket.user.username
    };
    tasks.push(newTask);
    cb && cb({ ok: true, task: newTask });
    io.emit('taskAdded', newTask);
  });

  socket.on('getTasks', (params, cb) => {
    if (!socket.user) return cb && cb({ error: 'Unauthorized' });
    const filter = (params && params.status) || 'all';
    let filtered = tasks;
    if (filter !== 'all') filtered = tasks.filter(t => t.status === filter);
    cb && cb({ ok: true, tasks: filtered });
  });

  socket.on('markDone', ({ id }, cb) => {
    if (!socket.user) return cb && cb({ error: 'Unauthorized' });
    const tid = parseInt(id, 10);
    const t = tasks.find(x => x.id === tid);
    if (!t) return cb && cb({ error: 'Not found' });
    t.status = 'done';
    cb && cb({ ok: true, task: t });
    io.emit('taskUpdated', t);
  });

  socket.on('deleteTask', ({ id }, cb) => {
    if (!socket.user) return cb && cb({ error: 'Unauthorized' });
    const tid = parseInt(id, 10);
    const initial = tasks.length;
    tasks = tasks.filter(x => x.id !== tid);
    if (tasks.length === initial) return cb && cb({ error: 'Not found' });
    cb && cb({ ok: true });
    io.emit('taskDeleted', { id: tid });
  });

  socket.on('disconnect', (reason) => {
    console.log('Client disconnected', socket.id, reason);
  });
});

httpServer.listen(APP_PORT, () => {
  console.log(`Server running on http://localhost:${APP_PORT}`);
  console.log(`Uploads served at http://localhost:${APP_PORT}/uploads/...`);
});
