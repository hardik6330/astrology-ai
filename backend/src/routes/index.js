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

// Single mounting point for every feature router. Auth routes are public
// (used by the web login flow); the rest are currently open so the mobile
// app can call them without a token. Re-add `requireAuth` here when ready
// to fully enforce sign-in on every API.
const router = Router();

router.use(authRoutes);
router.use(kundaliRoutes);
router.use(dailyRoutes);
router.use(chatRoutes);
router.use(palmRoutes);
router.use(locationRoutes);
router.use(pushRoutes);
router.use(cronRoutes);
router.use(adminRoutes);

export default router;
