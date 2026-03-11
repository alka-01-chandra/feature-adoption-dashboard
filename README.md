# FERMÀT Feature Adoption Dashboard

A dynamic microsite for analyzing platform feature adoption across brands, identifying underutilized capabilities, and enabling proactive educational outreach.

**Source Sheet:** [User Actions – SMB](https://docs.google.com/spreadsheets/d/15LzD-Z5ZdbEBKfxdflrbRcSJN-XMMbnuujL7OyiuKcU/edit?gid=1176729619)

---

## Architecture

```
feature-adoption-dashboard/
├── app/
│   ├── api/data/route.js    ← API endpoint (fetches + analyzes sheet data)
│   ├── layout.js            ← Root layout
│   ├── page.js              ← Entry page
│   └── globals.css          ← Tailwind + custom styles
├── components/
│   └── Dashboard.jsx        ← Full dashboard UI (client component)
├── lib/
│   ├── sheets.js            ← Google Sheets data fetcher + CSV parser
│   └── analytics.js         ← Adoption scoring, tiering, segmentation
├── Dockerfile               ← Railway/Docker deployment
├── railway.toml             ← Railway config
├── .env.example             ← Environment variables template
└── README.md
```

---

## Data Model / Mapping

### Source Tabs → Dashboard Views

| Sheet Tab | Dashboard Mode | Purpose |
|---|---|---|
| "Dashboard based on Event Category" | `category` | High-level feature groupings |
| "Dashboard based on Event Sub-Category" | `subcategory` | Granular feature breakdown within categories |

### Column Normalization

The data layer auto-discovers column names and maps them to a standard schema:

| Internal Key | Matches (case-insensitive) | Description |
|---|---|---|
| `brandName` | brand, brand name, account, org name | The brand/organization identifier |
| `brandType` | brand type, type, segment, tier | SMB, Enterprise, Mid-Market, LMM, GM, etc. |
| `eventCategory` | event category, category, feature category | Feature group name |
| `eventSubCategory` | event sub-category, subcategory | Specific feature within a category |
| `eventCount` | event count, count, events, total | Number of events/occurrences |
| `sessions` | sessions, total sessions | Session count if available |
| `date` | date, week, week of, period | Date or time period of the data |
| `cvr` | cvr, conversion rate | Conversion rate (if present) |
| `revenue` | revenue, total revenue | Revenue (if present) |

**All brands in the sheet are included** — there is no hardcoded brand limit.

---

## Feature Adoption Scoring Logic

### Adoption Score

```
adoption_score = (distinct features used by brand) / (total tracked features) × 100
```

- **"Feature used"** = brand has eventCount > 0 for that feature
- **"Total tracked features"** = dynamically computed based on selected mode (category vs. sub-category)
- No events are excluded by default (the sheet is assumed pre-curated). To exclude system/noise events, add them to `EXCLUDED_EVENTS` in `lib/analytics.js`

### Adoption Tiers

| Tier | Score Range | Label | Description |
|---|---|---|---|
| Tier 1 | 0–25% | Low Adoption | Using <25% of available features |
| Tier 2 | 25–50% | Emerging | Using 25-50% of features |
| Tier 3 | 50–75% | Healthy | Using 50-75% of features |
| Tier 4 | 75–100% | Power User | Using >75% of features |

**Thresholds are configurable** in `lib/analytics.js` → `DEFAULT_TIER_CONFIG`.

### Low-Adoption Definition

A brand is flagged as "low adoption" when:
1. Adoption score < 25% (breadth criterion)
2. Usage pattern classification distinguishes between:
   - **inactive** — zero features used
   - **shallow-narrow** — ≤2 features, low avg events per feature
   - **deep-narrow** — ≤2 features, but high avg events (>50) per feature
   - **exploring** — 3+ features but <25% adoption
   
This means a brand deeply using 1-2 modules still gets flagged for breadth, but is labeled differently ("deep-narrow") to guide outreach differently.

### High-Value Features

Certain features are flagged as "high value" because they indicate deeper platform engagement:
- A/B Experiments
- Session Recordings / Replay
- Peer Comparisons
- Heatmaps / Scroll Depth
- AI Search (AIS)
- Subscription features
- Forever Links
- Bundles / Product Groups

These are highlighted in the UI and prioritized in "recommended next feature" suggestions.

### Recommended Feature Logic

For each brand, the recommended next feature is:
1. First priority: unused **high-value** features, ranked by how popular they are across all brands
2. Second priority: the most popular unused feature overall

---

## Top 10 Brand Analysis

### Ranking Method

```
composite_score = sessions × (adoption_score + 0.1)
```

Brands are ranked by this composite score, which balances activity volume with feature breadth.

### CVR Status

**CVR (Conversion Rate) is NOT directly available in the source sheet.** The dashboard:
- Displays CVR if a `cvr` column exists in the data
- Otherwise marks it as "N/A — requires GA4/Looker integration"
- Does NOT fabricate or estimate CVR values

To add CVR data, either:
1. Add a CVR column to the Google Sheet
2. Build a secondary data connector to GA4/Looker

### Power User Feature Bundle

Identifies features used by 60%+ of the top 10 brands, surfacing repeat patterns as potential "best practices" bundles worth promoting to lower-tier brands.

---

## Deployment to Railway

### Prerequisites
- A [Railway](https://railway.app) account
- The Google Sheet must be accessible (see "Connecting Google Sheets" below)

### Steps

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial feature adoption dashboard"
   git remote add origin <your-repo-url>
   git push -u origin main
   ```

2. **Create Railway Project**
   - Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub Repo
   - Select your repository

3. **Set Environment Variables**
   In Railway → Variables, add:
   ```
   SPREADSHEET_ID=15LzD-Z5ZdbEBKfxdflrbRcSJN-XMMbnuujL7OyiuKcU
   CATEGORY_TAB_GID=1176729619
   SUBCATEGORY_TAB_GID=<gid from the sub-category tab URL>
   ```
   
   Then **one** of:
   - `GOOGLE_API_KEY=AIza...` (for published sheets)
   - `GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}` (for private sheets)

4. **Deploy**
   Railway auto-detects the Dockerfile and deploys. The app will be available at your Railway-assigned URL.

### Connecting Google Sheets for Live Refresh

**Option A: Public Sheet (simplest)**
1. In Google Sheets → File → Share → Publish to web → Publish entire document as CSV
2. Set `SPREADSHEET_ID` in Railway env vars
3. The dashboard fetches fresh data via CSV export (no API key needed)

**Option B: Google API Key**
1. Go to [Google Cloud Console](https://console.cloud.google.com) → Create/select project
2. Enable "Google Sheets API"
3. Create an API key (restrict to Sheets API)
4. Set `GOOGLE_API_KEY` in Railway env vars

**Option C: Service Account (recommended for production)**
1. In Google Cloud Console → IAM → Service Accounts → Create
2. Download JSON key file
3. In Google Sheets, share the sheet with the service account email
4. Paste the JSON key as a single line in `GOOGLE_SERVICE_ACCOUNT_KEY` env var

### Refresh Behavior
- **In-memory cache**: 5 minutes (configurable via `CACHE_TTL`)
- **Manual refresh**: Click "Refresh" button in the dashboard header
- **Scheduled refresh**: The sheet updates weekly on Mondays. The dashboard auto-fetches fresh data after cache expiry.
- **Webhook refresh**: Hit `GET /api/data?refresh=true` to force a fresh fetch

---

## Assumptions & Exclusions

| Item | Assumption | Impact |
|---|---|---|
| Brand count | Dynamic — all brands in the sheet are included | No hardcoded limit |
| Feature count | Dynamic — all distinct event categories/sub-categories | Adapts to sheet changes |
| CVR data | Not available in source sheet | Marked as "N/A" with note |
| Sessions | Used from `sessions` column if present; otherwise `eventCount` as proxy | May differ from actual session counts |
| Date column | Used for date-range filtering if present | If absent, all data = "All Time" |
| System events | Not excluded by default | Add to `EXCLUDED_EVENTS` if needed |
| Sub-category tab GID | Must be discovered or configured | Falls back to trying GIDs 0, 1, 2 |
| Revenue | Displayed if present, omitted if not | Not used in adoption scoring |

---

## Suggested Future Enhancements

### Phase 2: Automation
1. **Weekly email digest** — Auto-send low-adoption brand alerts to CSMs each Monday
2. **Slack notifications** — Post to #brand-support when a brand's adoption score drops
3. **Notion integration** — Auto-update Brand Intelligence pages with latest adoption data

### Phase 3: Advanced Analytics
1. **CVR integration** — Pull GA4 data to correlate feature adoption with conversion rates
2. **Trend analysis** — Track adoption score changes week-over-week with sparklines
3. **Cohort analysis** — Compare brands by onboarding month to identify early-adoption patterns
4. **Churn risk model** — Combine low adoption + declining sessions as churn predictor

### Phase 4: Outreach Automation
1. **Auto-generate outreach emails** — For each low-adoption brand, draft a personalized email recommending their top 3 missing features
2. **In-app nudges** — Feed recommendations into the FERMÀT platform for in-product messaging
3. **Feature tutorial links** — Map each feature to its Help Center article for one-click education

---

## Local Development

```bash
# Install dependencies
npm install

# Copy env template
cp .env.example .env.local
# Edit .env.local with your credentials

# Run dev server
npm run dev

# Open http://localhost:3000
```

---

## Tech Stack

- **Next.js 14** (App Router) — React framework with API routes
- **Tailwind CSS** — Utility-first styling
- **Recharts** — Charts and visualizations
- **Google Sheets API** / CSV export — Live data source
- **Docker** — Container deployment
- **Railway** — Hosting platform
