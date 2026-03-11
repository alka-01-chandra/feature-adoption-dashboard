'use client';

import { BrandData, AnalysisMode, SheetData } from '@/lib/types';
import { computeFeatureStats, FeatureStat } from '@/lib/dataProcessing';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList,
} from 'recharts';
import { useState } from 'react';
import { ArrowUpDown } from 'lucide-react';

interface Props {
  brands: BrandData[];
  mode: AnalysisMode;
  data: SheetData;
}

type SortBy = 'adoption' | 'events';

const COLORS = {
  high: '#2563eb',
  mid: '#60a5fa',
  low: '#bfdbfe',
};

function getBarColor(pct: number) {
  if (pct >= 50) return COLORS.high;
  if (pct >= 25) return COLORS.mid;
  return COLORS.low;
}

// Custom tooltip
function CustomTooltip({ active, payload }: { active?: boolean; payload?: { payload: FeatureStat }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-bold text-slate-800 mb-1">{d.name}</p>
      {d.category && <p className="text-slate-500 mb-1">Category: {d.category}</p>}
      <p className="text-blue-600 font-semibold">{d.adoptionPct}% of brands using</p>
      <p className="text-slate-500">{d.usageCount} / {d.totalBrands} brands</p>
      <p className="text-slate-500">{d.totalEvents.toLocaleString()} total events</p>
    </div>
  );
}

export default function FeatureChart({ brands, mode, data }: Props) {
  const [sortBy, setSortBy] = useState<SortBy>('adoption');
  const [showAll, setShowAll] = useState(false);

  const stats = computeFeatureStats(brands, mode, data);
  const sorted = [...stats].sort((a, b) =>
    sortBy === 'adoption' ? b.adoptionPct - a.adoptionPct : b.totalEvents - a.totalEvents
  );

  const displayed = showAll ? sorted : sorted.slice(0, 20);

  // Short label for chart
  const shortName = (name: string) => {
    if (mode === 'subCategory') {
      // "Funnel > Dashboard" → "Dashboard"
      const parts = name.split(' > ');
      return parts[parts.length - 1].replace(' (2)', '').replace(' (3)', '');
    }
    return name;
  };

  return (
    <div className="space-y-6">
      {/* Feature Adoption Bar Chart */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-800">Feature Usage Overview</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              % of {brands.length} brands using each {mode === 'category' ? 'event category' : 'sub-category'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as SortBy)}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-600 focus:outline-none focus:border-blue-400"
            >
              <option value="adoption">Sort by adoption %</option>
              <option value="events">Sort by total events</option>
            </select>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={Math.max(300, displayed.length * 28)}>
          <BarChart
            data={displayed.map(s => ({ ...s, shortName: shortName(s.name) }))}
            layout="vertical"
            margin={{ top: 0, right: 80, left: 160, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
            <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <YAxis type="category" dataKey="shortName" tick={{ fontSize: 11, fill: '#475569' }} width={155} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="adoptionPct" radius={[0, 4, 4, 0]} maxBarSize={18}>
              <LabelList
                dataKey="adoptionPct"
                position="right"
                formatter={(v: number) => `${v}%`}
                style={{ fontSize: 11, fill: '#64748b', fontWeight: 500 }}
              />
              {displayed.map((entry, idx) => (
                <Cell key={idx} fill={getBarColor(entry.adoptionPct)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {sorted.length > 20 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="mt-4 text-xs text-blue-600 hover:underline font-medium"
          >
            {showAll ? 'Show less' : `Show all ${sorted.length} features`}
          </button>
        )}
      </div>

      {/* Most & Least Used Features Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-bold text-slate-700 mb-3">Most Used Features</h3>
          <div className="space-y-2">
            {sorted.slice(0, 8).map((s, i) => (
              <div key={s.name} className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-400 w-4">{i + 1}</span>
                <div className="flex-1">
                  <div className="flex justify-between mb-0.5">
                    <span className="text-xs font-medium text-slate-700">{shortName(s.name)}</span>
                    <span className="text-xs font-bold text-blue-600">{s.adoptionPct}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all"
                      style={{ width: `${s.adoptionPct}%` }}
                    />
                  </div>
                </div>
                <span className="text-xs text-slate-400">{s.usageCount} brands</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-bold text-slate-700 mb-3">Least Used Features (Opportunity Areas)</h3>
          <div className="space-y-2">
            {[...sorted].reverse().slice(0, 8).map((s, i) => (
              <div key={s.name} className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-400 w-4">{i + 1}</span>
                <div className="flex-1">
                  <div className="flex justify-between mb-0.5">
                    <span className="text-xs font-medium text-slate-700">{shortName(s.name)}</span>
                    <span className="text-xs font-bold text-red-500">{s.adoptionPct}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-red-400 transition-all"
                      style={{ width: `${s.adoptionPct}%` }}
                    />
                  </div>
                </div>
                <span className="text-xs text-slate-400">{s.usageCount} brands</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
