import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { requireAuth } from './middlewares/requireAuth';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;

// ── Public routes ────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// ── Protected routes (every handler below requires a valid Clerk JWT) ────────
// Example: GET /me  — returns the verified userId from the token
app.get('/me', requireAuth, (req, res) => {
  res.json({ userId: req.userId });
});

// TODO: mount feature routers here, e.g.:
// import habitRoutes from './routes/habits';
// app.use('/habits', requireAuth, habitRoutes);

app.listen(PORT, () => {
  console.log(`Server running on PORT ${PORT}`);
});