import { Router } from 'express';
import kundaliRoutes from './kundaliRoutes.js';
import dailyRoutes   from './dailyRoutes.js';
import chatRoutes    from './chatRoutes.js';
import palmRoutes    from './palmRoutes.js';

// Single mounting point for every feature router. server.js mounts this
// once at /api — to add a new feature, just `import` and `.use(...)` here.
const router = Router();

router.use(kundaliRoutes);
router.use(dailyRoutes);
router.use(chatRoutes);
router.use(palmRoutes);

export default router;
