export function getQuizTypeBadgeClass(type?: string): string {
  switch (type) {
    case 'Quantitative Aptitude':
      return 'bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300 border-blue-500/30';
    case 'Logical Reasoning':
      return 'bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-300 border-purple-500/30';
    case 'Verbal Ability':
      return 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border-emerald-500/30';
    case 'Data Interpretation':
      return 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-300 border-amber-500/30';
    case 'TCS Ninja':
      return 'bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-300 border-rose-500/30';
    case 'TCS Digital':
      return 'bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 border-cyan-500/30';
    default:
      return 'bg-slate-500/10 dark:bg-slate-500/20 text-slate-600 dark:text-slate-300 border-slate-500/30';
  }
}

export function getQuizTypeDotClass(type?: string): string {
  switch (type) {
    case 'Quantitative Aptitude':
      return 'bg-blue-500 dark:bg-blue-400';
    case 'Logical Reasoning':
      return 'bg-purple-500 dark:bg-purple-400';
    case 'Verbal Ability':
      return 'bg-emerald-500 dark:bg-emerald-400';
    case 'Data Interpretation':
      return 'bg-amber-500 dark:bg-amber-400';
    case 'TCS Ninja':
      return 'bg-rose-500 dark:bg-rose-400';
    case 'TCS Digital':
      return 'bg-cyan-500 dark:bg-cyan-400';
    default:
      return 'bg-slate-500 dark:bg-slate-400';
  }
}

export function getQuizTypeActivePillClass(type: string): string {
  switch (type) {
    case 'Quantitative Aptitude':
      return 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/30';
    case 'Logical Reasoning':
      return 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/30';
    case 'Verbal Ability':
      return 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-600/30';
    case 'Data Interpretation':
      return 'bg-amber-600 text-white border-amber-500 shadow-md shadow-amber-600/30';
    case 'TCS Ninja':
      return 'bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-600/30';
    case 'TCS Digital':
      return 'bg-cyan-600 text-white border-cyan-500 shadow-md shadow-cyan-600/30';
    default:
      return 'bg-primary-600 text-white border-primary-500 shadow-md shadow-primary-600/30';
  }
}
