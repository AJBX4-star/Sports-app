import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Socket } from 'socket.io-client';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface ChatMessage {
  id: string;
  game_code: string;
  player_name: string; // "SYSTEM" for system messages
  type: 'text' | 'image' | 'system';
  content: string;
  timestamp: string;
  deleted?: boolean;
  deleted_by?: string;
}

interface ChatProps {
  visible: boolean;
  onClose: () => void;
  gameCode: string;
  playerName: string;
  isHost: boolean;
  hostName: string;
  players: string[];
  backendUrl: string;
  socket: Socket | null;
  initialMessages?: ChatMessage[];
  initialMuted?: string[];
  onUnreadChange?: (count: number) => void;
  // Callback so parent can persist messages between mounts (optional)
  onMessagesUpdate?: (msgs: ChatMessage[]) => void;
}

const EMOJIS = [
  '😀', '😂', '😍', '🤔', '😎', '😱', '🥳', '😴',
  '👍', '👎', '🙌', '👏', '💪', '🙏', '🤝', '🤞',
  '🏈', '🏀', '⚾', '⚽', '🎾', '🏆', '🥇', '🎯',
  '🔥', '💯', '⚡', '✨', '⭐', '🎉', '🎊', '💎',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '💔',
  '😡', '😤', '🤯', '😭', '😅', '😊', '🤣', '🙄',
];

