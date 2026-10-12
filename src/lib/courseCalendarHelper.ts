import { CourseDetail, CourseSection, CourseSectionUnit } from '@/lib/types';
import { isQuizMatch } from '@/lib/storage';

export interface CalendarUnitTestItem {
  id: string;
  unit: CourseSectionUnit;
  quizId: string;
  title: string;
  difficulty?: 'Easy' | 'Medium' | 'Hard' | 'Practice';
  questionsCount?: number;
  timeLimitMinutes?: number;
  totalScore?: number;
}

export interface CalendarUnitItem {
  unit: CourseSectionUnit;
  sectionTitle: string;
  sectionId: string;
  videoId: string;
  durationSeconds: number;
  isActionableVideo: boolean;
  isActionableExam?: boolean;
  isYouTube: boolean;
  uploadDateStr: string; // YYYY-MM-DD
  associatedTests?: CalendarUnitTestItem[];
}

export interface CalendarDayGroup {
  dayNumber: number;
  dateKey: string;
  formattedDate: string;
  dayOfWeek: string;
  targetTitle: string;
  originalUploadDate?: string;
  items: CalendarUnitItem[];
  totalSeconds: number;
  totalLectures: number;
  totalTests?: number;
  completedCount: number;
  isCompleted: boolean;
  isNextTarget: boolean;
  progressPercent: number;
}

export interface CalendarVideoSequenceItem {
  videoId: string;
  unitTitle: string;
  durationSeconds: number;
  dayNumber: number;
  targetTitle: string;
  sectionTitle: string;
  sectionId: string;
  unit: CourseSectionUnit;
  url: string;
  associatedTests?: CalendarUnitTestItem[];
}

export interface DefaultVideoSequenceItem {
  videoId: string;
  unitTitle: string;
  durationSeconds: number;
  sectionTitle: string;
  sectionId: string;
  unit: CourseSectionUnit;
  url: string;
}

export function formatDateDisplay(dateStr: string): { formatted: string; dayOfWeek: string } {
  if (dateStr === 'unscheduled') {
    return { formatted: 'Course Resources', dayOfWeek: 'Bonus' };
  }
  try {
    const parts = dateStr.split('-').map(Number);
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      const formatted = d.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      const dayOfWeek = d.toLocaleDateString('en-GB', { weekday: 'long' });
      return { formatted, dayOfWeek };
    }
  } catch (e) {
    // fallback
  }

  return { formatted: dateStr, dayOfWeek: '' };
}

