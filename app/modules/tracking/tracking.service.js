// const crypto = require("crypto");
// const ApiError = require("../../../error/ApiError");
// const { getClientIp } = require("../../utils/clientIp");
// const FacebookPixelService = require("../facebookPixel/facebookPixel.service");
// const TiktokPixelService = require("../tiktokPixel/tiktokPixel.service");
// const GoogleAdsService = require("../googleAds/googleAds.service");
// const { cached } = require("./tracking.cache");

// const getActiveMetaPixels = () => cached("meta:active", FacebookPixelService.getActiveFromDB);
// const getActiveTiktokPixels = () => cached("tiktok:active", TiktokPixelService.getActiveFromDB);
// const getActiveGoogleAds = () => cached("googleAds:active", GoogleAdsService.getActiveFromDB);

// const hash = (value) => {
//   const normalized = String(value || "").trim().toLowerCase();
//   if (!normalized) return undefined;
//   return crypto.createHash("sha256").update(normalized).digest("hex");
// };

// const hashPhone = (value) => {
//   const digits = String(value || "").replace(/\D/g, "");
//   return hash(/^01\d{9}$/.test(digits) ? `88${digits}` : digits);
// };
// const asHashArray = (value) => value ? [value] : undefined;

// const PLATFORM_EVENT_NAMES = {
//   PageView: { meta: "PageView", tiktok: "Pageview" },
//   ViewContent: { meta: "ViewContent", tiktok: "ViewContent" },
//   Search: { meta: "Search", tiktok: "Search" },
//   AddToCart: { meta: "AddToCart", tiktok: "AddToCart" },
//   InitiateCheckout: { meta: "InitiateCheckout", tiktok: "InitiateCheckout" },
//   AddPaymentInfo: { meta: "AddPaymentInfo", tiktok: "AddPaymentInfo" },
//   Lead: { meta: "Lead", tiktok: "SubmitForm" },
//   Contact: { meta: "Contact", tiktok: "Contact" },
//   Purchase: { meta: "Purchase", tiktok: "CompletePayment" },
// };

// const getPlatformEventName = (eventName, platform) =>
//   PLATFORM_EVENT_NAMES[eventName]?.[platform] || eventName;

// const clean = (obj) =>
//   Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined && value !== null && value !== ""));

// const postJson = async (url, payload, headers = {}) => {
//   const res = await fetch(url, {
//     method: "POST",
//     headers: { "Content-Type": "application/json", ...headers },
//     body: JSON.stringify(payload),
//     signal: AbortSignal.timeout(10000),
//   });
//   const data = await res.json().catch(() => ({}));
//   return { ok: res.ok && !data.error && !data.partialFailureError && (!('code' in data) || Number(data.code) === 0), status: res.status, data };
// };

// const toMetaEvent = ({ eventName, eventId, eventSourceUrl, userData, customData, ipAddress, userAgent }) => ({
//   event_name: eventName,
//   event_time: Math.floor(Date.now() / 1000),
//   event_id: eventId,
//   action_source: "website",
//   event_source_url: eventSourceUrl,
//   user_data: clean({
//     client_ip_address: ipAddress,
//     client_user_agent: userAgent,
//     em: asHashArray(hash(userData?.email)),
//     ph: asHashArray(hashPhone(userData?.phone)),
//     fn: asHashArray(hash(userData?.firstName || userData?.name)),
//     external_id: asHashArray(hash(userData?.customerId)),
//     fbp: userData?.fbp,
//     fbc: userData?.fbc,
//   }),
//   custom_data: clean(customData || {}),
// });

