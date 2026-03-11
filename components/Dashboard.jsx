'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Treemap,
} from 'recharts';

// ─── Icons (inline SVG to avoid dependency issues) ─────────────
const Icon = ({ name, size = 16, color = 'currentColor' }) => {
  const icons = {
    refresh: <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />,
    search: <><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></>,
    filter: <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />,
    chevronDown: <path d="m6 9 6 6 6-6" />,
    arrowUp: <path d="m5 12 7-7 7 7M12 19V5" />,
    arrowDown: <path d="M12 5v14m7-7-7 7-7-7" />,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    activity: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
    layers: <><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/></>,
    zap: <path d="M13 2 3 14h9l-1 10 10-12h-9l1-10z" />,
    alertTriangle: <><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4M12 17h.01"/></>,
    trophy: <><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></>,
    target: <><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></>,
    grid: <><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></>,
    barChart: <><line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {icons[name]}
    </svg>
  );
};

// ─── Tier colors ─────────────
const TIER_COLORS = {
  'Low Adoption': '#ef4444',
  'Emerging': '#f59e0b',
  'Healthy': '#22c55e',
  'Power User': '#8b5cf6',
};

const PIE_COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#8b5cf6', '#3b82f6', '#ec4899'];

// ─── Main Dashboard ─────────────
export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState('category');
  const [brandType, setBrandType] = useState('All');
  const [dateRange, setDateRange] = useState('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortCol, setSortCol] = useState('adoptionScore');
  const [sortDir, setSortDir] = useState('desc');
  const [activeSection, setActiveSection] = useState('overview');
  const [expandedBrand, setExpandedBrand] = useState(null);
  
  // Compute date params
  const dateParams = useMemo(() => {
    const now = new Date();
    switch (dateRange) {
      case '30d': {
        const start = new Date(now); start.setDate(start.getDate() - 30);
        return { startDate: start.toISOString().split('T')[0], endDate: now.toISOString().split('T')[0] };
      }
      case 'quarter': {
        const start = new Date(now); start.setMonth(start.getMonth() - 3);
        return { startDate: start.toISOString().split('T')[0], endDate: now.toISOString().split('T')[0] };
      }
      case '6m': {
        const start = new Date(now); start.setMonth(start.getMonth() - 6);
        return { startDate: start.toISOString().split('T')[0], endDate: now.toISOString().split('T')[0] };
      }
      case 'custom':
        return { startDate: customStart, endDate: customEnd };
      default:
        return { startDate: '', endDate: '' };
    }
  }, [dateRange, customStart, customEnd]);
  
  const fetchData = useCallback(async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        mode,
        brandType,
        ...dateParams,
        ...(refresh ? { refresh: 'true' } : {}),
      });
      const res = await fetch(`/api/data?${params}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [mode, brandType, dateParams]);
  
  useEffect(() => { fetchData(); }, [fetchData]);
  
  // Sorted/filtered brand list
  const brandList = useMemo(() => {
    if (!data?.analysis?.brandAnalysis) return [];
    let list = [...data.analysis.brandAnalysis];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(b => b.brand.toLowerCase().includes(q) || b.brandType.toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      const valA = a[sortCol] ?? '';
      const valB = b[sortCol] ?? '';
      if (typeof valA === 'number') return sortDir === 'asc' ? valA - valB : valB - valA;
      return sortDir === 'asc' ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
    });
    return list;
  }, [data, searchQuery, sortCol, sortDir]);
  
  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  };
  
  const analysis = data?.analysis;
  const meta = data?.meta;
  const schema = data?.schema;
  
  // ─── Loading State ─────────────
  if (loading && !data) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <div style={{ width: 40, height: 40, border: '3px solid #1e293b', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <p style={{ color: '#64748b', fontSize: 14 }}>Loading dashboard data...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }
  
  // ─── Error State ─────────────
  if (error && !data) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 24 }}>
        <div style={{ fontSize: 48 }}>⚠</div>
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>Data Fetch Error</h2>
        <p style={{ color: '#94a3b8', fontSize: 14, maxWidth: 500, textAlign: 'center' }}>{error}</p>
        <p style={{ color: '#64748b', fontSize: 13, maxWidth: 500, textAlign: 'center' }}>
          Make sure the Google Sheet is either published to web (File → Share → Publish to web), 
          or configure a Google API key / service account in your environment variables.
        </p>
        <button onClick={() => fetchData(true)} style={{ marginTop: 8, padding: '8px 20px', background: '#3b82f6', color: '#fff', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13 }}>
          Retry
        </button>
      </div>
    );
  }
  
  // ─── NAV ITEMS ─────────────
  const navItems = [
    { id: 'overview', label: 'Overview', icon: 'grid' },
    { id: 'features', label: 'Features', icon: 'layers' },
    { id: 'brands', label: 'Brands', icon: 'users' },
    { id: 'top10', label: 'Top 10', icon: 'trophy' },
    { id: 'segments', label: 'Segments', icon: 'target' },
  ];
  
  const brandTypes = analysis?.allBrandTypes || [];
  const kpis = analysis?.kpis || {};

  return (
    <div style={{ minHeight: '100vh', background: '#0a0f1a' }}>
      {/* ─── HEADER ─── */}
      <header style={{ borderBottom: '1px solid #1e293b', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: '#0a0f1a', zIndex: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #0d3a25, #10b981)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700 }}>F</div>
          <div>
            <h1 style={{ fontSize: 15, fontWeight: 600, margin: 0, letterSpacing: '-0.01em' }}>Feature Adoption Dashboard</h1>
            <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>FERMÀT Platform Analytics</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {meta?.lastFetch && (
            <span style={{ fontSize: 11, color: '#475569' }}>
              {meta.fromCache ? '● cached' : '● live'} · {new Date(meta.lastFetch).toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={() => fetchData(true)}
            disabled={loading}
            style={{ padding: '6px 14px', background: '#1e293b', border: '1px solid #334155', borderRadius: 6, color: '#94a3b8', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: loading ? 0.5 : 1 }}
          >
            <Icon name="refresh" size={13} /> {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </header>
      
      {/* ─── FILTERS BAR ─── */}
      <div style={{ borderBottom: '1px solid #1e293b', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        {/* Analysis Mode Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: 4 }}>View</span>
          {['category', 'subcategory'].map(m => (
            <button key={m} className={`filter-pill ${mode === m ? 'active' : ''}`} onClick={() => setMode(m)}>
              {m === 'category' ? 'Event Category' : 'Sub-Category'}
            </button>
          ))}
        </div>
        
        <div style={{ width: 1, height: 24, background: '#1e293b' }} />
        
        {/* Brand Type Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: 4 }}>Segment</span>
          <button className={`filter-pill ${brandType === 'All' ? 'active' : ''}`} onClick={() => setBrandType('All')}>All</button>
          {brandTypes.map(bt => (
            <button key={bt} className={`filter-pill ${brandType === bt ? 'active' : ''}`} onClick={() => setBrandType(bt)}>
              {bt}
            </button>
          ))}
        </div>
        
        <div style={{ width: 1, height: 24, background: '#1e293b' }} />
        
        {/* Date Range Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: 4 }}>Period</span>
          {[
            { id: 'all', label: 'All Time' },
            { id: '30d', label: '30 Days' },
            { id: 'quarter', label: 'Quarter' },
            { id: '6m', label: '6 Months' },
            { id: 'custom', label: 'Custom' },
          ].map(d => (
            <button key={d.id} className={`filter-pill ${dateRange === d.id ? 'active' : ''}`} onClick={() => setDateRange(d.id)}>
              {d.label}
            </button>
          ))}
          {dateRange === 'custom' && (
            <div style={{ display: 'flex', gap: 6, marginLeft: 4 }}>
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 6, padding: '4px 8px', color: '#f1f5f9', fontSize: 12 }} />
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 6, padding: '4px 8px', color: '#f1f5f9', fontSize: 12 }} />
            </div>
          )}
        </div>
      </div>
      
      {/* ─── NAV TABS ─── */}
      <div style={{ borderBottom: '1px solid #1e293b', padding: '0 24px', display: 'flex', gap: 0 }}>
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveSection(item.id)}
            style={{
              padding: '12px 20px',
              background: 'none',
              border: 'none',
              borderBottom: activeSection === item.id ? '2px solid #3b82f6' : '2px solid transparent',
              color: activeSection === item.id ? '#f1f5f9' : '#64748b',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.2s',
            }}
          >
            <Icon name={item.icon} size={14} /> {item.label}
          </button>
        ))}
      </div>
      
      {/* ─── CONTENT ─── */}
      <main style={{ padding: '24px', maxWidth: 1440, margin: '0 auto' }}>
        {/* KPI SUMMARY - always visible */}
        {analysis && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
            {[
              { label: 'Total Brands', value: kpis.totalBrands, icon: 'users', color: '#3b82f6' },
              { label: 'Active Brands', value: kpis.activeBrands, icon: 'activity', color: '#10b981' },
              { label: 'Features Tracked', value: kpis.totalFeatures, icon: 'layers', color: '#8b5cf6' },
              { label: 'Avg Adoption', value: `${kpis.avgAdoptionScore}%`, icon: 'target', color: '#f59e0b' },
              { label: 'Low Adoption', value: kpis.lowAdoptionCount, icon: 'alertTriangle', color: '#ef4444' },
              { label: 'Power Users', value: kpis.highAdoptionCount, icon: 'zap', color: '#22c55e' },
            ].map((kpi, i) => (
              <div key={kpi.label} className={`card-hover animate-fade-up stagger-${i + 1}`}
                style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 12, padding: '18px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{kpi.label}</span>
                  <div style={{ width: 28, height: 28, background: `${kpi.color}15`, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={kpi.icon} size={14} color={kpi.color} />
                  </div>
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#f1f5f9', lineHeight: 1 }}>{kpi.value}</div>
              </div>
            ))}
          </div>
        )}
        
        {/* ─── OVERVIEW SECTION ─── */}
        {activeSection === 'overview' && analysis && <OverviewSection analysis={analysis} />}
        
        {/* ─── FEATURES SECTION ─── */}
        {activeSection === 'features' && analysis && <FeaturesSection analysis={analysis} />}
        
        {/* ─── BRANDS SECTION ─── */}
        {activeSection === 'brands' && analysis && (
          <BrandsSection
            brandList={brandList}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            sortCol={sortCol}
            sortDir={sortDir}
            handleSort={handleSort}
            expandedBrand={expandedBrand}
            setExpandedBrand={setExpandedBrand}
          />
        )}
        
        {/* ─── TOP 10 SECTION ─── */}
        {activeSection === 'top10' && analysis && <Top10Section analysis={analysis} />}
        
        {/* ─── SEGMENTS SECTION ─── */}
        {activeSection === 'segments' && analysis && <SegmentsSection analysis={analysis} />}
      </main>
      
      {/* Footer */}
      <footer style={{ borderTop: '1px solid #1e293b', padding: '16px 24px', textAlign: 'center' }}>
        <p style={{ fontSize: 11, color: '#475569', margin: 0 }}>
          FERMÀT Feature Adoption Dashboard · Data refreshes every 5 min · Mode: {mode} · 
          {schema ? ` ${schema.totalRows} rows · ${schema.category?.brandCount || '?'} brands in category tab` : ''}
        </p>
      </footer>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// OVERVIEW SECTION
// ═══════════════════════════════════════════════════════════════
function OverviewSection({ analysis }) {
  const { featureStats, brandAnalysis } = analysis;
  
  // Top 8 most used features for bar chart
  const topFeatures = featureStats.slice(0, 8).map(f => ({
    name: f.feature.length > 20 ? f.feature.slice(0, 18) + '…' : f.feature,
    fullName: f.feature,
    brands: f.brandsUsing,
    percentage: f.brandPercentage,
  }));
  
  // Tier distribution for pie chart
  const tierDist = {};
  brandAnalysis.forEach(b => { tierDist[b.tier] = (tierDist[b.tier] || 0) + 1; });
  const tierData = Object.entries(tierDist).map(([tier, count]) => ({ name: tier, value: count, color: TIER_COLORS[tier] || '#64748b' }));
  
  // Adoption score distribution
  const adoptionBuckets = [
    { range: '0-10%', count: 0 }, { range: '11-25%', count: 0 }, { range: '26-50%', count: 0 },
    { range: '51-75%', count: 0 }, { range: '76-100%', count: 0 },
  ];
  brandAnalysis.forEach(b => {
    if (b.adoptionScore <= 10) adoptionBuckets[0].count++;
    else if (b.adoptionScore <= 25) adoptionBuckets[1].count++;
    else if (b.adoptionScore <= 50) adoptionBuckets[2].count++;
    else if (b.adoptionScore <= 75) adoptionBuckets[3].count++;
    else adoptionBuckets[4].count++;
  });
  
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
      {/* Most Used Features */}
      <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 12, padding: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="barChart" size={16} color="#3b82f6" /> Most Used Features (% of brands)
        </h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={topFeatures} layout="vertical" margin={{ left: 10, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fill: '#64748b', fontSize: 11 }} />
            <YAxis type="category" dataKey="name" width={130} tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <RTooltip
              contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
              formatter={(v, n, p) => [`${v}% (${p.payload.brands} brands)`, 'Adoption']}
              labelFormatter={l => topFeatures.find(f => f.name === l)?.fullName || l}
            />
            <Bar dataKey="percentage" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      {/* Tier Distribution */}
      <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 12, padding: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="target" size={16} color="#8b5cf6" /> Adoption Tier Distribution
        </h3>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <ResponsiveContainer width="55%" height={220}>
            <PieChart>
              <Pie data={tierData} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3} dataKey="value">
                {tierData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <RTooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {tierData.map(t => (
              <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: t.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: '#94a3b8', flex: 1 }}>{t.name}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>{t.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Adoption Score Distribution */}
      <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 12, padding: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="activity" size={16} color="#10b981" /> Adoption Score Distribution
        </h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={adoptionBuckets} margin={{ left: 0, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="range" tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
            <RTooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} barSize={36}>
              {adoptionBuckets.map((_, i) => (
                <Cell key={i} fill={['#ef4444', '#f59e0b', '#eab308', '#22c55e', '#8b5cf6'][i]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      {/* Least Used Features */}
      <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 12, padding: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="alertTriangle" size={16} color="#ef4444" /> Least Used Features
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[...featureStats].reverse().slice(0, 8).map(f => (
            <div key={f.feature} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>{f.feature}</span>
                  <span style={{ fontSize: 11, color: '#64748b' }}>{f.brandPercentage}% of brands</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-bar-fill" style={{ width: `${Math.max(f.brandPercentage, 2)}%`, background: f.isHighValue ? '#ef4444' : '#475569' }} />
                </div>
              </div>
              {f.isHighValue && (
                <span style={{ fontSize: 9, padding: '2px 6px', background: '#7f1d1d', color: '#fca5a5', borderRadius: 4, fontWeight: 600, whiteSpace: 'nowrap' }}>HIGH VALUE</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// FEATURES SECTION
// ═══════════════════════════════════════════════════════════════
function FeaturesSection({ analysis }) {
  const { featureStats } = analysis;
  const [featureSearch, setFeatureSearch] = useState('');
  
  const filtered = featureSearch
    ? featureStats.filter(f => f.feature.toLowerCase().includes(featureSearch.toLowerCase()))
    : featureStats;
  
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Feature Usage Overview</h3>
        <div style={{ position: 'relative' }}>
          <Icon name="search" size={14} color="#64748b" />
          <input
            className="search-input"
            placeholder="Search features..."
            value={featureSearch}
            onChange={e => setFeatureSearch(e.target.value)}
            style={{ paddingLeft: 12, width: 220 }}
          />
        </div>
      </div>
      
      <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ maxHeight: 600, overflowY: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Feature</th>
                <th>Brands Using</th>
                <th style={{ width: 200 }}>Adoption %</th>
                <th>Total Events</th>
                <th>Avg per Brand</th>
                <th>Priority</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(f => (
                <tr key={f.feature}>
                  <td style={{ fontWeight: 500, color: '#f1f5f9' }}>{f.feature}</td>
                  <td>{f.brandsUsing}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="progress-bar" style={{ flex: 1 }}>
                        <div className="progress-bar-fill" style={{
                          width: `${f.brandPercentage}%`,
                          background: f.brandPercentage > 75 ? '#22c55e' : f.brandPercentage > 50 ? '#f59e0b' : f.brandPercentage > 25 ? '#3b82f6' : '#ef4444'
                        }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 500, minWidth: 36 }}>{f.brandPercentage}%</span>
                    </div>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{f.totalUsage.toLocaleString()}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{f.avgUsage.toLocaleString()}</td>
                  <td>
                    {f.isHighValue && <span style={{ fontSize: 10, padding: '2px 8px', background: '#1e3a5f', color: '#93c5fd', borderRadius: 4, fontWeight: 600 }}>HIGH VALUE</span>}
                    {!f.isHighValue && f.brandPercentage < 30 && <span style={{ fontSize: 10, padding: '2px 8px', background: '#422006', color: '#fbbf24', borderRadius: 4, fontWeight: 600 }}>LOW ADOPT</span>}
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

// ═══════════════════════════════════════════════════════════════
// BRANDS SECTION
// ═══════════════════════════════════════════════════════════════
function BrandsSection({ brandList, searchQuery, setSearchQuery, sortCol, sortDir, handleSort, expandedBrand, setExpandedBrand }) {
  const SortArrow = ({ col }) => {
    if (sortCol !== col) return null;
    return <Icon name={sortDir === 'asc' ? 'arrowUp' : 'arrowDown'} size={12} />;
  };
  
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Brand Adoption Table ({brandList.length} brands)</h3>
        <div style={{ position: 'relative' }}>
          <input
            className="search-input"
            placeholder="Search brands..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: 240 }}
          />
        </div>
      </div>
      
      <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ maxHeight: 700, overflowY: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('brand')}>Brand <SortArrow col="brand" /></th>
                <th onClick={() => handleSort('brandType')}>Type <SortArrow col="brandType" /></th>
                <th onClick={() => handleSort('sessions')}>Activity <SortArrow col="sessions" /></th>
                <th onClick={() => handleSort('featureCount')}>Features <SortArrow col="featureCount" /></th>
                <th onClick={() => handleSort('adoptionScore')} style={{ width: 170 }}>Adoption <SortArrow col="adoptionScore" /></th>
                <th onClick={() => handleSort('tier')}>Tier <SortArrow col="tier" /></th>
                <th>Recommended</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {brandList.map(b => (
                <>
                  <tr key={b.brand} style={{ cursor: 'pointer' }} onClick={() => setExpandedBrand(expandedBrand === b.brand ? null : b.brand)}>
                    <td style={{ fontWeight: 600, color: '#f1f5f9' }}>{b.brand}</td>
                    <td><span style={{ fontSize: 11, padding: '2px 8px', background: '#1e293b', borderRadius: 4, color: '#94a3b8' }}>{b.brandType}</span></td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{b.sessions.toLocaleString()}</td>
                    <td>
                      <span style={{ color: '#f1f5f9', fontWeight: 500 }}>{b.featureCount}</span>
                      <span style={{ color: '#475569' }}>/{b.totalFeatures}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="progress-bar" style={{ flex: 1 }}>
                          <div className="progress-bar-fill" style={{ width: `${b.adoptionScore}%`, background: b.tierColor }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: b.tierColor, minWidth: 36 }}>{b.adoptionScore}%</span>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 12, fontWeight: 600, background: `${b.tierColor}20`, color: b.tierColor }}>
                        {b.tier}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: '#f59e0b', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {b.recommendedFeature || '—'}
                    </td>
                    <td>
                      <Icon name="chevronDown" size={14} color="#475569" />
                    </td>
                  </tr>
                  {expandedBrand === b.brand && (
                    <tr key={`${b.brand}-detail`}>
                      <td colSpan={8} style={{ padding: 0 }}>
                        <BrandDetail brand={b} />
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Brand Detail Expansion ─────────────
function BrandDetail({ brand: b }) {
  return (
    <div style={{ padding: '16px 20px', background: '#0f172a', borderTop: '1px solid #1e293b' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
        {/* Usage Pattern */}
        <div>
          <h4 style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.05em' }}>Usage Pattern</h4>
          <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 6px' }}>
            Pattern: <strong style={{ color: '#f1f5f9' }}>{b.usagePattern}</strong>
          </p>
          <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 6px' }}>
            Avg events/feature: <strong style={{ color: '#f1f5f9' }}>{b.avgPerFeature}</strong>
          </p>
          {b.cvr && <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>CVR: <strong style={{ color: '#f1f5f9' }}>{b.cvr}</strong></p>}
          {!b.cvr && <p style={{ fontSize: 12, color: '#475569', fontStyle: 'italic', margin: 0 }}>CVR: requires external source (GA4/Looker)</p>}
        </div>
        
        {/* Features Used */}
        <div>
          <h4 style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.05em' }}>Features Used ({b.featuresUsed.length})</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {b.featuresUsed.map(f => (
              <span key={f} style={{ fontSize: 11, padding: '2px 8px', background: '#1e3a5f', color: '#93c5fd', borderRadius: 4 }}>{f}</span>
            ))}
          </div>
        </div>
        
        {/* Features NOT Used */}
        <div>
          <h4 style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.05em' }}>Not Using ({b.featuresNotUsed.length})</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {b.featuresNotUsed.slice(0, 12).map(f => (
              <span key={f} style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 4,
                background: b.highValueMissing.includes(f) ? '#7f1d1d' : '#1e293b',
                color: b.highValueMissing.includes(f) ? '#fca5a5' : '#64748b',
              }}>{f}</span>
            ))}
            {b.featuresNotUsed.length > 12 && <span style={{ fontSize: 11, color: '#475569' }}>+{b.featuresNotUsed.length - 12} more</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TOP 10 SECTION
// ═══════════════════════════════════════════════════════════════
function Top10Section({ analysis }) {
  const { top10, commonTop10Features } = analysis;
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
        {/* Top 10 Brand Cards */}
        <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 12, padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="trophy" size={16} color="#f59e0b" /> Top 10 Brands (by Activity × Adoption)
          </h3>
          <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 16px' }}>
            Ranked by sessions weighted by adoption score. CVR data requires GA4/Looker integration.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {top10.map((b, i) => (
              <div key={b.brand} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px', background: i < 3 ? '#1a2332' : 'transparent', borderRadius: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: i < 3 ? '#f59e0b' : '#475569', minWidth: 24, textAlign: 'center' }}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                </span>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>{b.brand}</span>
                  <span style={{ fontSize: 11, color: '#475569', marginLeft: 8 }}>{b.brandType}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#f1f5f9' }}>{b.sessions.toLocaleString()}</div>
                    <div style={{ fontSize: 10, color: '#475569' }}>activity</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: b.tierColor }}>{b.adoptionScore}%</div>
                    <div style={{ fontSize: 10, color: '#475569' }}>adoption</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>{b.featureCount}/{b.totalFeatures}</div>
                    <div style={{ fontSize: 10, color: '#475569' }}>features</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Common Features among Top 10 */}
        <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 12, padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="zap" size={16} color="#22c55e" /> Power User Feature Bundle
          </h3>
          <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 16px' }}>
            Features used by 60%+ of top 10 brands — a potential "best practices" bundle.
          </p>
          {commonTop10Features.length === 0 && (
            <p style={{ fontSize: 13, color: '#475569', fontStyle: 'italic' }}>No single feature is used by 60%+ of top brands — adoption is highly varied.</p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {commonTop10Features.map(f => (
              <div key={f.feature}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: '#f1f5f9', fontWeight: 500 }}>{f.feature}</span>
                  <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 600 }}>{f.count}/10 ({f.percentage}%)</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-bar-fill" style={{ width: `${f.percentage}%`, background: '#22c55e' }} />
                </div>
              </div>
            ))}
          </div>
          
          {/* CVR Note */}
          <div style={{ marginTop: 20, padding: 12, background: '#1a1a2e', border: '1px solid #312e81', borderRadius: 8 }}>
            <p style={{ fontSize: 11, color: '#a5b4fc', margin: 0, lineHeight: 1.5 }}>
              <strong>Note on CVR:</strong> Conversion rate data is not available in the source sheet. 
              Top 10 ranking uses activity × adoption as a proxy. To include CVR, connect GA4 or Looker Studio as an additional data source.
            </p>
          </div>
        </div>
      </div>
      
      {/* Feature Heatmap for Top 10 */}
      <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 12, padding: 20, overflowX: 'auto' }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="grid" size={16} color="#8b5cf6" /> Feature Usage Heatmap — Top 10
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 700 }}>
            <thead>
              <tr>
                <th style={{ padding: '6px 10px', fontSize: 11, color: '#64748b', textAlign: 'left', position: 'sticky', left: 0, background: '#111827', zIndex: 2 }}>Brand</th>
                {analysis.allFeatures.map(f => (
                  <th key={f} style={{ padding: '6px 4px', fontSize: 9, color: '#475569', textAlign: 'center', maxWidth: 60, writingMode: 'vertical-lr', height: 100 }}>
                    {f}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {top10.map(b => (
                <tr key={b.brand}>
                  <td style={{ padding: '4px 10px', fontSize: 12, fontWeight: 500, color: '#f1f5f9', position: 'sticky', left: 0, background: '#111827', zIndex: 1, whiteSpace: 'nowrap' }}>{b.brand}</td>
                  {analysis.allFeatures.map(f => {
                    const used = b.featuresUsed.includes(f);
                    const count = b.featureMap[f] || 0;
                    return (
                      <td key={f} style={{ padding: 2, textAlign: 'center' }}>
                        <div className="tooltip-container" style={{
                          width: 20, height: 20, borderRadius: 3, margin: '0 auto',
                          background: used ? (count > 100 ? '#22c55e' : count > 10 ? '#3b82f6' : '#1e3a5f') : '#1a1a2e',
                        }}>
                          <div className="tooltip">{f}: {count.toLocaleString()} events</div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SEGMENTS SECTION
// ═══════════════════════════════════════════════════════════════
function SegmentsSection({ analysis }) {
  const { segmentation } = analysis;
  const segments = Object.entries(segmentation);
  
  // Bar chart data for segment comparison
  const segmentComparison = segments.map(([name, data]) => ({
    name: name.length > 16 ? name.slice(0, 14) + '…' : name,
    fullName: name,
    avgAdoption: data.avgAdoption,
    avgFeatures: data.avgFeatures,
    brandCount: data.brandCount,
  }));
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Segment Comparison Chart */}
      <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 12, padding: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="target" size={16} color="#3b82f6" /> Adoption by Brand Segment
        </h3>
        {segmentComparison.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={segmentComparison} margin={{ left: 10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
              <RTooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                labelFormatter={l => segmentComparison.find(s => s.name === l)?.fullName || l}
              />
              <Bar dataKey="avgAdoption" name="Avg Adoption %" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={32} />
              <Bar dataKey="avgFeatures" name="Avg Features" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={32} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p style={{ color: '#475569', fontStyle: 'italic' }}>No segment data available. Ensure brandType column exists in the sheet.</p>
        )}
      </div>
      
      {/* Segment Detail Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
        {segments.map(([name, seg]) => (
          <div key={name} style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 12, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 14 }}>
              <div>
                <h4 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{name}</h4>
                <p style={{ fontSize: 12, color: '#64748b', margin: '2px 0 0' }}>{seg.brandCount} brands · {seg.activeBrands} active</p>
              </div>
              <span style={{ fontSize: 22, fontWeight: 700, color: seg.avgAdoption >= 50 ? '#22c55e' : seg.avgAdoption >= 25 ? '#f59e0b' : '#ef4444' }}>
                {seg.avgAdoption}%
              </span>
            </div>
            
            {/* Top Features */}
            <div style={{ marginBottom: 12 }}>
              <h5 style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', marginBottom: 6, letterSpacing: '0.05em' }}>Top Features</h5>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {seg.topFeatures.map(f => (
                  <span key={f.feature} style={{ fontSize: 10, padding: '2px 8px', background: '#1e3a5f', color: '#93c5fd', borderRadius: 4 }}>
                    {f.feature} ({f.percentage}%)
                  </span>
                ))}
              </div>
            </div>
            
            {/* Underutilized */}
            <div>
              <h5 style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', marginBottom: 6, letterSpacing: '0.05em' }}>Underutilized</h5>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {seg.underutilized.map(f => (
                  <span key={f.feature} style={{
                    fontSize: 10, padding: '2px 8px', borderRadius: 4,
                    background: f.isHighValue ? '#7f1d1d' : '#1e293b',
                    color: f.isHighValue ? '#fca5a5' : '#64748b',
                  }}>
                    {f.feature} ({f.percentage}%)
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
