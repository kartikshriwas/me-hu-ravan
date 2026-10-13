import fs from 'fs';
import path from 'path';
import { getCoursesDirectory } from './pathHelper';

let cachedQuizTypeMap: Map<string, string> | null = null;
let lastCacheCheck = 0;
const CACHE_TTL_MS = 60000; // 1-minute memory cache

function cleanSectionTitle(raw: string): string {
  let title = (raw || '').trim();
  // Strip teacher/instructor suffixes like "(Teacher 1)"
  title = title.replace(/\s*\(Teacher\s*\d+\)/i, '').trim();

  // Normalize standardized types
  if (/^verbal\s+ability/i.test(title)) return 'Verbal Ability';
  if (/^logical\s+reasoning/i.test(title)) return 'Logical Reasoning';
  if (/^quantitative\s+aptitude/i.test(title)) return 'Quantitative Aptitude';
  if (/^data\s+interpretation/i.test(title)) return 'Data Interpretation';
  if (/^tcs\s+ninja/i.test(title)) return 'TCS Ninja';
  if (/^tcs\s+digital/i.test(title)) return 'TCS Digital';

  return title;
}

/**
 * Builds and caches a lookup map from assessment/unit object_id to the section title
 * extracted from Courses/English.json and Courses/Hinglish.json.
 */
export function getUnitIdToQuizTypeMap(): Map<string, string> {
  const now = Date.now();
  if (cachedQuizTypeMap && now - lastCacheCheck < CACHE_TTL_MS) {
    return cachedQuizTypeMap;
  }

  const map = new Map<string, string>();
  const coursesDir = getCoursesDirectory();
  const courseFiles = ['English.json', 'Hinglish.json'];

  for (const filename of courseFiles) {
    const fullPath = path.join(coursesDir, filename);
    if (fs.existsSync(fullPath)) {
      try {
        const raw = fs.readFileSync(fullPath, 'utf-8');
        const data = JSON.parse(raw);
        const sections = data?.course?.sections || {};

        for (const sec of Object.values(sections) as any[]) {
          const sectionTitle = cleanSectionTitle(sec?.title || '');
          if (!sectionTitle) continue;

          const learningPath = Array.isArray(sec?.learningPath) ? sec.learningPath : [];
          for (const unit of learningPath) {
            if (unit && unit.id) {
              map.set(unit.id, sectionTitle);
            }
          }
        }
      } catch (err) {
        console.error(`Failed to read/index quiz types from ${filename}:`, err);
      }
    }
  }

  cachedQuizTypeMap = map;
  lastCacheCheck = now;
  return map;
}

/**
 * Resolves the quiz type for an assessment JSON object by matching its object_id / assessmentId
 * against the course sections in English.json and Hinglish.json.
 */
export function resolveQuizType(rawQuizData: any): string {
  if (!rawQuizData) return 'Aptitude';

  const map = getUnitIdToQuizTypeMap();

  const candidates: (string | undefined)[] = [
    rawQuizData.object_id,
    rawQuizData.submission?.object_id,
    rawQuizData.submission?.assessmentId,
    rawQuizData.assessmentId,
    rawQuizData.assessment?.id,
    rawQuizData.assessment?.unitId,
    rawQuizData.assessment?.objectId,
    rawQuizData.objectId,
    rawQuizData.id,
  ];

  for (const candidateId of candidates) {
    if (candidateId && map.has(candidateId)) {
      return map.get(candidateId)!;
    }
  }

  // Heuristic fallback if IDs are missing
  const title = (rawQuizData.title || rawQuizData.assessment?.title || '').toLowerCase();
  if (title.includes('logical')) return 'Logical Reasoning';
  if (title.includes('quantitative') || title.includes('quant')) return 'Quantitative Aptitude';
  if (title.includes('verbal')) return 'Verbal Ability';
  if (title.includes('data interpretation') || title.includes('di ')) return 'Data Interpretation';
  if (title.includes('ninja')) return 'TCS Ninja';
  if (title.includes('digital')) return 'TCS Digital';

  return 'Aptitude';
}