// const sendMeta = async (payload, context) => {
//   const pixels = await getActiveMetaPixels();
//   const results = [];
//   for (const pixel of pixels) {
//     const row = pixel.toJSON();
//     if (!row.pixelsId || !row.metaAccessToken) continue;
//     const apiVersion = process.env.META_GRAPH_API_VERSION || "v23.0";
//     const url = `https://graph.facebook.com/${apiVersion}/${encodeURIComponent(row.pixelsId)}/events?access_token=${encodeURIComponent(row.metaAccessToken)}`;
//     const body = {
//       data: [toMetaEvent({
//         ...payload,
//         eventName: getPlatformEventName(payload.eventName, "meta"),
//         ...context,
//       })],
//       ...(process.env.NODE_ENV !== "production" && row.testEventId ? { test_event_code: row.testEventId } : {}),
//     };
//     results.push({ platform: "meta", pixelId: row.pixelsId, ...(await postJson(url, body)) });
//   }
//   return results;
// };

// const toTiktokEvent = ({ eventName, eventId, eventSourceUrl, referrerUrl, userData, customData, ipAddress, userAgent }) => ({
//   event: getPlatformEventName(eventName, "tiktok"),
//   event_id: eventId,
//   event_time: Math.floor(Date.now() / 1000),
//   user: clean({
//     ip: ipAddress,
//     user_agent: userAgent,
//     email: hash(userData?.email),
//     phone: hashPhone(userData?.phone),
//     external_id: hash(userData?.customerId),
//     ttclid: userData?.ttclid,
//     ttp: userData?.ttp,
//   }),
//   properties: clean(customData || {}),
//   page: clean({ url: eventSourceUrl, referrer: referrerUrl }),
// });

// const sendTiktok = async (payload, context) => {
//   const pixels = await getActiveTiktokPixels();
//   const results = [];
//   for (const pixel of pixels) {
//     const row = pixel.toJSON();
//     if (!row.pixelCode || !row.accessToken) continue;
//     const body = {
//       pixel_code: row.pixelCode,
//       event_source: "web",
//       event_source_id: row.pixelCode,
//       data: [toTiktokEvent({ ...payload, ...context })],
//       ...(process.env.NODE_ENV !== "production" && row.testEventCode ? { test_event_code: row.testEventCode } : {}),
//     };
//     results.push({
//       platform: "tiktok",
//       pixelCode: row.pixelCode,
//       ...(await postJson("https://business-api.tiktok.com/open_api/v1.3/event/track/", body, {
//         "Access-Token": row.accessToken,
//       })),
//     });
//   }
//   return results;
// };

// const getGoogleAccessToken = async (config = {}) => {
//   const clientId = config.clientId || process.env.GOOGLE_ADS_CLIENT_ID;
//   const clientSecret = config.clientSecret || process.env.GOOGLE_ADS_CLIENT_SECRET;
//   const refreshToken = config.refreshToken || process.env.GOOGLE_ADS_REFRESH_TOKEN;
//   if (!clientId || !clientSecret || !refreshToken) return null;

//   const body = new URLSearchParams({
//     client_id: clientId,
//     client_secret: clientSecret,
//     refresh_token: refreshToken,
//     grant_type: "refresh_token",
//   });
//   const res = await fetch("https://oauth2.googleapis.com/token", {
//     method: "POST",
//     headers: { "Content-Type": "application/x-www-form-urlencoded" },
//     body,
//   });
//   const data = await res.json().catch(() => ({}));
//   if (!res.ok || !data.access_token) {
//     throw new Error(data.error_description || data.error || "Google Ads token request failed");
//   }
//   return data.access_token;
// };

// const getGoogleClickId = (userData = {}) =>
//   userData.gclid || userData.gbraid || userData.wbraid || null;

// const sendGoogleAds = async (payload) => {
//   if (payload.eventName !== "Purchase") return [];

