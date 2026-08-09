import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import SplashScreen from '../screens/SplashScreen';
import TenantLoginScreen from '../screens/TenantLoginScreen';
import VolunteerLoginScreen from '../screens/VolunteerLoginScreen';
import AdminLoginScreen from '../screens/AdminLoginScreen';
import AdminMenuScreen from '../screens/AdminMenuScreen';
import OnlineVolunteersScreen from '../screens/OnlineVolunteersScreen';
import AlarmScreen from '../screens/AlarmScreen';
import ForceLogoutScreen from '../screens/ForceLogoutScreen';
import {theme} from '../theme/theme';

export type RootStackParamList = {
  Splash: undefined;
  TenantLogin: undefined;
  Home: undefined;
  VolunteerLogin: undefined;
  AdminLogin: undefined;
  AdminMenu: undefined;
  OnlineVolunteers: undefined;
  Alarm: undefined;
  ForceLogout: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const headerOptions = {
  headerStyle: {backgroundColor: theme.colors.background},
  headerTintColor: theme.colors.text,
  headerTitleStyle: {
    fontSize: theme.typography.screenTitle.fontSize,
    fontWeight: '800',
  },
};

const RootNavigator = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Splash"
        screenOptions={{
          headerBackVisible: true,
          ...headerOptions,
        }}>
        <Stack.Screen
          name="Splash"
          component={SplashScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="TenantLogin"
          component={TenantLoginScreen}
          options={{title: 'Accesso Ente'}}
        />
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{title: 'Allarme App'}}
        />
        <Stack.Screen
          name="VolunteerLogin"
          component={VolunteerLoginScreen}
          options={{title: 'Login Volontario'}}
        />
        <Stack.Screen
          name="AdminLogin"
          component={AdminLoginScreen}
          options={{title: 'Centrale Operativa'}}
        />
        <Stack.Screen
          name="AdminMenu"
          component={AdminMenuScreen}
          options={{title: 'Centrale Operativa'}}
        />
        <Stack.Screen
          name="OnlineVolunteers"
          component={OnlineVolunteersScreen}
          options={{title: 'Volontari online'}}
        />
        <Stack.Screen
          name="Alarm"
          component={AlarmScreen}
          options={{title: 'Invio allarme'}}
        />
        <Stack.Screen
          name="ForceLogout"
          component={ForceLogoutScreen}
          options={{title: 'Forza logout volontari'}}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default RootNavigator;

