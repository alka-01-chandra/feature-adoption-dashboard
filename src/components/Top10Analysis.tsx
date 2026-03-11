'use client';

import { BrandData, AnalysisMode, SheetData } from '@/lib/types';
import { computeTop10, tierColor, tierLabel } from '@/lib/dataProcessing';
import { Trophy, Star, Zap } from 'lucide-react';

interface Props {
  brands: BrandData[];
  mode: AnalysisMode;
  data: SheetData;
}

export default function Top10Analysis({ brands, mode, data }: Props) {
  const analysis = computeTop10(brands, mode, 10);

  if (analysis.brands.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
        <p className="text-slate-400">No active brands found for top-10 analysis.</p>
      </div>
    );
  }

  // Build heatmap: top brands × features
  const features = mode === 'category' ? data.trackedCategories : data.trackedSubCategories;
  const topBrands = analysis.brands;

  const shortFeatureName = (f: string) => {
    if (mode === 'subCategory') {
      const parts = f.split(' > ');
      return parts[parts.length - 1].replace(/ \(\d+\)$/, '');
    }
    return f;
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Power User Bundle */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 col-span-1">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
              <Trophy className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Power User Bundle</h3>
              <p className="text-xs text-slate-400">Used by 80%+ of top brands</p>
            </div>
          </div>
          {analysis.commonFeatures.length === 0 ? (
            <p className="text-xs text-slate-400">No universal features found</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {analysis.commonFeatures.map(f => (
                <span key={f} className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded-lg text-xs font-medium">
                  {shortFeatureName(f)}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Emerging Best Practices */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
              <Star className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Emerging Best Practices</h3>
              <p className="text-xs text-slate-400">Used by 50–79% of top brands</p>
            </div>
          </div>
          {analysis.emergingBestPractices.length === 0 ? (
            <p className="text-xs text-slate-400">None in this range</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {analysis.emergingBestPractices.map(f => (
                <span key={f} className="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-1 rounded-lg text-xs font-medium">
                  {shortFeatureName(f)}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Data note */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center">
              <Zap className="w-4 h-4 text-slate-500" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Ranking Logic</h3>
            </div>
          </div>
          <ul className="text-xs text-slate-500 space-y-1 list-disc list-inside">
            <li>Ranked by total event count across all tracked features</li>
            <li>CVR not available in source data — marked as pending</li>
            <li>Only active brands (events &gt; 0) are ranked</li>
          </ul>
        </div>
      </div>

      {/* Top 10 Ranked List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-800">Top {topBrands.length} Brands by Activity</h3>
          <p className="text-xs text-slate-400 mt-0.5">Ranked by total event volume. CVR pending additional data source.</p>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-slate-600 font-semibold w-12">#</th>
                <th className="text-left px-4 py-3 text-slate-600 font-semibold">Brand</th>
                <th className="text-left px-4 py-3 text-slate-600 font-semibold">Brand Type</th>
                <th className="text-left px-4 py-3 text-slate-600 font-semibold">Total Events</th>
                <th className="text-left px-4 py-3 text-slate-600 font-semibold">Adoption %</th>
                <th className="text-left px-4 py-3 text-slate-600 font-semibold">Tier</th>
                <th className="text-left px-4 py-3 text-slate-600 font-semibold">Features Used</th>
                <th className="text-left px-4 py-3 text-slate-600 font-semibold w-24 text-center">CVR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {topBrands.map(({ brand, rank, totalEvents, adoptionPct, tier, featuresUsed }) => (
                <tr key={brand.name} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      rank === 1 ? 'bg-yellow-100 text-yellow-700' :
                      rank === 2 ? 'bg-slate-100 text-slate-600' :
                      rank === 3 ? 'bg-orange-100 text-orange-700' :
                      'bg-slate-50 text-slate-500'
                    }`}>
                      {rank}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">{brand.name}</td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{brand.brandType || '—'}</td>
                  <td className="px-4 py-3 font-mono text-slate-700 whitespace-nowrap">
                    {totalEvents.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${adoptionPct}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-slate-700">{adoptionPct}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${tierColor(tier)}`}>
                      {tier}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {featuresUsed.slice(0, 6).map(f => (
                        <span key={f} className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-xs">
                          {shortFeatureName(f)}
                        </span>
                      ))}
                      {featuresUsed.length > 6 && (
                        <span className="text-slate-400 text-xs">+{featuresUsed.length - 6}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded">Pending</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Feature Heatmap */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-800">Feature Usage Heatmap — Top Brands</h3>
          <p className="text-xs text-slate-400 mt-0.5">Green = feature used · Gray = not used</p>
        </div>
        <div className="overflow-x-auto scrollbar-thin p-4">
          <table className="text-xs">
            <thead>
              <tr>
                <th className="text-left pr-4 py-1 font-medium text-slate-600 w-32 whitespace-nowrap">Brand</th>
                {features.map(f => (
                  <th key={f} className="px-1 py-1 font-medium text-slate-500 writing-vertical" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)', height: 100 }}>
                    <span className="block whitespace-nowrap">{shortFeatureName(f)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {topBrands.map(({ brand, rank }) => {
                const scores = mode === 'category' ? brand.categoryScores : brand.subCategoryScores;
                return (
                  <tr key={brand.name}>
                    <td className="pr-4 py-1 font-medium text-slate-700 whitespace-nowrap">
                      <span className="text-slate-400 mr-1">#{rank}</span>
                      {brand.name.length > 20 ? brand.name.slice(0, 18) + '…' : brand.name}
                    </td>
                    {features.map(f => {
                      const val = scores[f] || 0;
                      const used = val > 0;
                      return (
                        <td key={f} className="px-1 py-1" title={`${shortFeatureName(f)}: ${val.toLocaleString()} events`}>
                          <div className={`w-5 h-5 rounded ${
                            used ? 'bg-green-500' : 'bg-slate-100'
                          } flex items-center justify-center`}>
                            {used && (
                              <div className={`w-2 h-2 rounded-sm ${
                                val > 1000 ? 'bg-green-900' : val > 100 ? 'bg-green-700' : 'bg-green-500'
                              }`} />
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-green-500 rounded" /> Used (&lt; 100 events)</div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-green-700 rounded" /> Active (100–1k events)</div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-green-900 rounded" /> Heavy (&gt; 1k events)</div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-slate-100 rounded" /> Not used</div>
          </div>
        </div>
      </div>
    </div>
  );
}
