import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export default function CreateGameScreen() {
  const router = useRouter();
  const [teamHorizontal, setTeamHorizontal] = useState('');
  const [teamVertical, setTeamVertical] = useState('');
  const [hostName, setHostName] = useState('');
  const [picksPerTurn, setPicksPerTurn] = useState('1');
  const [draftStyle, setDraftStyle] = useState<'snake' | 'standard'>('snake');
  const [loading, setLoading] = useState(false);

  const createGame = async () => {
    if (!hostName.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }

    setLoading(true);
    try {
      const hostId = Math.random().toString(36).substring(7);
      
      const response = await fetch(`${BACKEND_URL}/api/games`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          host_id: hostId,
          host_name: hostName.trim(),
          team_horizontal: teamHorizontal.trim() || 'Team A',
          team_vertical: teamVertical.trim() || 'Team B',
          picks_per_turn: parseInt(picksPerTurn) || 1,
          draft_style: draftStyle,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create game');
      }

      const game = await response.json();
      
      // Store game info locally
      await AsyncStorage.setItem('currentGame', JSON.stringify({
        code: game.code,
        playerName: hostName.trim(),
        isHost: true,
        hostId: hostId,
      }));

      // Save to savedGames list
      const savedGamesStr = await AsyncStorage.getItem('savedGames');
      const savedGames = savedGamesStr ? JSON.parse(savedGamesStr) : [];
      const newSavedGame = {
        code: game.code,
        playerName: hostName.trim(),
        isHost: true,
        hostId: hostId,  // Store the hostId for rejoin
        teamH: teamHorizontal.trim() || 'Team A',
        teamV: teamVertical.trim() || 'Team B',
        joinedAt: new Date().toISOString(),
      };
      // Add to beginning of list, avoid duplicates
      const filteredGames = savedGames.filter((g: any) => g.code !== game.code);
      await AsyncStorage.setItem('savedGames', JSON.stringify([newSavedGame, ...filteredGames]));

      router.replace({ pathname: '/game', params: { code: game.code } });
    } catch (error) {
      console.error('Error creating game:', error);
      Alert.alert('Error', 'Failed to create game. Please try again.');
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
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>

          <View style={styles.header}>
            <Ionicons name="american-football" size={50} color="#4CAF50" />
            <Text style={styles.title}>Host Game</Text>
            <Text style={styles.subtitle}>Set up your sports squares game</Text>
          </View>

          <View style={styles.form}>
            {/* Host Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Your Name *</Text>
              <TextInput
                style={styles.input}
                value={hostName}
                onChangeText={setHostName}
                placeholder="Enter your name"
                placeholderTextColor="#666"
              />
            </View>

            {/* Team Names */}
            <View style={styles.sectionHeader}>
              <Ionicons name="people" size={20} color="#4CAF50" />
              <Text style={styles.sectionTitle}>Team Names</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Top Team (Horizontal)</Text>
              <TextInput
                style={styles.input}
                value={teamHorizontal}
                onChangeText={setTeamHorizontal}
                placeholder="e.g., Chiefs"
                placeholderTextColor="#666"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Left Team (Vertical)</Text>
              <TextInput
                style={styles.input}
                value={teamVertical}
                onChangeText={setTeamVertical}
                placeholder="e.g., Eagles"
                placeholderTextColor="#666"
              />
            </View>

            {/* Draft Settings */}
            <View style={styles.sectionHeader}>
              <Ionicons name="settings" size={20} color="#4CAF50" />
              <Text style={styles.sectionTitle}>Draft Settings</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Picks Per Turn</Text>
              <Text style={styles.labelHint}>How many squares can each player pick per turn?</Text>
              <View style={styles.picksRow}>
                {['1', '2', '3', '5', '10'].map((num) => (
                  <TouchableOpacity
                    key={num}
                    style={[
                      styles.pickOption,
                      picksPerTurn === num && styles.pickOptionSelected,
                    ]}
                    onPress={() => setPicksPerTurn(num)}
                  >
                    <Text style={[
                      styles.pickOptionText,
                      picksPerTurn === num && styles.pickOptionTextSelected,
                    ]}>{num}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Draft Style</Text>
              <Text style={styles.labelHint}>Snake reverses order each round</Text>
              <View style={styles.draftRow}>
                <TouchableOpacity
                  style={[
                    styles.draftOption,
                    draftStyle === 'snake' && styles.draftOptionSelected,
                  ]}
                  onPress={() => setDraftStyle('snake')}
                >
                  <Ionicons 
                    name="swap-horizontal" 
                    size={20} 
                    color={draftStyle === 'snake' ? '#fff' : '#888'} 
                  />
                  <Text style={[
                    styles.draftOptionText,
                    draftStyle === 'snake' && styles.draftOptionTextSelected,
                  ]}>Snake Draft</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.draftOption,
                    draftStyle === 'standard' && styles.draftOptionSelected,
                  ]}
                  onPress={() => setDraftStyle('standard')}
                >
                  <Ionicons 
                    name="repeat" 
                    size={20} 
                    color={draftStyle === 'standard' ? '#fff' : '#888'} 
                  />
                  <Text style={[
                    styles.draftOptionText,
                    draftStyle === 'standard' && styles.draftOptionTextSelected,
                  ]}>Standard</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.createButton, loading && styles.disabledButton]}
              onPress={createGame}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="rocket" size={24} color="#fff" />
                  <Text style={styles.createButtonText}>Create Game</Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.noteText}>
              You can randomize or set the player order after everyone joins.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  backButton: {
    marginBottom: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
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
    gap: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '500',
  },
  labelHint: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  picksRow: {
    flexDirection: 'row',
    gap: 10,
  },
  pickOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  pickOptionSelected: {
    backgroundColor: '#4CAF50',
    borderColor: '#fff',
  },
  pickOptionText: {
    color: '#888',
    fontSize: 16,
    fontWeight: '600',
  },
  pickOptionTextSelected: {
    color: '#fff',
  },
  draftRow: {
    flexDirection: 'row',
    gap: 12,
  },
  draftOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  draftOptionSelected: {
    backgroundColor: '#4CAF50',
    borderColor: '#fff',
  },
  draftOptionText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '500',
  },
  draftOptionTextSelected: {
    color: '#fff',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 12,
    marginTop: 12,
  },
  disabledButton: {
    opacity: 0.6,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  noteText: {
    color: '#888',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
  },
});