//   const configs = await getActiveGoogleAds();
//   const results = [];
//   for (const config of configs) {
//     const row = config.toJSON();
//     const developerToken = row.developerToken || process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
//     const accessToken = await getGoogleAccessToken(row);
//     if (!developerToken || !accessToken) {
//       results.push({
//         platform: "google_ads",
//         conversionId: row.conversionId,
//         ok: false,
//         skipped: true,
//         reason: "Google Ads server credentials are not configured",
//       });
//       continue;
//     }
//     const customerId = String(row.customerId || process.env.GOOGLE_ADS_CUSTOMER_ID || "").replace(/\D/g, "");
//     const conversionActionId = String(row.conversionActionId || process.env.GOOGLE_ADS_CONVERSION_ACTION_ID || "").trim();
//     const clickId = getGoogleClickId(payload.userData);
//     if (!customerId || !conversionActionId || !clickId) {
//       results.push({
//         platform: "google_ads",
//         conversionId: row.conversionId,
//         ok: false,
//         skipped: true,
//         reason: "Missing customerId, conversionActionId, or Google click id",
//       });
//       continue;
//     }

//     const conversion = {
//       conversionAction: `customers/${customerId}/conversionActions/${conversionActionId}`,
//       conversionDateTime: new Date().toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "+00:00"),
//       conversionValue: Number(payload.customData?.value || 0),
//       currencyCode: payload.customData?.currency || "BDT",
//       orderId: String(payload.customData?.order_id || payload.eventId),
//       ...(payload.userData?.gclid ? { gclid: payload.userData.gclid } : {}),
//       ...(payload.userData?.gbraid ? { gbraid: payload.userData.gbraid } : {}),
//       ...(payload.userData?.wbraid ? { wbraid: payload.userData.wbraid } : {}),
//     };
//     const headers = {
//       Authorization: `Bearer ${accessToken}`,
//       "developer-token": developerToken,
//     };
//     const loginCustomerId = String(row.loginCustomerId || process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || "").replace(/\D/g, "");
//     if (loginCustomerId) headers["login-customer-id"] = loginCustomerId;

//     const url = `https://googleads.googleapis.com/v17/customers/${customerId}:uploadClickConversions`;
//     results.push({
//       platform: "google_ads",
//       conversionId: row.conversionId,
//       ...(await postJson(url, { conversions: [conversion], partialFailure: true }, headers)),
//     });
//   }
//   return results;
// };

// const getPublicConfig = () =>
//   cached("public", async () => {
//     const [metaPixels, tiktokPixels, googleAds] = await Promise.all([
//       FacebookPixelService.getPublicFromDB(),
//       TiktokPixelService.getPublicFromDB(),
//       GoogleAdsService.getPublicFromDB(),
//     ]);
//     return { metaPixels, tiktokPixels, googleAds };
//   });

// const toEvent = (payload = {}) => {
//   const eventName = String(payload.eventName || "").trim();
//   if (!eventName) throw new ApiError(400, "eventName is required");
//   const eventId = payload.eventId || `${eventName}.${Date.now()}.${Math.random().toString(16).slice(2)}`;
//   return { ...payload, eventName, eventId };
// };

// const getEventContext = (req) => ({
//   ipAddress: getClientIp(req),
//   userAgent: req.headers["user-agent"],
// });

// const deliverEvent = async (basePayload, context) => {
//   const [meta, tiktok, googleAds] = await Promise.all([
//     sendMeta(basePayload, context).catch((error) => [{ platform: "meta", ok: false, error: error.message }]),
//     sendTiktok(basePayload, context).catch((error) => [{ platform: "tiktok", ok: false, error: error.message }]),
//     sendGoogleAds(basePayload).catch((error) => [{ platform: "google_ads", ok: false, error: error.message }]),
//   ]);
//   return { eventId: basePayload.eventId, results: [...meta, ...tiktok, ...googleAds] };
// };

// // Waits for every platform; used where the caller acts on the results
// // (order.controller retries Purchase delivery).
// const trackEvent = async (payload, req) => deliverEvent(toEvent(payload), getEventContext(req));

