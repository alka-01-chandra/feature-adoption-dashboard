'use client';

import { BrandData, AnalysisMode, SheetData, AdoptionTier } from '@/lib/types';
import { computeSegmentation } from '@/lib/dataProcessing';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import { computeFeatureStats } from '@/lib/dataProcessing';

interface Props {
  brands: BrandData[];
  mode: AnalysisMode;
  data: SheetData;
}

const TIER_COLORS: Record<AdoptionTier, string> = {
  Low: '#ef4444',
  Emerging: '#f59e0b',
  Healthy: '#22c55e',
  Power: '#3b82f6',
};

export default function SegmentationChart({ brands, mode, data }: Props) {
  const segments = computeSegmentation(brands, mode);
  const featureStats = computeFeatureStats(brands, mode, data);

  // Build radar data: each brand type as a series, features as axes
  // Use top 8 features for readability
  const top8Features = featureStats.slice(0, 8).map(f => f.name);

  const shortName = (f: string) => {
    if (mode === 'subCategory') {
      const parts = f.split(' > ');
      return parts[parts.length - 1].replace(/ \(\d+\)$/, '').slice(0, 14);
    }
    return f.slice(0, 14);
  };

  // Radar: each axis is a feature, value = % of brands in segment using that feature
  const radarData = top8Features.map(feature => {
    const point: Record<string, number | string> = { feature: shortName(feature) };
    for (const seg of segments) {
      const segBrands = brands.filter(b => b.brandType === seg.brandType);
      const usageCount = segBrands.filter(b => {
        const scores = mode === 'category' ? b.categoryScores : b.subCategoryScores;
        return (scores[feature] || 0) > 0;
      }).length;
      point[seg.brandType] = segBrands.length > 0 ? Math.round((usageCount / segBrands.length) * 100) : 0;
    }
    return point;
  });

  // Stacked bar: tier distribution per segment
  const barData = segments.map(s => ({
    name: s.brandType.length > 14 ? s.brandType.slice(0, 12) + '…' : s.brandType,
    fullName: s.brandType,
    ...s.tierBreakdown,
    count: s.brandCount,
  }));

  const RADAR_COLORS = ['#3b82f6', '#f59e0b', '#22c55e', '#a855f7', '#ef4444', '#06b6d4'];

  return (
    <div className="space-y-6">
      {/* Segment Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {segments.map((seg, idx) => (
          <div key={seg.brandType} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="text-sm font-bold text-slate-800">{seg.brandType}</p>
                <p className="text-xs text-slate-400">{seg.brandCount} brands</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-blue-600">{seg.avgAdoptionPct}%</p>
                <p className="text-xs text-slate-400">avg adoption</p>
              </div>
            </div>

            {/* Mini tier bar */}
            <div className="h-2 rounded-full overflow-hidden flex mb-3">
              {(['Low', 'Emerging', 'Healthy', 'Power'] as AdoptionTier[]).map(tier => {
                const pct = ((seg.tierBreakdown[tier] || 0) / seg.brandCount) * 100;
                return pct > 0 ? (
                  <div
                    key={tier}
                    className="h-full"
                    style={{ width: `${pct}%`, backgroundColor: TIER_COLORS[tier] }}
                    title={`${tier}: ${seg.tierBreakdown[tier]}`}
                  />
                ) : null;
              })}
            </div>

            {/* Top features */}
            <div>
              <p className="text-xs text-slate-400 mb-1">Top features</p>
              <div className="flex flex-wrap gap-1">
                {seg.topFeatures.slice(0, 4).map(f => (
                  <span key={f} className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                    {shortName(f)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tier Distribution Bar Chart */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-sm font-bold text-slate-800 mb-4">Tier Distribution by Brand Type</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={barData} margin={{ left: 0, right: 20, top: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <Tooltip
              formatter={(value: number, name: string) => [`${value} brands`, name]}
              labelFormatter={(label: string) => {
                const seg = segments.find(s => s.brandType.startsWith(label.replace('…', '')));
                return seg ? `${seg.brandType} (${seg.brandCount} total)` : label;
              }}
            />
            <Legend />
            {(['Low', 'Emerging', 'Healthy', 'Power'] as AdoptionTier[]).map(tier => (
              <Bar key={tier} dataKey={tier} stackId="a" fill={TIER_COLORS[tier]} name={tier} radius={tier === 'Power' ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Radar Chart: Feature Adoption by Segment */}
      {segments.length >= 2 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-sm font-bold text-slate-800 mb-1">Feature Adoption Patterns by Brand Type</h3>
          <p className="text-xs text-slate-400 mb-4">% of brands in each segment using each feature (top 8 by overall adoption)</p>
          <ResponsiveContainer width="100%" height={350}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#e2e8f0" />
              <PolarAngleAxis dataKey="feature" tick={{ fontSize: 10, fill: '#64748b' }} />
              <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#94a3b8' }} tickFormatter={v => `${v}%`} />
              {segments.slice(0, 6).map((seg, idx) => (
                <Radar
                  key={seg.brandType}
                  name={seg.brandType}
                  dataKey={seg.brandType}
                  stroke={RADAR_COLORS[idx]}
                  fill={RADAR_COLORS[idx]}
                  fillOpacity={0.1}
                  strokeWidth={2}
                />
              ))}
              <Legend />
              <Tooltip formatter={(v: number) => `${v}%`} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Detailed Segment Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-800">Segment Breakdown</h3>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-slate-600 font-semibold">Brand Type</th>
                <th className="text-left px-4 py-3 text-slate-600 font-semibold">Brands</th>
                <th className="text-left px-4 py-3 text-slate-600 font-semibold">Avg Adoption %</th>
                <th className="text-left px-4 py-3 text-slate-600 font-semibold">Low</th>
                <th className="text-left px-4 py-3 text-slate-600 font-semibold">Emerging</th>
                <th className="text-left px-4 py-3 text-slate-600 font-semibold">Healthy</th>
                <th className="text-left px-4 py-3 text-slate-600 font-semibold">Power</th>
                <th className="text-left px-4 py-3 text-slate-600 font-semibold">Top Features</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {segments.map(seg => (
                <tr key={seg.brandType} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{seg.brandType}</td>
                  <td className="px-4 py-3 text-slate-600">{seg.brandCount}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${seg.avgAdoptionPct}%` }} />
                      </div>
                      <span className="font-semibold text-xs text-slate-700">{seg.avgAdoptionPct}%</span>
                    </div>
                  </td>
                  {(['Low', 'Emerging', 'Healthy', 'Power'] as AdoptionTier[]).map(tier => (
                    <td key={tier} className="px-4 py-3">
                      <span className={`text-xs font-semibold ${
                        tier === 'Low' ? 'text-red-600' :
                        tier === 'Emerging' ? 'text-amber-600' :
                        tier === 'Healthy' ? 'text-green-600' :
                        'text-blue-600'
                      }`}>{seg.tierBreakdown[tier] || 0}</span>
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {seg.topFeatures.slice(0, 4).map(f => (
                        <span key={f} className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-xs">
                          {shortName(f)}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
