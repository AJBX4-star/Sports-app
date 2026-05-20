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

export default function TermsScreen() {
  const router = useRouter();
  const openEmail = () => {
    Linking.openURL(`mailto:${CONTACT_EMAIL}`).catch(() => {});
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms of Service</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.iconWrap}>
          <Ionicons name="document-text" size={48} color="#4CAF50" />
        </View>
        <Text style={styles.title}>Terms of Service</Text>
        <Text style={styles.subtitle}>Last updated: {LAST_UPDATED}</Text>

        <Section
          title="1. Acceptance of Terms"
          body={`By downloading, installing, or using ${APP_NAME} (the "App"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, do not use the App.`}
        />

        <Section
          title="2. Eligibility"
          body={`You must be at least 13 years old to use the App. If you are under the age of majority in your jurisdiction (typically 18), you may only use the App with the involvement and consent of a parent or legal guardian.`}
        />

        <Section
          title="3. What the App Does"
          body={`${APP_NAME} is an entertainment app that lets you host or join a 10×10 grid (the classic "Squares" game format) with friends. The App provides:

• A virtual grid for picking squares
• Random number assignment for rows and columns
• Quarter-by-quarter winner tracking
• In-game chat (text, emoji, and images)
• Tools for the host to manage the game

The App is provided for casual entertainment and friendly play among people you know.`}
        />

        <Section
          title="4. No Gambling, No Wagering, No Real-Money Pools"
          body={`${APP_NAME} is NOT a gambling service. The App does not:

• Accept, hold, process, or facilitate any money, payments, deposits, or wagers
• Award any real-money prizes or anything of monetary value
• Verify or enforce any wager, pool, buy-in, or payout that you and your friends might arrange outside the App

You agree that you will not use the App in connection with any activity that is illegal in your jurisdiction. If you choose to organize a private pool with people you know offline, you do so entirely outside the App and entirely at your own risk and responsibility. We are not a party to, and bear no responsibility for, any such arrangements.`}
        />

        <Section
          title="5. Your Account & Display Name"
          body={`The App does not require a registered account. Instead, you choose a display name each time you create or join a game. You agree that your display name will not:

• Impersonate another person or entity
• Contain profanity, slurs, harassment, or threats
• Contain personal information of others
• Violate any law or third-party right

We reserve the right to remove or sanction display names that violate these Terms.`}
        />

        <Section
          title="6. User Content (Chat & Images)"
          body={`You are solely responsible for any content you submit through the App, including chat messages, images, and any custom square graphics ("User Content"). By submitting User Content, you grant us a worldwide, non-exclusive, royalty-free license to host, store, display, and distribute that User Content within the App for the purpose of operating the game.

You agree NOT to submit User Content that:

• Is unlawful, harassing, defamatory, threatening, hateful, or obscene
• Infringes any copyright, trademark, or other intellectual property right
• Contains nudity, sexually explicit material, or content that exploits minors
• Contains viruses, malware, or any harmful code
• Contains spam, advertising, or commercial solicitation
• Contains personal information of other people without their consent

The host of a game may delete chat messages and mute players. We may also remove any User Content at our discretion.`}
        />

        <Section
          title="7. Host Responsibilities"
          body={`If you create a game as the host, you are responsible for:

• Inviting only people you trust to use your game code
• Moderating chat and removing inappropriate messages or players
• The integrity of any score, winner, or settlement decisions you make

The host has elevated permissions including the ability to lock the board, randomize numbers, mute players, delete chat messages, release picks, and assign winners. By acting as host, you accept responsibility for using these tools fairly.`}
        />

        <Section
          title="8. Privacy"
          body={`Our collection and use of information is described in our Privacy Policy, which is incorporated by reference into these Terms. By using the App you agree to the Privacy Policy.`}
        />

        <Section
          title="9. Intellectual Property"
          body={`The App, its source code, design, graphics, logos, and trademarks are owned by us or our licensors and are protected by intellectual property laws. You may not copy, modify, reverse-engineer, decompile, distribute, or create derivative works of the App, except as expressly permitted by law.`}
        />

        <Section
          title="10. Third-Party Services"
          body={`The App may rely on third-party platforms (such as your device operating system, image library, or network provider) to function. We are not responsible for the availability or content of any third-party service.`}
        />

        <Section
          title='11. Disclaimer ("AS IS")'
          body={`THE APP IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE APP WILL BE UNINTERRUPTED, ERROR-FREE, SECURE, OR FREE FROM BUGS OR LOSS OF DATA.`}
        />

        <Section
          title="12. Limitation of Liability"
          body={`TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT WILL WE BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, REVENUE, DATA, OR USE, ARISING OUT OF OR RELATED TO YOUR USE OF THE APP, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. OUR TOTAL CUMULATIVE LIABILITY ARISING FROM OR RELATED TO THE APP WILL NOT EXCEED FIVE U.S. DOLLARS (USD $5).`}
        />

        <Section
          title="13. Indemnification"
          body={`You agree to indemnify and hold us harmless from any claims, damages, liabilities, costs, or expenses (including reasonable attorney fees) arising from (a) your use of the App, (b) your User Content, (c) your violation of these Terms, or (d) your violation of any law or third-party right.`}
        />

        <Section
          title="14. Termination"
          body={`We may suspend, restrict, or terminate your access to the App at any time and for any reason, including violation of these Terms, with or without notice. You may stop using the App at any time. Sections that by their nature should survive termination (including disclaimer, limitation of liability, indemnification, and governing law) will survive.`}
        />

        <Section
          title="15. Changes to These Terms"
          body={`We may update these Terms from time to time. The "Last updated" date at the top will change to reflect any updates. Continued use of the App after a change means you accept the updated Terms. If you do not agree with the updated Terms, you must stop using the App.`}
        />

        <Section
          title="16. Governing Law"
          body={`These Terms are governed by the laws of the United States and the State of New York, without regard to its conflict of law provisions. Any dispute arising under these Terms shall be resolved in the state or federal courts located in that jurisdiction, unless required otherwise by applicable consumer protection law in your country of residence.`}
        />

        <Section
          title="17. Severability"
          body={`If any provision of these Terms is held to be invalid or unenforceable, the remaining provisions will continue in full force and effect.`}
        />

        <Section
          title="18. Entire Agreement"
          body={`These Terms, together with the Privacy Policy, constitute the entire agreement between you and us regarding the App, and supersede any prior agreements.`}
        />

        <Text style={styles.sectionTitle}>Contact Us</Text>
        <Text style={styles.body}>
          Questions about these Terms? Reach out anytime:
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
  container: { flex: 1, backgroundColor: '#1a1a2e' },
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
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '600' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 60 },
  iconWrap: { alignItems: 'center', marginTop: 10, marginBottom: 8 },
  title: { color: '#fff', fontSize: 26, fontWeight: 'bold', textAlign: 'center', marginBottom: 4 },
  subtitle: { color: '#888', fontSize: 13, textAlign: 'center', marginBottom: 24 },
  section: { marginBottom: 20 },
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
  emailButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  footer: { color: '#666', fontSize: 12, textAlign: 'center', marginTop: 30 },
});
