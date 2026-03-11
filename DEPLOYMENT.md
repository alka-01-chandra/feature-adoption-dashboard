# Feature Adoption Dashboard — Deployment & Architecture Guide

## Quick Start (Local)

```bash
cd feature-adoption-dashboard
npm install
npm run dev
# Open http://localhost:3000
```

---

## Folder Structure

```
src/
├── app/
│   ├── page.tsx                  # Root page (server component)
│   ├── layout.tsx                # HTML shell
│   ├── globals.css               # Tailwind base
│   └── api/sheets/route.ts       # Data API — fetches & caches Google Sheets data
├── components/
│   ├── Dashboard.tsx             # Root client component; holds all filter state
│   ├── Filters.tsx               # Brand type filter + analysis mode toggle
│   ├── KPISummary.tsx            # 8 KPI cards + tier legend
│   ├── FeatureChart.tsx          # Horizontal bar chart + most/least used panels
│   ├── BrandTable.tsx            # Sortable/searchable/paginated brand table
│   ├── Top10Analysis.tsx         # Top 10 by volume + feature heatmap
│   └── SegmentationChart.tsx     # Radar + stacked bar by brand type
└── lib/
    ├── types.ts                  # All TypeScript types
    ├── sheets.ts                 # Google Sheets CSV fetching + parsing
    └── dataProcessing.ts         # Analytics functions (pure, side-effect free)
```

---

## Data Model & Sheet Mapping

| Sheet Tab | GID | Role |
|---|---|---|
| Event_Data_TD | 0 | Raw events → Brand Type extraction |
| Dashboard based on Event Category | 1176729619 | Pivot: Brand × Category (15 cols) |
| Dashboard based on Event Sub-Category | 814350922 | Pivot: Brand × Sub-Category (2-row header) |

### Category Tab Columns
`AEO, Analytics, Brand Settings, Cmd+K, Experiments, Forever Link, Funnel, Homepage, Others, PDP, Pierre, Pierre-Old, Search, SEO`

### Sub-Category Tab Structure
- Row 0: parent category names (merged cells — forward-filled in parser)
- Row 1: sub-category names
- Row 2+: brand data
- Output key format: `"Parent Category > Sub Category"`

---

## Adoption Scoring Logic

```
adoption_score = features_with_count_gt_0 / total_tracked_features
adoption_pct   = adoption_score * 100
```

**Excluded from scoring** (documented in `types.ts`):
- `Others` — too generic to be a meaningful signal
- `Pierre - Old` — deprecated feature
- `#N/A` — data artifact from pivot table

**Tracked categories** (12): AEO, Analytics, Brand Settings, Cmd+K, Experiments, Forever Link, Funnel, Homepage, PDP, Pierre, Search, SEO

**A brand "uses" a feature** if its event count for that feature is > 0.

---

## Tiering Logic

| Tier | Adoption % | Description |
|---|---|---|
| Tier 1 — Low | < 25% | Using < 3/12 features. Prioritize for outreach. |
| Tier 2 — Emerging | 25–49% | 3–5 features. Growing users. |
| Tier 3 — Healthy | 50–74% | 6–8 features. Good adoption. |
| Tier 4 — Power | ≥ 75% | 9+ features. Deep platform users. |

Thresholds are configurable in `src/lib/types.ts` → `DEFAULT_TIER_CONFIG`.

---

## Low Adoption Detection Logic

A brand is flagged if:
1. **High urgency**: adoption < 25% (< 3 features used, any activity level)
2. **Medium urgency**: adoption 25–49% AND missing 3+ high-value features
3. **Medium urgency**: adoption ≥ 50% AND missing 4+ high-value features (deep user of narrow features)

**High-value features checked**: Experiments, Pierre, Analytics, Search, SEO

Inactive brands (zero events) are skipped — they need a different intervention.

---

## Top 10 Brand Analysis

- Ranked by **total event count** (sum across all categories)
- CVR is **not available** in the source sheet — marked as "Pending" in UI
- To add CVR: provide a CSV/sheet with columns `Brand Name, CVR%` and join in `sheets.ts`
- "Power User Bundle" = features used by ≥ 80% of top brands
- "Emerging Best Practices" = features used by 50–79% of top brands

