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

function mix(color1: {r: number, g: number, b: number}, color2: {r: number, g: number, b: number}, weight: number) {
  return {
    r: Math.round(color1.r * weight + color2.r * (1 - weight)),
    g: Math.round(color1.g * weight + color2.g * (1 - weight)),
    b: Math.round(color1.b * weight + color2.b * (1 - weight)),
  };
}

export function rgbToHex({r, g, b}: {r: number, g: number, b: number}) {
  return "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1).padStart(6, '0');
}

export function generateColorScale(baseHex: string) {
  const baseRgb = hexToRgb(baseHex);
  const white = {r: 255, g: 255, b: 255};
  const black = {r: 0, g: 0, b: 0};
  
  return {
    '50': rgbToHex(mix(baseRgb, white, 0.05)),
    '100': rgbToHex(mix(baseRgb, white, 0.1)),
    '200': rgbToHex(mix(baseRgb, white, 0.3)),
    '300': rgbToHex(mix(baseRgb, white, 0.5)),
    '400': rgbToHex(mix(baseRgb, white, 0.7)),
    '500': baseHex,
    '600': rgbToHex(mix(black, baseRgb, 0.2)),
    '700': rgbToHex(mix(black, baseRgb, 0.4)),
    '800': rgbToHex(mix(black, baseRgb, 0.6)),
    '900': rgbToHex(mix(black, baseRgb, 0.8)),
    '950': rgbToHex(mix(black, baseRgb, 0.92)), // slightly darker for 950
  };
}
