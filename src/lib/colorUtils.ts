export function hexToRgb(hex: string) {
  // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
  var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  hex = hex.replace(shorthandRegex, function(m, r, g, b) {
    return r + r + g + g + b + b;
  });

  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : {r: 0, g: 0, b: 0};
}

export function hexToHsl(hex: string) {
  const rgb = hexToRgb(hex);
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

export function hslToHex(h: number, s: number, l: number) {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function generateColorScale(baseHex: string) {
  const baseHsl = hexToHsl(baseHex);
  
  // Weights determine how far we interpolate lightness from the base color
  // towards absolute light (98%) or absolute dark (5%)
  const createShade = (shadeIndex: number) => {
    if (shadeIndex === 500) return baseHex;
    
    let newL;
    let weight;
    
    if (shadeIndex < 500) {
      // Lighten (towards L = 97)
      // 50 -> weight ~0.9, 400 -> weight ~0.2
      weight = (500 - shadeIndex) / 450; 
      newL = baseHsl.l + (97 - baseHsl.l) * weight;
    } else {
      // Darken (towards L = 5)
      // 600 -> weight ~0.22, 950 -> weight ~1.0
      weight = (shadeIndex - 500) / 450;
      newL = baseHsl.l - (baseHsl.l - 5) * weight;
    }
    
    // Slightly desaturate extreme shades to keep them looking natural
    const newS = baseHsl.s * (1 - (weight * 0.15));
    
    return hslToHex(baseHsl.h, newS, newL);
  };

  return {
    '50': createShade(50),
    '100': createShade(100),
    '200': createShade(200),
    '300': createShade(300),
    '400': createShade(400),
    '500': baseHex,
    '600': createShade(600),
    '700': createShade(700),
    '800': createShade(800),
    '900': createShade(900),
    '950': createShade(950),
  };
}
