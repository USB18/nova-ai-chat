import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { logger } from '../lib/utils/logger';

interface State {
  error: Error | null;
}

/** Last-resort guard so a render bug shows a recovery screen instead of a white screen. */
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logger.error('Render error', error.message, info.componentStack);
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }
    return (
      <View style={styles.root}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.body}>{this.state.error.message}</Text>
        <Pressable
          onPress={() => this.setState({ error: null })}
          style={styles.button}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#0E0E10',
  },
  title: { color: '#F2F0EB', fontSize: 20, fontWeight: '700', marginBottom: 8 },
  body: { color: '#9A968F', textAlign: 'center', marginBottom: 20 },
  button: {
    backgroundColor: '#F5B544',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
  },
  buttonText: { color: '#0E0E10', fontWeight: '700' },
});
