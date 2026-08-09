import React from 'react';
import {ScrollView, StyleSheet, TouchableOpacity, Text, View} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/RootNavigator';
import {theme} from '../theme/theme';
import AppBackground from '../components/AppBackground';
import {useAdminSession} from '../context/AdminSessionContext';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminMenu'>;

const AdminMenuScreen: React.FC<Props> = ({navigation}) => {
  const {isViewer, session} = useAdminSession();

  React.useEffect(() => {
    if (isViewer) {
      navigation.replace('OnlineVolunteers');
    }
  }, [isViewer, navigation]);

  if (isViewer) {
    return null;
  }

  return (
    <AppBackground>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        <View>
        {session ? (
          <Text style={styles.adminLabel}>
            {session.name} {session.surname} · admin completo
          </Text>
        ) : null}

        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('OnlineVolunteers')}
          activeOpacity={0.8}>
          <Text style={styles.buttonText}>Visualizza volontari online</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('Alarm')}
          activeOpacity={0.8}>
          <Text style={styles.buttonText}>Invia allarme</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.buttonDanger]}
          onPress={() => navigation.navigate('ForceLogout')}
          activeOpacity={0.8}>
          <Text style={[styles.buttonText, styles.buttonDangerText]}>
            Forza logout volontari
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
    paddingTop: theme.spacing.screen * 1.5,
    backgroundColor: 'transparent',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'flex-start',
  },
  adminLabel: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: theme.spacing.between,
    textAlign: 'center',
  },
  button: {
    backgroundColor: theme.colors.purpleButton,
    paddingVertical: 18,
    paddingHorizontal: theme.spacing.screen,
    borderRadius: theme.radius.button,
    alignItems: 'center',
    marginBottom: theme.spacing.between,
  },
  buttonText: {
    color: theme.colors.purpleButtonText,
    fontSize: 16,
    fontWeight: '700',
  },
  buttonDanger: {
    backgroundColor: theme.colors.logoutActive,
  },
  buttonDangerText: {
    color: theme.colors.white,
  },
});

export default AdminMenuScreen;
