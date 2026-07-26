// Shared by every adapter. Input is whatever the adapter extracted:
//   units = [{ text, position }]  — a PDF page, a caption cue, a paragraph…
// Output is chunks carrying the position of the unit their content starts in,
// so a citation always resolves to a real page / timestamp / offset.

// ponytail: chars as a token proxy (~4 chars/token). Swap in tiktoken only if
// chunks start overflowing the embedding window in practice.
const TARGET_CHARS = 2800; // ~700 tokens
const OVERLAP_CHARS = 340; // ~12%

const splitSentences = (text) => text.match(/[^.!?\n]+[.!?]*\s*|\n+/g) || [];

// A single "sentence" longer than a whole chunk (tables, minified text) still has to fit.
function* sized(sentence) {
  if (sentence.length <= TARGET_CHARS) return yield sentence;
  for (let i = 0; i < sentence.length; i += TARGET_CHARS) {
    yield sentence.slice(i, i + TARGET_CHARS);
  }
}

// A chunk spanning units 4..9 must cite where it starts AND where it ends, or a
// video citation seeks to the right second but claims the wrong end. End-ish keys
// are taken from the last unit; keys with no end (page) come from the first.
function mergeSpan(first, last) {
  if (!first) return first ?? null;
  const span = { ...first };
  if (last?.endSec !== undefined) span.endSec = last.endSec;
  if (last?.charEnd !== undefined) span.charEnd = last.charEnd;
  return span;
}

export function chunkUnits(units) {
  const chunks = [];
  let buffer = '';
  let carry = '';
  let start = null;
  let end = null;

  const flush = () => {
    const text = (carry + buffer).trim();
    if (text) chunks.push({ text, position: mergeSpan(start, end) });
    carry = buffer.slice(-OVERLAP_CHARS);
    buffer = '';
    start = null;
    end = null;
  };

  for (const unit of units) {
    if (!unit?.text?.trim()) continue;
    // A hard boundary: never let one chunk straddle two videos in a playlist.
    if (unit.break && buffer) {
      flush();
      carry = '';
    }
    for (const sentence of splitSentences(unit.text)) {
      for (const piece of sized(sentence)) {
        if (!buffer) start = unit.position;
        end = unit.position;
        buffer += piece;
        if (carry.length + buffer.length >= TARGET_CHARS) flush();
      }
    }
  }
  flush();

  return chunks.map((c, chunkIndex) => ({ ...c, chunkIndex }));
}
