import { writeFileSync } from 'node:fs';

const counts = [6, 3, 2, 88, 39, 3, 34, 6];
const sources = counts.map((count, source) => {
  const rows = Array.from({ length: count }, (_, row) => `Fixture data. Fixture tool S${source}R${row} standard. Item price SGD ${(437 + row).toFixed(2)}. One item, tax included.`);
  return { url: `https://example.com/source-${source}`, title: 'Invented fixture listing', text: rows.join('\n') };
});
const assessment = (url, quote) => ({ status: 'supported', scope: 'exact-variant', rationale: 'Fixture AI source interpretation, not merchant verification.', support: [{ url, quote }] });
const products = [0, 1, 2].map((index) => {
  const source = sources[index], row = source.text.split('\n')[0], support = assessment(source.url, row);
  const sourceReviews = sources.map((entry, sourceIndex) => {
    const rows = entry.text.split('\n');
    const batches = [];
    if (sourceIndex === index) batches.push({ quote: rows.shift(), role: 'selected' });
    for (const line of rows) {
      const last = batches.at(-1);
      if (last?.role === 'other-product' && last.quote.length + line.length + 1 <= 3800) last.quote += '\n' + line;
      else batches.push({ quote: line, role: 'other-product' });
    }
    return { url: entry.url, reviewComplete: true, relation: sourceIndex === index ? 'applies' : 'other-product-or-topic', assessment: assessment(entry.url, entry.text.split('\n')[0]), moneyMentions: batches.map((batch) => ({ ...batch, scope: batch.role === 'selected' ? 'selected-variant' : 'other-subjects', assessment: assessment(entry.url, batch.quote.split('\n')[0]) })), conditions: [] };
  });
  return { id: `fixture-tool-${index}`, name: `Fixture tool S${index}R0`, variant: 'standard', identity: support, requestMatch: support, criteria: [], attributes: [], price: { amount: 437, currency: 'SGD', variant: 'standard', moneySupport: { url: source.url, quote: row }, attribution: support, priceBasis: { kind: 'single-item', assessment: support }, sourceReviews } };
});
const answer = { answerVersion: 2, products, choice: { productId: products[0].id }, limitations: ['Invented fixture data only.'] };
const packet = { answer, citations: sources };
writeFileSync(new URL('./grouped-rich-fixture.json', import.meta.url), JSON.stringify(packet, null, 2) + '\n');
const result = { invented: true, occurrencesBySource: counts, occurrences: counts.reduce((a, b) => a + b), groupsByProduct: products.map((p) => p.price.sourceReviews.reduce((n, r) => n + r.moneyMentions.length, 0)), sourceCharacters: sources.reduce((n, s) => n + s.text.length, 0), answerCharacters: JSON.stringify(answer).length, answerUtf8Bytes: Buffer.byteLength(JSON.stringify(answer)), envelopeCharacters: JSON.stringify(packet).length, maximumQuote: Math.max(...products.flatMap((p) => p.price.sourceReviews.flatMap((r) => r.moneyMentions.map((m) => m.quote.length)))) };
console.log(JSON.stringify(result, null, 2));
writeFileSync(new URL('./grouping-sketch-result.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
