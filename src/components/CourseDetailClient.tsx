'use client';

import React, { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { CourseDetail, CourseSectionUnit } from '@/lib/types';
import { AssessmentMeta } from '@/lib/types';
import {
  BookOpen,
  Layers,
  Video,
  FileCheck2,
  FileText,
  Award,
  ArrowLeft,
  ChevronRight,
  Play,
  PlayCircle,
  HelpCircle,
  FileEdit,
  Paperclip,
  UserCheck,
  Package,
  Music,
  Headphones,
  Code,
  Presentation,
  ExternalLink,
  Tv,
  Users,
  User,
  ClipboardList,
  Link2,
  Download,
  Lock,
  VideoOff,
  Clock
} from 'lucide-react';

interface CourseDetailClientProps {
  course: CourseDetail;
  availableTests: AssessmentMeta[];
  isUnlocked?: boolean;
}

function formatCourseDuration(seconds?: number): string | null {
  if (!seconds || seconds <= 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return `${m} min`;
}

function formatUnitDuration(seconds?: number): string | null {
  if (!seconds || seconds <= 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  }
  return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
}

/**
 * Returns metadata config (Icon, Color, Label, Category) for all 33 learning_path_type variants
 */
function getUnitMetaConfig(unit: CourseSectionUnit) {
  const type = (unit.type || '').toLowerCase();
  const icon = (unit.icon || '').toLowerCase();
  const subtitle = (unit.subtitle || '').toLowerCase();

  // 1. ivideo / video / wistia (Supported Video Action)
  if (type === 'ivideo' || type === 'wistia' || type === 'video' || icon === 'video' || subtitle === 'video') {
    return {
      category: 'video',
      typeLabel: 'Interactive Video',
      icon: Video,
      colorClass: 'bg-blue-600/20 text-blue-600 dark:text-blue-400 border-blue-500/30',
      isActionableVideo: true,
      isActionableExam: false
    };
  }

  // 2. youtube (Playable YouTube Video with embed HTML)
  if (type === 'youtube' || icon === 'yt' || subtitle.includes('youtube')) {
    return {
      category: 'video',
      typeLabel: 'YouTube Video',
      icon: PlayCircle,
      colorClass: 'bg-red-600/20 text-red-600 dark:text-red-400 border-red-500/30',
      isActionableVideo: true,
      isActionableExam: false
    };
  }

  // 3. soundcloud / audio
  if (type === 'soundcloud') {
    return {
      category: 'audio',
      typeLabel: 'SoundCloud Audio',
      icon: Music,
      colorClass: 'bg-rose-600/20 text-rose-600 dark:text-rose-400 border-rose-500/30',
      isActionableVideo: false,
      isActionableExam: false
    };
  }
  if (type === 'audio') {
    return {
      category: 'audio',
      typeLabel: 'Audio Track',
      icon: Headphones,
      colorClass: 'bg-rose-600/20 text-rose-600 dark:text-rose-400 border-rose-500/30',
      isActionableVideo: false,
      isActionableExam: false
    };
  }

  // 4. assessmentv2 (Supported Exam Action)
  if (type === 'assessmentv2') {
    return {
      category: 'quiz',
      typeLabel: 'Assessment (V2)',
      icon: FileCheck2,
      colorClass: 'bg-primary-600/20 text-primary-600 dark:text-primary-400 border-primary-500/30',
      isActionableVideo: false,
      isActionableExam: true
    };
  }

  // 5. assessment / quizzes
  if (type === 'assessment') {
    return {
      category: 'quiz',
      typeLabel: 'Assessment',
      icon: FileCheck2,
      colorClass: 'bg-primary-600/20 text-primary-600 dark:text-primary-400 border-primary-500/30',
      isActionableVideo: false,
      isActionableExam: true
    };
  }
  if (type === 'quizinformal') {
    return {
      category: 'quiz',
      typeLabel: 'Informal Quiz',
      icon: HelpCircle,
      colorClass: 'bg-primary-600/20 text-primary-600 dark:text-primary-400 border-primary-500/30',
      isActionableVideo: false,
      isActionableExam: true
    };
  }
  if (type === 'quizformal') {
    return {
      category: 'quiz',
      typeLabel: 'Formal Quiz',
      icon: FileCheck2,
      colorClass: 'bg-primary-600/20 text-primary-600 dark:text-primary-400 border-primary-500/30',
      isActionableVideo: false,
      isActionableExam: true
    };
  }
  if (type === 'quizwritten') {
    return {
      category: 'quiz',
      typeLabel: 'Written Quiz',
      icon: FileEdit,
      colorClass: 'bg-violet-600/20 text-violet-400 border-violet-500/30',
      isActionableVideo: false,
      isActionableExam: true
    };
  }
  if (type === 'quizfiles') {
    return {
      category: 'quiz',
      typeLabel: 'File Quiz',
      icon: Paperclip,
      colorClass: 'bg-cyan-600/20 text-cyan-600 dark:text-cyan-400 border-cyan-500/30',
      isActionableVideo: false,
      isActionableExam: false
    };
  }
  if (type === 'selfassessment') {
    return {
      category: 'quiz',
      typeLabel: 'Self Assessment',
      icon: UserCheck,
      colorClass: 'bg-sky-600/20 text-sky-400 border-sky-500/30',
      isActionableVideo: false,
      isActionableExam: false
    };
  }

  // 6. pdf & ebooks
  if (type === 'pdf') {
    return {
      category: 'pdf',
      typeLabel: 'PDF Document',
      icon: FileText,
      colorClass: 'bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
      isActionableVideo: false,
      isActionableExam: false
    };
  }
  if (type === 'ebook' || type === 'pbebook' || icon === 'ebook' || subtitle === 'ebook') {
    return {
      category: 'ebook',
      typeLabel: type === 'pbebook' ? 'FlipBook eBook' : 'eBook',
      icon: BookOpen,
      colorClass: 'bg-teal-600/20 text-teal-400 border-teal-500/30',
      isActionableVideo: false,
      isActionableExam: false
    };
  }

  // 7. scorm / scormgraded
  if (type === 'scorm' || type === 'scormgraded') {
    return {
      category: 'interactive',
      typeLabel: type === 'scormgraded' ? 'Graded SCORM' : 'SCORM Package',
      icon: Package,
      colorClass: 'bg-amber-600/20 text-amber-600 dark:text-amber-400 border-amber-500/30',
      isActionableVideo: false,
      isActionableExam: false
    };
  }

  // 8. embed / presentations / url
  if (type === 'embed') {
    return {
      category: 'interactive',
      typeLabel: 'Embed Element',
      icon: Code,
      colorClass: 'bg-slate-700/40 text-foreground/80 border-slate-600/50',
      isActionableVideo: false,
      isActionableExam: false
    };
  }
  if (type === 'slideshare' || type === 'slideshow') {
    return {
      category: 'interactive',
      typeLabel: type === 'slideshare' ? 'SlideShare' : 'Slide Show',
      icon: Presentation,
      colorClass: 'bg-lime-600/20 text-lime-400 border-lime-500/30',
      isActionableVideo: false,
      isActionableExam: false
    };
  }
  if (type === 'url') {
    return {
      category: 'interactive',
      typeLabel: 'External Link',
      icon: ExternalLink,
      colorClass: 'bg-cyan-600/20 text-cyan-600 dark:text-cyan-400 border-cyan-500/30',
      isActionableVideo: false,
      isActionableExam: false
    };
  }

  // 9. Meetings & Live Sessions
  if (type === 'zoommeeting' || type === 'zoomwebinar' || type === 'webexmeeting' || type === 'googlemeet') {
    return {
      category: 'live',
      typeLabel: 'Live Session',
      icon: Tv,
      colorClass: 'bg-blue-600/20 text-blue-600 dark:text-blue-300 border-blue-500/30',
      isActionableVideo: false,
      isActionableExam: false
    };
  }
  if (type === 'teamsmeeting' || type === 'groupsession') {
    return {
      category: 'live',
      typeLabel: 'Group Session',
      icon: Users,
      colorClass: 'bg-primary-600/20 text-primary-600 dark:text-primary-400 border-primary-500/30',
      isActionableVideo: false,
      isActionableExam: false
    };
  }
  if (type === 'oneononesession') {
    return {
      category: 'live',
      typeLabel: '1-on-1 Session',
      icon: User,
      colorClass: 'bg-pink-600/20 text-pink-600 dark:text-pink-400 border-pink-500/30',
      isActionableVideo: false,
      isActionableExam: false
    };
  }

  // 10. LTI
  if (type === 'lti' || type === 'ltigraded') {
    return {
      category: 'interactive',
      typeLabel: 'LTI External Tool',
      icon: Link2,
      colorClass: 'bg-zinc-700/40 text-zinc-300 border-zinc-600/50',
      isActionableVideo: false,
      isActionableExam: false
    };
  }

  // 11. Certificates
  if (type.includes('certificate') || subtitle.includes('certificate') || icon === 'certification2') {
    return {
      category: 'cert',
      typeLabel: 'Certificate',
      icon: Award,
      colorClass: 'bg-amber-600/20 text-amber-600 dark:text-amber-400 border-amber-500/30',
      isActionableVideo: false,
      isActionableExam: false
    };
  }

  // 12. Survey
  if (type === 'newsurvey') {
    return {
      category: 'interactive',
      typeLabel: 'Survey',
      icon: ClipboardList,
      colorClass: 'bg-fuchsia-600/20 text-fuchsia-400 border-fuchsia-500/30',
      isActionableVideo: false,
      isActionableExam: false
    };
  }

  // Fallback
  return {
    category: 'other',
    typeLabel: unit.subtitle || unit.type || 'Lesson',
    icon: BookOpen,
    colorClass: 'bg-slate-800 text-muted-foreground border-slate-700/50',
    isActionableVideo: false,
    isActionableExam: false
  };
}

export function CourseDetailClient({ course, availableTests, isUnlocked = true }: CourseDetailClientProps) {
  const [lastVideoInfo, setLastVideoInfo] = useState<{ videoId: string; title?: string; timestamp?: number } | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`preptea_last_video_${course.slug}`);
      if (stored) {
        setLastVideoInfo(JSON.parse(stored));
      }
    } catch (e) {
      // ignore
    }
  }, [course.slug]);

  // Calculate specific content type breakdown (Videos, Quizzes, PDFs, eBooks, Certificates, Audio, Live, Interactive, Other)
  const contentCounts = useMemo(() => {
    return course.sections.reduce(
      (acc, section) => {
        section.units.forEach((unit) => {
          const config = getUnitMetaConfig(unit);
          if (config.category === 'video') acc.video++;
          else if (config.category === 'quiz') acc.quiz++;
          else if (config.category === 'pdf') acc.pdf++;
          else if (config.category === 'ebook') acc.ebook++;
          else if (config.category === 'cert') acc.cert++;
          else if (config.category === 'audio') acc.audio++;
          else if (config.category === 'live') acc.live++;
          else if (config.category === 'interactive') acc.interactive++;
          else acc.other++;
        });
        return acc;
      },
      { pdf: 0, ebook: 0, video: 0, quiz: 0, cert: 0, audio: 0, live: 0, interactive: 0, other: 0 }
    );
  }, [course]);

  return (
    <div className="space-y-8">
      {/* Back Button */}
      <Link
        href="/courses"
        className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Courses</span>
      </Link>

      {/* Locked Course Banner Notice */}
      {!isUnlocked && (
        <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/30 text-amber-600 dark:text-amber-300 text-xs font-semibold flex items-center gap-3">
          <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <div>
            <p className="font-bold text-amber-200">Batch Locked</p>
            <p className="text-[11px] text-amber-600 dark:text-amber-400/80 mt-0.5">
              You are viewing the course syllabus and unit list. Video playback for this batch requires batch authorization from admin or redeem code activation.
            </p>
          </div>
        </div>
      )}

      {/* Course Banner Header */}
      <div className="glass-panel rounded-3xl p-6 sm:p-10 border border-card-border space-y-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-primary-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-3xl sm:text-4xl font-black text-foreground">{course.title}</h1>
          {course.isOngoing && (
            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase px-3 py-1 rounded-lg bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-500/10">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              Ongoing Course
            </span>
          )}
        </div>

        {course.keywords && (
          <p className="text-sm text-foreground/80 max-w-3xl leading-relaxed">
            {course.keywords}
          </p>
        )}

        {lastVideoInfo && isUnlocked && (
          <div className="pt-1">
            <Link
              href={`/courses/${course.slug}/video/${lastVideoInfo.videoId}`}
              className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary-600 to-primary-600 hover:from-primary-500 hover:to-primary-500 text-white font-bold text-xs shadow-lg shadow-primary-600/30 transition-all active:scale-95 group max-w-full"
            >
              <Play className="w-4 h-4 fill-white shrink-0 group-hover:scale-110 transition-transform" />
              <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                <span className="font-extrabold shrink-0">Resume Learning:</span>
                <span className="text-[11px] font-medium text-primary-200 truncate max-w-[240px] sm:max-w-[360px]">
                  {lastVideoInfo.title || 'Video Lesson'} ({Math.floor((lastVideoInfo.timestamp || 0) / 60)}:{(Math.floor((lastVideoInfo.timestamp || 0) % 60) < 10 ? '0' : '') + Math.floor((lastVideoInfo.timestamp || 0) % 60)})
                </span>
              </div>
            </Link>
          </div>
        )}

        {/* Course Breakdown Header Stats Bar */}
        <div className="flex items-center gap-6 pt-4 border-t border-card-border/80 text-xs text-muted-foreground flex-wrap">
          {course.sectionsCount > 0 && (
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary-600 dark:text-primary-400" />
              <strong className="text-foreground">{course.sectionsCount}</strong> Sections
            </div>
          )}

          {contentCounts.video > 0 && (
            <div className="flex items-center gap-2">
              <Video className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <strong className="text-foreground">{contentCounts.video}</strong> Videos
            </div>
          )}

          {contentCounts.quiz > 0 && (
            <div className="flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-primary-600 dark:text-primary-400" />
              <strong className="text-foreground">{contentCounts.quiz}</strong> Quizzes
            </div>
          )}

          {contentCounts.pdf > 0 && (
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <strong className="text-foreground">{contentCounts.pdf}</strong> PDFs
            </div>
          )}

          {contentCounts.ebook > 0 && (
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-teal-400" />
              <strong className="text-foreground">{contentCounts.ebook}</strong> {contentCounts.ebook === 1 ? 'eBook' : 'eBooks'}
            </div>
          )}

          {contentCounts.cert > 0 && (
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <strong className="text-foreground">{contentCounts.cert}</strong> {contentCounts.cert === 1 ? 'Certificate' : 'Certificates'}
            </div>
          )}

          {contentCounts.audio > 0 && (
            <div className="flex items-center gap-2">
              <Headphones className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              <strong className="text-foreground">{contentCounts.audio}</strong> Audio
            </div>
          )}

          {contentCounts.live > 0 && (
            <div className="flex items-center gap-2">
              <Tv className="w-4 h-4 text-sky-400" />
              <strong className="text-foreground">{contentCounts.live}</strong> Live Sessions
            </div>
          )}

          {contentCounts.interactive > 0 && (
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-lime-400" />
              <strong className="text-foreground">{contentCounts.interactive}</strong> Interactive
            </div>
          )}

          {contentCounts.other > 0 && (
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-muted-foreground" />
              <strong className="text-foreground">{contentCounts.other}</strong> Other
            </div>
          )}

          {formatCourseDuration(course.totalDurationSeconds) && (
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-violet-400" />
              <strong className="text-foreground">{formatCourseDuration(course.totalDurationSeconds)}</strong> Total
            </div>
          )}
        </div>
      </div>

      {/* Section Syllabus Breakdown */}
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Layers className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          <span>Course Curriculum</span>
        </h2>

        <div className="space-y-4">
          {course.sections.map((section, sIdx) => (
            <div key={section.id} className="glass-card rounded-2xl border border-card-border p-6 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <span className="text-xs font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wider">
                    Section {sIdx + 1}
                  </span>
                  <h3 className="text-lg font-bold text-foreground mt-0.5">{section.title}</h3>
                </div>

                {(() => {
                  const sectionSecs = section.units.reduce((acc, u) => acc + (u.duration || 0), 0);
                  const formattedSecDuration = formatCourseDuration(sectionSecs);
                  return (
                    <div className="flex items-center gap-3 text-xs text-muted-foreground font-medium">
                      <span>{section.units.length} Units</span>
                      {formattedSecDuration && (
                        <>
                          <span className="text-slate-600">•</span>
                          <span className="flex items-center gap-1 text-foreground/80">
                            <Clock className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
                            {formattedSecDuration}
                          </span>
                        </>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Units List */}
              <div className="space-y-2.5 pt-2">
                {section.units.map((unit, uIdx) => {
                  const config = getUnitMetaConfig(unit);
                  const IconComp = config.icon;

                  // Read fileUrl directly from unit (parsed from course JSON)
                  const downloadUrl = unit.fileUrl;

                  const matchingTest = config.isActionableExam
                    ? availableTests.find((t) => {
                        // Priority 1: Exact object_id match (unit.id === t.objectId)
                        if (unit.id && (t.objectId === unit.id || t.assessmentId === unit.id)) {
                          return true;
                        }
                        // Priority 2: Exact assessmentId match (unit.data.assessmentId === t.assessmentId)
                        if (unit.data?.assessmentId && (t.assessmentId === unit.data.assessmentId || t.objectId === unit.data.assessmentId)) {
                          return true;
                        }
                        return false;
                      }) ||
                      availableTests.find((t) => {
                        // Priority 3: Exact title/quizId match
                        const cleanUnitTitle = (unit.unitTitle || '').toLowerCase().trim();
                        const cleanQuizId = t.quizId.toLowerCase().trim();
                        return cleanUnitTitle && cleanQuizId === cleanUnitTitle;
                      }) ||
                      availableTests.find((t) => {
                        // Priority 4: Number extraction match (e.g. if unitTitle has "13" and quizId has "13")
                        const cleanUnitTitle = (unit.unitTitle || '').toLowerCase().trim();
                        const cleanQuizId = t.quizId.toLowerCase().trim();
                        const unitNum = cleanUnitTitle.match(/\d+/)?.[0];
                        const quizNum = cleanQuizId.match(/\d+/)?.[0];
                        if (unitNum && quizNum && unitNum === quizNum) {
                          const baseUnit = cleanUnitTitle.replace(/\d+/g, '').trim();
                          const baseQuiz = cleanQuizId.replace(/\d+/g, '').trim();
                          if (baseUnit && baseQuiz && (baseUnit.includes(baseQuiz) || baseQuiz.includes(baseUnit))) {
                            return true;
                          }
                        }
                        return false;
                      }) ||
                      availableTests[0]
                    : null;

                  return (
                    <div
                      key={unit.id}
                      className="p-3.5 rounded-xl bg-card/60 border border-card-border/80 flex items-center justify-between gap-4 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 border ${config.colorClass}`}>
                          <IconComp className="w-4 h-4" />
                        </div>

                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {unit.unitTitle !== 'Untitled' ? unit.unitTitle : `${section.title} Lesson ${uIdx + 1}`}
                          </p>
                          {formatUnitDuration(unit.duration) && config.isActionableVideo && (
                            <span className="text-[11px] text-slate-500 mt-0.5 block font-mono">
                              {formatUnitDuration(unit.duration)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action Button: Download File / eBook */}
                      {downloadUrl ? (
                        <a
                          href={downloadUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          download
                          className="px-3.5 py-1.5 rounded-lg bg-teal-600/20 hover:bg-teal-600 text-teal-300 hover:text-foreground text-xs font-bold transition-all border border-teal-500/30 hover:border-transparent flex items-center gap-1.5 shrink-0"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download File</span>
                        </a>
                      ) : (config.category === 'ebook' || unit.type === 'pbebook' || unit.type === 'ebook') ? (
                        <div className="px-3.5 py-1.5 rounded-lg bg-teal-950/40 text-teal-300 text-xs font-bold border border-teal-500/30 flex items-center gap-1.5 shrink-0">
                          <BookOpen className="w-3.5 h-3.5 text-teal-400" />
                          <span>eBook Notes</span>
                        </div>
                      ) : null}

                      {/* Action Button: Certificate */}
                      {config.category === 'cert' && !downloadUrl && (
                        <div className="px-3.5 py-1.5 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-300 text-xs font-bold border border-amber-500/40 flex items-center gap-1.5 shrink-0">
                          <Award className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                          <span>Course Certificate</span>
                        </div>
                      )}

                      {/* Action Button: Take Exam */}
                      {config.isActionableExam && matchingTest && !downloadUrl && (
                        <Link
                          href={`/quiz/${matchingTest.quizId}`}
                          className="px-3.5 py-1.5 rounded-lg bg-primary-600/20 hover:bg-primary-600 text-primary-600 dark:text-primary-300 hover:text-white text-xs font-bold transition-all border border-primary-500/30 hover:border-transparent flex items-center gap-1 shrink-0"
                        >
                          <span>Take Exam</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      )}

                      {/* Action Button: Watch Lesson / Video Not Available / Locked Video */}
                      {config.isActionableVideo && !downloadUrl && (() => {
                        const isYouTube = unit.type === 'youtube' || unit.icon === 'yt' || (unit.subtitle && unit.subtitle.toLowerCase().includes('youtube')) || !!(unit.data && unit.data.embed);
                        const hasVideoSource = !!(unit.sourceid && unit.sourceid.trim() !== '') || isYouTube;

                        if (!hasVideoSource) {
                          return (
                            <div
                              className="px-3.5 py-1.5 rounded-lg bg-slate-800/60 text-muted-foreground text-xs font-semibold border border-slate-700/50 flex items-center gap-1.5 shrink-0 cursor-not-allowed"
                              title="Video source is not available for this lesson"
                            >
                              <VideoOff className="w-3.5 h-3.5 text-muted-foreground" />
                              <span>Video Not Available</span>
                            </div>
                          );
                        }

                        return isUnlocked ? (
                          <Link
                            href={`/courses/${course.slug}/video/${unit.sourceid || unit.id}`}
                            className="px-3.5 py-1.5 rounded-lg bg-primary-600/20 hover:bg-primary-600 text-primary-600 dark:text-primary-300 hover:text-white text-xs font-bold transition-all border border-primary-500/30 hover:border-transparent flex items-center gap-1.5 shrink-0"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>Watch Lesson</span>
                          </Link>
                        ) : (
                          <Link
                            href={`/courses/${course.slug}/video/${unit.sourceid || unit.id}`}
                            className="px-3.5 py-1.5 rounded-lg bg-amber-950/40 hover:bg-amber-900/60 text-amber-600 dark:text-amber-400 text-xs font-bold transition-all border border-amber-500/30 flex items-center gap-1.5 shrink-0"
                          >
                            <Lock className="w-3.5 h-3.5" />
                            <span>Locked Video</span>
                          </Link>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>

            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
