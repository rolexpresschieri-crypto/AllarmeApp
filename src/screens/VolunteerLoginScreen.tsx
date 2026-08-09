import React, {useState} from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Text,
  Alert,
  Platform,
} from 'react-native';
import notifee from '@notifee/react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/RootNavigator';
import {loginVolunteer} from '../services/volunteerApi';
import {useVolunteerSession} from '../context/VolunteerSessionContext';
import messaging from '@react-native-firebase/messaging';
import {registerDevice} from '../services/deviceApi';
import {theme} from '../theme/theme';
import AppBackground from '../components/AppBackground';
import PasswordInput from '../components/PasswordInput';
import {useTenant} from '../context/TenantContext';

type Props = NativeStackScreenProps<RootStackParamList, 'VolunteerLogin'>;

const VolunteerLoginScreen: React.FC<Props> = ({navigation}) => {
  const {setSession} = useVolunteerSession();
  const {tenant} = useTenant();
  const [volunteerId, setVolunteerId] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!volunteerId || !pin) {
      Alert.alert('Errore', 'Inserisci ID volontario e PIN.');
      return;
    }

    try {
      setLoading(true);
      const res = await loginVolunteer({
        tenantId: tenant?.tenantId,
        volunteerId,
        pin,
      });

      if (!res.ok) {
        Alert.alert('Login fallito', res.error);
        return;
      }

      await setSession({
        volunteerId: res.volunteerId,
        name: res.name,
        surname: res.surname,
        sessionId: res.sessionId,
        loginAt: res.loginAt,
      });

      navigation.replace('Home');

      // FCM in background: non bloccare il passaggio a Home (su alcuni device getToken resta appeso)
      void (async () => {
        try {
          await messaging().requestPermission();
          if (Platform.OS === 'android') {
            await notifee.requestPermission();
          }
          const token = await messaging().getToken();
          if (token) {
            await registerDevice({
              tenantId: tenant?.tenantId,
              volunteerId: res.volunteerId,
              deviceToken: token,
              platform: 'android',
            });
          }
        } catch {
          /* best-effort */
        }
      })();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Problema di connessione al server.';
      Alert.alert('Errore', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppBackground>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        <View>
        <Text style={styles.label}>Volunteer ID</Text>
        <TextInput
          style={styles.input}
          autoCapitalize="none"
          value={volunteerId}
          onChangeText={setVolunteerId}
          placeholder="Volunteer ID (es. rronco)"
          placeholderTextColor={theme.colors.textSecondary}
          editable={!loading}
        />
        <Text style={styles.label}>PIN</Text>
        <PasswordInput
          value={pin}
          onChangeText={setPin}
          placeholder="PIN"
          placeholderTextColor={theme.colors.textSecondary}
          editable={!loading}
          keyboardType="number-pad"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Login...' : 'Login'}</Text>
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
    paddingTop: 48,
    backgroundColor: 'transparent',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'flex-start',
  },
  label: {
    ...theme.typography.label,
    marginBottom: theme.spacing.small,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.box,
    paddingHorizontal: 14,
    marginBottom: theme.spacing.between,
    backgroundColor: theme.colors.surface,
    fontSize: 16,
  },
  button: {
    backgroundColor: theme.colors.purpleButton,
    paddingVertical: 14,
    borderRadius: theme.radius.button,
    alignItems: 'center',
    marginTop: theme.spacing.small,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: theme.colors.purpleButtonText,
    fontSize: 16,
    fontWeight: '700',
  },
});

export default VolunteerLoginScreen;
