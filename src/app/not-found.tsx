'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Compass,
  ArrowLeft,
  Home,
  FileCheck2,
  Trophy,
  User as UserIcon,
  Search,
  Sparkles,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

export default function NotFound() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/?search=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      router.push('/');
    }
  };

  const quickLinks = [
    {
      title: 'Practice Tests',
      desc: 'Quantitative, logical & technical aptitude',
      href: '/',
      icon: FileCheck2,
      accent: 'text-primary-500 bg-primary-500/10 border-primary-500/20 group-hover:border-primary-500/50',
    },
    {
      title: 'Leaderboard',
      desc: 'See top ranks, percentile & candidates',
      href: '/leaderboard',
      icon: Trophy,
      accent: 'text-amber-500 bg-amber-500/10 border-amber-500/20 group-hover:border-amber-500/50',
    },
    {
      title: 'My Profile',
      desc: 'Check test history, scores & telemetry',
      href: '/profile',
      icon: UserIcon,
      accent: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20 group-hover:border-emerald-500/50',
    },
  ];

  return (
    <div className="relative flex-1 w-full min-h-[calc(100vh-8rem)] flex items-center justify-center p-4 sm:p-6 lg:p-8 overflow-hidden select-none">
      {/* Dynamic Ambient Glow Backdrops */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[34rem] h-[34rem] bg-primary-600/15 rounded-full blur-[130px] pointer-events-none -z-10" />
      <div className="absolute bottom-10 left-10 w-72 h-72 bg-violet-600/10 rounded-full blur-[110px] pointer-events-none -z-10" />
      <div className="absolute top-12 right-10 w-72 h-72 bg-cyan-600/10 rounded-full blur-[110px] pointer-events-none -z-10" />

      <main className="w-full max-w-2xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in zoom-in-95 duration-300">
        
        {/* Main 404 Glass Card */}
        <div className="glass-panel rounded-3xl p-6 sm:p-10 md:p-12 border border-card-border/80 shadow-2xl backdrop-blur-2xl text-center relative overflow-hidden space-y-6">
          
          {/* Subtle top edge specular highlight */}
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

          {/* Glowing 404 Hero Number */}
          <div className="relative inline-flex flex-col items-center justify-center pt-2">
            <div className="relative">
              <span className="text-8xl sm:text-9xl md:text-[10rem] font-black tracking-tighter leading-none bg-gradient-to-b from-foreground via-foreground/70 to-foreground/20 bg-clip-text text-transparent drop-shadow-2xl font-mono">
                404
              </span>
              <div className="absolute -top-3 -right-3 sm:-top-4 sm:-right-4 w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-primary-500/15 border border-primary-500/30 flex items-center justify-center text-primary-400 shadow-lg shadow-primary-500/20 animate-bounce duration-1000">
                <Compass className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
            </div>

            {/* Error Pill */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 dark:bg-slate-950/80 border border-card-border shadow-inner text-[11px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              <span className="text-foreground">Page Not Found</span>
              <span className="text-slate-600">•</span>
              <span>404 Error</span>
            </div>
          </div>

          {/* Heading & Explanation */}
          <div className="space-y-2 max-w-lg mx-auto">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-foreground tracking-tight">
              Looks like you took a wrong turn
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              The page you are looking for doesn&apos;t exist, has been removed.
            </p>
          </div>

          {/* Quick Search */}
          <form onSubmit={handleSearchSubmit} className="max-w-md mx-auto relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tests or topics (e.g. TCS, Aptitude)..."
              className="w-full pl-10 pr-24 py-2.5 rounded-2xl bg-card/90 border border-card-border text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all shadow-inner"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-bold text-xs transition-colors shadow-sm"
            >
              Search
            </button>
          </form>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={() => router.back()}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-card hover:bg-card-border/60 text-foreground font-semibold text-xs sm:text-sm border border-card-border transition-all active:scale-95 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Go Back</span>
            </button>

            <Link
              href="/"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-2xl bg-primary-600 hover:bg-primary-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-primary-600/30 transition-all hover:scale-105 active:scale-95"
            >
              <Home className="w-4 h-4" />
              <span>Back to Home</span>
            </Link>
          </div>
        </div>

        {/* Quick Destinations Grid */}
        <section aria-label="Popular Destinations" className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary-500" />
              <span>Popular Destinations</span>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {quickLinks.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.title}
                  href={item.href}
                  className="group p-4 rounded-2xl glass-card border border-card-border/80 hover:border-primary-500/40 bg-card/70 hover:bg-card transition-all flex flex-col justify-between space-y-2 shadow-sm hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${item.accent} transition-transform group-hover:scale-110`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary-500 group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-foreground group-hover:text-primary-500 transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                      {item.desc}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

      </main>
    </div>
  );
}
