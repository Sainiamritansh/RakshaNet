import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  StatusBar,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY } from '../src/theme';

const { width } = Dimensions.get('window');

export default function SplashScreen({ navigation }) {
  const logoScale = useRef(new Animated.Value(0.3)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const barWidth = useRef(new Animated.Value(0)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 4,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    setTimeout(() => {
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }, 400);

    setTimeout(() => {
      Animated.timing(barWidth, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: false,
      }).start();
    }, 600);

    setTimeout(() => {
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        navigation.replace('Main');
      });
    }, 2500);
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: screenOpacity }]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bgDark} />
      <View style={styles.spacer} />
      <View style={styles.centerContent}>
        <Animated.View
          style={[
            styles.logoContainer,
            {
              transform: [{ scale: logoScale }],
              opacity: logoOpacity,
            },
          ]}
        >
          <View style={styles.shieldOuter}>
            <View style={styles.shieldInner}>
              <Ionicons name="shield" size={52} color={COLORS.textPrimary} />
            </View>
          </View>
        </Animated.View>
        <Animated.View style={[styles.textContainer, { opacity: textOpacity }]}>
          <Text style={styles.appName}>RakshaNet</Text>
        </Animated.View>
      </View>
      <View style={styles.bottomSection}>
        <View style={styles.loadingBarTrack}>
          <Animated.View
            style={[
              styles.loadingBarFill,
              {
                width: barWidth.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgDark,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  spacer: { height: 80 },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: { marginBottom: 32 },
  shieldOuter: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(229, 57, 53, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shieldInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: { alignItems: 'center' },
  appName: {
    ...TYPOGRAPHY.h1,
    fontSize: 36,
    color: COLORS.textPrimary,
    textAlign: 'center',
    letterSpacing: 1,
  },
  bottomSection: {
    width: '100%',
    paddingHorizontal: 60,
    paddingBottom: 80,
  },
  loadingBarTrack: {
    height: 3,
    backgroundColor: 'rgba(229, 57, 53, 0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  loadingBarFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
});
