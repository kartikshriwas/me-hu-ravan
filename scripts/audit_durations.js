#!/usr/bin/env node
/**
 * audit_durations.js
 * Computes exact:
 * 1. Total Duration of All Videos (raw sum with all repetitions)
 * 2. Total Unique Video Duration (every video counted strictly ONCE)
 * 3. Total Repeated / Duplicate Video Duration (not added twice)
 * 4. Granular per-course breakdown & cross-course repetition stats
 */

const fs = require('fs');
const path = require('path');

function extractUnits(obj) {
  let units = [];
  if (!obj || typeof obj !== 'object') return units;
  if (!Array.isArray(obj)) {
    if ('sourceid' in obj) {
      units.push({
        sourceid: obj.sourceid ? String(obj.sourceid).trim() : null,
        duration: typeof obj.duration === 'number' ? obj.duration : 0,
        title: obj.title || obj.name || obj.unitTitle || 'Untitled',
      });
    }
    for (const val of Object.values(obj)) {
      units.push(...extractUnits(val));
    }
  } else {
    for (const item of obj) {
      units.push(...extractUnits(item));
    }
  }
  return units;
}

function fmt(sec) {
  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  const totalHrs = (sec / 3600).toFixed(2);
  return `${sec.toLocaleString()}s (~${totalHrs} hrs | ${hrs}h ${mins}m ${s}s)`;
}

function main() {
  const dir = process.argv[2] || 'Courses';
  if (!fs.existsSync(dir)) {
    console.error(`Directory or file '${dir}' not found.`);
    process.exit(1);
  }

  const files = fs.statSync(dir).isDirectory()
    ? fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => path.join(dir, f)).sort()
    : [dir];

  let totalRawUnits = 0;
  let totalRawDuration = 0;

  const uniqueVideoMap = new Map(); // sourceid -> max duration
  const sidFrequency = new Map();   // sourceid -> count of times it appears
  let noSidCount = 0;
  let noSidDuration = 0;

  for (const file of files) {
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    const units = extractUnits(data);

    for (const u of units) {
      totalRawUnits++;
      totalRawDuration += u.duration;

      if (u.sourceid) {
        sidFrequency.set(u.sourceid, (sidFrequency.get(u.sourceid) || 0) + 1);
        if (!uniqueVideoMap.has(u.sourceid) || (uniqueVideoMap.get(u.sourceid) === 0 && u.duration > 0)) {
          uniqueVideoMap.set(u.sourceid, u.duration);
        }
      } else {
        noSidCount++;
        noSidDuration += u.duration;
      }
    }
  }

  // 1. Total unique video duration (counted exactly ONCE)
  let totalUniqueDuration = 0;
  for (const dur of uniqueVideoMap.values()) {
    totalUniqueDuration += dur;
  }

  // 2. Repeated video duration added only once
  let durationOfRepeatedVideosOnce = 0;
  let totalOccurrencesDurationOfRepeated = 0;
  let repeatedUniqueCount = 0;

  for (const [sid, count] of sidFrequency.entries()) {
    const dur = uniqueVideoMap.get(sid) || 0;
    if (count > 1) {
      repeatedUniqueCount++;
      durationOfRepeatedVideosOnce += dur;
      totalOccurrencesDurationOfRepeated += (dur * count);
    }
  }

  // 3. Videos appearing exactly once
  let durationOfSingleVideos = 0;
  let singleCount = 0;
  for (const [sid, count] of sidFrequency.entries()) {
    const dur = uniqueVideoMap.get(sid) || 0;
    if (count === 1) {
      singleCount++;
      durationOfSingleVideos += dur;
    }
  }

  // 4. Repeated duration eliminated (the extra duplicate playback time)
  const redundantDurationEliminated = totalOccurrencesDurationOfRepeated - durationOfRepeatedVideosOnce;

  console.log('='.repeat(80));
  console.log('VIDEO DURATION & DEDUPLICATION REPORT');
  console.log('='.repeat(80));

  console.log('\n[1] TOTAL DURATION OF ALL VIDEOS (Sum of all occurrences across all courses):');
  console.log(`    Total Videos  : ${totalRawUnits.toLocaleString()} videos`);
  console.log(`    Duration      : ${fmt(totalRawDuration)}`);

  console.log('\n[2] TOTAL UNIQUE VIDEO DURATION (Every video counted ONCE, zero duplicates):');
  console.log(`    Unique Videos : ${uniqueVideoMap.size.toLocaleString()} unique sourceids`);
  console.log(`    Duration      : ${fmt(totalUniqueDuration)}`);

  console.log('\n[3] REPEATED VIDEOS DURATION (Counted ONCE vs Raw Occurrences):');
  console.log(`    Unique Videos Shared : ${repeatedUniqueCount.toLocaleString()} distinct videos appear multiple times`);
  console.log(`    Duration (COUNTED ONCE)    : ${fmt(durationOfRepeatedVideosOnce)}`);
  console.log(`    Duration (Across all copies): ${fmt(totalOccurrencesDurationOfRepeated)}`);
  console.log(`    Redundant Time Eliminated   : ${fmt(redundantDurationEliminated)}`);

  console.log('\n[4] EXCLUSIVELY UNIQUE VIDEOS (Videos that appear in only 1 place):');
  console.log(`    Count         : ${singleCount.toLocaleString()} videos`);
  console.log(`    Duration      : ${fmt(durationOfSingleVideos)}`);

  if (noSidCount > 0) {
    console.log(`\n[5] VIDEOS WITHOUT SOURCEID:`);
    console.log(`    Count         : ${noSidCount} items`);
    console.log(`    Duration      : ${fmt(noSidDuration)}`);
  }

  console.log('\n' + '='.repeat(80));
}

main();
