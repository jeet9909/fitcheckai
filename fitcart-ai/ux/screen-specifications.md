# UX — Screen-by-Screen Specifications

Each screen: **purpose · key elements · states · actions · accessibility · edge cases**. Wireframes in `ux/wireframes.md`.

---

## 1. Splash
- **Purpose:** brand + fast route to value.
- **Elements:** logo, tagline.
- **States:** loading (auth check).
- **Actions:** auto-advance.
- **A11y:** announced app name.

## 2. Onboarding carousel
- **Purpose:** communicate value in <5s.
- **Elements:** 3 slides (try-on, cross-store, fit score), pager, CTA.
- **Actions:** Get Started / Have account.
- **A11y:** each slide has a text alternative; swipe + button navigation.

## 3. Register / Login
- **Purpose:** minimal-friction account.
- **Elements:** email/phone, OTP, social login.
- **States:** input, OTP-sent, error, success.
- **Edge:** OTP resend, invalid OTP, rate-limit.
- **A11y:** labelled fields, error text (not color-only).

## 4. Consent (granular)
- **Purpose:** verifiable, un-bundled consent before body upload.
- **Elements:** plain-language explainer + 4 toggles (processing/storage/model-improvement/transfer), links to policy.
- **States:** none pre-ticked; processing required to continue to avatar.
- **Actions:** Save; revisit in Settings.
- **A11y:** each toggle labelled with purpose; screen-reader reads implications.
- **Rule:** no dark patterns; declining is easy.

## 5. Home
- **Purpose:** hub — avatar, search, recommendations, saved.
- **Elements:** avatar card (+confidence, regen), search, connected-stores chip, recommended/saved carousels, tab bar.
- **States:** no-avatar (prompt to create), avatar-ready.
- **Actions:** search, open outfit builder, tap recommendation.
- **A11y:** confidence stated in text; carousels keyboard-navigable.

## 6. Store Connection
- **Purpose:** enable sources; set expectations honestly.
- **Elements:** store list with **capability badges** (Discover ✓ · Cart-sync ✗/Partner), connect toggles.
- **States:** connected/available/partner-only.
- **Actions:** connect, learn-more.
- **Edge:** clearly show "Open in store to buy" for non-partner stores.
- **A11y:** capability described textually.

## 7. Discovery / Search
- **Purpose:** cross-store product finding.
- **Elements:** search bar, filters (category/price/size/color/store), result grid with store tag + price.
- **States:** loading, results, empty, feed-stale notice.
- **Actions:** open product, add to outfit.
- **Edge:** price disclaimer ("confirm on store").
- **A11y:** results as list semantics; filter announcements.

## 8. Product Details
- **Purpose:** decide + add to outfit.
- **Elements:** images, price, sizes, colors, availability, store, size chart, "Add to Outfit", "Try On".
- **States:** variant selection, unavailable.
- **A11y:** image alt text, variant labels.

## 9. Body Upload
- **Purpose:** capture quality input.
- **Elements:** pose guide overlay, height (required)/weight (optional), live check list, retake/upload.
- **States:** pre-check, uploading, validation issues, ok.
- **Edge:** each issue → specific guidance.
- **A11y:** audio-guided framing; text checklist.
- **Privacy:** "deleted after avatar generation" notice.

## 10. Avatar Generation
- **Purpose:** honest async progress → delightful reveal.
- **Elements:** progress %, step labels, estimate, push opt-in.
- **States:** queued, processing, done (reveal + confidence), failed (retry).
- **A11y:** progress announced; reveal described.

## 11. Outfit Builder
- **Purpose:** compose multi-store outfit.
- **Elements:** avatar preview, item list (edit/remove), add-by-category, Try On.
- **States:** empty, building.
- **Actions:** add/remove/swap, try on.
- **A11y:** list semantics; category buttons labelled.

## 12. 360° Try-On Viewer
- **Purpose:** the aha — inspect the look.
- **Elements:** render area (drag=rotate across angle set, pinch=zoom), angle indicator, item show/hide, variant swap, texture button, fit+outfit summary chips, actions.
- **States:** rendering, ready, partial (some items failed), low-quality warning.
- **Actions:** rotate, zoom, toggle items, open fit report, add to cart, save.
- **A11y:** **each angle has a described state**; controls labelled; fit chip readable.
- **Honesty:** labeled "multi-angle preview" (not "real-time 3D") at MVP.

## 13. Fit Report
- **Purpose:** answer "will it fit me?"
- **Elements:** overall Fit Score + confidence, per-region bars, plain-language note, **Read-aloud**, fit-feedback thumbs.
- **States:** high/low confidence (honest note when data limited).
- **A11y:** full textual narration; no color-only signals.

## 14. Texture Inspector
- **Purpose:** inspect fabric/detail.
- **Elements:** high-res zoom, optional SR, source-image note.
- **Honesty:** "detail view from product imagery," not material capture.
- **A11y:** described where possible.

## 15. Cart (FitCart)
- **Purpose:** review basket grouped by store.
- **Elements:** items by store + price, disclaimer, per-store handoff buttons, (partner) sync.
- **States:** empty, items, price-changed notice.
- **A11y:** grouped list semantics.

## 16. Checkout Handoff
- **Purpose:** route to store honestly.
- **Elements:** "you'll finish buying in {store}" + Open buttons (affiliate) / partner sync.
- **A11y:** clear action labels.

## 17. Saved Outfits
- **Purpose:** revisit/compare looks.
- **Elements:** grid, compare-two (V2), share (V2).

## 18. Profile / Privacy / Settings
- **Purpose:** control + rights.
- **Elements:** consents, export data, delete body data, delete account, data-saver mode, accessibility settings, theme.
- **A11y:** all controls labelled; destructive actions confirmed.

---

## Global UX principles
1. **Trust-first** (privacy visible, honest confidence).
2. **Honest capability** (never fake 3D/measurement/cart-sync).
3. **Inclusive** (WCAG 2.2 AA, textual fit narration, diverse bodies).
4. **India-ready** (data-saver, mid-range perf, price clarity).
5. **Aha fast** (minimize friction to first try-on).
