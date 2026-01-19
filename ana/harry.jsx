import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ScatterChart, Scatter, Cell, CartesianGrid } from 'recharts';
import { Upload, Users, Eye, Clock, FileText, TrendingUp, UserCheck, Filter, X, ChevronDown, ChevronUp, Search, Square, CheckSquare, Type, Hash, AlertTriangle, Zap, BarChart3, Activity, Target } from 'lucide-react';
import Papa from 'papaparse';

const cleanAuthorField = (authorString) => {
  if (!authorString || typeof authorString !== 'string') return [];
  const publicationPatterns = [/montreal\s*gazette/i, /montrealgazette/i, /toronto\s*star/i, /globe\s*and\s*mail/i, /national\s*post/i, /reuters/i, /associated\s*press/i, /bloomberg/i, /postmedia/i, /staff\s*writer/i, /^\s*staff\s*$/i];
  const potentialAuthors = authorString.split(',').map(a => a.trim());
  return potentialAuthors.filter(author => {
    if (!author || author.length < 2) return false;
    for (const pattern of publicationPatterns) { if (pattern.test(author)) return false; }
    return /^[a-zA-ZÀ-ÿ\-']+\s+[a-zA-ZÀ-ÿ\-']+/.test(author);
  }).map(author => author.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ').trim());
};

const cleanNumericField = (value) => {
  if (value === null || value === undefined || value === '') return 0;
  const num = parseFloat(String(value).replace(/[^0-9.-]/g, ''));
  return isNaN(num) ? 0 : num;
};

const extractKeywords = (title) => {
  if (!title || typeof title !== 'string') return [];
  return [...new Set(title.toLowerCase().replace(/[^a-zA-Z0-9\s'-]/g, ' ').split(/\s+/).filter(w => w.length > 1))];
};

const cleanData = (rawData) => {
  return rawData.map((row, index) => {
    const findCol = (names) => { for (const n of names) { const k = Object.keys(row).find(x => x.toLowerCase().replace(/[^a-z]/g, '').includes(n.replace(/[^a-z]/g, ''))); if (k) return row[k]; } return null; };
    const authors = cleanAuthorField(findCol(['author', 'writer', 'byline']) || '');
    const title = findCol(['title', 'headline']) || 'Untitled';
    const visitors = cleanNumericField(findCol(['visitors']));
    const views = cleanNumericField(findCol(['views']));
    const avgMinutes = cleanNumericField(findCol(['avgminutes', 'avg.minutes', 'avgmin']));
    return {
      id: index, title, titleLength: title.length, wordCount: title.split(/\s+/).filter(w => w.length > 0).length,
      keywords: extractKeywords(title), authors, visitors, views, avgMinutes,
      viewsPerVisitor: visitors > 0 ? views / visitors : 0,
      engagementEfficiency: views > 0 ? (avgMinutes * visitors) / views : 0,
      section: findCol(['section', 'category']) || 'Uncategorized',
    };
  }).filter(row => row.views > 0 || row.visitors > 0);
};

const MetricCard = ({ icon: Icon, label, value, subValue, color }) => (
  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '1.5rem', display: 'flex', gap: '1rem' }}>
    <div style={{ width: 44, height: 44, background: 'rgba(255,255,255,0.05)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}><Icon size={20} /></div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: '1.5rem', fontWeight: 600, fontFamily: 'monospace', color: '#fff' }}>{value}</span>
      <span style={{ fontSize: '0.8rem', color: '#888', textTransform: 'uppercase' }}>{label}</span>
      {subValue && <span style={{ fontSize: '0.75rem', color: '#555' }}>{subValue}</span>}
    </div>
  </div>
);

const AuthorScatterPlot = ({ data, authorStats }) => {
  const [selected, setSelected] = useState([]);
  const [xAxis, setXAxis] = useState('visitors');
  const [yAxis, setYAxis] = useState('avgMinutes');
  const [search, setSearch] = useState('');
  const colors = ['#E63946', '#2A9D8F', '#F4A261'];
  const opts = [{ v: 'visitors', l: 'Visitors' }, { v: 'views', l: 'Views' }, { v: 'avgMinutes', l: 'Avg Min/Visitor' }, { v: 'viewsPerVisitor', l: 'Views/Visitor' }, { v: 'wordCount', l: 'Word Count' }, { v: 'titleLength', l: 'Title Length' }];
  
  const toggle = (name) => setSelected(prev => prev.includes(name) ? prev.filter(a => a !== name) : prev.length >= 3 ? [...prev.slice(1), name] : [...prev, name]);
  const chartData = selected.flatMap((author, idx) => data.filter(a => a.authors.includes(author)).map(a => ({ x: a[xAxis] || 0, y: a[yAxis] || 0, author, colorIdx: idx, title: a.title.substring(0, 40) })));
  const filtered = authorStats.filter(a => a.name.toLowerCase().includes(search.toLowerCase())).slice(0, 30);

  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 20, padding: '1.5rem', marginBottom: '2rem' }}>
      <h3 style={{ fontSize: '1rem', fontWeight: 500, marginBottom: '1.5rem', color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}><Target size={18} style={{ color: '#E63946' }} />Author Scatter Plot</h3>
      <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#888', fontSize: '0.8rem' }}>X:</span>
          <select value={xAxis} onChange={e => setXAxis(e.target.value)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '0.5rem', borderRadius: 6 }}>
            {opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#888', fontSize: '0.8rem' }}>Y:</span>
          <select value={yAxis} onChange={e => setYAxis(e.target.value)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '0.5rem', borderRadius: 6 }}>
            {opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {selected.map((a, i) => (
          <button key={a} onClick={() => toggle(a)} style={{ background: colors[i], border: 'none', color: '#fff', padding: '0.4rem 0.8rem', borderRadius: 20, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>{a} <X size={12} /></button>
        ))}
        {selected.length < 3 && <span style={{ color: '#555', fontSize: '0.75rem' }}>Select up to {3 - selected.length} more</span>}
      </div>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search authors..." style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '0.5rem 1rem', borderRadius: 8, marginBottom: '0.75rem', width: '100%', maxWidth: 300 }} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '1rem' }}>
        {filtered.filter(a => !selected.includes(a.name)).slice(0, 12).map(a => (
          <button key={a.name} onClick={() => toggle(a.name)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#888', padding: '0.35rem 0.7rem', borderRadius: 16, fontSize: '0.75rem', cursor: 'pointer' }}>{a.name} ({a.articles})</button>
        ))}
      </div>
      {selected.length > 0 ? (
        <ResponsiveContainer width="100%" height={350}>
          <ScatterChart margin={{ top: 20, right: 20, bottom: 50, left: 50 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis type="number" dataKey="x" stroke="#666" fontSize={11} label={{ value: opts.find(o => o.v === xAxis)?.l, position: 'bottom', offset: 35, fill: '#888' }} />
            <YAxis type="number" dataKey="y" stroke="#666" fontSize={11} label={{ value: opts.find(o => o.v === yAxis)?.l, angle: -90, position: 'left', offset: 35, fill: '#888' }} />
            <Tooltip contentStyle={{ background: '#1a1a1c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff' }} formatter={(v, n) => [typeof v === 'number' ? v.toLocaleString() : v, n]} labelFormatter={(_, p) => p[0]?.payload?.title || ''} />
            <Scatter data={chartData}>{chartData.map((e, i) => <Cell key={i} fill={colors[e.colorIdx]} fillOpacity={0.7} />)}</Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      ) : <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>Select 1-3 authors to compare</div>}
      <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', marginTop: '1rem' }}>
        {selected.map((a, i) => <div key={a} style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width: 12, height: 12, borderRadius: '50%', background: colors[i] }}></span><span style={{ fontSize: '0.85rem' }}>{a}</span></div>)}
      </div>
    </div>
  );
};

const LengthAnalysis = ({ data, metric, onMetricChange, type }) => {
  const isWords = type === 'words';
  const brackets = isWords 
    ? [{ l: '1-3', min: 1, max: 3 }, { l: '4-5', min: 4, max: 5 }, { l: '6-7', min: 6, max: 7 }, { l: '8-9', min: 8, max: 9 }, { l: '10-12', min: 10, max: 12 }, { l: '13+', min: 13, max: Infinity }]
    : [{ l: '<40', min: 0, max: 39 }, { l: '40-50', min: 40, max: 50 }, { l: '51-60', min: 51, max: 60 }, { l: '61-70', min: 61, max: 70 }, { l: '71-80', min: 71, max: 80 }, { l: '81-90', min: 81, max: 90 }, { l: '91-100', min: 91, max: 100 }, { l: '101+', min: 101, max: Infinity }];
  
  const analysis = useMemo(() => {
    if (data.length === 0) return [];
    const field = isWords ? 'wordCount' : 'titleLength';
    const overallAvg = data.reduce((s, d) => s + (metric === 'views' ? d.views : d.visitors), 0) / data.length;
    return brackets.map(b => {
      const articles = data.filter(d => d[field] >= b.min && d[field] <= b.max);
      if (articles.length === 0) return null;
      const avg = articles.reduce((s, d) => s + (metric === 'views' ? d.views : d.visitors), 0) / articles.length;
      return { ...b, count: articles.length, diff: overallAvg > 0 ? ((avg - overallAvg) / overallAvg) * 100 : 0 };
    }).filter(Boolean);
  }, [data, metric, isWords]);

  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 20, padding: '1.5rem', marginBottom: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 500, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>{isWords ? <Hash size={18} style={{ color: '#E63946' }} /> : <Type size={18} style={{ color: '#E63946' }} />}Headline {isWords ? 'Word Count' : 'Character Length'}</h3>
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: 8, overflow: 'hidden' }}>
          <button onClick={() => onMetricChange('views')} style={{ background: metric === 'views' ? 'linear-gradient(135deg, #E63946, #F4A261)' : 'none', border: 'none', color: metric === 'views' ? '#0a0a0b' : '#888', padding: '0.5rem 1rem', cursor: 'pointer', fontWeight: metric === 'views' ? 500 : 400 }}>Views</button>
          <button onClick={() => onMetricChange('visitors')} style={{ background: metric === 'visitors' ? 'linear-gradient(135deg, #E63946, #F4A261)' : 'none', border: 'none', color: metric === 'visitors' ? '#0a0a0b' : '#888', padding: '0.5rem 1rem', cursor: 'pointer', fontWeight: metric === 'visitors' ? 500 : 400 }}>Visitors</button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem' }}>
        {analysis.map(b => (
          <div key={b.l} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 12, padding: '1rem' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 500, color: '#fff' }}>{b.l} {isWords ? 'words' : 'chars'}</div>
            <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.5rem' }}>{b.count} articles</div>
            <div style={{ fontFamily: 'monospace', fontSize: '1.25rem', fontWeight: 600, color: b.diff >= 0 ? '#2A9D8F' : '#E63946' }}>{b.diff >= 0 ? '+' : ''}{b.diff.toFixed(1)}%</div>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, marginTop: '0.5rem', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(Math.abs(b.diff), 100)}%`, background: b.diff >= 0 ? '#2A9D8F' : '#E63946', borderRadius: 2 }}></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const EngagementAnalysis = ({ data, authorStats }) => {
  const analysis = useMemo(() => {
    if (data.length === 0) return null;
    const totalMins = data.reduce((s, d) => s + (d.avgMinutes * d.visitors), 0);
    const avgEng = data.reduce((s, d) => s + d.avgMinutes, 0) / data.length;
    const brackets = [{ l: '<0.5', min: 0, max: 0.5 }, { l: '0.5-1', min: 0.5, max: 1 }, { l: '1-2', min: 1, max: 2 }, { l: '2-3', min: 2, max: 3 }, { l: '3-5', min: 3, max: 5 }, { l: '5+', min: 5, max: Infinity }];
    const bracketStats = brackets.map(b => {
      const arts = data.filter(d => d.avgMinutes >= b.min && d.avgMinutes < b.max);
      return { ...b, count: arts.length, avgViews: arts.length > 0 ? Math.round(arts.reduce((s, d) => s + d.views, 0) / arts.length) : 0 };
    }).filter(b => b.count > 0);
    const topAuthors = [...authorStats].sort((a, b) => (b.avgViews * b.avgEngagement) - (a.avgViews * a.avgEngagement)).slice(0, 5);
    return { totalMins, avgEng, bracketStats, topAuthors };
  }, [data, authorStats]);

  if (!analysis) return null;

  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 20, padding: '1.5rem', marginBottom: '2rem' }}>
      <h3 style={{ fontSize: '1rem', fontWeight: 500, marginBottom: '1.5rem', color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}><Activity size={18} style={{ color: '#E63946' }} />Engagement Efficiency</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 12, padding: '1.25rem', textAlign: 'center' }}>
          <div style={{ fontFamily: 'monospace', fontSize: '1.75rem', fontWeight: 600, color: '#fff' }}>{analysis.avgEng.toFixed(2)}</div>
          <div style={{ fontSize: '0.75rem', color: '#888' }}>Avg Min/Visitor</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 12, padding: '1.25rem', textAlign: 'center' }}>
          <div style={{ fontFamily: 'monospace', fontSize: '1.75rem', fontWeight: 600, color: '#fff' }}>{Math.round(analysis.totalMins / 60)}h</div>
          <div style={{ fontSize: '0.75rem', color: '#888' }}>Total Engaged Hours</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        <div>
          <h4 style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.75rem', textTransform: 'uppercase' }}>Engagement Distribution</h4>
          {analysis.bracketStats.map(b => (
            <div key={b.l} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: '0.75rem', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span style={{ fontWeight: 500, color: '#fff', fontSize: '0.85rem' }}>{b.l} min</span>
                <span style={{ color: '#888', fontSize: '0.75rem' }}>{b.count} articles</span>
              </div>
              <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(b.count / data.length) * 100}%`, background: 'linear-gradient(90deg, #E63946, #F4A261)', borderRadius: 2 }}></div>
              </div>
            </div>
          ))}
        </div>
        <div>
          <h4 style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.75rem', textTransform: 'uppercase' }}>Most Efficient Authors</h4>
          {analysis.topAuthors.map((a, i) => (
            <div key={a.name} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: 6, marginBottom: '0.4rem' }}>
              <span style={{ color: '#F4A261', fontFamily: 'monospace', fontSize: '0.8rem', width: 20 }}>#{i + 1}</span>
              <span style={{ flex: 1, color: '#fff', fontSize: '0.85rem' }}>{a.name}</span>
              <span style={{ color: '#888', fontFamily: 'monospace', fontSize: '0.75rem' }}>{a.avgEngagement.toFixed(1)}m</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const KeywordAnalysis = ({ data, metric, onMetricChange }) => {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('count');
  const [minCount, setMinCount] = useState(3);

  const analysis = useMemo(() => {
    if (data.length === 0) return [];
    const overallAvg = data.reduce((s, d) => s + (metric === 'views' ? d.views : d.visitors), 0) / data.length;
    const kwMap = new Map();
    data.forEach(a => a.keywords.forEach(k => {
      if (!kwMap.has(k)) kwMap.set(k, { kw: k, total: 0, count: 0 });
      const e = kwMap.get(k);
      e.total += metric === 'views' ? a.views : a.visitors;
      e.count++;
    }));
    let results = Array.from(kwMap.values()).filter(k => k.count >= minCount).map(k => {
      const avg = k.total / k.count;
      return { kw: k.kw, count: k.count, diff: overallAvg > 0 ? ((avg - overallAvg) / overallAvg) * 100 : 0 };
    });
    if (search) results = results.filter(k => k.kw.includes(search.toLowerCase()));
    results.sort((a, b) => sortBy === 'count' ? b.count - a.count : sortBy === 'diff' ? b.diff - a.diff : sortBy === 'diffAsc' ? a.diff - b.diff : a.kw.localeCompare(b.kw));
    return results.slice(0, 80);
  }, [data, metric, search, sortBy, minCount]);

  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 20, padding: '1.5rem', marginBottom: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 500, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}><Hash size={18} style={{ color: '#E63946' }} />Keyword Analysis</h3>
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: 8, overflow: 'hidden' }}>
          <button onClick={() => onMetricChange('views')} style={{ background: metric === 'views' ? 'linear-gradient(135deg, #E63946, #F4A261)' : 'none', border: 'none', color: metric === 'views' ? '#0a0a0b' : '#888', padding: '0.5rem 1rem', cursor: 'pointer' }}>Views</button>
          <button onClick={() => onMetricChange('visitors')} style={{ background: metric === 'visitors' ? 'linear-gradient(135deg, #E63946, #F4A261)' : 'none', border: 'none', color: metric === 'visitors' ? '#0a0a0b' : '#888', padding: '0.5rem 1rem', cursor: 'pointer' }}>Visitors</button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '0.5rem 1rem', borderRadius: 8, flex: 1, maxWidth: 200 }} />
        <select value={minCount} onChange={e => setMinCount(Number(e.target.value))} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '0.5rem', borderRadius: 6 }}>
          <option value={1}>1+ articles</option><option value={2}>2+</option><option value={3}>3+</option><option value={5}>5+</option><option value={10}>10+</option>
        </select>
        <div style={{ display: 'flex', gap: 4 }}>
          {['count', 'diff', 'diffAsc', 'alpha'].map(s => (
            <button key={s} onClick={() => setSortBy(s)} style={{ background: sortBy === s ? 'rgba(230,57,70,0.2)' : 'rgba(255,255,255,0.05)', border: `1px solid ${sortBy === s ? '#E63946' : 'rgba(255,255,255,0.1)'}`, color: sortBy === s ? '#E63946' : '#888', padding: '0.4rem 0.7rem', borderRadius: 6, cursor: 'pointer', fontSize: '0.75rem' }}>
              {s === 'count' ? 'Most Used' : s === 'diff' ? 'Best' : s === 'diffAsc' ? 'Worst' : 'A-Z'}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.6rem', maxHeight: 320, overflowY: 'auto' }}>
        {analysis.map(k => (
          <div key={k.kw} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 8, padding: '0.6rem 0.8rem' }}>
            <div><div style={{ fontWeight: 500, color: '#fff', fontSize: '0.85rem' }}>{k.kw}</div><div style={{ fontSize: '0.65rem', color: '#666' }}>{k.count} articles</div></div>
            <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: 600, color: k.diff >= 0 ? '#2A9D8F' : '#E63946' }}>{k.diff >= 0 ? '+' : ''}{k.diff.toFixed(1)}%</div>
          </div>
        ))}
      </div>
    </div>
  );
};

