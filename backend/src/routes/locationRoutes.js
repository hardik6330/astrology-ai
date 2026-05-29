import { Router } from 'express';
import * as loc from '../controllers/locationController.js';
import { readLimiter } from '../middleware/rateLimit.js';

const router = Router();

// Both endpoints are read-only proxies for the user's birth-form city picker.
// `token` is the Google Places sessiontoken (a UUID generated client-side);
// passing the SAME token to /search and /details makes autocomplete free.
router.get('/locations/search',  readLimiter, loc.search);
router.get('/locations/details', readLimiter, loc.details);

export default router;
