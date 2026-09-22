'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, AlertTriangle, ExternalLink, Mail, Clock, Search } from 'lucide-react';
import { IReport } from '@/models/Report';

interface ReportListClientProps {
  initialReports: any[];
}

export function ReportListClient({ initialReports }: ReportListClientProps) {
  const [reports, setReports] = useState(initialReports);
  const [filter, setFilter] = useState<'All' | 'Pending' | 'Resolved'>('Pending');
  const [search, setSearch] = useState('');

  useEffect(() => {
    setReports(initialReports);
  }, [initialReports]);

  const filteredReports = reports.filter(r => {
    if (filter !== 'All' && r.status !== filter) return false;
    if (search && !r.userEmail.toLowerCase().includes(search.toLowerCase()) && !r.issueType.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    return true;
  });

  const handleResolve = async (reportId: string) => {
    try {
      const res = await fetch('/api/admin/reports/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId })
      });

      if (res.ok) {
        setReports(reports.map(r => r._id === reportId ? { ...r, status: 'Resolved' } : r));
      } else {
        alert('Failed to resolve report.');
      }
    } catch (e) {
      alert('Error resolving report.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex gap-2 p-1 bg-card border border-card-border rounded-xl">
          {['Pending', 'Resolved', 'All'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                filter === f 
                  ? 'bg-primary-600 text-white shadow-md' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Search email or issue type..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-card border border-card-border rounded-xl text-sm focus:outline-none focus:border-primary-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredReports.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground glass-panel rounded-2xl border border-card-border">
            <AlertTriangle className="w-8 h-8 text-primary-500 mx-auto opacity-50 mb-3" />
            <p className="font-semibold">No reports found.</p>
          </div>
        ) : (
          filteredReports.map(report => (
            <div key={report._id} className={`p-5 rounded-2xl border transition-all ${report.status === 'Resolved' ? 'bg-card/50 border-card-border opacity-70' : 'bg-card border-amber-500/30 shadow-md'}`}>
              <div className="flex flex-col sm:flex-row justify-between gap-4">
                
                <div className="space-y-3 flex-1">
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                      report.issueType.includes('Key') ? 'bg-rose-500/20 text-rose-500' : 
                      report.issueType.includes('Incomplete') ? 'bg-amber-500/20 text-amber-500' : 
                      'bg-primary-500/20 text-primary-500'
                    }`}>
                      {report.issueType}
                    </span>
                    <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${report.status === 'Resolved' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>
                      {report.status}
                    </span>
                  </div>

                  {report.description && (
                    <p className="text-sm text-foreground/90 bg-background/50 p-3 rounded-xl border border-card-border/50">
                      "{report.description}"
                    </p>
                  )}

                  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground font-medium pt-2">
                    <div className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5" />
                      {report.userEmail}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(report.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 shrink-0">
                  <a 
                    href={`/quiz/${report.quizId}/results`} 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-primary-600/10 hover:bg-primary-600/20 text-primary-500 font-bold text-xs border border-primary-500/20 transition-all"
                  >
                    View Quiz <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  {report.status === 'Pending' && (
                    <button 
                      onClick={() => handleResolve(report._id)}
                      className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Mark Resolved
                    </button>
                  )}
                </div>

              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
