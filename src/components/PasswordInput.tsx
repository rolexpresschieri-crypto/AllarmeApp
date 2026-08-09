import React, {useState} from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  TextInputProps,
  StyleProp,
  ViewStyle,
} from 'react-native';
import {theme} from '../theme/theme';

type Props = Omit<TextInputProps, 'secureTextEntry'> & {
  containerStyle?: StyleProp<ViewStyle>;
};

const PasswordInput: React.FC<Props> = ({
  containerStyle,
  style,
  editable = true,
  ...rest
}) => {
  const [visible, setVisible] = useState(false);

  return (
    <View style={[styles.wrap, containerStyle]}>
      <TextInput
        {...rest}
        editable={editable}
        style={[styles.input, style]}
        secureTextEntry={!visible}
      />
      <TouchableOpacity
        style={styles.eyeButton}
        onPress={() => setVisible(current => !current)}
        disabled={editable === false}
        accessibilityLabel={visible ? 'Nascondi password' : 'Mostra password'}
        accessibilityRole="button"
        hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
        <View style={styles.eyeIconWrap}>
          <Text style={[styles.eyeIcon, editable === false && styles.eyeIconDisabled]}>
            👁
          </Text>
          {visible ? <View style={styles.eyeSlash} /> : null}
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    marginBottom: theme.spacing.between,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.box,
    paddingLeft: 14,
    paddingRight: 48,
    backgroundColor: theme.colors.surface,
    fontSize: 16,
    color: theme.colors.text,
  },
  eyeButton: {
    position: 'absolute',
    right: 0,
    top: 0,
    height: 48,
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyeIconWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyeIcon: {
    fontSize: 20,
    lineHeight: 22,
  },
  eyeIconDisabled: {
    opacity: 0.4,
  },
  eyeSlash: {
    position: 'absolute',
    width: 22,
    height: 2,
    backgroundColor: theme.colors.textSecondary,
    borderRadius: 1,
    transform: [{rotate: '-40deg'}],
  },
});

export default PasswordInput;
