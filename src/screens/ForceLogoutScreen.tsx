import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/RootNavigator';
import AppBackground from '../components/AppBackground';
import {theme} from '../theme/theme';
import {
  forceLogoutVolunteers,
  getOnlineVolunteers,
  OnlineVolunteerItem,
} from '../services/volunteerApi';
import {useTenant} from '../context/TenantContext';
import {useAdminSession} from '../context/AdminSessionContext';

type Props = NativeStackScreenProps<RootStackParamList, 'ForceLogout'>;

const ForceLogoutScreen: React.FC<Props> = ({navigation}) => {
  const {tenant} = useTenant();
  const {isViewer} = useAdminSession();
  const [list, setList] = useState<OnlineVolunteerItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isViewer) {
      navigation.replace('OnlineVolunteers');
    }
  }, [isViewer, navigation]);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await getOnlineVolunteers({tenantId: tenant?.tenantId});
      const sorted = [...res.volunteers].sort((a, b) =>
        `${(a.surname || '').toUpperCase()} ${(a.name || '').toUpperCase()}`.localeCompare(
          `${(b.surname || '').toUpperCase()} ${(b.name || '').toUpperCase()}`,
          'it-IT',
        ),
      );
      setList(sorted);
      setSelectedIds(prev => prev.filter(id => sorted.some(v => v.volunteerId === id)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore di connessione');
      setList([]);
      setSelectedIds([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tenant?.tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleSelection = (volunteerId: string) => {
    setSelectedIds(prev =>
      prev.includes(volunteerId)
        ? prev.filter(id => id !== volunteerId)
        : [...prev, volunteerId],
    );
  };

  const handleForceLogout = () => {
    if (selectedIds.length === 0) {
      Alert.alert('Forza logout', 'Seleziona almeno un volontario online.');
      return;
    }

    const selectedNames = list
      .filter(v => selectedIds.includes(v.volunteerId))
      .map(v => `${v.surname} ${v.name}`);

    Alert.alert(
      'Conferma forza logout',
      `Vuoi forzare il logout di ${selectedIds.length} volontari?\n\n- ${selectedNames.join(
        '\n- ',
      )}`,
      [
        {text: 'Annulla', style: 'cancel'},
        {
          text: 'Conferma logout',
          style: 'destructive',
          onPress: async () => {
            try {
              setSubmitting(true);
              const res = await forceLogoutVolunteers({
                tenantId: tenant?.tenantId,
                volunteerIds: selectedIds,
              });
              if (!res.ok) {
                const backendMsg =
                  res.error?.toUpperCase().includes('UNKNOWN PATH')
                    ? 'Endpoint backend non aggiornato: aggiungi/deploya path=forceLogoutVolunteers su Apps Script.'
                    : res.error || 'Errore durante il force logout.';
                Alert.alert(
                  'Forza logout',
                  backendMsg,
                );
                return;
              }
              Alert.alert(
                'Forza logout',
                `Logout forzato completato (${res.count || selectedIds.length}).`,
              );
              setSelectedIds([]);
              await load(true);
            } catch (e) {
              const msg =
                e instanceof Error ? e.message : 'Problema di connessione al server.';
              Alert.alert('Errore', msg);
            } finally {
              setSubmitting(false);
            }
          },
        },
      ],
    );
  };

  if (loading && list.length === 0) {
    return (
      <AppBackground>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.loginActive} />
          <Text style={styles.message}>Caricamento volontari online...</Text>
        </View>
      </AppBackground>
    );
  }

  return (
    <AppBackground>
      <View style={styles.container}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <FlatList
          data={list}
          keyExtractor={item => item.volunteerId}
          renderItem={({item}) => {
            const checked = selectedIds.includes(item.volunteerId);
            return (
              <TouchableOpacity
                style={styles.row}
                activeOpacity={0.8}
                onPress={() => toggleSelection(item.volunteerId)}>
                <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                  {checked ? <Text style={styles.checkboxMark}>✓</Text> : null}
                </View>
                <View style={styles.info}>
                  <Text style={styles.name}>
                    {item.surname} {item.name}
                  </Text>
                  <Text style={styles.sub}>ID: {item.volunteerId}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.empty}>Nessun volontario online</Text>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              colors={[theme.colors.loginActive]}
            />
          }
        />
        <TouchableOpacity
          style={[
            styles.button,
            (selectedIds.length === 0 || submitting) && styles.buttonDisabled,
          ]}
          disabled={selectedIds.length === 0 || submitting}
          onPress={handleForceLogout}
          activeOpacity={0.8}>
          <Text style={styles.buttonText}>
            {submitting
              ? 'LOGOUT IN CORSO...'
              : `FORZA LOGOUT (${selectedIds.length})`}
          </Text>
        </TouchableOpacity>
      </View>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: theme.spacing.screen,
    paddingBottom: 28,
    backgroundColor: 'transparent',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    padding: theme.spacing.screen,
  },
  message: {
    marginTop: theme.spacing.between,
    color: theme.colors.textSecondary,
  },
  error: {
    color: theme.colors.danger,
    marginBottom: theme.spacing.small,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.box,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: theme.colors.logoutActive,
    borderColor: theme.colors.logoutActive,
  },
  checkboxMark: {
    color: theme.colors.white,
    fontWeight: '800',
  },
  info: {
    flex: 1,
  },
  name: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  sub: {
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  empty: {
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.screen,
  },
  button: {
    backgroundColor: theme.colors.logoutActive,
    borderRadius: theme.radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginTop: 8,
    marginBottom: 18,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: theme.colors.white,
    fontWeight: '700',
    fontSize: 16,
  },
});

export default ForceLogoutScreen;
