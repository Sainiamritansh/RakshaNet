// src/theme.js — Centralized design tokens for Raksha-Net "Guardian Prime" design system

export const COLORS = {
  // Primary Red Palette
  primary:        '#E53935',
  primaryDark:    '#B71C1C',
  primaryLight:   '#FFCDD2',
  primaryBg:      '#FFEBEE',

  // Dark Backgrounds (Splash, SOS)
  bgDark:         '#121212',
  bgDarkCard:     '#1E1E1E',
  bgDarkElevated: '#2A2A2A',

  // Light Backgrounds (Home, Contacts)
  bgLight:        '#FFFFFF',
  bgLightGrey:    '#F5F6FA',

  // Text
  textPrimary:    '#FFFFFF',
  textDark:       '#1A1A2E',
  textSecondary:  'rgba(255, 255, 255, 0.6)',
  textMuted:      '#9E9E9E',
  textMutedLight: '#BDBDBD',

  // Semantic
  success:        '#4CAF50',
  successDark:    '#43A047',
  successLight:   '#E8F5E9',
  info:           '#1E88E5',
  infoLight:      '#E3F2FD',
  warning:        '#FB8C00',
  warningLight:   '#FFF8E1',
  danger:         '#E53935',
  dangerLight:    '#FFEBEE',

  // Misc
  divider:        '#F5F5F5',
  overlay:        'rgba(0, 0, 0, 0.5)',
  overlayLight:   'rgba(0, 0, 0, 0.3)',
};

export const RADIUS = {
  sm:     8,
  md:     14,
  lg:     16,
  xl:     20,
  xxl:    24,
  pill:   30,
  circle: 9999,
};

export const SPACING = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  xxl: 24,
  xxxl: 32,
};

export const TYPOGRAPHY = {
  hero:    { fontSize: 42, fontWeight: '900', letterSpacing: 4 },
  h1:      { fontSize: 28, fontWeight: '800' },
  h2:      { fontSize: 20, fontWeight: '700' },
  h3:      { fontSize: 17, fontWeight: '700' },
  body:    { fontSize: 15, fontWeight: '500' },
  caption: { fontSize: 13, fontWeight: '500' },
  small:   { fontSize: 12, fontWeight: '600' },
  overline: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
};

export const SHADOWS = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  glow: {
    shadowColor: '#E53935',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 15,
  },
  tabBar: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 12,
  },
};

// Animation Presets
export const ANIM = {
  sosTrianglePulse: {
    scaleFrom: 1.0,
    scaleTo: 1.15,
    scaleDuration: 1200,
  },
  sosTriangleFlash: {
    opacityFrom: 1.0,
    opacityTo: 0.4,
    opacityDuration: 800,
  },
  sosPulse: {
    scaleFrom: 1.0,
    scaleTo: 1.05,
    duration: 1200,
  },
  ringExpand: {
    scaleFrom: 0.8,
    scaleTo: 1.3,
    duration: 1500,
  },
};
