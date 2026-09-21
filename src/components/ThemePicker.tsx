'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';
import { useAccentTheme } from './ThemeProvider';
import { Moon, Sun, Check, Palette } from 'lucide-react';

const ACCENT_THEMES = [
  { name: 'purple', label: 'Purple', color: '#9333ea' },
  { name: 'blue', label: 'Blue', color: '#2563eb' },
  { name: 'red', label: 'Red', color: '#dc2626' },
  { name: 'green', label: 'Green', color: '#16a34a' },
  { name: 'orange', label: 'Orange', color: '#ea580c' },
  { name: 'black', label: 'Slate', color: '#475569' },
];

export function ThemePicker() {
  const { theme, setTheme, systemTheme } = useTheme();
  const { accentTheme, customHex, setAccentTheme } = useAccentTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const currentTheme = theme === 'system' ? systemTheme : theme;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Color Mode</h3>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setTheme('light')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${
              theme === 'light'
                ? 'bg-primary-600/10 border-primary-500 text-primary-600'
                : 'bg-card border-card-border text-foreground hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <Sun className="w-4 h-4" />
            <span className="text-sm font-medium">Light</span>
          </button>
          <button
            onClick={() => setTheme('dark')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${
              theme === 'dark'
                ? 'bg-primary-600/10 border-primary-500 text-primary-600 dark:text-primary-400'
                : 'bg-card border-card-border text-foreground hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <Moon className="w-4 h-4" />
            <span className="text-sm font-medium">Dark</span>
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Accent Color</h3>
        <div className="flex flex-wrap items-center gap-3">
          {ACCENT_THEMES.map((t) => (
            <button
              key={t.name}
              onClick={() => setAccentTheme(t.name)}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-transform hover:scale-110 active:scale-95 ${
                accentTheme === t.name ? 'ring-2 ring-offset-2 ring-offset-background ring-primary-500 scale-110' : 'ring-1 ring-white/10'
              }`}
              style={{ backgroundColor: t.color }}
              title={t.label}
              aria-label={`Select ${t.label} theme`}
            >
              {accentTheme === t.name && <Check className="w-5 h-5 text-foreground" />}
            </button>
          ))}
          
          <div className="relative group flex items-center justify-center">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-transform hover:scale-110 active:scale-95 overflow-hidden ${
                accentTheme === 'custom' ? 'ring-2 ring-offset-2 ring-offset-background ring-primary-500 scale-110' : 'ring-1 ring-card-border bg-card'
              }`}
              style={accentTheme === 'custom' ? { backgroundColor: customHex } : {}}
              title="Custom Color"
            >
              {accentTheme === 'custom' ? (
                <Check className="w-5 h-5 text-foreground drop-shadow-md" />
              ) : (
                <Palette className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
              )}
            </div>
            <input
              type="color"
              value={customHex}
              onChange={(e) => setAccentTheme('custom', e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              title="Choose Custom Color"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
