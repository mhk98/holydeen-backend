const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup(totalBill = '1490.50') {
  const events = [];
  const context = { module: { exports: {} }, console, setTimeout, require(name) {
    if (name.includes('catchAsync')) return fn => fn;
    if (name.includes('sendResponse')) return (res, body) => { res.body = body; };
    if (name === './order.service') return { createOrderInDB: async () => ({ Id: 42, orderId: 'HD-42', totalBill }) };
    if (name.includes('tracking.service')) return { trackEvent: async payload => { events.push(payload); return { results: [{ ok: true }] }; } };
    if (name.includes('clientIp')) return { getClientIp: () => '127.0.0.1' };
    return {};
  } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../app/modules/order/order.controller'), 'utf8'), context);
  return { controller: context.module.exports, events };
}

test('Purchase response and CAPI share saved value, currency and stable ID across retries', async () => {
  for (const total of ['1490.50', '2790', '0']) {
    const { controller, events } = setup(total);
    const req = { headers: {}, body: { landingTracking: { enabled: true, eventSourceUrl: 'https://holydeen.com/checkout', customData: { value: 1, currency: 'USD' } } } };
    for (let i = 0; i < 2; i++) {
      const res = {};
      await controller.createOrder(req, res);
      const order = res.body.data;
      assert.equal(order.purchaseEventId, 'Purchase.order.42');
      assert.equal(events[i].eventId, order.purchaseEventId);
      assert.equal(order.purchaseValue, Number(total));
      assert.equal(events[i].customData.value, order.purchaseValue);
      assert.equal(events[i].customData.currency, order.purchaseCurrency);
      assert.equal(order.purchaseCurrency, 'BDT');
    }
  }
});

test('orders without enabled tracking do not emit Purchase', async () => {
  const { controller, events } = setup();
  for (const body of [{}, { landingTracking: { enabled: false } }]) {
    const res = {};
    await controller.createOrder({ headers: {}, body }, res);
    assert.equal(res.body.data.purchaseEventId, undefined);
  }
  assert.equal(events.length, 0);
});
