/**
 * dataProcessing.ts — Pure analytics functions over BrandData arrays.
 * All functions are side-effect free and can run on client or server.
 */

import {
  BrandData,
  FeatureStat,
  SegmentStat,
  AnalysisMode,
  AdoptionTier,
  SheetData,
  DEFAULT_TIER_CONFIG,
  TierConfig,
} from './types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getAdoptionPct(brand: BrandData, mode: AnalysisMode): number {
  return mode === 'category' ? brand.adoptionScoreCatPct : brand.adoptionScoreSubPct;
}

export function getTier(brand: BrandData, mode: AnalysisMode): AdoptionTier {
  return mode === 'category' ? brand.tierCat : brand.tierSub;
}

export function getFeaturesUsed(brand: BrandData, mode: AnalysisMode): string[] {
  return mode === 'category' ? brand.featuresUsedCat : brand.featuresUsedSub;
}

export function getFeaturesNotUsed(brand: BrandData, mode: AnalysisMode): string[] {
  return mode === 'category' ? brand.featuresNotUsedCat : brand.featuresNotUsedSub;
}

export function tierLabel(tier: AdoptionTier): string {
  const map: Record<AdoptionTier, string> = {
    Low: 'Tier 1 — Low',
    Emerging: 'Tier 2 — Emerging',
    Healthy: 'Tier 3 — Healthy',
    Power: 'Tier 4 — Power',
  };
  return map[tier];
}

export function tierColor(tier: AdoptionTier): string {
  const map: Record<AdoptionTier, string> = {
    Low: 'bg-red-100 text-red-700 border-red-200',
    Emerging: 'bg-amber-100 text-amber-700 border-amber-200',
    Healthy: 'bg-green-100 text-green-700 border-green-200',
    Power: 'bg-blue-100 text-blue-700 border-blue-200',
  };
  return map[tier];
}

export function tierDotColor(tier: AdoptionTier): string {
  const map: Record<AdoptionTier, string> = {
    Low: 'bg-red-500',
    Emerging: 'bg-amber-500',
    Healthy: 'bg-green-500',
    Power: 'bg-blue-500',
  };
  return map[tier];
}

// ─── KPI Summary ─────────────────────────────────────────────────────────────

export interface KPISummary {
  totalBrands: number;
  activeBrands: number;        // brands with totalEvents > 0
  totalFeatures: number;       // tracked features in current mode
  avgAdoptionPct: number;
  lowAdoptionBrands: number;   // Tier 1
  powerBrands: number;         // Tier 4
  emergingBrands: number;
  healthyBrands: number;
}

export function computeKPIs(
  brands: BrandData[],
  mode: AnalysisMode,
  data: SheetData
): KPISummary {
  const totalBrands = brands.length;
  const activeBrands = brands.filter(b => b.totalEvents > 0).length;
  const totalFeatures = mode === 'category'
    ? data.trackedCategories.length
    : data.trackedSubCategories.length;

  const adoptionPcts = brands.map(b => getAdoptionPct(b, mode));
  const avgAdoptionPct = totalBrands > 0
    ? Math.round(adoptionPcts.reduce((a, b) => a + b, 0) / totalBrands)
    : 0;

  const tierCounts = { Low: 0, Emerging: 0, Healthy: 0, Power: 0 };
  for (const b of brands) tierCounts[getTier(b, mode)]++;

  return {
    totalBrands,
    activeBrands,
    totalFeatures,
    avgAdoptionPct,
    lowAdoptionBrands: tierCounts.Low,
    emergingBrands: tierCounts.Emerging,
    healthyBrands: tierCounts.Healthy,
    powerBrands: tierCounts.Power,
  };
}

// ─── Feature Stats ────────────────────────────────────────────────────────────

export function computeFeatureStats(
  brands: BrandData[],
  mode: AnalysisMode,
  data: SheetData
): FeatureStat[] {
  const features = mode === 'category' ? data.trackedCategories : data.trackedSubCategories;
  const totalBrands = brands.length;

  return features.map(feature => {
    let usageCount = 0;
    let totalEvents = 0;

    for (const b of brands) {
      const scores = mode === 'category' ? b.categoryScores : b.subCategoryScores;
      const val = scores[feature] || 0;
      if (val > 0) usageCount++;
      totalEvents += val;
    }

    return {
      name: feature,
      usageCount,
      totalBrands,
      adoptionPct: totalBrands > 0 ? Math.round((usageCount / totalBrands) * 100) : 0,
      totalEvents,
      category: mode === 'subCategory' ? data.subCategoryToCategory[feature] : undefined,
    };
  }).sort((a, b) => b.adoptionPct - a.adoptionPct);
}

