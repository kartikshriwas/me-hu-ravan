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
      const sectionsCount = Object.keys(rawSections).length;

      let unitsCount = 0;
      Object.values(rawSections).forEach((sec: any) => {
        if (Array.isArray(sec.learningPath)) {
          unitsCount += sec.learningPath.length;
        }
      });

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
        unitsCount
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

        Object.entries(rawSections).forEach(([secId, secData]: [string, any]) => {
          const learningPath = Array.isArray(secData.learningPath) ? secData.learningPath : [];
          const units: CourseSectionUnit[] = learningPath.map((lpItem: any) => {
            const unitMeta = unitsMap[lpItem.id] || {};
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
              fileUrl: unitMeta.fileUrl || lpItem.fileUrl || undefined
            };
          });

          parsedSections.push({
            id: secId,
            title: secData.title || 'Course Section',
            description: secData.description || '',
            access: secData.access || 'public',
            units
          });
        });

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
          unitsCount: parsedSections.reduce((sum, s) => sum + s.units.length, 0),
          sections: parsedSections
        };
      }
    } catch (err) {
      console.error(`Error parsing course ${file}:`, err);
    }
  }

  return null;
}
