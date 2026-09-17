'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { GoogleLoginButton } from '@/components/GoogleLoginButton';
import { UserAvatar } from '@/components/UserAvatar';
import { FileCheck2, Trophy, Sparkles, Bookmark, History, LogOut, User as UserIcon, ShieldCheck, Crown, X, Coffee, BookOpen } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { isCourseBatch } from '@/lib/batchAccess';

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isAdmin = user?.role === 'superadmin' || user?.role === 'admin';
  const courseBatches = (user?.allowedBatches || []).filter(isCourseBatch);
  const hasCourseAccess = isAdmin || !!user?.hasCourseAccess || courseBatches.length > 0 || user?.adminPermissions?.includes('access_courses') || user?.adminPermissions?.includes('*');

  // Global Keyboard Section Switcher Shortcuts (Shift + Right/Left or [ / ])
  useEffect(() => {
    const handleSectionShortcut = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const tag = activeEl?.tagName || '';
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || (activeEl as HTMLElement)?.isContentEditable) {
        return;
      }

      // Order of sections: Tests -> Leaderboard -> Courses (if access) -> Saved -> History -> Admin (if admin) -> Profile
      const sections = ['/', '/leaderboard'];
      if (hasCourseAccess) sections.push('/courses');
      sections.push('/bookmarks', '/history');
      if (isAdmin) sections.push('/admin');
      sections.push('/profile');

      const cleanPath = pathname.split('?')[0].replace(/\/$/, '') || '/';
      let currentIdx = sections.findIndex((s) => {
        if (s === '/') return cleanPath === '/';
        return cleanPath === s || cleanPath.startsWith(s + '/');
      });
      if (currentIdx === -1) currentIdx = 0;

      let nextRoute: string | null = null;

      const isNext = (e.shiftKey && (e.key === 'ArrowRight' || e.code === 'ArrowRight')) || e.key === ']' || e.key === '}';
      const isPrev = (e.shiftKey && (e.key === 'ArrowLeft' || e.code === 'ArrowLeft')) || e.key === '[' || e.key === '{';

      if (isNext) {
        e.preventDefault();
        const nextIdx = (currentIdx + 1) % sections.length;
        nextRoute = sections[nextIdx];
      } else if (isPrev) {
        e.preventDefault();
        const prevIdx = (currentIdx - 1 + sections.length) % sections.length;
        nextRoute = sections[prevIdx];
      }

      if (nextRoute && nextRoute !== pathname) {
        router.push(nextRoute);
      }
    };

    window.addEventListener('keydown', handleSectionShortcut, true);
    return () => window.removeEventListener('keydown', handleSectionShortcut, true);
  }, [pathname, isAdmin, router]);

  // Close menu on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  // Hide header during active full-screen quiz taking
  if (pathname.startsWith('/quiz/') && !pathname.includes('/results')) {
    return null;
  }

  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-slate-800/80">
      <div className="w-full px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-1">
          
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 sm:gap-2.5 group shrink-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shadow-md group-hover:border-indigo-500/50 transition-all duration-300">
              <Coffee className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400 group-hover:scale-110 transition-transform duration-300" />
            </div>
            <span className="hidden xs:inline text-base sm:text-xl font-extrabold text-white tracking-tight">
              Prep<span className="text-indigo-400">Tea</span>
            </span>
          </Link>

          {/* Color-Accented Dynamic Responsive Navigation Bar */}
          <nav className="flex items-center p-1 rounded-2xl bg-slate-900/90 border border-slate-800 backdrop-blur-xl shadow-inner gap-1">
            {/* Core 1: Practice Tests */}
            <Link
              href="/"
              className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 ${
                pathname === '/'
                  ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/30 border border-indigo-500/40'
                  : 'text-slate-400 hover:text-indigo-300 hover:bg-indigo-950/40'
              }`}
            >
              <FileCheck2 className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${pathname === '/' ? 'text-white' : 'text-indigo-400'}`} />
              <span className="hidden md:inline">Practice Tests</span>
              <span className="md:hidden">Tests</span>
            </Link>

            {/* Core 2: Leaderboard */}
            <Link
              href="/leaderboard"
              className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 ${
                pathname === '/leaderboard'
                  ? 'bg-amber-600 text-white font-bold shadow-md shadow-amber-600/30 border border-amber-500/40'
                  : 'text-slate-400 hover:text-amber-300 hover:bg-amber-950/40'
              }`}
            >
              <Trophy className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${pathname === '/leaderboard' ? 'text-white' : 'text-amber-400'}`} />
              <span className="hidden md:inline">Leaderboard</span>
              <span className="md:hidden">Ranks</span>
            </Link>

            {/* Courses tab (hidden on mobile/tablet to fit core elements perfectly) */}
            {hasCourseAccess && (
              <Link
                href="/courses"
                className={`hidden md:flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 ${
                  pathname.startsWith('/courses')
                    ? 'bg-purple-600 text-white font-bold shadow-md shadow-purple-600/30 border border-purple-500/40'
                    : 'text-slate-400 hover:text-purple-300 hover:bg-purple-950/40'
                }`}
              >
                <BookOpen className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${pathname.startsWith('/courses') ? 'text-white' : 'text-purple-400'}`} />
                <span>Courses</span>
              </Link>
            )}

            {/* Dynamic Item 1: Saved (Bookmarks) */}
            {user && (
              <Link
                href="/bookmarks"
                className={`hidden lg:flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 ${
                  pathname === '/bookmarks'
                    ? 'bg-rose-600 text-white font-bold shadow-md shadow-rose-600/30 border border-rose-500/40'
                    : 'text-slate-400 hover:text-rose-300 hover:bg-rose-950/40'
                }`}
              >
                <Bookmark className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${pathname === '/bookmarks' ? 'text-white' : 'text-rose-400'}`} />
                <span>Saved</span>
              </Link>
            )}

            {/* Dynamic Item 2: History */}
            {user && (
              <Link
                href="/history"
                className={`hidden xl:flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 ${
                  pathname === '/history'
                    ? 'bg-cyan-600 text-white font-bold shadow-md shadow-cyan-600/30 border border-cyan-500/40'
                    : 'text-slate-400 hover:text-cyan-300 hover:bg-cyan-950/40'
                }`}
              >
                <History className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${pathname === '/history' ? 'text-white' : 'text-cyan-400'}`} />
                <span>History</span>
              </Link>
            )}



            {/* Dynamic Item 4: Profile */}
            {user && (
              <Link
                href="/profile"
                className={`hidden 2xl:flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 ${
                  pathname === '/profile'
                    ? 'bg-emerald-600 text-white font-bold shadow-md shadow-emerald-600/30 border border-emerald-500/40'
                    : 'text-slate-400 hover:text-emerald-300 hover:bg-emerald-950/40'
                }`}
              >
                <UserIcon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${pathname === '/profile' ? 'text-white' : 'text-emerald-400'}`} />
                <span>Profile</span>
              </Link>
            )}
                        {/* Dynamic Item 3: Admin */}
            {isAdmin && (
              <Link
                href="/admin"
                className={`hidden 2xl:flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 ${
                  pathname.startsWith('/admin')
                    ? 'bg-purple-600 text-white font-bold shadow-md shadow-purple-600/30 border border-purple-500/40'
                    : 'text-amber-300 hover:text-purple-200 hover:bg-purple-950/40'
                }`}
              >
                <ShieldCheck className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${pathname.startsWith('/admin') ? 'text-white' : 'text-purple-400'}`} />
                <span>Admin</span>
              </Link>
            )}
          </nav>

          {/* Auth Button / Morphing Profile Menu */}
          <div 
            ref={menuRef} 
            className={`relative shrink-0 h-9 sm:h-10 flex items-center justify-end z-50 ${
              user ? 'w-9 sm:w-10 lg:w-auto lg:min-w-[90px]' : 'w-auto'
            }`}
          >
            {user ? (
              <div
                className={`absolute right-0 top-0 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] origin-top-right overflow-hidden rounded-2xl ${
                  showMenu
                    ? 'w-64 sm:w-72 p-2.5 bg-slate-900/95 glass-panel border border-slate-700 shadow-2xl shadow-indigo-950/70 z-50 scale-100 opacity-100 ring-1 ring-indigo-500/20'
                    : 'w-full h-full p-1 bg-slate-900/90 border border-slate-800 hover:border-slate-700 shadow-md cursor-pointer group rounded-xl flex items-center justify-center'
                }`}
              >
                {!showMenu ? (
                  /* Compact Trigger Button State */
                  <button
                    onClick={() => setShowMenu(true)}
                    className="flex items-center gap-1.5 w-full h-full text-left focus:outline-none px-0.5 justify-center lg:justify-start"
                  >
                    <div className="w-7 h-7 sm:w-8 sm:h-8 shrink-0 flex items-center justify-center overflow-hidden rounded-lg">
                      <UserAvatar name={user.name} email={user.email} image={user.image} size="sm" />
                    </div>
                    <span className="hidden lg:inline text-xs font-bold text-slate-200 group-hover:text-white transition-colors truncate max-w-[65px]">
                      {user.name.split(' ')[0]}
                    </span>
                  </button>
                ) : (
                  /* Expanded Smooth Menu Card State */
                  <div className="space-y-1.5 animate-fade-in">
                    {/* Morph Header - Links to Profile */}
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/80">
                      <Link
                        href="/profile"
                        onClick={() => setShowMenu(false)}
                        className="flex items-center gap-2.5 p-1 rounded-xl hover:bg-slate-800/60 transition-colors flex-1 overflow-hidden group"
                      >
                        <UserAvatar name={user.name} email={user.email} image={user.image} size="md" />
                        <div className="flex flex-col min-w-0">
                          <p className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors flex items-center gap-1 truncate">
                            <span>{user.name}</span>
                            {user.isPremium && <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                          </p>
                          <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
                        </div>
                      </Link>

                      <button
                        onClick={() => setShowMenu(false)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors shrink-0"
                        title="Close menu"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Profile Menu Items (Hides item if already promoted to top nav bar on active screen size) */}
                    {hasCourseAccess && (
                      <Link
                        href="/courses"
                        onClick={() => setShowMenu(false)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/60 transition-all group md:hidden"
                      >
                        <BookOpen className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform" />
                        <span>My Courses</span>
                      </Link>
                    )}

                    <Link
                      href="/profile"
                      onClick={() => setShowMenu(false)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/60 transition-all group 2xl:hidden"
                    >
                      <UserIcon className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
                      <span>My Profile & Rewards</span>
                    </Link>

                    <Link
                      href="/bookmarks"
                      onClick={() => setShowMenu(false)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/60 transition-all group lg:hidden"
                    >
                      <Bookmark className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                      <span>Bookmarks</span>
                    </Link>

                    <Link
                      href="/history"
                      onClick={() => setShowMenu(false)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/60 transition-all group xl:hidden"
                    >
                      <History className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
                      <span>History</span>
                    </Link>

                    {isAdmin && (
                      <Link
                        href="/admin"
                        onClick={() => setShowMenu(false)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-all group 2xl:hidden"
                      >
                        <ShieldCheck className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                        <span>Admin Panel</span>
                      </Link>
                    )}

                    <button
                      onClick={() => {
                        logout();
                        setShowMenu(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition-all group"
                    >
                      <LogOut className="w-4 h-4 group-hover:scale-110 transition-transform" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <GoogleLoginButton label="Sign In" size="small" />
            )}
          </div>

        </div>
      </div>
    </header>
  );
}
