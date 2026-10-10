'use client';

import React, { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import {
  CalendarDays,
  Flame,
  Target,
  CheckCircle2,
  Clock,
  Play,
  ArrowRight,
  Sparkles,
  Layers,
  ChevronDown,
  Search,
  X,
  ArrowDownToLine,
  Filter,
  Check,
  Video,
  FileCheck2,
  FileText,
  HelpCircle,
  TrendingUp,
  Award,
  Zap,
  BookOpen,
} from 'lucide-react';
import { CourseDetail, CourseSectionUnit } from '@/lib/types';

interface CalendarUnitItem {
  unit: CourseSectionUnit;
  sectionTitle: string;
  sectionId: string;
  videoId: string;
  durationSeconds: number;
  isActionableVideo: boolean;
  uploadDateStr: string; // YYYY-MM-DD
}

export interface CalendarDayGroup {
  dayNumber: number;
  dateKey: string; // YYYY-MM-DD or 'unscheduled'
  formattedDate: string; // e.g. "11 Nov 2025"
  dayOfWeek: string; // e.g. "Tuesday"
  targetTitle: string; // e.g. "Functions & Methods" or "Arrays (Part I)"
  items: CalendarUnitItem[];
  totalSeconds: number;
  totalLectures: number;
  completedCount: number;
  isCompleted: boolean;
  isNextTarget: boolean;
  progressPercent: number;
}

interface CourseCalendarViewProps {
  course: CourseDetail;
  isUnlocked?: boolean;
  completedVideos: string[];
  onToggleComplete: (videoId: string) => void;
  onDownloadUnit?: (
    e: React.MouseEvent,
    unit: CourseSectionUnit,
    sectionTitle: string,
    sectionId: string
  ) => void;
  formatUnitDuration: (seconds?: number) => string | null;
  getUnitMetaConfig: (unit: CourseSectionUnit) => any;
}

interface StreakState {
  currentStreak: number;
  longestStreak: number;
  studiedToday: boolean;
  activeDaysThisWeek: boolean[]; // 7 days (Mon-Sun)
}

function formatDateDisplay(dateStr: string): { formatted: string; dayOfWeek: string } {
  if (!dateStr || dateStr === 'unscheduled') {
    return { formatted: 'Course Resources & Extras', dayOfWeek: 'Anytime' };
  }

  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);

      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

      return {
        formatted: `${day} ${months[month]} ${year}`,
        dayOfWeek: days[d.getDay()] || '',
      };
    }
  } catch (e) {
    // fallback
  }

  return { formatted: dateStr, dayOfWeek: '' };
}

