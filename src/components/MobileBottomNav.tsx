'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { UserAvatar } from '@/components/UserAvatar';
import { FileCheck2, Trophy, BookOpen, User as UserIcon, Bookmark, Sparkles } from 'lucide-react';
import { isCourseBatch } from '@/lib/batchAccess';

interface NavItem {
  label: string;
  href: string;
  icon: any;
  active: boolean;
  accentColor: string;
  activeBg: string;
  activeBorder: string;
  isProfile?: boolean;
}

export function MobileBottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();

  // 1. Hide on active quiz taking screen
  if (pathname.startsWith('/quiz/') && !pathname.includes('/results')) {
    return null;
  }

  // 2. Hide on dedicated full-screen video player page
  if (pathname.includes('/video/')) {
    return null;
  }

  const isAdmin = user?.role === 'superadmin' || user?.role === 'admin';
  const courseBatches = (user?.allowedBatches || []).filter(isCourseBatch);
  const hasCourseAccess = isAdmin || courseBatches.length > 0 || user?.adminPermissions?.includes('access_courses') || user?.adminPermissions?.includes('*');

  const cleanPath = pathname.split('?')[0].replace(/\/$/, '') || '/';

  // 3rd Tab is Courses ONLY if user has course access; otherwise show Saved (if signed in) or Pricing (if guest)
  const thirdTab: NavItem = hasCourseAccess
    ? {
        label: 'Courses',
        href: '/courses',
        icon: BookOpen,
        active: cleanPath.startsWith('/courses'),
        accentColor: 'text-violet-600 dark:text-violet-400',
        activeBg: 'bg-violet-500/15 dark:bg-violet-400/15',
        activeBorder: 'border-violet-500/30',
      }
    : user
    ? {
        label: 'Saved',
        href: '/bookmarks',
        icon: Bookmark,
        active: cleanPath === '/bookmarks',
        accentColor: 'text-rose-600 dark:text-rose-400',
        activeBg: 'bg-rose-500/15 dark:bg-rose-400/15',
        activeBorder: 'border-rose-500/30',
      }
    : {
        label: 'Pricing',
        href: '/pricing',
        icon: Sparkles,
        active: cleanPath === '/pricing',
        accentColor: 'text-amber-600 dark:text-amber-400',
        activeBg: 'bg-amber-500/15 dark:bg-amber-400/15',
        activeBorder: 'border-amber-500/30',
      };

  const navItems: NavItem[] = [
    {
      label: 'Tests',
      href: '/',
      icon: FileCheck2,
      active: cleanPath === '/' || cleanPath.startsWith('/quiz'),
      accentColor: 'text-primary-600 dark:text-primary-400',
      activeBg: 'bg-primary-500/15 dark:bg-primary-400/15',
      activeBorder: 'border-primary-500/30',
    },
    {
      label: 'Ranks',
      href: '/leaderboard',
      icon: Trophy,
      active: cleanPath === '/leaderboard',
      accentColor: 'text-amber-600 dark:text-amber-400',
      activeBg: 'bg-amber-500/15 dark:bg-amber-400/15',
      activeBorder: 'border-amber-500/30',
    },
    thirdTab,
    {
      label: 'Profile',
      href: '/profile',
      icon: UserIcon,
      active: cleanPath === '/profile' || cleanPath === '/history' || cleanPath.startsWith('/admin'),
      accentColor: 'text-emerald-600 dark:text-emerald-400',
      activeBg: 'bg-emerald-500/15 dark:bg-emerald-400/15',
      activeBorder: 'border-emerald-500/30',
      isProfile: true,
    },
  ];

  return (
    <nav
      aria-label="Mobile Bottom Navigation"
      className="md:hidden fixed bottom-2.5 inset-x-3 sm:inset-x-6 z-40 max-w-md mx-auto"
    >
      {/* Floating Glass Dock */}
      <div className="relative flex items-center justify-between p-1.5 rounded-2xl bg-card/90 dark:bg-slate-900/90 glass-panel border border-card-border/90 shadow-[0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-2xl">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.active;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-col items-center justify-center flex-1 py-1.5 px-2 rounded-xl transition-all duration-200 active:scale-90 touch-manipulation select-none ${
                isActive
                  ? `${item.activeBg} ${item.accentColor} ${item.activeBorder} border font-bold shadow-sm`
                  : 'text-muted-foreground hover:text-foreground font-semibold hover:bg-card-border/30 border border-transparent'
              }`}
            >
              {/* Icon / Avatar */}
              <div className="relative flex items-center justify-center">
                {item.isProfile && user ? (
                  <div className={`p-0.5 rounded-full transition-transform duration-200 ${isActive ? 'scale-110 ring-2 ring-emerald-500/50' : ''}`}>
                    <UserAvatar
                      name={user.name}
                      email={user.email}
                      image={user.image}
                      size="xs"
                      isPremium={user.isPremium}
                      className="!w-5 !h-5 !rounded-full"
                    />
                  </div>
                ) : (
                  <Icon className={`w-4.5 h-4.5 transition-transform duration-200 ${isActive ? 'scale-110' : ''}`} />
                )}
              </div>

              {/* Label */}
              <span className="text-[10px] tracking-tight mt-0.5 leading-none">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

