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
  Platform,
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

// Cell size calculation - fit 10 cells plus labels in screen width
const CELL_SIZE = Math.floor((SCREEN_WIDTH - 50) / 11);
const LABEL_SIZE = 20;

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
  const [showWinnerInput, setShowWinnerInput] = useState(false);
  const [selectedQuarter, setSelectedQuarter] = useState(1);
  const [scoreH, setScoreH] = useState('');
  const [scoreV, setScoreV] = useState('');

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

  const openWinnerSelection = (quarter: number) => {
    if (!game || !game.numbers_randomized) {
      Alert.alert('Numbers Not Set', 'Please randomize numbers first');
      return;
    }
    setSelectedQuarter(quarter);
    setScoreH('');
    setScoreV('');
    setShowWinnerInput(true);
    setShowHostMenu(false);
  };

  const findAndSetWinner = async () => {
    if (!game || !game.numbers_top || !game.numbers_left) return;
    
    const h = parseInt(scoreH || '0') % 10;
    const v = parseInt(scoreV || '0') % 10;
    
    const col = game.numbers_top.indexOf(h);
    const row = game.numbers_left.indexOf(v);
    
    if (col !== -1 && row !== -1) {
      const position = row * 10 + col;
      try {
        const response = await fetch(`${BACKEND_URL}/api/games/${code}/winner`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quarter: selectedQuarter, position }),
        });
        if (!response.ok) throw new Error('Failed to set winner');
        setShowWinnerInput(false);
      } catch (error) {
        Alert.alert('Error', 'Failed to set winner');
      }
    } else {
      Alert.alert('Error', 'Invalid scores');
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
      const colors = ['#E91E63', '#9C27B0', '#3F51B5', '#00BCD4', '#FF9800', '#795548', '#607D8B', '#F44336', '#2196F3', '#FFEB3B'];
      const index = game?.players.indexOf(square.player_name || '') || 0;
      return colors[index % colors.length];
    }
    return 'rgba(255,255,255,0.08)';
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
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
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
            <Text style={styles.playerCount}>{game.players.length} player{game.players.length !== 1 ? 's' : ''}</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity onPress={shareGame} style={styles.headerButton}>
              <Ionicons name="share-outline" size={24} color="#fff" />
            </TouchableOpacity>
            {gameInfo?.isHost && (
              <TouchableOpacity onPress={() => setShowHostMenu(true)} style={styles.headerButton}>
                <Ionicons name="settings-outline" size={24} color="#fff" />
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
          <Text style={styles.claimedText}>{getClaimedCount()}/100 claimed</Text>
        </View>

        {/* Grid */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gridScroll}>
          <View style={styles.gridWrapper}>
            {/* Top Team Label */}
            <View style={styles.topLabelRow}>
              <View style={{ width: LABEL_SIZE }} />
              <View style={styles.teamLabelContainer}>
                <Text style={styles.teamLabelH} numberOfLines={1}>{game.team_horizontal}</Text>
              </View>
            </View>

            {/* Numbers Row (Top) */}
            <View style={styles.numbersRow}>
              <View style={[styles.cornerCell, { width: LABEL_SIZE, height: LABEL_SIZE }]} />
              {Array.from({ length: 10 }).map((_, i) => (
                <View key={`top-${i}`} style={[styles.numberCell, { width: CELL_SIZE, height: LABEL_SIZE }]}>
                  <Text style={styles.numberText}>
                    {game.numbers_randomized && game.numbers_top ? game.numbers_top[i] : '?'}
                  </Text>
                </View>
              ))}
            </View>

            {/* Grid Rows */}
            <View style={styles.gridBody}>
              {/* Left Team Label */}
              <View style={styles.leftLabelContainer}>
                <Text style={styles.teamLabelV} numberOfLines={1}>{game.team_vertical}</Text>
              </View>
              
              <View style={styles.gridMain}>
                {Array.from({ length: 10 }).map((_, row) => (
                  <View key={`row-${row}`} style={styles.gridRow}>
                    {/* Left Number */}
                    <View style={[styles.numberCell, { width: LABEL_SIZE, height: CELL_SIZE }]}>
                      <Text style={styles.numberText}>
                        {game.numbers_randomized && game.numbers_left ? game.numbers_left[row] : '?'}
                      </Text>
                    </View>
                    {/* Grid Cells */}
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
                              width: CELL_SIZE, 
                              height: CELL_SIZE,
                              backgroundColor: getSquareColor(square, position),
                            },
                            isWinningSquare(position) && styles.winningCell,
                          ]}
                          onPress={() => claimSquare(position)}
                          activeOpacity={0.7}
                        >
                          {square.claimed && (
                            <Text style={styles.cellText} numberOfLines={1}>
                              {(square.player_name || '').substring(0, 3)}
                            </Text>
                          )}
                          {winningQuarters.length > 0 && (
                            <View style={styles.winnerBadge}>
                              <Text style={styles.winnerBadgeText}>
                                Q{winningQuarters.join(',')}
                              </Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </View>
            </View>
          </View>
        </ScrollView>

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
                  {isCurrentTurn && <Ionicons name="chevron-forward" size={14} color="#fff" />}
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
                <View style={styles.winnerQuarterBadge}>
                  <Text style={styles.winnerQuarterText}>Q{winner.quarter}</Text>
                </View>
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
                {game.numbers_randomized ? 'Numbers Set' : 'Randomize Numbers'}
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
              <Ionicons name="create-outline" size={24} color="#fff" />
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
                  onPress={() => openWinnerSelection(q)}
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

      {/* Winner Selection Modal */}
      <Modal
        visible={showWinnerInput}
        transparent
        animationType="fade"
        onRequestClose={() => setShowWinnerInput(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Set Q{selectedQuarter} Winner</Text>
            <Text style={styles.modalSubtitle}>Enter the last digit of each team's score</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{game.team_horizontal} Score (last digit)</Text>
              <TextInput
                style={styles.modalInput}
                value={scoreH}
                onChangeText={setScoreH}
                placeholder="0-9"
                placeholderTextColor="#666"
                keyboardType="number-pad"
                maxLength={1}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{game.team_vertical} Score (last digit)</Text>
              <TextInput
                style={styles.modalInput}
                value={scoreV}
                onChangeText={setScoreV}
                placeholder="0-9"
                placeholderTextColor="#666"
                keyboardType="number-pad"
                maxLength={1}
              />
            </View>

            <TouchableOpacity style={styles.saveButton} onPress={findAndSetWinner}>
              <Ionicons name="trophy" size={20} color="#fff" />
              <Text style={styles.saveButtonText}>Find Winner</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowWinnerInput(false)}
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
    marginBottom: 16,
  },
  backBtn: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  scrollContent: {
    padding: 12,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
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
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  turnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  claimedText: {
    color: '#888',
    fontSize: 14,
  },
  gridScroll: {
    paddingBottom: 8,
  },
  gridWrapper: {
    alignItems: 'flex-start',
  },
  topLabelRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  teamLabelContainer: {
    width: CELL_SIZE * 10,
    alignItems: 'center',
  },
  teamLabelH: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  numbersRow: {
    flexDirection: 'row',
  },
  cornerCell: {
    backgroundColor: 'transparent',
  },
  numberCell: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  numberText: {
    color: '#4CAF50',
    fontWeight: 'bold',
    fontSize: 12,
  },
  gridBody: {
    flexDirection: 'row',
  },
  leftLabelContainer: {
    width: LABEL_SIZE,
    height: CELL_SIZE * 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamLabelV: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    transform: [{ rotate: '-90deg' }],
    width: CELL_SIZE * 10,
    textAlign: 'center',
  },
  gridMain: {
    flexDirection: 'column',
  },
  gridRow: {
    flexDirection: 'row',
  },
  cell: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  winningCell: {
    borderWidth: 2,
    borderColor: '#fff',
  },
  cellText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '600',
  },
  winnerBadge: {
    position: 'absolute',
    bottom: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 2,
    paddingHorizontal: 2,
  },
  winnerBadgeText: {
    color: '#fff',
    fontSize: 7,
    fontWeight: 'bold',
  },
  playersSection: {
    marginTop: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
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
    fontSize: 13,
  },
  winnersSection: {
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  winnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  winnerQuarterBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 12,
  },
  winnerQuarterText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  winnerName: {
    color: '#fff',
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    color: '#888',
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
  },
  modalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
    gap: 12,
  },
  disabledButton: {
    backgroundColor: '#444',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  quarterTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 14,
    marginBottom: 10,
  },
  quarterButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  quarterButton: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 12,
    paddingHorizontal: 20,
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
    padding: 14,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#888',
    fontSize: 15,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    color: '#fff',
    marginBottom: 6,
    fontSize: 13,
  },
  modalInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
