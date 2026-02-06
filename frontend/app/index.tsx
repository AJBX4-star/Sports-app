import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ImageBackground, Dimensions, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Sports themed background image - from environment or fallback
const HERO_IMAGE = process.env.EXPO_PUBLIC_HERO_IMAGE || 'https://customer-assets.emergentagent.com/job_6e1df73e-25d2-4f8e-bae0-a8029b2b9c4b/artifacts/6l9s6wqc_file_00000000fec8722f8b0dccf0e21824a4.png';

interface SavedGame {
  code: string;
  playerName: string;
  isHost: boolean;
  teamH: string;
  teamV: string;
  joinedAt: string;
}

export default function HomeScreen() {
  const router = useRouter();
  const [savedGames, setSavedGames] = useState<SavedGame[]>([]);
  const [showMyGames, setShowMyGames] = useState(false);

  useEffect(() => {
    loadSavedGames();
  }, []);

  const loadSavedGames = async () => {
    try {
      const stored = await AsyncStorage.getItem('savedGames');
      if (stored) {
        const games = JSON.parse(stored);
        setSavedGames(games);
      }
    } catch (error) {
      console.error('Error loading saved games:', error);
    }
  };

  const rejoinGame = async (game: SavedGame) => {
    // Store current game info before navigating
    await AsyncStorage.setItem('currentGame', JSON.stringify({
      code: game.code,
      playerName: game.playerName,
      isHost: game.isHost,
      hostId: game.isHost ? 'stored' : null,
    }));
    router.push(`/game?code=${game.code}`);
  };

  const deleteGame = async (gameCode: string) => {
    Alert.alert(
      'Remove Game',
      'Are you sure you want to remove this game from your list?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const updatedGames = savedGames.filter(g => g.code !== gameCode);
            setSavedGames(updatedGames);
            await AsyncStorage.setItem('savedGames', JSON.stringify(updatedGames));
          },
        },
      ]
    );
  };

  const clearAllGames = async () => {
    Alert.alert(
      'Clear All Games',
      'Are you sure you want to remove all saved games?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            setSavedGames([]);
            await AsyncStorage.setItem('savedGames', JSON.stringify([]));
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <ImageBackground
        source={{ uri: HERO_IMAGE }}
        style={styles.heroImage}
        resizeMode="cover"
      >
        <View style={styles.overlay}>
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.content}>
              {/* Logo Section */}
              <View style={styles.header}>
                <View style={styles.logoContainer}>
                  <Ionicons name="american-football" size={50} color="#4CAF50" />
                  <Ionicons name="grid" size={40} color="#fff" style={styles.gridIcon} />
                </View>
                <Text style={styles.title}>Sports Squares</Text>
                <Text style={styles.subtitle}>The Ultimate Football Squares Game</Text>
              </View>

              {/* Stats/Feature Pills */}
              <View style={styles.pillsContainer}>
                <View style={styles.pill}>
                  <Ionicons name="people" size={16} color="#4CAF50" />
                  <Text style={styles.pillText}>Multiplayer</Text>
                </View>
                <View style={styles.pill}>
                  <Ionicons name="trophy" size={16} color="#FFD700" />
                  <Text style={styles.pillText}>4 Quarters</Text>
                </View>
                <View style={styles.pill}>
                  <Ionicons name="grid" size={16} color="#2196F3" />
                  <Text style={styles.pillText}>100 Squares</Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[styles.button, styles.createButton]}
                  onPress={() => router.push('/create')}
                >
                  <Ionicons name="add-circle" size={28} color="#fff" />
                  <Text style={styles.buttonText}>Host Game</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.joinButton]}
                  onPress={() => router.push('/join')}
                >
                  <Ionicons name="enter" size={28} color="#fff" />
                  <Text style={styles.buttonText}>Join Game</Text>
                </TouchableOpacity>
              </View>

              {/* My Games Button */}
              {savedGames.length > 0 && (
                <TouchableOpacity
                  style={styles.myGamesButton}
                  onPress={() => setShowMyGames(true)}
                >
                  <Ionicons name="bookmark" size={20} color="#4CAF50" />
                  <Text style={styles.myGamesButtonText}>My Games ({savedGames.length})</Text>
                  <Ionicons name="chevron-forward" size={20} color="#888" />
                </TouchableOpacity>
              )}

              {/* Instructions */}
              <View style={styles.instructions}>
                <Text style={styles.instructionTitle}>How to Play</Text>
                <View style={styles.instructionItem}>
                  <View style={styles.stepNumber}><Text style={styles.stepNumberText}>1</Text></View>
                  <Text style={styles.instructionText}>Host creates game with team names</Text>
                </View>
                <View style={styles.instructionItem}>
                  <View style={styles.stepNumber}><Text style={styles.stepNumberText}>2</Text></View>
                  <Text style={styles.instructionText}>Players join and claim squares in turn</Text>
                </View>
                <View style={styles.instructionItem}>
                  <View style={styles.stepNumber}><Text style={styles.stepNumberText}>3</Text></View>
                  <Text style={styles.instructionText}>Numbers randomize when board is full</Text>
                </View>
                <View style={styles.instructionItem}>
                  <View style={styles.stepNumber}><Text style={styles.stepNumberText}>4</Text></View>
                  <Text style={styles.instructionText}>Winners selected each quarter</Text>
                </View>
              </View>

              {/* Footer */}
              <View style={styles.footer}>
                <Ionicons name="football" size={20} color="#4CAF50" />
                <Text style={styles.footerText}>Perfect for Game Day!</Text>
                <Ionicons name="football" size={20} color="#4CAF50" />
              </View>
            </View>
          </SafeAreaView>
        </View>
      </ImageBackground>

      {/* My Games Modal */}
      {showMyGames && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>My Games</Text>
              <TouchableOpacity onPress={() => setShowMyGames(false)}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.gamesList}>
              {savedGames.map((game) => (
                <View key={game.code} style={styles.savedGameCard}>
                  <TouchableOpacity 
                    style={styles.savedGameInfo}
                    onPress={() => {
                      setShowMyGames(false);
                      rejoinGame(game);
                    }}
                  >
                    <View style={styles.savedGameHeader}>
                      <Text style={styles.savedGameCode}>{game.code}</Text>
                      {game.isHost && (
                        <View style={styles.hostBadge}>
                          <Text style={styles.hostBadgeText}>HOST</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.savedGameTeams}>
                      {game.teamH} vs {game.teamV}
                    </Text>
                    <Text style={styles.savedGamePlayer}>
                      Playing as: {game.playerName}
                    </Text>
                    <Text style={styles.savedGameDate}>
                      Joined: {new Date(game.joinedAt).toLocaleDateString()}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteGameButton}
                    onPress={() => deleteGame(game.code)}
                  >
                    <Ionicons name="trash-outline" size={20} color="#ff4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>

            {savedGames.length > 1 && (
              <TouchableOpacity style={styles.clearAllButton} onPress={clearAllGames}>
                <Ionicons name="trash" size={18} color="#ff4444" />
                <Text style={styles.clearAllText}>Clear All Games</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  heroImage: {
    flex: 1,
    width: '100%',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(26, 26, 46, 0.85)',
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  gridIcon: {
    marginLeft: -15,
    marginTop: 20,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  subtitle: {
    fontSize: 16,
    color: '#aaa',
    marginTop: 4,
  },
  pillsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 32,
    flexWrap: 'wrap',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  pillText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  buttonContainer: {
    gap: 14,
    marginBottom: 32,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
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
    backgroundColor: 'rgba(255,255,255,0.08)',
    padding: 18,
    borderRadius: 12,
    marginBottom: 20,
  },
  instructionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 14,
    textAlign: 'center',
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 12,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  instructionText: {
    fontSize: 14,
    color: '#ccc',
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  footerText: {
    color: '#888',
    fontSize: 14,
  },
  // My Games styles
  myGamesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    padding: 14,
    borderRadius: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  myGamesButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
    marginLeft: 10,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    width: '100%',
    maxHeight: '80%',
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  gamesList: {
    maxHeight: 400,
  },
  savedGameCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  savedGameInfo: {
    flex: 1,
    padding: 14,
  },
  savedGameHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  savedGameCode: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  hostBadge: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  hostBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000',
  },
  savedGameTeams: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 4,
  },
  savedGamePlayer: {
    fontSize: 12,
    color: '#aaa',
    marginBottom: 2,
  },
  savedGameDate: {
    fontSize: 10,
    color: '#666',
  },
  deleteGameButton: {
    padding: 16,
    backgroundColor: 'rgba(255,68,68,0.1)',
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  clearAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  clearAllText: {
    color: '#ff4444',
    fontSize: 14,
  },
});
