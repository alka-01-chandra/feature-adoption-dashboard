'use client';

import { BrandData, AnalysisMode, SheetData } from '@/lib/types';
import { computeKPIs } from '@/lib/dataProcessing';
import { Users, Zap, BarChart2, TrendingDown, Star, Activity, Award, Layers } from 'lucide-react';

interface Props {
  brands: BrandData[];
  mode: AnalysisMode;
  data: SheetData;
}

export default function KPISummary({ brands, mode, data }: Props) {
  const kpi = computeKPIs(brands, mode, data);

  const cards = [
    {
      label: 'Total Brands',
      value: kpi.totalBrands,
      sub: 'in current filter',
      icon: Users,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Active Brands',
      value: kpi.activeBrands,
      sub: `${Math.round((kpi.activeBrands / Math.max(kpi.totalBrands, 1)) * 100)}% with any activity`,
      icon: Activity,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: 'Features Tracked',
      value: kpi.totalFeatures,
      sub: `${mode === 'category' ? 'event categories' : 'event sub-categories'}`,
      icon: Layers,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      label: 'Avg Adoption Score',
      value: `${kpi.avgAdoptionPct}%`,
      sub: 'features used / total features',
      icon: BarChart2,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
    },
    {
      label: 'Low Adoption',
      value: kpi.lowAdoptionBrands,
      sub: 'Tier 1 — need outreach',
      icon: TrendingDown,
      color: 'text-red-600',
      bg: 'bg-red-50',
    },
    {
      label: 'Emerging',
      value: kpi.emergingBrands,
      sub: 'Tier 2 — growing',
      icon: Zap,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: 'Healthy',
      value: kpi.healthyBrands,
      sub: 'Tier 3 — solid adoption',
      icon: Star,
      color: 'text-teal-600',
      bg: 'bg-teal-50',
    },
    {
      label: 'Power Users',
      value: kpi.powerBrands,
      sub: 'Tier 4 — high adoption',
      icon: Award,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
  ];

  return (
    <div>
      <h2 className="text-base font-bold text-slate-700 mb-3">KPI Summary</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {cards.map(card => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col gap-2">
              <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center`}>
                <Icon className={`w-4 h-4 ${card.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{card.value}</p>
                <p className="text-xs font-semibold text-slate-600 mt-0.5">{card.label}</p>
                <p className="text-xs text-slate-400 mt-0.5 leading-tight">{card.sub}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tier legend */}
      <div className="mt-4 bg-white rounded-xl border border-slate-200 p-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Adoption Tier Definitions</p>
        <div className="flex flex-wrap gap-4 text-sm">
          {[
            { tier: 'Tier 1 — Low', range: '< 25%', desc: 'Missing most features. Prioritize educational outreach.', color: 'text-red-600 bg-red-50 border-red-200' },
            { tier: 'Tier 2 — Emerging', range: '25–49%', desc: 'Getting started. Send feature discovery campaigns.', color: 'text-amber-600 bg-amber-50 border-amber-200' },
            { tier: 'Tier 3 — Healthy', range: '50–74%', desc: 'Good adoption. Push advanced features.', color: 'text-green-600 bg-green-50 border-green-200' },
            { tier: 'Tier 4 — Power', range: '≥ 75%', desc: 'Deep platform users. Candidate for case studies.', color: 'text-blue-600 bg-blue-50 border-blue-200' },
          ].map(t => (
            <div key={t.tier} className={`flex items-start gap-2 px-3 py-2 rounded-lg border ${t.color}`}>
              <div className="flex-1">
                <p className="font-semibold text-xs">{t.tier} <span className="font-normal opacity-75">({t.range})</span></p>
                <p className="text-xs opacity-75 mt-0.5">{t.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