// // Validates now and delivers in the background. Browsers ignore the platform
// // results, and holding the request open (up to 10s per platform) kept a
// // server process busy for every storefront event.
// const queueEvent = (payload, req) => {
//   const basePayload = toEvent(payload);
//   const context = getEventContext(req);
//   deliverEvent(basePayload, context)
//     .then(({ results }) => {
//       const failures = results.filter((item) => !item.ok && !item.skipped);
//       if (failures.length) {
//         console.warn(
//           `Tracking ${basePayload.eventName} delivery failed:`,
//           failures.map(({ platform, status, error }) => ({ platform, status, error })),
//         );
//       }
//     })
//     .catch((error) => console.warn(`Tracking ${basePayload.eventName} failed: ${error.message}`));
//   return { eventId: basePayload.eventId, queued: true };
// };

// module.exports = { getPublicConfig, trackEvent, queueEvent };

const crypto = require("crypto");
const ApiError = require("../../../error/ApiError");
const { getClientIp } = require("../../utils/clientIp");

const FacebookPixelService = require("../facebookPixel/facebookPixel.service");
const TiktokPixelService = require("../tiktokPixel/tiktokPixel.service");
const GoogleAdsService = require("../googleAds/googleAds.service");
const { cached } = require("./tracking.cache");

// ============================================
// ACTIVE TRACKING CONFIGURATIONS
// ============================================

const getActiveMetaPixels = () =>
  cached("meta:active", FacebookPixelService.getActiveFromDB);

const getActiveTiktokPixels = () =>
  cached("tiktok:active", TiktokPixelService.getActiveFromDB);

const getActiveGoogleAds = () =>
  cached("googleAds:active", GoogleAdsService.getActiveFromDB);

// ============================================
// HASHING AND DATA HELPERS
// ============================================

const hash = (value) => {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  if (!normalized) return undefined;

  return crypto.createHash("sha256").update(normalized).digest("hex");
};

const normalizeBDPhone = (value) => {
  const digits = String(value ?? "").replace(/\D/g, "");

  if (/^01\d{9}$/.test(digits)) {
    return `88${digits}`;
  }

  if (/^8801\d{9}$/.test(digits)) {
    return digits;
  }

  return digits;
};

const hashPhone = (value) => hash(normalizeBDPhone(value));

const asHashArray = (value) => (value ? [value] : undefined);

const clean = (obj = {}) =>
  Object.fromEntries(
    Object.entries(obj).filter(
      ([, value]) => value !== undefined && value !== null && value !== "",
    ),
  );

const validAmount = (value) => {
  if (
    value === undefined ||
    value === null ||
    value === "" ||
    typeof value === "boolean"
  ) {
    return null;
  }

  const amount = Number(value);

  return Number.isFinite(amount) && amount > 0 ? amount : null;
};

// ============================================
// EVENT NAME MAPPING
// ============================================

const PLATFORM_EVENT_NAMES = {
  PageView: {
    meta: "PageView",
    tiktok: "Pageview",
  },
  ViewContent: {
    meta: "ViewContent",
    tiktok: "ViewContent",
  },
  Search: {
    meta: "Search",
    tiktok: "Search",
  },
  AddToCart: {
    meta: "AddToCart",
    tiktok: "AddToCart",
  },
  InitiateCheckout: {
    meta: "InitiateCheckout",
    tiktok: "InitiateCheckout",
  },
  AddPaymentInfo: {
    meta: "AddPaymentInfo",
    tiktok: "AddPaymentInfo",
  },
  Lead: {
    meta: "Lead",
    tiktok: "SubmitForm",
  },
  Contact: {
    meta: "Contact",
    tiktok: "Contact",
  },
  Purchase: {
    meta: "Purchase",
    tiktok: "CompletePayment",
  },
};

const getPlatformEventName = (eventName, platform) =>
  PLATFORM_EVENT_NAMES[eventName]?.[platform] || eventName;

// ============================================
// API REQUEST HELPER
// ============================================

const postJson = async (url, payload, headers = {}) => {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });

  const data = await res.json().catch(() => ({}));

  const hasError =
    Boolean(data.error) ||
    Boolean(data.partialFailureError) ||
    (Object.prototype.hasOwnProperty.call(data, "code") &&
      Number(data.code) !== 0);

  return {
    ok: res.ok && !hasError,
    status: res.status,
    data,
  };
};

