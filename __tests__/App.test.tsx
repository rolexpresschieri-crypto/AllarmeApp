/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

jest.mock('@react-native-firebase/messaging', () => ({
  __esModule: true,
  default: () => ({
    onMessage: jest.fn(() => jest.fn()),
  }),
}));

jest.mock('@notifee/react-native', () => {
  const EventType = {ACTION_PRESS: 2};
  const AndroidImportance = {HIGH: 4};
  return {
    __esModule: true,
    default: {
      displayNotification: jest.fn(() => Promise.resolve()),
      createChannel: jest.fn(() => Promise.resolve()),
      onForegroundEvent: jest.fn(() => jest.fn()),
      cancelNotification: jest.fn(() => Promise.resolve()),
      onBackgroundEvent: jest.fn(),
      SDK_VERSION: '9.0.0',
    },
    EventType,
    AndroidImportance,
  };
});

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('../src/navigation/RootNavigator', () => {
  const React = require('react');
  return function MockRootNavigator() {
    return React.createElement(React.Fragment, null, 'Root');
  };
});

test('App renders without crashing', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
