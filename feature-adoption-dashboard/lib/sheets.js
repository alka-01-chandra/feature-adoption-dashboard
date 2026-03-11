/**
 * Google Sheets Data Fetcher
 * 
 * Fetches data from the "User Actions - SMB" spreadsheet.
 * Supports two tabs:
 *   1. "Dashboard based on Event Category" (category-level view)
 *   2. "Dashboard based on Event Sub-Category" (sub-category-level view)
 * 
 * Data retrieval strategy:
 *   - Primary: Google Sheets API v4 with service account (private sheets)
 *   - Fallback: Public CSV export (requires sheet to be published)
 *   - Cache layer: In-memory cache with configurable TTL
 */

const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '15LzD-Z5ZdbEBKfxdflrbRcSJN-XMMbnuujL7OyiuKcU';
const CATEGORY_GID = process.env.CATEGORY_TAB_GID || '1176729619';
const SUBCATEGORY_GID = process.env.SUBCATEGORY_TAB_GID || '';
const CACHE_TTL = parseInt(process.env.CACHE_TTL || '300', 10) * 1000;

// In-memory cache
let cache = { category: null, subcategory: null, lastFetch: 0 };

/**
 * Parse CSV text into array of objects using first row as headers.
 * Handles quoted fields, commas inside quotes, and newlines.
 */
function parseCSV(text) {
  if (!text || !text.trim()) return [];
  
  const lines = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === '\n' && !inQuotes) {
      lines.push(current);
      current = '';
    } else if (ch === '\r' && !inQuotes) {
      // skip CR
    } else {
      current += ch;
    }
  }
  if (current.trim()) lines.push(current);
  
  if (lines.length < 2) return [];
  
  const splitRow = (line) => {
    const fields = [];
    let field = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQ && line[i + 1] === '"') { field += '"'; i++; }
        else inQ = !inQ;
      } else if (c === ',' && !inQ) {
        fields.push(field.trim());
        field = '';
      } else {
        field += c;
      }
    }
    fields.push(field.trim());
    return fields;
  };
  
  const headers = splitRow(lines[0]).map(h => h.replace(/^\uFEFF/, '').trim());
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = splitRow(lines[i]);
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = values[idx] || '';
    });
    rows.push(obj);
  }
  
  return rows;
}

/**
 * Normalize column names to a standard internal schema.
 * This handles variations in column naming across sheet versions.
 */
function normalizeColumns(rows) {
  if (!rows.length) return rows;
  
  const sample = rows[0];
  const keys = Object.keys(sample);
  
  // Build a mapping from original keys to normalized keys
  const mapping = {};
  const lower = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  const patterns = {
    brandName: ['brandname', 'brand', 'brandtitle', 'account', 'accountname', 'organization', 'orgname'],
    brandType: ['brandtype', 'type', 'accounttype', 'segment', 'tier', 'brandsegment', 'brandstype'],
    eventCategory: ['eventcategory', 'category', 'featurecategory', 'modulecategory'],
    eventSubCategory: ['eventsubcategory', 'subcategory', 'featuresubcategory', 'subfeature', 'eventsubcategory'],
    eventCount: ['eventcount', 'count', 'events', 'totalevents', 'occurrences', 'total'],
    sessions: ['sessions', 'totalsessions', 'sessioncount', 'visits'],
    users: ['users', 'uniqueusers', 'usercount', 'activeusers'],
    date: ['date', 'week', 'weekof', 'period', 'daterange', 'weekstart', 'reportdate'],
    cvr: ['cvr', 'conversionrate', 'convrate', 'cr'],
    revenue: ['revenue', 'totalrevenue', 'rev'],
  };
  
  for (const key of keys) {
    const normalized = lower(key);
    let matched = false;
    for (const [standard, variants] of Object.entries(patterns)) {
      if (variants.some(v => normalized.includes(v) || v.includes(normalized))) {
        mapping[key] = standard;
        matched = true;
        break;
      }
    }
    if (!matched) {
      mapping[key] = key; // Keep original if no match
    }
  }
  
  return rows.map(row => {
    const normalized = {};
    for (const [origKey, newKey] of Object.entries(mapping)) {
      normalized[newKey] = row[origKey];
    }
    // Also keep original keys for any unmapped columns
    for (const key of keys) {
      if (!mapping[key]) normalized[key] = row[key];
    }
    return normalized;
  });
}

/**
 * Fetch a sheet tab as CSV via the public export URL.
 */
async function fetchTabCSV(gid) {
  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=${gid}`;
  const res = await fetch(url, {
    headers: { 'Accept': 'text/csv' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status} ${res.statusText}`);
  return await res.text();
}

/**
 * Fetch sheet tab via Google Sheets API v4 (requires API key or service account).
 */