// ============================================
// PURCHASE VALUE NORMALIZATION
// ============================================

const normalizePurchaseData = (payload) => {
  if (payload.eventName !== "Purchase") {
    return payload;
  }

  const value = validAmount(payload.customData?.value);

  if (value === null) {
    throw new ApiError(400, "Purchase event requires a valid positive value");
  }

  const eventId = String(payload.eventId || "").trim();

  if (!eventId) {
    throw new ApiError(400, "Purchase event requires an eventId");
  }

  return {
    ...payload,
    eventId,
    customData: {
      ...(payload.customData || {}),
      value,
      currency: String(payload.customData?.currency || "BDT").toUpperCase(),
    },
  };
};

// ============================================
// META CONVERSIONS API EVENT
// ============================================

const toMetaEvent = ({
  eventName,
  eventId,
  eventSourceUrl,
  userData,
  customData,
  ipAddress,
  userAgent,
}) => ({
  event_name: eventName,

  event_time: Math.floor(Date.now() / 1000),

  event_id: eventId,

  action_source: "website",

  event_source_url: eventSourceUrl,

  user_data: clean({
    client_ip_address: ipAddress,
    client_user_agent: userAgent,

    em: asHashArray(hash(userData?.email)),

    ph: asHashArray(hashPhone(userData?.phone)),

    fn: asHashArray(hash(userData?.firstName || userData?.name)),

    external_id: asHashArray(hash(userData?.customerId)),

    fbp: userData?.fbp,
    fbc: userData?.fbc,
  }),

  custom_data: clean(customData || {}),
});

// ============================================
// SEND META CAPI EVENT
// ============================================

const sendMeta = async (payload, context) => {
  const pixels = await getActiveMetaPixels();
  const results = [];

  for (const pixel of pixels) {
    const row = typeof pixel.toJSON === "function" ? pixel.toJSON() : pixel;

    if (!row.pixelsId || !row.metaAccessToken) {
      continue;
    }

    const apiVersion = process.env.META_GRAPH_API_VERSION || "v23.0";

    const url =
      `https://graph.facebook.com/${apiVersion}/` +
      `${encodeURIComponent(row.pixelsId)}/events` +
      `?access_token=${encodeURIComponent(row.metaAccessToken)}`;

    const metaEvent = toMetaEvent({
      ...payload,
      eventName: getPlatformEventName(payload.eventName, "meta"),
      ...context,
    });

    const body = {
      data: [metaEvent],

      ...(process.env.NODE_ENV !== "production" && row.testEventId
        ? { test_event_code: row.testEventId }
        : {}),
    };

    const response = await postJson(url, body);

    results.push({
      platform: "meta",
      pixelId: row.pixelsId,
      ...response,
    });

    if (!response.ok) {
      console.warn("Meta CAPI event delivery failed", {
        eventName: payload.eventName,
        eventId: payload.eventId,
        pixelId: row.pixelsId,
        status: response.status,
        error: response.data?.error?.message,
      });
    }
  }

  return results;
};

// ============================================
// TIKTOK EVENT FORMAT
// ============================================

const toTiktokEvent = ({
  eventName,
  eventId,
  eventSourceUrl,
  referrerUrl,
  userData,
  customData,
  ipAddress,
  userAgent,
}) => ({
  event: getPlatformEventName(eventName, "tiktok"),

  event_id: eventId,

  event_time: Math.floor(Date.now() / 1000),

  user: clean({
    ip: ipAddress,
    user_agent: userAgent,

    email: hash(userData?.email),
    phone: hashPhone(userData?.phone),
    external_id: hash(userData?.customerId),

    ttclid: userData?.ttclid,
    ttp: userData?.ttp,
  }),

  properties: clean(customData || {}),

  page: clean({
    url: eventSourceUrl,
    referrer: referrerUrl,
  }),
});

