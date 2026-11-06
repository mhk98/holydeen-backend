const { test } = require('node:test');
const assert = require('node:assert/strict');

// Fake models/index.js so the service never opens a database connection.
const rows = [];
require.cache[require.resolve('../models')] = {
  id: require.resolve('../models'),
  loaded: true,
  exports: {
    category: { findAll: async () => rows },
    subcategory: { findAll: async () => [] },
    childcategory: { findAll: async () => [] },
  },
};
const { getPublicMenu } = require('../app/modules/category/category.service');

const category = (Id, extra = {}) => ({ Id, name: `Cat ${Id}`, isActive: 1, frontView: 1, ...extra });

test('public menu orders by sort order, unsorted categories last', async () => {
  rows.splice(0, rows.length, category(1), category(2, { sortOrder: 5 }), category(3, { sortOrder: 0 }));
  const menu = await getPublicMenu();
  assert.deepEqual(menu.map((item) => item.Id), [3, 2, 1]);
});

test('public menu treats MySQL 0 as Front View off', async () => {
  rows.splice(0, rows.length, category(1, { frontView: 0, isActive: 0 }), category(2));
  const menu = await getPublicMenu();
  assert.deepEqual(menu.map((item) => item.isActive), [false, true]);
});

test('public menu exposes banner and meta fields but never inline images', async () => {
  rows.splice(0, rows.length,
    category(1, {
      bannerImage: 'https://res.cloudinary.com/x/banner.webp',
      bannerTitle: 'Offer',
      metaTitle: 'Meta',
      metaDescription: 'Description',
    }),
    category(2, { bannerImage: 'data:image/png;base64,AAAA' }),
  );
  const [withBanner, inline] = await getPublicMenu();
  assert.equal(withBanner.bannerImage, 'https://res.cloudinary.com/x/banner.webp');
  assert.equal(withBanner.bannerTitle, 'Offer');
  assert.equal(withBanner.metaTitle, 'Meta');
  assert.equal(withBanner.metaDescription, 'Description');
  assert.equal(inline.bannerImage, null);
  assert.equal(inline.bannerTitle, null);
});
