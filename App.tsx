/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import {useEffect} from 'react';
import {Platform} from 'react-native';
import {StatusBar, useColorScheme} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import messaging from '@react-native-firebase/messaging';
import notifee from '@notifee/react-native';
import {VolunteerSessionProvider} from './src/context/VolunteerSessionContext';
import {TenantProvider} from './src/context/TenantContext';
import {AdminSessionProvider} from './src/context/AdminSessionContext';
import {LastAlarmNotificationProvider} from './src/context/LastAlarmNotificationContext';
import RootNavigator from './src/navigation/RootNavigator';
import {
  cancelAlarmIfStopPressed,
  displayAndroidAlarmNotification,
} from './src/services/alarmNotification';

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const unsubMessaging = messaging().onMessage(async remoteMessage => {
      await displayAndroidAlarmNotification(remoteMessage);
    });
    const unsubForeground = notifee.onForegroundEvent(event => {
      void cancelAlarmIfStopPressed(event);
    });
    return () => {
      unsubMessaging();
      unsubForeground();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <TenantProvider>
        <VolunteerSessionProvider>
          <LastAlarmNotificationProvider>
            <AdminSessionProvider>
              <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
              <RootNavigator />
            </AdminSessionProvider>
          </LastAlarmNotificationProvider>
        </VolunteerSessionProvider>
      </TenantProvider>
    </SafeAreaProvider>
  );
}

export default App;
