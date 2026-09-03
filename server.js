
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';

import connectDB from './config/db.js';

// Routes
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import ticketRoutes from './routes/ticketRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';

// Middleware
import { errorHandler } from './middleware/errorMiddleware.js';

// Socket
import setupSocket from './socket/socketHandler.js';

dotenv.config();

const app = express();
app.set('trust proxy', 1);

const CLIENT_URL =
  process.env.CLIENT_URL || 'http://localhost:5173';

// Support one or more comma-separated origins in CLIENT_URL
// (e.g. "https://supportflow.vercel.app,http://localhost:5173")
// so both local dev and the deployed frontend work at the same time.
const ALLOWED_ORIGINS = CLIENT_URL.split(',').map((o) => o.trim());

const corsOriginHandler = (origin, callback) => {
  // Allow non-browser requests (curl, server-to-server, health checks)
  if (!origin) return callback(null, true);

  if (ALLOWED_ORIGINS.includes(origin)) {
    return callback(null, true);
  }

  console.warn(`CORS blocked request from origin: ${origin}`);
  return callback(new Error('Not allowed by CORS'));
};

/* =========================
   CORS
========================= */

app.use(cors({
  origin: corsOriginHandler,
  credentials: true
}));



/* =========================
   SECURITY
========================= */

app.use(
  helmet({
    crossOriginResourcePolicy: false
  })
);

app.use(compression());

/* =========================
   BODY PARSERS
========================= */

app.use(express.json({ limit: '10mb' }));

app.use(
  express.urlencoded({
    extended: true,
    limit: '10mb'
  })
);

app.use(cookieParser());

/* =========================
   RATE LIMIT
========================= */

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.'
});

app.use('/api', limiter);

/* =========================
   DATABASE
========================= */

connectDB().catch((err) => {
  console.error('Failed to connect to MongoDB:', err.message);
});

/* =========================
   ROUTES
========================= */

app.use('/api/auth', authRoutes);

app.use('/api/users', userRoutes);

app.use('/api/tickets', ticketRoutes);

app.use('/api/tickets', messageRoutes);

app.use('/api/dashboard', dashboardRoutes);

/* =========================
   HEALTH CHECK
========================= */

app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running'
  });
});

/* =========================
   ERROR HANDLER
========================= */

app.use(errorHandler);

/* =========================
   SOCKET.IO
========================= */

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST']
  }
});

setupSocket(io);

// Make io available to REST controllers via req.app.get('io'), so ticket
// updates and messages created through the normal API also broadcast in
// real time to everyone in that ticket's room.
app.set('io', io);

/* =========================
   VERCEL
========================= */

export default app;

/* =========================
   LOCAL DEVELOPMENT
========================= */

if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;

  httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV}`);
    console.log(`📍 Client URL: ${CLIENT_URL}`);
  });
}

