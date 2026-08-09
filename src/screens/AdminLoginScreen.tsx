import React, {useState} from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Text,
  Alert,
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/RootNavigator';
import {loginAdmin} from '../services/adminApi';
import {
  AdminRole,
  normalizeAdminRole,
  useAdminSession,
} from '../context/AdminSessionContext';
import {theme} from '../theme/theme';
import AppBackground from '../components/AppBackground';
import PasswordInput from '../components/PasswordInput';
import {useTenant} from '../context/TenantContext';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminLogin'>;

const AdminLoginScreen: React.FC<Props> = ({navigation}) => {
  const {tenant} = useTenant();
  const {setSession: setAdminSession} = useAdminSession();
  const [adminId, setAdminId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!adminId || !password) {
      Alert.alert('Errore', 'Inserisci Admin ID e password.');
      return;
    }

    try {
      setLoading(true);
      const res = await loginAdmin({
        tenantId: tenant?.tenantId,
        adminId,
        password,
      });

      if (!res.ok) {
        Alert.alert('Login admin', res.error || 'Credenziali non valide.');
        return;
      }

      const role: AdminRole = normalizeAdminRole(res.role);
      setAdminSession({
        adminId: res.adminId,
        name: res.name,
        surname: res.surname,
        role,
      });

      if (role === 'viewer') {
        navigation.replace('OnlineVolunteers');
        return;
      }

      navigation.replace('AdminMenu');
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
        <Text style={styles.label}>Admin ID</Text>
        <TextInput
          style={styles.input}
          autoCapitalize="none"
          value={adminId}
          onChangeText={setAdminId}
          placeholder="Admin ID (es. admin_rr)"
          placeholderTextColor={theme.colors.textSecondary}
        />
        <Text style={styles.label}>Password</Text>
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
          <Text style={styles.buttonText}>
            {loading ? 'Login...' : 'Login'}
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

export default AdminLoginScreen;