// ─── Top N Brands ─────────────────────────────────────────────────────────────

export interface Top10BrandAnalysis {
  brand: BrandData;
  rank: number;
  totalEvents: number;
  adoptionPct: number;
  tier: AdoptionTier;
  featuresUsed: string[];
  // Features this brand uses that are in the common power-user set
  powerUserFeatures: string[];
}

export interface Top10Summary {
  brands: Top10BrandAnalysis[];
  // Features used by 80%+ of top brands — "power user bundle"
  commonFeatures: string[];
  // Features used by 50%+ of top brands but not yet universal
  emergingBestPractices: string[];
}

export function computeTop10(
  brands: BrandData[],
  mode: AnalysisMode,
  n = 10
): Top10Summary {
  const sorted = [...brands]
    .filter(b => b.totalEvents > 0)
    .sort((a, b) => b.totalEvents - a.totalEvents)
    .slice(0, n);

  const totalTop = sorted.length;
  if (totalTop === 0) return { brands: [], commonFeatures: [], emergingBestPractices: [] };

  // Count feature usage across top brands
  const featureUsageCount: Record<string, number> = {};
  for (const b of sorted) {
    const used = getFeaturesUsed(b, mode);
    for (const f of used) {
      featureUsageCount[f] = (featureUsageCount[f] || 0) + 1;
    }
  }

  const commonFeatures = Object.entries(featureUsageCount)
    .filter(([, c]) => c / totalTop >= 0.8)
    .sort((a, b) => b[1] - a[1])
    .map(([f]) => f);

  const emergingBestPractices = Object.entries(featureUsageCount)
    .filter(([, c]) => c / totalTop >= 0.5 && c / totalTop < 0.8)
    .sort((a, b) => b[1] - a[1])
    .map(([f]) => f);

  const analysed: Top10BrandAnalysis[] = sorted.map((brand, idx) => ({
    brand,
    rank: idx + 1,
    totalEvents: brand.totalEvents,
    adoptionPct: getAdoptionPct(brand, mode),
    tier: getTier(brand, mode),
    featuresUsed: getFeaturesUsed(brand, mode),
    powerUserFeatures: getFeaturesUsed(brand, mode).filter(f => commonFeatures.includes(f)),
  }));

  return { brands: analysed, commonFeatures, emergingBestPractices };
}

// ─── Segmentation ─────────────────────────────────────────────────────────────

export function computeSegmentation(
  brands: BrandData[],
  mode: AnalysisMode
): SegmentStat[] {
  const byType = new Map<string, BrandData[]>();
  for (const b of brands) {
    const t = b.brandType || 'Unknown';
    if (!byType.has(t)) byType.set(t, []);
    byType.get(t)!.push(b);
  }

  const results: SegmentStat[] = [];
  for (const [brandType, bs] of byType) {
    const tierBreakdown: Record<AdoptionTier, number> = { Low: 0, Emerging: 0, Healthy: 0, Power: 0 };
    const featureCount: Record<string, number> = {};
    let totalAdoption = 0;

    for (const b of bs) {
      tierBreakdown[getTier(b, mode)]++;
      totalAdoption += getAdoptionPct(b, mode);
      for (const f of getFeaturesUsed(b, mode)) {
        featureCount[f] = (featureCount[f] || 0) + 1;
      }
    }

    const topFeatures = Object.entries(featureCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([f]) => f);

    results.push({
      brandType,
      brandCount: bs.length,
      avgAdoptionPct: bs.length > 0 ? Math.round(totalAdoption / bs.length) : 0,
      tierBreakdown,
      topFeatures,
    });
  }

  return results.sort((a, b) => b.avgAdoptionPct - a.avgAdoptionPct);
}

// ─── Low Adoption Detection ───────────────────────────────────────────────────

