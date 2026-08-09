import React, {useEffect, useRef, useState} from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useHeaderHeight} from '@react-navigation/elements';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/RootNavigator';
import {AlarmType, getAlarmTypes, sendAlarm} from '../services/alarmApi';
import {getOnlineVolunteers, OnlineVolunteerItem} from '../services/volunteerApi';
import {theme} from '../theme/theme';
import AppBackground from '../components/AppBackground';
import {useTenant} from '../context/TenantContext';
import {useAdminSession} from '../context/AdminSessionContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Alarm'>;

const AlarmScreen: React.FC<Props> = ({navigation}) => {
  const {tenant} = useTenant();
  const {isViewer} = useAdminSession();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const scrollRef = useRef<ScrollView>(null);
  const [keyboardInset, setKeyboardInset] = useState(0);

  useEffect(() => {
    if (isViewer) {
      navigation.replace('OnlineVolunteers');
    }
  }, [isViewer, navigation]);

  useEffect(() => {
    const showEvt =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const subShow = Keyboard.addListener(showEvt, e =>
      setKeyboardInset(e.endCoordinates?.height ?? 0),
    );
    const subHide = Keyboard.addListener(hideEvt, () => setKeyboardInset(0));
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  const scrollFocusedFieldIntoView = () => {
    requestAnimationFrame(() => {
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({animated: true});
      }, 160);
    });
  };
  const [alarmTypes, setAlarmTypes] = useState<AlarmType[]>([]);
  const [onlineVolunteers, setOnlineVolunteers] = useState<OnlineVolunteerItem[]>([]);
  const [selectedAlarm, setSelectedAlarm] = useState<AlarmType | null>(null);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [loadingRecipients, setLoadingRecipients] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [prov, setProv] = useState('');
  const [notes, setNotes] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [sendToAll, setSendToAll] = useState(true);
  const [selectedVolunteerIds, setSelectedVolunteerIds] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoadingTypes(true);
        setLoadingRecipients(true);
        setError(null);
        const [alarmRes, volunteersRes] = await Promise.all([
          getAlarmTypes({tenantId: tenant?.tenantId}),
          getOnlineVolunteers({tenantId: tenant?.tenantId}),
        ]);

        const sorted = [...alarmRes.alarmTypes].sort((a, b) =>
          (a.priority || '').toString().localeCompare(
            (b.priority || '').toString(),
            'it-IT',
            {numeric: true},
          ),
        );

        const sortedVolunteers = [...volunteersRes.volunteers].sort((a, b) =>
          `${(a.surname || '').toUpperCase()} ${(a.name || '').toUpperCase()}`.localeCompare(
            `${(b.surname || '').toUpperCase()} ${(b.name || '').toUpperCase()}`,
            'it-IT',
          ),
        );

        setAlarmTypes(sorted);
        setOnlineVolunteers(sortedVolunteers);
        setSelectedAlarm(sorted[0] ?? null);
      } catch (e) {
        setError(
          e instanceof Error ? e.message : 'Errore nel caricamento tipi di allarme',
        );
      } finally {
        setLoadingTypes(false);
        setLoadingRecipients(false);
      }
    };
    load();
  }, [tenant?.tenantId]);

  const toggleVolunteerSelection = (volunteerId: string) => {
    setSendToAll(false);
    setSelectedVolunteerIds(prev =>
      prev.includes(volunteerId)
        ? prev.filter(id => id !== volunteerId)
        : [...prev, volunteerId],
    );
  };

  const performSendAlarm = async () => {
    if (!selectedAlarm) return;
    try {
      setSending(true);
      const res = await sendAlarm({
        tenantId: tenant?.tenantId,
        alarmId: selectedAlarm.alarmId,
        label: selectedAlarm.label,
        description: selectedAlarm.description,
        priority: selectedAlarm.priority,
        address: address.trim(),
        city: city.trim(),
        prov: prov.trim(),
        notes: notes.trim(),
        recipientMode: sendToAll ? 'ALL' : 'SELECTED',
        recipientVolunteerIds: sendToAll ? [] : selectedVolunteerIds,
      });
      if (!res.ok) {
        Alert.alert('Invio allarme', res.error || 'Errore durante l’invio.');
        return;
      }
      Alert.alert('Invio allarme', 'Allarme inviato.');
      setAddress('');
      setCity('');
      setProv('');
      setNotes('');
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : 'Problema di connessione al server.';
      Alert.alert('Errore', msg);
    } finally {
      setSending(false);
    }
  };

  const handleSendAlarm = () => {
    if (!selectedAlarm) {
      Alert.alert('Invio allarme', 'Seleziona una tipologia di allarme.');
      return;
    }
    if (!sendToAll && selectedVolunteerIds.length === 0) {
      Alert.alert(
        'Invio allarme',
        'Seleziona almeno un volontario oppure scegli "TUTTI".',
      );
      return;
    }
    const cityTrim = city.trim();
    const provTrim = prov.trim();
    if (!cityTrim) {
      Alert.alert('Invio allarme', 'Inserisci la città (obbligatorio).');
      return;
    }
    if (!provTrim) {
      Alert.alert('Invio allarme', 'Inserisci la provincia (obbligatorio).');
      return;
    }

    const selectedNames = onlineVolunteers
      .filter(v => selectedVolunteerIds.includes(v.volunteerId))
      .map(v => `${v.surname} ${v.name}`);
    const recipientsText = sendToAll
      ? 'TUTTI i volontari online'
      : `${selectedVolunteerIds.length} volontari:\n- ${selectedNames.join('\n- ')}`;
    const addrLine = address.trim()
      ? `\nIndirizzo: ${address.trim()}`
      : '';
    const notesText = notes.trim() ? `\n\nNote:\n${notes.trim()}` : '';

    Alert.alert(
      'Conferma invio allarme',
      `Tipologia: ${selectedAlarm.label}\nCittà: ${cityTrim}\nProv.: ${provTrim}${addrLine}\nDestinatari: ${recipientsText}${notesText}`,
      [
        {text: 'Annulla', style: 'cancel'},
        {text: 'Invia', style: 'destructive', onPress: () => { performSendAlarm(); }},
      ],
    );
  };

  const scrollBottomPad =
    Math.max(theme.spacing.screen, insets.bottom) +
    32 +
    keyboardInset +
    (Platform.OS === 'android' ? 56 : 40);

  const keyboardVerticalOffset = Platform.OS === 'ios' ? headerHeight : 0;

  return (
    <AppBackground>
      <KeyboardAvoidingView
        style={styles.keyboardRoot}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={
          Platform.OS === 'ios' ? keyboardVerticalOffset : 0
        }>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            styles.container,
            {paddingBottom: scrollBottomPad},
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator
          nestedScrollEnabled>
      <Text style={styles.label}>Destinatari allarme</Text>
      {loadingRecipients ? (
        <View style={styles.dropdown}>
          <ActivityIndicator color={theme.colors.loginActive} />
          <Text style={styles.dropdownPlaceholder}>Caricamento volontari online...</Text>
        </View>
      ) : (
        <View style={styles.recipientsBox}>
          {onlineVolunteers.length === 0 ? (
            <Text style={styles.emptyRecipients}>
              Nessun volontario online. Puoi inviare comunque a "TUTTI".
            </Text>
          ) : (
            onlineVolunteers.map(item => {
              const isChecked = !sendToAll && selectedVolunteerIds.includes(item.volunteerId);
              return (
                <TouchableOpacity
                  key={item.volunteerId}
                  style={styles.checkRow}
                  onPress={() => toggleVolunteerSelection(item.volunteerId)}
                  activeOpacity={0.8}>
                  <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
                    {isChecked ? <Text style={styles.checkboxMark}>✓</Text> : null}
                  </View>
                  <Text style={styles.checkLabel}>
                    {item.surname} {item.name}
                  </Text>
                </TouchableOpacity>
              );
            })
          )}

          <TouchableOpacity
            style={[styles.checkRow, styles.allRow]}
            onPress={() => {
              setSendToAll(true);
              setSelectedVolunteerIds([]);
            }}
            activeOpacity={0.8}>
            <View style={[styles.checkbox, sendToAll && styles.checkboxChecked]}>
              {sendToAll ? <Text style={styles.checkboxMark}>✓</Text> : null}
            </View>
            <Text style={styles.allLabel}>TUTTI</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.label}>Tipologia di allarme</Text>
      {loadingTypes ? (
        <View style={styles.dropdown}>
          <ActivityIndicator color={theme.colors.loginActive} />
          <Text style={styles.dropdownPlaceholder}>Caricamento tipi di allarme...</Text>
        </View>
      ) : error ? (
        <View style={styles.dropdown}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <>
          <TouchableOpacity
            style={[styles.dropdown, dropdownOpen && styles.dropdownOpen]}
            onPress={() => setDropdownOpen(open => !open)}>
            <Text style={styles.dropdownValue}>
              {selectedAlarm ? selectedAlarm.label : 'Seleziona tipologia'}
            </Text>
            <Text style={styles.dropdownArrow}>
              {dropdownOpen ? '▲' : '▼'}
            </Text>
          </TouchableOpacity>
          {dropdownOpen &&
            alarmTypes.map(item => (
              <TouchableOpacity
                key={item.alarmId}
                style={[
                  styles.dropdownOption,
                  selectedAlarm?.alarmId === item.alarmId &&
                    styles.dropdownOptionSelected,
                ]}
                onPress={() => {
                  setSelectedAlarm(item);
                  setDropdownOpen(false);
                }}>
                <Text style={styles.dropdownOptionLabel}>{item.label}</Text>
                {item.description ? (
                  <Text style={styles.dropdownOptionDesc}>
                    {item.description}
                  </Text>
                ) : null}
              </TouchableOpacity>
            ))}
        </>
      )}

      <Text style={styles.label}>Indirizzo</Text>
      <TextInput
        style={styles.input}
        value={address}
        onChangeText={text => setAddress(text.toUpperCase())}
        onFocus={scrollFocusedFieldIntoView}
        placeholder="Via, numero civico (opzionale)"
        placeholderTextColor={theme.colors.textSecondary}
        autoCapitalize="characters"
      />

      <Text style={styles.label}>Città *</Text>
      <TextInput
        style={styles.input}
        value={city}
        onChangeText={text => setCity(text.toUpperCase())}
        onFocus={scrollFocusedFieldIntoView}
        placeholder="Obbligatorio"
        placeholderTextColor={theme.colors.textSecondary}
        autoCapitalize="characters"
      />

      <Text style={styles.label}>Provincia *</Text>
      <TextInput
        style={styles.input}
        value={prov}
        onChangeText={text => setProv(text.toUpperCase())}
        onFocus={scrollFocusedFieldIntoView}
        placeholder="Es. RM (obbligatorio)"
        placeholderTextColor={theme.colors.textSecondary}
        autoCapitalize="characters"
      />

      <Text style={styles.label}>Note aggiuntive</Text>
      <TextInput
        style={[styles.input, styles.notesInput]}
        value={notes}
        onChangeText={setNotes}
        onFocus={scrollFocusedFieldIntoView}
        placeholder="Note"
        placeholderTextColor={theme.colors.textSecondary}
        multiline
      />
      <TouchableOpacity
        style={[styles.button, sending && styles.buttonDisabled]}
        onPress={handleSendAlarm}
        disabled={sending}>
        <Text style={styles.buttonText}>
          {sending ? 'INVIO IN CORSO...' : 'INVIO ALLARME'}
        </Text>
      </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  keyboardRoot: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    padding: theme.spacing.screen,
    backgroundColor: 'transparent',
  },
  label: {
    ...theme.typography.label,
    marginBottom: theme.spacing.small,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.box,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: theme.spacing.between,
    backgroundColor: theme.colors.surface,
    fontSize: 16,
  },
  notesInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: theme.colors.logoutActive,
    paddingVertical: 14,
    borderRadius: theme.radius.button,
    alignItems: 'center',
    marginTop: theme.spacing.small,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  dropdown: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.box,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: theme.spacing.between,
    backgroundColor: theme.colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownOpen: {
    borderColor: theme.colors.loginActive,
  },
  dropdownPlaceholder: {
    color: theme.colors.textSecondary,
    marginLeft: 8,
  },
  dropdownValue: {
    fontSize: 16,
    color: theme.colors.text,
  },
  dropdownArrow: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginLeft: 8,
  },
  dropdownOption: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.box,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 8,
    backgroundColor: theme.colors.surface,
  },
  dropdownOptionSelected: {
    borderColor: theme.colors.loginActive,
  },
  dropdownOptionLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
  },
  dropdownOptionDesc: {
    marginTop: 2,
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  errorText: {
    color: theme.colors.danger,
  },
  recipientsBox: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.box,
    backgroundColor: theme.colors.surface,
    paddingVertical: 8,
    marginBottom: theme.spacing.between,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  allRow: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    marginTop: 2,
    paddingTop: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: theme.colors.loginActive,
    borderColor: theme.colors.loginActive,
  },
  checkboxMark: {
    color: theme.colors.white,
    fontWeight: '800',
  },
  checkLabel: {
    color: theme.colors.text,
    fontSize: 15,
    flexShrink: 1,
  },
  allLabel: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  emptyRecipients: {
    color: theme.colors.textSecondary,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
});

export default AlarmScreen;
