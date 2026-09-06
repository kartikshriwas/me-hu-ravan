'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/authContext';
import { 
  Target, 
  Video, 
  Clock, 
  PlayCircle, 
  Bookmark, 
  FolderHeart, 
  Sparkles, 
  ChevronRight,
  Flame,
  CheckCircle2
} from 'lucide-react';

interface RecentProgressItem {
  slug: string;
  videoId: string;
  title: string;
  courseTitle: string;
  timestamp: number;
  updatedAt: number;
}

export function StudentDashboard() {
  const { user } = useAuth();
  const userName = user?.name || (user?.email ? user.email.split('@')[0] : 'kartik');

  const [recentProgress, setRecentProgress] = useState<RecentProgressItem[]>([]);
  const [completedCount, setCompletedCount] = useState<number>(0);
  const [watchTimeMinutes, setWatchTimeMinutes] = useState<number>(0);

  useEffect(() => {
    try {
      // 1. Load recent progress from localStorage
      const items: RecentProgressItem[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('preptea_last_video_')) {
          const slug = key.replace('preptea_last_video_', '');
          const val = localStorage.getItem(key);
          if (val) {
            const parsed = JSON.parse(val);
            items.push({
              slug,
              videoId: parsed.videoId,
              title: parsed.title || 'Video Lesson',
              courseTitle: slug.replace(/-/g, ' ').toUpperCase(),
              timestamp: parsed.timestamp || 0,
              updatedAt: parsed.updatedAt || 0,
            });
          }
        }
      }
      items.sort((a, b) => b.updatedAt - a.updatedAt);
      setRecentProgress(items);

      // 2. Load completed videos count
      const completedStored = localStorage.getItem('preptea_completed_videos');
      if (completedStored) {
        const list = JSON.parse(completedStored);
        setCompletedCount(Array.isArray(list) ? list.length : 0);
      }

      // 3. Estimate watch time from saved timestamps
      let totalSeconds = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('preptea_video_time_')) {
          const time = parseFloat(localStorage.getItem(key) || '0');
          if (!isNaN(time)) totalSeconds += time;
        }
      }
      setWatchTimeMinutes(Math.round(totalSeconds / 60));
    } catch (e) {
      // ignore
    }
  }, []);

  // Targets
  const targetLecturesGoal = 5;
  const targetWatchTimeGoal = 30; // minutes

  // Default fallback data for empty state preview
  const displayProgress = recentProgress.length > 0 ? recentProgress : [
    {
      slug: 'sigma-8',
      videoId: 'v1',
      title: 'Dynamic Programming',
      courseTitle: 'Sigma 8.0 (DSA with Java)',
      timestamp: 1420,
      updatedAt: Date.now()
    },
    {
      slug: 'sigma-8',
      videoId: 'v2',
      title: 'Path to Placement',
      courseTitle: 'Sigma 8.0 (DSA with Java)',
      timestamp: 950,
      updatedAt: Date.now() - 3600000
    }
  ];

  const savedLectures = [
    { title: 'Path to Placement', batch: 'Alpha Batch 3.0', slug: 'alpha-3' }
  ];

  const savedBatches = [
    { title: "Delta Feb'24", slug: 'delta-feb-24' }
  ];

  return (
    <div className="space-y-6">
      {/* ── Greeting & Target Header ── */}
      <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-slate-800 space-y-6 relative overflow-hidden bg-gradient-to-br from-slate-900/90 via-slate-950 to-indigo-950/40">
        <div className="absolute top-0 right-0 w-72 h-72 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[11px] font-extrabold uppercase tracking-wider mb-2">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Today's Target</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white capitalize">
              Hello, <span className="text-indigo-400">{userName}</span>!
            </h1>
            <p className="text-xs text-slate-400 mt-1">Keep the momentum going! Track your daily targets and recent progress.</p>
          </div>

          <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs font-semibold text-slate-300">
            <Flame className="w-4 h-4 text-amber-400 animate-pulse" />
            <span>Learning Streak Active</span>
          </div>
        </div>

        {/* ── Target Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {/* Lectures Target Card */}
          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                  <Video className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Lectures Target</h4>
                  <p className="text-[10px] text-slate-400">Target: {targetLecturesGoal} Videos</p>
                </div>
              </div>
              <span className="text-sm font-mono font-black text-indigo-400">
                {Math.min(completedCount, targetLecturesGoal)}/{targetLecturesGoal}
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden">
              <div 
                className="h-full bg-indigo-500 transition-all duration-500" 
                style={{ width: `${Math.min(100, (completedCount / targetLecturesGoal) * 100)}%` }} 
              />
            </div>
          </div>

          {/* Watch Time Target Card */}
          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                  <Clock className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Watch Time Target</h4>
                  <p className="text-[10px] text-slate-400">Target: {targetWatchTimeGoal} Minutes</p>
                </div>
              </div>
              <span className="text-sm font-mono font-black text-purple-400">
                {Math.min(watchTimeMinutes, targetWatchTimeGoal)}/{targetWatchTimeGoal}m
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden">
              <div 
                className="h-full bg-purple-500 transition-all duration-500" 
                style={{ width: `${Math.min(100, (watchTimeMinutes / targetWatchTimeGoal) * 100)}%` }} 
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── 3 Column Sections: Recent Progress, Saved Lectures, Saved Batches ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Column 1: Recent Progress */}
        <div className="glass-panel rounded-3xl p-5 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <PlayCircle className="w-4.5 h-4.5 text-indigo-400" />
              <h3 className="text-sm font-bold text-white">Recent Progress</h3>
            </div>
            <Link href="/courses" className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5">
              <span>View All</span>
              <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="space-y-2.5">
            {displayProgress.map((item, idx) => (
              <Link key={idx} href={`/courses/${item.slug}/video/${item.videoId}`}>
                <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-indigo-500/40 transition-all group flex items-center justify-between">
                  <div className="min-w-0 pr-2">
                    <h4 className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors truncate">
                      {item.title}
                    </h4>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">
                      {item.courseTitle}
                    </p>
                  </div>
                  <div className="w-7 h-7 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Column 2: Saved Lectures */}
        <div className="glass-panel rounded-3xl p-5 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <Bookmark className="w-4.5 h-4.5 text-purple-400" />
              <h3 className="text-sm font-bold text-white">Saved Lectures</h3>
            </div>
            <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded-full border border-slate-800">
              {savedLectures.length} Saved
            </span>
          </div>

          <div className="space-y-2.5">
            {savedLectures.map((item, idx) => (
              <Link key={idx} href={`/courses/${item.slug}`}>
                <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-purple-500/40 transition-all group flex items-center justify-between">
                  <div className="min-w-0 pr-2">
                    <h4 className="text-xs font-bold text-white group-hover:text-purple-300 transition-colors truncate">
                      {item.title}
                    </h4>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">
                      {item.batch}
                    </p>
                  </div>
                  <div className="w-7 h-7 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0 group-hover:bg-purple-600 group-hover:text-white transition-all">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Column 3: Saved Batches */}
        <div className="glass-panel rounded-3xl p-5 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <FolderHeart className="w-4.5 h-4.5 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">Saved Batches</h3>
            </div>
            <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded-full border border-slate-800">
              {savedBatches.length} Batches
            </span>
          </div>

          <div className="space-y-2.5">
            {savedBatches.map((item, idx) => (
              <Link key={idx} href={`/courses`}>
                <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-emerald-500/40 transition-all group flex items-center justify-between">
                  <div className="min-w-0 pr-2">
                    <h4 className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors truncate">
                      {item.title}
                    </h4>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">
                      Enrolled Batch
                    </p>
                  </div>
                  <div className="w-7 h-7 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-all">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
