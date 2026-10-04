/**
 * Batch Permission and Course Access Mapping Module
 * Defines granular access rules for course batches:
 * - Sigma 6.0
 * - Sigma 8.0
 * - Sigma 11.0
 * - SigmaX (All Batches Access)
 * - Delta
 * - Alpha
 * - Prime
 */

export const BATCH_COURSE_MAPPINGS: Record<string, string[]> = {
  'sigma 6.0': [
    'aptitude-qs-library',
    'aptitude-teacher2',
    'delta-library',
    'plus-library',
    'sigma-6',
    'sigma-6-dsa',
    'sigma-6-live-recordings',
    'aptitude-english',
    'aptitude-hinglish',
  ],
  'sigma 8.0': [
    'aptitude-teacher2',
    'aptitude-qs-library',
    'delta-library',
    'plus-library',
    'sigma-8',
    'sigma-8-cpp-dsa',
    'sigma-8-java-dsa',
    'sigma-8-live-recordings',
    'aptitude-english',
    'aptitude-hinglish',
  ],
  'sigma 11.0': [
    'sigma-11-dsa-cpp',
    'sigma-11-dev',
    'sigma-prime-2',
    'sigma-11',
  ],
  'prime': [
    'prime-3',
    'prime-ai',
    'ai-projects-module',
    'prime-2',
    'aptitude-hinglish',
    'delta-library',
    'plus-library',
  ],
  'delta': [
    'delta-5',
    'delta-6',
    'delta-7',
    'delta-8',
    'delta-9',
    'delta-library',
  ],
  'alpha': [
    'alpha-plus-7-cpp',
    'alpha-plus-7-java',
    'alpha-plus-5-cpp',
    'alpha-plus-6-cpp',
    'alpha-plus8-cpp',
    'alpha-plus8-java',
    'plus-library',
  ],
  'quiz-only-prime': [], // Practice tests/quizzes only - 0 course video access
  'sigmax': ['*'], // Special batch that unlocks ALL courses/batches
};

export const AVAILABLE_BATCH_OPTIONS = [
  { id: 'SigmaX', label: 'SigmaX (All Batches Access)', description: 'Grants access to all course batches' },
  { id: 'Sigma 6.0', label: 'Sigma 6.0', description: 'Aptitude, Delta/Plus Library, Sigma 6.0 & Live Recordings' },
  { id: 'Sigma 8.0', label: 'Sigma 8.0', description: 'Aptitude, Delta/Plus Library, Sigma 8.0 C++/Java DSA & Recordings' },
  { id: 'Sigma 11.0', label: 'Sigma 11.0', description: 'Sigma 11 DSA C++, Dev & Sigma Prime 2.0' },
  { id: 'Prime', label: 'Prime', description: 'Prime AI/ML, AI Projects, Aptitude Hinglish, Delta & Plus Libraries' },
  { id: 'Delta', label: 'Delta', description: 'Delta 5.0 to 9.0 & DevHub Library' },
  { id: 'Alpha', label: 'Alpha', description: 'Alpha 7 Java & C++ for DSA, Alpha 5.0 to 8.0 & Plus Library' },
  { id: 'Quiz Only Prime', label: 'Quiz Only Prime', description: 'Practice Tests & Leaderboard Only (No Video Courses)' },
];

/**
 * Normalizes batch strings for reliable matching (e.g., "Sigma 6.0" -> "sigma 6.0")
 */
export function normalizeBatchName(batch: string): string {
  if (!batch) return '';
  const clean = batch.toLowerCase().trim();
  if (clean.includes('quiz') || clean.includes('quiz-only') || clean.includes('quiz_only')) return 'quiz-only-prime';
  if (clean.includes('sigmax')) return 'sigmax';
  if (clean.includes('sigma 6') || clean.includes('sigma-6') || clean.includes('sigma6')) return 'sigma 6.0';
  if (clean.includes('sigma 8') || clean.includes('sigma-8') || clean.includes('sigma8')) return 'sigma 8.0';
  if (clean.includes('sigma 11') || clean.includes('sigma-11') || clean.includes('sigma11')) return 'sigma 11.0';
  if (clean.includes('prime')) return 'prime';
  if (clean.includes('delta')) return 'delta';
  if (clean.includes('alpha')) return 'alpha';
  return clean;
}

/**
 * Checks if a batch string represents a valid video course batch (excludes free, quiz-only, global free, etc.)
 */
export function isCourseBatch(batch: string): boolean {
  if (!batch || typeof batch !== 'string') return false;
  const norm = normalizeBatchName(batch);
  return ['sigmax', 'sigma 6.0', 'sigma 8.0', 'sigma 11.0', 'prime', 'delta', 'alpha'].includes(norm) || batch === '*';
}

/**
 * Resolves all authorized course slugs for a list of user batches
 */
export function getAllowedSlugsForBatches(userBatches: string[]): string[] {
  if (!Array.isArray(userBatches) || userBatches.length === 0) {
    return [];
  }

  const allowedSlugs = new Set<string>();

  for (const rawBatch of userBatches) {
    const norm = normalizeBatchName(rawBatch);

    // If user has SigmaX, return '*' indicating full access
    if (norm === 'sigmax' || rawBatch === '*') {
      return ['*'];
    }

    const mappedSlugs = BATCH_COURSE_MAPPINGS[norm];
    if (mappedSlugs) {
      for (const slug of mappedSlugs) {
        if (slug === '*') return ['*'];
        allowedSlugs.add(slug.toLowerCase());
      }
    } else {
      // Fallback: If batch name directly matches a course slug
      allowedSlugs.add(norm);
    }
  }

  return Array.from(allowedSlugs);
}

/**
 * Verifies if a target course slug is permitted given the user's batches
 */
export function isCourseSlugAllowed(userBatches: string[], targetSlug: string): boolean {
  if (!targetSlug) return false;
  const allowed = getAllowedSlugsForBatches(userBatches);
  if (allowed.includes('*')) return true;
  return allowed.includes(targetSlug.toLowerCase().trim());
}

/**
 * Checks if a user has course access (admins, users with access_courses permission, or enrolled in course batches)
 */
export function checkUserCourseAccess(user: any): boolean {
  if (!user) return false;
  if (user.role === 'superadmin' || user.role === 'admin') return true;
  if (user.adminPermissions?.includes('access_courses') || user.adminPermissions?.includes('*')) return true;
  if (user.hasCourseAccess) return true;
  const batches: string[] = Array.isArray(user.allowedBatches) ? user.allowedBatches : [];
  if (user.premiumPlan && isCourseBatch(user.premiumPlan)) return true;
  return batches.some(isCourseBatch);
}

/**
 * Checks if a user has premium status
 */
export function checkUserIsPremium(user: any): boolean {
  if (!user) return false;
  if (user.role === 'superadmin' || user.role === 'admin') return true;
  if (user.isPremium) return true;
  if (user.premiumPlan && user.premiumPlan.trim() !== '') return true;
  return false;
}
