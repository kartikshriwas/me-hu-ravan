import fs from 'fs';
import path from 'path';
import { getCoursesDirectory } from './pathHelper';
import { CourseDetail, CourseMeta, CourseSection, CourseSectionUnit } from './types';

interface FileCacheEntry {
  mtime: number;
  parsedData: any;
}

const fileCache = new Map<string, FileCacheEntry>();

function getParsedCourseFile(fullPath: string): any {
  try {
    const stats = fs.statSync(fullPath);
    const cached = fileCache.get(fullPath);

    if (cached && cached.mtime === stats.mtimeMs) {
      return cached.parsedData;
    }

    const rawContent = fs.readFileSync(fullPath, 'utf-8');
    const data = JSON.parse(rawContent);

    fileCache.set(fullPath, {
      mtime: stats.mtimeMs,
      parsedData: data
    });

    return data;
  } catch (err) {
    console.error(`Failed to read/parse course file ${fullPath}:`, err);
    return null;
  }
}

/**
 * Actionable units rule:
 * - Videos: "objectType" === "ivideo" or "youtube"
 * - Exams/Quizzes: "objectType" === "assessmentV2"
 * - Downloadable Files: "objectType" === "pbEbook"
 * - Ignore PDFs, certificates, and non-actionable placeholders
 */
export function isUnitActionable(unit: Partial<CourseSectionUnit>): boolean {
  if (!unit) return false;
  const t = (unit.objectType || unit.type || '').toLowerCase();
  if (t === 'ivideo') {
    const sid = (unit.sourceid || unit.vimeoid || '').trim();
    return sid !== '';
  }
  if (t === 'youtube') {
    const sid = (unit.sourceid || unit.vimeoid || '').trim();
    return sid !== '' || !!unit.data?.embed;
  }
  return t === 'assessmentv2' || t === 'assessment' || t === 'pbebook' || t === 'ebook';
}

let cachedAllCourses: CourseMeta[] | null = null;
let cachedAllCoursesTimestamp = 0;

export function invalidateAllCoursesCache() {
  cachedAllCourses = null;
  cachedAllCoursesTimestamp = 0;
}

export function getAllCourses(): CourseMeta[] {
  const now = Date.now();
  if (cachedAllCourses && now - cachedAllCoursesTimestamp < 60000) {
    return cachedAllCourses;
  }

  const dir = getCoursesDirectory();
  if (!fs.existsSync(dir)) return [];

  const files = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.json'));
  const results: CourseMeta[] = [];

  for (let fIdx = 0; fIdx < files.length; fIdx++) {
    const file = files[fIdx];
    try {
      const fullPath = path.join(dir, file);
      const data = getParsedCourseFile(fullPath);
      if (!data) continue;

      const course = data.course || data;
      const slug = course.identifiers?.slug || course.titleId || path.basename(file, '.json').toLowerCase();

      // Direct dictionary references without expensive object cloning
      const objects = course.objects || {};
      const unitsDict = course.units || {};
      const videosDict = course.videos || {};
      const assessmentsDict = course.assessments || {};
      const ebooksDict = course.ebooks || {};

      const getUnitMeta = (id: string) =>
        objects[id] || unitsDict[id] || videosDict[id] || assessmentsDict[id] || ebooksDict[id] || null;

      const rawSections = course.sections || {};
      let sectionsCount = 0;
      let rawVideoCount = 0;
      let validUnitsCount = 0;
      let videosCount = 0;
      let totalDurationSeconds = 0;

      for (const secKey of Object.keys(rawSections)) {
        const sec = rawSections[secKey];
        const lp = sec.learningPath;
        if (!Array.isArray(lp) || lp.length === 0) continue;

        let secHasValid = false;

        for (let i = 0; i < lp.length; i++) {
          const item = lp[i];
          const meta = getUnitMeta(item.id);
          const rawType = (meta?.objectType || item.type || '').toLowerCase();

          const isVideo = rawType === 'ivideo' || rawType === 'youtube';
          const isQuiz = rawType === 'assessmentv2' || rawType === 'assessment';
          const isEbook = rawType === 'pbebook' || rawType === 'ebook';

          if (!isVideo && !isQuiz && !isEbook) continue;

          if (isVideo) {
            rawVideoCount++;
            const sid = (meta?.sourceid || meta?.vimeoid || item.sourceid || item.vimeoid || '').trim();
            const hasYt = rawType === 'youtube' && (sid !== '' || meta?.data?.embed || item.data?.embed);
            if (!sid && !hasYt) continue;

            videosCount++;
            const dur = (meta && typeof meta.duration === 'number') ? meta.duration : (typeof item.duration === 'number' ? item.duration : 0);
            totalDurationSeconds += dur;
          }

          validUnitsCount++;
          secHasValid = true;
        }

        if (secHasValid) {
          sectionsCount++;
        }
      }

      const isOngoing = rawVideoCount > 0 && (videosCount / rawVideoCount) < 0.90;

      results.push({
        title: course.title || path.basename(file, '.json'),
        slug,
        filename: file,
        keywords: course.keywords || null,
        description: course.description || null,
        access: course.access || 'public',
        price: course.price || 0,
        courseImage: course.courseImage || null,
        sectionsCount,
        unitsCount: validUnitsCount,
        videosCount,
        totalDurationSeconds: totalDurationSeconds > 0 ? totalDurationSeconds : undefined,
        isOngoing
      });
    } catch (err) {
      console.error(`Failed to summarize course file ${file}:`, err);
    }
  }

  cachedAllCourses = results;
  cachedAllCoursesTimestamp = now;
  return results;
}

