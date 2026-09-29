'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { GoogleLoginButton } from '@/components/GoogleLoginButton';
import { UserAvatar } from '@/components/UserAvatar';
import { FileCheck2, Trophy, Sparkles, Bookmark, History, LogOut, User as UserIcon, ShieldCheck, X, Coffee, BookOpen, ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { isCourseBatch } from '@/lib/batchAccess';

export function Navbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isAdmin = user?.role === 'superadmin' || user?.role === 'admin';
  const courseBatches = (user?.allowedBatches || []).filter(isCourseBatch);
  const hasCourseAccess = isAdmin || courseBatches.length > 0 || user?.adminPermissions?.includes('access_courses') || user?.adminPermissions?.includes('*');

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
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-card-border/80">
      <div className="w-full px-3 sm:px-4 lg:px-6 xl:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-2 sm:gap-3">
          
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 sm:gap-2.5 group shrink-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-card border border-card-border flex items-center justify-center shadow-md group-hover:border-primary-500/50 transition-all duration-300">
              <Coffee className="w-4 h-4 sm:w-5 sm:h-5 text-primary-600 dark:text-primary-400 group-hover:scale-110 transition-transform duration-300" />
            </div>
            <span className="text-base sm:text-xl font-extrabold text-foreground tracking-tight">
              Prep<span className="text-primary-600 dark:text-primary-400">Tea</span>
            </span>
          </Link>

          {/* Color-Accented Dynamic Responsive Navigation Bar (Desktop Only) */}
          <nav className="hidden md:flex items-center p-1 rounded-2xl bg-card/90 border border-card-border backdrop-blur-xl shadow-inner gap-1">
            {/* Core 1: Practice Tests */}
            <Link
              href="/"
              title="Practice Tests"
              className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 ${
                pathname === '/'
                  ? 'bg-primary-600 text-white font-bold shadow-md shadow-primary-600/30 border border-primary-500/40'
                  : 'text-muted-foreground hover:text-primary-600 dark:hover:text-primary-300 hover:bg-primary-950/40'
              }`}
            >
              <FileCheck2 className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${pathname === '/' ? 'text-foreground' : 'text-primary-600 dark:text-primary-400'}`} />
              <span className="hidden lg:inline">Practice Tests</span>
              <span className="lg:hidden">Tests</span>
            </Link>

            {/* Core 2: Leaderboard */}
            <Link
              href="/leaderboard"
              title="Leaderboard"
              className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 ${
                pathname === '/leaderboard'
                  ? 'bg-amber-600 text-white font-bold shadow-md shadow-amber-600/30 border border-amber-500/40'
                  : 'text-muted-foreground hover:text-amber-600 dark:hover:text-amber-300 hover:bg-amber-950/40'
              }`}
            >
              <Trophy className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${pathname === '/leaderboard' ? 'text-foreground' : 'text-amber-600 dark:text-amber-400'}`} />
              <span className="hidden lg:inline">Leaderboard</span>
              <span className="lg:hidden">Ranks</span>
            </Link>

            {/* Courses tab */}
            {hasCourseAccess && (
              <Link
                href="/courses"
                title="Courses"
                className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 ${
                  pathname.startsWith('/courses')
                    ? 'bg-primary-600 text-white font-bold shadow-md shadow-primary-600/30 border border-primary-500/40'
                    : 'text-muted-foreground hover:text-primary-600 dark:hover:text-primary-300 hover:bg-primary-950/40'
                }`}
              >
                <BookOpen className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${pathname.startsWith('/courses') ? 'text-foreground' : 'text-primary-600 dark:text-primary-400'}`} />
                <span>Courses</span>
              </Link>
            )}

            {/* Pricing Tab */}
            <Link
              href="/pricing"
              title="Pricing"
              className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 ${
                pathname === '/pricing'
                  ? 'bg-amber-600 text-white font-bold shadow-md shadow-amber-600/30 border border-amber-500/40'
                  : 'text-muted-foreground hover:text-amber-600 dark:hover:text-amber-300 hover:bg-amber-950/40'
              }`}
            >
              <Sparkles className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${pathname === '/pricing' ? 'text-foreground' : 'text-amber-600 dark:text-amber-400'}`} />
              <span>Pricing</span>
            </Link>
          </nav>

          {/* Auth Button / Morphing Profile Menu */}
          <div ref={menuRef} className="relative shrink-0 z-50">
            {user ? (
              <>
                {/* Trigger Button State */}
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="flex items-center gap-1.5 sm:gap-2 p-1 sm:p-1.5 rounded-xl bg-card/90 border border-card-border hover:border-primary-500/50 shadow-sm transition-all focus:outline-none group cursor-pointer"
                  title="Account options & menu"
                  aria-label="Account options & menu"
                >
                  <UserAvatar
                    name={user.name}
                    email={user.email}
                    image={user.image}
                    size="sm"
                    isPremium={user.isPremium}
                  />

                  <div className="flex items-center gap-1.5 min-w-0 pr-0.5">
                    <span className="hidden sm:inline text-xs font-bold text-foreground group-hover:text-primary-600 dark:group-hover:text-primary-300 transition-colors truncate max-w-[85px]">
                      {user.name.split(' ')[0]}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground shrink-0 transition-transform duration-200 ${showMenu ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {/* Dropdown Menu Popup Container with Smooth Morphing Animation */}
                <div
                  className={`absolute right-0 top-full mt-2 w-64 sm:w-72 p-2.5 bg-card/95 glass-panel border border-slate-700 shadow-2xl z-50 rounded-2xl origin-top-right transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] space-y-1.5 ${
                    showMenu
                      ? 'scale-100 opacity-100 translate-y-0 pointer-events-auto ring-1 ring-primary-500/20 shadow-primary-950/70'
                      : 'scale-90 opacity-0 -translate-y-2 pointer-events-none'
                  }`}
                >
                  {/* Header - Links to Profile */}
                  <div className="flex items-center justify-between pb-1.5 border-b border-card-border/80">
                    <Link
                      href="/profile"
                      onClick={() => setShowMenu(false)}
                      className="flex items-center gap-2.5 p-1 rounded-xl hover:bg-slate-800/60 transition-colors flex-1 overflow-hidden group"
                    >
                      <UserAvatar
                        name={user.name}
                        email={user.email}
                        image={user.image}
                        size="md"
                        isPremium={user.isPremium}
                      />
                      <div className="flex flex-col min-w-0">
                        <p className="text-sm font-bold text-foreground group-hover:text-primary-600 dark:group-hover:text-primary-300 transition-colors truncate">
                          {user.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
                      </div>
                    </Link>

                    <button
                      onClick={() => setShowMenu(false)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-slate-800/80 transition-colors shrink-0"
                      title="Close menu"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Profile */}
                  <Link
                    href="/profile"
                    onClick={() => setShowMenu(false)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-foreground/80 hover:text-foreground hover:bg-slate-800/60 transition-all group"
                  >
                    <UserIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
                    <span>Profile</span>
                  </Link>

                  {/* Bookmarks */}
                  <Link
                    href="/bookmarks"
                    onClick={() => setShowMenu(false)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-foreground/80 hover:text-foreground hover:bg-slate-800/60 transition-all group"
                  >
                    <Bookmark className="w-4 h-4 text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform" />
                    <span>Bookmarks</span>
                  </Link>

                  {/* History */}
                  <Link
                    href="/history"
                    onClick={() => setShowMenu(false)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-foreground/80 hover:text-foreground hover:bg-slate-800/60 transition-all group"
                  >
                    <History className="w-4 h-4 text-cyan-600 dark:text-cyan-400 group-hover:scale-110 transition-transform" />
                    <span>History</span>
                  </Link>

                  {/* Admin */}
                  {isAdmin && (
                    <Link
                      href="/admin"
                      onClick={() => setShowMenu(false)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-amber-600 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-all group"
                    >
                      <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform" />
                      <span>Admin</span>
                    </Link>
                  )}

                  <button
                    onClick={() => {
                      logout();
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-all group"
                  >
                    <LogOut className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </>
            ) : (
              <GoogleLoginButton label="Sign In" size="small" />
            )}
          </div>

        </div>
      </div>
    </header>
  );
}
