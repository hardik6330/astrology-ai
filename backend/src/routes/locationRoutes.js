import { Router } from 'express';
import * as loc from '../controllers/locationController.js';
import { readLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { locationSearchQuery, locationDetailsQuery, locationReverseQuery } from '../validators/schemas.js';

const router = Router();

// Both endpoints are read-only proxies for the user's birth-form city picker.
// `token` is the Google Places sessiontoken (a UUID generated client-side);
// passing the SAME token to /search and /details makes autocomplete free.
router.get('/locations/search',  readLimiter, validate(locationSearchQuery, 'query'),  loc.search);
router.get('/locations/details', readLimiter, validate(locationDetailsQuery, 'query'), loc.details);
router.get('/locations/reverse', readLimiter, validate(locationReverseQuery, 'query'), loc.reverse);

export default router;
