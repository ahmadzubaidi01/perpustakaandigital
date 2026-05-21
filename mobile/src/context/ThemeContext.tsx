import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeType = 'light' | 'dark';

export const DarkColors = {
  primary50: '#EFF6FF',
  primary100: '#DBEAFE',
  primary400: '#60A5FA',
  primary500: '#1E40AF',
  primary600: '#1E3A8A',
  primary800: '#172554',
  accent400: '#FBBF24',
  accent500: '#F59E0B',
  success50: '#F0FDF4',
  success500: '#22C55E',
  success600: '#16A34A',
  danger50: '#FEF2F2',
  danger500: '#EF4444',
  danger600: '#DC2626',
  warning50: '#FFFBEB',
  warning500: '#F59E0B',
  info50: '#EFF6FF',
  info500: '#3B82F6',
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

export const LightColors = {
  primary50: '#EFF6FF',
  primary100: '#DBEAFE',
  primary400: '#3B82F6',
  primary500: '#1E40AF',
  primary600: '#1D4ED8',
  primary800: '#1E3A8A',
  accent400: '#F59E0B',
  accent500: '#D97706',
  success50: '#F0FDF4',
  success500: '#16A34A',
  success600: '#15803D',
  danger50: '#FEF2F2',
  danger500: '#DC2626',
  danger600: '#B91C1C',
  warning50: '#FFFBEB',
  warning500: '#D97706',
  info50: '#EFF6FF',
  info500: '#2563EB',
  surface900: '#F3F4F6', // light grey background
  surface800: '#FFFFFF', // card/input background
  surface700: '#E5E7EB', // secondary card/borders
  surface600: '#D1D5DB', // active borders
  surface500: '#9CA3AF', // disabled/placeholder
  surface400: '#6B7280',
  surface300: '#4B5563',
  surface200: '#374151',
  surface100: '#1F2937',
  surface50: '#111827',
  white: '#FFFFFF',
  text: '#111827',       // dark grey/black primary text
  textMuted: '#6B7280',  // medium grey secondary text
};

interface ThemeContextType {
  theme: ThemeType;
  colors: typeof DarkColors;
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<ThemeType>('dark'); // default is dark based on user branding

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const stored = await AsyncStorage.getItem('app_theme');
        if (stored === 'light' || stored === 'dark') {
          setTheme(stored);
        }
      } catch {}
    };
    loadTheme();
  }, []);

  const toggleTheme = async () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try {
      await AsyncStorage.setItem('app_theme', next);
    } catch {}
  };

  const colors = theme === 'dark' ? DarkColors : LightColors;
  const isDark = theme === 'dark';

  return (
    <ThemeContext.Provider value={{ theme, colors, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
