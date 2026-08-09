import React, {useCallback, useEffect, useState} from 'react';
import {
  View,
  StyleSheet,
  Text,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/RootNavigator';
import {theme} from '../theme/theme';
import {getOnlineVolunteers, OnlineVolunteerItem} from '../services/volunteerApi';
import AppBackground from '../components/AppBackground';
import {useTenant} from '../context/TenantContext';
import {useAdminSession} from '../context/AdminSessionContext';

type Props = NativeStackScreenProps<RootStackParamList, 'OnlineVolunteers'>;

/** Normalizza data/ora da foglio (es. 0.44.47 -> 00.44.47) per display. */
function formatLoginTime(lastSeenAt: string): string {
  if (!lastSeenAt) return '–';
  const parts = lastSeenAt.trim().split(' ');
  if (parts.length !== 2) return lastSeenAt;
  const timePart = parts[1];
  const seg = timePart.split('.');
  if (seg.length >= 1 && seg[0].length === 1) seg[0] = '0' + seg[0];
  return parts[0] + ' ' + seg.join('.');
}

const OnlineVolunteersScreen: React.FC<Props> = () => {
  const {tenant} = useTenant();
  const {isViewer, session: adminSession} = useAdminSession();
  const [list, setList] = useState<OnlineVolunteerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await getOnlineVolunteers({tenantId: tenant?.tenantId});
      const sorted = [...res.volunteers].sort((a, b) => {
        const an = `${(a.surname || '').toString().toUpperCase()} ${(a.name || '')
          .toString()
          .toUpperCase()}`;
        const bn = `${(b.surname || '').toString().toUpperCase()} ${(b.name || '')
          .toString()
          .toUpperCase()}`;
        if (an < bn) {
          return -1;
        }
        if (an > bn) {
          return 1;
        }
        return 0;
      });
      setList(sorted);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore di connessione');
      setList([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tenant?.tenantId]);

  useEffect(() => {
    load();
  }, [load]);

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
        {isViewer && adminSession ? (
          <Text style={styles.viewerLabel}>
            Accesso sola lettura · {adminSession.name} {adminSession.surname}
          </Text>
        ) : null}
        {error ? (
          <Text style={styles.error}>{error}</Text>
        ) : null}
        <FlatList
          data={list}
          keyExtractor={item => item.volunteerId}
          renderItem={({item}) => (
            <View style={styles.row}>
              <View style={styles.dot} />
              <View>
                <Text style={styles.name}>
                  {item.surname} {item.name}
                </Text>
                <Text style={styles.subtitle}>
                  Login: {formatLoginTime(item.lastSeenAt)}
                </Text>
              </View>
            </View>
          )}
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
      </View>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: theme.spacing.screen,
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
  viewerLabel: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: theme.spacing.small,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: theme.colors.loginActive,
    marginRight: 14,
  },
  name: {
    fontWeight: '700',
    fontSize: 16,
    color: theme.colors.text,
    marginBottom: 2,
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: 14,
  },
  empty: {
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.screen,
  },
});

export default OnlineVolunteersScreen;
