import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Image } from 'react-native';
import { COLORS } from '../constants/theme';

/** Shown while the app restores the session and loads its fonts (AppNavigator decides what comes next). */
export default function SplashScreen() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in and scale animation for logo
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    // Continuous rotation animation for loading indicator
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    ).start();

  }, []);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      {/* Pure black background to match logo */}
      <View style={styles.blackBackground}>
        {/* Content */}
        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Logo Container - logo already has marble texture */}
          <View style={styles.logoContainer}>
            <Image
              source={require('../../assets/faysha-logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          {/* Loading Indicator */}
          <View style={styles.loadingContainer}>
            <Animated.View
              style={[
                styles.loadingRing,
                {
                  transform: [{ rotate: spin }],
                },
              ]}
            >
              <View style={styles.loadingRingInner} />
            </Animated.View>
            
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  blackBackground: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    marginBottom: 60,
  },
  logo: {
    width: 260,
    height: 260,
  },
  loadingContainer: {
    alignItems: 'center',
    gap: 20,
  },
  loadingRing: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 3,
    borderColor: 'transparent',
    borderTopColor: COLORS.primary,
    borderRightColor: COLORS.primary,
  },
  loadingRingInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'transparent',
  },
  loadingText: {
    fontSize: 12,
    color: COLORS.primary,
    letterSpacing: 2,
    fontWeight: '300',
  },
});
