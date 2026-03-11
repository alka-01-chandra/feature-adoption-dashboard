'use client';

import { AnalysisMode } from '@/lib/types';
import { Filter, Users } from 'lucide-react';

interface FiltersProps {
  brandTypes: string[];
  selectedBrandTypes: string[];
  onBrandTypesChange: (types: string[]) => void;
  analysisMode: AnalysisMode;
  onAnalysisModeChange: (mode: AnalysisMode) => void;
  filteredCount: number;
  totalCount: number;
}

export default function Filters({
  brandTypes,
  selectedBrandTypes,
  onBrandTypesChange,
  analysisMode,
  onAnalysisModeChange,
  filteredCount,
  totalCount,
}: FiltersProps) {
  const toggleBrandType = (type: string) => {
    if (selectedBrandTypes.includes(type)) {
      onBrandTypesChange(selectedBrandTypes.filter(t => t !== type));
    } else {
      onBrandTypesChange([...selectedBrandTypes, type]);
    }
  };

  const clearAll = () => onBrandTypesChange([]);
  const selectAll = () => onBrandTypesChange([...brandTypes]);

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
      <div className="flex flex-wrap items-center gap-6">
        {/* Analysis Mode Toggle */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Analysis</span>
          <div className="flex bg-slate-100 rounded-lg p-0.5">
            <button
              onClick={() => onAnalysisModeChange('category')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                analysisMode === 'category'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              Event Category
            </button>
            <button
              onClick={() => onAnalysisModeChange('subCategory')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                analysisMode === 'subCategory'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              Event Sub-Category
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-slate-200" />

        {/* Brand Type Filter */}
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Brand Type</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {brandTypes.map(type => (
              <button
                key={type}
                onClick={() => toggleBrandType(type)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                  selectedBrandTypes.includes(type)
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400 hover:text-blue-600'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
          {selectedBrandTypes.length > 0 && (
            <button onClick={clearAll} className="text-xs text-slate-400 hover:text-red-500 underline ml-1">
              Clear
            </button>
          )}
          {selectedBrandTypes.length === 0 && brandTypes.length > 1 && (
            <button onClick={selectAll} className="text-xs text-slate-400 hover:text-blue-500 underline ml-1">
              Select all
            </button>
          )}
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-slate-200" />

        {/* Date Range — Informational */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Date Range</span>
          <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
            <span className="text-xs text-amber-700 font-medium">All-time (no timestamps in source)</span>
          </div>
        </div>

        {/* Brand count */}
        <div className="ml-auto flex items-center gap-1.5 text-slate-500">
          <Users className="w-4 h-4" />
          <span className="text-sm font-medium">
            {filteredCount === totalCount
              ? `${totalCount} brands`
              : `${filteredCount} / ${totalCount} brands`}
          </span>
        </div>
      </div>
    </div>
  );
}
