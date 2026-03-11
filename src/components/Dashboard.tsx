'use client';

import { useState, useEffect, useCallback } from 'react';
import { SheetData, AnalysisMode, BrandData } from '@/lib/types';
import { filterBrands, detectLowAdoptionBrands } from '@/lib/dataProcessing';
import KPISummary from './KPISummary';
import FeatureChart from './FeatureChart';
import BrandTable from './BrandTable';
import Top10Analysis from './Top10Analysis';
import SegmentationChart from './SegmentationChart';
import Filters from './Filters';
import { RefreshCw, AlertCircle, TrendingUp } from 'lucide-react';

// ─── Low Adoption Panel ───────────────────────────────────────────────────────

function LowAdoptionPanel({ brands, mode }: { brands: BrandData[]; mode: AnalysisMode }) {
  const flagged = detectLowAdoptionBrands(brands, mode);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-800">Low Adoption Alerts</h2>
        <p className="text-sm text-slate-500">
          {flagged.length} brands flagged for proactive outreach
        </p>
      </div>

      {flagged.length === 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
          <p className="text-green-700 font-medium">No low-adoption brands detected in current filter.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-slate-600 font-semibold">Brand</th>
                  <th className="text-left px-4 py-3 text-slate-600 font-semibold">Brand Type</th>
                  <th className="text-left px-4 py-3 text-slate-600 font-semibold">Urgency</th>
                  <th className="text-left px-4 py-3 text-slate-600 font-semibold">Reason</th>
                  <th className="text-left px-4 py-3 text-slate-600 font-semibold">Missing High-Value Features</th>
                  <th className="text-left px-4 py-3 text-slate-600 font-semibold">Recommend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {flagged.map(({ brand, reason, urgency, missingHighValueFeatures }) => (
                  <tr key={brand.name} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{brand.name}</td>
                    <td className="px-4 py-3 text-slate-500">{brand.brandType}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                        urgency === 'High'
                          ? 'bg-red-100 text-red-700 border-red-200'
                          : 'bg-amber-100 text-amber-700 border-amber-200'
                      }`}>{urgency}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 max-w-xs">{reason}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {missingHighValueFeatures.slice(0, 4).map(f => (
                          <span key={f} className="bg-red-50 text-red-600 border border-red-100 px-1.5 py-0.5 rounded text-xs">{f}</span>
                        ))}
                        {missingHighValueFeatures.length > 4 && (
                          <span className="text-slate-400 text-xs">+{missingHighValueFeatures.length - 4}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded text-xs font-medium">
                        {brand.recommendedNextFeature}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const [data, setData] = useState<SheetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null);

  // Filter & view state
  const [selectedBrandTypes, setSelectedBrandTypes] = useState<string[]>([]);
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('category');
  const [activeTab, setActiveTab] = useState<'overview' | 'brands' | 'top10' | 'segments' | 'lowadoption'>('overview');
  const [showNotes, setShowNotes] = useState(false);

  const loadData = useCallback(async (forceRefresh = false) => {
    try {
      const url = `/api/sheets${forceRefresh ? '?refresh=true' : ''}`;
      const res = await fetch(url);
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      const json: SheetData = await res.json();
      setData(json);
      setLastRefreshed(new Date(json.lastFetched).toLocaleString());
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
    }
  }, []);

  useEffect(() => {
    loadData().finally(() => setLoading(false));
    // Auto-refresh every 30 minutes
    const interval = setInterval(() => loadData(), 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData(true);
    setRefreshing(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-slate-600 font-medium">Loading feature adoption data…</p>
          <p className="text-slate-400 text-sm mt-1">Fetching live data from Google Sheets</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="bg-white rounded-2xl shadow p-8 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Failed to Load Data</h2>
          <p className="text-slate-500 text-sm mb-4">{error}</p>
          <button
            onClick={() => { setLoading(true); loadData().finally(() => setLoading(false)); }}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const filteredBrands = filterBrands(data.brands, selectedBrandTypes);

  const tabs = [
    { id: 'overview' as const, label: 'Overview' },
    { id: 'brands' as const, label: `All Brands (${filteredBrands.length})` },
    { id: 'top10' as const, label: 'Top 10 Analysis' },
    { id: 'segments' as const, label: 'Segmentation' },
    { id: 'lowadoption' as const, label: 'Low Adoption Alerts' },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Feature Adoption Dashboard</h1>
              <p className="text-xs text-slate-400">
                {data.brands.length} brands · Live from Google Sheets
                {lastRefreshed ? ` · Updated ${lastRefreshed}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowNotes(!showNotes)}
              className="text-xs text-slate-500 hover:text-slate-700 underline"
            >
              Data notes ({data.dataNotes.length})
            </button>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing…' : 'Refresh Data'}
            </button>
          </div>
        </div>

        {/* Data Notes Banner */}
        {showNotes && (
          <div className="bg-amber-50 border-t border-amber-200 px-6 py-3">
            <p className="text-xs font-semibold text-amber-700 mb-1">Data notes &amp; assumptions:</p>
            <ul className="text-xs text-amber-700 space-y-0.5 list-disc list-inside">
              {data.dataNotes.map((note, i) => <li key={i}>{note}</li>)}
            </ul>
          </div>
        )}
      </header>

      <div className="max-w-screen-2xl mx-auto px-6 py-6 space-y-6">
        {/* Filters */}
        <Filters
          brandTypes={data.brandTypes}
          selectedBrandTypes={selectedBrandTypes}
          onBrandTypesChange={setSelectedBrandTypes}
          analysisMode={analysisMode}
          onAnalysisModeChange={setAnalysisMode}
          filteredCount={filteredBrands.length}
          totalCount={data.brands.length}
        />

        {/* Nav Tabs */}
        <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 w-fit shadow-sm flex-wrap">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <KPISummary brands={filteredBrands} mode={analysisMode} data={data} />
            <FeatureChart brands={filteredBrands} mode={analysisMode} data={data} />
          </div>
        )}

        {activeTab === 'brands' && (
          <BrandTable brands={filteredBrands} mode={analysisMode} data={data} />
        )}

        {activeTab === 'top10' && (
          <Top10Analysis brands={filteredBrands} mode={analysisMode} data={data} />
        )}

        {activeTab === 'segments' && (
          <SegmentationChart brands={filteredBrands} mode={analysisMode} data={data} />
        )}

        {activeTab === 'lowadoption' && (
          <LowAdoptionPanel brands={filteredBrands} mode={analysisMode} />
        )}
      </div>
    </div>
  );
}
