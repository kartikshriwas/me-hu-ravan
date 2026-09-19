"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  PlayCircle,
  ChevronDown,
  ChevronUp,
  Layers,
  ListVideo,
  CheckCircle2,
} from "lucide-react";

interface Unit {
  id: string;
  sourceid?: string;
  unitTitle?: string;
  title?: string;
  type: string;
  duration?: number;
  data?: {
    embed?: string;
    [key: string]: any;
  };
}

interface Section {
  sectionTitle?: string;
  title?: string;
  units: Unit[];
}

interface VideoPlaylistSidebarProps {
  courseTitle: string;
  courseSlug: string;
  currentVideoId: string;
  sections: Section[];
}

function formatUnitDuration(seconds?: number): string | null {
  if (!seconds || seconds <= 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
  }
  return `${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
}

function formatSectionDuration(seconds?: number): string | null {
  if (!seconds || seconds <= 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return `${m}m`;
}

export function VideoPlaylistSidebar({
  courseTitle,
  courseSlug,
  currentVideoId,
  sections,
}: VideoPlaylistSidebarProps) {
  const [isOpen, setIsOpen] = useState(false); // kept for potential future use
  const [expandedSections, setExpandedSections] = useState<
    Record<number, boolean>
  >({});
  const [completedVideos, setCompletedVideos] = useState<string[]>([]);

  const desktopActiveRef = useRef<HTMLAnchorElement | null>(null);
  const mobileActiveRef = useRef<HTMLAnchorElement | null>(null);
  const desktopPlaylistRef = useRef<HTMLDivElement | null>(null);
  const mobilePlaylistRef = useRef<HTMLDivElement | null>(null);

  // Load completed videos from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("preptea_completed_videos");
      if (stored) {
        setCompletedVideos(JSON.parse(stored));
      }
    } catch (e) {
      // ignore
    }
  }, [currentVideoId]);

  // Expand section containing the currently playing video by default
  useEffect(() => {
    const newExpandedState: Record<number, boolean> = {};
    sections.forEach((section, sIdx) => {
      const hasActive = section.units.some(
        (u) => (u.sourceid || u.id) === currentVideoId,
      );
      if (hasActive) {
        newExpandedState[sIdx] = true;
      }
    });
    if (Object.keys(newExpandedState).length === 0) {
      newExpandedState[0] = true;
    }
    setExpandedSections((prev) => ({ ...prev, ...newExpandedState }));
  }, [currentVideoId, sections]);

  // Auto-scroll to the currently playing item within the scrollable container
  useEffect(() => {
    const timer = setTimeout(() => {
      // Desktop container scroll
      if (desktopPlaylistRef.current && desktopActiveRef.current) {
        const container = desktopPlaylistRef.current;
        const el = desktopActiveRef.current;
        const containerRect = container.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        if (containerRect.height > 0 && elRect.height > 0) {
          const offset = elRect.top - containerRect.top;
          container.scrollTo({
            top: container.scrollTop + offset - 40,
            behavior: "smooth",
          });
        }
      }

      // Mobile container scroll
      if (mobilePlaylistRef.current && mobileActiveRef.current) {
        const container = mobilePlaylistRef.current;
        const el = mobileActiveRef.current;
        const containerRect = container.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        if (containerRect.height > 0 && elRect.height > 0) {
          const offset = elRect.top - containerRect.top;
          container.scrollTo({
            top: container.scrollTop + offset - 40,
            behavior: "smooth",
          });
        }
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [currentVideoId, expandedSections]);

  const toggleSection = (idx: number) => {
    setExpandedSections((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  // Calculate total playable videos & progress
  const totalVideos = sections.reduce((acc, sec) => {
    return (
      acc +
      sec.units.filter(
        (u) =>
          !!u.sourceid || u.type === "youtube" || (u.data && !!u.data.embed),
      ).length
    );
  }, 0);

  const completedCount = sections.reduce((acc, sec) => {
    return (
      acc +
      sec.units.filter((u) => completedVideos.includes(u.sourceid || u.id))
        .length
    );
  }, 0);

  const progressPercent =
    totalVideos > 0 ? Math.round((completedCount / totalVideos) * 100) : 0;

  // Find currently active section
  const activeSection = sections.find((sec) =>
    sec.units.some((u) => (u.sourceid || u.id) === currentVideoId),
  );
  const activeSectionTitle =
    activeSection?.title || activeSection?.sectionTitle;

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      {/* ── Desktop Playlist Header ── */}
      <div className="hidden lg:flex items-center justify-between p-3.5 sm:p-4 bg-card/90 border-b border-card-border/80 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-primary-500/10 border border-primary-500/20 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0">
            <ListVideo className="w-4.5 h-4.5 text-primary-600 dark:text-primary-400" />
          </div>
          <div className="min-w-0">
            {" "}
            <Link
              href={`/courses/${courseSlug}`}
              className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors bg-card/80"
            >
              <h4
                className="text-xs font-bold text-foreground truncate"
                title={courseTitle}
              >
                {courseTitle}
              </h4>
            </Link>
            {completedCount > 0 ? (
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold truncate">
                {completedCount}/{totalVideos} Completed ({progressPercent}%)
              </p>
            ) : activeSectionTitle ? (
              <p
                className="text-[10px] text-primary-600 dark:text-primary-300 font-medium truncate"
                title={activeSectionTitle}
              >
                {activeSectionTitle} • {totalVideos} Videos
              </p>
            ) : (
              <p className="text-[10px] text-muted-foreground font-medium">
                {totalVideos} Video Lessons
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Mobile Playlist Header ── */}
      <div className="lg:hidden flex items-center justify-between px-3 py-2.5 bg-card/90 border-b border-card-border/80 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <ListVideo className="w-4 h-4 text-primary-600 dark:text-primary-400 shrink-0" />
          <div className="min-w-0">
            <Link
              href={`/courses/${courseSlug}`}
              className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors bg-card/80"
            >
              <h4
                className="text-xs font-bold text-foreground truncate"
                title={courseTitle}
              >
                {courseTitle}
              </h4>
            </Link>
            {completedCount > 0 ? (
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold truncate">
                {completedCount}/{totalVideos} Completed ({progressPercent}%)
              </p>
            ) : activeSectionTitle ? (
              <p
                className="text-[10px] text-primary-600 dark:text-primary-300 font-medium truncate"
                title={activeSectionTitle}
              >
                {activeSectionTitle}
              </p>
            ) : null}
          </div>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground bg-slate-800/80 px-2 py-0.5 rounded-full border border-slate-700/60 shrink-0 ml-2">
          {totalVideos} vids
        </span>
      </div>

      {/* Thin Course Progress Bar */}
      {completedCount > 0 && (
        <div className="w-full h-1 bg-background shrink-0">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      {/* Desktop: scrollable bounded box */}
      <div
        ref={desktopPlaylistRef}
        className="hidden lg:block flex-1 overflow-y-auto custom-scrollbar scroll-smooth p-3"
      >
        {sections.map((section, sIdx) => {
          const videoUnits = section.units.filter(
            (u) =>
              !!u.sourceid ||
              u.type === "youtube" ||
              (u.data && !!u.data.embed),
          );
          if (videoUnits.length === 0) return null;
          const isExpanded = expandedSections[sIdx] ?? false;
          const sectionName =
            section.title || section.sectionTitle || "Course Section";
          const hasActiveVideo = videoUnits.some(
            (u) => (u.sourceid || u.id) === currentVideoId,
          );

          return (
            <div key={sIdx} className="space-y-1 mb-3">
              <button
                onClick={() => toggleSection(sIdx)}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all group touch-manipulation ${
                  hasActiveVideo
                    ? "bg-primary-950/40 border border-primary-500/40 shadow-sm shadow-primary-500/10 ring-1 ring-primary-500/20"
                    : "bg-background/60 border border-card-border/60 hover:bg-background"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Layers
                    className={`w-3.5 h-3.5 shrink-0 ${hasActiveVideo ? "text-primary-600 dark:text-primary-400 animate-pulse" : "text-muted-foreground"}`}
                  />
                  <span
                    className={`text-xs font-bold truncate transition-colors ${
                      hasActiveVideo
                        ? "text-foreground"
                        : "text-foreground group-hover:text-foreground"
                    }`}
                  >
                    {sectionName}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  {(() => {
                    const secSecs = videoUnits.reduce(
                      (acc, u) => acc + (u.duration || 0),
                      0,
                    );
                    const formattedSecDur = formatSectionDuration(secSecs);
                    return (
                      <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                        {videoUnits.length}{" "}
                        {videoUnits.length === 1 ? "vid" : "vids"}
                        {formattedSecDur && (
                          <span className="text-muted-foreground font-sans text-[10px] bg-card/80 px-1 py-0.5 rounded border border-card-border">
                            {formattedSecDur}
                          </span>
                        )}
                      </span>
                    );
                  })()}
                  {isExpanded ? (
                    <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="space-y-1 pl-1">
                  {videoUnits.map((unit) => {
                    const uId = unit.sourceid || unit.id;
                    const isActive = uId === currentVideoId;
                    const isCompleted = completedVideos.includes(uId);
                    const title =
                      unit.unitTitle || unit.title || "Video Lesson";

                    return (
                      <Link
                        key={unit.id}
                        ref={isActive ? desktopActiveRef : null}
                        href={`/courses/${courseSlug}/video/${uId}`}
                        className={`flex items-center justify-between p-2.5 rounded-xl transition-all touch-manipulation ${
                          isActive
                            ? "bg-primary-600/25 border border-primary-500/50 text-white font-bold shadow-md shadow-primary-600/10 ring-1 ring-primary-500/30"
                            : "hover:bg-slate-800/60 border border-transparent text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {isActive ? (
                            <div className="w-2.5 h-2.5 rounded-full bg-primary-400 animate-pulse shrink-0" />
                          ) : isCompleted ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          ) : (
                            <PlayCircle className="w-4 h-4 text-slate-500 shrink-0" />
                          )}
                          <span className="text-xs truncate">{title}</span>
                        </div>
                        {isActive ? (
                          <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-primary-500/30 text-primary-600 dark:text-primary-300 shrink-0 ml-2">
                            Playing
                          </span>
                        ) : isCompleted ? (
                          <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0 ml-2">
                            Done
                          </span>
                        ) : formatUnitDuration(unit.duration) ? (
                          <span className="text-[10px] font-mono text-slate-500 shrink-0 ml-2">
                            {formatUnitDuration(unit.duration)}
                          </span>
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile: flat YouTube-style list — scrollable within its container */}
      <div
        ref={mobilePlaylistRef}
        className="lg:hidden flex-1 min-h-0 overflow-y-auto custom-scrollbar divide-y divide-slate-800/50"
      >
        {sections.map((section, sIdx) => {
          const videoUnits = section.units.filter(
            (u) =>
              !!u.sourceid ||
              u.type === "youtube" ||
              (u.data && !!u.data.embed),
          );
          if (videoUnits.length === 0) return null;
          const sectionName =
            section.title || section.sectionTitle || "Course Section";
          const hasActiveVideo = videoUnits.some(
            (u) => (u.sourceid || u.id) === currentVideoId,
          );

          return (
            <div key={sIdx}>
              {/* Section Label */}
              <div
                className={`flex items-center gap-2 px-3 py-2 sticky top-0 z-10 backdrop-blur-md border-y transition-colors ${
                  hasActiveVideo
                    ? "bg-primary-950/90 border-primary-500/40 shadow-sm shadow-primary-500/20"
                    : "bg-background/90 border-card-border/60"
                }`}
              >
                <Layers
                  className={`w-3.5 h-3.5 shrink-0 ${hasActiveVideo ? "text-primary-600 dark:text-primary-400 animate-pulse" : "text-muted-foreground"}`}
                />
                <span
                  className={`text-[11px] font-bold uppercase tracking-wider truncate ${
                    hasActiveVideo
                      ? "text-primary-200 font-extrabold"
                      : "text-foreground/80"
                  }`}
                >
                  {sectionName}
                </span>
                {/* {hasActiveVideo && (
                  <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-primary-500/30 text-primary-600 dark:text-primary-300 border border-primary-500/40 shrink-0 ml-1">
                    Playing Section
                  </span>
                )} */}
                {(() => {
                  const secSecs = videoUnits.reduce(
                    (acc, u) => acc + (u.duration || 0),
                    0,
                  );
                  const formattedSecDur = formatSectionDuration(secSecs);
                  return (
                    <span className="ml-auto text-[10px] font-mono text-muted-foreground bg-card px-1.5 py-0.5 rounded border border-card-border shrink-0 flex items-center gap-1">
                      <span>{videoUnits.length} vids</span>
                      {formattedSecDur && (
                        <span className="text-foreground/80 font-sans border-l border-slate-700 pl-1">
                          {formattedSecDur}
                        </span>
                      )}
                    </span>
                  );
                })()}
              </div>

              {/* Video rows */}
              {videoUnits.map((unit) => {
                const uId = unit.sourceid || unit.id;
                const isActive = uId === currentVideoId;
                const isCompleted = completedVideos.includes(uId);
                const title = unit.unitTitle || unit.title || "Video Lesson";

                return (
                  <Link
                    key={unit.id}
                    ref={isActive ? mobileActiveRef : null}
                    href={`/courses/${courseSlug}/video/${uId}`}
                    className={`flex items-center gap-3 px-3 py-3 transition-all touch-manipulation ${
                      isActive
                        ? "bg-primary-600/15 border-l-2 border-primary-500"
                        : "border-l-2 border-transparent hover:bg-slate-800/40"
                    }`}
                  >
                    {/* Thumbnail placeholder / indicator */}
                    <div
                      className={`w-12 h-8 rounded-lg shrink-0 flex items-center justify-center ${
                        isActive
                          ? "bg-primary-500/20"
                          : isCompleted
                            ? "bg-emerald-950/40 border border-emerald-500/30"
                            : "bg-slate-800"
                      }`}
                    >
                      {isActive ? (
                        <div className="w-2 h-2 rounded-full bg-primary-400 animate-pulse" />
                      ) : isCompleted ? (
                        <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <PlayCircle className="w-4 h-4 text-slate-500" />
                      )}
                    </div>

                    {/* Title */}
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-xs leading-snug line-clamp-2 ${
                          isActive
                            ? "text-foreground font-semibold"
                            : "text-foreground/80"
                        }`}
                      >
                        {title}
                      </p>
                      {isActive ? (
                        <span className="text-[9px] font-bold text-primary-600 dark:text-primary-400 mt-0.5 block">
                          Now Playing
                        </span>
                      ) : isCompleted ? (
                        <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block flex items-center gap-1">
                          Completed
                        </span>
                      ) : formatUnitDuration(unit.duration) ? (
                        <span className="text-[9px] font-mono text-slate-500 mt-0.5 block">
                          {formatUnitDuration(unit.duration)}
                        </span>
                      ) : null}
                    </div>
                  </Link>
                );
              })}
            </div>
          );
        })}
        {/* bottom spacer */}
        <div className="h-6" />
      </div>
    </div>
  );
}
