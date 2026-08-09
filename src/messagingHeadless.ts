/**
 * Deve essere il primo modulo caricato da index.js (prima di App).
 * Registra FCM in background e gli eventi Notifee senza dipendere dall'albero React.
 */
import messaging from '@react-native-firebase/messaging';
import notifee from '@notifee/react-native';
import {
  cancelAlarmIfStopPressed,
  displayAndroidAlarmNotification,
} from './services/alarmNotification';

notifee.onBackgroundEvent(event => {
  void cancelAlarmIfStopPressed(event);
});

messaging().setBackgroundMessageHandler(async remoteMessage => {
  await displayAndroidAlarmNotification(remoteMessage);
});
