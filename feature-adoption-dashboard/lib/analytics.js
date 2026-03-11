/**
 * Feature Adoption Analytics Engine
 * 
 * Computes adoption scores, tiers, feature usage stats, brand segmentation,
 * and top-brand analysis from raw sheet data.
 * 
 * ASSUMPTIONS & EXCLUSIONS:
 * 1. A "feature used" means eventCount > 0 for that brand-feature pair
 * 2. "Active brand" = brand with at least 1 event in the selected period
 * 3. System/noise events: We do NOT exclude any events by default. 
 *    The sheet is assumed to be pre-curated. If filtering is needed,
 *    configure EXCLUDED_EVENTS below.
 * 4. CVR: Not directly available in the sheet. We mark it as "N/A" and 
 *    note that it requires an external data source (e.g., GA4/Looker).
 * 5. Sessions: If a "sessions" column exists, we use it. Otherwise we 
 *    use total event count as an activity proxy.
 * 6. Date filtering: If dates exist in the data, we filter by them.
 *    If no date column, all data is treated as the current period.
 */

// Events to exclude from adoption calculations (add system events here)
const EXCLUDED_EVENTS = [];

// Tier thresholds (configurable)
const DEFAULT_TIER_CONFIG = {
  tier1: { max: 0.25, label: 'Low Adoption', color: '#ef4444', description: 'Using <25% of available features' },
  tier2: { max: 0.50, label: 'Emerging', color: '#f59e0b', description: 'Using 25-50% of features' },
  tier3: { max: 0.75, label: 'Healthy', color: '#22c55e', description: 'Using 50-75% of features' },
  tier4: { max: 1.01, label: 'Power User', color: '#6366f1', description: 'Using >75% of features' },
};

// High-value features that signal deeper platform engagement
const HIGH_VALUE_FEATURES = [
  'a/b experiment', 'ab test', 'experiment',
  'session recording', 'session replay',
  'peer', 'peer comparison',
  'heatmap', 'scroll depth', 'click map',
  'ai', 'ai search', 'ais',
  'subscription', 'forever link',
  'bundle', 'product group',
];

/**
 * Parse a numeric value from a string, handling commas, $, %, etc.
 */
