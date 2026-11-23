export interface AppearanceSettings {
  accentColor: string;
  logoStartColor: string;
  logoEndColor: string;
  logoGradient: boolean;
  gradientAngle: number;
  buttonStyle: "solid" | "outline";
}

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  accentColor: "#2bcfb2",
  logoStartColor: "#2bcfb2",
  logoEndColor: "#00c982",
  logoGradient: true,
  gradientAngle: 90,
  buttonStyle: "solid",
};

export interface AppearanceSnapshot {
  settings: AppearanceSettings;
  revision: number;
  updatedAt: number | null;
}

/** Only accept colors, never arbitrary CSS, URLs, or declarations. */
export function normalizeHex(value: string): string {
  const hex = value.trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(hex)) {
    return "#" + [...hex.slice(1)].map(c => c + c).join("");
  }
  if (!/^#[0-9a-f]{6}$/.test(hex)) throw new Error("Enter a valid hex color, such as #2BCFB2.");
  return hex;
}

export function normalizeAppearance(settings: AppearanceSettings): AppearanceSettings {
  if (typeof settings.logoGradient !== "boolean") throw new Error("Invalid logo style.");
  if (settings.buttonStyle !== "solid" && settings.buttonStyle !== "outline") throw new Error("Invalid button style.");
  if (!Number.isInteger(settings.gradientAngle) || settings.gradientAngle < 0 || settings.gradientAngle > 360) {
    throw new Error("Gradient angle must be a whole number from 0 to 360.");
  }
  return {
    accentColor: normalizeHex(settings.accentColor),
    logoStartColor: normalizeHex(settings.logoStartColor),
    logoEndColor: normalizeHex(settings.logoEndColor),
    logoGradient: settings.logoGradient,
    gradientAngle: settings.gradientAngle,
    buttonStyle: settings.buttonStyle,
  };
}

function rgb(hex: string): number[] {
  const value = normalizeHex(hex);
  return [1, 3, 5].map(i => parseInt(value.slice(i, i + 2), 16));
}

function luminance(hex: string): number {
  const channels = rgb(hex).map(channel => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

export function contrastRatio(a: string, b: string): number {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

export function buttonTextColor(background: string): string {
  return contrastRatio(background, "#000000") >= contrastRatio(background, "#ffffff") ? "#000000" : "#ffffff";
}

/** Keep accent labels and focus rings legible in both site themes. */
export function readableAccent(color: string, background: string): string {
  if (contrastRatio(color, background) >= 4.5) return normalizeHex(color);
  const channels = rgb(color);
  const target = buttonTextColor(background) === "#ffffff" ? 255 : 0;
  for (let step = 1; step <= 100; step++) {
    const adjusted = "#" + channels.map(c => Math.round(c + (target - c) * step / 100).toString(16).padStart(2, "0")).join("");
    if (contrastRatio(adjusted, background) >= 4.5) return adjusted;
  }
  return target ? "#ffffff" : "#000000";
}

function hslChannels(hex: string): string {
  const [r, g, b] = rgb(hex).map(c => c / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  const l = (max + min) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  let hue = 0;
  if (delta) {
    hue = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  }
  return `${((hue * 60 + 360) % 360).toFixed(2)} ${(saturation * 100).toFixed(2)}% ${(l * 100).toFixed(2)}%`;
}

export function appearanceVariables(settings: AppearanceSettings, light = false): Record<string, string> {
  const config = normalizeAppearance(settings);
  // Use the darkest light surface so accent text remains readable on cards,
  // the page canvas, and inset controls (not just on white).
  const ink = readableAccent(config.accentColor, light ? "#ebeef2" : "#1b1b1b");
  const primary = hslChannels(ink);
  return {
    "--brand-color": config.accentColor,
    "--brand-ink": ink,
    "--brand-logo": config.logoGradient
      ? `linear-gradient(${config.gradientAngle}deg, ${config.logoStartColor}, ${config.logoEndColor})`
      : config.logoStartColor,
    "--brand-button-bg": config.buttonStyle === "solid" ? (light ? "#171a1f" : "#ffffff") : "transparent",
    "--brand-button-fg": config.buttonStyle === "solid" ? (light ? "#ffffff" : "#000000") : ink,
    "--brand-button-border": config.buttonStyle === "solid" ? (light ? "#171a1f" : "#ffffff") : ink,
    "--primary": primary,
    "--primary-foreground": hslChannels(buttonTextColor(ink)),
    "--ring": primary,
    "--sidebar-primary": primary,
    "--sidebar-primary-foreground": hslChannels(buttonTextColor(ink)),
    "--sidebar-ring": primary,
  };
}

export function sameAppearance(a: AppearanceSettings, b: AppearanceSettings): boolean {
  return JSON.stringify(normalizeAppearance(a)) === JSON.stringify(normalizeAppearance(b));
}
