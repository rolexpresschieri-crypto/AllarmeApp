import React, {useEffect, useRef} from 'react';
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/RootNavigator';
import {theme} from '../theme/theme';
import AppBackground from '../components/AppBackground';
import {useTenant} from '../context/TenantContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

const SplashScreen: React.FC<Props> = ({navigation}) => {
  const {tenant, tenantHydrated} = useTenant();
  const {width} = useWindowDimensions();
  const scale = useRef(new Animated.Value(0.7)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const logoSize = Math.max(140, Math.min(240, Math.floor(width * 0.58)));
  const titleSize = Math.max(26, Math.min(40, Math.floor(width * 0.105)));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(scale, {
        toValue: 1.12,
        duration: 1300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 650,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();

    const fadeOutTimer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 420,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start();
    }, 2500);

    return () => {
      clearTimeout(fadeOutTimer);
      scale.stopAnimation();
      opacity.stopAnimation();
    };
  }, [opacity, scale]);

  useEffect(() => {
    if (!tenantHydrated) {
      return;
    }
    const timeoutId = setTimeout(() => {
      navigation.replace(tenant?.tenantId ? 'Home' : 'TenantLogin');
    }, 3000);
    return () => clearTimeout(timeoutId);
  }, [navigation, tenant?.tenantId, tenantHydrated]);

  return (
    <AppBackground>
      <View style={styles.container}>
        <Animated.View style={{transform: [{scale}], opacity, marginBottom: 52}}>
          <View
            style={[
              styles.logoCircleClip,
              {width: logoSize, height: logoSize, borderRadius: logoSize / 2},
            ]}>
            <Image
              source={require('../assets/logo_ansmi.png')}
              style={{width: logoSize, height: logoSize, backgroundColor: 'transparent'}}
              resizeMode="contain"
            />
          </View>
        </Animated.View>
        <Animated.Text style={[styles.title, {fontSize: titleSize}, {opacity}]}>
          Tracking Volontari
        </Animated.Text>
        <Animated.Text style={[styles.title, {fontSize: titleSize}, {opacity}]}>
          Pronta Partenza
        </Animated.Text>
        <Text style={styles.byline}>by Ronco</Text>
      </View>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    paddingHorizontal: theme.spacing.screen,
    paddingTop: 0,
  },
  title: {
    ...theme.typography.trackingTitle,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 46,
  },
  logoCircleClip: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  byline: {
    position: 'absolute',
    right: 18,
    bottom: 56,
    color: '#2f2f2f',
    fontSize: 16,
    fontWeight: '600',
    fontStyle: 'italic',
    zIndex: 10,
  },
});

export default SplashScreen;
