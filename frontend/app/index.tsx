import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ImageBackground, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Sports themed background image - custom uploaded
const HERO_IMAGE = 'https://customer-assets.emergentagent.com/job_6e1df73e-25d2-4f8e-bae0-a8029b2b9c4b/artifacts/6l9s6wqc_file_00000000fec8722f8b0dccf0e21824a4.png';

export default function HomeScreen() {
  const router = useRouter();

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
});
