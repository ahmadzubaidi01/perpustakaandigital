export const Colors = {
  // Primary — Deep Navy Blue
  primary50: '#EFF6FF',
  primary100: '#DBEAFE',
  primary400: '#60A5FA',
  primary500: '#1E40AF',
  primary600: '#1E3A8A',
  primary800: '#172554',

  // Accent — Amber/Gold
  accent400: '#FBBF24',
  accent500: '#F59E0B',

  // Success
  success50: '#F0FDF4',
  success500: '#22C55E',
  success600: '#16A34A',

  // Danger
  danger50: '#FEF2F2',
  danger500: '#EF4444',
  danger600: '#DC2626',

  // Warning
  warning50: '#FFFBEB',
  warning500: '#F59E0B',

  // Info
  info50: '#EFF6FF',
  info500: '#3B82F6',

  // Dark surfaces
  surface900: '#0B1120',
  surface800: '#111827',
  surface700: '#1F2937',
  surface600: '#2A3444',
  surface500: '#374151',
  surface400: '#4B5563',
  surface300: '#6B7280',
  surface200: '#9CA3AF',
  surface100: '#D1D5DB',
  surface50: '#F3F4F6',

  white: '#FFFFFF',
  text: '#F1F5F9',
  textMuted: '#94A3B8',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const FontSize = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 22,
  xxxl: 28,
  title: 32,
};

export const BorderRadius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 20,
  full: 9999,
};

import Constants from 'expo-constants';
import { Platform } from 'react-native';

const getBackendUrl = () => {
  if (Platform.OS === 'web') {
    return 'http://localhost:5000/api';
  }
  try {
    const hostUri = Constants.expoConfig?.hostUri;
    if (hostUri) {
      const ip = hostUri.split(':')[0];
      if (ip) return `http://${ip}:5000/api`;
    }
  } catch (e) {
    // Ignore error
  }
  return Platform.OS === 'android' ? 'http://192.168.56.1:5000/api' : 'http://localhost:5000/api';
};

export const API_BASE_URL = 'https://www.perpustakaanahmad.my.id/api';