export function parseRawCourseData(data: any, fallbackSlug: string = 'course'): CourseDetail | null {
  if (!data) return null;
  const course = data.course || data;
  const slug = course.identifiers?.slug || course.titleId || fallbackSlug;

  // Direct dictionary references without expensive object cloning
  const objects = course.objects || {};
  const unitsDict = course.units || {};
  const videosDict = course.videos || {};
  const assessmentsDict = course.assessments || {};
  const ebooksDict = course.ebooks || {};

  const getUnitMeta = (id: string) =>
    objects[id] || unitsDict[id] || videosDict[id] || assessmentsDict[id] || ebooksDict[id] || null;

  const rawSections = course.sections || {};
  const parsedSections: CourseSection[] = [];
  let rawVideoCount = 0;
  let videosCount = 0;

  for (const [secId, secData] of Object.entries(rawSections) as [string, any][]) {
    const learningPath = Array.isArray(secData.learningPath) ? secData.learningPath : [];

    const units: CourseSectionUnit[] = [];

    // Single linear pass over learningPath
    for (let i = 0; i < learningPath.length; i++) {
      const lpItem = learningPath[i];
      const unitMeta = getUnitMeta(lpItem.id) || {};
      const objType = (unitMeta.objectType || lpItem.type || '').toLowerCase();

      // Videos are strictly ivideo or youtube
      const isVideo = objType === 'ivideo' || objType === 'youtube';
      // assessmentV2 are exams/quizzes
      const isQuiz = objType === 'assessmentv2' || objType === 'assessment';
      // pbEbook are downloadable files/notes
      const isEbook = objType === 'pbebook' || objType === 'ebook';

      // Ignore pdf, certificates, and non-actionable placeholders
      if (!isVideo && !isQuiz && !isEbook) continue;

      if (isVideo) {
        rawVideoCount++;
        const sid = (unitMeta.sourceid || unitMeta.vimeoid || lpItem.sourceid || lpItem.vimeoid || '').trim();
        const hasYt = objType === 'youtube' && (sid !== '' || unitMeta.data?.embed || lpItem.data?.embed);
        if (!sid && !hasYt) {
          // Ignore videos whose sourceid/vimeoid are not available, null, or empty string ""
          continue;
        }
        videosCount++;
      }

      const unitTitle = unitMeta.title || lpItem.unitTitle || 'Lesson Unit';

      units.push({
        id: lpItem.id,
        type: objType,
        objectType: objType,
        icon: isVideo ? (objType === 'youtube' ? 'yt' : 'video') : isQuiz ? 'quiz' : 'file',
        subtitle: isVideo ? (objType === 'youtube' ? 'youtube' : 'video') : isQuiz ? 'exam' : 'file',
        unitTitle,
        title: unitTitle,
        description: unitMeta.description || '',
        access: unitMeta.access || lpItem.access || 'public',
        data: unitMeta.data || lpItem.data || undefined,
        questionsCount: unitMeta.questionsCount || undefined,
        hasData: unitMeta.hasData || false,
        sourceid: unitMeta.sourceid || lpItem.sourceid || undefined,
        vimeoid: unitMeta.vimeoid || lpItem.vimeoid || undefined,
        fileUrl: unitMeta.fileUrl || lpItem.fileUrl || undefined,
        duration: typeof unitMeta.duration === 'number' ? unitMeta.duration : (typeof lpItem.duration === 'number' ? lpItem.duration : undefined),
        modifiedF: unitMeta.modifiedF || (typeof unitMeta.created === 'number' ? new Date(unitMeta.created * 1000).toISOString().replace('T', ' ').substring(0, 19) : undefined),
        created: typeof unitMeta.created === 'number' ? unitMeta.created : (typeof lpItem.created === 'number' ? lpItem.created : undefined),
        modified: typeof unitMeta.modified === 'number' ? unitMeta.modified : (typeof lpItem.modified === 'number' ? lpItem.modified : undefined),
      });
    }

    if (units.length > 0) {
      parsedSections.push({
        id: secId,
        title: secData.title || 'Course Section',
        description: secData.description || '',
        access: secData.access || 'public',
        units,
      });
    }
  }

  const totalUnits = parsedSections.reduce((sum, s) => sum + s.units.length, 0);
  const isOngoing = rawVideoCount > 0 && (videosCount / rawVideoCount) < 0.90;

  return {
    title: course.title || fallbackSlug,
    slug,
    filename: `${slug}.json`,
    keywords: course.keywords || null,
    description: course.description || null,
    access: course.access || 'public',
    price: course.price || 0,
    courseImage: course.courseImage || null,
    sectionsCount: parsedSections.length,
    unitsCount: totalUnits,
    videosCount,
    totalDurationSeconds: (() => {
      const total = parsedSections.reduce(
        (sum, s) => sum + s.units.reduce((uSum, u) => uSum + (u.duration || 0), 0),
        0
      );
      return total > 0 ? total : undefined;
    })(),
    isOngoing,
    sections: parsedSections,
  };
}

