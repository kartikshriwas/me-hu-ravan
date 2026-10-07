export function getQuizTypeBadgeClass(type?: string): string {
  switch (type) {
    case 'Quantitative Aptitude':
      return 'bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-500/30';
    case 'Logical Reasoning':
      return 'bg-purple-500/15 text-purple-600 dark:text-purple-300 border-purple-500/30';
    case 'Verbal Ability':
      return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30';
    case 'Data Interpretation':
      return 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30';
    case 'TCS Ninja':
      return 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/30';
    case 'TCS Digital':
      return 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 border-cyan-500/30';
    default:
      return 'bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/30';
  }
}
