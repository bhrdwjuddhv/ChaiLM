const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Rewrites a saved page for display in a sandboxed srcdoc iframe:
//   1. strips the captured page's scripts, so `allow-scripts` only ever runs ours
//   2. wraps the cited text in a <mark> and scrolls to it
//   3. adds <base target="_blank"> so a stray link opens outside the frame
export function prepareSnapshot(html, anchorText) {
  let out = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');

  const needle = (anchorText || '').replace(/\s+/g, ' ').trim().slice(0, 60);
  let found = false;

  if (needle.length > 12) {
    // Matches inside a single text node only; text split across tags is skipped
    // rather than risking a mangled document.
    const pattern = new RegExp(`(>[^<]*?)(${escapeRegex(needle)})`, 'i');
    if (pattern.test(out)) {
      out = out.replace(pattern, '$1<mark id="chaillm-cite" style="background:#fde68a">$2</mark>');
      found = true;
    }
  }

  out = out.replace(/<head([^>]*)>/i, '<head$1><base target="_blank">');

  return {
    html: found
      ? `${out}<script>document.getElementById('chaillm-cite')?.scrollIntoView({block:'center'})</script>`
      : out,
    found,
  };
}
