# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Hugo static site for `halal.capulongfarms.org` — the Halal Division variant of Capulong Farms. Structurally identical to `capulongfarms/` but with halal-specific branding and products. See `capulongfarms/CLAUDE.md` for full architecture details; this file documents only what differs.

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

## JS and Template Files

`app.js`, `cart.js`, and all layout templates are **independently maintained copies** — not symlinked or shared with the main site. Changes to shared logic (cart behavior, Deal of the Day, contact handlers) must be manually applied in both repos.

All key gotchas from `capulongfarms/CLAUDE.md` apply here too:
- Deal of the Day is driven by the YAML `deal_of_the_day: true` flag (template sets `data-deal-of-the-day="true"`; JS reads that attribute — only one product should be flagged)
- Product ID format mismatch between Hugo `urlize` and Deal of Day JS regex — not interchangeable
- CSS **and JS** cache busting is manual: increment `?v=YYYYMMDD` on the CSS link and both JS script tags in `themes/capulong/layouts/_default/baseof.html`

## Contact Configuration

- **WhatsApp**: `966542761620` (in `hugo.toml` → `params.whatsapp_number`)
- **Messenger ID**: `61582708015159` hardcoded in **5 places across 4 files** — `cart.js` (×2), `app.js`, `index.html`, `partials/contacts-button.html`. Update all if changed.
- **GCash QR**: `hugo.toml` → `params.gcash_qr_image`
