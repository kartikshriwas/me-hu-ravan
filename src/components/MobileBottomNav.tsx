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
  indicatorColor: string;
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
        activeBg: 'bg-violet-500/15 text-violet-600 dark:text-violet-400 shadow-sm shadow-violet-500/20',
        indicatorColor: 'bg-violet-500',
      }
    : user
    ? {
        label: 'Saved',
        href: '/bookmarks',
        icon: Bookmark,
        active: cleanPath === '/bookmarks',
        accentColor: 'text-rose-600 dark:text-rose-400',
        activeBg: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 shadow-sm shadow-rose-500/20',
        indicatorColor: 'bg-rose-500',
      }
    : {
        label: 'Pricing',
        href: '/pricing',
        icon: Sparkles,
        active: cleanPath === '/pricing',
        accentColor: 'text-amber-600 dark:text-amber-400',
        activeBg: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 shadow-sm shadow-amber-500/20',
        indicatorColor: 'bg-amber-500',
      };

  const navItems: NavItem[] = [
    {
      label: 'Tests',
      href: '/',
      icon: FileCheck2,
      active: cleanPath === '/' || cleanPath.startsWith('/quiz'),
      accentColor: 'text-primary-600 dark:text-primary-400',
      activeBg: 'bg-primary-500/15 text-primary-600 dark:text-primary-400 shadow-sm shadow-primary-500/20',
      indicatorColor: 'bg-primary-600 dark:bg-primary-400',
    },
    {
      label: 'Ranks',
      href: '/leaderboard',
      icon: Trophy,
      active: cleanPath === '/leaderboard',
      accentColor: 'text-amber-600 dark:text-amber-400',
      activeBg: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 shadow-sm shadow-amber-500/20',
      indicatorColor: 'bg-amber-500',
    },
    thirdTab,
    {
      label: 'Profile',
      href: '/profile',
      icon: UserIcon,
      active: cleanPath === '/profile' || cleanPath === '/history' || cleanPath.startsWith('/admin'),
      accentColor: 'text-emerald-600 dark:text-emerald-400',
      activeBg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shadow-sm shadow-emerald-500/20',
      indicatorColor: 'bg-emerald-500',
      isProfile: true,
    },
  ];

  return (
    <nav
      aria-label="Mobile Bottom Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/95 glass-panel border-t border-card-border/80 shadow-[0_-4px_25px_rgba(0,0,0,0.15)] pb-[env(safe-area-inset-bottom,0px)]"
    >
      <div className="flex items-center justify-around h-15 px-2 max-w-lg mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.active;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-col items-center justify-center flex-1 py-1 px-1 transition-all duration-200 active:scale-95 touch-manipulation select-none ${
                isActive ? `${item.accentColor} font-bold` : 'text-muted-foreground hover:text-foreground font-medium'
              }`}
            >
              {/* Active Tab Top Glow Bar */}
              {isActive && (
                <span
                  className={`absolute -top-1 w-10 h-0.5 rounded-full ${item.indicatorColor} shadow-md`}
                />
              )}

              {/* Icon Container */}
              <div
                className={`relative flex items-center justify-center w-10 h-8 rounded-xl transition-all duration-200 ${
                  isActive ? item.activeBg : 'bg-transparent'
                }`}
              >
                {item.isProfile && user ? (
                  <div className="flex items-center justify-center">
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
                  <Icon className="w-4.5 h-4.5" />
                )}
              </div>

              {/* Label */}
              <span className="text-[10.5px] leading-tight tracking-tight mt-0.5">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