async function fetchTabAPI(sheetName) {
  const apiKey = process.env.GOOGLE_API_KEY;
  const serviceKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  
  if (apiKey) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(sheetName)}?key=${apiKey}&valueRenderOption=FORMATTED_VALUE`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Sheets API error: ${res.status}`);
    const data = await res.json();
    return valuesToObjects(data.values);
  }
  
  if (serviceKey) {
    // Use googleapis library for service account auth
    const { google } = require('googleapis');
    const creds = typeof serviceKey === 'string' ? JSON.parse(serviceKey) : serviceKey;
    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: sheetName,
      valueRenderOption: 'FORMATTED_VALUE',
    });
    return valuesToObjects(result.data.values);
  }
  
  throw new Error('No API key or service account configured');
}

/**
 * Convert Sheets API values array (array of arrays) to objects.
 */
function valuesToObjects(values) {
  if (!values || values.length < 2) return [];
  const headers = values[0];
  return values.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i] || ''; });
    return obj;
  });
}

/**
 * Discover sheet tab names and GIDs.
 * Falls back to known GIDs from environment if API discovery fails.
 */
async function discoverTabs() {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (apiKey) {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?key=${apiKey}&fields=sheets.properties`;
      const res = await fetch(url);
      const data = await res.json();
      return data.sheets?.map(s => ({
        title: s.properties.title,
        gid: String(s.properties.sheetId),
      })) || [];
    } catch (e) {
      console.warn('Tab discovery failed:', e.message);
    }
  }
  
  // Fallback: use known GIDs
  const tabs = [];
  if (CATEGORY_GID) tabs.push({ title: 'Dashboard based on Event Category', gid: CATEGORY_GID });
  if (SUBCATEGORY_GID) tabs.push({ title: 'Dashboard based on Event Sub-Category', gid: SUBCATEGORY_GID });
  return tabs;
}

/**
 * Main data fetch function. Returns both tabs with caching.
 */
async function fetchSheetData(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cache.category && (now - cache.lastFetch) < CACHE_TTL) {
    return { category: cache.category, subcategory: cache.subcategory, fromCache: true, lastFetch: cache.lastFetch };
  }
  
  let categoryData = [];
  let subcategoryData = [];
  
  // Try API first, fall back to CSV
  const tabs = await discoverTabs();
  
  for (const tab of tabs) {
    try {
      let rows;
      try {
        rows = await fetchTabAPI(tab.title);
      } catch {
        // Fallback to CSV
        const csv = await fetchTabCSV(tab.gid);
        rows = parseCSV(csv);
      }
      
      rows = normalizeColumns(rows);
      
      const titleLower = tab.title.toLowerCase();
      if (titleLower.includes('sub-category') || titleLower.includes('subcategory')) {
        subcategoryData = rows;
      } else if (titleLower.includes('category')) {
        categoryData = rows;
      }
    } catch (err) {
      console.error(`Failed to fetch tab "${tab.title}":`, err.message);
    }
  }
  
  // If we only got one tab via known GID, try the other
  if (categoryData.length && !subcategoryData.length && SUBCATEGORY_GID) {
    try {
      const csv = await fetchTabCSV(SUBCATEGORY_GID);
      subcategoryData = normalizeColumns(parseCSV(csv));
    } catch (err) {
      console.warn('Subcategory tab fetch failed:', err.message);
    }
  }
  
  // If subcategory GID is unknown, try common GIDs (0, 1, 2...)
  if (categoryData.length && !subcategoryData.length && !SUBCATEGORY_GID) {
    for (const tryGid of ['0', '1', '2']) {
      if (tryGid === CATEGORY_GID) continue;
      try {
        const csv = await fetchTabCSV(tryGid);
        const rows = normalizeColumns(parseCSV(csv));
        if (rows.length && rows[0].eventSubCategory) {
          subcategoryData = rows;
          break;
        }
      } catch { /* skip */ }
    }
  }
  
  cache = { category: categoryData, subcategory: subcategoryData, lastFetch: now };
  
  return { category: categoryData, subcategory: subcategoryData, fromCache: false, lastFetch: now };
}

/**
 * Get metadata about the sheet structure.
 */
function getSchemaInfo(data) {
  if (!data.length) return { columns: [], brandCount: 0, featureCount: 0, brandTypes: [], dateRange: null };
  
  const columns = Object.keys(data[0]);
  const brands = [...new Set(data.map(r => r.brandName).filter(Boolean))];
  const features = [...new Set(data.map(r => r.eventCategory || r.eventSubCategory).filter(Boolean))];
  const brandTypes = [...new Set(data.map(r => r.brandType).filter(Boolean))];
  
  const dates = data.map(r => r.date).filter(Boolean).map(d => new Date(d)).filter(d => !isNaN(d));
  const dateRange = dates.length ? {
    min: new Date(Math.min(...dates)).toISOString().split('T')[0],
    max: new Date(Math.max(...dates)).toISOString().split('T')[0],
  } : null;
  
  return { columns, brandCount: brands.length, featureCount: features.length, brandTypes, dateRange, brands, features };
}

module.exports = { fetchSheetData, getSchemaInfo, parseCSV, normalizeColumns };