export interface LowAdoptionBrand {
  brand: BrandData;
  reason: string;
  urgency: 'High' | 'Medium';
  missingHighValueFeatures: string[];
}

const HIGH_VALUE_FEATURES = ['Experiments', 'Pierre', 'Analytics', 'Search', 'SEO'];

export function detectLowAdoptionBrands(
  brands: BrandData[],
  mode: AnalysisMode
): LowAdoptionBrand[] {
  const results: LowAdoptionBrand[] = [];

  for (const b of brands) {
    if (b.totalEvents === 0) continue; // Inactive — skip (different issue)

    const pct = getAdoptionPct(b, mode);
    const used = getFeaturesUsed(b, mode);
    const missing = HIGH_VALUE_FEATURES.filter(f => !used.includes(f));

    let reason = '';
    let urgency: 'High' | 'Medium' = 'Medium';

    if (pct < 25) {
      reason = `Only uses ${used.length} feature(s) out of available set`;
      urgency = 'High';
    } else if (pct < 50 && missing.length >= 3) {
      reason = `Moderate breadth but missing ${missing.length} high-value features`;
      urgency = 'Medium';
    } else if (pct >= 50 && missing.length >= 4) {
      reason = 'High activity on limited modules — deep user but feature gaps exist';
      urgency = 'Medium';
    } else {
      continue; // Not flagged
    }

    results.push({ brand: b, reason, urgency, missingHighValueFeatures: missing });
  }

  return results.sort((a, b) => {
    if (a.urgency !== b.urgency) return a.urgency === 'High' ? -1 : 1;
    return getAdoptionPct(a.brand, mode) - getAdoptionPct(b.brand, mode);
  });
}

// ─── Filter Brands ────────────────────────────────────────────────────────────

export function filterBrands(
  brands: BrandData[],
  selectedBrandTypes: string[]
): BrandData[] {
  if (selectedBrandTypes.length === 0) return brands;
  return brands.filter(b => selectedBrandTypes.includes(b.brandType));
}

// ─── Sort Brands ──────────────────────────────────────────────────────────────

export type SortField = 'name' | 'brandType' | 'adoptionPct' | 'totalEvents' | 'tier' | 'featuresUsed';
export type SortDir = 'asc' | 'desc';

const tierOrder: Record<AdoptionTier, number> = { Low: 0, Emerging: 1, Healthy: 2, Power: 3 };

export function sortBrands(
  brands: BrandData[],
  field: SortField,
  dir: SortDir,
  mode: AnalysisMode
): BrandData[] {
  return [...brands].sort((a, b) => {
    let cmp = 0;
    switch (field) {
      case 'name': cmp = a.name.localeCompare(b.name); break;
      case 'brandType': cmp = (a.brandType || '').localeCompare(b.brandType || ''); break;
      case 'adoptionPct': cmp = getAdoptionPct(a, mode) - getAdoptionPct(b, mode); break;
      case 'totalEvents': cmp = a.totalEvents - b.totalEvents; break;
      case 'tier': cmp = tierOrder[getTier(a, mode)] - tierOrder[getTier(b, mode)]; break;
      case 'featuresUsed': cmp = getFeaturesUsed(a, mode).length - getFeaturesUsed(b, mode).length; break;
    }
    return dir === 'asc' ? cmp : -cmp;
  });
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

export function exportBrandsCSV(brands: BrandData[], mode: AnalysisMode): string {
  const header = [
    'Brand Name', 'Brand Type', 'Total Events', 'Features Used Count',
    'Features Not Used Count', 'Adoption %', 'Tier', 'Recommended Next Feature',
    'Features Used', 'Features Not Used'
  ].join(',');

  const rows = brands.map(b => {
    const pct = getAdoptionPct(b, mode);
    const tier = getTier(b, mode);
    const used = getFeaturesUsed(b, mode);
    const notUsed = getFeaturesNotUsed(b, mode);
    return [
      `"${b.name}"`,
      `"${b.brandType}"`,
      b.totalEvents,
      used.length,
      notUsed.length,
      pct,
      tier,
      `"${b.recommendedNextFeature}"`,
      `"${used.join('; ')}"`,
      `"${notUsed.join('; ')}"`,
    ].join(',');
  });

  return [header, ...rows].join('\n');
}