---

## Feature Recommendation Logic

For each brand, recommend the highest-priority feature they haven't used yet:

Priority order (defined in `FEATURE_PRIORITY` in `types.ts`):
1. Experiments
2. Pierre
3. Analytics
4. Search
5. SEO
6. Forever Link
7. AEO
8. Funnel
9. Cmd + K
10. Homepage
11. PDP
12. Brand Settings

---

## Date Range Filtering

**Current status**: Not available. The Google Sheet tabs contain all-time aggregated event counts with no timestamp column.

**To enable date filtering**:
1. Export the raw `Event_Data_TD` tab with a `Date` or `Week` column
2. Update `fetchSheetData()` in `sheets.ts` to accept a date range parameter
3. Filter rows before pivoting
4. Weekly Monday refreshes mean granularity is at most weekly

---

## Caching Architecture

- API route (`/api/sheets`) uses in-memory cache with 30-minute TTL
- Manual refresh available via `?refresh=true` query parameter (triggered by "Refresh Data" button)
- Cache survives between requests on the same Railway instance
- On Railway with multiple replicas, each replica has its own cache — consider Redis for shared caching at scale

---

## Deployment on Railway

### Option A: Dockerfile (recommended)

1. Push code to GitHub
2. Create a new Railway project → "Deploy from GitHub repo"
3. Railway auto-detects the Dockerfile
4. Set environment variables (none required for public sheet)
5. Deploy → Railway provides a public URL

### Option B: Nixpacks (zero config)

1. Delete the Dockerfile
2. Railway will auto-detect Next.js and build/deploy automatically
3. Add `"start": "next start -p ${PORT:-3000}"` in package.json (already done)

### Environment Variables on Railway

No secrets needed for the public Google Sheet. If you add authentication later:
```
NODE_ENV=production
PORT=3000  (set automatically by Railway)
```

### Custom Domain

In Railway dashboard → Settings → Networking → Add custom domain.

---

## Live Refresh Schedule

The dashboard auto-refreshes in the browser every 30 minutes. For server-side scheduled refresh:

Add a Railway Cron Job:
```
# Every Monday at 9am UTC (after sheet update)
0 9 * * 1  curl -X GET https://your-app.railway.app/api/sheets?refresh=true
```

Or use Railway's built-in cron via a separate service that pings the refresh endpoint.

---

## Suggested Future Enhancements

1. **Date range filtering** — requires timestamp column in raw data tab
2. **CVR integration** — add a sheet or API providing `Brand Name → CVR%`
3. **Email/Slack alerts** — cron job that checks low-adoption brands and triggers workflows
4. **Outreach tracking** — a separate sheet tracking which brands have been contacted
5. **Trend view** — weekly snapshots to show adoption over time (requires historical data)
6. **Automated outreach** — connect to a CRM or email platform via webhook when a brand reaches Tier 1
7. **Feature dependency graph** — show which features are commonly adopted together
8. **Export to Google Sheets** — write filtered results back to a separate tab

---

## Assumptions & Known Gaps

| # | Assumption/Gap | Impact |
|---|---|---|
| 1 | "Others" excluded from adoption scoring | Scores are conservative — brands may use more than shown |
| 2 | "Pierre - Old" excluded as deprecated | Brands using only old Pierre may appear lower than actual |
| 3 | No date column in source → no date filtering | All metrics are all-time aggregates |
| 4 | CVR not in source data | Top 10 ranking is by event volume, not revenue impact |
| 5 | Brand type comes from raw data tab; some brands may be "Unknown" | Segment charts may have an "Unknown" bucket |
| 6 | Sub-category → category mapping inferred from 2-row CSV header | May mismap if sheet header structure changes |
| 7 | In-memory cache — lost on server restart | First request after deploy hits Google Sheets directly |
| 8 | 157 brands at time of analysis | New brands auto-appear on next refresh — no hardcoding |
