#!/usr/bin/env node
/**
 * analyze_sourceids.js
 * Comprehensive JavaScript / Node.js analyzer for `sourceid` fields in Course JSON files.
 *
 * Usage:
 *   node scripts/analyze_sourceids.js "Courses/Alpha Plus 6.0 (C++).json"
 *   node scripts/analyze_sourceids.js Courses/
 */

const fs = require('fs');
const path = require('path');

/**
 * Recursively find all objects containing a "sourceid" key
 */
function extractUnitsWithSourceId(obj, curPath = '') {
  let units = [];
  if (!obj) return units;

  if (typeof obj === 'object') {
    if (!Array.isArray(obj)) {
      if ('sourceid' in obj) {
        units.push({
          sourceid: obj.sourceid,
          id: obj.id,
          title: obj.title || obj.name || obj.unitTitle || 'Untitled Unit',
          type: obj.type,
          objectType: obj.objectType,
          access: obj.access,
          sectionAccess: obj.sectionAccess,
          duration: obj.duration,
          path: curPath,
        });
      }
      for (const [key, val] of Object.entries(obj)) {
        units.push(...extractUnitsWithSourceId(val, curPath ? `${curPath}.${key}` : key));
      }
    } else {
      obj.forEach((item, idx) => {
        units.push(...extractUnitsWithSourceId(item, `${curPath}[${idx}]`));
      });
    }
  }

  return units;
}

function analyzeFile(filePath) {
  console.log('='.repeat(80));
  console.log(`ANALYZING FILE: ${filePath}`);
  console.log('='.repeat(80));

  if (!fs.existsSync(filePath)) {
    console.error(`Error: File does not exist -> ${filePath}`);
    return null;
  }

  let data;
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    data = JSON.parse(raw);
  } catch (err) {
    console.error(`Error parsing JSON in ${filePath}:`, err.message);
    return null;
  }

  const units = extractUnitsWithSourceId(data);
  const totalElements = units.length;

  const validUnits = units.filter(u => u.sourceid && String(u.sourceid).trim().length > 0);
  const emptyUnits = units.filter(u => !u.sourceid || String(u.sourceid).trim().length === 0);

  // Frequency map for sourceids
  const freqMap = new Map();
  for (const u of validUnits) {
    const sid = String(u.sourceid).trim();
    if (!freqMap.has(sid)) {
      freqMap.set(sid, []);
    }
    freqMap.get(sid).push(u);
  }

  const uniqueCount = freqMap.size;
  let singleCount = 0;
  let duplicateCount = 0;
  let totalDuplicateInstances = 0;
  const duplicateList = [];

  for (const [sid, occurrences] of freqMap.entries()) {
    if (occurrences.length === 1) {
      singleCount++;
    } else {
      duplicateCount++;
      totalDuplicateInstances += (occurrences.length - 1);
      duplicateList.push({ sid, occurrences });
    }
  }

  // Sort duplicates descending by occurrences count
  duplicateList.sort((a, b) => b.occurrences.length - a.occurrences.length);

  // Breakdown aggregators
  const typeCounts = {};
  const objTypeCounts = {};
  const accessCounts = {};
  const sectionAccessCounts = {};

  let totalDurationSec = 0;
  let durationCount = 0;
  let minDuration = Infinity;
  let maxDuration = -Infinity;

  for (const u of validUnits) {
    typeCounts[u.type] = (typeCounts[u.type] || 0) + 1;
    objTypeCounts[u.objectType] = (objTypeCounts[u.objectType] || 0) + 1;
    accessCounts[u.access] = (accessCounts[u.access] || 0) + 1;
    sectionAccessCounts[u.sectionAccess] = (sectionAccessCounts[u.sectionAccess] || 0) + 1;

    if (typeof u.duration === 'number' && u.duration > 0) {
      totalDurationSec += u.duration;
      durationCount++;
      if (u.duration < minDuration) minDuration = u.duration;
      if (u.duration > maxDuration) maxDuration = u.duration;
    }
  }

  const totalHours = (totalDurationSec / 3600).toFixed(2);
  const avgMinutes = durationCount > 0 ? (totalDurationSec / durationCount / 60).toFixed(1) : 0;

  console.log(`\n1. SUMMARY METRICS:`);
  console.log(`  • Total objects with 'sourceid' key  : ${totalElements}`);
  console.log(`  • Valid (non-empty) sourceids        : ${validUnits.length}`);
  console.log(`  • Empty / Null / Whitespace sourceids : ${emptyUnits.length}`);
  console.log(`  • Distinct / Unique sourceids        : ${uniqueCount}`);
  console.log(`  • Sourceids appearing exactly ONCE   : ${singleCount} (${((singleCount / Math.max(uniqueCount, 1)) * 100).toFixed(1)}%)`);
  console.log(`  • Repeated / Duplicate sourceids     : ${duplicateCount}`);
  console.log(`  • Total duplicate instance count     : ${totalDuplicateInstances}`);

  if (emptyUnits.length > 0) {
    console.log(`\n2. EMPTY/BLANK SOURCEIDS (${emptyUnits.length} found):`);
    emptyUnits.slice(0, 10).forEach(u => {
      console.log(`  - Title: "${u.title}" | ID: ${u.id} | Type: ${u.type}`);
    });
    if (emptyUnits.length > 10) {
      console.log(`  ... and ${emptyUnits.length - 10} more.`);
    }
  }

  console.log(`\n3. DUPLICATE REPETITION DETAILS:`);
  if (duplicateCount === 0) {
    console.log(`  -> None! Every valid sourceid in this course is 100% unique.`);
  } else {
    duplicateList.forEach(({ sid, occurrences }) => {
      console.log(`\n  • SourceID: '${sid}' (repeated ${occurrences.length} times):`);
      occurrences.forEach((occ, idx) => {
        console.log(`      [${idx + 1}] Title: "${occ.title}"`);
        console.log(`          Unit ID: ${occ.id} | Duration: ${occ.duration}s | Path: ${occ.path}`);
      });
    });
  }

  console.log(`\n4. METADATA & PROVIDER BREAKDOWN:`);
  console.log(`  • Video Providers (type):`);
  for (const [k, v] of Object.entries(typeCounts)) console.log(`      - ${k}: ${v} units`);
  console.log(`  • Object Types (objectType):`);
  for (const [k, v] of Object.entries(objTypeCounts)) console.log(`      - ${k}: ${v} units`);
  console.log(`  • Unit Access:`);
  for (const [k, v] of Object.entries(accessCounts)) console.log(`      - ${k}: ${v} units`);
  console.log(`  • Section Access:`);
  for (const [k, v] of Object.entries(sectionAccessCounts)) console.log(`      - ${k}: ${v} units`);

  console.log(`\n5. DURATION TOTALS:`);
  console.log(`  • Units with valid duration: ${durationCount}`);
  console.log(`  • Total Watch Time: ${totalDurationSec} seconds (~${totalHours} hours)`);
  if (durationCount > 0) {
    console.log(`  • Avg Video Duration: ${avgMinutes} minutes`);
    console.log(`  • Shortest Video: ${minDuration}s | Longest Video: ${(maxDuration / 60).toFixed(1)} mins`);
  }

  console.log('\n' + '='.repeat(80) + '\n');

  return {
    filePath,
    total: totalElements,
    valid: validUnits.length,
    empty: emptyUnits.length,
    unique: uniqueCount,
    duplicates: duplicateCount,
    sourceids: validUnits.map(u => String(u.sourceid).trim()),
  };
}

