import React, { useState, useEffect } from 'react';
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
  number: number;
  player_name: string | null;
  claimed: boolean;
  locked: boolean;
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
  host_name: string;
  team_horizontal: string;
  team_vertical: string;
  squares: Square[];
  numbers_top: number[] | null;
  numbers_left: number[] | null;
  numbers_randomized: boolean;
  winners: Winner[];
  current_turn: number;
  players: string[];
  player_order: string[];
  is_active: boolean;
  picks_per_turn: number;
  picks_this_turn: number;
  draft_style: string;
  draft_direction: number;
  board_locked: boolean;
  draft_started: boolean;
}

interface GameInfo {
  code: string;
  playerName: string;
  isHost: boolean;
  hostId: string | null;
}

// Cell size calculation - ensure grid fits on screen
const CELL_SIZE = 30; // Fixed size that fits 10 + label
const LABEL_SIZE = 28;

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
  const [showPlayerOrder, setShowPlayerOrder] = useState(false);
  const [showHostClaim, setShowHostClaim] = useState(false);
  const [hostClaimPosition, setHostClaimPosition] = useState<number | null>(null);
  const [hostClaimPlayer, setHostClaimPlayer] = useState('');
  const [hostClaimAsUnclaimed, setHostClaimAsUnclaimed] = useState(false);

  // Load game info and connect to socket
  useEffect(() => {
    loadGameInfo();
  }, []);

  useEffect(() => {
    if (code) {
      fetchGame();
      connectSocket();
    }
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [code]);

  const loadGameInfo = async () => {
    try {
      const storedInfo = await AsyncStorage.getItem('currentGame');
      console.log('Loaded game info:', storedInfo);
      if (storedInfo) {
        const parsed = JSON.parse(storedInfo);
        console.log('Parsed game info:', parsed);
        setGameInfo(parsed);
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
      setGame(prev => prev ? { 
        ...prev, 
        squares: data.squares, 
        current_turn: data.current_turn ?? prev.current_turn,
        picks_this_turn: data.picks_this_turn ?? prev.picks_this_turn,
        board_locked: data.board_locked ?? prev.board_locked
      } : null);
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
      setGame(prev => prev ? { 
        ...prev, 
        players: data.players,
        player_order: data.player_order ?? prev.player_order
      } : null);
    });

    newSocket.on('teams_updated', (data) => {
      setGame(prev => prev ? { 
        ...prev, 
        team_horizontal: data.team_horizontal, 
        team_vertical: data.team_vertical 
      } : null);
    });

    newSocket.on('player_order_updated', (data) => {
      setGame(prev => prev ? { ...prev, player_order: data.player_order } : null);
    });

    newSocket.on('draft_started', (data) => {
      setGame(prev => prev ? { 
        ...prev, 
        player_order: data.player_order,
        current_turn: data.current_turn,
        draft_started: true
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
    
    // Check if board is locked
    if (game.board_locked) {
      return;
    }
    
    const square = game.squares[position];
    if (square.claimed || square.locked) {
      return; // Square already claimed/locked - silently ignore
    }

    // Check if it's this player's turn
    const playerOrder = game.player_order.length > 0 ? game.player_order : game.players;
    const currentPlayerName = playerOrder[game.current_turn % playerOrder.length];
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
          claimed_by_host: false,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail);
      }
      
      const data = await response.json();
      setGame({...data});
    } catch (error: any) {
      if (error.message !== 'Square already claimed') {
        Alert.alert('Error', error.message || 'Failed to claim square');
      }
    }
  };

  const hostClaimSquare = async () => {
    if (!game || hostClaimPosition === null) return;
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/games/${code}/host-claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          position: hostClaimPosition,
          player_name: hostClaimAsUnclaimed ? null : hostClaimPlayer,
          as_unclaimed: hostClaimAsUnclaimed,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail);
      }
      
      const data = await response.json();
      setGame({...data});
      setShowHostClaim(false);
      setHostClaimPosition(null);
      setHostClaimPlayer('');
      setHostClaimAsUnclaimed(false);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to claim square');
    }
  };

  const openHostClaimModal = (position: number) => {
    if (!gameInfo?.isHost) return;
    if (game?.squares[position].claimed) return;
    
    setHostClaimPosition(position);
    setHostClaimPlayer(gameInfo.playerName);
    setHostClaimAsUnclaimed(false);
    setShowHostClaim(true);
  };

  const randomizeNumbers = async () => {
    if (!game) return;
    
    if (!game.board_locked) {
      Alert.alert('Board Not Locked', 'All 100 squares must be claimed before randomizing numbers');
      return;
    }
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/games/${code}/randomize`, {
        method: 'POST',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to randomize');
      }
      
      const data = await response.json();
      setGame({...data});
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to randomize numbers');
    }
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
        
        const data = await response.json();
        setGame({...data});
        setShowWinnerInput(false);
      } catch (error) {
        console.error('Failed to set winner:', error);
      }
    } else {
      Alert.alert('Error', 'Invalid scores - number not found in grid');
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
      const data = await response.json();
      setGame({...data});
      setShowTeamModal(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to update team names');
    }
  };

  const randomizePlayerOrder = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/games/${code}/player-order`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_order: [], randomize: true }),
      });
      if (!response.ok) throw new Error('Failed to randomize order');
      const data = await response.json();
      setGame({...data});
    } catch (error) {
      Alert.alert('Error', 'Failed to randomize player order');
    }
  };

  const movePlayerUp = async (index: number) => {
    if (!game || index === 0) return;
    const newOrder = [...game.player_order];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/games/${code}/player-order`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_order: newOrder, randomize: false }),
      });
      if (!response.ok) throw new Error('Failed to update order');
      const data = await response.json();
      setGame({...data});
    } catch (error) {
      console.error('Failed to update player order');
    }
  };

  const movePlayerDown = async (index: number) => {
    if (!game || index === game.player_order.length - 1) return;
    const newOrder = [...game.player_order];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/games/${code}/player-order`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_order: newOrder, randomize: false }),
      });
      if (!response.ok) throw new Error('Failed to update order');
      const data = await response.json();
      setGame({...data});
    } catch (error) {
      console.error('Failed to update player order');
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
      if (!square.player_name) return '#666'; // Unclaimed but locked
      const colors = ['#E91E63', '#9C27B0', '#3F51B5', '#00BCD4', '#FF9800', '#795548', '#607D8B', '#F44336', '#2196F3', '#FFEB3B'];
      const playerOrder = game?.player_order.length ? game.player_order : game?.players || [];
      const index = playerOrder.indexOf(square.player_name);
      return colors[index >= 0 ? index % colors.length : 0];
    }
    return 'rgba(255,255,255,0.08)';
  };

  const getCurrentTurnPlayer = () => {
    if (!game) return '';
    const playerOrder = game.player_order.length > 0 ? game.player_order : game.players;
    return playerOrder[game.current_turn % playerOrder.length] || '';
  };

  const getClaimedCount = () => {
    if (!game) return 0;
    return game.squares.filter(s => s.claimed).length;
  };

  const getRemainingPicks = () => {
    if (!game) return 0;
    return game.picks_per_turn - game.picks_this_turn;
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

  const playerOrder = game.player_order.length > 0 ? game.player_order : game.players;

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

        {/* Status Banner */}
        {game.board_locked ? (
          <View style={[styles.statusBanner, styles.lockedBanner]}>
            <Ionicons name="lock-closed" size={18} color="#fff" />
            <Text style={styles.statusText}>Board Locked - All squares claimed!</Text>
          </View>
        ) : (
          <View style={styles.turnIndicator}>
            <View style={styles.turnInfo}>
              <Text style={styles.turnText}>{getCurrentTurnPlayer()}'s Turn</Text>
              {game.picks_per_turn > 1 && (
                <Text style={styles.picksText}>{getRemainingPicks()} pick{getRemainingPicks() !== 1 ? 's' : ''} left</Text>
              )}
            </View>
            <Text style={styles.claimedText}>{getClaimedCount()}/100</Text>
          </View>
        )}

        {/* Grid */}
        <View style={styles.gridWrapper}>
          {/* Top Team Label */}
          <View style={styles.topLabelRow}>
            <View style={{ width: LABEL_SIZE }} />
            <View style={[styles.teamLabelContainer, { width: CELL_SIZE * 10 }]}>
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

          {/* Grid Rows with Left Numbers */}
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
                const squareNumber = position + 1;
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
                      square.locked && styles.lockedCell,
                    ]}
                    onPress={() => claimSquare(position)}
                    onLongPress={() => gameInfo?.isHost && openHostClaimModal(position)}
                    activeOpacity={square.claimed ? 1 : 0.7}
                    disabled={square.claimed || game.board_locked}
                  >
                    {/* Square Number */}
                    <Text style={[
                      styles.squareNumber,
                      square.claimed && styles.squareNumberClaimed
                    ]}>{squareNumber}</Text>
                    
                    {/* Player Initials */}
                    {square.claimed && square.player_name && (
                      <Text style={styles.cellText} numberOfLines={1}>
                        {square.player_name.substring(0, 3)}
                      </Text>
                    )}
                    
                    {/* Winner Badge */}
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

          {/* Bottom Team Label (Left Team - Vertical) */}
          <View style={styles.bottomLabelRow}>
            <Text style={styles.teamLabelV} numberOfLines={1}>{game.team_vertical}</Text>
          </View>
        </View>

        {/* Draft Info */}
        <View style={styles.draftInfo}>
          <View style={styles.draftInfoItem}>
            <Ionicons name="git-branch" size={16} color="#4CAF50" />
            <Text style={styles.draftInfoText}>
              {game.draft_style === 'snake' ? 'Snake Draft' : 'Standard Draft'}
            </Text>
          </View>
          <View style={styles.draftInfoItem}>
            <Ionicons name="layers" size={16} color="#2196F3" />
            <Text style={styles.draftInfoText}>{game.picks_per_turn} pick{game.picks_per_turn > 1 ? 's' : ''}/turn</Text>
          </View>
        </View>

        {/* Players List */}
        <View style={styles.playersSection}>
          <View style={styles.playersSectionHeader}>
            <Text style={styles.sectionTitle}>Player Order</Text>
            {gameInfo?.isHost && (
              <TouchableOpacity onPress={() => setShowPlayerOrder(true)}>
                <Ionicons name="create-outline" size={20} color="#4CAF50" />
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.playersList}>
            {playerOrder.map((player, index) => {
              const colors = ['#E91E63', '#9C27B0', '#3F51B5', '#00BCD4', '#FF9800', '#795548', '#607D8B', '#F44336', '#2196F3', '#FFEB3B'];
              const isCurrentTurn = game.current_turn % playerOrder.length === index && !game.board_locked;
              return (
                <View 
                  key={player} 
                  style={[
                    styles.playerChip,
                    { backgroundColor: colors[index % colors.length] },
                    isCurrentTurn && styles.currentTurnChip,
                  ]}
                >
                  <Text style={styles.playerOrder}>{index + 1}</Text>
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
              style={[styles.modalButton, (!game.board_locked || game.numbers_randomized) && styles.disabledButton]}
              onPress={() => {
                setShowHostMenu(false);
                randomizeNumbers();
              }}
              disabled={!game.board_locked || game.numbers_randomized}
            >
              <Ionicons name="shuffle" size={24} color="#fff" />
              <Text style={styles.modalButtonText}>
                {game.numbers_randomized ? 'Numbers Set' : 
                 !game.board_locked ? 'Fill Board First' : 'Randomize Numbers'}
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

            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => {
                setShowHostMenu(false);
                setShowPlayerOrder(true);
              }}
            >
              <Ionicons name="people" size={24} color="#fff" />
              <Text style={styles.modalButtonText}>Manage Player Order</Text>
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

            <Text style={styles.hostTip}>
              Tip: Long-press any unclaimed square to claim it for another player
            </Text>

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

      {/* Player Order Modal */}
      <Modal
        visible={showPlayerOrder}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPlayerOrder(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Player Order</Text>
            <Text style={styles.modalSubtitle}>Drag to reorder or randomize</Text>

            <TouchableOpacity style={styles.randomizeButton} onPress={randomizePlayerOrder}>
              <Ionicons name="shuffle" size={20} color="#fff" />
              <Text style={styles.randomizeButtonText}>Randomize Order</Text>
            </TouchableOpacity>

            <ScrollView style={styles.playerOrderList}>
              {playerOrder.map((player, index) => (
                <View key={player} style={styles.playerOrderItem}>
                  <Text style={styles.playerOrderNumber}>{index + 1}</Text>
                  <Text style={styles.playerOrderName}>{player}</Text>
                  <View style={styles.playerOrderButtons}>
                    <TouchableOpacity 
                      style={[styles.orderButton, index === 0 && styles.orderButtonDisabled]}
                      onPress={() => movePlayerUp(index)}
                      disabled={index === 0}
                    >
                      <Ionicons name="chevron-up" size={20} color={index === 0 ? '#444' : '#fff'} />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.orderButton, index === playerOrder.length - 1 && styles.orderButtonDisabled]}
                      onPress={() => movePlayerDown(index)}
                      disabled={index === playerOrder.length - 1}
                    >
                      <Ionicons name="chevron-down" size={20} color={index === playerOrder.length - 1 ? '#444' : '#fff'} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowPlayerOrder(false)}
            >
              <Text style={styles.closeButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Host Claim Modal */}
      <Modal
        visible={showHostClaim}
        transparent
        animationType="fade"
        onRequestClose={() => setShowHostClaim(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Claim Square #{(hostClaimPosition ?? 0) + 1}</Text>
            <Text style={styles.modalSubtitle}>Select who this square belongs to</Text>

            <View style={styles.claimOptions}>
              <TouchableOpacity
                style={[styles.claimOption, !hostClaimAsUnclaimed && styles.claimOptionSelected]}
                onPress={() => setHostClaimAsUnclaimed(false)}
              >
                <Ionicons name="person" size={24} color={!hostClaimAsUnclaimed ? '#fff' : '#888'} />
                <Text style={[styles.claimOptionText, !hostClaimAsUnclaimed && styles.claimOptionTextSelected]}>
                  Claim for Player
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.claimOption, hostClaimAsUnclaimed && styles.claimOptionSelected]}
                onPress={() => setHostClaimAsUnclaimed(true)}
              >
                <Ionicons name="help-circle" size={24} color={hostClaimAsUnclaimed ? '#fff' : '#888'} />
                <Text style={[styles.claimOptionText, hostClaimAsUnclaimed && styles.claimOptionTextSelected]}>
                  Mark as Unclaimed
                </Text>
              </TouchableOpacity>
            </View>

            {!hostClaimAsUnclaimed && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Select Player</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.playerSelectScroll}>
                  {game.players.map((player) => (
                    <TouchableOpacity
                      key={player}
                      style={[
                        styles.playerSelectButton,
                        hostClaimPlayer === player && styles.playerSelectButtonActive,
                      ]}
                      onPress={() => setHostClaimPlayer(player)}
                    >
                      <Text style={[
                        styles.playerSelectText,
                        hostClaimPlayer === player && styles.playerSelectTextActive,
                      ]}>{player}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <TouchableOpacity style={styles.saveButton} onPress={hostClaimSquare}>
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.saveButtonText}>Confirm Claim</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowHostClaim(false)}
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
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  lockedBanner: {
    backgroundColor: '#4CAF50',
  },
  statusText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
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
  turnInfo: {
    flex: 1,
  },
  turnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  picksText: {
    color: '#4CAF50',
    fontSize: 12,
    marginTop: 2,
  },
  claimedText: {
    color: '#888',
    fontSize: 14,
  },
  gridWrapper: {
    alignItems: 'center',
    marginBottom: 12,
  },
  topLabelRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  teamLabelContainer: {
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
    fontSize: 11,
  },
  bottomLabelRow: {
    marginTop: 8,
    alignItems: 'center',
    width: '100%',
  },
  teamLabelV: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  gridRow: {
    flexDirection: 'row',
  },
  cell: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
    position: 'relative',
  },
  winningCell: {
    borderWidth: 2,
    borderColor: '#fff',
  },
  lockedCell: {
    opacity: 0.9,
  },
  squareNumber: {
    position: 'absolute',
    top: 1,
    left: 2,
    fontSize: 7,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '500',
  },
  squareNumberClaimed: {
    color: 'rgba(255,255,255,0.7)',
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
  draftInfo: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 12,
  },
  draftInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  draftInfoText: {
    color: '#aaa',
    fontSize: 12,
  },
  playersSection: {
    marginBottom: 12,
  },
  playersSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  playersList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  playerChip: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    alignItems: 'center',
    gap: 4,
  },
  playerOrder: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: 'bold',
    marginRight: 2,
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
    maxHeight: '85%',
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
    marginBottom: 16,
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
    marginBottom: 16,
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
  hostTip: {
    color: '#888',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 10,
    fontStyle: 'italic',
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
  randomizeButton: {
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  randomizeButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  playerOrderList: {
    maxHeight: 300,
  },
  playerOrderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  playerOrderNumber: {
    color: '#4CAF50',
    fontWeight: 'bold',
    fontSize: 16,
    width: 30,
  },
  playerOrderName: {
    color: '#fff',
    fontSize: 15,
    flex: 1,
  },
  playerOrderButtons: {
    flexDirection: 'row',
    gap: 4,
  },
  orderButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 6,
    borderRadius: 4,
  },
  orderButtonDisabled: {
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  claimOptions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  claimOption: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  claimOptionSelected: {
    backgroundColor: '#4CAF50',
    borderColor: '#fff',
  },
  claimOptionText: {
    color: '#888',
    marginTop: 8,
    fontSize: 12,
    textAlign: 'center',
  },
  claimOptionTextSelected: {
    color: '#fff',
  },
  playerSelectScroll: {
    maxHeight: 50,
  },
  playerSelectButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginRight: 8,
  },
  playerSelectButtonActive: {
    backgroundColor: '#4CAF50',
  },
  playerSelectText: {
    color: '#888',
    fontWeight: '500',
  },
  playerSelectTextActive: {
    color: '#fff',
  },
});
