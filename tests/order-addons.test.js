const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');

// Fake models/index.js so nothing opens a database connection.
const variation = (Id, size, stock = 10) => ({ Id, options: { Size: size }, newPrice: 500, stock, availability: 'in stock' });
const products = [
  { Id: 1, name: 'Attar', status: 'Active', categoryId: 8, freeShipping: true, variations: [{ Id: 11, options: null, newPrice: 250, stock: 10 }] },
  { Id: 2, name: 'Other', status: 'Active', categoryId: 5, freeShipping: true, variations: [{ Id: 21, options: null, newPrice: 300, stock: 10 }] },
  { Id: 7, name: 'Hoodie', status: 'Active', categoryId: null, file: null, images: '["data:image/png;base64,AAAA","https://cdn/hoodie.jpg"]', variations: [variation(26, 'M', 2), variation(27, 'L'), variation(28, 'XL', 0)] },
];
const category = { Id: 8, name: 'Offer', status: 'Active', addonProductId: 7, addonPrice: '99.00' };
require.cache[require.resolve('../models')] = {
  id: require.resolve('../models'),
  loaded: true,
  exports: {
    category: { findAll: async () => [category] },
    product: { findAll: async ({ where }) => products.filter((p) => where.Id[Op.in].includes(p.Id)) },
    deliveryCharge: { findAll: async () => [] },
  },
};
const { priceOrderItems, getAddonOffers } = require('../app/modules/order/orderPricing');

const attar = (qty = 1) => ({ id: 1, name: 'Attar', price: 1, qty });
const hoodie = (variantId, qty = 1, extra = {}) => ({ id: 7, name: 'x', price: 1, qty, variantId, isAddon: true, addonCategoryId: 8, ...extra });
const order = (items, options) => priceOrderItems({ items, customerDistrict: 'Dhaka' }, options);

test('offer lists only in-stock sizes for qualifying products', async () => {
  const [offer] = await getAddonOffers(['1', '2']);
  assert.equal(offer.price, 99);
  assert.deepEqual(offer.qualifyingProductIds, [1]);
  assert.deepEqual(offer.product.variants.map((v) => v.id), [26, 27]);
  assert.deepEqual(await getAddonOffers(['2']), []);
});

test('offer image falls back to the images column and skips inline base64', async () => {
  const [offer] = await getAddonOffers(['1']);
  assert.equal(offer.product.file, 'https://cdn/hoodie.jpg');
});

test('add-on is charged the category price, not the client or product price', async () => {
  const { items } = await order([attar(), hoodie(26)]);
  assert.equal(items[1].price, 99);
  assert.equal(items[1].name, 'Hoodie');
  assert.equal(items[1].variant, 'Size: M');
});

test('one add-on per qualifying item, across sizes', async () => {
  const { items } = await order([attar(3), hoodie(26, 2), hoodie(27, 1)]);
  assert.equal(items.length, 3);
  await assert.rejects(order([attar(2), hoodie(26, 2), hoodie(27, 1)]), /বেশি/);
  await assert.rejects(order([{ id: 2, name: 'Other', qty: 1 }, hoodie(27)]), /বেশি/);
});

test('add-on cannot be bought alone, unflagged, or without a size', async () => {
  await assert.rejects(order([hoodie(27)]), /বেশি/);
  await assert.rejects(order([{ id: 7, name: 'Hoodie', qty: 1, variantId: 27 }]), /অফারের সাথে/);
  await assert.rejects(order([attar(), hoodie(undefined)]), /size/);
  await assert.rejects(order([attar(), hoodie(28)]), /stock/);
});

test('add-on does not cost a free-shipping cart its free delivery', async () => {
  const { deliveryCharge } = await order([attar(), hoodie(27)]);
  assert.equal(deliveryCharge, 0);
});

test('incomplete drafts drop invalid add-ons instead of failing', async () => {
  const { items } = await order([attar(), hoodie(undefined)], { strict: false });
  assert.deepEqual(items.map((item) => item.id), [1]);
});
