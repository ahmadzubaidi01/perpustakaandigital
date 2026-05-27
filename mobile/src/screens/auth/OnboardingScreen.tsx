import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { Spacing, FontSize, BorderRadius, Colors } from '../../constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

interface Slide {
  id: number;
  title: string;
  desc: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

const slides: Slide[] = [
  {
    id: 1,
    title: 'Cari Buku Favorit',
    desc: 'Akses katalog buku perpustakaan digital dan fisik terlengkap langsung dari genggaman tangan Anda.',
    icon: 'search-outline',
    color: '#3B82F6', // Vibrant Blue
  },
  {
    id: 2,
    title: 'Peminjaman Offline',
    desc: 'Tetap bisa scan QR code, meminjam, dan mengembalikan buku secara instan walaupun tanpa koneksi internet.',
    icon: 'cloud-offline-outline',
    color: '#10B981', // Emerald Green
  },
  {
    id: 3,
    title: 'Obrolan Pesan Real-Time',
    desc: 'Tanyakan ketersediaan buku atau diskusikan perihal perpustakaan langsung dengan pustakawan sekolah.',
    icon: 'chatbubbles-outline',
    color: '#8B5CF6', // Purple Accent
  },
];

export default function OnboardingScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const [activeSlide, setActiveSlide] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const handleScroll = (event: any) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const index = event.nativeEvent.contentOffset.x / slideSize;
    const roundIndex = Math.round(index);
    if (roundIndex !== activeSlide) {
      setActiveSlide(roundIndex);
    }
  };

  const handleNext = async () => {
    if (activeSlide < slides.length - 1) {
      scrollRef.current?.scrollTo({
        x: (activeSlide + 1) * width,
        animated: true,
      });
    } else {
      await AsyncStorage.setItem('has_seen_onboarding', 'true');
      navigation.replace('GetStarted');
    }
  };

  const handleSkip = async () => {
    await AsyncStorage.setItem('has_seen_onboarding', 'true');
    navigation.replace('GetStarted');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Skip Button */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={handleSkip}>
          <Text style={styles.skipText}>Lewati</Text>
        </TouchableOpacity>
      </View>

      {/* Slide Carousels */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={styles.carousel}
      >
        {slides.map((slide) => (
          <View key={slide.id} style={styles.slideContainer}>
            {/* Visual Icon Box */}
            <View style={[styles.iconOuterCircle, { borderColor: slide.color + '30', shadowColor: slide.color }]}>
              <View style={[styles.iconInnerCircle, { backgroundColor: slide.color + '15' }]}>
                <Ionicons name={slide.icon} size={84} color={slide.color} />
              </View>
            </View>

            {/* Description Block */}
            <View style={styles.textBlock}>
              <Text style={styles.title}>{slide.title}</Text>
              <Text style={styles.description}>{slide.desc}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Footer Nav Bar */}
      <View style={styles.footer}>
        {/* Pagination Indicators */}
        <View style={styles.dotsContainer}>
          {slides.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                activeSlide === index ? styles.activeDot : { backgroundColor: colors.surface600 },
              ]}
            />
          ))}
        </View>

        {/* Action Button */}
        <TouchableOpacity style={styles.nextBtn} onPress={handleNext} activeOpacity={0.8}>
          <Text style={styles.nextBtnText}>
            {activeSlide === slides.length - 1 ? 'Mulai' : 'Lanjut'}
          </Text>
          <Ionicons
            name={activeSlide === slides.length - 1 ? 'rocket-outline' : 'arrow-forward'}
            size={18}
            color={colors.white}
          />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.surface900,
    },
    topBar: {
      height: 56,
      alignItems: 'flex-end',
      justifyContent: 'center',
      paddingHorizontal: Spacing.xl,
    },
    skipText: {
      color: colors.textMuted,
      fontSize: FontSize.md,
      fontWeight: '700',
    },
    carousel: {
      flex: 1,
    },
    slideContainer: {
      width: width,
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: Spacing.xl * 1.5,
    },
    iconOuterCircle: {
      width: 180,
      height: 180,
      borderRadius: 90,
      borderWidth: 2,
      justifyContent: 'center',
      alignItems: 'center',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.3,
      shadowRadius: 15,
      elevation: 6,
      marginBottom: Spacing.xxl,
    },
    iconInnerCircle: {
      width: 156,
      height: 156,
      borderRadius: 78,
      justifyContent: 'center',
      alignItems: 'center',
    },
    textBlock: {
      alignItems: 'center',
      gap: Spacing.md,
    },
    title: {
      fontSize: FontSize.xl + 4,
      fontWeight: '900',
      color: colors.text,
      textAlign: 'center',
      letterSpacing: -0.5,
    },
    description: {
      fontSize: FontSize.md,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 24,
      paddingHorizontal: Spacing.sm,
    },
    footer: {
      height: 100,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: Spacing.xl * 1.5,
      paddingBottom: Spacing.lg,
    },
    dotsContainer: {
      flexDirection: 'row',
      gap: 8,
    },
    dot: {
      height: 8,
      width: 8,
      borderRadius: 4,
    },
    activeDot: {
      width: 24,
      backgroundColor: colors.primary500,
    },
    nextBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      backgroundColor: colors.primary500,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.xl,
      borderRadius: BorderRadius.lg,
      shadowColor: colors.primary500,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
      elevation: 4,
    },
    nextBtnText: {
      color: colors.white,
      fontWeight: '800',
      fontSize: FontSize.md,
    },
  });
