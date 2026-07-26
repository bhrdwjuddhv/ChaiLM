import Notebook from '../models/Notebook.js';
import Message from '../models/Message.js';
import { retrieve, buildMessages, streamAnswer, extractCitations } from '../services/rag/index.js';

const HISTORY_TURNS = 6;

async function ownedNotebook(req) {
  const notebook = await Notebook.findOne({ _id: req.params.id, userId: req.userId });
  if (!notebook) throw Object.assign(new Error('Notebook not found'), { status: 404 });
  return notebook;
}

export async function history(req, res) {
  const notebook = await ownedNotebook(req);
  res.json(await Message.find({ notebookId: notebook._id }).sort({ createdAt: 1 }));
}

export async function chat(req, res) {
  const notebook = await ownedNotebook(req);
  const question = req.body?.question?.trim();
  if (!question) return res.status(400).json({ error: 'question is required' });

  const priorTurns = await Message.find({ notebookId: notebook._id })
    .sort({ createdAt: -1 })
    .limit(HISTORY_TURNS)
    .lean();

  const userMessage = await Message.create({
    notebookId: notebook._id,
    userId: req.userId,
    role: 'user',
    content: question,
  });

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  send('user', { id: userMessage._id, content: question });

  try {
    const chunks = await retrieve(notebook._id, question);
    const messages = buildMessages(question, chunks, priorTurns.reverse());

    let raw = '';
    for await (const token of streamAnswer(messages)) {
      raw += token;
      send('token', { t: token });
    }

    const { content, citations } = extractCitations(raw, chunks);
    const assistant = await Message.create({
      notebookId: notebook._id,
      userId: req.userId,
      role: 'assistant',
      content,
      citations,
    });

    // Content is resent because citation markers are renumbered once the answer
    // is complete — the client swaps its streamed text for this final version.
    send('done', { id: assistant._id, content, citations });
  } catch (err) {
    console.error('[chat]', err);
    send('error', { error: err.message || 'Failed to answer' });
  } finally {
    res.end();
  }
}
