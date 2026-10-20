'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { generateColorScale, hexToHsl, hslToHex } from '@/lib/colorUtils';

// Suppress the React 19 false-positive warning for next-themes SSR inline script
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('Encountered a script tag while rendering React component')) {
      return;
    }
    originalError.apply(console, args);
  };
}

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

      // Calculate dynamic tinted backgrounds based on custom hex
      const baseHsl = hexToHsl(hex);
      const bgHue = baseHsl.h;
      const bgSat = Math.min(baseHsl.s, 40); // Cap saturation for subtle backgrounds

      // Light Mode Tints
      const lightBg = hslToHex(bgHue, Math.min(bgSat, 60), 98);
      
      // Dark Mode Tints
      const darkBg = hslToHex(bgHue, bgSat, 5);
      const darkSlate950 = hslToHex(bgHue, bgSat, 7);
      const darkSlate900 = hslToHex(bgHue, bgSat, 11);
      const darkSlate800 = hslToHex(bgHue, bgSat, 16);
      
      // Extract RGB for rgba() variables
      const hexToRgbVals = (h: string) => {
        const r = parseInt(h.slice(1, 3), 16);
        const g = parseInt(h.slice(3, 5), 16);
        const b = parseInt(h.slice(5, 7), 16);
        return `${r}, ${g}, ${b}`;
      };
      
      const panelRgb = hexToRgbVals(darkSlate950);
      const cardRgb = hexToRgbVals(darkSlate900);

      // Inject or update a dynamic <style> tag
      let styleEl = document.getElementById('preptea-custom-theme-styles');
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'preptea-custom-theme-styles';
        document.head.appendChild(styleEl);
      }
      
      styleEl.innerHTML = `
        :root[data-accent="custom"] {
          --background: ${lightBg};
        }
        .dark[data-accent="custom"] {
          --background: ${darkBg};
          --color-slate-950: ${darkSlate950};
          --color-slate-900: ${darkSlate900};
          --color-slate-800: ${darkSlate800};
          --card-bg: ${darkSlate900};
          --card-border: ${darkSlate800};
          --glass-panel-bg: rgba(${panelRgb}, 0.75);
          --glass-card-bg: rgba(${cardRgb}, 0.5);
        }
      `;
    } catch (e) {
      console.error(e);
    }
  };

  const removeCustomScale = () => {
    const root = document.documentElement;
    const shades = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];
    shades.forEach(shade => root.style.removeProperty(`--color-primary-${shade}`));
    
    const styleEl = document.getElementById('preptea-custom-theme-styles');
    if (styleEl) {
      styleEl.remove();
    }
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
