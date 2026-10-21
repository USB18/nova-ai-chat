import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { AlertsOverlay, AlertsProvider } from './src/components/alerts/Alerts';
import { ChatScreen } from './src/screens/ChatScreen';
import { ChatProvider } from './src/state/ChatContext';

export default function App() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <AlertsProvider>
          <ChatProvider>
            <View style={styles.root}>
              <ChatScreen />
              <AlertsOverlay />
            </View>
          </ChatProvider>
        </AlertsProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
