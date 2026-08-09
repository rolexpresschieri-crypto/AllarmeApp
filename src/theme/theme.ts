/**
 * Tema grafico Allarme App – da mockup screen_01..06.
 * Sfondo lavanda/viola chiaro, pulsanti: verde (Log-in attivo), grigio (disabilitato), rosso (Log-out attivo), nero (Admin).
 */
export const theme = {
  colors: {
    background: '#ede7f0',
    backgroundScreen: '#f3eef6',
    surface: '#ffffff',
    surfaceLogged: '#009246',
    border: '#e0e0e0',
    borderLogged: '#009246',
    text: '#212121',
    textSecondary: '#616161',
    textLogged: '#ffffff',
    textOnGreen: '#ffffff',
    primary: '#1565c0',
    notificationActive: '#0d47a1',
    loginActive: '#009246',
    loginDisabled: '#e0e0e0',
    logoutDisabled: '#e0e0e0',
    logoutDisabledText: '#616161',
    logoutActive: '#CE2B37',
    admin: '#212121',
    danger: '#CE2B37',
    white: '#ffffff',
    purple: '#7e57c2',
    purpleLight: '#b39ddb',
    purpleButton: '#d1c4e9',
    purpleButtonText: '#4527a0',
    logoBorderRed: '#CE2B37',
    logoBorderGreen: '#009246',
  },
  typography: {
    appTitle: {
      fontSize: 20,
      fontWeight: '600' as const,
      textAlign: 'center' as const,
      color: '#212121',
    },
    trackingTitle: {
      fontSize: 18,
      fontWeight: '800' as const,
      textAlign: 'center' as const,
      color: '#212121',
    },
    screenTitle: {
      fontSize: 20,
      fontWeight: '600' as const,
    },
    label: {
      fontSize: 14,
      color: '#616161',
    },
    body: {
      fontSize: 16,
      color: '#212121',
    },
  },
  spacing: {
    screen: 20,
    between: 16,
    small: 8,
  },
  radius: {
    button: 12,
    box: 10,
  },
};
