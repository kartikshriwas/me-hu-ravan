'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { PlayCircle, ChevronDown, ChevronUp, Layers, ListVideo } from 'lucide-react';

interface Unit {
  id: string;
  sourceid?: string;
  unitTitle?: string;
  title?: string;
  type: string;
  duration?: string;
}

interface Section {
  sectionTitle: string;
  units: Unit[];
}

interface VideoPlaylistSidebarProps {
  courseTitle: string;
  courseSlug: string;
  currentVideoId: string;
  sections: Section[];
}

export function VideoPlaylistSidebar({
  courseTitle,
  courseSlug,
  currentVideoId,
  sections,
}: VideoPlaylistSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<number, boolean>>({});
  
  const activeUnitRef = useRef<HTMLAnchorElement | null>(null);
  const playlistContainerRef = useRef<HTMLDivElement | null>(null);

  // Expand section containing the currently playing video by default
  useEffect(() => {
    const newExpandedState: Record<number, boolean> = {};
    sections.forEach((section, sIdx) => {
      const hasActive = section.units.some(u => (u.sourceid || u.id) === currentVideoId);
      if (hasActive) {
        newExpandedState[sIdx] = true;
      }
    });
    if (Object.keys(newExpandedState).length === 0) {
      newExpandedState[0] = true;
    }
    setExpandedSections(prev => ({ ...prev, ...newExpandedState }));
  }, [currentVideoId, sections]);

  // Auto-scroll to the currently playing item at the TOP of the scroll area
  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeUnitRef.current) {
        activeUnitRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [currentVideoId, isOpen, expandedSections]);

  const toggleSection = (idx: number) => {
    setExpandedSections(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  // Calculate total playable videos
  const totalVideos = sections.reduce((acc, sec) => {
    return acc + sec.units.filter(u => !!u.sourceid || u.type === 'youtube' || u.type === 'ivideo').length;
  }, 0);

  return (
    <div className="w-full h-full flex flex-col space-y-3">
      {/* Playlist Header */}
      <div className="flex items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-slate-900/90 border border-slate-800/80 shadow-lg shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
            <ListVideo className="w-4.5 h-4.5 text-indigo-400" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-white truncate">Course Playlist</h4>
            <p className="text-[10px] text-slate-400 font-medium">{totalVideos} Video Lessons</p>
          </div>
        </div>

        <button
          onClick={() => setIsOpen(!isOpen)}
          className="lg:hidden px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition-colors flex items-center gap-1.5 touch-manipulation"
        >
          <span>{isOpen ? 'Hide Lessons' : 'View Lessons'}</span>
          {isOpen ? <ChevronUp className="w-4 h-4 text-indigo-400" /> : <ChevronDown className="w-4 h-4 text-indigo-400" />}
        </button>
      </div>

      {/* Playlist Content Body */}
      <div className={`flex-1 transition-all duration-300 ${isOpen ? 'block' : 'hidden lg:block'}`}>
        <div 
          ref={playlistContainerRef}
          className="glass-panel rounded-2xl sm:rounded-3xl p-3 sm:p-4 border border-slate-800/80 bg-slate-900/80 max-h-[420px] lg:max-h-[calc(100vh-14rem)] overflow-y-auto space-y-3 custom-scrollbar scroll-smooth"
        >
          {sections.map((section, sIdx) => {
            const videoUnits = section.units.filter(u => !!u.sourceid || u.type === 'youtube' || u.type === 'ivideo');
            if (videoUnits.length === 0) return null;

            const isExpanded = expandedSections[sIdx] ?? false;

            return (
              <div key={sIdx} className="space-y-1.5">
                {/* Section Header */}
                <button
                  onClick={() => toggleSection(sIdx)}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60 text-left hover:bg-slate-950 transition-colors group touch-manipulation"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Layers className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span className="text-xs font-bold text-slate-200 truncate group-hover:text-white transition-colors">
                      {section.sectionTitle}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <span className="text-[10px] font-mono text-slate-500">
                      {videoUnits.length} {videoUnits.length === 1 ? 'video' : 'videos'}
                    </span>
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
                  </div>
                </button>

                {/* Section Units List */}
                {isExpanded && (
                  <div className="space-y-1 pl-1">
                    {videoUnits.map((unit) => {
                      const uId = unit.sourceid || unit.id;
                      const isActive = uId === currentVideoId;
                      const title = unit.unitTitle || unit.title || 'Video Lesson';

                      return (
                        <Link
                          key={unit.id}
                          ref={isActive ? activeUnitRef : null}
                          href={`/courses/${courseSlug}/video/${uId}`}
                          className={`flex items-center justify-between p-2.5 rounded-xl transition-all touch-manipulation ${
                            isActive
                              ? 'bg-indigo-600/25 border border-indigo-500/50 text-white font-bold shadow-md shadow-indigo-600/10 ring-1 ring-indigo-500/30'
                              : 'hover:bg-slate-800/60 border border-transparent text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {isActive ? (
                              <div className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-pulse shrink-0" />
                            ) : (
                              <PlayCircle className="w-4 h-4 text-slate-500 shrink-0" />
                            )}
                            <span className="text-xs truncate">{title}</span>
                          </div>

                          {isActive && (
                            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-indigo-500/30 text-indigo-300 shrink-0 ml-2">
                              Playing
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
