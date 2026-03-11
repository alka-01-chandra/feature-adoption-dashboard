'use client';

import { useState, Fragment } from 'react';
import { BrandData, AnalysisMode, SheetData } from '@/lib/types';
import {
  sortBrands, getTier, getAdoptionPct, getFeaturesUsed, getFeaturesNotUsed,
  tierColor, tierLabel, tierDotColor, exportBrandsCSV,
  SortField, SortDir,
} from '@/lib/dataProcessing';
import { Search, ArrowUpDown, Download, ChevronUp, ChevronDown } from 'lucide-react';

interface Props {
  brands: BrandData[];
  mode: AnalysisMode;
  data: SheetData;
}

const PAGE_SIZE = 50;

export default function BrandTable({ brands, mode, data }: Props) {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('adoptionPct');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);
  const [expandedBrand, setExpandedBrand] = useState<string | null>(null);

  // Filter by search
  const filtered = brands.filter(b =>
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    (b.brandType || '').toLowerCase().includes(search.toLowerCase())
  );

  // Sort
  const sorted = sortBrands(filtered, sortField, sortDir, mode);

  // Paginate
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
    setPage(1);
  };

  const handleExport = () => {
    const csv = exportBrandsCSV(sorted, mode);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `feature-adoption-${mode}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-slate-300" />;
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 text-blue-600" />
      : <ChevronDown className="w-3 h-3 text-blue-600" />;
  };

  const ColHeader = ({ field, label }: { field: SortField; label: string }) => (
    <th
      className="text-left px-4 py-3 text-slate-600 font-semibold cursor-pointer hover:text-blue-600 select-none whitespace-nowrap"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        <SortIcon field={field} />
      </div>
    </th>
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search brands…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-400 bg-white"
          />
        </div>
        <span className="text-sm text-slate-500">{sorted.length} brands</span>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 text-sm text-slate-600 border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50 bg-white"
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <ColHeader field="name" label="Brand Name" />
                <ColHeader field="brandType" label="Brand Type" />
                <ColHeader field="totalEvents" label="Total Events" />
                <ColHeader field="featuresUsed" label="Features Used" />
                <th className="text-left px-4 py-3 text-slate-600 font-semibold">Features Not Used</th>
                <ColHeader field="adoptionPct" label="Adoption %" />
                <ColHeader field="tier" label="Tier" />
                <th className="text-left px-4 py-3 text-slate-600 font-semibold">Next Recommendation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginated.map(brand => {
                const tier = getTier(brand, mode);
                const pct = getAdoptionPct(brand, mode);
                const used = getFeaturesUsed(brand, mode);
                const notUsed = getFeaturesNotUsed(brand, mode);
                const isExpanded = expandedBrand === brand.name;

                return (
                  <Fragment key={brand.name}>
                    <tr
                      className="hover:bg-slate-50 cursor-pointer"
                      onClick={() => setExpandedBrand(isExpanded ? null : brand.name)}
                    >
                      <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${tierDotColor(tier)}`} />
                          {brand.name}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{brand.brandType || '—'}</td>
                      <td className="px-4 py-3 text-slate-700 font-mono whitespace-nowrap">
                        {brand.totalEvents.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-semibold text-slate-700">{used.length}</span>
                        <span className="text-slate-400 text-xs ml-1">/ {used.length + notUsed.length}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-500">{notUsed.length}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-blue-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="font-semibold text-slate-700 text-xs">{pct}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${tierColor(tier)}`}>
                          {tier}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded text-xs">
                          {brand.recommendedNextFeature}
                        </span>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-blue-50/30">
                        <td colSpan={8} className="px-6 py-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs font-semibold text-green-700 mb-1.5">
                                Features Used ({used.length})
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {used.map(f => (
                                  <span key={f} className="bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded text-xs">
                                    {f}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-red-600 mb-1.5">
                                Features Not Used ({notUsed.length})
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {notUsed.map(f => (
                                  <span key={f} className="bg-red-50 text-red-600 border border-red-100 px-2 py-0.5 rounded text-xs">
                                    {f}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
            <span className="text-xs text-slate-500">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sorted.length)} of {sorted.length}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-xs border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-white"
              >
                Prev
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const pg = i + 1;
                return (
                  <button
                    key={pg}
                    onClick={() => setPage(pg)}
                    className={`px-3 py-1 text-xs border rounded-lg ${
                      pg === page ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 hover:bg-white'
                    }`}
                  >
                    {pg}
                  </button>
                );
              })}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 text-xs border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-white"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
