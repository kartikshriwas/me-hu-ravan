'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { GoogleLoginButton } from '@/components/GoogleLoginButton';
import { UserAvatar } from '@/components/UserAvatar';
import { FileCheck2, Trophy, Sparkles, Bookmark, History, LogOut, User as UserIcon, ShieldCheck, Crown, X, Coffee, BookOpen, ChevronDown } from 'lucide-react';
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

          {/* Responsive Desktop Navigation — each item has its own breakpoint entry */}
          <nav className="hidden md:flex items-center p-1 rounded-2xl bg-card/90 border border-card-border backdrop-blur-xl shadow-inner gap-0.5 lg:gap-1">
            {/* ── Tier 1 · md (768px) — Core navigation ── */}
            <Link
              href="/"
              title="Practice Tests"
              className={`flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-xl text-sm font-semibold transition-all duration-200 shrink-0 ${
                pathname === '/'
                  ? 'bg-primary-600 text-white font-bold shadow-md shadow-primary-600/30 border border-primary-500/40'
                  : 'text-muted-foreground hover:text-primary-600 dark:hover:text-primary-300 hover:bg-primary-950/40'
              }`}
            >
              <FileCheck2 className={`w-4 h-4 shrink-0 ${pathname === '/' ? 'text-foreground' : 'text-primary-600 dark:text-primary-400'}`} />
              <span>Tests</span>
            </Link>

            <Link
              href="/leaderboard"
              title="Leaderboard"
              className={`flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-xl text-sm font-semibold transition-all duration-200 shrink-0 ${
                pathname === '/leaderboard'
                  ? 'bg-amber-600 text-white font-bold shadow-md shadow-amber-600/30 border border-amber-500/40'
                  : 'text-muted-foreground hover:text-amber-600 dark:hover:text-amber-300 hover:bg-amber-950/40'
              }`}
            >
              <Trophy className={`w-4 h-4 shrink-0 ${pathname === '/leaderboard' ? 'text-foreground' : 'text-amber-600 dark:text-amber-400'}`} />
              <span>Ranks</span>
            </Link>

            {/* ── Tier 2 · lg (1024px) ── */}
            {hasCourseAccess && (
              <Link
                href="/courses"
                title="Courses"
                className={`hidden lg:flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-xl text-sm font-semibold transition-all duration-200 shrink-0 ${
                  pathname.startsWith('/courses')
                    ? 'bg-primary-600 text-white font-bold shadow-md shadow-primary-600/30 border border-primary-500/40'
                    : 'text-muted-foreground hover:text-primary-600 dark:hover:text-primary-300 hover:bg-primary-950/40'
                }`}
              >
                <BookOpen className={`w-4 h-4 shrink-0 ${pathname.startsWith('/courses') ? 'text-foreground' : 'text-primary-600 dark:text-primary-400'}`} />
                <span>Courses</span>
              </Link>
            )}

            {/* ── Tier 3 · mlg (1152px) ── */}
            <Link
              href="/pricing"
              title="Pricing"
              className={`hidden mlg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-sm font-semibold transition-all duration-200 shrink-0 ${
                pathname === '/pricing'
                  ? 'bg-amber-600 text-white font-bold shadow-md shadow-amber-600/30 border border-amber-500/40'
                  : 'text-muted-foreground hover:text-amber-600 dark:hover:text-amber-300 hover:bg-amber-950/40'
              }`}
            >
              <Sparkles className={`w-4 h-4 shrink-0 ${pathname === '/pricing' ? 'text-foreground' : 'text-amber-600 dark:text-amber-400'}`} />
              <span>Pricing</span>
            </Link>

            {/* ── User links — icon-only at entry, text label at 2xl ── */}
            {user && (
              <>
                <div className="hidden xl:block w-px h-5 bg-card-border/60 mx-0.5 shrink-0" />

                {/* Tier 4 · xl (1280px) */}
                <Link
                  href="/profile"
                  title="Profile"
                  className={`hidden xl:flex items-center gap-1 2xl:gap-1.5 px-2 2xl:px-2.5 py-1.5 rounded-xl text-sm font-semibold transition-all duration-200 shrink-0 ${
                    pathname === '/profile'
                      ? 'bg-emerald-600 text-white font-bold shadow-md shadow-emerald-600/30 border border-emerald-500/40'
                      : 'text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-300 hover:bg-emerald-950/40'
                  }`}
                >
                  <UserIcon className={`w-4 h-4 shrink-0 ${pathname === '/profile' ? 'text-foreground' : 'text-emerald-600 dark:text-emerald-400'}`} />
                  <span className="hidden 2xl:inline">Profile</span>
                </Link>

                {/* Tier 5 · mxl (1408px) */}
                <Link
                  href="/bookmarks"
                  title="Bookmarks"
                  className={`hidden mxl:flex items-center gap-1 2xl:gap-1.5 px-2 2xl:px-2.5 py-1.5 rounded-xl text-sm font-semibold transition-all duration-200 shrink-0 ${
                    pathname === '/bookmarks'
                      ? 'bg-rose-600 text-white font-bold shadow-md shadow-rose-600/30 border border-rose-500/40'
                      : 'text-muted-foreground hover:text-rose-600 dark:hover:text-rose-300 hover:bg-rose-950/40'
                  }`}
                >
                  <Bookmark className={`w-4 h-4 shrink-0 ${pathname === '/bookmarks' ? 'text-foreground' : 'text-rose-600 dark:text-rose-400'}`} />
                  <span className="hidden 2xl:inline">Bookmarks</span>
                </Link>

                {/* Tier 6 · 2xl (1536px) */}
                <Link
                  href="/history"
                  title="History"
                  className={`hidden 2xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-sm font-semibold transition-all duration-200 shrink-0 ${
                    pathname === '/history'
                      ? 'bg-cyan-600 text-white font-bold shadow-md shadow-cyan-600/30 border border-cyan-500/40'
                      : 'text-muted-foreground hover:text-cyan-600 dark:hover:text-cyan-300 hover:bg-cyan-950/40'
                  }`}
                >
                  <History className={`w-4 h-4 shrink-0 ${pathname === '/history' ? 'text-foreground' : 'text-cyan-600 dark:text-cyan-400'}`} />
                  <span>History</span>
                </Link>

                {isAdmin && (
                  <Link
                    href="/admin"
                    title="Admin"
                    className={`hidden 2xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-sm font-semibold transition-all duration-200 shrink-0 ${
                      pathname.startsWith('/admin')
                        ? 'bg-amber-600 text-white font-bold shadow-md shadow-amber-600/30 border border-amber-500/40'
                        : 'text-amber-600 dark:text-amber-400 hover:bg-amber-950/40'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span>Admin</span>
                  </Link>
                )}
              </>
            )}
          </nav>

          {/* Auth Button / Morphing Profile Menu */}
          <div 
            ref={menuRef} 
            className={`relative shrink-0 h-9 sm:h-10 flex items-center justify-end z-50 ${
              user ? 'w-[102px] sm:w-[116px]' : 'w-auto'
            }`}
          >
            {user ? (
              <div
                className={`absolute right-0 top-0 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] origin-top-right overflow-hidden rounded-2xl ${
                  showMenu
                    ? 'w-64 sm:w-72 p-2 bg-card/95 glass-panel border border-slate-700 shadow-2xl shadow-primary-950/70 z-50 ring-1 ring-primary-500/20'
                    : 'w-full h-full p-1 bg-card/90 border border-card-border hover:border-slate-700 shadow-md group flex flex-col'
                }`}
              >
                {/* Unified Trigger Button / Header */}
                <button
                  onClick={() => setShowMenu(prev => !prev)}
                  className={`flex items-center justify-between w-full text-left focus:outline-none transition-all duration-300 ${
                    showMenu ? 'p-1.5 pb-2.5' : 'h-full px-1'
                  }`}
                  aria-expanded={showMenu}
                  aria-haspopup="true"
                  title="Account menu"
                >
                  <div className={`flex items-center min-w-0 transition-all duration-300 ${
                    showMenu ? 'gap-2.5' : 'gap-1.5'
                  }`}>
                    <div className={`shrink-0 flex items-center justify-center overflow-hidden rounded-lg transition-all duration-300 ${
                      showMenu ? 'w-10 h-10 sm:w-11 sm:h-11' : 'w-7 h-7 sm:w-8 sm:h-8'
                    }`}>
                      <UserAvatar 
                        name={user.name} 
                        email={user.email} 
                        image={user.image} 
                        size={showMenu ? "md" : "sm"} 
                        isPremium={user.isPremium} 
                      />
                    </div>
                    
                    <div className="flex flex-col min-w-0 justify-center">
                      <div className="flex items-center gap-1">
                        <span className={`font-bold text-foreground group-hover:text-primary-600 dark:group-hover:text-primary-300 transition-colors truncate ${
                          showMenu ? 'text-sm' : 'text-xs max-w-[50px] sm:max-w-[62px]'
                        }`}>
                          {showMenu ? user.name : user.name.split(' ')[0]}
                        </span>
                        {showMenu && user.isPremium && <Crown className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />}
                      </div>
                      
                      {/* Email only shows when expanded */}
                      <div className={`overflow-hidden transition-all duration-300 ${
                        showMenu ? 'max-h-5 opacity-100 mt-0.5' : 'max-h-0 opacity-0'
                      }`}>
                        <span className="text-[11px] text-muted-foreground truncate block">
                          {user.email}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <ChevronDown className={`w-4 h-4 text-muted-foreground group-hover:text-foreground shrink-0 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                    showMenu ? 'rotate-180' : ''
                  }`} />
                </button>

                {/* Smooth Divider */}
                <div 
                  className={`w-full bg-card-border/80 transition-all duration-300 ease-in-out ${
                    showMenu ? 'h-px opacity-100 mb-1.5' : 'h-0 opacity-0 mb-0 pointer-events-none'
                  }`}
                />

                {/* Dropdown Menu Items — inverse of nav bar visibility */}
                <div 
                  className={`space-y-0.5 transition-all duration-300 ease-in-out flex flex-col overflow-hidden ${
                    showMenu ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
                  }`}
                >
                  {/* Courses — visible below lg (nav shows at lg+) */}
                  {hasCourseAccess && (
                    <Link
                      href="/courses"
                      onClick={() => setShowMenu(false)}
                      className="flex lg:hidden w-full items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-foreground/80 hover:text-foreground hover:bg-slate-800/60 transition-all duration-150 group"
                    >
                      <BookOpen className="w-4 h-4 text-primary-600 dark:text-primary-400 group-hover:scale-110 transition-transform" />
                      <span>Courses</span>
                    </Link>
                  )}

                  {/* Pricing — visible below mlg (nav shows at mlg+) */}
                  <Link
                    href="/pricing"
                    onClick={() => setShowMenu(false)}
                    className="flex mlg:hidden w-full items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-foreground/80 hover:text-foreground hover:bg-slate-800/60 transition-all duration-150 group"
                  >
                    <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform" />
                    <span>Pricing</span>
                  </Link>

                  {/* Separator between nav overflow items and account items */}
                  <div className="xl:hidden w-full h-px bg-card-border/50 my-0.5" />

                  {/* Profile — visible below xl; hidden on <md (bottom nav) */}
                  <Link
                    href="/profile"
                    onClick={() => setShowMenu(false)}
                    className="hidden md:flex xl:hidden w-full items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-foreground/80 hover:text-foreground hover:bg-slate-800/60 transition-all duration-150 group"
                  >
                    <UserIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
                    <span>Profile</span>
                  </Link>

                  {/* Bookmarks — visible below mxl */}
                  <Link
                    href="/bookmarks"
                    onClick={() => setShowMenu(false)}
                    className="flex mxl:hidden w-full items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-foreground/80 hover:text-foreground hover:bg-slate-800/60 transition-all duration-150 group"
                  >
                    <Bookmark className="w-4 h-4 text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform" />
                    <span>Bookmarks</span>
                  </Link>

                  {/* History — visible below 2xl */}
                  <Link
                    href="/history"
                    onClick={() => setShowMenu(false)}
                    className="flex 2xl:hidden w-full items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-foreground/80 hover:text-foreground hover:bg-slate-800/60 transition-all duration-150 group"
                  >
                    <History className="w-4 h-4 text-cyan-600 dark:text-cyan-400 group-hover:scale-110 transition-transform" />
                    <span>History</span>
                  </Link>

                  {/* Admin — visible below 2xl */}
                  {isAdmin && (
                    <Link
                      href="/admin"
                      onClick={() => setShowMenu(false)}
                      className="flex 2xl:hidden w-full items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-amber-600 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-all duration-150 group"
                    >
                      <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform" />
                      <span>Admin</span>
                    </Link>
                  )}

                  <div className="w-full h-px bg-card-border/50 my-0.5" />

                  <button
                    onClick={() => {
                      logout();
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-all duration-150 group"
                  >
                    <LogOut className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    <span>Sign Out</span>
                  </button>
                </div>
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
