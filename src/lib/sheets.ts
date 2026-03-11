/**
 * sheets.ts — Fetches and parses all Google Sheets tabs into a unified data model.
 *
 * Tabs used:
 *   gid=0            Event_Data_TD  → Brand ID, Brand Name, Brand Type, Event Name, Event Count
 *   gid=1176729619   Dashboard based on Event Category   (pivot: Brand × Category)
 *   gid=814350922    Dashboard based on Event Sub-Category (pivot: Brand × SubCategory, 2-row header)
 *
 * Parsing strategy for sub-category tab (2-row header):
 *   Row 0: parent category names — merged cells appear as first cell value, rest empty → forward-fill
 *   Row 1: sub-category names
 *   Row 2+: brand data
 *
 * Naming convention for sub-categories to avoid collisions:  "Parent > SubName"
 */

import {
  BrandData,
  SheetData,
  AdoptionTier,
  EXCLUDED_CATEGORIES,
  FEATURE_PRIORITY,
  DEFAULT_TIER_CONFIG,
  TierConfig,
} from './types';

const SHEET_ID = '15LzD-Z5ZdbEBKfxdflrbRcSJN-XMMbnuujL7OyiuKcU';
const URLS = {
  rawData: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0`,
  categoryDashboard: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=1176729619`,
  subCategoryDashboard: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=814350922`,
};

// ─── CSV Parser ───────────────────────────────────────────────────────────────

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') { cell += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      row.push(cell.trim());
      cell = '';
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell.trim());
      if (row.some(c => c !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  if (row.length || cell) {
    row.push(cell.trim());
    if (row.some(c => c !== '')) rows.push(row);
  }
  return rows;
}

async function fetchCSV(url: string): Promise<string[][]> {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: { 'User-Agent': 'FeatureAdoptionDashboard/1.0' },
    // next.js fetch cache — revalidate every 30 min
    // @ts-ignore
    next: { revalidate: 1800 },
  });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const text = await res.text();
  return parseCSV(text);
}

// ─── Raw Data Parser (gid=0) ──────────────────────────────────────────────────

function parseBrandTypes(rows: string[][]): Map<string, string> {
  const map = new Map<string, string>();
  if (rows.length < 2) return map;

  // Find Brand Name and Brand Type column indices from header
  const header = rows[0].map(h => h.toLowerCase());
  const nameIdx = header.findIndex(h => h.includes('brand name'));
  const typeIdx = header.findIndex(h => h.includes('brand type'));
  if (nameIdx === -1 || typeIdx === -1) return map;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const name = row[nameIdx]?.trim();
    const type = row[typeIdx]?.trim();
    if (name && type && !map.has(name)) {
      map.set(name, type);
    }
  }
  return map;
}

// ─── Category Dashboard Parser (gid=1176729619) ───────────────────────────────

interface CategoryParsed {
  brands: Map<string, Record<string, number>>; // brandName → { category → count }
  categories: string[]; // ordered list of category column names
}

function parseCategoryDashboard(rows: string[][]): CategoryParsed {
  if (rows.length < 2) return { brands: new Map(), categories: [] };

  // Header row: [blank/0, "Brand Name", "AEO", "Analytics", ...]
  const header = rows[0];
  const brandNameCol = header.findIndex(h => h.toLowerCase() === 'brand name');
  if (brandNameCol === -1) return { brands: new Map(), categories: [] };

  const categories: string[] = [];
  const categoryIndices: number[] = [];

  for (let i = brandNameCol + 1; i < header.length; i++) {
    if (header[i]) {
      categories.push(header[i]);
      categoryIndices.push(i);
    }
  }

  const brands = new Map<string, Record<string, number>>();

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const brandName = row[brandNameCol]?.trim();
    if (!brandName || brandName.toLowerCase() === 'brand name') continue;

    const scores: Record<string, number> = {};
    for (let ci = 0; ci < categories.length; ci++) {
      const val = parseInt(row[categoryIndices[ci]] || '0', 10);
      scores[categories[ci]] = isNaN(val) ? 0 : val;
    }
    brands.set(brandName, scores);
  }

  return { brands, categories };
}

// ─── Sub-Category Dashboard Parser (gid=814350922) ───────────────────────────

interface SubCategoryParsed {
  brands: Map<string, Record<string, number>>; // brandName → { "Cat > Sub" → count }
  subCategories: string[];                      // ordered list of "Cat > Sub" keys
  subCategoryToCategory: Record<string, string>;
}

function parseSubCategoryDashboard(rows: string[][]): SubCategoryParsed {
  if (rows.length < 3) return { brands: new Map(), subCategories: [], subCategoryToCategory: {} };

  // Detect if this has a 2-row header by checking if row[1][1] === "Brand Name"
  let catRow: string[];
  let subRow: string[];
  let dataStartRow: number;

  const row0BrandNameCol = rows[0].findIndex(h => h.toLowerCase() === 'brand name');
  const row1BrandNameCol = rows[1].findIndex(h => h.toLowerCase() === 'brand name');

  if (row1BrandNameCol !== -1 && row0BrandNameCol === -1) {
    // 2-row header: row 0 = categories, row 1 = sub-categories, data starts at row 2
    catRow = rows[0];
    subRow = rows[1];
    dataStartRow = 2;
  } else if (row0BrandNameCol !== -1) {
    // Single header: treat as category dashboard (fallback)
    catRow = rows[0].map(() => '');
    subRow = rows[0];
    dataStartRow = 1;
  } else {
    return { brands: new Map(), subCategories: [], subCategoryToCategory: {} };
  }

  const brandNameCol = Math.max(row0BrandNameCol, row1BrandNameCol);

  // Forward-fill parent category names in catRow
  const filledCatRow = [...catRow];
  let lastCat = '';
  for (let i = 0; i < filledCatRow.length; i++) {
    if (filledCatRow[i] && filledCatRow[i].toLowerCase() !== 'brand name') {
      lastCat = filledCatRow[i];
    } else if (!filledCatRow[i] && i > brandNameCol) {
      filledCatRow[i] = lastCat;
    }
  }

  // Build sub-category keys and index arrays
  const subCategories: string[] = [];
  const subCategoryToCategory: Record<string, string> = {};
  const subColIndices: number[] = [];
  const subKeyUsed = new Map<string, number>(); // for deduplication

  for (let i = brandNameCol + 1; i < subRow.length; i++) {
    const sub = subRow[i]?.trim();
    const cat = filledCatRow[i]?.trim() || 'Unknown';
    if (!sub || sub === 'Brand Name') continue;

    // Create unique key: "Category > SubCategory"
    // Handle duplicates by appending a counter
    let key = `${cat} > ${sub}`;
    if (subKeyUsed.has(key)) {
      const count = subKeyUsed.get(key)! + 1;
      subKeyUsed.set(key, count);
      key = `${key} (${count})`;
    } else {
      subKeyUsed.set(key, 1);
    }

    subCategories.push(key);
    subCategoryToCategory[key] = cat;
    subColIndices.push(i);
  }

  // Parse brand data rows
  const brands = new Map<string, Record<string, number>>();

  for (let r = dataStartRow; r < rows.length; r++) {
    const row = rows[r];
    const brandName = row[brandNameCol]?.trim();
    if (!brandName || brandName.toLowerCase() === 'brand name') continue;

    const scores: Record<string, number> = {};
    for (let si = 0; si < subCategories.length; si++) {
      const val = parseInt(row[subColIndices[si]] || '0', 10);
      scores[subCategories[si]] = isNaN(val) ? 0 : val;
    }
    brands.set(brandName, scores);
  }

  return { brands, subCategories, subCategoryToCategory };
}

// ─── Adoption Scoring ─────────────────────────────────────────────────────────

function getTier(pct: number, config: TierConfig = DEFAULT_TIER_CONFIG): AdoptionTier {
  if (pct < config.low) return 'Low';
  if (pct < config.emerging) return 'Emerging';
  if (pct < config.healthy) return 'Healthy';
  return 'Power';
}

function getRecommendation(
  categoryScores: Record<string, number>,
  trackedCategories: string[]
): string {
  const notUsed = FEATURE_PRIORITY.filter(f =>
    trackedCategories.includes(f) && (categoryScores[f] || 0) === 0
  );
  if (notUsed.length === 0) return 'All key features explored!';
  return notUsed[0];
}

// ─── Main Assembler ───────────────────────────────────────────────────────────

export async function fetchSheetData(): Promise<SheetData> {
  const dataNotes: string[] = [];

  // Fetch all three CSVs in parallel
  const [rawRows, catRows, subRows] = await Promise.all([
    fetchCSV(URLS.rawData).catch(e => {
      dataNotes.push(`Raw data tab unavailable: ${e.message}`);
      return [] as string[][];
    }),
    fetchCSV(URLS.categoryDashboard),
    fetchCSV(URLS.subCategoryDashboard),
  ]);

  // Parse each sheet
  const brandTypeMap = parseBrandTypes(rawRows);
  const catParsed = parseCategoryDashboard(catRows);
  const subParsed = parseSubCategoryDashboard(subRows);

  // Determine tracked categories (exclude noisy/deprecated ones)
  const allCategories = catParsed.categories;
  const trackedCategories = allCategories.filter(c => !EXCLUDED_CATEGORIES.has(c));

  // Determine tracked sub-categories
  const allSubCategories = subParsed.subCategories;
  const trackedSubCategories = allSubCategories.filter(key => {
    const cat = subParsed.subCategoryToCategory[key] || '';
    const sub = key.split(' > ').slice(1).join(' > ');
    return !EXCLUDED_CATEGORIES.has(cat) && !EXCLUDED_CATEGORIES.has(sub);
  });

  const totalTrackedCat = trackedCategories.length;
  const totalTrackedSub = trackedSubCategories.length;

  if (totalTrackedCat === 0) dataNotes.push('No trackable categories found — check sheet structure');
  dataNotes.push(`Tracking ${totalTrackedCat} categories (excluded: Others, Pierre - Old, #N/A)`);
  dataNotes.push(`Tracking ${totalTrackedSub} sub-categories (same exclusions applied)`);
  dataNotes.push('Date range filtering requires timestamp data not present in current sheet. Currently showing all-time aggregated data.');
  dataNotes.push('CVR not available in source data. Top brands ranked by total event count.');

  // Merge all brands (union of category and sub-category brand sets)
  const allBrandNames = new Set([
    ...catParsed.brands.keys(),
    ...subParsed.brands.keys(),
  ]);

  const brandTypes = new Set<string>();
  const brands: BrandData[] = [];

  for (const name of allBrandNames) {
    const categoryScores = catParsed.brands.get(name) || {};
    const subCategoryScores = subParsed.brands.get(name) || {};
    const brandType = brandTypeMap.get(name) || 'Unknown';
    brandTypes.add(brandType);

    // Category adoption
    const usedCat = trackedCategories.filter(c => (categoryScores[c] || 0) > 0);
    const notUsedCat = trackedCategories.filter(c => (categoryScores[c] || 0) === 0);
    const adoptionScoreCat = totalTrackedCat > 0 ? usedCat.length / totalTrackedCat : 0;
    const adoptionScoreCatPct = Math.round(adoptionScoreCat * 100);
    const tierCat = getTier(adoptionScoreCatPct);

    // Sub-category adoption
    const usedSub = trackedSubCategories.filter(k => (subCategoryScores[k] || 0) > 0);
    const notUsedSub = trackedSubCategories.filter(k => (subCategoryScores[k] || 0) === 0);
    const adoptionScoreSub = totalTrackedSub > 0 ? usedSub.length / totalTrackedSub : 0;
    const adoptionScoreSubPct = Math.round(adoptionScoreSub * 100);
    const tierSub = getTier(adoptionScoreSubPct);

    // Total events
    const totalEvents =
      Object.values(categoryScores).reduce((a, b) => a + b, 0);

    brands.push({
      name,
      brandType,
      categoryScores,
      subCategoryScores,
      adoptionScoreCat,
      adoptionScoreCatPct,
      tierCat,
      featuresUsedCat: usedCat,
      featuresNotUsedCat: notUsedCat,
      adoptionScoreSub,
      adoptionScoreSubPct,
      tierSub,
      featuresUsedSub: usedSub,
      featuresNotUsedSub: notUsedSub,
      totalEvents,
      recommendedNextFeature: getRecommendation(categoryScores, trackedCategories),
    });
  }

  // Sort brands alphabetically for consistent display
  brands.sort((a, b) => a.name.localeCompare(b.name));

  const brandTypesSorted = Array.from(brandTypes).sort();
  if (brandTypesSorted.includes('Unknown')) {
    dataNotes.push('Some brands have no brand type in the raw data tab — shown as "Unknown"');
  }

  return {
    brands,
    allCategories,
    trackedCategories,
    allSubCategories,
    trackedSubCategories,
    subCategoryToCategory: subParsed.subCategoryToCategory,
    brandTypes: brandTypesSorted,
    lastFetched: new Date().toISOString(),
    dataNotes,
  };
}
