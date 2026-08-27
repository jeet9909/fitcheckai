# Diagram — Risk Heatmap

**Severity × Likelihood (top risks plotted)**
```mermaid
quadrantChart
    title Risk Heatmap (Likelihood x Severity)
    x-axis "Low likelihood" --> "High likelihood"
    y-axis "Low severity" --> "Critical severity"
    quadrant-1 "Fire drill (mitigate now)"
    quadrant-2 "Watch closely"
    quadrant-3 "Monitor"
    quadrant-4 "Contain"
    "No cart API (P1)": [0.95, 0.85]
    "Automation ToS (P2)": [0.55, 0.90]
    "Body-data/DPDP (L1)": [0.45, 0.95]
    "Credential storage (L2)": [0.20, 0.95]
    "Unit economics (B4/T4)": [0.55, 0.90]
    "Big-tech bundling (B1)": [0.50, 0.92]
    "Affiliate coverage (P3)": [0.55, 0.70]
    "Try-on quality (T1)": [0.50, 0.65]
    "Avatar over-claim (T2)": [0.45, 0.65]
    "Upload willingness (B2)": [0.50, 0.62]
    "Retention (B3)": [0.50, 0.68]
```

**Priority legend**
| Band | Meaning | Examples |
|---|---|---|
| 🔴 Critical | Mitigate before scaling | P1, P2, L1, L2, B4/T4, B1 |
| 🟠 High | Active mitigation | P3, T1, T2, B2, B3, L4 |
| 🟡 Medium | Monitor | P5, T5, O2, B5 |

**Top-5 board risks**
1. 🔴 Cart-sync not officially possible → reframe MVP (P1/P2).
2. 🔴 Body-data + credentials under DPDP (L1/L2).
3. 🔴 Unit economics (B4/T4).
4. 🔴 Big-tech bundling (B1).
5. 🟠 AI quality & honesty (T1/T2).

Detail + mitigations: `docs/risks.md`.
