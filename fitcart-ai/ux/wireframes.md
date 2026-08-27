# UX — Low-Fidelity Wireframes

ASCII/text wireframes for key screens. Fidelity intentionally low (structure, not visual design). Pair with `ux/screen-specifications.md`.

## 1. Onboarding
```
┌─────────────────────────────┐
│           FitCart AI        │
│                             │
│   [ illustration ]          │
│                             │
│  Try before you buy —       │
│  across all your stores.    │
│                             │
│   ●  ○  ○                   │
│                             │
│  [   Get Started   ]        │
│  I already have an account  │
└─────────────────────────────┘
```

## 2. Home
```
┌─────────────────────────────┐
│ FitCart      🔔   👤        │
│ ┌─────────────────────────┐ │
│ │  Your Avatar   [regen]  │ │
│ │      ◔ 82% confidence   │ │
│ └─────────────────────────┘ │
│ Search fashion... 🔍         │
│ Connected: Amazon Ajio +    │
│ ── Recommended outfits ──   │
│ [card][card][card] →        │
│ ── Saved outfits ──         │
│ [card][card] →              │
│ [🏠][🔎][👗 Outfit][🛒][👤]│
└─────────────────────────────┘
```

## 3. Body Upload + Validation
```
┌─────────────────────────────┐
│ ← Body Upload               │
│ ┌─────────────────────────┐ │
│ │   [ full-body outline ] │ │
│ │   stand 2m, face cam    │ │
│ └─────────────────────────┘ │
│ Height [ 170 cm ] Weight[__]│
│ Checks:                     │
│  ✅ Full body   ✅ Lighting │
│  ⚠️ Move back (feet cut off)│
│ [ Retake ]   [ Upload ]     │
│ 🔒 Deleted after avatar gen │
└─────────────────────────────┘
```

## 4. Avatar Generation (progress)
```
┌─────────────────────────────┐
│ Building your avatar...      │
│      (  ◔  )  62%            │
│ Analyzing body shape         │
│ Matching skin tone & posture │
│ ─────────────────────────── │
│ We'll notify you when ready. │
│ Estimate: ~40s               │
└─────────────────────────────┘
```

## 5. Outfit Builder
```
┌─────────────────────────────┐
│ ← Build Outfit              │
│ Avatar preview              │
│ ┌───┐ Shirt  (Myntra) ✏️ ✕ │
│ ┌───┐ Jeans  (Ajio)   ✏️ ✕ │
│ ┌───┐ Shoes  (Amazon) ✏️ ✕ │
│ + Add: 👕 👖 👟 ⌚ 🕶️ 🧥   │
│ ─────────────────────────── │
│ [    Try On Outfit    ]     │
└─────────────────────────────┘
```

## 6. 360° Try-On Viewer
```
┌─────────────────────────────┐
│ ← Try-On            ⤢ zoom  │
│ ┌─────────────────────────┐ │
│ │      [ avatar+outfit ]  │ │
│ │   ◄  drag to rotate  ►  │ │
│ └─────────────────────────┘ │
│ ⟲ 0° 45° 90° ...  (angles)  │
│ 👁 toggle: Shirt Jeans Shoes│
│ 🎨 variant  ⤢ texture       │
│ Fit 8.6/10 (82%)  Outfit 8.1│
│ [ Fit Report ] [Add to Cart]│
└─────────────────────────────┘
```

## 7. Fit Report
```
┌─────────────────────────────┐
│ ← Fit Report   Fit 8.6 (82%)│
│ Shoulder   ▉▉▉▉▉ Regular ✅ │
│ Chest      ▉▉▉▉  Regular ✅ │
│ Waist      ▉▉▉▉▉ Regular ✅ │
│ Sleeve     ▉▉▉   Good     ✅ │
│ Trousers   ▉▉▉▉  Slightly long ⚠️│
│ ─────────────────────────── │
│ "True to size; trousers may  │
│  run slightly long."         │
│ 🔊 Read aloud                │
│ [ True to size? 👍 👎 ]     │
└─────────────────────────────┘
```

## 8. Cart & Checkout Handoff
```
┌─────────────────────────────┐
│ ← FitCart (3 items)         │
│ Myntra:  Shirt   ₹1299      │
│ Ajio:    Jeans   ₹1799      │
│ Amazon:  Shoes   ₹2499      │
│ ─────────────────────────── │
│ You'll finish buying in each │
│ store.                       │
│ [ Open in Myntra ]           │
│ [ Open in Ajio  ]            │
│ [ Open in Amazon ]           │
│ (partner) [ Sync to cart ]   │
└─────────────────────────────┘
```

## 9. Privacy / Settings
```
┌─────────────────────────────┐
│ ← Privacy                   │
│ Consents:                   │
│  Processing        [ON]     │
│  Store avatar      [ON]     │
│  Improve models    [OFF]    │
│  Cross-border      [OFF]    │
│ [ Export my data ]          │
│ [ Delete body data ]        │
│ [ Delete account ]          │
└─────────────────────────────┘
```
