import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
  Dimensions,
  Share,
  Modal,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { io, Socket } from 'socket.io-client';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Square {
  position: number;
  player_name: string | null;
  claimed: boolean;
}

interface Winner {
  quarter: number;
  position: number;
  player_name: string | null;
}

interface Game {
  id: string;
  code: string;
  host_id: string;
  team_horizontal: string;
  team_vertical: string;
  squares: Square[];
  numbers_top: number[] | null;
  numbers_left: number[] | null;
  numbers_randomized: boolean;
  winners: Winner[];
  current_turn: number;
  players: string[];
  is_active: boolean;
}

interface GameInfo {
  code: string;
  playerName: string;
  isHost: boolean;
  hostId: string | null;
}

export default function GameScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const [game, setGame] = useState<Game | null>(null);
  const [gameInfo, setGameInfo] = useState<GameInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [showHostMenu, setShowHostMenu] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [editTeamH, setEditTeamH] = useState('');
  const [editTeamV, setEditTeamV] = useState('');

  // Calculate grid size based on screen - make sure all 10x10 fits
  const gridPadding = 8;
  const labelSize = 30;
  const availableWidth = SCREEN_WIDTH - (gridPadding * 2) - labelSize - 10;
  const cellSize = Math.floor(availableWidth / 10);

  // Load game info and connect to socket
  useEffect(() => {
    loadGameInfo();
  }, []);

  useEffect(() => {
    if (code && gameInfo) {
      fetchGame();
      connectSocket();
    }
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [code, gameInfo]);

  const loadGameInfo = async () => {
    try {
      const storedInfo = await AsyncStorage.getItem('currentGame');
      if (storedInfo) {
        setGameInfo(JSON.parse(storedInfo));
      }
    } catch (error) {
      console.error('Error loading game info:', error);
    }
  };

  const connectSocket = () => {
    const newSocket = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      console.log('Socket connected');
      newSocket.emit('join_room', { code: code });
    });

    newSocket.on('square_claimed', (data) => {
      setGame(prev => prev ? { ...prev, squares: data.squares, current_turn: data.current_turn } : null);
    });

    newSocket.on('numbers_randomized', (data) => {
      setGame(prev => prev ? { 
        ...prev, 
        numbers_top: data.numbers_top, 
        numbers_left: data.numbers_left,
        numbers_randomized: true 
      } : null);
    });

    newSocket.on('winner_selected', (data) => {
      setGame(prev => prev ? { ...prev, winners: data.winners } : null);
    });

    newSocket.on('player_joined', (data) => {
      setGame(prev => prev ? { ...prev, players: data.players } : null);
    });

    newSocket.on('teams_updated', (data) => {
      setGame(prev => prev ? { 
        ...prev, 
        team_horizontal: data.team_horizontal, 
        team_vertical: data.team_vertical 
      } : null);
    });

    setSocket(newSocket);
  };

  const fetchGame = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/games/${code}`);
      if (!response.ok) {
        throw new Error('Game not found');
      }
      const data = await response.json();
      setGame(data);
    } catch (error) {
      console.error('Error fetching game:', error);
      Alert.alert('Error', 'Failed to load game');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const claimSquare = async (position: number) => {
    if (!game || !gameInfo) return;
    
    const square = game.squares[position];
    if (square.claimed) {
      Alert.alert('Square Taken', `This square is claimed by ${square.player_name}`);
      return;
    }

    // Check if it's this player's turn
    const currentPlayerName = game.players[game.current_turn];
    if (currentPlayerName !== gameInfo.playerName) {
      Alert.alert('Not Your Turn', `It's ${currentPlayerName}'s turn`);
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/games/${code}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          position: position,
          player_name: gameInfo.playerName,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to claim square');
    }
  };

  const randomizeNumbers = async () => {
    if (!game) return;
    
    Alert.alert(
      'Randomize Numbers',
      'This will randomly assign numbers 0-9 to both axes. This cannot be undone!',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Randomize',
          onPress: async () => {
            try {
              const response = await fetch(`${BACKEND_URL}/api/games/${code}/randomize`, {
                method: 'POST',
              });
              if (!response.ok) throw new Error('Failed to randomize');
            } catch (error) {
              Alert.alert('Error', 'Failed to randomize numbers');
            }
          },
        },
      ]
    );
  };

  const selectWinner = async (quarter: number) => {
    if (!game || !game.numbers_randomized) {
      Alert.alert('Numbers Not Set', 'Please randomize numbers first');
      return;
    }

    Alert.alert(
      `Select Q${quarter} Winner`,
      'Enter the score to find the winning square',
      [
        {
          text: 'Enter Scores',
          onPress: () => {
            // Show score input modal
            showScoreInput(quarter);
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const showScoreInput = (quarter: number) => {
    Alert.prompt(
      `${game?.team_horizontal} Score`,
      'Enter the last digit of the score (0-9)',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Next',
          onPress: (hScore) => {
            const h = parseInt(hScore || '0') % 10;
            Alert.prompt(
              `${game?.team_vertical} Score`,
              'Enter the last digit of the score (0-9)',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Find Winner',
                  onPress: async (vScore) => {
                    const v = parseInt(vScore || '0') % 10;
                    // Find the position
                    if (game?.numbers_top && game?.numbers_left) {
                      const col = game.numbers_top.indexOf(h);
                      const row = game.numbers_left.indexOf(v);
                      if (col !== -1 && row !== -1) {
                        const position = row * 10 + col;
                        await setWinnerPosition(quarter, position);
                      }
                    }
                  },
                },
              ],
              'plain-text'
            );
          },
        },
      ],
      'plain-text'
    );
  };

  const setWinnerPosition = async (quarter: number, position: number) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/games/${code}/winner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quarter, position }),
      });
      if (!response.ok) throw new Error('Failed to set winner');
    } catch (error) {
      Alert.alert('Error', 'Failed to set winner');
    }
  };

  const shareGame = async () => {
    try {
      await Share.share({
        message: `Join my Sports Squares game! Game Code: ${code}`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const updateTeams = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/games/${code}/teams`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          team_horizontal: editTeamH || game?.team_horizontal,
          team_vertical: editTeamV || game?.team_vertical,
        }),
      });
      if (!response.ok) throw new Error('Failed to update teams');
      setShowTeamModal(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to update team names');
    }
  };

  const isWinningSquare = (position: number) => {
    return game?.winners.some(w => w.position === position) || false;
  };

  const getWinningQuarters = (position: number): number[] => {
    return game?.winners.filter(w => w.position === position).map(w => w.quarter) || [];
  };

  const getSquareColor = (square: Square, position: number) => {
    if (isWinningSquare(position)) return '#4CAF50';
    if (square.claimed) {
      // Generate a color based on player name
      const colors = ['#E91E63', '#9C27B0', '#3F51B5', '#00BCD4', '#FF9800', '#795548', '#607D8B', '#F44336', '#2196F3', '#FFEB3B'];
      const index = game?.players.indexOf(square.player_name || '') || 0;
      return colors[index % colors.length];
    }
    return 'rgba(255,255,255,0.1)';
  };

  const getCurrentTurnPlayer = () => {
    if (!game) return '';
    return game.players[game.current_turn] || '';
  };

  const getClaimedCount = () => {
    if (!game) return 0;
    return game.squares.filter(s => s.claimed).length;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading game...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!game) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Game not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.gameCode}>Code: {code}</Text>
            <Text style={styles.playerCount}>{game.players.length} players</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity onPress={shareGame} style={styles.headerButton}>
              <Ionicons name="share" size={24} color="#fff" />
            </TouchableOpacity>
            {gameInfo?.isHost && (
              <TouchableOpacity onPress={() => setShowHostMenu(true)} style={styles.headerButton}>
                <Ionicons name="settings" size={24} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Turn Indicator */}
        <View style={styles.turnIndicator}>
          <Text style={styles.turnText}>
            {getClaimedCount() < 100 
              ? `${getCurrentTurnPlayer()}'s Turn` 
              : 'All squares claimed!'}
          </Text>
          <Text style={styles.claimedText}>{getClaimedCount()}/100 squares claimed</Text>
        </View>

        {/* Grid Container */}
        <View style={styles.gridContainer}>
          {/* Top Team Label */}
          <View style={[styles.teamLabelTop, { marginLeft: labelSize }]}>
            <TouchableOpacity onPress={() => gameInfo?.isHost && (setEditTeamH(game.team_horizontal), setEditTeamV(game.team_vertical), setShowTeamModal(true))}>
              <Text style={styles.teamLabel} numberOfLines={1}>{game.team_horizontal}</Text>
            </TouchableOpacity>
          </View>

          {/* Numbers Row */}
          <View style={styles.numbersRow}>
            <View style={[styles.cornerCell, { width: labelSize, height: labelSize }]} />
            {Array.from({ length: 10 }).map((_, i) => (
              <View key={`top-${i}`} style={[styles.numberCell, { width: cellSize, height: labelSize }]}>
                <Text style={styles.numberText}>
                  {game.numbers_randomized && game.numbers_top ? game.numbers_top[i] : '?'}
                </Text>
              </View>
            ))}
          </View>

          {/* Grid with Left Labels */}
          <View style={styles.gridRow}>
            {/* Left Team Label */}
            <View style={[styles.teamLabelLeft, { width: labelSize }]}>
              <TouchableOpacity onPress={() => gameInfo?.isHost && (setEditTeamH(game.team_horizontal), setEditTeamV(game.team_vertical), setShowTeamModal(true))}>
                <Text style={[styles.teamLabel, styles.verticalText]} numberOfLines={1}>
                  {game.team_vertical}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Numbers Column + Grid */}
            <View>
              {Array.from({ length: 10 }).map((_, row) => (
                <View key={`row-${row}`} style={styles.row}>
                  <View style={[styles.numberCell, { width: labelSize, height: cellSize }]}>
                    <Text style={styles.numberText}>
                      {game.numbers_randomized && game.numbers_left ? game.numbers_left[row] : '?'}
                    </Text>
                  </View>
                  {Array.from({ length: 10 }).map((_, col) => {
                    const position = row * 10 + col;
                    const square = game.squares[position];
                    const winningQuarters = getWinningQuarters(position);
                    return (
                      <TouchableOpacity
                        key={`cell-${position}`}
                        style={[
                          styles.cell,
                          { 
                            width: cellSize, 
                            height: cellSize,
                            backgroundColor: getSquareColor(square, position),
                          },
                          isWinningSquare(position) && styles.winningCell,
                        ]}
                        onPress={() => claimSquare(position)}
                        activeOpacity={0.7}
                      >
                        {square.claimed && (
                          <Text style={styles.cellText} numberOfLines={1}>
                            {square.player_name?.substring(0, 3)}
                          </Text>
                        )}
                        {winningQuarters.length > 0 && (
                          <Text style={styles.winnerBadge}>
                            Q{winningQuarters.join(',')}
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Players List */}
        <View style={styles.playersSection}>
          <Text style={styles.sectionTitle}>Players</Text>
          <View style={styles.playersList}>
            {game.players.map((player, index) => {
              const colors = ['#E91E63', '#9C27B0', '#3F51B5', '#00BCD4', '#FF9800', '#795548', '#607D8B', '#F44336', '#2196F3', '#FFEB3B'];
              const isCurrentTurn = game.current_turn === index;
              return (
                <View 
                  key={player} 
                  style={[
                    styles.playerChip,
                    { backgroundColor: colors[index % colors.length] },
                    isCurrentTurn && styles.currentTurnChip,
                  ]}
                >
                  <Text style={styles.playerChipText}>{player}</Text>
                  {isCurrentTurn && <Ionicons name="arrow-forward" size={14} color="#fff" />}
                </View>
              );
            })}
          </View>
        </View>

        {/* Winners Section */}
        {game.winners.length > 0 && (
          <View style={styles.winnersSection}>
            <Text style={styles.sectionTitle}>Winners</Text>
            {game.winners.map((winner) => (
              <View key={winner.quarter} style={styles.winnerRow}>
                <Text style={styles.winnerQuarter}>Q{winner.quarter}</Text>
                <Text style={styles.winnerName}>{winner.player_name || 'Unclaimed'}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Host Menu Modal */}
      <Modal
        visible={showHostMenu}
        transparent
        animationType="slide"
        onRequestClose={() => setShowHostMenu(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Host Controls</Text>
            
            <TouchableOpacity
              style={[styles.modalButton, game.numbers_randomized && styles.disabledButton]}
              onPress={() => {
                setShowHostMenu(false);
                randomizeNumbers();
              }}
              disabled={game.numbers_randomized}
            >
              <Ionicons name="shuffle" size={24} color="#fff" />
              <Text style={styles.modalButtonText}>
                {game.numbers_randomized ? 'Numbers Already Set' : 'Randomize Numbers'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => {
                setShowHostMenu(false);
                setEditTeamH(game.team_horizontal);
                setEditTeamV(game.team_vertical);
                setShowTeamModal(true);
              }}
            >
              <Ionicons name="create" size={24} color="#fff" />
              <Text style={styles.modalButtonText}>Edit Team Names</Text>
            </TouchableOpacity>

            <Text style={styles.quarterTitle}>Select Quarter Winners</Text>
            <View style={styles.quarterButtons}>
              {[1, 2, 3, 4].map((q) => (
                <TouchableOpacity
                  key={q}
                  style={[
                    styles.quarterButton,
                    game.winners.find(w => w.quarter === q) && styles.quarterButtonActive,
                  ]}
                  onPress={() => {
                    setShowHostMenu(false);
                    selectWinner(q);
                  }}
                >
                  <Text style={styles.quarterButtonText}>Q{q}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowHostMenu(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Edit Team Names Modal */}
      <Modal
        visible={showTeamModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTeamModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Team Names</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Top Team (Horizontal)</Text>
              <TextInput
                style={styles.modalInput}
                value={editTeamH}
                onChangeText={setEditTeamH}
                placeholder="Team name"
                placeholderTextColor="#666"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Left Team (Vertical)</Text>
              <TextInput
                style={styles.modalInput}
                value={editTeamV}
                onChangeText={setEditTeamV}
                placeholder="Team name"
                placeholderTextColor="#666"
              />
            </View>

            <TouchableOpacity style={styles.saveButton} onPress={updateTeams}>
              <Text style={styles.saveButtonText}>Save Changes</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowTeamModal(false)}
            >
              <Text style={styles.closeButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 16,
  },
  errorText: {
    color: '#f44336',
    fontSize: 18,
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerCenter: {
    alignItems: 'center',
  },
  gameCode: {
    color: '#4CAF50',
    fontSize: 18,
    fontWeight: 'bold',
  },
  playerCount: {
    color: '#888',
    fontSize: 12,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    padding: 4,
  },
  turnIndicator: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  turnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  claimedText: {
    color: '#888',
    fontSize: 14,
    marginTop: 4,
  },
  gridContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  teamLabelTop: {
    marginBottom: 8,
  },
  teamLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  teamLabelLeft: {
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  verticalText: {
    transform: [{ rotate: '-90deg' }],
    width: 100,
  },
  numbersRow: {
    flexDirection: 'row',
  },
  gridRow: {
    flexDirection: 'row',
  },
  row: {
    flexDirection: 'row',
  },
  cornerCell: {
    backgroundColor: 'transparent',
  },
  numberCell: {
    backgroundColor: 'rgba(76, 175, 80, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  numberText: {
    color: '#4CAF50',
    fontWeight: 'bold',
    fontSize: 14,
  },
  cell: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  winningCell: {
    borderWidth: 2,
    borderColor: '#fff',
  },
  cellText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  winnerBadge: {
    color: '#fff',
    fontSize: 8,
    fontWeight: 'bold',
    position: 'absolute',
    bottom: 1,
  },
  playersSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  playersList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  playerChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  currentTurnChip: {
    borderWidth: 2,
    borderColor: '#fff',
  },
  playerChipText: {
    color: '#fff',
    fontWeight: '500',
  },
  winnersSection: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    padding: 16,
    borderRadius: 12,
  },
  winnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  winnerQuarter: {
    color: '#4CAF50',
    fontWeight: 'bold',
    fontSize: 16,
    width: 40,
  },
  winnerName: {
    color: '#fff',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  modalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    gap: 12,
  },
  disabledButton: {
    backgroundColor: '#666',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  quarterTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 12,
  },
  quarterButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  quarterButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  quarterButtonActive: {
    borderColor: '#4CAF50',
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
  },
  quarterButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  closeButton: {
    padding: 16,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#888',
    fontSize: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    color: '#fff',
    marginBottom: 8,
    fontSize: 14,
  },
  modalInput: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
