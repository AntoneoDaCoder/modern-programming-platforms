const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const bcrypt = require("bcrypt");

const { makeExecutableSchema } = require('@graphql-tools/schema');
const { execute, subscribe } = require('graphql');
const { WebSocketServer } = require('ws');
const { makeServer, CloseCode } = require('graphql-ws'); 
const { PubSub } = require('graphql-subscriptions');

const APP_PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'replace_this_with_a_real_secret';
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const CLIENT_ORIGIN = 'http://localhost:4200';

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

app.use(cookieParser());
app.use(cors({
  origin: CLIENT_ORIGIN,
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

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


const typeDefs = `
  type User {
    id: ID!
    username: String!
  }

  type Task {
    id: ID!
    title: String!
    status: String!
    date: String
    file: String
    createdBy: String
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type Query {
    getTasks(status: String): [Task!]!
    me: User
  }

  type Mutation {
    login(username: String!, password: String!): AuthPayload!
    addTask(title: String!, date: String, fileName: String): Task!
    markDone(id: ID!): Task!
    deleteTask(id: ID!): Boolean!
  }

  type Subscription {
    taskAdded: Task!
    taskUpdated: Task!
    taskDeleted: ID!
  }
`;

const pubsub = new PubSub();
const EVENTS = {
  TASK_ADDED: 'TASK_ADDED',
  TASK_UPDATED: 'TASK_UPDATED',
  TASK_DELETED: 'TASK_DELETED'
};

const resolvers = {
  Query: {
    getTasks: (_, args, ctx) => {
      const user = ctx.user;
      if (!user) throw new Error('Unauthorized');
      const filter = (args && args.status) || 'all';
      if (filter === 'all') return tasks;
      return tasks.filter(t => t.status === filter);
    },
    me: (_, __, ctx) => {
      return ctx.user || null;
    }
  },
  Mutation: {
    login: async (_, { username, password }) => {
      const user = users.find(u => u.username === username);
      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!user || !ok) throw new Error('Invalid credentials');

      const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });
      return { token, user: { id: user.id, username: user.username } };
    },
    addTask: (_, { title, date, fileName }, ctx) => {
      const user = ctx.user;
      if (!user) throw new Error('Unauthorized');
      if (!title) throw new Error('Missing title');
      const newTask = {
        id: Date.now(),
        title,
        status: 'pending',
        date: date || null,
        file: fileName || null,
        createdBy: user.username
      };
      tasks.push(newTask);
      pubsub.publish(EVENTS.TASK_ADDED, { taskAdded: newTask });
      return newTask;
    },
    markDone: (_, { id }, ctx) => {
      const user = ctx.user;
      if (!user) throw new Error('Unauthorized');
      const tid = parseInt(id, 10);
      const t = tasks.find(x => x.id === tid);
      if (!t) throw new Error('Not found');
      t.status = 'done';
      pubsub.publish(EVENTS.TASK_UPDATED, { taskUpdated: t });
      return t;
    },
    deleteTask: (_, { id }, ctx) => {
      const user = ctx.user;
      if (!user) throw new Error('Unauthorized');
      const tid = parseInt(id, 10);
      const initial = tasks.length;
      tasks = tasks.filter(x => x.id !== tid);
      if (tasks.length === initial) throw new Error('Not found');
      pubsub.publish(EVENTS.TASK_DELETED, { taskDeleted: tid });
      return true;
    }
  },
  Subscription: {
    taskAdded: {
      subscribe: () => pubsub.asyncIterator([EVENTS.TASK_ADDED])
    },
    taskUpdated: {
      subscribe: () => pubsub.asyncIterator([EVENTS.TASK_UPDATED])
    },
    taskDeleted: {
      subscribe: () => pubsub.asyncIterator([EVENTS.TASK_DELETED])
    }
  }
};

const schema = makeExecutableSchema({ typeDefs, resolvers });




app.use(express.json()); 

const { graphql } = require('graphql');

app.post('/graphql', async (req, res) => {
  const { query, variables, operationName } = req.body || {};

  const user = verifyJwtFromHeader(req);
  const contextValue = { user, pubsub };

  if (!query) {
    return res.status(400).json({ errors: [{ message: 'Missing query' }] });
  }

  try {
    const result = await graphql({
      schema,
      source: query,
      variableValues: variables,
      operationName,
      contextValue
    });
    res.json(result);
  } catch (err) {
    console.error('GraphQL execution error', err);
    res.status(500).json({ errors: [{ message: err.message || 'Internal Server Error' }] });
  }
});


const wsServer = new WebSocketServer({
  server: httpServer,
  path: '/graphql'
});


const gqlServer = makeServer({
  schema,

  onConnect: async (ctx) => {

  },
  onSubscribe: async (ctx, msg) => {
  },
  context: (ctx, msg, args) => {
    const user = (ctx.connectionParams && ctx.connectionParams._user) || null;
    return { pubsub, user };
  }
});

wsServer.on('connection', (socket, request) => {
  const closed = gqlServer.opened(
    {
      protocol: socket.protocol, 
      send: (data) => new Promise((resolve, reject) => {
        socket.send(data, (err) => (err ? reject(err) : resolve()));
      }),
      close: (code, reason) => socket.close(code, reason),
      onMessage: (cb) => {
        socket.on('message', async (event) => {
          try {

            await cb(event.toString());
          } catch (err) {
            socket.close(CloseCode.InternalServerError, err.message);
          }
        });
      }
    },
    { request }
  );


  socket.once('close', (code, reason) => closed(code, reason));
});

httpServer.listen(APP_PORT, () => {
  console.log(`Server running on http://localhost:${APP_PORT}`);
  console.log(`GraphQL HTTP endpoint: http://localhost:${APP_PORT}/graphql`);
  console.log(`GraphQL Subscriptions (ws): ws://localhost:${APP_PORT}/graphql`);
  console.log(`Uploads served at http://localhost:${APP_PORT}/uploads/...`);
});


process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down...');
  try { await serverCleanup.dispose(); } catch(e){}
  process.exit(0);
});
