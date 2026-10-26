'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  Sparkles, 
  Check, 
  Zap, 
  BookOpen, 
  Code, 
  Brain, 
  Cpu, 
  Layers, 
  CheckCircle2, 
  Crown,
  ArrowRight,
  Bot,
  Terminal,
  Send,
  ShieldCheck,
  GraduationCap,
  Briefcase,
  Users,
  Rocket
} from 'lucide-react';

// Removed exported metadata since this is a client component

export default function PricingPage() {
  const [isEmi, setIsEmi] = useState(false);
  const TELEGRAM_URL = "https://t.me/KartikShriwas";

  return (
    <div className="min-h-screen py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-12">
      
      {/* Header Banner */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-600 dark:text-primary-400 text-xs sm:text-sm font-bold tracking-wide">
          <Sparkles className="w-4 h-4 animate-pulse" />
          <span>95% Off Special Launch Sale</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-foreground tracking-tight leading-tight">
          Invest in Your Career with <span className="text-primary-600 dark:text-primary-400">Industry-Grade Batches</span>
        </h1>
        <p className="text-muted-foreground text-base sm:text-lg">
          Master AI & ML, Full-Stack MERN Web Development, or Data Structures & Algorithms. Pay one-time or split into <strong className="text-foreground">Easy EMI Installments</strong>.
        </p>

        {/* Interactive Segmented Toggle Switch */}
        <div className="flex justify-center items-center mt-8 pt-2">
          <div className="inline-flex items-center p-1.5 rounded-2xl bg-card/90 border border-card-border shadow-2xl backdrop-blur-xl relative gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setIsEmi(false)}
              className={`relative px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all duration-300 flex items-center gap-2 ${
                !isEmi
                  ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/30 scale-[1.02]'
                  : 'text-muted-foreground hover:text-foreground hover:bg-card/60'
              }`}
            >
              <Zap className={`w-4 h-4 ${!isEmi ? 'text-amber-300 animate-pulse' : ''}`} />
              <span>Full Batch Pass</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider transition-colors ${
                !isEmi 
                  ? 'bg-white/20 text-white border border-white/30' 
                  : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
              }`}>
                Save Most
              </span>
            </button>

            <button
              type="button"
              onClick={() => setIsEmi(true)}
              className={`relative px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all duration-300 flex items-center gap-2 ${
                isEmi
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30 scale-[1.02]'
                  : 'text-muted-foreground hover:text-foreground hover:bg-card/60'
              }`}
            >
              <Sparkles className={`w-4 h-4 ${isEmi ? 'text-emerald-200 animate-pulse' : ''}`} />
              <span>EMI Option</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider transition-colors ${
                isEmi 
                  ? 'bg-white/20 text-white border border-white/30' 
                  : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
              }`}>
                2-3 Months
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* ALL-ACCESS BUNDLE BANNER (HERO DEAL) */}
      <div className="relative overflow-hidden rounded-3xl border-2 border-primary-500/40 bg-card p-6 sm:p-10 shadow-2xl shadow-primary-500/10 backdrop-blur-xl">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-primary-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="space-y-4 max-w-2xl text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-600 dark:text-amber-300 text-xs font-bold uppercase tracking-wider">
              <Crown className="w-4 h-4" /> Ultimate Mega Offer
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-foreground">
              ALL-ACCESS BATCHES PASS
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base">
              Get complete access to <strong className="text-foreground">Quiz Access + Prime 3.0 (AI/ML) + Delta 9.0 (Web Dev) + Alpha Plus 8.0 (DSA Java & C++) + Sigma & Sigmax</strong> all included in one single pass!
            </p>
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 text-xs font-semibold text-foreground/80">
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Full AI & ML Stack</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> MERN + WebRTC + AWS</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Complete DSA (Java + C++)</span>
            </div>
          </div>

          <div className="flex flex-col items-center bg-card/80 border border-card-border p-6 rounded-2xl shadow-xl shrink-0 w-full sm:w-auto text-center space-y-4">
            <div className="space-y-1">
              <div className="flex items-baseline justify-center gap-2">
                <span className="text-4xl sm:text-5xl font-black text-primary-600 dark:text-primary-400">₹ {isEmi ? '239' : '599'}</span>
                {!isEmi ? (
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                    95% OFF
                  </span>
                ) : (
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                    3-Month EMI
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground font-medium">
                {isEmi ? '3 monthly installments of ₹239 (₹239 × 3 mo)' : 'Full Batch Pass • Complete Access'}
              </p>
            </div>

            <a 
              href={TELEGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-64 py-3 px-6 rounded-xl font-bold bg-primary-600 hover:bg-primary-500 text-white shadow-lg shadow-primary-600/30 transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span>Enroll All Batches Now</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>

      {/* INDIVIDUAL BATCH PRICING CARDS */}
      <div className="space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Explore Individual Batches</h2>
          <p className="text-muted-foreground text-sm">Choose the specific track tailored to your career goal</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

          {/* CARD 1: QUIZ ONLY */}
          <div className="rounded-2xl border border-card-border bg-card p-6 flex flex-col justify-between space-y-6 hover:border-primary-500/40 transition-all">
            <div className="space-y-4">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground">Quiz Practice Only</h3>
                <p className="text-xs text-muted-foreground mt-1">Unlimited Mock Tests & Instant Evaluation</p>
              </div>
              <div className="pt-2 border-t border-card-border/60">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-foreground">₹ 9</span>
                  <span className="text-xs text-muted-foreground">/ month</span>
                </div>
              </div>
              <ul className="space-y-2.5 text-xs text-foreground/80 pt-2">
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-cyan-500 shrink-0" /> Access to all core quizzes & mock tests</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-cyan-500 shrink-0" /> Real-time leaderboard ranking</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-cyan-500 shrink-0" /> Detailed performance stats & history</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-cyan-500 shrink-0" /> Save & bookmark questions</li>
              </ul>
            </div>
            <a 
              href={TELEGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 rounded-xl font-semibold border border-card-border hover:bg-slate-800/50 text-foreground transition-all flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4 text-cyan-500" />
              <span>Get Quiz Access</span>
            </a>
          </div>

          {/* CARD 2: PRIME 3.0 (AI & ML) */}
          <div className="relative rounded-2xl border-2 border-primary-500/50 bg-card p-6 flex flex-col justify-between space-y-6 shadow-xl shadow-primary-500/5 hover:border-primary-500 transition-all">
            <div className="absolute top-3 right-3 px-2.5 py-0.5 rounded-full bg-primary-500/20 text-primary-600 dark:text-primary-300 text-[10px] font-bold uppercase tracking-wider border border-primary-500/30">
              Popular AI Track
            </div>
            <div className="space-y-4">
              <div className="w-10 h-10 rounded-xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center text-primary-600 dark:text-primary-400">
                <Brain className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground">Prime 3.0: AI & ML</h3>
                <p className="text-xs text-muted-foreground mt-1">Complete AI & ML Job Preparation in 4.5+ Months</p>
              </div>
              <div className="pt-2 border-t border-card-border/60">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-foreground">₹ {isEmi ? '199' : '349'}</span>
                  {isEmi ? (
                    <>
                      <span className="text-xs text-muted-foreground">/ month</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                        2-Month EMI
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-xs text-muted-foreground line-through">₹ 6860</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">95% OFF</span>
                    </>
                  )}
                </div>
              </div>
              <ul className="space-y-2.5 text-xs text-foreground/80 pt-2">
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-primary-500 shrink-0" /> Python, Data Science, Pandas, PyTorch</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-primary-500 shrink-0" /> ML Algorithms, Deep Learning, Transformers</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-primary-500 shrink-0" /> GenAI, LLMs, RAG, Agentic AI, LangChain</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-primary-500 shrink-0" /> Flask, Docker, Kubernetes, AWS AI Stack</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-primary-500 shrink-0" /> Industry Grade AI Projects</li>
              </ul>
            </div>
            <a 
              href={TELEGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 rounded-xl font-bold bg-primary-600 hover:bg-primary-500 text-white shadow-md shadow-primary-600/30 transition-all flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span>Enroll in Prime 3.0</span>
            </a>
          </div>

          {/* CARD 3: DELTA 9.0 (WEB DEV) */}
          <div className="rounded-2xl border border-card-border bg-card p-6 flex flex-col justify-between space-y-6 hover:border-emerald-500/40 transition-all">
            <div className="space-y-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Code className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground">Delta 9.0: Web Dev</h3>
                <p className="text-xs text-muted-foreground mt-1">Full Stack MERN Web Development (4.5 Months)</p>
              </div>
              <div className="pt-2 border-t border-card-border/60">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-foreground">₹ {isEmi ? '179' : '319'}</span>
                  {isEmi ? (
                    <>
                      <span className="text-xs text-muted-foreground">/ month</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                        2-Month EMI
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-xs text-muted-foreground line-through">₹ 6250</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">95% OFF</span>
                    </>
                  )}
                </div>
              </div>
              <ul className="space-y-2.5 text-xs text-foreground/80 pt-2">
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0" /> Frontend: HTML, CSS, JS, React, Tailwind</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0" /> Backend: Node, Express, MongoDB, SQL</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0" /> Docker, Kubernetes, WebRTC, AWS</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0" /> Airbnb, Zerodha, Zoom & ChatGPT Projects</li>
              </ul>
            </div>
            <a 
              href={TELEGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 rounded-xl font-semibold border border-card-border hover:bg-slate-800/50 text-foreground transition-all flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4 text-emerald-500" />
              <span>Enroll in Delta 9.0</span>
            </a>
          </div>

          {/* CARD 4: ALPHA PLUS 8.0 (DSA JAVA / C++) */}
          <div className="rounded-2xl border border-card-border bg-card p-6 flex flex-col justify-between space-y-6 hover:border-amber-500/40 transition-all">
            <div className="space-y-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground">Alpha Plus 8.0 (DSA)</h3>
                <p className="text-xs text-muted-foreground mt-1">Complete DSA in Java or C++ (4 Months)</p>
              </div>
              <div className="pt-2 border-t border-card-border/60">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-foreground">₹ {isEmi ? '189' : '339'}</span>
                  {isEmi ? (
                    <>
                      <span className="text-xs text-muted-foreground">/ month</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                        2-Month EMI
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-xs text-muted-foreground line-through">₹ 6750</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">95% OFF</span>
                    </>
                  )}
                </div>
              </div>
              <ul className="space-y-2.5 text-xs text-foreground/80 pt-2">
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-amber-500 shrink-0" /> Java / C++ Foundation to Advanced</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-amber-500 shrink-0" /> Trees, Graphs, DP, Segment Trees</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-amber-500 shrink-0" /> 50 Live Practice Sessions with MAANG Engineers</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-amber-500 shrink-0" /> Quant, Reasoning & Aptitude Prep</li>
              </ul>
            </div>
            <a 
              href={TELEGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 rounded-xl font-semibold border border-card-border hover:bg-slate-800/50 text-foreground transition-all flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4 text-amber-500" />
              <span>Enroll in Alpha Plus 8.0</span>
            </a>
          </div>

          {/* CARD 5: SIGMA / SIGMAX */}
          <div className="rounded-2xl border border-card-border bg-card p-6 flex flex-col justify-between space-y-6 hover:border-purple-500/40 transition-all lg:col-span-2">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400">
                  <Layers className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-purple-400 px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/20">
                  Development + DSA Combo
                </span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground">SIGMA & SIGMAX</h3>
                <p className="text-xs text-muted-foreground mt-1">Complete Web Development + Advanced DSA + Placement Aptitude (8.5 Months)</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-card-border/60">
                <div>
                  <span className="text-xs text-muted-foreground font-semibold">SIGMA Standard</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-extrabold text-foreground">₹ {isEmi ? '179' : '449'}</span>
                    {isEmi ? (
                      <>
                        <span className="text-xs text-muted-foreground">/ month</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                          3-Month EMI
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-xs text-muted-foreground line-through">₹ 8999</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">95% OFF</span>
                      </>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground font-semibold">SIGMAX Pro Edition</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-extrabold text-purple-600 dark:text-purple-400">₹ {isEmi ? '199' : '499'}</span>
                    {isEmi ? (
                      <>
                        <span className="text-xs text-muted-foreground">/ month</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                          3-Month EMI
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-xs text-muted-foreground line-through">₹ 9650</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">95% OFF</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-foreground/80 pt-2">
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-purple-500 shrink-0" /> Everything included in Delta Web Dev</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-purple-500 shrink-0" /> Complete DSA in Java or C++</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-purple-500 shrink-0" /> 50 Live Practice Sessions (MAANG Engineers)</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-purple-500 shrink-0" /> FAANG Round Video Solutions Library</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-purple-500 shrink-0" /> 1:1 Live Resume Review with Mentors</li>
              </ul>
            </div>
            <a 
              href={TELEGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 rounded-xl font-semibold border border-card-border hover:bg-slate-800/50 text-foreground transition-all flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4 text-purple-500" />
              <span>Enroll in SIGMA / SIGMAX</span>
            </a>
          </div>

        </div>
      </div>
    </div>
  );
}
