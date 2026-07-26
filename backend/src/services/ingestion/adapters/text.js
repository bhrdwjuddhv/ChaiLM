// Plain text, from a paste (metadata.content) or an uploaded .txt (storageUrl).
// Paragraph units so chunks can report exact character offsets.
export async function extract(source) {
  let full = source.metadata?.content || '';

  if (!full && source.storageUrl) {
    const response = await fetch(source.storageUrl);
    if (!response.ok) throw new Error(`Could not fetch stored text (${response.status})`);
    full = await response.text();
  }
  if (!full.trim()) throw new Error('This source has no text');

  const units = [];
  let cursor = 0;
  for (const paragraph of full.split(/\n{2,}/)) {
    const charStart = full.indexOf(paragraph, cursor);
    const charEnd = charStart + paragraph.length;
    cursor = charEnd;
    if (paragraph.trim()) units.push({ text: paragraph, position: { charStart, charEnd } });
  }

  return { units, metadata: { charCount: full.length } };
}