// ============================================
// SEND TIKTOK EVENT
// ============================================

const sendTiktok = async (payload, context) => {
  const pixels = await getActiveTiktokPixels();
  const results = [];

  for (const pixel of pixels) {
    const row = typeof pixel.toJSON === "function" ? pixel.toJSON() : pixel;

    if (!row.pixelCode || !row.accessToken) {
      continue;
    }

    const body = {
      pixel_code: row.pixelCode,
      event_source: "web",
      event_source_id: row.pixelCode,

      data: [
        toTiktokEvent({
          ...payload,
          ...context,
        }),
      ],

      ...(process.env.NODE_ENV !== "production" && row.testEventCode
        ? { test_event_code: row.testEventCode }
        : {}),
    };

    const response = await postJson(
      "https://business-api.tiktok.com/open_api/v1.3/event/track/",
      body,
      {
        "Access-Token": row.accessToken,
      },
    );

    results.push({
      platform: "tiktok",
      pixelCode: row.pixelCode,
      ...response,
    });
  }

  return results;
};

// ============================================
// GOOGLE ADS ACCESS TOKEN
// ============================================

const getGoogleAccessToken = async (config = {}) => {
  const clientId = config.clientId || process.env.GOOGLE_ADS_CLIENT_ID;

  const clientSecret =
    config.clientSecret || process.env.GOOGLE_ADS_CLIENT_SECRET;

  const refreshToken =
    config.refreshToken || process.env.GOOGLE_ADS_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    return null;
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || !data.access_token) {
    throw new Error(
      data.error_description || data.error || "Google Ads token request failed",
    );
  }

  return data.access_token;
};

// ============================================
// GOOGLE ADS CLICK ID
// ============================================

const getGoogleClickId = (userData = {}) =>
  userData.gclid || userData.gbraid || userData.wbraid || null;

// ============================================
// SEND GOOGLE ADS PURCHASE
// ============================================

const sendGoogleAds = async (payload) => {
  if (payload.eventName !== "Purchase") {
    return [];
  }

  const configs = await getActiveGoogleAds();
  const results = [];

  for (const config of configs) {
    const row = typeof config.toJSON === "function" ? config.toJSON() : config;

    const developerToken =
      row.developerToken || process.env.GOOGLE_ADS_DEVELOPER_TOKEN;

    const accessToken = await getGoogleAccessToken(row);

    if (!developerToken || !accessToken) {
      results.push({
        platform: "google_ads",
        conversionId: row.conversionId,
        ok: false,
        skipped: true,
        reason: "Google Ads credentials are not configured",
      });
      continue;
    }

    const customerId = String(
      row.customerId || process.env.GOOGLE_ADS_CUSTOMER_ID || "",
    ).replace(/\D/g, "");

    const conversionActionId = String(
      row.conversionActionId ||
        process.env.GOOGLE_ADS_CONVERSION_ACTION_ID ||
        "",
    ).trim();

    const clickId = getGoogleClickId(payload.userData);

    if (!customerId || !conversionActionId || !clickId) {
      results.push({
        platform: "google_ads",
        conversionId: row.conversionId,
        ok: false,
        skipped: true,
        reason: "Missing customerId, conversionActionId, or Google click id",
      });
      continue;
    }

    const conversion = {
      conversionAction:
        `customers/${customerId}/conversionActions/` + conversionActionId,

      conversionDateTime: new Date()
        .toISOString()
        .replace("T", " ")
        .replace(/\.\d{3}Z$/, "+00:00"),

      conversionValue: Number(payload.customData.value),

      currencyCode: payload.customData.currency || "BDT",

      orderId: String(payload.customData.order_id || payload.eventId),

      ...(payload.userData?.gclid ? { gclid: payload.userData.gclid } : {}),

      ...(payload.userData?.gbraid ? { gbraid: payload.userData.gbraid } : {}),

      ...(payload.userData?.wbraid ? { wbraid: payload.userData.wbraid } : {}),
    };

    const headers = {
      Authorization: `Bearer ${accessToken}`,
      "developer-token": developerToken,
    };

    const loginCustomerId = String(
      row.loginCustomerId || process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || "",
    ).replace(/\D/g, "");

    if (loginCustomerId) {
      headers["login-customer-id"] = loginCustomerId;
    }

    const apiVersion = process.env.GOOGLE_ADS_API_VERSION || "v23";

    const url =
      `https://googleads.googleapis.com/${apiVersion}/` +
      `customers/${customerId}:uploadClickConversions`;

    const response = await postJson(
      url,
      {
        conversions: [conversion],
        partialFailure: true,
      },
      headers,
    );

    results.push({
      platform: "google_ads",
      conversionId: row.conversionId,
      ...response,
    });
  }

  return results;
};

