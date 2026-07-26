import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getOne, chunks, reindex, remove } from '../controllers/sourceController.js';

// Flat /api/sources/:sourceId routes. The notebook-scoped ones live in routes/notebooks.js.
const router = Router();
router.use(requireAuth);

router.get('/:sourceId', getOne);
router.get('/:sourceId/chunks', chunks);
router.post('/:sourceId/reindex', reindex);
router.delete('/:sourceId', remove);

export default router;
