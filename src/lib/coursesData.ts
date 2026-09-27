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

export function isUnitActionable(unit: Partial<CourseSectionUnit>): boolean {
  if (!unit) return false;

  const type = (unit.type || '').toLowerCase();
  const icon = (unit.icon || '').toLowerCase();
  const subtitle = (unit.subtitle || '').toLowerCase();
  const fileUrl = (unit.fileUrl || '').trim();

  // 1. Filter out Certificates & Non-actionable placeholders
  if (
    type.includes('certificate') ||
    subtitle.includes('certificate') ||
    icon === 'certification2' ||
    icon.includes('cert')
  ) {
    return false;
  }

  // 2. Real Interactive Exams / Quizzes / Assessments (ALWAYS actionable)
  const isQuizType =
    type === 'assessment' ||
    type === 'assessmentv2' ||
    type === 'quizformal' ||
    type === 'quizinformal' ||
    type === 'quizwritten' ||
    type === 'quiz' ||
    type === 'fileass' ||
    type === 'exam' ||
    (typeof unit.questionsCount === 'number' && unit.questionsCount > 0) ||
    !!(unit.data && (unit.data.assessmentId || unit.data.quizId));

  if (isQuizType) {
    return true;
  }

  // 3. Explicitly filter out PDFs / eBooks / Documents / Notes if there is NO download fileUrl!
  const isPdfOrEbookOrDoc =
    type === 'pdf' ||
    type === 'document' ||
    type === 'pdfdocument' ||
    type === 'pbebook' ||
    type === 'ebook' ||
    subtitle === 'pdf' ||
    subtitle === 'ebook' ||
    fileUrl.endsWith('.pdf') ||
    fileUrl.includes('/pdf/');

  if (isPdfOrEbookOrDoc) {
    // ONLY show if a valid non-empty fileUrl exists so user can actually download it!
    return !!(unit.fileUrl && unit.fileUrl.trim() !== '');
  }

  // 4. Videos (Actionable: Watch Lesson / Locked Video / Video Not Available)
  if (
    type === 'ivideo' ||
    type === 'wistia' ||
    type === 'video' ||
    type === 'youtube' ||
    icon === 'video' ||
    icon === 'yt' ||
    subtitle.includes('video') ||
    subtitle.includes('youtube') ||
    !!unit.sourceid ||
    !!unit.vimeoid ||
    !!(unit.data && unit.data.embed)
  ) {
    return true;
  }

  // 5. Downloadable Files / Code Attachments
  if (unit.fileUrl && unit.fileUrl.trim() !== '') {
    return true;
  }

  // 6. Meetings / Live Sessions / URLs
  if (
    type === 'zoommeeting' ||
    type === 'zoomwebinar' ||
    type === 'webexmeeting' ||
    type === 'googlemeet' ||
    type === 'teamsmeeting' ||
    type === 'url'
  ) {
    return true;
  }

  // Otherwise, no stream to watch, no file to download, no exam to take -> hide
  return false;
}

