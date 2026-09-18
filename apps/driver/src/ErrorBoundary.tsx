import { Component, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { COLORS, FONT } from './theme';

// Last-resort safety net: a render-phase error anywhere below this point
// (React itself has no async try/catch equivalent for that) would otherwise
// unmount the whole tree with no trace of what happened — which is
// indistinguishable, from the screen, from "briefly loads then does
// nothing." This makes whatever actually broke visible instead of silent.
interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <ScrollView contentContainerStyle={styles.wrap}>
          <Text style={styles.title}>حدث خطأ غير متوقع</Text>
          <Text style={styles.message}>{this.state.error.message}</Text>
          <Text style={styles.stack}>{this.state.error.stack}</Text>
        </ScrollView>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, backgroundColor: COLORS.white, padding: 20, paddingTop: 60 },
  title: { fontSize: 18, fontFamily: FONT.heavy, color: COLORS.danger, textAlign: 'right', marginBottom: 12 },
  message: { fontSize: 14, fontFamily: FONT.bold, color: COLORS.black, textAlign: 'right', marginBottom: 16 },
  stack: { fontSize: 11, fontFamily: FONT.regular, color: COLORS.textMuted, textAlign: 'left', writingDirection: 'ltr' }
});
