# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Hugo static site for `halal.capulongfarms.org` — the Halal Division variant of Capulong Farms. See `capulongfarms/CLAUDE.md` for full architecture details; this file documents only what differs.

## Commands

```bash
hugo server -D     # Dev server at localhost:1313
hugo               # Production build → public/
hugo --gc          # Clean build cache
```

## How This Site Differs from capulongfarms/

| Aspect | capulongfarms/ | capulongfarms-halal/ |
|--------|---------------|----------------------|
| baseURL | capulongfarms.org | halal.capulongfarms.org |
| Branding | "Capulong Farms" | "Capulong Farms - Halal Division" |
| Hero image | `/images/farm-photo.jpg` | `/images/halal-photo.jpg` |
| Product catalog | All products | Halal-certified products only |
| External link tab | Links to halal site | Links to main site |
| portal_source | `portal-main` | `portal-halal` |

## JS and Template Files

`cart.js`, `app.js`, `style.css`, `baseof.html`, and all partials are **kept byte-for-byte identical** with the main site. When changing shared logic, apply the change to both repos and verify with `diff`.

The only legitimately different template file is `themes/capulong/layouts/index.html` — branding text and hero image only; the product grid, cart, search, and order form logic are identical.

All key gotchas from `capulongfarms/CLAUDE.md` apply here:
- Deal of the Day: `deal_of_the_day: true` in YAML → `data-deal-of-the-day="true"` on card → JS reads attribute. Only one product should be flagged.
- `price_on_request: true` in YAML → shows "Price on Request" + WhatsApp inquiry button instead of cart controls.
- Product ID format mismatch between Hugo `urlize` and Deal of Day JS regex — not interchangeable.
- CSS and JS cache busting is manual: increment `?v=YYYYMMDD` in `baseof.html` for all three assets after every change.
- **Order form modal `style="display:none;"` inline** — do not remove it. On mobile (≤480px), `.order-form-content` has `position:fixed` and can escape a parent's CSS `display:none` on WebKit/Blink, causing the modal to appear on page load. The inline style on the element itself prevents this browser bug.
- **Home nav link scroll** — Home menu entry uses `url = "#home"` in `hugo.toml`, targeting `<section id="home">` at the top of the page. Browser handles scroll natively; CSS `html { scroll-behavior: smooth }` makes it smooth. No JS onclick needed. `updateActiveLink()` matches `href="#home"` in the no-hash case.

## Deployment

Deployed on **Cloudflare Pages** (project: `halal-capulongfarms-org`) — identical setup to the main portal. Auto-deploys on every `git push` to `main`; Cloudflare runs `hugo` and serves `public/`. No `wrangler.jsonc`, no manual deploy step needed.

Previously this repo had a `wrangler.jsonc` that caused it to deploy as a **Cloudflare Worker** instead of Pages, requiring manual `wrangler deploy` for CSS/asset changes. That file was removed on 2026-06-20 and the project was recreated as a Pages site.

## Contact Configuration

- **WhatsApp**: `966542761620` (in `hugo.toml` → `params.whatsapp_number`)
- **Messenger ID**: `61582708015159` hardcoded in **3 places across 3 files** — `app.js`, `index.html`, `partials/contacts-button.html`. Update all if changed.
- **GCash QR**: `hugo.toml` → `params.gcash_qr_image`
