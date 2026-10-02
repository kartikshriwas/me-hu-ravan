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
        accentColor: 'text-violet-400',
        activeBg: 'bg-violet-400/15',
        activeBorder: 'border-violet-400/30',
      }
    : user
    ? {
        label: 'Saved',
        href: '/bookmarks',
        icon: Bookmark,
        active: cleanPath === '/bookmarks',
        accentColor: 'text-rose-400',
        activeBg: 'bg-rose-400/15',
        activeBorder: 'border-rose-400/30',
      }
    : {
        label: 'Pricing',
        href: '/pricing',
        icon: Sparkles,
        active: cleanPath === '/pricing',
        accentColor: 'text-amber-400',
        activeBg: 'bg-amber-400/15',
        activeBorder: 'border-amber-400/30',
      };

  const navItems: NavItem[] = [
    {
      label: 'Tests',
      href: '/',
      icon: FileCheck2,
      active: cleanPath === '/' || cleanPath.startsWith('/quiz'),
      accentColor: 'text-primary-400',
      activeBg: 'bg-primary-400/15',
      activeBorder: 'border-primary-400/30',
    },
    {
      label: 'Ranks',
      href: '/leaderboard',
      icon: Trophy,
      active: cleanPath === '/leaderboard',
      accentColor: 'text-amber-400',
      activeBg: 'bg-amber-400/15',
      activeBorder: 'border-amber-400/30',
    },
    thirdTab,
    {
      label: 'Profile',
      href: '/profile',
      icon: UserIcon,
      active: cleanPath === '/profile' || cleanPath === '/history' || cleanPath.startsWith('/admin'),
      accentColor: 'text-emerald-400',
      activeBg: 'bg-emerald-400/15',
      activeBorder: 'border-emerald-400/30',
      isProfile: true,
    },
  ];

  return (
    <nav
      aria-label="Mobile Bottom Navigation"
      className="md:hidden fixed bottom-[calc(0.625rem+env(safe-area-inset-bottom,0px))] inset-x-3 sm:inset-x-6 z-40 max-w-sm sm:max-w-md mx-auto"
    >
      {/* Floating Glass Dock — always dark frosted glass across all themes */}
      <div className="relative flex items-center justify-between p-1.5 rounded-[26px] bg-[#0f172a]/90 border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl overflow-hidden">

        {/* Subtle Top Glass Reflection Line */}
        <div className="absolute top-0 inset-x-6 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.active;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={`relative flex flex-col items-center justify-center flex-1 py-1.5 px-2 rounded-[20px] transition-all duration-200 active:scale-95 touch-manipulation select-none ${
                  isActive
                    ? `${item.activeBg} ${item.accentColor} ${item.activeBorder} border font-bold shadow-xs`
                    : 'text-slate-400 hover:text-white font-semibold hover:bg-white/[0.08] border border-transparent'
                }`}
              >
                {/* Icon / Avatar */}
                <div className="relative flex items-center justify-center">
                  {item.isProfile && user ? (
                    <div className={`p-0.5 rounded-full transition-all duration-200 ${isActive ? 'scale-105 ring-2 ring-emerald-500/60 shadow-xs' : ''}`}>
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
                    <Icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? 'scale-110' : ''}`} />
                  )}
                </div>

                {/* Label */}
                <span className="text-[10.5px] font-semibold tracking-tight mt-1 leading-none">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    );
}



