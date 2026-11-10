const { Op } = require("sequelize");

// Landing pages live at the site root (holydeen.com/<slug>), so a slug must never
// shadow a storefront route or a file the server answers itself.
const RESERVED_SLUGS = new Set([
  "account",
  "api",
  "categories",
  "category",
  "checkout",
  "contact",
  "contact-us",
  "favicon.ico",
  "images",
  "landing-page",
  "login",
  "order-success",
  "page",
  "product",
  "products",
  "re-confirm",
  "refund-policy",
  "robots.txt",
  "scratch-card",
  "sitemap.xml",
  "track-order",
]);

const MAX_SLUG_LENGTH = 150;

/**
 * Campaign title -> URL path. Keeps letters of any script (Bangla included, with its
 * vowel signs) and digits; everything else (spaces, emoji, punctuation) becomes "-".
 */
const toLandingSlug = (title) => {
  const slug = String(title || "")
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/, "");
  if (!slug) return "campaign";
  // A digits-only path is read as an old numeric landing page id.
  return /^\d+$/.test(slug) ? `campaign-${slug}` : slug;
};

/** A slug for `title` that no other landing page (deleted ones included) uses. */
const uniqueLandingSlug = async (LandingPage, title, excludeId = null) => {
  const base = toLandingSlug(title);
  const rows = await LandingPage.findAll({
    attributes: ["Id", "slug"],
    where: {
      slug: { [Op.or]: [base, { [Op.like]: `${base}-%` }] },
      ...(excludeId ? { Id: { [Op.ne]: excludeId } } : {}),
    },
    paranoid: false,
    raw: true,
  });
  const taken = new Set(rows.map((row) => row.slug));
  const isFree = (slug) => !taken.has(slug) && !RESERVED_SLUGS.has(slug);
  if (isFree(base)) return base;
  for (let n = 2; ; n += 1) {
    if (isFree(`${base}-${n}`)) return `${base}-${n}`;
  }
};

module.exports = { toLandingSlug, uniqueLandingSlug, RESERVED_SLUGS };
