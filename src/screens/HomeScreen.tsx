import React from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/RootNavigator';
import {useVolunteerSession} from '../context/VolunteerSessionContext';
import {useLastAlarmNotification} from '../context/LastAlarmNotificationContext';
import {logoutVolunteer} from '../services/volunteerApi';
import {stopAlarmSirenAndClearTray, stopAlarmSirenOnly} from '../services/alarmNotification';
import {theme} from '../theme/theme';
import AppBackground from '../components/AppBackground';
import {useTenant} from '../context/TenantContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

const HomeScreen: React.FC<Props> = ({navigation}) => {
  const {width} = useWindowDimensions();
  const {session, clearSession} = useVolunteerSession();
  const {tenant, clearTenant} = useTenant();
  const {notification, hasNotification, resetNotification} =
    useLastAlarmNotification();
  const [loggingOut, setLoggingOut] = React.useState(false);
  const [resettingNotification, setResettingNotification] = React.useState(false);

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity
          onPress={async () => {
            await clearTenant();
            navigation.replace('TenantLogin');
          }}
          style={styles.headerBackButton}
          activeOpacity={0.8}>
          <Text style={styles.headerBackText}>{"\u2190"}</Text>
        </TouchableOpacity>
      ),
    });
  }, [clearTenant, navigation]);

  const contentMaxWidth = Math.min(520, width);
  const logoSize = Math.max(96, Math.min(150, Math.floor(width * 0.38)));
  const titleSize = Math.max(22, Math.min(30, Math.floor(width * 0.08)));
  const buttonFontSize = Math.max(16, Math.min(22, Math.floor(width * 0.06)));

  const handleLogout = async () => {
    if (!session) return;
    try {
      setLoggingOut(true);
      const res = await logoutVolunteer({
        tenantId: tenant?.tenantId,
        volunteerId: session.volunteerId,
        sessionId: session.sessionId,
      });
      if (!res.ok) {
        Alert.alert('Logout', res.error || 'Errore durante il logout.');
        return;
      }
      clearSession();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Errore di connessione.';
      Alert.alert('Logout', msg);
    } finally {
      setLoggingOut(false);
    }
  };

  /** Svuota box blu + ferma sirena (anche se già fermata) + toglie notifica tray. */
  const handleResetNotification = async () => {
    try {
      setResettingNotification(true);
      await stopAlarmSirenAndClearTray();
      await resetNotification();
    } finally {
      setResettingNotification(false);
    }
  };

  /** Solo sirena: box blu e pulsante Reset notifica restano attivi. */
  const handleResetSuoneria = async () => {
    try {
      setResettingNotification(true);
      await stopAlarmSirenOnly();
    } finally {
      setResettingNotification(false);
    }
  };

  const isLoggedIn = !!session;

  return (
    <AppBackground>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        <View style={[styles.inner, {maxWidth: contentMaxWidth}]}>
        <View style={styles.logoContainer}>
          <View
            style={[
              styles.logoCircleClip,
              {width: logoSize, height: logoSize, borderRadius: logoSize / 2},
            ]}>
            <Image
              source={require('../assets/logo_ansmi.png')}
              style={{width: logoSize, height: logoSize}}
              resizeMode="contain"
            />
          </View>
        </View>

        <Text style={[styles.trackingLine1, {fontSize: titleSize}]}>
          Tracking Volontari
        </Text>
        <Text style={[styles.trackingLine2, {fontSize: titleSize}]}>
          Pronta Partenza
        </Text>
        {tenant?.tenantId ? (
          <Text style={styles.tenantText}>
            Ente: {tenant.tenantName || tenant.tenantId}
          </Text>
        ) : null}

        <View
          style={[
            styles.riquadro,
            isLoggedIn ? styles.riquadroLogged : styles.riquadroBlank,
          ]}>
          {isLoggedIn ? (
            <Text
              style={[styles.riquadroText, styles.riquadroTextLogged]}
              numberOfLines={2}>
              {session.surname} {session.name} +{' '}
              {(session.loginAt ?? '').replace(/\./g, ':')}
            </Text>
          ) : null}
        </View>

        <View
          style={[
            styles.notificationBox,
            hasNotification
              ? styles.notificationBoxActive
              : styles.notificationBoxBlank,
          ]}>
          {hasNotification ? (
            <Text style={styles.notificationText} numberOfLines={6}>
              {notification?.text}
            </Text>
          ) : null}
        </View>

        {hasNotification ? (
          <View style={styles.resetRow}>
            {resettingNotification ? (
              <ActivityIndicator color={theme.colors.primary} size="small" />
            ) : (
              <>
                <TouchableOpacity
                  style={styles.resetNotificationButton}
                  onPress={handleResetNotification}
                  activeOpacity={0.8}>
                  <Text style={styles.resetNotificationText}>
                    Reset notifica
                  </Text>
                </TouchableOpacity>
                <Text style={styles.resetSeparator}>·</Text>
                <TouchableOpacity
                  style={styles.resetNotificationButton}
                  onPress={handleResetSuoneria}
                  activeOpacity={0.8}>
                  <Text style={styles.resetSuoneriaText}>Reset suoneria</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        ) : null}

        <TouchableOpacity
          style={[
            styles.button,
            isLoggedIn ? styles.buttonLoginDisabled : styles.buttonLogin,
          ]}
          onPress={() => !isLoggedIn && navigation.navigate('VolunteerLogin')}
          disabled={isLoggedIn}
          activeOpacity={isLoggedIn ? 1 : 0.8}>
          <Text
            style={[
              styles.buttonTextWhite,
              {fontSize: buttonFontSize},
              isLoggedIn && styles.buttonTextDisabled,
            ]}>
            Log-in
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            isLoggedIn ? styles.buttonLogoutActive : styles.buttonLogoutDisabled,
          ]}
          onPress={isLoggedIn ? handleLogout : undefined}
          disabled={!isLoggedIn || loggingOut}
          activeOpacity={isLoggedIn ? 0.8 : 1}>
          {isLoggedIn && loggingOut ? (
            <ActivityIndicator color={theme.colors.white} />
          ) : (
            <Text
              style={[
                isLoggedIn ? styles.buttonTextWhite : styles.buttonTextGray,
                {fontSize: buttonFontSize},
              ]}>
              Log-out
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.buttonAdmin]}
          onPress={() => navigation.navigate('AdminLogin')}
          activeOpacity={0.8}>
          <Text style={[styles.buttonTextWhite, {fontSize: buttonFontSize}]}>
            Centrale Operativa
          </Text>
        </TouchableOpacity>
        </View>
      </ScrollView>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: theme.spacing.screen,
    backgroundColor: 'transparent',
    paddingTop: 8,
    paddingBottom: 20,
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
  },
  inner: {
    width: '100%',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: 'transparent',
  },
  logoCircleClip: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  trackingLine1: {
    ...theme.typography.trackingTitle,
    marginBottom: 0,
    fontWeight: '900',
    flexShrink: 1,
    ...(Platform.OS === 'android' && {fontFamily: 'sans-serif-black'}),
  },
  trackingLine2: {
    ...theme.typography.trackingTitle,
    marginBottom: 12,
    marginTop: -4,
    fontWeight: '900',
    flexShrink: 1,
    ...(Platform.OS === 'android' && {fontFamily: 'sans-serif-black'}),
  },
  riquadro: {
    marginBottom: 10,
    paddingVertical: 14,
    paddingHorizontal: theme.spacing.screen,
    borderRadius: theme.radius.button,
    minHeight: 58,
    justifyContent: 'center',
    alignItems: 'center',
  },
  riquadroBlank: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  riquadroLogged: {
    backgroundColor: theme.colors.surfaceLogged,
    borderWidth: 0,
  },
  riquadroText: {
    textAlign: 'center',
    fontSize: 14,
  },
  riquadroTextLogged: {
    color: theme.colors.textOnGreen,
    fontWeight: '800',
  },
  notificationBox: {
    marginBottom: 8,
    paddingVertical: 12,
    paddingHorizontal: theme.spacing.screen,
    borderRadius: theme.radius.button,
    minHeight: 58,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBoxBlank: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  notificationBoxActive: {
    backgroundColor: theme.colors.notificationActive,
    borderWidth: 0,
  },
  notificationText: {
    color: theme.colors.white,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  resetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginBottom: 10,
    minHeight: 28,
  },
  resetNotificationButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  resetNotificationText: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  resetSuoneriaText: {
    color: theme.colors.logoutActive,
    fontSize: 13,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  resetSeparator: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    marginHorizontal: 2,
  },
  tenantText: {
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 10,
    fontSize: 13,
    fontWeight: '600',
  },
  button: {
    paddingVertical: 10,
    minHeight: 42,
    borderRadius: theme.radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  buttonLogin: {
    backgroundColor: theme.colors.loginActive,
    marginTop: 4,
  },
  buttonLoginDisabled: {
    backgroundColor: theme.colors.loginDisabled,
  },
  buttonLogoutDisabled: {
    backgroundColor: theme.colors.logoutDisabled,
  },
  buttonLogoutActive: {
    backgroundColor: theme.colors.logoutActive,
  },
  buttonAdmin: {
    backgroundColor: theme.colors.admin,
    marginBottom: 10,
  },
  headerBackButton: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  headerBackText: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: '700',
  },
  buttonTextWhite: {
    color: theme.colors.white,
    fontWeight: '800',
    ...(Platform.OS === 'android' && {fontFamily: 'sans-serif-black'}),
  },
  buttonTextGray: {
    color: theme.colors.logoutDisabledText,
    fontWeight: '700',
    ...(Platform.OS === 'android' && {fontFamily: 'sans-serif-medium'}),
  },
  buttonTextDisabled: {
    color: theme.colors.logoutDisabledText,
  },
});

export default HomeScreen;
