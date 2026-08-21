import { Router } from 'express';
import authRoutes     from './authRoutes.js';
import kundaliRoutes  from './kundaliRoutes.js';
import dailyRoutes    from './dailyRoutes.js';
import chatRoutes     from './chatRoutes.js';
import palmRoutes     from './palmRoutes.js';
import locationRoutes from './locationRoutes.js';
import pushRoutes     from './pushRoutes.js';
import cronRoutes     from './cronRoutes.js';
import adminRoutes    from './adminRoutes.js';
import creditRoutes   from './creditRoutes.js';
import userRoutes     from './userRoutes.js';
import memoryRoutes   from './memoryRoutes.js';
import { requireAuth } from '../middleware/auth.js';

// Single mounting point for every feature router.
const router = Router();

// ── Public / self-guarded ──────────────────────────────────────────────────
router.use(authRoutes);      // login / verify — must be reachable without a token
router.use(locationRoutes);  // Google Places proxy, used during onboarding (no credits)
router.use(cronRoutes);      // guarded by its own cron secret
router.use(adminRoutes);     // guarded by requireAdmin
router.use(pushRoutes);      // self-guards each route with requireAuth

// ── Signed-in user required ─────────────────────────────────────────────────
// The AI/credit features must identify the caller so credits can be charged to
// the right account. requireAuth puts req.auth = { accountId, firebaseUid, phone }.
router.use(requireAuth);
router.use(creditRoutes);
router.use(userRoutes);      // POST /profile — save birth details on entry
router.use(memoryRoutes);    // chart memory — timeline answers, asked alignments
router.use(kundaliRoutes);
router.use(dailyRoutes);
router.use(chatRoutes);
router.use(palmRoutes);

export default router;
