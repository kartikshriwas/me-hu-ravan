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
  ChevronDown,
  Search,
  X,
  ArrowDownToLine,
  Check,
  Video,
  TrendingUp,
  Award,
  Navigation,
  Loader2,
  Pause,
  Trash2,
  Sparkles,
  Settings,
  RotateCcw,
} from 'lucide-react';
import { CourseDetail, CourseSectionUnit } from '@/lib/types';
import { fetchUserProgressFromDb } from '@/lib/userProgressClient';
import { useDownloads } from '@/lib/downloadContext';
import { getRememberedQuality, saveRememberedQuality } from '@/lib/qualityMatcher';

interface CalendarUnitItem {
  unit: CourseSectionUnit;
  sectionTitle: string;
  sectionId: string;
  videoId: string;
  durationSeconds: number;
  isActionableVideo: boolean;
  isYouTube: boolean;
  uploadDateStr: string; // YYYY-MM-DD
}

export interface CalendarDayGroup {
  dayNumber: number;
  dateKey: string; // Scheduled calendar date YYYY-MM-DD
  formattedDate: string; // e.g. "9 Feb 2026"
  dayOfWeek: string; // e.g. "Monday"
  targetTitle: string; // e.g. "Variables & Data Types"
  originalUploadDate?: string; // e.g. "7 Feb 2026"
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
  onToggleComplete?: (videoId: string) => void;
  onBatchToggleComplete?: (videoIds: string[], markComplete: boolean) => void;
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

function getLocalDateStr(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

function addDaysToDateStr(dateStr: string, daysToAdd: number): string {
  const parts = dateStr.split('-').map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  d.setDate(d.getDate() + daysToAdd);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function CourseCalendarView({
  course,
  isUnlocked = true,
  completedVideos,
  onToggleComplete,
  onBatchToggleComplete,
  onDownloadUnit,
  formatUnitDuration,
  getUnitMetaConfig,
}: CourseCalendarViewProps) {
  const {
    isDownloaded,
    isDownloading,
    isQueued,
    isPaused,
    isFailed,
    retryDownload,
    getDownloadProgress,
    downloadSection,
    deleteDownload,
    pauseDownload,
    resumeDownload,
  } = useDownloads();

  const [dayQualityModal, setDayQualityModal] = useState<{
    dayNumber: number;
    title: string;
    units: { videoId: string; unitTitle: string; duration?: number }[];
  } | null>(null);
  const [selectedDayQuality, setSelectedDayQuality] = useState<string>('720p');
  const [rememberPreference, setRememberPreference] = useState<boolean>(false);

  useEffect(() => {
    setSelectedDayQuality(getRememberedQuality('720p'));
    if (typeof window !== 'undefined') {
      setRememberPreference(localStorage.getItem('preptea_remember_download_quality') === 'true');
    }
  }, []);

  const formatDayEstimatedSize = (quality: string) => {
    if (!dayQualityModal) return '';
    const kbpsMap: Record<string, number> = {
      '1080p': 924,
      '720p': 552,
      '540p': 393,
      '360p': 267,
    };
    const kbps = kbpsMap[quality] || 552;
    const numVideos = dayQualityModal.units.length || 1;
    const totalSecs = dayQualityModal.units.reduce((acc, u) => acc + (u.duration || 0), 0);

    if (totalSecs > 0) {
      const totalBytes = totalSecs * (kbps * 1000 / 8);
      const totalMb = totalBytes / (1024 * 1024);
      const avgMb = totalMb / numVideos;

      if (numVideos === 1) {
        return totalMb >= 1024 ? `~${(totalMb / 1024).toFixed(1)} GB` : `~${totalMb.toFixed(1)} MB`;
      }

      const totalStr = totalMb >= 1024 ? `${(totalMb / 1024).toFixed(1)} GB` : `${Math.round(totalMb)} MB`;
      const avgStr = avgMb >= 1024 ? `${(avgMb / 1024).toFixed(1)} GB/lesson` : `${Math.round(avgMb)} MB/lesson`;
      return `${totalStr} • ~${avgStr}`;
    }

    const fallbackSecs = numVideos * 600;
    const totalBytes = fallbackSecs * (kbps * 1000 / 8);
    const totalMb = totalBytes / (1024 * 1024);
    const avgMb = totalMb / numVideos;
    if (numVideos === 1) {
      return `~${Math.round(totalMb)} MB`;
    }
    return `${totalMb >= 1024 ? (totalMb / 1024).toFixed(1) + ' GB' : Math.round(totalMb) + ' MB'} • ~${Math.round(avgMb)} MB/lesson`;
  };

  const handleDownloadDay = (day: CalendarDayGroup) => {
    if (!isUnlocked) return;
    const units = day.items
      .filter((it) => it.videoId && it.isActionableVideo && !it.isYouTube)
      .map((it) => ({
        videoId: it.videoId,
        unitTitle: it.unit.unitTitle || it.unit.title || 'Lesson',
        duration: it.durationSeconds,
      }));

    if (units.length === 0) return;

    if (typeof window !== 'undefined' && localStorage.getItem('preptea_remember_download_quality') === 'true') {
      const cleanQuality = getRememberedQuality('720p');
      downloadSection({
        courseSlug: course.slug,
        courseTitle: course.title,
        sectionTitle: `Day ${day.dayNumber}: ${day.targetTitle}`,
        preferredQuality: cleanQuality,
        units,
      });
      return;
    }

    setSelectedDayQuality(getRememberedQuality('720p'));
    setDayQualityModal({
      dayNumber: day.dayNumber,
      title: `Day ${day.dayNumber}: ${day.targetTitle}`,
      units,
    });
  };

  // Paced targets (~1.5h - 2h per day across 4-6 months) vs Raw bulk upload drop batches
  const [scheduleMode, setScheduleMode] = useState<'paced' | 'raw_batches'>('paced');
  const [filterMode, setFilterMode] = useState<'all' | 'pending' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedDays, setExpandedDays] = useState<Record<number, boolean>>({});
  const [streakData, setStreakData] = useState<StreakState>({
    currentStreak: 0,
    longestStreak: 0,
    studiedToday: false,
    activeDaysThisWeek: [false, false, false, false, false, false, false],
  });

  // 1. Calculate & manage authentic learning streak from localStorage
  useEffect(() => {
    const calculateStreak = () => {
      try {
        const today = new Date();
        const todayStr = getLocalDateStr(today);
        const isoTodayStr = today.toISOString().split('T')[0];

        const raw = localStorage.getItem('preptea_learning_streak_data');
        let studyDays: string[] = [];

        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed.studyDays)) {
            studyDays = parsed.studyDays;
          }
        }

        const validDays = Array.from(
          new Set(studyDays.filter((d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)))
        ).sort();
        const daySet = new Set(validDays);

        const studiedToday = daySet.has(todayStr) || daySet.has(isoTodayStr);

        let currentStreak = 0;

        if (studiedToday) {
          currentStreak = 1;
          const cursor = new Date(today);
          cursor.setDate(cursor.getDate() - 1);
          for (let i = 0; i < 365; i++) {
            const dStr = getLocalDateStr(cursor);
            const isoStr = cursor.toISOString().split('T')[0];
            if (daySet.has(dStr) || daySet.has(isoStr)) {
              currentStreak++;
              cursor.setDate(cursor.getDate() - 1);
            } else {
              break;
            }
          }
        } else {
          // Check if yesterday was studied to keep streak alive
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = getLocalDateStr(yesterday);
          const isoYesterdayStr = yesterday.toISOString().split('T')[0];

          if (daySet.has(yesterdayStr) || daySet.has(isoYesterdayStr)) {
            currentStreak = 1;
            const cursor = new Date(yesterday);
            cursor.setDate(cursor.getDate() - 1);
            for (let i = 0; i < 365; i++) {
              const dStr = getLocalDateStr(cursor);
              const isoStr = cursor.toISOString().split('T')[0];
              if (daySet.has(dStr) || daySet.has(isoStr)) {
                currentStreak++;
                cursor.setDate(cursor.getDate() - 1);
              } else {
                break;
              }
            }
          } else {
            currentStreak = 0;
          }
        }

        // Calculate all-time longest contiguous streak
        let maxStreak = 0;
        let tempStreak = 0;
        let prevDate: Date | null = null;

        for (const dStr of validDays) {
          const [y, m, d] = dStr.split('-').map(Number);
          const curDate = new Date(y, m - 1, d);

          if (prevDate) {
            const diffDays = Math.round((curDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays === 1) {
              tempStreak++;
            } else if (diffDays > 1) {
              tempStreak = 1;
            }
          } else {
            tempStreak = 1;
          }
          prevDate = curDate;
          if (tempStreak > maxStreak) {
            maxStreak = tempStreak;
          }
        }

        maxStreak = Math.max(maxStreak, currentStreak);
        const savedMax = parseInt(localStorage.getItem('preptea_max_streak') || '0', 10);
        const allTimeMax = Math.max(maxStreak, savedMax);
        if (allTimeMax > savedMax && allTimeMax > 0) {
          localStorage.setItem('preptea_max_streak', allTimeMax.toString());
        }

        // Monday-to-Sunday of current week
        const currentDayOfWeek = (today.getDay() + 6) % 7;
        const monday = new Date(today);
        monday.setDate(today.getDate() - currentDayOfWeek);

        const weekFlags = [0, 1, 2, 3, 4, 5, 6].map((offset) => {
          const d = new Date(monday);
          d.setDate(monday.getDate() + offset);
          const dStr = getLocalDateStr(d);
          const isoStr = d.toISOString().split('T')[0];
          return daySet.has(dStr) || daySet.has(isoStr);
        });

        setStreakData({
          currentStreak,
          longestStreak: allTimeMax,
          studiedToday,
          activeDaysThisWeek: weekFlags,
        });
      } catch (e) {
        // ignore
      }
    };

    calculateStreak();

    window.addEventListener('storage', calculateStreak);
    window.addEventListener('focus', calculateStreak);
    window.addEventListener('preptea_study_update', calculateStreak);

    return () => {
      window.removeEventListener('storage', calculateStreak);
      window.removeEventListener('focus', calculateStreak);
      window.removeEventListener('preptea_study_update', calculateStreak);
    };
  }, [completedVideos]);

