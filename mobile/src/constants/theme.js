// Fayshaa Wellness Residence - Brand Colors and Theme
// Based on new wellness-focused design system

export const COLORS = {
  // Primary brand colors (wellness palette)
  primary: '#C8A45D',        // Fayshaa gold - rgb(200, 164, 93)
  primaryLight: '#e0bd7c',   // Light gold (hover state)
  primaryDark: '#a88a4a',    // Dark gold

  // Dark luxury backgrounds
  background: '#0D0D0D',     // Main background - rgb(13, 13, 13)
  backgroundCard: '#171512',  // Card background - warmer dark tone
  backgroundLight: '#1a1a1a', // Lighter background
  backgroundDark: '#0a0a0a',  // Darker background

  // Text colors (warm neutrals)
  text: '#F2E9D8',           // Primary text - warm off-white rgb(242, 233, 216)
  textSecondary: 'rgba(242, 233, 216, 0.75)', // Secondary text
  textTertiary: 'rgba(242, 233, 216, 0.5)',   // Tertiary text
  textDisabled: 'rgba(242, 233, 216, 0.35)',  // Disabled text
  textGold: '#C8A45D',       // Gold text/headings

  // Status colors
  error: '#FF3B30',
  success: '#7fae8a',        // Calm green
  warning: '#FF9500',
  info: '#5AC8FA',

  // UI elements
  border: 'rgba(242, 233, 216, 0.08)',        // Subtle borders
  borderLight: 'rgba(200, 164, 93, 0.15)',    // Card borders
  borderGold: 'rgba(200, 164, 93, 0.4)',      // Gold borders
  divider: 'rgba(242, 233, 216, 0.1)',        // Divider lines
  overlay: 'rgba(13, 13, 13, 0.85)',
  overlayLight: 'rgba(13, 13, 13, 0.5)',

  // Gradients
  gradientDark: 'linear-gradient(180deg, rgba(13,13,13,0.5) 0%, rgba(13,13,13,0.85) 70%, #0D0D0D 100%)',
  gradientReflect: 'linear-gradient(135deg, #1a2620, #171512)',
  gradientOverlay: 'linear-gradient(180deg, rgba(13,13,13,0) 40%, #0D0D0D 100%)',
  gradientFade: 'linear-gradient(0deg, #0D0D0D, rgba(13,13,13,0.1))',

  // Shadows
  shadowGold: 'rgba(200, 164, 93, 0.3)',
  shadowDark: 'rgba(0, 0, 0, 0.5)',

  // Wellness mood colors
  mood: {
    restore: 'rgba(200, 164, 93, 0.15)',
    recharge: 'rgba(200, 164, 93, 0.15)',
    reflect: 'rgba(26, 38, 32, 0.5)',
    explore: 'rgba(200, 164, 93, 0.15)',
  },
};

export const FONTS = {
  // Font families
  body: 'Montserrat',        // Body text (Montserrat from design)
  heading: 'Cinzel',         // Headings (Cinzel serif from design)
  regular: 'System',         // Fallback to system
  medium: 'System',
  semiBold: 'System',
  bold: 'System',
  light: 'System',

  // Sizes (matching design)
  sizes: {
    xs: 9.5,              // Nav labels
    sm: 10.5,             // Small labels
    base: 11,             // Small text
    md: 12.5,             // Base text
    regular: 13,          // Regular text
    lg: 14,               // Large text
    xl: 15,               // Section headings
    xxl: 17,              // Large headings
    heading: 19,          // Screen headings
    display: 20,          // Display headings
    large: 26,            // Large display
    hero: 28,             // Hero text
  },

  // Line heights
  lineHeights: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },

  // Letter spacing (design uses specific spacing)
  letterSpacing: {
    tight: 0,
    normal: 0.3,
    wide: 0.5,
    wider: 1,
    widest: 1.5,
    hero: 6,              // For FAYSHA hero text
  },
};

export const SIZES = {
  // Spacing scale (4px base)
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,

  // Padding
  padding: 20,
  paddingSm: 12,
  paddingLg: 24,

  // Margins
  margin: 16,
  marginSm: 8,
  marginLg: 24,

  // Border radius
  radiusSm: 8,
  radius: 12,
  radiusLg: 16,
  radiusXl: 20,
  radiusRound: 999,

  // Icon sizes
  iconXs: 16,
  iconSm: 20,
  icon: 24,
  iconLg: 32,
  iconXl: 40,

  // Button heights
  buttonSm: 36,
  button: 48,
  buttonLg: 56,

  // Input heights
  input: 48,
  inputSm: 40,

  // Header height
  headerHeight: 60,

  // Bottom tab height
  tabBarHeight: 65,
};

export const SHADOWS = {
  // Gold shadows for primary elements
  goldSm: {
    shadowColor: COLORS.shadowGold,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  gold: {
    shadowColor: COLORS.shadowGold,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  goldLg: {
    shadowColor: COLORS.shadowGold,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },

  // Dark shadows for cards
  darkSm: {
    shadowColor: COLORS.shadowDark,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  dark: {
    shadowColor: COLORS.shadowDark,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  darkLg: {
    shadowColor: COLORS.shadowDark,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
};

export const ANIMATIONS = {
  duration: {
    fast: 200,
    normal: 300,
    slow: 500,
  },
  easing: {
    easeIn: 'ease-in',
    easeOut: 'ease-out',
    easeInOut: 'ease-in-out',
  },
};

export default { COLORS, FONTS, SIZES, SHADOWS, ANIMATIONS };
