import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export default function JoinGameScreen() {
  const router = useRouter();
  const [gameCode, setGameCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [loading, setLoading] = useState(false);

  const joinGame = async () => {
    if (!gameCode.trim()) {
      Alert.alert('Error', 'Please enter a game code');
      return;
    }
    if (!playerName.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/games/${gameCode.toUpperCase()}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: gameCode.toUpperCase(),
          player_name: playerName.trim(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to join game');
      }

      const game = await response.json();
      
      // Store game info locally
      await AsyncStorage.setItem('currentGame', JSON.stringify({
        code: game.code,
        playerName: playerName.trim(),
        isHost: false,
        hostId: null,
      }));

      // Save to savedGames list
      const savedGamesStr = await AsyncStorage.getItem('savedGames');
      const savedGames = savedGamesStr ? JSON.parse(savedGamesStr) : [];
      const newSavedGame = {
        code: game.code,
        playerName: playerName.trim(),
        isHost: false,
        teamH: game.team_horizontal || 'Team A',
        teamV: game.team_vertical || 'Team B',
        joinedAt: new Date().toISOString(),
      };
      // Add to beginning of list, avoid duplicates
      const filteredGames = savedGames.filter((g: any) => g.code !== game.code);
      await AsyncStorage.setItem('savedGames', JSON.stringify([newSavedGame, ...filteredGames]));

      router.replace({ pathname: '/game', params: { code: game.code } });
    } catch (error: any) {
      console.error('Error joining game:', error);
      Alert.alert('Error', error.message || 'Failed to join game. Please check the code and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.content}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>

          <View style={styles.header}>
            <Ionicons name="enter" size={60} color="#2196F3" />
            <Text style={styles.title}>Join Game</Text>
            <Text style={styles.subtitle}>Enter the game code to join</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Your Name</Text>
              <TextInput
                style={styles.input}
                value={playerName}
                onChangeText={setPlayerName}
                placeholder="Enter your name"
                placeholderTextColor="#666"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Game Code</Text>
              <TextInput
                style={[styles.input, styles.codeInput]}
                value={gameCode}
                onChangeText={(text) => setGameCode(text.toUpperCase())}
                placeholder="XXXXXX"
                placeholderTextColor="#666"
                autoCapitalize="characters"
                maxLength={6}
              />
            </View>

            <TouchableOpacity
              style={[styles.joinButton, loading && styles.disabledButton]}
              onPress={joinGame}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="arrow-forward-circle" size={24} color="#fff" />
                  <Text style={styles.joinButtonText}>Join Game</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
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
  },
  backButton: {
    marginBottom: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    marginTop: 8,
  },
  form: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  codeInput: {
    fontSize: 24,
    textAlign: 'center',
    letterSpacing: 8,
    fontWeight: 'bold',
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2196F3',
    paddingVertical: 18,
    borderRadius: 12,
    gap: 12,
    marginTop: 16,
  },
  disabledButton: {
    opacity: 0.6,
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