function parseNum(val) {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return val;
  const cleaned = String(val).replace(/[$,%\s]/g, '').replace(/,/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Filter rows by date range.
 */
function filterByDateRange(rows, startDate, endDate) {
  if (!startDate && !endDate) return rows;
  
  return rows.filter(row => {
    if (!row.date) return true; // Include rows without dates
    const d = new Date(row.date);
    if (isNaN(d)) return true;
    if (startDate && d < new Date(startDate)) return false;
    if (endDate && d > new Date(endDate)) return false;
    return true;
  });
}

/**
 * Filter rows by brand type.
 */
function filterByBrandType(rows, brandType) {
  if (!brandType || brandType === 'All') return rows;
  return rows.filter(row => row.brandType === brandType);
}

/**
 * Get the feature column name based on analysis mode.
 */
function getFeatureKey(mode) {
  return mode === 'subcategory' ? 'eventSubCategory' : 'eventCategory';
}

/**
 * Core analysis: compute all dashboard metrics from filtered data.
 */
function analyzeData(rows, mode = 'category', tierConfig = DEFAULT_TIER_CONFIG) {
  const featureKey = getFeatureKey(mode);
  
  // Determine all unique features (excluding noise)
  const allFeatures = [...new Set(
    rows.map(r => r[featureKey]).filter(f => f && !EXCLUDED_EVENTS.includes(f.toLowerCase()))
  )].sort();
  
  // Determine all brands
  const allBrands = [...new Set(rows.map(r => r.brandName).filter(Boolean))];
  const allBrandTypes = [...new Set(rows.map(r => r.brandType).filter(Boolean))].sort();
  
  // Build brand → feature → metrics map
  const brandFeatureMap = {};
  const brandMeta = {};
  
  for (const row of rows) {
    const brand = row.brandName;
    const feature = row[featureKey];
    if (!brand || !feature) continue;
    if (EXCLUDED_EVENTS.includes(feature.toLowerCase())) continue;
    
    if (!brandFeatureMap[brand]) brandFeatureMap[brand] = {};
    if (!brandFeatureMap[brand][feature]) brandFeatureMap[brand][feature] = 0;
    
    const count = parseNum(row.eventCount || row.sessions || row.users || 1);
    brandFeatureMap[brand][feature] += count;
    
    if (!brandMeta[brand]) brandMeta[brand] = { brandType: '', totalEvents: 0, sessions: 0, cvr: null, revenue: 0 };
    brandMeta[brand].brandType = row.brandType || brandMeta[brand].brandType;
    brandMeta[brand].totalEvents += count;
    if (row.sessions) brandMeta[brand].sessions += parseNum(row.sessions);
    if (row.cvr && !brandMeta[brand].cvr) brandMeta[brand].cvr = row.cvr;
    if (row.revenue) brandMeta[brand].revenue += parseNum(row.revenue);
  }
  
  const totalFeatures = allFeatures.length;
  
  // Compute per-brand adoption metrics
  const brandAnalysis = allBrands.map(brand => {
    const featureMap = brandFeatureMap[brand] || {};
    const featuresUsed = Object.keys(featureMap).filter(f => featureMap[f] > 0);
    const featuresNotUsed = allFeatures.filter(f => !featuresUsed.includes(f));
    const adoptionScore = totalFeatures > 0 ? featuresUsed.length / totalFeatures : 0;
    
    // Determine tier
    let tier = tierConfig.tier1;
    if (adoptionScore > tierConfig.tier3.max) tier = tierConfig.tier4;
    else if (adoptionScore > tierConfig.tier2.max) tier = tierConfig.tier3;
    else if (adoptionScore > tierConfig.tier1.max) tier = tierConfig.tier2;
    
    // Determine usage depth
    const totalActivity = Object.values(featureMap).reduce((a, b) => a + b, 0);
    const avgPerFeature = featuresUsed.length > 0 ? totalActivity / featuresUsed.length : 0;
    
    // Usage pattern classification
    let usagePattern = 'inactive';
    if (featuresUsed.length === 0) usagePattern = 'inactive';
    else if (featuresUsed.length <= 2 && avgPerFeature > 50) usagePattern = 'deep-narrow';
    else if (featuresUsed.length <= 2) usagePattern = 'shallow-narrow';
    else if (adoptionScore < 0.25) usagePattern = 'exploring';
    else if (adoptionScore < 0.5) usagePattern = 'emerging';
    else if (adoptionScore < 0.75) usagePattern = 'established';
    else usagePattern = 'power-user';
    
    // Check high-value feature usage
    const highValueUsed = featuresUsed.filter(f => 
      HIGH_VALUE_FEATURES.some(hv => f.toLowerCase().includes(hv))
    );
    const highValueMissing = allFeatures.filter(f => 
      HIGH_VALUE_FEATURES.some(hv => f.toLowerCase().includes(hv)) && !featuresUsed.includes(f)
    );
    
    // Recommend next feature
    const recommended = getRecommendedFeature(featuresNotUsed, featureUsageRanking(brandFeatureMap, allFeatures));
    
    const meta = brandMeta[brand] || {};
    
    return {
      brand,
      brandType: meta.brandType || 'Unknown',
      featuresUsed,
      featuresNotUsed,
      featureCount: featuresUsed.length,
      totalFeatures,
      adoptionScore: Math.round(adoptionScore * 100),
      adoptionScoreRaw: adoptionScore,
      tier: tier.label,
      tierColor: tier.color,
      totalActivity,
      sessions: meta.sessions || meta.totalEvents || totalActivity,
      cvr: meta.cvr || null,
      revenue: meta.revenue || 0,
      usagePattern,
      highValueUsed,
      highValueMissing,
      recommendedFeature: recommended,
      avgPerFeature: Math.round(avgPerFeature),
      featureMap,
    };
  });
  
  // Feature-level analysis
  const featureStats = allFeatures.map(feature => {
    const brandsUsing = allBrands.filter(b => (brandFeatureMap[b]?.[feature] || 0) > 0);
    const totalUsage = allBrands.reduce((sum, b) => sum + (brandFeatureMap[b]?.[feature] || 0), 0);
    
    return {
      feature,
      brandsUsing: brandsUsing.length,
      brandPercentage: allBrands.length > 0 ? Math.round((brandsUsing.length / allBrands.length) * 100) : 0,
      totalUsage,
      avgUsage: brandsUsing.length > 0 ? Math.round(totalUsage / brandsUsing.length) : 0,
      isHighValue: HIGH_VALUE_FEATURES.some(hv => feature.toLowerCase().includes(hv)),
    };
  }).sort((a, b) => b.brandsUsing - a.brandsUsing);
  
  // KPI Summary
  const activeBrands = brandAnalysis.filter(b => b.featureCount > 0);
  const avgAdoption = activeBrands.length > 0
    ? Math.round(activeBrands.reduce((s, b) => s + b.adoptionScore, 0) / activeBrands.length)
    : 0;
  const lowAdoptionBrands = brandAnalysis.filter(b => b.adoptionScore < 25);
  const highAdoptionBrands = brandAnalysis.filter(b => b.adoptionScore >= 75);
  
  const kpis = {
    totalBrands: allBrands.length,
    activeBrands: activeBrands.length,
    totalFeatures,
    avgAdoptionScore: avgAdoption,
    lowAdoptionCount: lowAdoptionBrands.length,
    highAdoptionCount: highAdoptionBrands.length,
  };
  
  // Top 10 brands (by sessions/activity, then adoption)
  const top10 = [...brandAnalysis]
    .sort((a, b) => {
      const scoreA = (a.sessions || 0) * (a.adoptionScoreRaw + 0.1);
      const scoreB = (b.sessions || 0) * (b.adoptionScoreRaw + 0.1);
      return scoreB - scoreA;
    })
    .slice(0, 10);
  
  // Top 10 common features (features used by majority of top 10)
  const top10Features = {};
  top10.forEach(b => {
    b.featuresUsed.forEach(f => {
      top10Features[f] = (top10Features[f] || 0) + 1;
    });
  });
  const commonTop10Features = Object.entries(top10Features)
    .filter(([, count]) => count >= Math.ceil(top10.length * 0.6))
    .sort((a, b) => b[1] - a[1])
    .map(([f, count]) => ({ feature: f, count, percentage: Math.round((count / top10.length) * 100) }));
  
  // Segmentation by brand type
  const segmentation = {};
  for (const bt of allBrandTypes) {
    const btBrands = brandAnalysis.filter(b => b.brandType === bt);
    const btActive = btBrands.filter(b => b.featureCount > 0);
    segmentation[bt] = {
      brandCount: btBrands.length,
      activeBrands: btActive.length,
      avgAdoption: btActive.length > 0
        ? Math.round(btActive.reduce((s, b) => s + b.adoptionScore, 0) / btActive.length)
        : 0,
      avgFeatures: btActive.length > 0
        ? Math.round(btActive.reduce((s, b) => s + b.featureCount, 0) / btActive.length * 10) / 10
        : 0,
      topFeatures: getTopFeaturesForSegment(btBrands, allFeatures, brandFeatureMap),
      underutilized: getUnderutilizedFeatures(btBrands, allFeatures, brandFeatureMap),
    };
  }
  
  return {
    kpis,
    brandAnalysis: brandAnalysis.sort((a, b) => b.adoptionScore - a.adoptionScore),
    featureStats,
    top10,
    commonTop10Features,
    segmentation,
    allBrandTypes,
    allFeatures,
    tierConfig,
    mode,
  };
}

/**
 * Rank features by how many brands use them (for recommendation).
 */
function featureUsageRanking(brandFeatureMap, allFeatures) {
  const counts = {};
  allFeatures.forEach(f => { counts[f] = 0; });
  for (const brand of Object.keys(brandFeatureMap)) {
    for (const feature of Object.keys(brandFeatureMap[brand])) {
      if (brandFeatureMap[brand][feature] > 0 && counts[feature] !== undefined) {
        counts[feature]++;
      }
    }
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

/**
 * Recommend the most popular unused feature for a brand.
 * Prioritizes high-value features, then most-popular-overall features.
 */
function getRecommendedFeature(unusedFeatures, ranking) {
  if (!unusedFeatures.length) return null;
  
  // First try high-value features
  const highValueUnused = unusedFeatures.filter(f =>
    HIGH_VALUE_FEATURES.some(hv => f.toLowerCase().includes(hv))
  );
  if (highValueUnused.length) {
    const ranked = ranking.filter(([f]) => highValueUnused.includes(f));
    return ranked.length ? ranked[0][0] : highValueUnused[0];
  }
  
  // Otherwise recommend most popular unused feature
  const ranked = ranking.filter(([f]) => unusedFeatures.includes(f));
  return ranked.length ? ranked[0][0] : unusedFeatures[0];
}

/**
 * Get top features for a brand-type segment.
 */
function getTopFeaturesForSegment(brands, allFeatures, brandFeatureMap) {
  const featureCounts = {};
  allFeatures.forEach(f => { featureCounts[f] = 0; });
  
  brands.forEach(b => {
    const map = brandFeatureMap[b.brand] || {};
    Object.keys(map).forEach(f => {
      if (map[f] > 0 && featureCounts[f] !== undefined) featureCounts[f]++;
    });
  });
  
  return Object.entries(featureCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([feature, count]) => ({
      feature,
      count,
      percentage: brands.length > 0 ? Math.round((count / brands.length) * 100) : 0,
    }));
}

/**
 * Get underutilized features for a segment (high-value but low adoption).
 */
function getUnderutilizedFeatures(brands, allFeatures, brandFeatureMap) {
  const featureCounts = {};
  allFeatures.forEach(f => { featureCounts[f] = 0; });
  
  brands.forEach(b => {
    const map = brandFeatureMap[b.brand] || {};
    Object.keys(map).forEach(f => {
      if (map[f] > 0 && featureCounts[f] !== undefined) featureCounts[f]++;
    });
  });
  
  return Object.entries(featureCounts)
    .filter(([f, count]) => {
      const pct = brands.length > 0 ? count / brands.length : 0;
      return pct < 0.4; // Used by <40% of segment
    })
    .sort((a, b) => a[1] - b[1])
    .slice(0, 5)
    .map(([feature, count]) => ({
      feature,
      count,
      percentage: brands.length > 0 ? Math.round((count / brands.length) * 100) : 0,
      isHighValue: HIGH_VALUE_FEATURES.some(hv => feature.toLowerCase().includes(hv)),
    }));
}

module.exports = {
  analyzeData,
  filterByDateRange,
  filterByBrandType,
  parseNum,
  DEFAULT_TIER_CONFIG,
  HIGH_VALUE_FEATURES,
  EXCLUDED_EVENTS,
};