export function getAllCourses(): CourseMeta[] {
  const dir = getCoursesDirectory();
  if (!fs.existsSync(dir)) return [];

  const files = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.json'));
  const results: CourseMeta[] = [];

  for (const file of files) {
    try {
      const fullPath = path.join(dir, file);
      const data = getParsedCourseFile(fullPath);
      if (!data) continue;

      const course = data.course || data;
      const slug = course.identifiers?.slug || course.titleId || path.basename(file, '.json').toLowerCase();

      const rawSections = course.sections || {};
      let sectionsCount = 0;

      const unitsMap = {
        ...(course.units || {}),
        ...(course.videos || {}),
        ...(course.assessments || {}),
        ...(course.objects || {}),
        ...(course.ebooks || {})
      };

      let rawUnitsCount = 0;
      let populatedUnitsCount = 0;
      let validUnitsCount = 0;
      let videosCount = 0;
      let totalDurationSeconds = 0;

      Object.values(rawSections).forEach((sec: any) => {
        if (Array.isArray(sec.learningPath)) {
          let sectionHasValidUnits = false;
          rawUnitsCount += sec.learningPath.length;

          sec.learningPath.forEach((lpItem: any) => {
            const unitMeta = unitsMap[lpItem.id] || {};
            const unitObj: Partial<CourseSectionUnit> = {
              id: lpItem.id,
              type: lpItem.type || unitMeta.objectType || 'lesson',
              icon: lpItem.icon || 'video',
              subtitle: lpItem.subtitle || '',
              unitTitle: unitMeta.title || lpItem.unitTitle || 'Lesson Unit',
              sourceid: unitMeta.sourceid || undefined,
              vimeoid: unitMeta.vimeoid || undefined,
              fileUrl: unitMeta.fileUrl || lpItem.fileUrl || undefined,
              data: unitMeta.data || lpItem.data || undefined,
              duration: typeof unitMeta.duration === 'number' ? unitMeta.duration : undefined
            };

            const hasContent = unitMeta.hasData || !!unitMeta.sourceid || !!unitMeta.vimeoid || !!unitMeta.fileUrl || (typeof unitMeta.duration === 'number' && unitMeta.duration > 0);
            if (hasContent) {
              populatedUnitsCount++;
            }

            if (isUnitActionable(unitObj)) {
              validUnitsCount++;
              sectionHasValidUnits = true;
              
              const type = (unitObj.type || '').toLowerCase();
              const icon = (unitObj.icon || '').toLowerCase();
              const isVideo = type === 'ivideo' || type === 'wistia' || type === 'video' || type === 'youtube' || icon === 'video' || icon === 'yt' || !!unitObj.sourceid || !!unitObj.vimeoid;
              if (isVideo) {
                videosCount++;
              }

              if (typeof unitMeta.duration === 'number' && unitMeta.duration > 0) {
                totalDurationSeconds += unitMeta.duration;
              }
            }
          });

          if (sectionHasValidUnits) {
            sectionsCount++;
          }
        }
      });

      // Algorithmic check: Course is ongoing if curriculum contains items, but populated playable units are under 95%
      const isOngoing = rawUnitsCount > 0 && (populatedUnitsCount / rawUnitsCount) < 0.95;

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

  return results;
}

export function getCourseBySlug(slug: string): CourseDetail | null {
  const dir = getCoursesDirectory();
  if (!fs.existsSync(dir)) return null;

  // SECURITY: Sanitize path separators and traversal patterns
  const safeSlug = slug.replace(/[\/\\]/g, '').replace(/\.\./g, '');
  if (!safeSlug || safeSlug.length === 0 || safeSlug.length > 100) return null;

  const files = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.json'));

  for (const file of files) {
    try {
      const fullPath = path.join(dir, file);
      // SECURITY: Verify resolved path remains within the expected courses directory
      const resolvedPath = path.resolve(fullPath);
      const resolvedDir = path.resolve(dir);
      if (!resolvedPath.startsWith(resolvedDir + path.sep) && resolvedPath !== resolvedDir) {
        continue;
      }

      const data = getParsedCourseFile(fullPath);
      if (!data) continue;

      const course = data.course || data;
      const fileSlug = course.identifiers?.slug || course.titleId || path.basename(file, '.json').toLowerCase();

      if (fileSlug.toLowerCase() === safeSlug.toLowerCase() || path.basename(file, '.json').toLowerCase() === safeSlug.toLowerCase()) {
        const unitsMap = {
          ...(course.units || {}),
          ...(course.videos || {}),
          ...(course.assessments || {}),
          ...(course.objects || {}),
          ...(course.ebooks || {})
        };
        const rawSections = course.sections || {};
        const parsedSections: CourseSection[] = [];
        let rawUnitsCount = 0;
        let populatedUnitsCount = 0;
        let videosCount = 0;

        Object.entries(rawSections).forEach(([secId, secData]: [string, any]) => {
          const learningPath = Array.isArray(secData.learningPath) ? secData.learningPath : [];
          rawUnitsCount += learningPath.length;

          const units: CourseSectionUnit[] = learningPath
            .map((lpItem: any) => {
              const unitMeta = unitsMap[lpItem.id] || {};
              const hasContent = unitMeta.hasData || !!unitMeta.sourceid || !!unitMeta.vimeoid || !!unitMeta.fileUrl || (typeof unitMeta.duration === 'number' && unitMeta.duration > 0);
              if (hasContent) {
                populatedUnitsCount++;
              }

              return {
                id: lpItem.id,
                type: lpItem.type || unitMeta.objectType || 'lesson',
                icon: lpItem.icon || 'video',
                subtitle: lpItem.subtitle || '',
                unitTitle: unitMeta.title || lpItem.unitTitle || 'Lesson Unit',
                title: unitMeta.title || lpItem.unitTitle || 'Lesson Unit',
                description: unitMeta.description || '',
                access: unitMeta.access || lpItem.access || 'public',
                data: unitMeta.data || lpItem.data || undefined,
                questionsCount: unitMeta.questionsCount || undefined,
                hasData: unitMeta.hasData || false,
                sourceid: unitMeta.sourceid || undefined,
                vimeoid: unitMeta.vimeoid || undefined,
                fileUrl: unitMeta.fileUrl || lpItem.fileUrl || undefined,
                duration: typeof unitMeta.duration === 'number' ? unitMeta.duration : undefined
              };
            })
            .filter((unit: CourseSectionUnit) => isUnitActionable(unit));

          if (units.length > 0) {
            units.forEach(u => {
              const type = (u.type || '').toLowerCase();
              const icon = (u.icon || '').toLowerCase();
              const isVideo = type === 'ivideo' || type === 'wistia' || type === 'video' || type === 'youtube' || icon === 'video' || icon === 'yt' || !!u.sourceid || !!u.vimeoid;
              if (isVideo) videosCount++;
            });

            parsedSections.push({
              id: secId,
              title: secData.title || 'Course Section',
              description: secData.description || '',
              access: secData.access || 'public',
              units
            });
          }
        });

        const totalUnits = parsedSections.reduce((sum, s) => sum + s.units.length, 0);
        const isOngoing = rawUnitsCount > 0 && (populatedUnitsCount / rawUnitsCount) < 0.95;

        return {
          title: course.title || path.basename(file, '.json'),
          slug: fileSlug,
          filename: file,
          keywords: course.keywords || null,
          description: course.description || null,
          access: course.access || 'public',
          price: course.price || 0,
          courseImage: course.courseImage || null,
          sectionsCount: parsedSections.length,
          unitsCount: totalUnits,
          videosCount,
          totalDurationSeconds: (() => {
            const total = parsedSections.reduce((sum, s) =>
              sum + s.units.reduce((uSum, u) => uSum + (u.duration || 0), 0), 0);
            return total > 0 ? total : undefined;
          })(),
          isOngoing,
          sections: parsedSections
        };
      }
    } catch (err) {
      console.error(`Error parsing course ${file}:`, err);
    }
  }

  return null;
}
