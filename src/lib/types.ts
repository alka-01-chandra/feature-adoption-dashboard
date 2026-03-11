export type AdoptionTier = 'Low' | 'Emerging' | 'Healthy' | 'Power';
export type AnalysisMode = 'category' | 'subCategory';

export interface BrandData {
  name: string;
  brandType: string;

  // Category-level scores: { "AEO": 10, "Analytics": 314, ... }
  categoryScores: Record<string, number>;
  // Sub-category-level scores: { "Funnel > Dashboard": 0, "Funnel > Funnel": 0, ... }
  subCategoryScores: Record<string, number>;

  // Category-mode adoption
  adoptionScoreCat: number;       // 0–1
  adoptionScoreCatPct: number;    // 0–100
  tierCat: AdoptionTier;
  featuresUsedCat: string[];
  featuresNotUsedCat: string[];

  // Sub-category-mode adoption
  adoptionScoreSub: number;
  adoptionScoreSubPct: number;
  tierSub: AdoptionTier;
  featuresUsedSub: string[];
  featuresNotUsedSub: string[];

  // Derived
  totalEvents: number;
  recommendedNextFeature: string;
}

export interface FeatureStat {
  name: string;
  usageCount: number;       // number of brands using it
  totalBrands: number;
  adoptionPct: number;      // % of brands using
  totalEvents: number;      // sum of all event counts across brands
  category?: string;        // parent category (for sub-category mode)
}

export interface SegmentStat {
  brandType: string;
  brandCount: number;
  avgAdoptionPct: number;
  tierBreakdown: Record<AdoptionTier, number>;
  topFeatures: string[];
}

export interface SheetData {
  brands: BrandData[];
  // All category names from sheet (raw)
  allCategories: string[];
  // Tracked categories (exclusions applied)
  trackedCategories: string[];
  // All sub-category names (as "Parent > SubName")
  allSubCategories: string[];
  trackedSubCategories: string[];
  // "Funnel > Dashboard" → "Funnel"
  subCategoryToCategory: Record<string, string>;
  brandTypes: string[];
  lastFetched: string;
  // Data quality notes surfaced to UI
  dataNotes: string[];
}

export interface TierConfig {
  low: number;      // max pct for Low (exclusive)
  emerging: number; // max pct for Emerging (exclusive)
  healthy: number;  // max pct for Healthy (exclusive)
  // above healthy → Power
}

export const DEFAULT_TIER_CONFIG: TierConfig = {
  low: 25,
  emerging: 50,
  healthy: 75,
};

// These are excluded from adoption scoring.
// "Others" is too generic; "Pierre - Old" is deprecated; "#N/A" is a data artifact.
export const EXCLUDED_CATEGORIES: Set<string> = new Set([
  'Others',
  'Pierre - Old',
  '#N/A',
]);

// High-value feature priority list for recommendations (index 0 = highest priority)
export const FEATURE_PRIORITY: string[] = [
  'Experiments',
  'Pierre',
  'Analytics',
  'Search',
  'SEO',
  'Forever Link',
  'AEO',
  'Funnel',
  'Cmd + K',
  'Homepage',
  'PDP',
  'Brand Settings',
];