function formatDurationHms(totalSeconds: number): string {
  if (!totalSeconds || totalSeconds <= 0) return '0 min';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) {
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${m}m`;
}

export function CourseCalendarView({
  course,
  isUnlocked = true,
  completedVideos,
  onToggleComplete,
  onDownloadUnit,
  formatUnitDuration,
  getUnitMetaConfig,
}: CourseCalendarViewProps) {
  // Paced targets (~1.5 - 2h per day across 4-6 months) vs Raw bulk upload drop batches
  const [scheduleMode, setScheduleMode] = useState<'paced' | 'raw_batches'>('paced');
  const [filterMode, setFilterMode] = useState<'all' | 'pending' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedDays, setExpandedDays] = useState<Record<number, boolean>>({});
  const [streakData, setStreakData] = useState<StreakState>({
    currentStreak: 1,
    longestStreak: 1,
    studiedToday: false,
    activeDaysThisWeek: [false, false, false, false, false, false, false],
  });

  // 1. Calculate & manage streak from localStorage
  useEffect(() => {
    try {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      const raw = localStorage.getItem('preptea_learning_streak_data');
      let studyDays: string[] = [];

      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.studyDays)) {
          studyDays = parsed.studyDays;
        }
      }

      if (completedVideos.length > 0 && !studyDays.includes(todayStr)) {
        studyDays.push(todayStr);
      }

      const uniqueDays = Array.from(new Set(studyDays)).sort().reverse();
      const studiedToday = uniqueDays.includes(todayStr);

      let currentStreak = 0;
      let checkDate = new Date();
      if (!studiedToday) {
        checkDate.setDate(checkDate.getDate() - 1);
      }

      for (let i = 0; i < 365; i++) {
        const checkStr = checkDate.toISOString().split('T')[0];
        if (uniqueDays.includes(checkStr)) {
          currentStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }

      const currentDayOfWeek = (today.getDay() + 6) % 7;
      const monday = new Date(today);
      monday.setDate(today.getDate() - currentDayOfWeek);

      const weekFlags = [0, 1, 2, 3, 4, 5, 6].map((offset) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + offset);
        const dStr = d.toISOString().split('T')[0];
        return uniqueDays.includes(dStr);
      });

      const maxStreak = Math.max(currentStreak, parseInt(localStorage.getItem('preptea_max_streak') || '1', 10));
      localStorage.setItem('preptea_max_streak', maxStreak.toString());

      setStreakData({
        currentStreak: Math.max(1, currentStreak),
        longestStreak: Math.max(1, maxStreak),
        studiedToday,
        activeDaysThisWeek: weekFlags,
      });
    } catch (e) {
      // ignore
    }
  }, [completedVideos]);

  // 2. Group all units into either Paced Targets or Raw Upload Batches
  const calendarDays: CalendarDayGroup[] = useMemo(() => {
    // Collect all valid unit items
    const allUnitsList: CalendarUnitItem[] = [];

    course.sections.forEach((sec) => {
      sec.units.forEach((unit) => {
        const cfg = getUnitMetaConfig(unit);

        let dateKey = 'unscheduled';
        if (unit.modifiedF && typeof unit.modifiedF === 'string') {
          const part = unit.modifiedF.split(' ')[0]?.trim();
          if (/^\d{4}-\d{2}-\d{2}$/.test(part)) {
            dateKey = part;
          }
        } else if (typeof unit.created === 'number' && unit.created > 0) {
          try {
            dateKey = new Date(unit.created * 1000).toISOString().split('T')[0];
          } catch (e) {}
        }

        const isYouTube =
          unit.type === 'youtube' ||
          unit.icon === 'yt' ||
          (unit.subtitle && unit.subtitle.toLowerCase().includes('youtube')) ||
          !!(unit.data && unit.data.embed);

        const videoId = unit.sourceid || (!isYouTube && unit.id ? unit.id : '');

        allUnitsList.push({
          unit,
          sectionTitle: sec.title,
          sectionId: sec.id,
          videoId,
          durationSeconds: unit.duration || 0,
          isActionableVideo: cfg.isActionableVideo,
          uploadDateStr: dateKey,
        });
      });
    });

    const result: CalendarDayGroup[] = [];

    // ─────────────────────────────────────────────────────────────
    // MODE A: PACED DAILY TARGETS (~1.5h - 2h per day)
    // ─────────────────────────────────────────────────────────────
    if (scheduleMode === 'paced') {
      interface PacedBatch {
        dateKey: string;
        title: string;
        items: CalendarUnitItem[];
        durationSecs: number;
      }

      const batches: PacedBatch[] = [];

      course.sections.forEach((sec) => {
        const secUnits = allUnitsList.filter((it) => it.sectionId === sec.id);
        if (secUnits.length === 0) return;

        // Group units by upload date within this section
        const byDateMap = new Map<string, CalendarUnitItem[]>();
        secUnits.forEach((it) => {
          if (!byDateMap.has(it.uploadDateStr)) {
            byDateMap.set(it.uploadDateStr, []);
          }
          byDateMap.get(it.uploadDateStr)!.push(it);
        });

        byDateMap.forEach((uList, dt) => {
          const totalSec = uList.reduce((acc, it) => acc + it.durationSeconds, 0);

          // If section on this date is > 2h 15m (8100s), split into Part 1, Part 2
          if (totalSec > 8100 && uList.length > 1) {
            let chunk: CalendarUnitItem[] = [];
            let cSec = 0;
            let part = 1;

            uList.forEach((it) => {
              if (cSec > 0 && cSec + it.durationSeconds > 7200) {
                batches.push({
                  dateKey: dt,
                  title: `${sec.title} (Part ${part})`,
                  items: chunk,
                  durationSecs: cSec,
                });
                chunk = [];
                cSec = 0;
                part++;
              }
              chunk.push(it);
              cSec += it.durationSeconds;
            });

            if (chunk.length > 0) {
              batches.push({
                dateKey: dt,
                title: part > 1 ? `${sec.title} (Part ${part})` : sec.title,
                items: chunk,
                durationSecs: cSec,
              });
            }
          } else {
            batches.push({
              dateKey: dt,
              title: sec.title,
              items: uList,
              durationSecs: totalSec,
            });
          }
        });
      });

      // Chronologically sort batches by upload date
      const sortedBatches = batches.sort((a, b) => {
        if (a.dateKey === 'unscheduled') return 1;
        if (b.dateKey === 'unscheduled') return -1;
        return a.dateKey.localeCompare(b.dateKey);
      });

      // Merge very small introductory sections on the same date (< 25 min)
      const mergedBatches: PacedBatch[] = [];
      let i = 0;
      while (i < sortedBatches.length) {
        const cur = sortedBatches[i];
        if (
          cur.durationSecs < 1800 &&
          i + 1 < sortedBatches.length &&
          sortedBatches[i + 1].dateKey === cur.dateKey &&
          cur.durationSecs + sortedBatches[i + 1].durationSecs <= 7200
        ) {
          const nxt = sortedBatches[i + 1];
          mergedBatches.push({
            dateKey: cur.dateKey,
            title: `${cur.title} & ${nxt.title}`,
            items: [...cur.items, ...nxt.items],
            durationSecs: cur.durationSecs + nxt.durationSecs,
          });
          i += 2;
        } else {
          mergedBatches.push(cur);
          i++;
        }
      }

      let dayNum = 1;
      mergedBatches.forEach((batch) => {
        const { formatted, dayOfWeek } = formatDateDisplay(batch.dateKey);
        const completedCount = batch.items.filter(
          (it) => it.videoId && completedVideos.includes(it.videoId)
        ).length;

        const isCompleted = batch.items.length > 0 && completedCount === batch.items.length;
        const progressPercent =
          batch.items.length > 0 ? Math.round((completedCount / batch.items.length) * 100) : 0;

        result.push({
          dayNumber: dayNum++,
          dateKey: batch.dateKey,
          formattedDate: formatted,
          dayOfWeek,
          targetTitle: batch.title,
          items: batch.items,
          totalSeconds: batch.durationSecs,
          totalLectures: batch.items.length,
          completedCount,
          isCompleted,
          isNextTarget: false,
          progressPercent,
        });
      });
    }

    // ─────────────────────────────────────────────────────────────
    // MODE B: RAW LMS UPLOAD BATCHES (Original Drop Dates)
    // ─────────────────────────────────────────────────────────────
    else {
      const dateMap = new Map<string, CalendarUnitItem[]>();

      allUnitsList.forEach((it) => {
        if (!dateMap.has(it.uploadDateStr)) {
          dateMap.set(it.uploadDateStr, []);
        }
        dateMap.get(it.uploadDateStr)!.push(it);
      });

      const validDates = Array.from(dateMap.keys())
        .filter((k) => k !== 'unscheduled')
        .sort((a, b) => a.localeCompare(b));

      let dayNum = 1;

      validDates.forEach((dateKey) => {
        const items = dateMap.get(dateKey) || [];
        const { formatted, dayOfWeek } = formatDateDisplay(dateKey);
        const totalSec = items.reduce((acc, it) => acc + it.durationSeconds, 0);

        const completedCount = items.filter(
          (it) => it.videoId && completedVideos.includes(it.videoId)
        ).length;

        const isCompleted = items.length > 0 && completedCount === items.length;
        const progressPercent =
          items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

        // Distinct section names in this batch
        const distinctSections = Array.from(new Set(items.map((it) => it.sectionTitle)));
        const targetTitle =
          distinctSections.length === 1
            ? distinctSections[0]
            : `${distinctSections.length} Topics Upload Batch`;

        result.push({
          dayNumber: dayNum++,
          dateKey,
          formattedDate: formatted,
          dayOfWeek,
          targetTitle,
          items,
          totalSeconds: totalSec,
          totalLectures: items.length,
          completedCount,
          isCompleted,
          isNextTarget: false,
          progressPercent,
        });
      });

      if (dateMap.has('unscheduled')) {
        const items = dateMap.get('unscheduled') || [];
        if (items.length > 0) {
          const { formatted, dayOfWeek } = formatDateDisplay('unscheduled');
          const totalSec = items.reduce((acc, it) => acc + it.durationSeconds, 0);
          const completedCount = items.filter(
            (it) => it.videoId && completedVideos.includes(it.videoId)
          ).length;

          result.push({
            dayNumber: dayNum++,
            dateKey: 'unscheduled',
            formattedDate: formatted,
            dayOfWeek,
            targetTitle: 'Course Resources & Extras',
            items,
            totalSeconds: totalSec,
            totalLectures: items.length,
            completedCount,
            isCompleted: items.length > 0 && completedCount === items.length,
            isNextTarget: false,
            progressPercent:
              items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0,
          });
        }
      }
    }

    // Identify first incomplete day as "Next Target"
    let foundNext = false;
    for (const day of result) {
      if (!day.isCompleted && !foundNext) {
        day.isNextTarget = true;
        foundNext = true;
      }
    }

    return result;
  }, [course, completedVideos, getUnitMetaConfig, scheduleMode]);

  // Expand "Next Target" by default on initial mount
  useEffect(() => {
    const nextDay = calendarDays.find((d) => d.isNextTarget) || calendarDays[0];
    if (nextDay && Object.keys(expandedDays).length === 0) {
      setExpandedDays({ [nextDay.dayNumber]: true });
    }
  }, [calendarDays]);

  // Overall Statistics
  const totalDays = calendarDays.length;
  const completedDaysCount = calendarDays.filter((d) => d.isCompleted).length;
  const nextTargetDay = calendarDays.find((d) => d.isNextTarget) || null;
  const overallCompletedUnits = completedVideos.length;
  const overallTotalUnits = calendarDays.reduce((acc, d) => acc + d.totalLectures, 0);

  // Filtered Days
  const filteredDays = useMemo(() => {
    return calendarDays.filter((day) => {
      if (filterMode === 'pending' && day.isCompleted) return false;
      if (filterMode === 'completed' && !day.isCompleted) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesDate =
          day.formattedDate.toLowerCase().includes(q) ||
          day.dayOfWeek.toLowerCase().includes(q) ||
          day.targetTitle.toLowerCase().includes(q) ||
          `day ${day.dayNumber}`.includes(q);

        const matchesLectures = day.items.some(
          (it) =>
            (it.unit.title || it.unit.unitTitle || '').toLowerCase().includes(q) ||
            it.sectionTitle.toLowerCase().includes(q)
        );

        return matchesDate || matchesLectures;
      }

      return true;
    });
  }, [calendarDays, filterMode, searchQuery]);

  const toggleDay = (dayNum: number) => {
    setExpandedDays((prev) => ({
      ...prev,
      [dayNum]: !prev[dayNum],
    }));
  };

  const expandAll = () => {
    const all: Record<number, boolean> = {};
    calendarDays.forEach((d) => (all[d.dayNumber] = true));
    setExpandedDays(all);
  };

  const collapseAll = () => {
    setExpandedDays({});
  };

  return (
    <div className="space-y-6">
      {/* ── STREAK & TODAY'S TARGET HERO BANNER ── */}
      <div className="relative overflow-hidden rounded-3xl p-5 sm:p-7 border border-card-border/80 glass-panel bg-gradient-to-br from-slate-900/90 via-slate-950 to-primary-950/40">
        <div className="absolute top-0 right-0 w-80 h-80 bg-primary-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Left: Streak Counter & Weekly Pulse */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-black uppercase tracking-wider">
                <Flame className="w-4 h-4 text-amber-400 fill-amber-400 animate-pulse" />
                <span>Daily Learning Streak</span>
              </span>
              {streakData.studiedToday && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold">
                  <Check className="w-3 h-3" />
                  <span>Completed Today</span>
                </span>
              )}
            </div>

            <div className="flex items-baseline gap-3">
              <span className="text-4xl sm:text-5xl font-black text-foreground tracking-tight">
                {streakData.currentStreak}
              </span>
              <div className="text-left">
                <p className="text-base font-extrabold text-foreground">
                  Day{streakData.currentStreak === 1 ? '' : 's'} Streak
                </p>
                <p className="text-xs text-muted-foreground">
                  Best: {streakData.longestStreak} days in a row
                </p>
              </div>
            </div>

            {/* Weekly 7-Day Activity Strip */}
            <div className="space-y-1.5 pt-1">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                This Week&apos;s Activity
              </p>
              <div className="flex items-center gap-2">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((dayLetter, idx) => {
                  const isActive = streakData.activeDaysThisWeek[idx];
                  const isTodayIndex = (new Date().getDay() + 6) % 7 === idx;

                  return (
                    <div
                      key={idx}
                      className="flex flex-col items-center gap-1"
                      title={isActive ? `Day ${idx + 1}: Studied` : `Day ${idx + 1}`}
                    >
                      <div
                        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center font-bold text-xs transition-all ${
                          isActive
                            ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30 scale-105'
                            : isTodayIndex
                            ? 'bg-card border-2 border-primary-500 text-foreground'
                            : 'bg-card/70 border border-card-border/60 text-muted-foreground'
                        }`}
                      >
                        {isActive ? (
                          <Flame className="w-3.5 h-3.5 fill-current" />
                        ) : (
                          dayLetter
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: Next Up Target Card */}
          <div className="lg:col-span-7">
            {nextTargetDay ? (
              <div className="p-4 sm:p-5 rounded-2xl bg-card/85 border border-primary-500/30 shadow-xl space-y-3.5 relative overflow-hidden backdrop-blur-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-primary-500/20 text-primary-400 border border-primary-500/30">
                      <Target className="w-4 h-4 text-primary-400" />
                    </span>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-primary-400">
                        Today&apos;s Target Day
                      </span>
                      <h4 className="text-base sm:text-lg font-bold text-foreground leading-snug">
                        Day {nextTargetDay.dayNumber} • {nextTargetDay.targetTitle}
                      </h4>
                    </div>
                  </div>

                  <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-card border border-card-border text-foreground shrink-0">
                    {nextTargetDay.completedCount}/{nextTargetDay.totalLectures} Done
                  </span>
                </div>

                {/* Duration & Lectures Target Summary */}
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-1">
                  <span className="flex items-center gap-1 text-foreground font-semibold">
                    <Video className="w-3.5 h-3.5 text-primary-400" />
                    <span>{nextTargetDay.totalLectures} Lectures</span>
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1 text-foreground font-semibold">
                    <Clock className="w-3.5 h-3.5 text-primary-400" />
                    <span>{formatDurationHms(nextTargetDay.totalSeconds)} required today</span>
                  </span>
                  <span>•</span>
                  <span>{nextTargetDay.formattedDate}</span>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1">
                  <div className="w-full h-2 rounded-full bg-slate-800/80 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary-500 to-indigo-500 transition-all duration-500"
                      style={{ width: `${nextTargetDay.progressPercent}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] font-medium text-muted-foreground">
                    <span>Target Progress: {nextTargetDay.progressPercent}%</span>
                    <span>
                      {nextTargetDay.totalLectures - nextTargetDay.completedCount} left to finish today
                    </span>
                  </div>
                </div>

                {/* Action CTA: Jump to First Unfinished Lecture */}
                {(() => {
                  const firstUnfinished =
                    nextTargetDay.items.find(
                      (it) => it.videoId && !completedVideos.includes(it.videoId)
                    ) || nextTargetDay.items[0];

                  if (!firstUnfinished || !firstUnfinished.videoId) return null;

                  return (
                    <div className="pt-1 flex items-center justify-between gap-3">
                      <p className="text-xs text-muted-foreground truncate flex-1 hidden sm:block">
                        Next: <span className="text-foreground font-semibold">{firstUnfinished.unit.title || firstUnfinished.unit.unitTitle}</span>
                      </p>
                      <Link
                        href={`/courses/${course.slug}/video/${firstUnfinished.videoId}`}
                        className="px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-bold shadow-md shadow-primary-600/30 transition-all flex items-center gap-2 hover:scale-105 active:scale-95 ml-auto"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Start Today&apos;s Target</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="p-6 rounded-2xl bg-card/70 border border-emerald-500/30 text-center space-y-2">
                <Award className="w-10 h-10 text-emerald-400 mx-auto" />
                <h4 className="text-base font-bold text-foreground">
                  🎉 Course Targets Fully Completed!
                </h4>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  You have completed all daily study targets for this course. Excellent consistency!
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── COURSE ROADMAP OVERVIEW PILLS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-card/80 border border-card-border space-y-1">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            {scheduleMode === 'paced' ? 'Daily Targets' : 'Upload Drops'}
          </p>
          <p className="text-xl sm:text-2xl font-black text-foreground">{totalDays}</p>
        </div>

        <div className="p-3.5 rounded-2xl bg-card/80 border border-card-border space-y-1">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            Completed Days
          </p>
          <p className="text-xl sm:text-2xl font-black text-emerald-500">
            {completedDaysCount}
            <span className="text-xs text-muted-foreground font-normal ml-1">/ {totalDays}</span>
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-card/80 border border-card-border space-y-1">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            Lectures Finished
          </p>
          <p className="text-xl sm:text-2xl font-black text-primary-500">
            {Math.min(overallTotalUnits, overallCompletedUnits)}
            <span className="text-xs text-muted-foreground font-normal ml-1">/ {overallTotalUnits}</span>
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-card/80 border border-card-border space-y-1">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            Roadmap Progress
          </p>
          <p className="text-xl sm:text-2xl font-black text-foreground">
            {overallTotalUnits > 0
              ? Math.round((Math.min(overallTotalUnits, overallCompletedUnits) / overallTotalUnits) * 100)
              : 0}
            %
          </p>
        </div>
      </div>

      {/* ── TARGET PACE TOGGLE & SEARCH TOOLBAR ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-2">
        {/* Schedule Mode Selector: Paced (~1.5h/day) vs Raw LMS Upload Drops */}
        <div className="inline-flex items-center p-1 rounded-2xl bg-card border border-card-border text-xs font-semibold self-start shrink-0">
          <button
            type="button"
            onClick={() => setScheduleMode('paced')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              scheduleMode === 'paced'
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            <span>Paced Daily Targets (~1.5h / day)</span>
          </button>

          <button
            type="button"
            onClick={() => setScheduleMode('raw_batches')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              scheduleMode === 'raw_batches'
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span>Upload Drop Batches</span>
          </button>
        </div>

        {/* Status Filters & Search Bar */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Status Filter Pills */}
          <div className="flex items-center gap-1 p-1 rounded-2xl bg-card border border-card-border text-xs font-semibold">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`px-2.5 py-1 rounded-xl transition-all cursor-pointer ${
                filterMode === 'all'
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All ({totalDays})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('pending')}
              className={`px-2.5 py-1 rounded-xl transition-all cursor-pointer ${
                filterMode === 'pending'
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Pending ({totalDays - completedDaysCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('completed')}
              className={`px-2.5 py-1 rounded-xl transition-all cursor-pointer ${
                filterMode === 'completed'
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Done ({completedDaysCount})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 sm:w-56">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search topic or date..."
              className="w-full pl-8 pr-8 py-1.5 rounded-xl bg-card border border-card-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary-500 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-xs shrink-0">
            <button
              type="button"
              onClick={expandAll}
              className="px-2.5 py-1.5 rounded-xl bg-card border border-card-border hover:bg-card/80 text-muted-foreground hover:text-foreground font-semibold transition-colors cursor-pointer"
            >
              Expand
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="px-2.5 py-1.5 rounded-xl bg-card border border-card-border hover:bg-card/80 text-muted-foreground hover:text-foreground font-semibold transition-colors cursor-pointer"
            >
              Collapse
            </button>
          </div>
        </div>
      </div>

      {/* ── DAILY TARGETS LIST (CHRONOLOGICAL UPLOAD DAYS) ── */}
      {filteredDays.length === 0 ? (
        <div className="p-8 text-center glass-panel rounded-2xl border border-card-border space-y-2">
          <CalendarDays className="w-8 h-8 text-muted-foreground mx-auto opacity-50" />
          <p className="text-sm font-semibold text-foreground">No matching days found</p>
          <p className="text-xs text-muted-foreground">
            No daily targets matched &quot;{searchQuery}&quot; with current status filter.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredDays.map((day) => {
            const isExpanded = !!expandedDays[day.dayNumber] || searchQuery.trim() !== '';

            return (
              <div
                key={day.dayNumber}
                className={`glass-card rounded-2xl border transition-all overflow-hidden ${
                  day.isNextTarget
                    ? 'border-primary-500/50 shadow-lg shadow-primary-500/10'
                    : day.isCompleted
                    ? 'border-emerald-500/30'
                    : 'border-card-border'
                }`}
              >
                {/* ── Day Header (Clickable) ── */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleDay(day.dayNumber)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleDay(day.dayNumber);
                    }
                  }}
                  className="w-full text-left p-3.5 sm:p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 hover:bg-primary-500/5 transition-colors cursor-pointer group select-none"
                >
                  {/* Left: Day Badge + Topic Title + Release Date */}
                  <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                    <div
                      className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center font-black text-xs sm:text-sm shrink-0 mt-0.5 sm:mt-0 transition-transform group-hover:scale-105 ${
                        day.isCompleted
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : day.isNextTarget
                          ? 'bg-primary-500 text-white shadow-md shadow-primary-500/30'
                          : 'bg-primary-500/10 text-primary-400 border border-primary-500/20'
                      }`}
                    >
                      {day.isCompleted ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      ) : (
                        `D${day.dayNumber}`
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm sm:text-base font-bold text-foreground leading-snug">
                          Day {day.dayNumber}: {day.targetTitle}
                        </h3>

                        {day.isNextTarget && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-500/20 border border-primary-500/40 text-primary-400 text-[10px] font-black uppercase tracking-wider">
                            <Target className="w-3 h-3" />
                            <span>Today&apos;s Target</span>
                          </span>
                        )}

                        {day.isCompleted && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                            <Check className="w-3 h-3" />
                            <span>Done</span>
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                        <CalendarDays className="w-3.5 h-3.5 text-slate-500" />
                        <span>Uploaded: {day.formattedDate} ({day.dayOfWeek})</span>
                      </p>
                    </div>
                  </div>

                  {/* Right: Metrics + Progress + Chevron */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-card-border/60">
                    <div className="flex items-center gap-2 text-xs">
                      {/* Lectures & Duration Pill */}
                      <span className="px-2.5 py-1 rounded-lg bg-card/80 border border-card-border text-foreground font-semibold flex items-center gap-1.5">
                        <Video className="w-3.5 h-3.5 text-primary-400" />
                        <span>{day.totalLectures} {day.totalLectures === 1 ? 'Lecture' : 'Lectures'}</span>
                        <span className="text-muted-foreground">•</span>
                        <Clock className="w-3.5 h-3.5 text-primary-400" />
                        <span>{formatDurationHms(day.totalSeconds)}</span>
                      </span>

                      {/* Completion status pill */}
                      <span className="font-mono text-xs text-muted-foreground hidden xs:inline-block">
                        {day.completedCount}/{day.totalLectures}
                      </span>
                    </div>

                    <div className="p-1 rounded-lg bg-card/60 border border-card-border text-muted-foreground group-hover:text-foreground transition-colors shrink-0">
                      <ChevronDown
                        className={`w-4 h-4 transition-transform duration-200 ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                      />
                    </div>
                  </div>
                </div>

                {/* ── Lectures Table / Grid for This Date ── */}
                {isExpanded && (
                  <div className="border-t border-card-border/80 bg-background/50 divide-y divide-card-border/50">
                    {day.items.map((item, itIdx) => {
                      const isItemCompleted =
                        !!item.videoId && completedVideos.includes(item.videoId);
                      const unitDuration = formatUnitDuration(item.durationSeconds);
                      const config = getUnitMetaConfig(item.unit);

                      return (
                        <div
                          key={item.unit.id || itIdx}
                          className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-card/40 transition-colors"
                        >
                          {/* Unit Title, Checkbox & Section Badge */}
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            {/* Interactive Completion Toggle Checkbox */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (item.videoId) {
                                  onToggleComplete(item.videoId);
                                }
                              }}
                              className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 mt-0.5 border transition-all cursor-pointer ${
                                isItemCompleted
                                  ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm'
                                  : 'border-card-border hover:border-primary-500 text-transparent'
                              }`}
                              title={isItemCompleted ? 'Mark as incomplete' : 'Mark as completed'}
                            >
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </button>

                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-0.5 rounded-md bg-card border border-card-border">
                                  {item.sectionTitle}
                                </span>
                                {item.unit.subtitle && (
                                  <span className="text-[10px] text-primary-400 font-medium">
                                    {item.unit.subtitle}
                                  </span>
                                )}
                              </div>

                              <h4
                                className={`text-xs sm:text-sm font-semibold leading-snug ${
                                  isItemCompleted
                                    ? 'line-through text-muted-foreground'
                                    : 'text-foreground'
                                }`}
                              >
                                {item.unit.title || item.unit.unitTitle || 'Lesson'}
                              </h4>
                            </div>
                          </div>

                          {/* Unit Actions & Duration */}
                          <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 pl-8 sm:pl-0">
                            {unitDuration && (
                              <span className="text-[11px] font-mono text-muted-foreground flex items-center gap-1 bg-card/60 px-2 py-1 rounded-md border border-card-border/60">
                                <Clock className="w-3 h-3" />
                                <span>{unitDuration}</span>
                              </span>
                            )}

                            {/* Download Action (if available) */}
                            {isUnlocked && onDownloadUnit && item.videoId && (
                              <button
                                type="button"
                                onClick={(e) =>
                                  onDownloadUnit(e, item.unit, item.sectionTitle, item.sectionId)
                                }
                                className="p-1.5 rounded-lg bg-card hover:bg-card-border/60 text-muted-foreground hover:text-foreground border border-card-border transition-colors cursor-pointer"
                                title="Download for offline study"
                              >
                                <ArrowDownToLine className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Play / View Button */}
                            {item.videoId ? (
                              <Link
                                href={`/courses/${course.slug}/video/${item.videoId}`}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm ${
                                  isItemCompleted
                                    ? 'bg-card hover:bg-card-border/60 text-foreground border border-card-border'
                                    : 'bg-primary-600 hover:bg-primary-500 text-white shadow-primary-600/20'
                                }`}
                              >
                                <Play className="w-3 h-3 fill-current" />
                                <span>{isItemCompleted ? 'Re-watch' : 'Watch'}</span>
                              </Link>
                            ) : item.unit.fileUrl ? (
                              <a
                                href={item.unit.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1.5 rounded-xl bg-card hover:bg-card-border/60 text-foreground border border-card-border text-xs font-semibold flex items-center gap-1.5"
                              >
                                <span>Open File</span>
                              </a>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
