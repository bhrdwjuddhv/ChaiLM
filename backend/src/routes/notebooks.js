import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { list, create, getOne, update, remove } from '../controllers/notebookController.js';
import { list as listSources, uploadSource, pasteSource } from '../controllers/sourceController.js';
import { history, chat } from '../controllers/chatController.js';
import { roadmap, startPodcast, podcastStatus } from '../controllers/extrasController.js';

const router = Router();
router.use(requireAuth);

router.route('/').get(list).post(create);
router.route('/:id').get(getOne).patch(update).delete(remove);

// Notebook-scoped sub-resources. Flat /api/sources/:sourceId lives in routes/sources.js.
router.get('/:id/sources', listSources);
router.post('/:id/sources/upload', upload.single('file'), uploadSource);
router.post('/:id/sources/paste', pasteSource);

router.get('/:id/messages', history);
router.post('/:id/chat', chat);

router.post('/:id/roadmap', roadmap);
router.post('/:id/podcast', startPodcast);
router.get('/:id/podcast/:jobId', podcastStatus);

export default router;
