const fs = require('fs');
const path = require('path');

const coursesDir = path.join(__dirname, 'Courses');
const files = fs.readdirSync(coursesDir).filter((f) => f.endsWith('.json'));

const results = [];

files.forEach((file) => {
  try {
    const fullPath = path.join(coursesDir, file);
    const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    const course = data.course || data;

    const courseName = course.title || path.basename(file, '.json');
    const courseId = course.identifiers?.slug || course.titleId || path.basename(file, '.json').toLowerCase();

    const unitsMap = {
      ...(course.units || {}),
      ...(course.videos || {}),
      ...(course.assessments || {}),
      ...(course.objects || {}),
      ...(course.ebooks || {})
    };

    let totalVideos = 0;
    let unplayableVideosCount = 0;
    let nonVideoResources = 0;

    const rawSections = course.sections || {};
    Object.values(rawSections).forEach((sec) => {
      if (Array.isArray(sec.learningPath)) {
        sec.learningPath.forEach((item) => {
          const unitMeta = unitsMap[item.id] || {};
          const itemType = (item.type || unitMeta.objectType || '').toLowerCase();

          // Target video lessons specifically
          const isVideoUnit = itemType === 'ivideo' || itemType === 'video' || itemType === 'youtube' || item.icon === 'video';

          if (isVideoUnit) {
            totalVideos++;
            const hasPlayableSource =
              Boolean(unitMeta.sourceid) ||
              Boolean(unitMeta.vimeoid) ||
              Boolean(unitMeta.data?.embed) ||
              (typeof unitMeta.duration === 'number' && unitMeta.duration > 0);

            if (!hasPlayableSource) {
              unplayableVideosCount++;
            }
          } else {
            nonVideoResources++;
          }
        });
      }
    });

    results.push({
      courseName,
      courseId,
      totalVideos,
      availableVideos: totalVideos - unplayableVideosCount,
      unplayableVideosCount,
      nonVideoResources
    });
  } catch (err) {
    console.error(`Error in file ${file}:`, err.message);
  }
});

// Sort courses by number of unplayable videos (highest first)
results.sort((a, b) => b.unplayableVideosCount - a.unplayableVideosCount);

console.table(results);
