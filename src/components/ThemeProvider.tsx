'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { generateColorScale } from '@/lib/colorUtils';

export const AccentThemeContext = React.createContext<{
  accentTheme: string;
  customHex: string;
  setAccentTheme: (theme: string, hex?: string) => void;
}>({
  accentTheme: 'purple',
  customHex: '#9333ea',
  setAccentTheme: () => null,
});

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  const [accentTheme, setAccentThemeState] = React.useState('purple');
  const [customHex, setCustomHexState] = React.useState('#9333ea');
  const [mounted, setMounted] = React.useState(false);

  const applyCustomScale = (hex: string) => {
    try {
      const scale = generateColorScale(hex);
      const root = document.documentElement;
      Object.entries(scale).forEach(([shade, colorValue]) => {
        root.style.setProperty(`--color-primary-${shade}`, colorValue as string);
      });
      // Optionally tint backgrounds in custom mode
      root.style.setProperty('--background', '#0a0a0a'); // keep it dark for now
      root.style.setProperty('--color-slate-950', '#0a0a0a');
      root.style.setProperty('--color-slate-900', '#121212');
      root.style.setProperty('--color-slate-800', '#1a1a1a');
      root.style.setProperty('--card-bg', '#121212');
      root.style.setProperty('--card-border', '#1a1a1a');
      root.style.setProperty('--glass-panel-bg', 'rgba(18, 18, 18, 0.75)');
      root.style.setProperty('--glass-card-bg', 'rgba(18, 18, 18, 0.5)');
    } catch (e) {
      console.error(e);
    }
  };

  const removeCustomScale = () => {
    const root = document.documentElement;
    const shades = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];
    shades.forEach(shade => root.style.removeProperty(`--color-primary-${shade}`));
    root.style.removeProperty('--background');
    root.style.removeProperty('--color-slate-950');
    root.style.removeProperty('--color-slate-900');
    root.style.removeProperty('--color-slate-800');
    root.style.removeProperty('--card-bg');
    root.style.removeProperty('--card-border');
    root.style.removeProperty('--glass-panel-bg');
    root.style.removeProperty('--glass-card-bg');
  };

  React.useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem('preptea_accent_theme') || 'purple';
    const storedHex = localStorage.getItem('preptea_custom_hex') || '#9333ea';
    setAccentThemeState(stored);
    setCustomHexState(storedHex);
    document.documentElement.setAttribute('data-accent', stored);
    
    if (stored === 'custom') {
      applyCustomScale(storedHex);
    }
  }, []);

  const setAccentTheme = (theme: string, hex?: string) => {
    setAccentThemeState(theme);
    
    if (theme === 'default') {
      localStorage.removeItem('preptea_accent_theme');
      document.documentElement.removeAttribute('data-accent');
      removeCustomScale();
      return;
    }

    localStorage.setItem('preptea_accent_theme', theme);
    document.documentElement.setAttribute('data-accent', theme);
    
    if (theme === 'custom' && hex) {
      setCustomHexState(hex);
      localStorage.setItem('preptea_custom_hex', hex);
      applyCustomScale(hex);
    } else {
      removeCustomScale();
    }
  };

  return (
    <NextThemesProvider {...props}>
      <AccentThemeContext.Provider value={{ 
        accentTheme: mounted ? accentTheme : 'purple', 
        customHex: mounted ? customHex : '#9333ea',
        setAccentTheme 
      }}>
        {children}
      </AccentThemeContext.Provider>
    </NextThemesProvider>
  );
}

export function useAccentTheme() {
  const context = React.useContext(AccentThemeContext);
  if (!context) {
    throw new Error('useAccentTheme must be used within an AccentThemeContext.Provider');
  }
  return context;
}