export default function Chat({
  visible,
  onClose,
  gameCode,
  playerName,
  isHost,
  hostName,
  players,
  backendUrl,
  socket,
  initialMessages = [],
  initialMuted = [],
  onUnreadChange,
  onMessagesUpdate,
}: ChatProps) {
  const insets = useSafeAreaInsets();
  // Minimum bottom padding so Android nav bar / iPhone home indicator never covers the input.
  // Use the larger of the device's safe-area inset OR a sensible fallback (24).
  const bottomSafePad = Math.max(insets.bottom, Platform.OS === 'android' ? 24 : 12);

  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showPlayerList, setShowPlayerList] = useState(false);
  const [typingPlayers, setTypingPlayers] = useState<string[]>([]);
  const [mutedPlayers, setMutedPlayers] = useState<string[]>(initialMuted);
  const scrollRef = useRef<ScrollView>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingEmitRef = useRef<number>(0);

  // Load initial messages from server when modal opens
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${backendUrl}/api/games/${gameCode}/messages?limit=200`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setMessages(data.messages || []);
        setMutedPlayers(data.muted_players || []);
        onMessagesUpdate?.(data.messages || []);
      } catch (e) {
        console.error('Failed to load messages', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, backendUrl, gameCode, onMessagesUpdate]);

  // Clear unread count when chat opens
  useEffect(() => {
    if (visible) onUnreadChange?.(0);
  }, [visible, onUnreadChange]);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    if (visible && messages.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [messages.length, visible]);

  // Socket listeners
  useEffect(() => {
    if (!socket) return;

    const onMessage = (msg: ChatMessage) => {
      setMessages((prev) => {
        // dedupe
        if (prev.some((m) => m.id === msg.id)) return prev;
        const next = [...prev, msg];
        onMessagesUpdate?.(next);
        return next;
      });
      // Increment unread only if chat is closed AND message isn't from me
      if (!visible && msg.player_name !== playerName) {
        onUnreadChange?.((prevCount: number) => (prevCount || 0) + 1 as any);
      }
    };

    const onMessageDeleted = ({ id, deleted_by }: { id: string; deleted_by: string }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, deleted: true, deleted_by, content: '' } : m))
      );
    };

    const onTyping = ({ player_name, is_typing }: { player_name: string; is_typing: boolean }) => {
      if (player_name === playerName) return;
      setTypingPlayers((prev) => {
        if (is_typing) {
          return prev.includes(player_name) ? prev : [...prev, player_name];
        }
        return prev.filter((p) => p !== player_name);
      });
      // Auto-remove after 4s in case the stop event is lost
      if (is_typing) {
        setTimeout(() => {
          setTypingPlayers((prev) => prev.filter((p) => p !== player_name));
        }, 4000);
      }
    };

    const onMuteChange = (data: { muted_players: string[] }) => {
      setMutedPlayers(data.muted_players || []);
    };

    socket.on('chat:message', onMessage);
    socket.on('chat:message_deleted', onMessageDeleted);
    socket.on('chat:typing', onTyping);
    socket.on('chat:player_muted', onMuteChange);
    socket.on('chat:player_unmuted', onMuteChange);

    return () => {
      socket.off('chat:message', onMessage);
      socket.off('chat:message_deleted', onMessageDeleted);
      socket.off('chat:typing', onTyping);
      socket.off('chat:player_muted', onMuteChange);
      socket.off('chat:player_unmuted', onMuteChange);
    };
  }, [socket, visible, playerName, onUnreadChange, onMessagesUpdate]);

  const sendTextMessage = async () => {
    const text = inputText.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const res = await fetch(`${backendUrl}/api/games/${gameCode}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_name: playerName,
          type: 'text',
          content: text,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Send failed');
      }
      setInputText('');
      emitTyping(false);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  const sendImageMessage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Allow photo access to send images.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.6,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      // Resize to max 600px wide for chat
      const manipulated = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 600 } }],
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      if (!manipulated.base64) return;
      const dataUri = `data:image/jpeg;base64,${manipulated.base64}`;
      setSending(true);
      const res = await fetch(`${backendUrl}/api/games/${gameCode}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_name: playerName,
          type: 'image',
          content: dataUri,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Send failed');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to send image');
    } finally {
      setSending(false);
    }
  };

  const emitTyping = useCallback(
    (isTyping: boolean) => {
      if (!gameCode) return;
      // Throttle typing emissions to once per 2s
      const now = Date.now();
      if (isTyping && now - lastTypingEmitRef.current < 2000) return;
      lastTypingEmitRef.current = now;
      fetch(`${backendUrl}/api/games/${gameCode}/typing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_name: playerName, is_typing: isTyping }),
      }).catch(() => {});
    },
    [backendUrl, gameCode, playerName]
  );

  const onInputChange = (text: string) => {
    setInputText(text);
    if (text.length > 0) {
      emitTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => emitTyping(false), 2500);
    } else {
      emitTyping(false);
    }
  };

  const deleteMessage = async (id: string) => {
    if (!isHost) return;
    try {
      const res = await fetch(
        `${backendUrl}/api/games/${gameCode}/messages/${id}?host_name=${encodeURIComponent(playerName)}`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Delete failed');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to delete');
    }
  };

  const toggleMute = async (target: string) => {
    const isMuted = mutedPlayers.includes(target);
    try {
      const res = await fetch(
        `${backendUrl}/api/games/${gameCode}/${isMuted ? 'unmute' : 'mute'}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ host_name: playerName, target_player: target }),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Action failed');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed');
    }
  };

  const onLongPressMessage = (msg: ChatMessage) => {
    if (!isHost) return;
    if (msg.deleted || msg.type === 'system') return;
    if (Platform.OS === 'web') {
      // Use a simple custom prompt via Alert (works on web in RN)
      Alert.alert(
        'Message Options',
        `Delete message from ${msg.player_name}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => deleteMessage(msg.id) },
        ]
      );
    } else {
      Alert.alert('Delete Message?', `Remove this message from ${msg.player_name}?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteMessage(msg.id) },
      ]);
    }
  };

  const amIMuted = mutedPlayers.includes(playerName) && playerName !== hostName;

  const renderMessage = (msg: ChatMessage) => {
    // System message
    if (msg.type === 'system' || msg.player_name === 'SYSTEM') {
      return (
        <View key={msg.id} style={styles.systemRow}>
          <Text style={styles.systemText}>{msg.content}</Text>
        </View>
      );
    }

    const isMine = msg.player_name === playerName;

    return (
      <Pressable
        key={msg.id}
        onLongPress={() => onLongPressMessage(msg)}
        delayLongPress={500}
      >
        <View style={[styles.messageRow, isMine ? styles.messageRowMine : styles.messageRowOther]}>
          <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
            {!isMine && (
              <Text style={styles.senderName}>{msg.player_name}</Text>
            )}
            {msg.deleted ? (
              <Text style={styles.deletedText}>
                <Ionicons name="trash" size={12} color="#888" /> message removed by host
              </Text>
            ) : msg.type === 'image' ? (
              <Image
                source={{ uri: msg.content }}
                style={styles.messageImage}
                resizeMode="cover"
              />
            ) : (
              <Text style={[styles.messageText, isMine && styles.messageTextMine]}>
                {msg.content}
              </Text>
            )}
            <Text style={[styles.timestamp, isMine && styles.timestampMine]}>
              {formatTime(msg.timestamp)}
            </Text>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="chatbubbles" size={22} color="#4CAF50" />
              <Text style={styles.headerTitle}>Game Chat</Text>
            </View>
            <View style={styles.headerRight}>
              {isHost && (
                <TouchableOpacity
                  style={styles.headerButton}
                  onPress={() => setShowPlayerList(true)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="people" size={22} color="#fff" />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.headerButton}
                onPress={onClose}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={26} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Messages */}
          <ScrollView
            ref={scrollRef}
            style={styles.messagesList}
            contentContainerStyle={styles.messagesContent}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            {messages.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="chatbubble-outline" size={42} color="#444" />
                <Text style={styles.emptyText}>No messages yet</Text>
                <Text style={styles.emptySubtext}>Say hi to your fellow players! 👋</Text>
              </View>
            ) : (
              messages.map(renderMessage)
            )}

            {typingPlayers.length > 0 && (
              <View style={styles.typingRow}>
                <ActivityIndicator size="small" color="#888" />
                <Text style={styles.typingText}>
                  {typingPlayers.length === 1
                    ? `${typingPlayers[0]} is typing…`
                    : `${typingPlayers.slice(0, 2).join(', ')} are typing…`}
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Emoji picker (collapsible) */}
          {showEmojiPicker && (
            <View style={styles.emojiPanel}>
              <ScrollView contentContainerStyle={styles.emojiGrid} horizontal={false}>
                <View style={styles.emojiWrap}>
                  {EMOJIS.map((e) => (
                    <TouchableOpacity
                      key={e}
                      style={styles.emojiButton}
                      onPress={() => setInputText((prev) => prev + e)}
                    >
                      <Text style={styles.emojiText}>{e}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {/* Composer + safe-area footer (lifts input above Android nav bar) */}
          <View style={{ paddingBottom: bottomSafePad }}>
            {amIMuted ? (
              <View style={styles.mutedBanner}>
                <Ionicons name="volume-mute" size={18} color="#FFA726" />
                <Text style={styles.mutedText}>
                  You have been muted by the host
                </Text>
              </View>
            ) : (
              <View style={styles.composer}>
                <TouchableOpacity
                  style={styles.composerIconBtn}
                  onPress={() => setShowEmojiPicker((s) => !s)}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Ionicons
                    name={showEmojiPicker ? 'happy' : 'happy-outline'}
                    size={24}
                    color={showEmojiPicker ? '#FFD700' : '#aaa'}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.composerIconBtn}
                  onPress={sendImageMessage}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  disabled={sending}
                >
                  <Ionicons name="image-outline" size={24} color="#aaa" />
                </TouchableOpacity>
                <TextInput
                  style={styles.composerInput}
                  value={inputText}
                  onChangeText={onInputChange}
                  placeholder="Type a message…"
                  placeholderTextColor="#666"
                  multiline
                  maxLength={2000}
                  onFocus={() => setShowEmojiPicker(false)}
                />
                <TouchableOpacity
                  style={[
                    styles.sendButton,
                    (!inputText.trim() || sending) && styles.sendButtonDisabled,
                  ]}
                  onPress={sendTextMessage}
                  disabled={!inputText.trim() || sending}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="send" size={20} color="#fff" />
                  )}
                </TouchableOpacity>
              </View>
            )}
            {/* Subtle inert brand strip — keeps input clear of Android nav buttons */}
            <View style={styles.brandStrip} pointerEvents="none">
              <Ionicons name="football" size={11} color="rgba(76,175,80,0.55)" />
              <Text style={styles.brandStripText}>Sports Squares</Text>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Player List / Mute Modal (Host only) */}
      <Modal
        visible={showPlayerList}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPlayerList(false)}
      >
        <View style={styles.modListOverlay}>
          <View style={styles.modListContent}>
            <View style={styles.modListHeader}>
              <Text style={styles.modListTitle}>Player Moderation</Text>
              <TouchableOpacity onPress={() => setShowPlayerList(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 360 }}>
              {players
                .filter((p) => p !== hostName)
                .map((p) => {
                  const muted = mutedPlayers.includes(p);
                  return (
                    <View key={p} style={styles.modListRow}>
                      <Text style={styles.modListName}>{p}</Text>
                      <TouchableOpacity
                        style={[
                          styles.modListBtn,
                          muted ? styles.modListBtnUnmute : styles.modListBtnMute,
                        ]}
                        onPress={() => toggleMute(p)}
                      >
                        <Ionicons
                          name={muted ? 'volume-high' : 'volume-mute'}
                          size={16}
                          color="#fff"
                        />
                        <Text style={styles.modListBtnText}>
                          {muted ? 'Unmute' : 'Mute'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              {players.filter((p) => p !== hostName).length === 0 && (
                <Text style={styles.emptyText}>No other players yet</Text>
              )}
            </ScrollView>
            <Text style={styles.modHint}>
              💡 Tip: Long-press any chat message to delete it.
            </Text>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    height: '85%',
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerButton: {
    padding: 2,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: 14,
    paddingBottom: 22,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyText: {
    color: '#888',
    fontSize: 15,
    marginTop: 10,
  },
  emptySubtext: {
    color: '#666',
    fontSize: 13,
    marginTop: 4,
  },
  brandStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingTop: 6,
    paddingBottom: 4,
  },
  brandStripText: {
    color: 'rgba(255,255,255,0.32)',
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  // System messages
  systemRow: {
    alignItems: 'center',
    marginVertical: 6,
  },
  systemText: {
    color: '#888',
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  // Regular messages
  messageRow: {
    marginBottom: 10,
    flexDirection: 'row',
  },
  messageRowMine: {
    justifyContent: 'flex-end',
  },
  messageRowOther: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '78%',
    padding: 10,
    borderRadius: 14,
  },
  bubbleMine: {
    backgroundColor: '#4CAF50',
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderBottomLeftRadius: 4,
  },
  senderName: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  messageText: {
    color: '#fff',
    fontSize: 15,
  },
  messageTextMine: {
    color: '#fff',
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 8,
    marginVertical: 2,
  },
  deletedText: {
    color: '#888',
    fontSize: 12,
    fontStyle: 'italic',
  },
  timestamp: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    marginTop: 4,
    textAlign: 'right',
  },
  timestampMine: {
    color: 'rgba(255,255,255,0.7)',
  },
  // Typing
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  typingText: {
    color: '#888',
    fontSize: 12,
    fontStyle: 'italic',
  },
  // Composer
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  composerIconBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  composerInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    fontSize: 15,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: 'rgba(76,175,80,0.4)',
  },
  // Emoji
  emojiPanel: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    maxHeight: 200,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  emojiGrid: {
    padding: 10,
  },
  emojiWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  emojiButton: {
    width: '12.5%',
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiText: {
    fontSize: 26,
  },
  // Muted banner
  mutedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    backgroundColor: 'rgba(255,167,38,0.15)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,167,38,0.4)',
  },
  mutedText: {
    color: '#FFA726',
    fontSize: 13,
    fontWeight: '600',
  },
  // Moderation modal
  modListOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    padding: 24,
  },
  modListContent: {
    backgroundColor: '#1a1a2e',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  modListTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  modListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  modListName: {
    color: '#fff',
    fontSize: 15,
    flex: 1,
  },
  modListBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  modListBtnMute: {
    backgroundColor: '#f44336',
  },
  modListBtnUnmute: {
    backgroundColor: '#4CAF50',
  },
  modListBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  modHint: {
    color: '#888',
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 10,
    textAlign: 'center',
  },
});