export function formatDurationHms(totalSeconds: number): string {
  if (!totalSeconds || totalSeconds <= 0) return '0 min';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) {
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${m}m`;
}

export function addDaysToDateStr(dateStr: string, daysToAdd: number): string {
  const parts = dateStr.split('-').map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  d.setDate(d.getDate() + daysToAdd);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isActionableVideoUnit(unit: CourseSectionUnit): boolean {
  const type = (unit.objectType || unit.type || '').toLowerCase();
  if (type === 'youtube') {
    const sid = (unit.sourceid || unit.vimeoid || '').trim();
    return sid !== '' || !!unit.data?.embed;
  }
  if (type === 'ivideo' || type === 'video' || type === 'wistia') {
    const sid = (unit.sourceid || unit.vimeoid || unit.id || '').trim();
    return sid !== '';
  }
  return !!unit.sourceid && unit.sourceid.trim() !== '';
}

export function isActionableExamUnit(unit: CourseSectionUnit): boolean {
  const type = (unit.objectType || unit.type || '').toLowerCase();
  return type === 'assessmentv2' || type === 'assessment' || type === 'quiz';
}

export interface ComputeCalendarOptions {
  course: CourseDetail;
  scheduleMode?: 'paced' | 'raw_batches';
  availableTests?: any[];
  completedVideos?: string[];
  quizHistory?: any[];
}

export function computeCourseCalendarDays({
  course,
  scheduleMode = 'paced',
  availableTests = [],
  completedVideos = [],
  quizHistory = [],
}: ComputeCalendarOptions): CalendarDayGroup[] {
  const allUnitsList: CalendarUnitItem[] = [];

  course.sections.forEach((sec) => {
    const secHasVideos = sec.units.some((u) => isActionableVideoUnit(u));

    if (secHasVideos) {
      for (let i = 0; i < sec.units.length; i++) {
        const unit = sec.units[i];
        if (!isActionableVideoUnit(unit)) continue;

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
        const videoId = unit.sourceid || unit.vimeoid || unit.id || '';

        // Look ahead for tests following this video up to next video in the same section
        const associatedTests: CalendarUnitTestItem[] = [];
        for (let j = i + 1; j < sec.units.length; j++) {
          const nextUnit = sec.units[j];
          if (isActionableVideoUnit(nextUnit)) break; // Next video begins

          const nextObjType = (nextUnit.objectType || nextUnit.type || '').toLowerCase();
          if (
            isActionableExamUnit(nextUnit) ||
            nextObjType === 'assessmentv2' ||
            nextObjType === 'assessment' ||
            nextObjType === 'quiz'
          ) {
            const match =
              availableTests.find(
                (t) =>
                  (nextUnit.id && (t.objectId === nextUnit.id || t.assessmentId === nextUnit.id)) ||
                  (nextUnit.data?.assessmentId &&
                    (t.assessmentId === nextUnit.data.assessmentId || t.objectId === nextUnit.data.assessmentId))
              ) ||
              availableTests.find((t) => {
                const uTitle = (nextUnit.unitTitle || nextUnit.title || '').toLowerCase().trim();
                const qTitle = (t.quizId || t.title || '').toLowerCase().trim();
                return uTitle && (qTitle === uTitle || qTitle.includes(uTitle) || uTitle.includes(qTitle));
              });

            const quizId = match?.quizId || nextUnit.data?.assessmentId || nextUnit.id;
            const titleLower = (nextUnit.title || nextUnit.unitTitle || '').toLowerCase();
            let diff: 'Easy' | 'Medium' | 'Hard' | 'Practice' = match?.difficulty || 'Practice';
            if (titleLower.includes('easy')) diff = 'Easy';
            else if (titleLower.includes('medium')) diff = 'Medium';
            else if (titleLower.includes('hard') || titleLower.includes('advanced')) diff = 'Hard';

            associatedTests.push({
              id: nextUnit.id,
              unit: nextUnit,
              quizId,
              title: nextUnit.title || nextUnit.unitTitle || match?.title || 'Practice Test',
              difficulty: diff,
              questionsCount: match?.totalQuestions || nextUnit.questionsCount || 10,
              timeLimitMinutes: match?.timeLimitSeconds ? Math.round(match.timeLimitSeconds / 60) : 20,
              totalScore: match?.totalScore || match?.totalQuestions || 10,
            });
          }
        }

        allUnitsList.push({
          unit,
          sectionTitle: sec.title,
          sectionId: sec.id,
          videoId,
          durationSeconds: unit.duration || 0,
          isActionableVideo: true,
          isYouTube,
          uploadDateStr: dateKey,
          associatedTests: associatedTests.length > 0 ? associatedTests : undefined,
        });
      }
    } else {
      // Pure test section with no video lectures (e.g. TCS Ninja Tests or TCS Digital Tests)
      sec.units.forEach((testUnit) => {
        const tObjType = (testUnit.objectType || testUnit.type || '').toLowerCase();
        if (!isActionableExamUnit(testUnit) && tObjType !== 'assessmentv2' && tObjType !== 'assessment' && tObjType !== 'quiz') {
          return;
        }

        let dateKey = 'unscheduled';
        if (testUnit.modifiedF && typeof testUnit.modifiedF === 'string') {
          const part = testUnit.modifiedF.split(' ')[0]?.trim();
          if (/^\d{4}-\d{2}-\d{2}$/.test(part)) dateKey = part;
        } else if (typeof testUnit.created === 'number' && testUnit.created > 0) {
          try {
            dateKey = new Date(testUnit.created * 1000).toISOString().split('T')[0];
          } catch (e) {}
        }

        const match = availableTests.find(
          (t) =>
            (testUnit.id && (t.objectId === testUnit.id || t.assessmentId === testUnit.id)) ||
            (testUnit.data?.assessmentId &&
              (t.assessmentId === testUnit.data.assessmentId || t.objectId === testUnit.data.assessmentId))
        );

        const quizId = match?.quizId || testUnit.data?.assessmentId || testUnit.id;
        const titleLower = (testUnit.title || testUnit.unitTitle || '').toLowerCase();
        let diff: 'Easy' | 'Medium' | 'Hard' | 'Practice' = match?.difficulty || 'Practice';
        if (titleLower.includes('easy')) diff = 'Easy';
        else if (titleLower.includes('medium')) diff = 'Medium';
        else if (titleLower.includes('hard') || titleLower.includes('advanced')) diff = 'Hard';

        allUnitsList.push({
          unit: testUnit,
          sectionTitle: sec.title,
          sectionId: sec.id,
          videoId: '',
          durationSeconds: match?.timeLimitSeconds || 1200,
          isActionableVideo: false,
          isActionableExam: true,
          isYouTube: false,
          uploadDateStr: dateKey,
          associatedTests: [
            {
              id: testUnit.id,
              unit: testUnit,
              quizId,
              title: testUnit.title || testUnit.unitTitle || match?.title || 'Practice Test',
              difficulty: diff,
              questionsCount: match?.totalQuestions || testUnit.questionsCount || 20,
              timeLimitMinutes: match?.timeLimitSeconds ? Math.round(match.timeLimitSeconds / 60) : 20,
              totalScore: match?.totalScore || match?.totalQuestions || 20,
            },
          ],
        });
      });
    }
  });

  const result: CalendarDayGroup[] = [];

  // MODE A: PACED DAILY TARGETS (~1.5h - 2h per day across 4-6 months)
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

    const sortedBlocks = topicBlocks.sort((a, b) => {
      if (a.uploadDate === 'unscheduled') return 1;
      if (b.uploadDate === 'unscheduled') return -1;
      return a.uploadDate.localeCompare(b.uploadDate);
    });

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

    let currentCalDate = '2026-02-07';
    const firstValidDate = mergedBlocks.find((b) => b.uploadDate !== 'unscheduled')?.uploadDate;
    if (firstValidDate) {
      currentCalDate = firstValidDate;
    }

    let dayNum = 1;
    mergedBlocks.forEach((block) => {
      if (block.uploadDate !== 'unscheduled' && block.uploadDate > currentCalDate) {
        currentCalDate = block.uploadDate;
      }

      const scheduledDateStr = currentCalDate;
      const { formatted, dayOfWeek } = formatDateDisplay(scheduledDateStr);
      const { formatted: origFormatted } = formatDateDisplay(block.uploadDate);

      const totalSec = block.items.reduce((acc, it) => acc + it.durationSeconds, 0);
      const completedCount = block.items.filter((it) => {
        if (it.isActionableExam) {
          const qId = it.associatedTests?.[0]?.quizId || it.unit.id;
          return quizHistory.some((a) => isQuizMatch(a.quizId, qId));
        }
        return it.videoId && completedVideos.includes(it.videoId);
      }).length;

      const isCompleted = block.items.length > 0 && completedCount === block.items.length;
      const progressPercent =
        block.items.length > 0 ? Math.round((completedCount / block.items.length) * 100) : 0;

      const totalTests = block.items.reduce((acc, it) => acc + (it.associatedTests?.length || 0), 0);

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
        totalTests,
        completedCount,
        isCompleted,
        isNextTarget: false,
        progressPercent,
      });

      currentCalDate = addDaysToDateStr(currentCalDate, 1);
    });
  }

  // MODE B: RAW LMS UPLOAD BATCHES
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

      const completedCount = items.filter((it) => {
        if (it.isActionableExam) {
          const qId = it.associatedTests?.[0]?.quizId || it.unit.id;
          return quizHistory.some((a) => isQuizMatch(a.quizId, qId));
        }
        return it.videoId && completedVideos.includes(it.videoId);
      }).length;

      const isCompleted = items.length > 0 && completedCount === items.length;
      const progressPercent =
        items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

      const distinctSections = Array.from(new Set(items.map((it) => it.sectionTitle)));
      const targetTitle =
        distinctSections.length === 1
          ? distinctSections[0]
          : `${distinctSections.length} Topics Upload Batch`;

      const totalTests = items.reduce((acc, it) => acc + (it.associatedTests?.length || 0), 0);

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
        totalTests,
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
        const completedCount = items.filter((it) => {
          if (it.isActionableExam) {
            const qId = it.associatedTests?.[0]?.quizId || it.unit.id;
            return quizHistory.some((a) => isQuizMatch(a.quizId, qId));
          }
          return it.videoId && completedVideos.includes(it.videoId);
        }).length;
        const isCompleted = items.length > 0 && completedCount === items.length;
        const progressPercent =
          items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

        const totalTests = items.reduce((acc, it) => acc + (it.associatedTests?.length || 0), 0);

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
          totalTests,
          completedCount,
          isCompleted,
          isNextTarget: false,
          progressPercent,
        });
      }
    }
  }

  let foundNext = false;
  for (const day of result) {
    if (!day.isCompleted && !foundNext) {
      day.isNextTarget = true;
      foundNext = true;
    }
  }

  return result;
}

/**
 * Extracts all playable videos in Calendar Order.
 */
export function getCalendarVideoSequence(
  calendarDays: CalendarDayGroup[],
  courseSlug: string
): CalendarVideoSequenceItem[] {
  const sequence: CalendarVideoSequenceItem[] = [];

  calendarDays.forEach((day) => {
    day.items.forEach((item) => {
      if (item.isActionableVideo && item.videoId) {
        sequence.push({
          videoId: item.videoId,
          unitTitle: item.unit.unitTitle || item.unit.title || 'Lesson',
          durationSeconds: item.durationSeconds,
          dayNumber: day.dayNumber,
          targetTitle: day.targetTitle,
          sectionTitle: item.sectionTitle,
          sectionId: item.sectionId,
          unit: item.unit,
          url: `/courses/${courseSlug}/video/${item.videoId}?mode=calendar`,
          associatedTests: item.associatedTests,
        });
      }
    });
  });

  return sequence;
}

/**
 * Resolves previous & next navigation in Calendar Order.
 */
export function getCalendarVideoNavigation(
  sequence: CalendarVideoSequenceItem[],
  currentVideoId: string
): {
  prevVideo: CalendarVideoSequenceItem | null;
  nextVideo: CalendarVideoSequenceItem | null;
  currentVideo: CalendarVideoSequenceItem | null;
  currentIndex: number;
} {
  const currentIndex = sequence.findIndex(
    (item) => item.videoId === currentVideoId || item.unit.id === currentVideoId
  );

  if (currentIndex === -1) {
    return {
      prevVideo: null,
      nextVideo: null,
      currentVideo: null,
      currentIndex: -1,
    };
  }

  const prevVideo = currentIndex > 0 ? sequence[currentIndex - 1] : null;
  const nextVideo = currentIndex < sequence.length - 1 ? sequence[currentIndex + 1] : null;
  const currentVideo = sequence[currentIndex];

  return {
    prevVideo,
    nextVideo,
    currentVideo,
    currentIndex,
  };
}

/**
 * Extracts all playable videos in Default Section Order.
 */
export function getDefaultVideoSequence(
  sections: CourseSection[],
  courseSlug: string
): DefaultVideoSequenceItem[] {
  const sequence: DefaultVideoSequenceItem[] = [];

  sections.forEach((sec) => {
    sec.units.forEach((u) => {
      if (isActionableVideoUnit(u)) {
        const vid = u.sourceid || u.vimeoid || u.id;
        if (vid) {
          sequence.push({
            videoId: vid,
            unitTitle: u.unitTitle || u.title || 'Lesson',
            durationSeconds: u.duration || 0,
            sectionTitle: sec.title,
            sectionId: sec.id,
            unit: u,
            url: `/courses/${courseSlug}/video/${vid}?mode=default`,
          });
        }
      }
    });
  });

  return sequence;
}

/**
 * Resolves previous & next navigation in Default Section Order.
 */
export function getDefaultVideoNavigation(
  sequence: DefaultVideoSequenceItem[],
  currentVideoId: string
): {
  prevVideo: DefaultVideoSequenceItem | null;
  nextVideo: DefaultVideoSequenceItem | null;
  currentVideo: DefaultVideoSequenceItem | null;
  currentIndex: number;
} {
  const currentIndex = sequence.findIndex(
    (item) => item.videoId === currentVideoId || item.unit.id === currentVideoId
  );

  if (currentIndex === -1) {
    return {
      prevVideo: null,
      nextVideo: null,
      currentVideo: null,
      currentIndex: -1,
    };
  }

  const prevVideo = currentIndex > 0 ? sequence[currentIndex - 1] : null;
  const nextVideo = currentIndex < sequence.length - 1 ? sequence[currentIndex + 1] : null;
  const currentVideo = sequence[currentIndex];

  return {
    prevVideo,
    nextVideo,
    currentVideo,
    currentIndex,
  };
}
