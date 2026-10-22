const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(
  path.join(__dirname, "../app/modules/order/order.controller.js"),
  "utf8",
);

const tick = () => new Promise((resolve) => setImmediate(resolve));

function setup({
  amount = "1490.50",
  responses = [{ results: [{ platform: "meta", ok: true }] }],
} = {}) {
  const calls = [];
  let attempt = 0;

  const context = {
    module: { exports: {} },
    console: { ...console, warn: () => {} },

    // Skip real retry delays in tests.
    setTimeout: (fn) => {
      fn();
      return 1;
    },

    require(name) {
      if (name.includes("catchAsync")) {
        return (fn) => fn;
      }

      if (name.includes("sendResponse")) {
        return (res, body) => {
          res.body = body;
        };
      }

      if (name === "./order.service") {
        return {
          createOrderInDB: async () => ({
            Id: 42,
            orderId: "HD-0042",
            totalBill: amount,
            customerName: "Test",
            customerPhone: "01712345678",
          }),

          saveIncompleteOrderInDB: async () => ({
            Id: 15,
            status: "incomplete",
          }),
        };
      }

      if (name.includes("tracking.service")) {
        return {
          trackEvent: async (payload) => {
            calls.push(payload);

            return responses[Math.min(attempt++, responses.length - 1)];
          },
        };
      }

      if (name.includes("clientIp")) {
        return {
          getClientIp: () => "127.0.0.1",
        };
      }

      if (name.includes("pick")) {
        return () => ({});
      }

      return {};
    },
  };

  vm.runInNewContext(source, context, {
    filename: "order.controller.js",
  });

  return {
    controller: context.module.exports,
    calls,
  };
}

function request(enabled = true) {
  return {
    headers: {
      "user-agent": "NodeTest",
    },

    body: {
      landingTracking: {
        enabled,
        eventSourceUrl: "https://holydeen.com/landing-page/1",

        // Deliberately wrong client values.
        customData: {
          value: 1,
          currency: "USD",
          content_ids: ["1"],
        },
      },
    },
  };
}

// TEST 1: Dynamic Purchase Value
test("Different orders send correct BDT values", async () => {
  for (const amount of ["990", "1490.50", "2190"]) {
    const { controller, calls } = setup({ amount });
    const res = {};

    await controller.createOrder(request(), res);
    await tick();

    assert.equal(res.body.statusCode, 201);
    assert.equal(res.body.data.purchaseValue, Number(amount));
    assert.equal(res.body.data.purchaseCurrency, "BDT");

    assert.equal(res.body.data.purchaseEventId, "Purchase.order.42");

    assert.equal(calls.length, 1);
    assert.equal(calls[0].customData.value, Number(amount));
    assert.equal(calls[0].customData.currency, "BDT");
    assert.equal(calls[0].eventId, res.body.data.purchaseEventId);
  }
});

// TEST 2: Disabled Tracking
test("Disabled tracking never sends Purchase", async () => {
  const { controller, calls } = setup();

  await controller.createOrder({ headers: {}, body: {} }, {});

  await controller.createOrder(request(false), {});

  await tick();

  assert.equal(calls.length, 0);
});

// TEST 3: Invalid Purchase Value
test("Invalid prices do not emit Purchase", async () => {
  const prices = ["0", "-10", "not-a-number"];

  for (const amount of prices) {
    const { controller, calls } = setup({ amount });
    const res = {};

    await controller.createOrder(request(), res);
    await tick();

    assert.equal(res.body.statusCode, 201);
    assert.equal(calls.length, 0);

    assert.equal(res.body.data.purchaseEventId, undefined);
  }
});

// TEST 4: Retry and Stable Event ID
test("Failed delivery retries with stable Event ID", async () => {
  const responses = [
    {
      results: [{ platform: "meta", ok: false }],
    },
    {
      results: [{ platform: "meta", ok: true }],
    },
  ];

  const { controller, calls } = setup({ responses });

  await controller.createOrder(request(), {});
  await tick();

  assert.equal(calls.length, 2);
  assert.equal(calls[0].eventId, calls[1].eventId);

  assert.equal(calls[0].customData.value, calls[1].customData.value);
});

// TEST 5: Empty Results
test("Empty response is not successful delivery", async () => {
  const { controller, calls } = setup({
    responses: [{ results: [] }],
  });

  await controller.createOrder(request(), {});
  await tick();

  assert.equal(calls.length, 3);
});

// TEST 6: Incomplete Order
test("Incomplete order does not send Purchase", async () => {
  const { controller, calls } = setup();
  const res = {};

  await controller.saveIncompleteOrder({ headers: {}, body: {} }, res);

  assert.equal(res.body.data.status, "incomplete");

  assert.equal(calls.length, 0);
});