// ============================================
// PUBLIC TRACKING CONFIGURATION
// ============================================

const getPublicConfig = () =>
  cached("public", async () => {
    const [metaPixels, tiktokPixels, googleAds] = await Promise.all([
      FacebookPixelService.getPublicFromDB(),
      TiktokPixelService.getPublicFromDB(),
      GoogleAdsService.getPublicFromDB(),
    ]);

    return {
      metaPixels,
      tiktokPixels,
      googleAds,
    };
  });

// ============================================
// EVENT VALIDATION
// ============================================

const toEvent = (payload = {}) => {
  const eventName = String(payload.eventName || "").trim();

  if (!eventName) {
    throw new ApiError(400, "eventName is required");
  }

  const eventId =
    payload.eventId ||
    `${eventName}.${Date.now()}.` + Math.random().toString(16).slice(2);

  return normalizePurchaseData({
    ...payload,
    eventName,
    eventId,
  });
};

// ============================================
// REQUEST CONTEXT
// ============================================

const getEventContext = (req = {}) => ({
  ipAddress: getClientIp(req),

  userAgent: req.headers?.["user-agent"],
});

// ============================================
// DELIVER EVENT TO ALL PLATFORMS
// ============================================

const deliverEvent = async (basePayload, context) => {
  const [meta, tiktok, googleAds] = await Promise.all([
    sendMeta(basePayload, context).catch((error) => [
      {
        platform: "meta",
        ok: false,
        error: error.message,
      },
    ]),

    sendTiktok(basePayload, context).catch((error) => [
      {
        platform: "tiktok",
        ok: false,
        error: error.message,
      },
    ]),

    sendGoogleAds(basePayload).catch((error) => [
      {
        platform: "google_ads",
        ok: false,
        error: error.message,
      },
    ]),
  ]);

  return {
    eventId: basePayload.eventId,
    results: [...meta, ...tiktok, ...googleAds],
  };
};

// ============================================
// TRACK EVENT (WAIT FOR DELIVERY)
// ============================================

const trackEvent = async (payload, req) => {
  const basePayload = toEvent(payload);

  return deliverEvent(basePayload, getEventContext(req));
};

// ============================================
// QUEUE EVENT (NON-BLOCKING)
// ============================================

const queueEvent = (payload, req) => {
  const basePayload = toEvent(payload);
  const context = getEventContext(req);

  void deliverEvent(basePayload, context)
    .then(({ results }) => {
      const failures = results.filter((item) => !item.ok && !item.skipped);

      if (failures.length) {
        console.warn(
          `Tracking ${basePayload.eventName} delivery failed:`,
          failures.map(({ platform, status, error }) => ({
            platform,
            status,
            error,
          })),
        );
      }
    })
    .catch((error) => {
      console.warn(`Tracking ${basePayload.eventName} failed:`, error.message);
    });

  return {
    eventId: basePayload.eventId,
    queued: true,
  };
};

// ============================================
// MODULE EXPORTS
// ============================================

module.exports = {
  getPublicConfig,
  trackEvent,
  queueEvent,
};
