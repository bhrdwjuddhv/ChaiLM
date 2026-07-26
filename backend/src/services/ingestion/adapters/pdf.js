import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

// extract(source) -> { units: [{ text, position }], metadata }
// The bytes live on Cloudinary, so the job payload stays tiny and the worker
// can run anywhere. Page-by-page so every chunk cites a real page number.
export async function extract(source) {
  const response = await fetch(source.storageUrl);
  if (response.status === 401 || response.status === 403) {
    // Cloudinary blocks PDF delivery by default on every account, even for
    // resource_type 'raw', and even for signed URLs. Only the dashboard toggle
    // lifts it — so say that rather than reporting a bare status code.
    throw new Error(
      'Cloudinary is refusing to deliver this PDF. Enable Settings → Security → ' +
        '"Allow delivery of PDF and ZIP files" in the Cloudinary dashboard, then re-index.'
    );
  }
  if (!response.ok) throw new Error(`Could not fetch stored PDF (${response.status})`);
  const buffer = await response.arrayBuffer();

  const task = getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    useSystemFonts: true,
  });
  const doc = await task.promise;

  const units = [];
  for (let page = 1; page <= doc.numPages; page++) {
    const content = await (await doc.getPage(page)).getTextContent();
    const text = content.items
      .map((item) => (item.str ?? '') + (item.hasEOL ? '\n' : ''))
      .join('')
      .replace(/[ \t]+/g, ' ')
      .trim();
    if (text) units.push({ text, position: { page } });
  }
  const { numPages } = doc;
  await task.destroy();

  if (!units.length) {
    throw new Error('No selectable text found in this PDF (it may be a scan needing OCR)');
  }
  return { units, metadata: { pageCount: numPages } };
}
