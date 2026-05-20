import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Linking,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const APP_NAME = 'Sports Squares';
const CONTACT_EMAIL = 'sportssquaresapp@yahoo.com';
const LAST_UPDATED = 'February 2026';

export default function PrivacyPolicyScreen() {
  const router = useRouter();

  const openEmail = () => {
    Linking.openURL(`mailto:${CONTACT_EMAIL}`).catch(() => {});
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.iconWrap}>
          <Ionicons name="shield-checkmark" size={48} color="#4CAF50" />
        </View>
        <Text style={styles.title}>Your Privacy Matters</Text>
        <Text style={styles.subtitle}>Last updated: {LAST_UPDATED}</Text>

        <Section
          title="Introduction"
          body={`This Privacy Policy explains how ${APP_NAME} ("we", "us", "our") collects, uses, and protects your information when you use the app. By using the app, you agree to the practices described here.`}
        />

        <Section
          title="Information We Collect"
          body={`We collect only the minimum data needed to run the game:

• Display name you choose when creating or joining a game
• Game data: the game code, your square picks, team names, scores, winners, and player order
• Chat messages you send in a game, including any images you choose to share
• Device permissions you grant (photo library access to attach images)

We do not collect your real name, email address, phone number, contacts, location, advertising ID, or any biometric data. We do not use third-party analytics or advertising trackers.`}
        />

        <Section
          title="How We Use Your Information"
          body={`Your information is used solely to:

• Run the multiplayer squares game (sync the board, picks, and chat between players in your game)
• Show your display name and chat messages to other players in the same game room
• Persist your saved games on your device so you can rejoin them later`}
        />

        <Section
          title="Where Your Data Is Stored"
          body={`Game state, chat messages (including images you share), and player styles are stored on our backend server in a MongoDB database.

Your list of "My Games" (game codes, display name, host flag) is stored only on your device using local storage (AsyncStorage). It is never transmitted to us beyond what is needed to rejoin a game.

Chat images are resized client-side and stored as base64 strings attached to the chat message.`}
        />

        <Section
          title="Permissions"
          body={`The app may ask for these device permissions:

• Photo Library / Photos — only used when you tap the image button to attach a picture to a chat message or set a custom square image. Access is requested at the time you use the feature and can be revoked anytime in your device settings.
• Camera (iOS) — optional, only used if you choose to take a photo for chat instead of picking from your library.

We do not access your photos in the background.`}
        />

        <Section
          title="Sharing With Others"
          body={`We do not sell, rent, or share your data with third parties for marketing.

Information shown to other players in your game room (your chosen display name, your square picks, your chat messages, and any images you attach in chat) is visible only to other players who have the same game code. The host of a game can delete chat messages and mute players.`}
        />

        <Section
          title="Data Retention"
          body={`Game data and chat messages persist on our server while the game is active. We may periodically delete old game data that has been inactive for an extended period. You can leave a game at any time, and the host can release squares or remove players.

Saved games stored on your device can be deleted from the "My Games" screen at any time.`}
        />

        <Section
          title="Children's Privacy"
          body={`${APP_NAME} is not directed at children under 13. We do not knowingly collect personal information from children. If you believe a child has provided us with information, please contact us so we can remove it.`}
        />

        <Section
          title="Security"
          body={`We use industry-standard practices to protect data in transit (HTTPS) and at rest. However, no method of transmission or storage is 100% secure, so we cannot guarantee absolute security.`}
        />

        <Section
          title="Your Choices"
          body={`• You can stop using the app at any time.
• You can revoke photo/camera permissions in your device settings.
• You can delete saved games locally from the "My Games" screen.
• You can request deletion of chat messages or game data tied to your display name by emailing us.`}
        />

        <Section
          title="Changes to This Policy"
          body={`We may update this policy from time to time. The "Last updated" date at the top will change to reflect any updates. Continued use of the app after a change means you accept the updated policy.`}
        />

        <Text style={styles.sectionTitle}>Contact Us</Text>
        <Text style={styles.body}>
          Questions about this policy or your data? Reach out anytime:
        </Text>
        <TouchableOpacity style={styles.emailButton} onPress={openEmail}>
          <Ionicons name="mail-outline" size={18} color="#fff" />
          <Text style={styles.emailButtonText}>{CONTACT_EMAIL}</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>
          © {new Date().getFullYear()} {APP_NAME}. All rights reserved.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    paddingTop: Platform.OS === 'android' ? 28 : 14,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 60,
  },
  iconWrap: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  title: {
    color: '#fff',
    fontSize: 26,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    color: '#888',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 24,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#4CAF50',
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 6,
  },
  body: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    lineHeight: 22,
  },
  emailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  emailButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 30,
  },
});
