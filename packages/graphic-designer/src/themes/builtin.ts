import type { GradientSpec as PrimitiveGradientSpec } from '../primitives/gradients.js';
import { z } from 'zod';

const colorHexSchema = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, 'Expected #RRGGBB or #RRGGBBAA color');

const fontFamilySchema = z.string().min(1).max(120);

export const codeThemeSchema = z
  .object({
    background: colorHexSchema,
    text: colorHexSchema,
    comment: colorHexSchema,
    keyword: colorHexSchema,
    string: colorHexSchema,
    number: colorHexSchema,
    function: colorHexSchema,
    variable: colorHexSchema,
    operator: colorHexSchema,
    punctuation: colorHexSchema,
  })
  .strict();

export const themeSchema = z
  .object({
    background: colorHexSchema,
    surface: colorHexSchema,
    surfaceMuted: colorHexSchema,
    surfaceElevated: colorHexSchema,
    text: colorHexSchema,
    textMuted: colorHexSchema,
    textInverse: colorHexSchema,
    primary: colorHexSchema,
    secondary: colorHexSchema,
    accent: colorHexSchema,
    success: colorHexSchema,
    warning: colorHexSchema,
    error: colorHexSchema,
    info: colorHexSchema,
    border: colorHexSchema,
    borderMuted: colorHexSchema,
    code: codeThemeSchema,
    fonts: z
      .object({
        heading: fontFamilySchema,
        body: fontFamilySchema,
        mono: fontFamilySchema,
      })
      .strict(),
  })
  .strict();

export const builtInThemeSchema = z.enum(['dark', 'light', 'dracula', 'github-dark', 'one-dark', 'nord']);

export type Theme = z.infer<typeof themeSchema>;
export type BuiltInTheme = z.infer<typeof builtInThemeSchema>;
export type ThemeInput = BuiltInTheme | Theme;

const baseDarkTheme: Theme = {
  background: '#0B1020',
  surface: '#111936',
  surfaceMuted: '#1A2547',
  surfaceElevated: '#202D55',
  text: '#E8EEFF',
  textMuted: '#AAB9E8',
  textInverse: '#0B1020',
  primary: '#7AA2FF',
  secondary: '#65E4A3',
  accent: '#65E4A3',
  success: '#2FCB7E',
  warning: '#F4B860',
  error: '#F97070',
  info: '#60A5FA',
  border: '#32426E',
  borderMuted: '#24345F',
  code: {
    background: '#0F172A',
    text: '#E2E8F0',
    comment: '#64748B',
    keyword: '#C084FC',
    string: '#86EFAC',
    number: '#FCA5A5',
    function: '#93C5FD',
    variable: '#E2E8F0',
    operator: '#F8FAFC',
    punctuation: '#CBD5E1',
  },
  fonts: {
    heading: 'Space Grotesk',
    body: 'Inter',
    mono: 'JetBrains Mono',
  },
};

export const builtInThemeBackgrounds: Partial<Record<BuiltInTheme, PrimitiveGradientSpec>> = {
  dark: {
    type: 'linear',
    angle: 180,
    stops: [
      { offset: 0, color: '#0B1020' },
      { offset: 1, color: '#1A2547' },
    ],
  },
};

export const builtInThemes: Record<BuiltInTheme, Theme> = {
  dark: baseDarkTheme,
  light: {
    ...baseDarkTheme,
    background: '#F8FAFC',
    surface: '#FFFFFF',
    surfaceMuted: '#EEF2FF',
    surfaceElevated: '#FFFFFF',
    text: '#0F172A',
    textMuted: '#334155',
    textInverse: '#F8FAFC',
    border: '#CBD5E1',
    borderMuted: '#E2E8F0',
    code: {
      ...baseDarkTheme.code,
      background: '#F1F5F9',
      text: '#0F172A',
      variable: '#1E293B',
      punctuation: '#334155',
      operator: '#0F172A',
    },
  },
  dracula: {
    ...baseDarkTheme,
    background: '#282A36',
    surface: '#303247',
    surfaceMuted: '#3A3D55',
    surfaceElevated: '#44475A',
    text: '#F8F8F2',
    textMuted: '#BD93F9',
    primary: '#8BE9FD',
    accent: '#50FA7B',
    secondary: '#FFB86C',
    success: '#50FA7B',
    warning: '#FFB86C',
    error: '#FF5555',
    info: '#8BE9FD',
    border: '#44475A',
    borderMuted: '#3A3D55',
  },
  'github-dark': {
    ...baseDarkTheme,
    background: '#0D1117',
    surface: '#161B22',
    surfaceMuted: '#1F2632',
    surfaceElevated: '#21262D',
    text: '#E6EDF3',
    textMuted: '#8B949E',
    primary: '#58A6FF',
    accent: '#3FB950',
    secondary: '#A5D6FF',
    border: '#30363D',
    borderMuted: '#21262D',
  },
  'one-dark': {
    ...baseDarkTheme,
    background: '#282C34',
    surface: '#2F343F',
    surfaceMuted: '#3A404C',
    surfaceElevated: '#434A59',
    text: '#ABB2BF',
    textMuted: '#7F848E',
    primary: '#61AFEF',
    accent: '#98C379',
    secondary: '#E5C07B',
    warning: '#E5C07B',
    error: '#E06C75',
    border: '#4B5263',
    borderMuted: '#3A404C',
  },
  nord: {
    ...baseDarkTheme,
    background: '#2E3440',
    surface: '#3B4252',
    surfaceMuted: '#434C5E',
    surfaceElevated: '#4C566A',
    text: '#ECEFF4',
    textMuted: '#D8DEE9',
    primary: '#88C0D0',
    accent: '#A3BE8C',
    secondary: '#81A1C1',
    success: '#A3BE8C',
    warning: '#EBCB8B',
    error: '#BF616A',
    info: '#5E81AC',
    border: '#4C566A',
    borderMuted: '#434C5E',
  },
};

export const defaultTheme: Theme = builtInThemes.dark;