const AuthorTable = ({ authorStats, selectedAuthors, onToggle, onSelectAll, onDeselectAll, sortConfig, onSort }) => {
  const displayed = authorStats.filter(a => selectedAuthors.has(a.name));
  const hidden = authorStats.filter(a => !selectedAuthors.has(a.name));
  const allSelected = authorStats.length > 0 && authorStats.every(a => selectedAuthors.has(a.name));
  const SortIcon = ({ k }) => sortConfig.key === k ? (sortConfig.dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : null;

  return (
    <div style={{ marginBottom: '2rem' }}>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
        <button onClick={allSelected ? onDeselectAll : onSelectAll} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#e8e8e8', padding: '0.5rem 1rem', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem' }}>
          {allSelected ? <CheckSquare size={16} /> : <Square size={16} />}{allSelected ? 'Deselect All' : 'Select All'}
        </button>
        <span style={{ color: '#888', fontSize: '0.85rem' }}>{selectedAuthors.size} of {authorStats.length} shown</span>
      </div>
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 20, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
          <thead>
            <tr>
              <th style={{ width: 40, padding: '1rem 0.5rem', background: 'rgba(255,255,255,0.03)' }}></th>
              {[{ k: 'name', l: 'Author' }, { k: 'articles', l: 'Articles' }, { k: 'totalViews', l: 'Total Views' }, { k: 'avgViews', l: 'Avg Views' }, { k: 'totalVisitors', l: 'Total Visitors' }, { k: 'avgEngagement', l: 'Avg Min/Visitor' }].map(c => (
                <th key={c.k} onClick={() => onSort(c.k)} style={{ padding: '1rem', textAlign: 'left', fontSize: '0.7rem', textTransform: 'uppercase', color: '#888', cursor: 'pointer', background: 'rgba(255,255,255,0.03)', whiteSpace: 'nowrap' }}>{c.l} <SortIcon k={c.k} /></th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayed.map(a => (
              <tr key={a.name}>
                <td style={{ padding: '0.75rem 0.5rem', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  <button onClick={() => onToggle(a.name)} style={{ background: 'none', border: 'none', color: '#2A9D8F', cursor: 'pointer' }}><CheckSquare size={18} /></button>
                </td>
                <td style={{ padding: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.04)', fontWeight: 500, color: '#fff' }}>{a.name}</td>
                <td style={{ padding: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.04)', fontFamily: 'monospace', fontSize: '0.85rem' }}>{a.articles}</td>
                <td style={{ padding: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.04)', fontFamily: 'monospace', fontSize: '0.85rem' }}>{a.totalViews.toLocaleString()}</td>
                <td style={{ padding: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.04)', fontFamily: 'monospace', fontSize: '0.85rem' }}>{Math.round(a.avgViews).toLocaleString()}</td>
                <td style={{ padding: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.04)', fontFamily: 'monospace', fontSize: '0.85rem' }}>{a.totalVisitors.toLocaleString()}</td>
                <td style={{ padding: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.04)', fontFamily: 'monospace', fontSize: '0.85rem' }}>{a.avgEngagement.toFixed(2)} min</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hidden.length > 0 && (
        <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: 12 }}>
          <p style={{ fontSize: '0.8rem', color: '#666', marginBottom: '0.75rem' }}>Hidden ({hidden.length}):</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {hidden.slice(0, 15).map(a => (
              <button key={a.name} onClick={() => onToggle(a.name)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#888', padding: '0.3rem 0.7rem', borderRadius: 16, fontSize: '0.75rem', cursor: 'pointer' }}>{a.name}</button>
            ))}
            {hidden.length > 15 && <span style={{ color: '#555', fontSize: '0.75rem', padding: '0.3rem' }}>+{hidden.length - 15} more</span>}
          </div>
        </div>
      )}
    </div>
  );
};

export default function MediaAnalytics() {
  const [rawData, setRawData] = useState([]);
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'totalViews', dir: 'desc' });
  const [filterSection, setFilterSection] = useState('all');
  const [selectedAuthors, setSelectedAuthors] = useState(new Set());
  const [charMetric, setCharMetric] = useState('views');
  const [wordMetric, setWordMetric] = useState('views');
  const [kwMetric, setKwMetric] = useState('views');

  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsLoading(true);
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (r) => {
        setRawData(r.data);
        const cleaned = cleanData(r.data);
        setData(cleaned);
        const all = new Set();
        cleaned.forEach(a => a.authors.forEach(x => all.add(x)));
        setSelectedAuthors(all);
        setIsLoading(false);
      },
      error: () => setIsLoading(false)
    });
  };

  const metrics = useMemo(() => {
    if (data.length === 0) return null;
    const fd = filterSection === 'all' ? data : data.filter(d => d.section === filterSection);
    const tv = fd.reduce((s, d) => s + d.visitors, 0);
    const tvw = fd.reduce((s, d) => s + d.views, 0);
    const te = fd.reduce((s, d) => s + (d.avgMinutes * d.visitors), 0);
    const ae = fd.reduce((s, d) => s + d.avgMinutes, 0) / fd.length;
    return { totalVisitors: tv, avgVisitors: tv / fd.length, totalViews: tvw, avgViews: tvw / fd.length, totalEngaged: te, avgEngagement: ae, totalArticles: fd.length };
  }, [data, filterSection]);

  const authorStats = useMemo(() => {
    if (data.length === 0) return [];
    const fd = filterSection === 'all' ? data : data.filter(d => d.section === filterSection);
    const map = new Map();
    fd.forEach(a => a.authors.forEach(author => {
      if (!map.has(author)) map.set(author, { name: author, articles: 0, totalViews: 0, totalVisitors: 0, sumAvg: 0 });
      const s = map.get(author);
      s.articles++; s.totalViews += a.views; s.totalVisitors += a.visitors; s.sumAvg += a.avgMinutes;
    }));
    let arr = Array.from(map.values()).map(s => ({ ...s, avgViews: s.totalViews / s.articles, avgEngagement: s.sumAvg / s.articles }));
    arr.sort((a, b) => {
      const av = a[sortConfig.key], bv = b[sortConfig.key];
      if (typeof av === 'string') return sortConfig.dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortConfig.dir === 'asc' ? av - bv : bv - av;
    });
    return arr;
  }, [data, filterSection, sortConfig]);

  const sections = useMemo(() => ['all', ...new Set(data.map(d => d.section))], [data]);
  const formatMins = (m) => m >= 60 ? `${Math.floor(m / 60)}h ${Math.round(m % 60)}m` : `${m.toFixed(2)} min`;

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0b', color: '#e8e8e8', fontFamily: "'Outfit', sans-serif", padding: '2rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '3rem', paddingBottom: '2rem', borderBottom: '1px solid rgba(255,255,255,0.08)', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: 48, height: 48, background: 'linear-gradient(135deg, #E63946, #F4A261)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace', fontWeight: 700, fontSize: '1.25rem', color: '#0a0a0b' }}>MA</div>
          <div><h1 style={{ fontSize: '1.75rem', fontWeight: 600, color: '#fff', margin: 0 }}>Media Analytics</h1><p style={{ fontSize: '0.875rem', color: '#666', margin: 0 }}>Performance Dashboard</p></div>
        </div>
        {data.length > 0 && (
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '0.75rem 1rem', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Filter size={16} />
              <select value={filterSection} onChange={e => setFilterSection(e.target.value)} style={{ background: 'transparent', border: 'none', color: '#e8e8e8', cursor: 'pointer' }}>
                {sections.map(s => <option key={s} value={s} style={{ background: '#1a1a1c' }}>{s === 'all' ? 'All Sections' : s}</option>)}
              </select>
            </div>
            <label style={{ background: 'linear-gradient(135deg, #E63946, #F4A261)', padding: '0.75rem 1.25rem', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, color: '#0a0a0b', fontWeight: 500 }}>
              <Upload size={16} />Upload CSV<input type="file" accept=".csv" onChange={handleUpload} style={{ display: 'none' }} />
            </label>
          </div>
        )}
      </header>

      {isLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
          <div style={{ width: 48, height: 48, border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#E63946', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        </div>
      ) : data.length === 0 ? (
        <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, border: '2px dashed rgba(255,255,255,0.15)', borderRadius: 24, background: 'rgba(255,255,255,0.02)', cursor: 'pointer' }}>
          <div style={{ width: 80, height: 80, background: 'linear-gradient(135deg, rgba(230,57,70,0.2), rgba(244,162,97,0.2))', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}><Upload size={32} style={{ color: '#E63946' }} /></div>
          <p style={{ fontSize: '1.25rem', fontWeight: 500, marginBottom: '0.5rem' }}>Upload your CSV file</p>
          <p style={{ color: '#666', fontSize: '0.875rem' }}>Title, Authors, Visitors, Views, Avg. minutes, Section</p>
          <input type="file" accept=".csv" onChange={handleUpload} style={{ display: 'none' }} />
        </label>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '3rem' }}>
            <MetricCard icon={FileText} label="Total Articles" value={metrics.totalArticles.toLocaleString()} color="#E63946" />
            <MetricCard icon={Users} label="Total Visitors" value={metrics.totalVisitors.toLocaleString()} subValue={`Avg: ${Math.round(metrics.avgVisitors).toLocaleString()}`} color="#F4A261" />
            <MetricCard icon={Eye} label="Total Views" value={metrics.totalViews.toLocaleString()} subValue={`Avg: ${Math.round(metrics.avgViews).toLocaleString()}`} color="#2A9D8F" />
            <MetricCard icon={Clock} label="Total Engaged" value={formatMins(metrics.totalEngaged)} color="#264653" />
            <MetricCard icon={Activity} label="Avg Min/Visitor" value={`${metrics.avgEngagement.toFixed(2)} min`} color="#E9C46A" />
            <MetricCard icon={UserCheck} label="Unique Authors" value={authorStats.length.toLocaleString()} color="#457B9D" />
          </div>

          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 20, padding: '1.5rem', marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 500, marginBottom: '1.5rem', color: '#fff' }}>Top Authors by Views</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={authorStats.slice(0, 10).map(a => ({ name: a.name.split(' ')[0], views: a.totalViews }))} layout="vertical">
                <XAxis type="number" stroke="#444" fontSize={11} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                <YAxis type="category" dataKey="name" stroke="#444" fontSize={11} width={70} />
                <Tooltip contentStyle={{ background: '#1a1a1c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff' }} formatter={v => [v.toLocaleString(), 'Views']} />
                <Bar dataKey="views" fill="#E63946" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <AuthorScatterPlot data={data} authorStats={authorStats} />
          <LengthAnalysis data={data} metric={charMetric} onMetricChange={setCharMetric} type="chars" />
          <LengthAnalysis data={data} metric={wordMetric} onMetricChange={setWordMetric} type="words" />
          <EngagementAnalysis data={data} authorStats={authorStats} />
          <KeywordAnalysis data={data} metric={kwMetric} onMetricChange={setKwMetric} />

          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ width: 6, height: 28, background: 'linear-gradient(135deg, #E63946, #F4A261)', borderRadius: 3 }}></span>Author Performance
          </h2>
          <AuthorTable 
            authorStats={authorStats} 
            selectedAuthors={selectedAuthors} 
            onToggle={name => setSelectedAuthors(prev => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; })}
            onSelectAll={() => setSelectedAuthors(new Set(authorStats.map(a => a.name)))}
            onDeselectAll={() => setSelectedAuthors(new Set())}
            sortConfig={sortConfig}
            onSort={k => setSortConfig(prev => ({ key: k, dir: prev.key === k && prev.dir === 'desc' ? 'asc' : 'desc' }))}
          />
        </>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
