import React, {useState} from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/RootNavigator';
import {theme} from '../theme/theme';
import AppBackground from '../components/AppBackground';
import PasswordInput from '../components/PasswordInput';
import {loginTenant} from '../services/tenantApi';
import {useTenant} from '../context/TenantContext';

type Props = NativeStackScreenProps<RootStackParamList, 'TenantLogin'>;

const TenantLoginScreen: React.FC<Props> = ({navigation}) => {
  const [tenantId, setTenantId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const {tenant, setTenant} = useTenant();

  const handleLogin = async () => {
    if (!tenantId.trim() || !password) {
      Alert.alert('Errore', 'Inserisci codice ente e password.');
      return;
    }

    try {
      setLoading(true);
      const res = await loginTenant({
        tenantId: tenantId.trim(),
        password,
      });

      if (!res.ok) {
        Alert.alert('Login ente', res.error || 'Credenziali non valide.');
        return;
      }

      const previousTenantId = tenant?.tenantId?.trim();
      const nextTenantId = res.tenantId.trim();

      await setTenant({
        tenantId: nextTenantId,
        tenantName: res.tenantName,
        loginAt: res.loginAt,
      });

      if (previousTenantId && previousTenantId !== nextTenantId) {
        await AsyncStorage.removeItem(
          `allarmeapp:${previousTenantId}:volunteer_session`,
        );
      }

      navigation.replace('Home');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Problema di connessione al server.';
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
          <Text style={styles.title}>Accesso Ente</Text>
          <Text style={styles.label}>Codice ente</Text>
          <TextInput
            style={styles.input}
            autoCapitalize="none"
            value={tenantId}
            onChangeText={setTenantId}
            placeholder="Codice ente (es. ansmi_milano)"
            placeholderTextColor={theme.colors.textSecondary}
            editable={!loading}
          />
          <Text style={styles.label}>Password ente</Text>
          <PasswordInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={theme.colors.textSecondary}
            editable={!loading}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}>
            <Text style={styles.buttonText}>{loading ? 'Login...' : 'Accedi'}</Text>
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
  title: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 20,
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

export default TenantLoginScreen;
