const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");

const source = fs.readFileSync(
  path.join(__dirname, "../app/modules/tracking/tracking.service.js"),
  "utf8",
);

function setup() {
  const posts = [];

  const context = {
    module: { exports: {} },

    console: {
      ...console,
      warn: () => {},
    },

    process: {
      env: {
        NODE_ENV: "production",
        META_GRAPH_API_VERSION: "v23.0",
      },
    },

    // Mock Meta API. No real network requests.
    fetch: async (url, options) => {
      posts.push({
        url,
        payload: JSON.parse(options.body),
      });

      return {
        ok: true,
        status: 200,
        json: async () => ({
          events_received: 1,
        }),
      };
    },

    AbortSignal,
    URLSearchParams,

    require(name) {
      if (name === "crypto") return crypto;

      if (name.includes("ApiError")) {
        return class ApiError extends Error {};
      }

      if (name.includes("clientIp")) {
        return {
          getClientIp: () => "127.0.0.1",
        };
      }

      if (name.includes("facebookPixel.service")) {
        return {
          getActiveFromDB: async () => [
            {
              toJSON: () => ({
                pixelsId: "123456",
                metaAccessToken: "mock-secret",
                testEventId: "TEST_CODE",
              }),
            },
          ],

          getPublicFromDB: async () => [],
        };
      }

      if (
        name.includes("tiktokPixel.service") ||
        name.includes("googleAds.service")
      ) {
        return {
          getActiveFromDB: async () => [],
          getPublicFromDB: async () => [],
        };
      }

      if (name.includes("tracking.cache")) {
        return {
          cached: (_key, fn) => fn(),
        };
      }

      return {};
    },
  };

  vm.runInNewContext(source, context, {
    filename: "tracking.service.js",
  });

  return {
    service: context.module.exports,
    posts,
  };
}

// TEST 7: Meta Purchase Payload
test("Meta CAPI receives correct Purchase data", async () => {
  const { service, posts } = setup();

  const input = {
    eventName: "Purchase",
    eventId: "Purchase.order.42",

    eventSourceUrl: "https://holydeen.com/landing-page/1",

    userData: {
      phone: "01700000000",
    },

    customData: {
      value: 1490.5,
      currency: "BDT",
      order_id: "HD-0042",
    },
  };

  const result = await service.trackEvent(input, {
    headers: {
      "user-agent": "TestAgent",
    },
  });

  assert.equal(result.results[0].ok, true);
  assert.equal(posts.length, 1);

  const meta = posts[0].payload.data[0];

  assert.equal(meta.event_name, "Purchase");
  assert.equal(meta.event_id, input.eventId);

  assert.equal(meta.custom_data.value, 1490.5);

  assert.equal(meta.custom_data.currency, "BDT");

  assert.equal(meta.custom_data.order_id, "HD-0042");

  // Bangladesh mobile number hashing.
  const expectedHash = crypto
    .createHash("sha256")
    .update("8801700000000")
    .digest("hex");

  assert.equal(meta.user_data.ph[0], expectedHash);

  // Production must not send test_event_code.
  assert.equal(posts[0].payload.test_event_code, undefined);
});

// TEST 8: Different Prices
test("Different Purchase values remain different", async () => {
  const { service, posts } = setup();

  const prices = [990, 1490, 2190];

  for (const [index, value] of prices.entries()) {
    await service.trackEvent(
      {
        eventName: "Purchase",
        eventId: `Purchase.order.${index + 1}`,

        customData: {
          value,
          currency: "BDT",
        },
      },
      { headers: {} },
    );
  }

  const actualValues = posts.map(
    (item) => item.payload.data[0].custom_data.value,
  );

  assert.deepEqual(actualValues, prices);
});

// TEST 9: Reject Invalid Purchase
test("Invalid Purchase amount is rejected", async () => {
  const { service, posts } = setup();

  await assert.rejects(
    service.trackEvent(
      {
        eventName: "Purchase",
        eventId: "p0",

        customData: {
          value: 0,
          currency: "BDT",
        },
      },
      { headers: {} },
    ),
  );

  assert.equal(posts.length, 0);
});
