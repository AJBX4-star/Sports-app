import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Ionicons name="grid" size={80} color="#4CAF50" />
          <Text style={styles.title}>Sports Squares</Text>
          <Text style={styles.subtitle}>The classic 10x10 football squares game</Text>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.createButton]}
            onPress={() => router.push('/create')}
          >
            <Ionicons name="add-circle" size={28} color="#fff" />
            <Text style={styles.buttonText}>Create Game</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.joinButton]}
            onPress={() => router.push('/join')}
          >
            <Ionicons name="enter" size={28} color="#fff" />
            <Text style={styles.buttonText}>Join Game</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.instructions}>
          <Text style={styles.instructionTitle}>How to Play:</Text>
          <Text style={styles.instructionText}>1. Host creates a game with team names</Text>
          <Text style={styles.instructionText}>2. Players join and select squares in turn</Text>
          <Text style={styles.instructionText}>3. Numbers randomize at the set time</Text>
          <Text style={styles.instructionText}>4. Host selects winning squares each quarter</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    marginTop: 8,
  },
  buttonContainer: {
    gap: 16,
    marginBottom: 48,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 12,
    gap: 12,
  },
  createButton: {
    backgroundColor: '#4CAF50',
  },
  joinButton: {
    backgroundColor: '#2196F3',
  },
  buttonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  instructions: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 20,
    borderRadius: 12,
  },
  instructionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  instructionText: {
    fontSize: 14,
    color: '#aaa',
    marginBottom: 8,
  },
});
