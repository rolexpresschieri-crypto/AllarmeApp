import React from 'react';
import {ImageBackground, StyleSheet, View} from 'react-native';

type Props = {
  children: React.ReactNode;
};

const AppBackground: React.FC<Props> = ({children}) => {
  return (
    <ImageBackground
      source={require('../assets/dispatch_bg_photo.jpg')}
      style={styles.background}
      imageStyle={styles.image}>
      <View style={styles.overlay}>{children}</View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: '#ede7f0',
  },
  image: {
    resizeMode: 'cover',
    opacity: 0.1,
  },
  overlay: {
    flex: 1,
  },
});

export default AppBackground;
