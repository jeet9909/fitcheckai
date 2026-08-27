# User Journey Maps

End-to-end journeys from first open to purchase. Emotional arc noted to guide UX priorities. Detailed screen specs in `ux/screen-specifications.md`; flow diagrams in `diagrams/user-flow.md`.

---

## Journey 1 — First-time onboarding → first try-on (the "aha")


| Stage          | User action              | System                                       | User emotion       | Design imperative                             |
| -------------- | ------------------------ | -------------------------------------------- | ------------------ | --------------------------------------------- |
| Discover       | Installs app             | Splash, value prop                           | Curious            | Communicate value in <5s                      |
| Onboard        | Swipes intro             | Explains "try before you buy, across stores" | Interested         | Show, don't tell                              |
| Consent        | Reviews privacy          | **Explicit body-data consent** (granular)    | Cautious           | Trust-first; plain language; no dark patterns |
| Connect stores | Picks stores             | Enables affiliate/deep-link sources          | Engaged            | Frictionless; "connect later" allowed         |
| Body upload    | Uploads full-body photo  | Validates pose/lighting/distance/visibility  | Nervous/hopeful    | Real-time guidance, reassurance, examples     |
| Avatar gen     | Waits                    | Async job → avatar + **confidence score**    | Anticipation       | Honest progress, delightful reveal            |
| First try-on   | Adds 1 item, taps Try On | Render + fit score                           | **Delight (aha!)** | This moment decides retention                 |
| Handoff        | Taps "Open in store"     | Deep-link + affiliate                        | Satisfied          | Seamless exit; save state                     |


**Critical moment:** the avatar reveal + first fit score. Everything before it is friction to minimize; this moment is the product.

---

## Journey 2 — Returning user builds a full cross-store outfit

1. Opens app → Home shows saved avatar + recommendations.
2. Searches "white sneakers" → results span Amazon + Ajio.
3. Adds sneakers, then a Myntra shirt, then Flipkart jeans → **Outfit Builder** shows the growing look.
4. Taps **Try On Outfit** → avatar wears all items; rotates 360°; zooms into shirt texture.
5. Reads **Outfit Score** (color harmony 8.2, occasion: smart-casual, body-shape: good).
6. Swaps jeans color variant → score updates live.
7. Saves outfit; adds to **FitCart**.
8. Checks out: app opens each store to the exact product (affiliate-attributed), or (partner stores) offers "Sync to cart."

**Emotional arc:** exploration → creative flow → confidence → action. The outfit engine must feel *responsive* (live re-scoring).

---

## Journey 3 — Plus-size user, fit-anxiety reduction

1. Uploads photo; app validates and generates an avatar that **reflects her real shape** (no idealization).
2. Tries a dress flagged by the brand as "runs small"; FitCart's fit engine warns and suggests size up, confidence 78%.
3. Reads a **textual, respectful** fit narration.
4. Buys with confidence; later marks "fit was accurate" → **feeds the data flywheel**.

**Imperative:** never render a slimmed body; honesty > flattery. Post-purchase fit feedback is the moat's fuel.

---

## Journey 4 — Accessibility user (screen reader)

1. Navigates onboarding fully via screen reader (semantic labels).
2. Uploads photo with audio-guided framing.
3. Receives **spoken fit narration** ("shoulders fit well; sleeves slightly long") — not just a visual.
4. Completes handoff via accessible controls.

**Imperative:** every visual insight has a text/audio equivalent; the 360° viewer exposes described states.

---

## Journey 5 — Checkout handoff reality (honest)


| Store type         | Handoff                                                                                                                 |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Most stores (MVP)  | "Open in {store}" deep-link, product pre-loaded, affiliate tag attached — **user adds to cart & pays in the store app** |
| Partner store (V3) | "Sync to cart" writes items to the store cart via partner API (only where a deal exists)                                |
| Amazon             | PA-API-backed product page deep-link with Associates tag                                                                |


The app **saves the outfit and cart state** so the user can return; we never claim to have completed a purchase we didn't.

---

## Cross-journey friction map (where users drop, and the fix)


| Drop-off risk                          | Fix                                                                            |
| -------------------------------------- | ------------------------------------------------------------------------------ |
| Privacy hesitation at consent          | Trust-first copy, granular consent, "delete anytime," on-device where possible |
| Bad photo → poor avatar                | Real-time capture guidance + retake prompts before processing                  |
| Slow avatar generation                 | Async job + honest progress + push notification when ready                     |
| Fit distrust after one bad call        | Always show confidence; collect post-purchase feedback; improve                |
| Confusing handoff ("where's my cart?") | Explicit "you'll finish buying in {store}" messaging                           |