function main() {
  const target = process.argv[2] || 'Courses/Alpha Plus 6.0 (C++).json';

  if (!fs.existsSync(target)) {
    console.error(`Target path "${target}" not found.`);
    process.exit(1);
  }

  const stat = fs.statSync(target);
  if (stat.isFile()) {
    analyzeFile(target);
  } else if (stat.isDirectory()) {
    const files = fs.readdirSync(target)
      .filter(f => f.endsWith('.json'))
      .map(f => path.join(target, f))
      .sort();

    console.log(`Analyzing ${files.length} JSON course files in "${target}"...\n`);

    const allResults = [];
    const globalMap = new Map();

    for (const f of files) {
      const res = analyzeFile(f);
      if (res) {
        allResults.push(res);
        res.sourceids.forEach(sid => {
          globalMap.set(sid, (globalMap.get(sid) || 0) + 1);
        });
      }
    }

    const totalValid = allResults.reduce((acc, r) => acc + r.valid, 0);
    const crossDups = Array.from(globalMap.entries()).filter(([_, count]) => count > 1);

    console.log('#'.repeat(80));
    console.log('CROSS-COURSE GLOBAL SOURCEID SUMMARY');
    console.log('#'.repeat(80));
    console.log(`Total Course Files Analyzed   : ${allResults.length}`);
    console.log(`Total Video Units Across All  : ${totalValid}`);
    console.log(`Global Distinct Unique SIDs   : ${globalMap.size}`);
    console.log(`SIDs Reused Across Courses    : ${crossDups.length}`);

    // Top 10 most shared sourceids
    crossDups.sort((a, b) => b[1] - a[1]);
    console.log(`\nTop 10 Most Shared SIDs across courses:`);
    crossDups.slice(0, 10).forEach(([sid, count]) => {
      console.log(`  • ${sid}: used in ${count} video lessons`);
    });
  }
}

main();
