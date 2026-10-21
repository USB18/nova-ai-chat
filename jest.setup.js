/* eslint-env jest */
/* Native-module mocks so logic and UI can be tested in Node. */
// react-native-mmkv switches to an in-memory mock automatically under Jest, but
// importing it still loads Nitro's native registry, so stub that out.
jest.mock('react-native-nitro-modules', () => ({
  NitroModules: {
    createHybridObject: jest.fn(() => {
      throw new Error('Nitro native modules are not available in Jest');
    }),
  },
}));

jest.mock('react-native-keychain', () => ({
  ACCESSIBLE: {
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'AfterFirstUnlockThisDeviceOnly',
  },
  getGenericPassword: jest.fn(async () => false),
  setGenericPassword: jest.fn(async () => true),
  resetGenericPassword: jest.fn(async () => true),
}));

jest.mock('react-native-blob-util', () => ({
  __esModule: true,
  default: {
    fs: {
      dirs: { DocumentDir: '/docs', CacheDir: '/cache' },
      exists: jest.fn(async () => true),
      mkdir: jest.fn(async () => undefined),
      cp: jest.fn(async () => true),
      stat: jest.fn(async () => ({ size: 1000 })),
      readFile: jest.fn(async () => 'BASE64DATA'),
      unlink: jest.fn(async () => undefined),
    },
    fetch: jest.fn(),
    wrap: p => `RNFetchBlob-file://${p}`,
  },
}));

jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(async () => ({ didCancel: true })),
  launchCamera: jest.fn(async () => ({ didCancel: true })),
}));

jest.mock('react-native-nitro-sound', () => ({
  __esModule: true,
  default: {
    startRecorder: jest.fn(async p => p),
    stopRecorder: jest.fn(async () => '/cache/recordings/rec.aac'),
    addRecordBackListener: jest.fn(),
    removeRecordBackListener: jest.fn(),
  },
  AudioEncoderAndroidType: { AAC: 3 },
  AudioSourceAndroidType: { VOICE_RECOGNITION: 6 },
  OutputFormatAndroidType: { AAC_ADTS: 6 },
}));

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  const insets = { top: 0, bottom: 0, left: 0, right: 0 };
  return {
    SafeAreaProvider: ({ children }) => children,
    SafeAreaView: props => React.createElement(View, props),
    useSafeAreaInsets: () => insets,
  };
});
