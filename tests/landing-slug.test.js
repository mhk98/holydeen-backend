const { test } = require('node:test');
const assert = require('node:assert/strict');
const { toLandingSlug, uniqueLandingSlug } = require('../app/modules/landingPage/landingPage.slug');

test('slug keeps words of the campaign title, drops emoji and punctuation', () => {
  assert.equal(toLandingSlug('🌹 Holy Deen Signature Attar Collection'), 'holy-deen-signature-attar-collection');
  assert.equal(toLandingSlug('৯৯ টাকায় হুডি!'), '৯৯-টাকায়-হুডি');
  assert.equal(toLandingSlug('  Eid  Offer -- 2026 '), 'eid-offer-2026');
});

test('slug never looks like an old numeric id and is never empty', () => {
  assert.equal(toLandingSlug('2026'), 'campaign-2026');
  assert.equal(toLandingSlug('🌹🌹'), 'campaign');
});

test('unique slug skips taken and reserved paths', async () => {
  const model = (slugs) => ({ findAll: async () => slugs.map((slug) => ({ slug })) });
  assert.equal(await uniqueLandingSlug(model([]), 'Eid Offer'), 'eid-offer');
  assert.equal(await uniqueLandingSlug(model(['eid-offer', 'eid-offer-2']), 'Eid Offer'), 'eid-offer-3');
  assert.equal(await uniqueLandingSlug(model([]), 'Checkout'), 'checkout-2');
});