  // Fetch verified streak and activity metrics from MongoDB once on mount
  useEffect(() => {
    fetchUserProgressFromDb().then((data) => {
      if (data?.streak) {
        setStreakData({
          currentStreak: data.streak.currentStreak,
          longestStreak: data.streak.longestStreak,
          studiedToday: data.streak.studiedToday,
          activeDaysThisWeek: data.streak.activeDaysThisWeek,
        });
      }
    });
  }, []);

  // 2. Group all units into either Sprint Paced Targets or Raw Upload Batches
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

        const isYouTube = (unit.objectType || unit.type || '').toLowerCase() === 'youtube';

        const videoId = unit.sourceid || unit.id || '';

        allUnitsList.push({
          unit,
          sectionTitle: sec.title,
          sectionId: sec.id,
          videoId,
          durationSeconds: unit.duration || 0,
          isActionableVideo: cfg.isActionableVideo,
          isYouTube,
          uploadDateStr: dateKey,
        });
      });
    });

    const result: CalendarDayGroup[] = [];

    // ─────────────────────────────────────────────────────────────
    // MODE A: PACED DAILY TARGETS (~1.5h - 2h per day across 4-6 months)
    // ─────────────────────────────────────────────────────────────
    if (scheduleMode === 'paced') {
      interface PacedBlock {
        title: string;
        items: CalendarUnitItem[];
        uploadDate: string;
      }

      // Balanced pacing thresholds
      const TARGET_MIN_MERGE = 3000; // 50 mins: accumulate micro-sections under this duration
      const TARGET_SPLIT_THRESHOLD = 7500; // 2h 05m: split chapters exceeding this duration
      const TARGET_IDEAL = 4800; // 1h 20m: target daily study length
      const TARGET_MAX_DAY = 7500; // 2h 05m: maximum daily block duration

      // Equal-weight split function that divides chapters into 50/50 (or 33/33/33) balanced blocks
      const splitIntoBalancedParts = (
        title: string,
        items: CalendarUnitItem[],
        uploadDate: string
      ): PacedBlock[] => {
        const totalSec = items.reduce((acc, it) => acc + it.durationSeconds, 0);
        if (totalSec < TARGET_SPLIT_THRESHOLD || items.length <= 1) {
          return [{ title, items, uploadDate }];
        }

        const numParts = Math.max(2, Math.round(totalSec / TARGET_IDEAL));
        const targetPerPart = totalSec / numParts;

        const parts: PacedBlock[] = [];
        let currentChunk: CalendarUnitItem[] = [];
        let currentSec = 0;
        let partIndex = 1;

        items.forEach((it) => {
          const diffWithout = Math.abs(currentSec - targetPerPart);
          const diffWith = Math.abs(currentSec + it.durationSeconds - targetPerPart);

          if (
            currentChunk.length > 0 &&
            partIndex < numParts &&
            currentSec >= 2400 && // Ensure at least 40 min in this part
            (currentSec >= targetPerPart || diffWithout < diffWith)
          ) {
            parts.push({
              title: `${title} (Part ${partIndex})`,
              items: currentChunk,
              uploadDate,
            });
            currentChunk = [];
            currentSec = 0;
            partIndex++;
          }

          currentChunk.push(it);
          currentSec += it.durationSeconds;
        });

        if (currentChunk.length > 0) {
          parts.push({
            title: parts.length > 0 ? `${title} (Part ${partIndex})` : title,
            items: currentChunk,
            uploadDate,
          });
        }

        return parts;
      };

      const topicBlocks: PacedBlock[] = [];

      course.sections.forEach((sec) => {
        const secUnits = allUnitsList.filter((it) => it.sectionId === sec.id);
        if (secUnits.length === 0) return;

        // Check if section has separate dates per lecture (e.g. Practice Sessions / Live Sessions)
        const distinctDates = Array.from(new Set(secUnits.map((it) => it.uploadDateStr)));

        if (distinctDates.length > 1) {
          // Group by individual date inside this section (keeps live sessions on distinct dates)
          const byDateMap = new Map<string, CalendarUnitItem[]>();
          secUnits.forEach((it) => {
            if (!byDateMap.has(it.uploadDateStr)) {
              byDateMap.set(it.uploadDateStr, []);
            }
            byDateMap.get(it.uploadDateStr)!.push(it);
          });

          byDateMap.forEach((uList, dt) => {
            const dtTotal = uList.reduce((acc, it) => acc + it.durationSeconds, 0);
            if (dtTotal > 10800 && uList.length > 1) {
              topicBlocks.push(...splitIntoBalancedParts(sec.title, uList, dt));
            } else {
              topicBlocks.push({
                title: sec.title,
                items: uList,
                uploadDate: dt,
              });
            }
          });
        } else {
          // Single upload date section (e.g. theory chapters): balanced equal-weight split
          topicBlocks.push(...splitIntoBalancedParts(sec.title, secUnits, secUnits[0].uploadDateStr));
        }
      });

      // Sort topic blocks chronologically by upload date
      const sortedBlocks = topicBlocks.sort((a, b) => {
        if (a.uploadDate === 'unscheduled') return 1;
        if (b.uploadDate === 'unscheduled') return -1;
        return a.uploadDate.localeCompare(b.uploadDate);
      });

      // Helper to cleanly format combined titles (e.g. "Course Introduction, Prerequisites & Flowcharts")
      const formatCombinedTitle = (titles: string[]): string => {
        const cleaned = titles
          .map((t) =>
            t
              .replace(/ - Installation Resources/gi, '')
              .replace(/ \(Recordings\)/gi, '')
              .trim()
          )
          .filter(Boolean);

        const unique = Array.from(new Set(cleaned));
        if (unique.length === 0) return 'Daily Learning Target';
        if (unique.length === 1) return unique[0];
        if (unique.length === 2) return `${unique[0]} & ${unique[1]}`;
        return `${unique.slice(0, -1).join(', ')} & ${unique[unique.length - 1]}`;
      };

      // PASS 1: FORWARD ACCUMULATION (accumulate until each daily target is >= TARGET_MIN_MERGE)
      const forwardAccumulatedBlocks: {
        titleParts: string[];
        items: CalendarUnitItem[];
        uploadDate: string;
      }[] = [];

      let i = 0;
      while (i < sortedBlocks.length) {
        let cur = {
          titleParts: [sortedBlocks[i].title],
          items: [...sortedBlocks[i].items],
          uploadDate: sortedBlocks[i].uploadDate,
        };
        let curDur = cur.items.reduce((acc, it) => acc + it.durationSeconds, 0);
        i++;

        // Keep absorbing subsequent adjacent topics from the same release sprint while duration is under 50 mins
        while (curDur < TARGET_MIN_MERGE && i < sortedBlocks.length) {
          const nxt = sortedBlocks[i];
          if (nxt.uploadDate !== cur.uploadDate && cur.uploadDate !== 'unscheduled') break;
          const nxtDur = nxt.items.reduce((acc, it) => acc + it.durationSeconds, 0);
          if (curDur + nxtDur > TARGET_MAX_DAY) break;

          cur.titleParts.push(nxt.title);
          cur.items.push(...nxt.items);
          curDur += nxtDur;
          i++;
        }

        forwardAccumulatedBlocks.push(cur);
      }

      // PASS 2: BACKWARD MERGE for any trailing topic that is still < TARGET_MIN_MERGE
      // (e.g. Patterns Part 1 at the end of the sprint batch merges into Loops to form a complete 1h 58m day)
      const mergedBlocks: PacedBlock[] = [];
      for (let j = 0; j < forwardAccumulatedBlocks.length; j++) {
        const blk = forwardAccumulatedBlocks[j];
        const blkDur = blk.items.reduce((acc, it) => acc + it.durationSeconds, 0);

        if (blkDur < TARGET_MIN_MERGE && mergedBlocks.length > 0) {
          const prev = mergedBlocks[mergedBlocks.length - 1];
          const prevDur = prev.items.reduce((acc, it) => acc + it.durationSeconds, 0);

          if (
            (prev.uploadDate === blk.uploadDate || blk.uploadDate === 'unscheduled') &&
            prevDur + blkDur <= TARGET_MAX_DAY
          ) {
            prev.title = formatCombinedTitle([prev.title, ...blk.titleParts]);
            prev.items.push(...blk.items);
            continue;
          }
        }

        mergedBlocks.push({
          title: formatCombinedTitle(blk.titleParts),
          items: blk.items,
          uploadDate: blk.uploadDate,
        });
      }

      // Distribute across actual consecutive calendar days spanning the 4-6 months!
      let currentCalDate = '2026-02-07';
      const firstValidDate = mergedBlocks.find((b) => b.uploadDate !== 'unscheduled')?.uploadDate;
      if (firstValidDate) {
        currentCalDate = firstValidDate;
      }

      let dayNum = 1;
      mergedBlocks.forEach((block) => {
        // If this topic was uploaded on a later date, advance our calendar date to at least that date
        if (block.uploadDate !== 'unscheduled' && block.uploadDate > currentCalDate) {
          currentCalDate = block.uploadDate;
        }

        const scheduledDateStr = currentCalDate;
        const { formatted, dayOfWeek } = formatDateDisplay(scheduledDateStr);
        const { formatted: origFormatted } = formatDateDisplay(block.uploadDate);

        const totalSec = block.items.reduce((acc, it) => acc + it.durationSeconds, 0);
        const completedCount = block.items.filter(
          (it) => it.videoId && completedVideos.includes(it.videoId)
        ).length;

        const isCompleted = block.items.length > 0 && completedCount === block.items.length;
        const progressPercent =
          block.items.length > 0 ? Math.round((completedCount / block.items.length) * 100) : 0;

        result.push({
          dayNumber: dayNum++,
          dateKey: scheduledDateStr,
          formattedDate: formatted,
          dayOfWeek,
          targetTitle: block.title,
          originalUploadDate: origFormatted,
          items: block.items,
          totalSeconds: totalSec,
          totalLectures: block.items.length,
          completedCount,
          isCompleted,
          isNextTarget: false,
          progressPercent,
        });

        // Step forward 1 calendar day for the next topic
        currentCalDate = addDaysToDateStr(currentCalDate, 1);
      });
    }

    // ─────────────────────────────────────────────────────────────
    // MODE B: RAW LMS UPLOAD BATCHES (42 Raw Drops)
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
          originalUploadDate: formatted,
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
          const isCompleted = items.length > 0 && completedCount === items.length;
          const progressPercent =
            items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

          result.push({
            dayNumber: dayNum++,
            dateKey: 'unscheduled',
            formattedDate: formatted,
            dayOfWeek,
            targetTitle: 'Course Resources & Extras',
            originalUploadDate: formatted,
            items,
            totalSeconds: totalSec,
            totalLectures: items.length,
            completedCount,
            isCompleted,
            isNextTarget: false,
            progressPercent,
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
  const courseVideoIdSet = useMemo(() => {
    const ids = new Set<string>();
    course.sections.forEach((s) =>
      s.units.forEach((u) => {
        const vid = u.sourceid || u.id;
        if (vid) ids.add(vid);
      })
    );
    return ids;
  }, [course]);

  const overallCompletedUnits = useMemo(
    () => completedVideos.filter((id) => courseVideoIdSet.has(id)).length,
    [completedVideos, courseVideoIdSet]
  );
  const overallTotalUnits = calendarDays.reduce((acc, d) => acc + d.totalLectures, 0);
  const totalCourseSeconds = useMemo(
    () => calendarDays.reduce((acc, d) => acc + d.totalSeconds, 0),
    [calendarDays]
  );
  const targetEndDate = useMemo(() => {
    if (calendarDays.length === 0) return '';
    const lastDay = calendarDays[calendarDays.length - 1];
    return lastDay?.formattedDate || '';
  }, [calendarDays]);

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

  // Jump smoothly to the current pending target day
  const jumpToActiveDay = () => {
    const nextDay = calendarDays.find((d) => d.isNextTarget) || calendarDays[0];
    if (nextDay) {
      setExpandedDays((prev) => ({ ...prev, [nextDay.dayNumber]: true }));
      setTimeout(() => {
        const el = document.getElementById(`calendar-day-${nextDay.dayNumber}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 50);
    }
  };

  return (
    <div className="space-y-5">
      {/* ── STREAK & TODAY'S TARGET HERO CARD ── */}
      <div className="rounded-2xl p-5 sm:p-6 border border-card-border bg-card/60 backdrop-blur-sm relative overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Left: Streak Counter & Weekly Pulse */}
          <div className="lg:col-span-5 space-y-3.5 relative">
            {/* Theme-aligned ambient glow behind streak and weekly activity */}
            <div className="absolute -top-10 -left-10 w-64 h-64 bg-primary-500/20 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center gap-2 flex-wrap relative z-10">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-400 text-xs font-semibold shadow-sm">
                <Flame className="w-3.5 h-3.5 fill-current text-orange-400" />
                <span>Daily Learning Streak</span>
              </span>
              {streakData.studiedToday && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
                  <Check className="w-3 h-3 stroke-[2.5]" />
                  <span>Daily Habit Active</span>
                </span>
              )}
            </div>

            <div className="flex items-baseline gap-2.5 relative z-10">
              <span className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
                {streakData.currentStreak}
              </span>
              <div className="text-left">
                <p className="text-sm font-semibold text-foreground">
                  Day{streakData.currentStreak === 1 ? '' : 's'} Streak
                </p>
                <p className="text-xs text-muted-foreground">
                  Best: <span className="font-medium text-foreground/85">{streakData.longestStreak} days in a row</span>
                </p>
              </div>
            </div>

            {/* Weekly 7-Day Activity Strip with solid color block background behind M T W T F S S */}
            <div className="pt-3 mt-1 space-y-2 relative z-10 border-t border-white/[0.06]">
              <span className="block text-[11px] font-semibold text-muted-foreground tracking-wide">
                This Week&apos;s Activity
              </span>
              <div className="flex items-center gap-2 flex-nowrap">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((dayLetter, idx) => {
                  const isActive = streakData.activeDaysThisWeek[idx];
                  const isTodayIndex = (new Date().getDay() + 6) % 7 === idx;

                  return (
                    <div
                      key={idx}
                      className="flex flex-col items-center"
                      title={isActive ? `Day ${idx + 1}: Studied` : `Day ${idx + 1}`}
                    >
                      <div
                        className={`w-7.5 h-7.5 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center font-bold text-xs transition-colors border ${
                          isActive
                            ? 'bg-amber-500 border-amber-400 text-slate-950 shadow-sm'
                            : isTodayIndex
                            ? 'bg-card border-2 border-primary-500 text-foreground font-black'
                            : 'bg-card border-card-border text-muted-foreground hover:border-card-border/80'
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
              <div className="p-4 sm:p-5 rounded-xl bg-card/80 border border-card-border space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                      <span className="font-semibold text-primary-400">
                        Today&apos;s Target
                      </span>
                      <span>•</span>
                      <span>Day {nextTargetDay.dayNumber} of {totalDays}</span>
                      <span>•</span>
                      <span>{nextTargetDay.formattedDate}</span>
                      {streakData.studiedToday && nextTargetDay.progressPercent === 0 && (
                        <>
                          <span>•</span>
                          <span className="text-amber-400 font-medium">
                            Pending today (studied other topics)
                          </span>
                        </>
                      )}
                    </div>
                    <h4 className="text-base font-bold text-foreground leading-snug truncate mt-1">
                      {nextTargetDay.targetTitle}
                    </h4>
                  </div>

                  {/* Circle Progress Bar with Number in Between */}
                  <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
                    <svg className="w-14 h-14 -rotate-90" viewBox="0 0 60 60">
                      <circle
                        cx="30"
                        cy="30"
                        r={24}
                        className="stroke-card-border"
                        strokeWidth="4.5"
                        fill="transparent"
                      />
                      <circle
                        cx="30"
                        cy="30"
                        r={24}
                        className="stroke-primary-500 transition-all duration-300"
                        strokeWidth="4.5"
                        strokeDasharray={2 * Math.PI * 24}
                        strokeDashoffset={
                          2 * Math.PI * 24 - (nextTargetDay.progressPercent / 100) * (2 * Math.PI * 24)
                        }
                        strokeLinecap="round"
                        fill="transparent"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none pointer-events-none">
                      <span className="text-xs font-bold font-mono text-foreground leading-none">
                        {nextTargetDay.completedCount}/{nextTargetDay.totalLectures}
                      </span>
                      <span className="text-[9px] font-medium text-muted-foreground leading-none mt-0.5">
                        Done
                      </span>
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1">
                  <div className="w-full h-1.5 rounded-full bg-slate-800/80 overflow-hidden">
                    <div
                      className="h-full bg-primary-500 rounded-full transition-all duration-300"
                      style={{ width: `${nextTargetDay.progressPercent}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>
                      {nextTargetDay.totalLectures} Lectures • {formatDurationHms(nextTargetDay.totalSeconds)} required
                    </span>
                    <span>{nextTargetDay.progressPercent}%</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-0.5 flex items-center justify-end">
                  {(() => {
                    const firstUnfinished =
                      nextTargetDay.items.find(
                        (it) => it.videoId && !completedVideos.includes(it.videoId)
                      ) || nextTargetDay.items[0];

                    if (!firstUnfinished || !firstUnfinished.videoId) return null;

                    return (
                      <Link
                        href={`/courses/${course.slug}/video/${firstUnfinished.videoId}`}
                        className="w-full sm:w-auto px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-bold shadow-md shadow-primary-600/30 transition-all flex items-center justify-center gap-1.5 ml-auto"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>{nextTargetDay.isCompleted ? 'Review Target' : 'Start Target'}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    );
                  })()}
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-xl bg-card border border-emerald-500/30 text-center space-y-2">
                <Award className="w-8 h-8 text-emerald-400 mx-auto" />
                <h4 className="text-base font-bold text-foreground">
                  Course Targets Completed!
                </h4>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  You have completed all scheduled daily targets for this course. Excellent consistency!
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── COURSE ROADMAP OVERVIEW ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-card/50 border border-card-border space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground">
            {scheduleMode === 'paced' ? 'Target Completion' : 'Latest Upload'}
          </span>
          <div className="flex items-baseline gap-1.5">
            <p className="text-xl font-bold text-foreground truncate">
              {targetEndDate || 'In Progress'}
            </p>
            <span className="text-xs text-muted-foreground">
              {scheduleMode === 'paced' ? 'Goal' : 'Drop'}
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-card/50 border border-card-border space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground">
            Completed Days
          </span>
          <div className="flex items-baseline gap-1.5">
            <p className="text-xl font-bold text-emerald-400">{completedDaysCount}</p>
            <span className="text-xs text-muted-foreground">/ {totalDays}</span>
          </div>
          {completedDaysCount === 0 && overallCompletedUnits > 0 && (
            <p className="text-[10px] text-muted-foreground/80 truncate">
              {overallCompletedUnits} lectures done in upcoming days
            </p>
          )}
        </div>

        <div className="p-3.5 rounded-xl bg-card/50 border border-card-border space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground">
            Lectures Finished
          </span>
          <div className="flex items-baseline gap-1.5">
            <p className="text-xl font-bold text-foreground">
              {Math.min(overallTotalUnits, overallCompletedUnits)}
            </p>
            <span className="text-xs text-muted-foreground">/ {overallTotalUnits}</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-card/50 border border-card-border space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground">
            Progress
          </span>
          <div className="flex items-baseline gap-1.5">
            <p className="text-xl font-bold text-foreground">
              {overallTotalUnits > 0
                ? Math.round(
                    (Math.min(overallTotalUnits, overallCompletedUnits) / overallTotalUnits) * 100
                  )
                : 0}
              %
            </p>
            <span className="text-xs text-muted-foreground">Overall</span>
          </div>
        </div>
      </div>

      {/* ── TARGET PACE TOGGLE & SEARCH TOOLBAR ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1">
        {/* Schedule Mode Selector */}
        <div className="inline-flex items-center p-1 rounded-2xl bg-card/85 border border-white/[0.08] shadow-sm backdrop-blur-md text-xs font-semibold self-start shrink-0">
          <button
            type="button"
            onClick={() => setScheduleMode('paced')}
            className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              scheduleMode === 'paced'
                ? 'bg-primary-600 text-white shadow-md shadow-primary-600/30'
                : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04]'
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            <span>Paced Targets</span>
          </button>

          <button
            type="button"
            onClick={() => setScheduleMode('raw_batches')}
            className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              scheduleMode === 'raw_batches'
                ? 'bg-primary-600 text-white shadow-md shadow-primary-600/30'
                : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04]'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span>Upload Batches</span>
          </button>
        </div>

        {/* Status Filters, Active Jump & Search Bar */}
        <div className="flex flex-wrap items-center gap-2 flex-1 lg:justify-end">
          {/* Quick Jump to Active Day */}
          {nextTargetDay && (
            <button
              type="button"
              onClick={jumpToActiveDay}
              className="px-3 py-1.5 rounded-xl bg-primary-500/10 hover:bg-primary-500/20 text-primary-400 border border-primary-500/25 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Jump to Day {nextTargetDay.dayNumber}</span>
            </button>
          )}

          {/* Status Filter Pills */}
          <div className="flex items-center gap-1 p-1 rounded-2xl bg-card/85 border border-white/[0.08] shadow-sm backdrop-blur-md text-xs font-medium">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                filterMode === 'all'
                  ? 'bg-primary-600 text-white font-semibold shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04]'
              }`}
            >
              <span>All</span>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                  filterMode === 'all'
                    ? 'bg-white/20 text-white'
                    : 'bg-white/[0.06] text-muted-foreground'
                }`}
              >
                {totalDays}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('pending')}
              className={`px-3 py-1 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                filterMode === 'pending'
                  ? 'bg-primary-600 text-white font-semibold shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04]'
              }`}
            >
              <span>Pending</span>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                  filterMode === 'pending'
                    ? 'bg-white/20 text-white'
                    : 'bg-white/[0.06] text-muted-foreground'
                }`}
              >
                {totalDays - completedDaysCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('completed')}
              className={`px-3 py-1 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                filterMode === 'completed'
                  ? 'bg-primary-600 text-white font-semibold shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04]'
              }`}
            >
              <span>Done</span>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                  filterMode === 'completed'
                    ? 'bg-white/20 text-white'
                    : 'bg-white/[0.06] text-muted-foreground'
                }`}
              >
                {completedDaysCount}
              </span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 sm:w-56 min-w-[180px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search topic or date..."
              className="w-full pl-9 pr-8 py-1.5 rounded-xl bg-card/85 border border-white/[0.08] text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary-500/60 focus:ring-2 focus:ring-primary-500/15 transition-all shadow-sm backdrop-blur-md"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-md hover:bg-white/10"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Expand / Collapse Controls */}
          <div className="flex items-center gap-1 text-xs shrink-0 p-1 rounded-2xl bg-card/85 border border-white/[0.08] shadow-sm backdrop-blur-md">
            <button
              type="button"
              onClick={expandAll}
              className="px-2.5 py-1 rounded-xl hover:bg-white/[0.06] text-muted-foreground hover:text-foreground font-medium transition-all cursor-pointer"
            >
              Expand
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="px-2.5 py-1 rounded-xl hover:bg-white/[0.06] text-muted-foreground hover:text-foreground font-medium transition-all cursor-pointer"
            >
              Collapse
            </button>
          </div>
        </div>
      </div>

      {/* ── DAILY TARGETS LIST ── */}
      {filteredDays.length === 0 ? (
        <div className="p-8 text-center rounded-xl border border-card-border bg-card/30 space-y-1.5">
          <CalendarDays className="w-7 h-7 text-muted-foreground mx-auto opacity-50" />
          <p className="text-sm font-medium text-foreground">No matching days found</p>
          <p className="text-xs text-muted-foreground">
            No daily targets matched &quot;{searchQuery}&quot; with current status filter.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredDays.map((day) => {
            const isExpanded = !!expandedDays[day.dayNumber] || searchQuery.trim() !== '';

            return (
              <div
                key={day.dayNumber}
                id={`calendar-day-${day.dayNumber}`}
                className={`rounded-xl border transition-colors overflow-hidden ${
                  day.isNextTarget
                    ? 'border-primary-500/40 bg-card/90 shadow-md shadow-primary-500/10'
                    : day.isCompleted
                    ? 'border-card-border/60 bg-card/25'
                    : 'border-card-border/80 bg-card/40 hover:border-primary-500/30'
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
                  className="w-full text-left p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 hover:bg-white/[0.02] transition-colors cursor-pointer group select-none"
                >
                  {/* Left: Day Badge + Topic Title + Date */}
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 transition-all ${
                        day.isCompleted
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm'
                          : day.isNextTarget
                          ? 'bg-primary-500 text-white border border-primary-400 shadow-md shadow-primary-500/25 font-black ring-2 ring-primary-500/30'
                          : 'bg-primary-500/15 text-primary-300 border border-primary-500/25 shadow-sm group-hover:bg-primary-500/25 group-hover:text-primary-200'
                      }`}
                    >
                      {day.isCompleted ? (
                        <Check className="w-4 h-4 stroke-[2.5]" />
                      ) : (
                        `D${day.dayNumber}`
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-foreground leading-snug tracking-tight truncate group-hover:text-primary-300 transition-colors">
                          Day {day.dayNumber}: {day.targetTitle}
                        </h3>

                        {day.isNextTarget && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary-500 text-white border border-primary-400 text-[10px] font-bold uppercase tracking-wider shadow-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                            Today&apos;s Target
                          </span>
                        )}

                        {day.isCompleted && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-[10px] font-semibold">
                            <Check className="w-3 h-3 stroke-[2.5]" />
                            Done
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <span>{day.formattedDate} ({day.dayOfWeek})</span>

                      </p>
                    </div>
                  </div>

                  {/* Right: Metrics + Chevron */}
                  <div className="flex items-center justify-between sm:justify-end gap-2.5 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-white/[0.06]">
                    <div className="flex items-center gap-2 text-xs flex-wrap">
                      <span className="text-muted-foreground font-medium flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-card/60 border border-white/[0.06]">
                        <span>{day.totalLectures} {day.totalLectures === 1 ? 'lecture' : 'lectures'}</span>
                        <span className="text-white/20">•</span>
                        <span>{formatDurationHms(day.totalSeconds)}</span>
                      </span>

                      <span className="font-mono text-xs font-bold text-muted-foreground px-2 py-1 rounded-xl bg-card/60 border border-white/[0.06] hidden xs:inline-block">
                        {day.completedCount}/{day.totalLectures}
                      </span>

                      {/* Download Section / Day Button */}
                      {(() => {
                        const dayVideoUnits = day.items
                          .filter((it) => it.videoId && it.isActionableVideo && !it.isYouTube)
                          .map((it) => ({
                            videoId: it.videoId,
                            unitTitle: it.unit.unitTitle || it.unit.title || 'Lesson',
                            duration: it.durationSeconds,
                          }));

                        if (dayVideoUnits.length === 0 || !isUnlocked) return null;

                        const dayDownloadedCount = dayVideoUnits.filter(
                          (it) => isDownloaded(it.videoId) || isDownloaded(it.videoId)
                        ).length;
                        const isAllDayDownloaded = dayDownloadedCount === dayVideoUnits.length;
                        const isDayDownloading = dayVideoUnits.some((it) => isDownloading(it.videoId));

                        if (isAllDayDownloaded) {
                          return (
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                for (const u of dayVideoUnits) {
                                  await deleteDownload(u.videoId);
                                }
                              }}
                              className="px-2.5 py-1 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                              title={`Delete all ${dayVideoUnits.length} downloaded lessons from this section`}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                              <span className="hidden xs:inline">Delete All</span>
                            </button>
                          );
                        }

                        if (isDayDownloading) {
                          return (
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                for (const u of dayVideoUnits) {
                                  pauseDownload(u.videoId);
                                }
                              }}
                              className="px-2.5 py-1 rounded-xl bg-primary-500/15 hover:bg-amber-500/20 border border-primary-500/30 hover:border-amber-500/40 text-primary-400 hover:text-amber-300 text-xs font-bold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer group"
                              title="Section downloading. Click to pause."
                            >
                              <Loader2 className="w-3.5 h-3.5 animate-spin group-hover:hidden" />
                              <Pause className="w-3.5 h-3.5 hidden group-hover:inline text-amber-400" />
                              <span className="group-hover:hidden">{dayDownloadedCount}/{dayVideoUnits.length}</span>
                              <span className="hidden group-hover:inline">Pause All</span>
                            </button>
                          );
                        }

                        return (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleDownloadDay(day);
                            }}
                            className="px-2.5 py-1 rounded-xl bg-primary-600/20 hover:bg-primary-600 text-primary-400 hover:text-white border border-primary-500/30 hover:border-transparent text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 shadow-sm"
                            title={`Download all ${dayVideoUnits.length} lessons in Day ${day.dayNumber}`}
                          >
                            <ArrowDownToLine className="w-3.5 h-3.5" />
                            <span className="hidden xs:inline">Download All</span>
                            <span className="text-[10px] opacity-75 font-mono">({dayVideoUnits.length})</span>
                          </button>
                        );
                      })()}
                    </div>

                    <div className="text-muted-foreground group-hover:text-foreground transition-colors shrink-0 p-1">
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
                  <div className="border-t border-white/[0.06] bg-slate-950/20 backdrop-blur-md divide-y divide-white/[0.04]">
                    {day.items.map((item, itIdx) => {
                      const isItemCompleted =
                        !!item.videoId && completedVideos.includes(item.videoId);
                      const unitDuration = formatUnitDuration(item.durationSeconds);

                      return (
                        <div
                          key={item.unit.id || itIdx}
                          className={`px-3.5 py-2.5 sm:px-5 sm:py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-colors group/item ${
                            isItemCompleted ? 'bg-card/15 opacity-80 hover:opacity-100' : 'hover:bg-white/[0.02]'
                          }`}
                        >
                          {/* Unit Title, Status Indicator & Section Badge */}
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div
                              className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border transition-colors ${
                                isItemCompleted
                                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                                  : 'border-white/10 bg-white/[0.02] text-muted-foreground/40'
                              }`}
                              title={isItemCompleted ? 'Completed (Watched in player)' : 'Not watched yet'}
                            >
                              {isItemCompleted ? (
                                <Check className="w-3 h-3 stroke-[2.5]" />
                              ) : (
                                <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
                              )}
                            </div>

                            <div className="min-w-0 flex-1 flex items-baseline gap-2 flex-wrap sm:flex-nowrap">
                              <span className="text-[11px] text-muted-foreground/60 font-mono shrink-0">
                                #{itIdx + 1 < 10 ? `0${itIdx + 1}` : itIdx + 1}
                              </span>
                              <span className="text-[10px] text-muted-foreground/80 px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.04] truncate max-w-[170px] shrink-0 font-medium">
                                {item.sectionTitle}
                              </span>
                              {item.videoId ? (
                                <Link
                                  href={`/courses/${course.slug}/video/${item.videoId}`}
                                  className={`text-xs sm:text-sm font-medium leading-snug truncate transition-colors hover:text-primary-300 ${
                                    isItemCompleted
                                      ? 'line-through text-muted-foreground'
                                      : 'text-foreground'
                                  }`}
                                >
                                  {item.unit.title || item.unit.unitTitle || 'Lesson'}
                                </Link>
                              ) : (
                                <h4
                                  className={`text-xs sm:text-sm font-medium leading-snug truncate transition-colors ${
                                    isItemCompleted
                                      ? 'line-through text-muted-foreground'
                                      : 'text-foreground'
                                  }`}
                                >
                                  {item.unit.title || item.unit.unitTitle || 'Lesson'}
                                </h4>
                              )}
                            </div>
                          </div>

                          {/* Unit Actions & Duration */}
                          <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pl-7 sm:pl-0">
                            {unitDuration && (
                              <span className="text-xs font-mono text-muted-foreground/80 px-2 py-0.5 rounded-md bg-white/[0.03]">
                                {unitDuration}
                              </span>
                            )}

                            {(() => {
                              const uId = item.videoId || item.unit.sourceid || item.unit.id;
                              const isDl = !item.isYouTube && (isDownloaded(uId) || isDownloaded(item.unit.sourceid || '') || isDownloaded(item.unit.id || ''));
                              const isQ = !item.isYouTube && (isQueued(uId) || isQueued(item.unit.sourceid || '') || isQueued(item.unit.id || ''));
                              const isP = !item.isYouTube && (isPaused(uId) || isPaused(item.unit.sourceid || '') || isPaused(item.unit.id || ''));
                              const isDlIng = !item.isYouTube && (isDownloading(uId) || isDownloading(item.unit.sourceid || '') || isDownloading(item.unit.id || ''));
                              const isFailedUnit = !item.isYouTube && (isFailed(uId) || isFailed(item.unit.sourceid || '') || isFailed(item.unit.id || ''));
                              const prog = getDownloadProgress(uId) ?? getDownloadProgress(item.unit.sourceid || '') ?? getDownloadProgress(item.unit.id || '');

                              if (isDl) {
                                return (
                                  <button
                                    type="button"
                                    onClick={async (e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      await deleteDownload(uId);
                                      if (item.unit.sourceid && item.unit.sourceid !== uId) await deleteDownload(item.unit.sourceid);
                                      if (item.unit.id && item.unit.id !== uId) await deleteDownload(item.unit.id);
                                    }}
                                    className="px-2 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/30 hover:border-rose-500/50 text-rose-400 hover:text-rose-300 text-[10px] font-bold flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
                                    title="Delete downloaded video from this device"
                                  >
                                    <Trash2 className="w-3 h-3 text-rose-400" />
                                  </button>
                                );
                              }
                              if (isQ) {
                                return (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      pauseDownload(uId);
                                    }}
                                    title="Queued in download sequence. Click to pause."
                                    className="px-2 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-600/40 text-slate-300 text-[10px] font-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
                                  >
                                    <Clock className="w-3 h-3 text-slate-400" />
                                    <span>Queued</span>
                                  </button>
                                );
                              }
                              if (isP) {
                                return (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      resumeDownload(uId);
                                      if (item.unit.sourceid && item.unit.sourceid !== uId) resumeDownload(item.unit.sourceid);
                                      if (item.unit.id && item.unit.id !== uId) resumeDownload(item.unit.id);
                                    }}
                                    title="Download paused. Click to resume."
                                    className="px-2 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 hover:text-amber-200 text-[10px] font-bold flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer group"
                                  >
                                    <Play className="w-3 h-3 fill-amber-400 text-amber-400 group-hover:scale-110 transition-transform" />
                                    <span>Resume {prog !== undefined ? `${prog}%` : ''}</span>
                                  </button>
                                );
                              }
                              if (isDlIng) {
                                return (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      pauseDownload(uId);
                                      if (item.unit.sourceid && item.unit.sourceid !== uId) pauseDownload(item.unit.sourceid);
                                      if (item.unit.id && item.unit.id !== uId) pauseDownload(item.unit.id);
                                    }}
                                    title="Downloading offline... Click to pause."
                                    className="px-2 py-1 rounded-lg bg-primary-500/15 hover:bg-amber-500/20 border border-primary-500/30 hover:border-amber-500/40 text-primary-400 hover:text-amber-300 text-[10px] font-bold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer group"
                                  >
                                    <Loader2 className="w-3 h-3 animate-spin group-hover:hidden" />
                                    <Pause className="w-3 h-3 hidden group-hover:inline text-amber-400" />
                                    <span className="group-hover:hidden">{prog !== undefined ? `${prog}%` : 'Saving'}</span>
                                    <span className="hidden group-hover:inline">Pause</span>
                                  </button>
                                );
                              }
                              if (isFailedUnit) {
                                return (
                                  <button
                                    type="button"
                                    onClick={async (e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      await retryDownload(uId);
                                      if (item.unit.sourceid && item.unit.sourceid !== uId) await retryDownload(item.unit.sourceid);
                                      if (item.unit.id && item.unit.id !== uId) await retryDownload(item.unit.id);
                                    }}
                                    title="Download failed. Click to retry."
                                    className="px-2 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-400 text-[10px] font-bold flex items-center gap-1 shrink-0 cursor-pointer transition-colors"
                                  >
                                    <RotateCcw className="w-3 h-3 text-rose-400" />
                                    <span>Retry</span>
                                  </button>
                                );
                              }
                              if (isUnlocked && onDownloadUnit && item.videoId && !item.isYouTube) {
                                return (
                                  <button
                                    type="button"
                                    onClick={(e) =>
                                      onDownloadUnit(e, item.unit, item.sectionTitle, item.sectionId)
                                    }
                                    className="p-1.5 rounded-lg text-muted-foreground hover:text-primary-400 hover:bg-white/[0.06] transition-colors cursor-pointer shrink-0"
                                    title="Download for offline study"
                                  >
                                    <ArrowDownToLine className="w-3.5 h-3.5" />
                                  </button>
                                );
                              }
                              return null;
                            })()}

                            {item.videoId ? (
                              <Link
                                href={`/courses/${course.slug}/video/${item.videoId}`}
                                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                                  isItemCompleted
                                    ? 'bg-card/90 hover:bg-white/[0.08] text-muted-foreground hover:text-foreground border border-white/[0.08]'
                                    : 'bg-primary-600 hover:bg-primary-500 text-white shadow-sm shadow-primary-600/30 hover:shadow-primary-600/50 hover:-translate-y-0.5 active:translate-y-0'
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
                                className="px-3 py-1.5 rounded-xl bg-card/90 hover:bg-white/[0.08] text-foreground border border-white/[0.08] text-xs font-semibold flex items-center gap-1 transition-all"
                              >
                                <span>File</span>
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

      {/* Floating Jump to Active Target Button */}
      {nextTargetDay && (
        <button
          type="button"
          onClick={jumpToActiveDay}
          className="fixed bottom-6 right-6 z-40 px-3.5 py-2 rounded-full bg-primary-600 hover:bg-primary-500 text-white font-medium text-xs shadow-lg transition-colors flex items-center gap-2 cursor-pointer border border-primary-400/20"
        >
          <Navigation className="w-3.5 h-3.5" />
          <span>Jump to Day {nextTargetDay.dayNumber}</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        </button>
      )}

      {/* Day Section Download Quality Selector Modal */}
      {dayQualityModal && (
        <div
          onClick={() => setDayQualityModal(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md p-6 rounded-3xl bg-card border border-card-border shadow-2xl space-y-5 animate-in zoom-in-95 duration-200"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary-400">
                <Sparkles className="w-4 h-4" />
                <span>Select Download Quality</span>
              </div>
              <button
                onClick={() => setDayQualityModal(null)}
                className="p-1 rounded-xl hover:bg-white/10 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <h3 className="text-base sm:text-lg font-bold text-foreground">
                Download {dayQualityModal.title}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Choose video resolution for {dayQualityModal.units.length} lesson{dayQualityModal.units.length === 1 ? '' : 's'}. Lessons will be saved into local browser storage for offline viewing.
              </p>
            </div>

            <div className="space-y-2.5">
              {[
                {
                  id: '1080p',
                  name: 'Full HD (1080p)',
                  desc: 'Maximum sharpness & detail',
                  badge: 'Best Quality',
                },
                {
                  id: '720p',
                  name: 'High Quality (720p HD)',
                  desc: 'Crisp & clear video',
                  badge: 'Recommended',
                },
                {
                  id: '540p',
                  name: 'Medium Definition (540p)',
                  desc: 'Great balance of data & clarity',
                },
                {
                  id: '360p',
                  name: 'Standard (360p)',
                  desc: 'Low data usage',
                },
              ].map((opt) => {
                const isSelected = selectedDayQuality === opt.id;
                const estSize = formatDayEstimatedSize(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedDayQuality(opt.id)}
                    className={`w-full p-3 sm:p-3.5 rounded-2xl border text-left flex items-center justify-between gap-3 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-primary-950/40 border-primary-500/70 ring-1 ring-primary-500/30'
                        : 'bg-card/70 hover:bg-slate-800/40 border-card-border/80'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                          isSelected
                            ? 'border-primary-400 bg-primary-500 text-white'
                            : 'border-slate-600'
                        }`}
                      >
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs sm:text-sm font-bold text-foreground">
                            {opt.name}
                          </span>
                          {opt.badge && (
                            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-primary-500/20 text-primary-300 border border-primary-500/40">
                              {opt.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                          {opt.desc}
                        </p>
                      </div>
                    </div>

                    {estSize && (
                      <span className="text-[11px] sm:text-xs font-mono font-medium text-slate-300 bg-slate-900/80 px-2 py-0.5 rounded-lg border border-slate-700/60 shrink-0">
                        {estSize}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Remember quality preference (YouTube style) */}
            <div className="pt-2 border-t border-card-border/60 space-y-1.5">
              <label className="flex items-center justify-between gap-2.5 px-1 cursor-pointer select-none group">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={rememberPreference}
                    onChange={(e) => setRememberPreference(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 text-primary-600 focus:ring-primary-500 bg-slate-900 cursor-pointer accent-primary-500"
                  />
                  <span className="text-xs font-semibold text-foreground group-hover:text-primary-300 transition-colors">
                    Remember my download settings
                  </span>
                </div>
                <Link
                  href="/downloads#download-settings"
                  onClick={() => setDayQualityModal(null)}
                  className="text-[11px] text-muted-foreground hover:text-primary-400 flex items-center gap-1 transition-colors"
                  title="Manage download preferences"
                >
                  <Settings className="w-3 h-3" />
                  <span>Settings</span>
                </Link>
              </label>
              <p className="text-[10px] text-muted-foreground px-1 leading-relaxed">
                {rememberPreference
                  ? 'Future downloads will start automatically in this resolution. You can switch back to "Ask each time" anytime in Downloads settings.'
                  : 'Unchecked: PrepTea will ask you to choose resolution every time.'}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-card-border/60">
              <button
                type="button"
                onClick={() => setDayQualityModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!dayQualityModal) return;
                  saveRememberedQuality(selectedDayQuality, rememberPreference);
                  await downloadSection({
                    courseSlug: course.slug,
                    courseTitle: course.title,
                    sectionTitle: dayQualityModal.title,
                    preferredQuality: selectedDayQuality,
                    units: dayQualityModal.units,
                  });
                  setDayQualityModal(null);
                }}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-primary-600 hover:bg-primary-500 text-white shadow-md shadow-primary-600/30 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <ArrowDownToLine className="w-3.5 h-3.5" />
                <span>Start Download ({selectedDayQuality})</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
