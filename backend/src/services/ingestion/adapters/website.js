import * as cheerio from 'cheerio';
import { uploadBuffer } from '../../../config/cloudinary.js';

const NOISE = 'script, style, noscript, nav, header, footer, aside, form, iframe, svg';

// ponytail: hand-rolled readability instead of @mozilla/readability, which drags
// in jsdom. Swap it in if content-heavy pages start extracting badly.
function readableText($) {
  $(NOISE).remove();
  const root = $('article').first().length ? $('article').first() : $('main').first();
  const scope = root.length ? root : $('body');

  return scope
    .find('h1, h2, h3, h4, p, li, blockquote, pre, td')
    .toArray()
    .map((el) => $(el).text().replace(/\s+/g, ' ').trim())
    .filter((t) => t.length > 2);
}

export async function extract(source) {
  const response = await fetch(source.sourceUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; chaiLLM/1.0)' },
    redirect: 'follow',
  });
  if (!response.ok) throw new Error(`Could not fetch page (${response.status})`);

  const html = await response.text();

  // The snapshot is what the citation viewer renders — the live page may change or vanish.
  const snapshot = await uploadBuffer(Buffer.from(html, 'utf8'), {
    folder: `chaillm/${source.notebookId}`,
    publicId: `${source._id}-snapshot`,
    format: 'html',
  });

  const $ = cheerio.load(html);
  const title = $('title').first().text().trim() || $('h1').first().text().trim();
  const paragraphs = readableText($);
  if (!paragraphs.length) throw new Error('No readable text found on this page');

  return {
    units: paragraphs.map((text) => ({ text, position: { snapshotUrl: snapshot.secure_url } })),
    metadata: {
      snapshotUrl: snapshot.secure_url,
      snapshotPublicId: snapshot.public_id,
      pageTitle: title,
    },
    title,
    storageUrl: snapshot.secure_url,
  };
}