export function getCourseBySlug(slug: string): CourseDetail | null {
  const dir = getCoursesDirectory();
  if (!fs.existsSync(dir)) return null;

  const safeSlug = slug.replace(/[\/\\]/g, '').replace(/\.\./g, '');
  if (!safeSlug || safeSlug.length === 0 || safeSlug.length > 100) return null;

  // FAST PATH: Direct file check in O(1)
  const directPath = path.join(dir, `${safeSlug}.json`);
  if (fs.existsSync(directPath)) {
    const data = getParsedCourseFile(directPath);
    if (data) {
      const parsed = parseRawCourseData(data, safeSlug);
      if (parsed) {
        parsed.filename = `${safeSlug}.json`;
        return parsed;
      }
    }
  }

  // FALLBACK: Search directory for custom slugs or titleIds
  const files = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.json'));

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      const fullPath = path.join(dir, file);
      const data = getParsedCourseFile(fullPath);
      if (!data) continue;

      const course = data.course || data;
      const fileSlug = course.identifiers?.slug || course.titleId || path.basename(file, '.json').toLowerCase();

      if (fileSlug.toLowerCase() === safeSlug.toLowerCase() || path.basename(file, '.json').toLowerCase() === safeSlug.toLowerCase()) {
        const parsed = parseRawCourseData(data, safeSlug);
        if (parsed) {
          parsed.filename = file;
          return parsed;
        }
      }
    } catch (err) {
      console.error(`Error parsing course ${file}:`, err);
    }
  }

  return null;
}

