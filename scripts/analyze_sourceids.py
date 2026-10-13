#!/usr/bin/env python3
"""
Comprehensive analyzer for `sourceid` fields in Course JSON files.
Supports single-file analysis (e.g. 'Courses/Alpha Plus 6.0 (C++).json') 
or bulk analysis across all courses in a folder.
"""

import sys
import os
import json
from collections import Counter, defaultdict

def extract_units_with_sourceid(obj, path=""):
    """
    Recursively extracts all objects that contain a 'sourceid' field.
    """
    units = []
    if isinstance(obj, dict):
        if "sourceid" in obj:
            units.append({
                "sourceid": obj.get("sourceid"),
                "id": obj.get("id"),
                "title": obj.get("title") or obj.get("name") or obj.get("unitTitle") or "Untitled Unit",
                "type": obj.get("type"),
                "objectType": obj.get("objectType"),
                "access": obj.get("access"),
                "sectionAccess": obj.get("sectionAccess"),
                "duration": obj.get("duration"),
                "path": path,
            })
        for key, val in obj.items():
            units.extend(extract_units_with_sourceid(val, f"{path}.{key}" if path else key))
    elif isinstance(obj, list):
        for idx, item in enumerate(obj):
            units.extend(extract_units_with_sourceid(item, f"{path}[{idx}]"))
    return units

def analyze_file(file_path):
    print("=" * 80)
    print(f"ANALYZING FILE: {file_path}")
    print("=" * 80)

    if not os.path.exists(file_path):
        print(f"Error: File not found -> {file_path}")
        return

    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    units = extract_units_with_sourceid(data)
    total_elements = len(units)

    valid_units = [u for u in units if u["sourceid"] and str(u["sourceid"]).strip()]
    empty_units = [u for u in units if not u["sourceid"] or not str(u["sourceid"]).strip()]

    sourceids = [str(u["sourceid"]).strip() for u in valid_units]
    counts = Counter(sourceids)

    unique_distinct_ids = set(sourceids)
    single_ids = {sid: cnt for sid, cnt in counts.items() if cnt == 1}
    duplicate_ids = {sid: cnt for sid, cnt in counts.items() if cnt > 1}

    # Group occurrences of duplicates
    dup_details = defaultdict(list)
    for u in valid_units:
        sid = str(u["sourceid"]).strip()
        if sid in duplicate_ids:
            dup_details[sid].append(u)

    # Breakdowns by video provider type and objectType
    type_breakdown = Counter(u["type"] for u in valid_units)
    obj_type_breakdown = Counter(u["objectType"] for u in valid_units)
    access_breakdown = Counter(u["access"] for u in valid_units)
    section_access_breakdown = Counter(u["sectionAccess"] for u in valid_units)

    # Duration stats
    durations = [u["duration"] for u in valid_units if isinstance(u.get("duration"), (int, float)) and u["duration"] > 0]
    total_duration_sec = sum(durations)
    total_hours = total_duration_sec / 3600

    print(f"\n1. SUMMARY METRICS:")
    print(f"  • Total objects with 'sourceid' key : {total_elements}")
    print(f"  • Valid (non-empty) sourceids       : {len(valid_units)}")
    print(f"  • Empty / Null / Whitespace sourceids: {len(empty_units)}")
    print(f"  • Distinct / Unique sourceids       : {len(unique_distinct_ids)}")
    print(f"  • Sourceids appearing exactly ONCE  : {len(single_ids)} ({len(single_ids)/max(len(unique_distinct_ids), 1)*100:.1f}%)")
    print(f"  • Repeated / Duplicate sourceids    : {len(duplicate_ids)}")
    print(f"  • Total duplicate instance count    : {sum(duplicate_ids.values()) - len(duplicate_ids)}")

    if empty_units:
        print(f"\n2. EMPTY/BLANK SOURCEIDS ({len(empty_units)} found):")
        for u in empty_units[:10]:
            print(f"  - Unit Title: {u['title']} | ID: {u['id']} | Type: {u['type']}")
        if len(empty_units) > 10:
            print(f"  ... and {len(empty_units) - 10} more.")

    print(f"\n3. DUPLICATE REPETITION DETAILS:")
    if not duplicate_ids:
        print("  -> None! Every valid sourceid in this course is 100% unique.")
    else:
        for sid, count in sorted(duplicate_ids.items(), key=lambda x: x[1], reverse=True):
            print(f"\n  • SourceID: '{sid}' (repeated {count} times):")
            for idx, occ in enumerate(dup_details[sid], 1):
                print(f"      [{idx}] Title: {occ['title']}")
                print(f"          Unit ID: {occ['id']} | Duration: {occ['duration']}s | Path: {occ['path']}")

    print(f"\n4. METADATA & PROVIDER BREAKDOWN:")
    print(f"  • Video Providers (type):")
    for t, c in type_breakdown.most_common():
        print(f"      - {t}: {c} units")
    print(f"  • Object Types (objectType):")
    for ot, c in obj_type_breakdown.most_common():
        print(f"      - {ot}: {c} units")
    print(f"  • Unit Access:")
    for a, c in access_breakdown.most_common():
        print(f"      - {a}: {c} units")
    print(f"  • Section Access:")
    for sa, c in section_access_breakdown.most_common():
        print(f"      - {sa}: {c} units")

    print(f"\n5. DURATION TOTALS:")
    print(f"  • Units with valid duration: {len(durations)}")
    print(f"  • Total Watch Time: {total_duration_sec} seconds (~{total_hours:.2f} hours)")
    if durations:
        print(f"  • Avg Video Duration: {total_duration_sec / len(durations) / 60:.1f} minutes")
        print(f"  • Shortest Video: {min(durations)}s | Longest Video: {max(durations)/60:.1f} mins")

    print("\n" + "=" * 80)
    return {
        "file": file_path,
        "total": total_elements,
        "valid": len(valid_units),
        "empty": len(empty_units),
        "unique": len(unique_distinct_ids),
        "duplicates": len(duplicate_ids),
        "sourceids": sourceids,
    }

def main():
    target = sys.argv[1] if len(sys.argv) > 1 else "Courses/Alpha Plus 6.0 (C++).json"

    if os.path.isfile(target):
        analyze_file(target)
    elif os.path.isdir(target):
        files = sorted([os.path.join(target, f) for f in os.listdir(target) if f.endswith(".json")])
        print(f"Analyzing all {len(files)} JSON files in directory '{target}'...\n")
        all_results = []
        global_sourceids = Counter()

        for f in files:
            res = analyze_file(f)
            if res:
                all_results.append(res)
                global_sourceids.update(res["sourceids"])

        print("\n" + "#" * 80)
        print("CROSS-COURSE GLOBAL SOURCEID SUMMARY")
        print("#" * 80)
        print(f"Total Course Files Analyzed   : {len(all_results)}")
        print(f"Total Video Units Across All  : {sum(r['valid'] for r in all_results)}")
        print(f"Global Distinct Unique SIDs   : {len(global_sourceids)}")
        cross_dups = {sid: cnt for sid, cnt in global_sourceids.items() if cnt > 1}
        print(f"SIDs Reused Across Courses    : {len(cross_dups)}")
        print(f"Top 10 Most Shared SIDs across courses:")
        for sid, cnt in global_sourceids.most_common(10):
            if cnt > 1:
                print(f"  • {sid}: used in {cnt} video lessons")
    else:
        print(f"Target '{target}' not found.")

if __name__ == "__main__":
    main()
