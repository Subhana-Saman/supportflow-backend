
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

const CLIENT_URL =
  process.env.CLIENT_URL || 'http://localhost:5173';

/* =========================
   CORS
========================= */

app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
    methods: [
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'OPTIONS'
    ],
    allowedHeaders: [
      'Content-Type',
      'Authorization'
    ]
  })
);

/* =========================
   PRE-FLIGHT
========================= */

app.options('*', cors({
  origin: CLIENT_URL,
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

connectDB();

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
    origin: CLIENT_URL,
    credentials: true,
    methods: ['GET', 'POST']
  }
});

setupSocket(io);

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

