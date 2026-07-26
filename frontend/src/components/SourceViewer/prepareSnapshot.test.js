// Pure string logic, so node:test runs it — no vitest, no jsdom.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareSnapshot } from './prepareSnapshot.js';

const page = (body) => `<html><head><title>T</title></head><body>${body}</body></html>`;

test("the captured page's own scripts are removed", () => {
  const { html } = prepareSnapshot(
    page('<script>fetch("/steal")</script><p>Safe text</p>'),
    null
  );
  assert.ok(!html.includes('steal'));
  assert.ok(!/<script\b(?![^>]*>document\.getElementById)/i.test(html.replace(/<script>document[\s\S]*$/, '')));
  assert.ok(html.includes('Safe text'));
});

test('the cited text is wrapped in a mark and scrolled to', () => {
  const cited = 'photosynthesis converts light energy';
  const { html, found } = prepareSnapshot(page(`<p>Note that ${cited} into sugar.</p>`), cited);

  assert.equal(found, true);
  assert.ok(html.includes(`<mark id="chaillm-cite"`));
  assert.ok(html.includes('scrollIntoView'));
});

test('text that is not on the page leaves the document unmarked', () => {
  const { html, found } = prepareSnapshot(page('<p>Something else entirely.</p>'), 'not present here at all');
  assert.equal(found, false);
  assert.ok(!html.includes('chaillm-cite'));
  assert.ok(!html.includes('scrollIntoView'));
});

test('regex metacharacters in the cited text do not blow up the match', () => {
  const cited = 'cost is $5.00 (plus tax) [approx]';
  const { html, found } = prepareSnapshot(page(`<p>The ${cited} today.</p>`), cited);
  assert.equal(found, true);
  assert.ok(html.includes('chaillm-cite'));
});

test('a base target is injected so links escape the sandbox', () => {
  const { html } = prepareSnapshot(page('<p>x</p>'), null);
  assert.ok(html.includes('<base target="_blank">'));
});

test('a too-short anchor is ignored rather than matching noise', () => {
  const { found } = prepareSnapshot(page('<p>a b c</p>'), 'a b');
  assert.equal(found, false);
});
