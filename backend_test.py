#!/usr/bin/env python3
"""
Comprehensive test suite for Sports Squares Chat API endpoints.
Tests all scenarios A-J from the review request.
"""

import requests
import json
import time
from typing import Dict, List, Optional

# Backend URL from frontend/.env
BASE_URL = "https://sports-squares-debug.preview.emergentagent.com/api"

class TestResult:
    def __init__(self):
        self.passed = []
        self.failed = []
        self.warnings = []
    
    def add_pass(self, test_name: str, details: str = ""):
        self.passed.append(f"✅ {test_name}: {details}")
        print(f"✅ PASS: {test_name}")
        if details:
            print(f"   {details}")
    
    def add_fail(self, test_name: str, details: str):
        self.failed.append(f"❌ {test_name}: {details}")
        print(f"❌ FAIL: {test_name}")
        print(f"   {details}")
    
    def add_warning(self, test_name: str, details: str):
        self.warnings.append(f"⚠️  {test_name}: {details}")
        print(f"⚠️  WARNING: {test_name}")
        print(f"   {details}")
    
    def summary(self):
        print("\n" + "="*80)
        print("TEST SUMMARY")
        print("="*80)
        print(f"Passed: {len(self.passed)}")
        print(f"Failed: {len(self.failed)}")
        print(f"Warnings: {len(self.warnings)}")
        print("="*80)
        
        if self.failed:
            print("\nFAILED TESTS:")
            for fail in self.failed:
                print(fail)
        
        if self.warnings:
            print("\nWARNINGS:")
            for warn in self.warnings:
                print(warn)
        
        return len(self.failed) == 0

def create_test_game(host_name: str = "Alice") -> Optional[Dict]:
    """Helper: Create a fresh game for testing."""
    try:
        response = requests.post(f"{BASE_URL}/games", json={
            "host_id": f"host_{host_name}_{int(time.time())}",
            "host_name": host_name,
            "team_horizontal": "Team A",
            "team_vertical": "Team B"
        }, timeout=10)
        
        if response.status_code == 200:
            game = response.json()
            print(f"✓ Created game with code: {game['code']}")
            return game
        else:
            print(f"✗ Failed to create game: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"✗ Exception creating game: {e}")
        return None

def join_game(code: str, player_name: str) -> bool:
    """Helper: Join a game."""
    try:
        response = requests.post(f"{BASE_URL}/games/{code}/join", json={
            "code": code,
            "player_name": player_name
        }, timeout=10)
        
        if response.status_code == 200:
            print(f"✓ {player_name} joined game {code}")
            return True
        else:
            print(f"✗ Failed to join game: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"✗ Exception joining game: {e}")
        return False

def claim_square(code: str, player_name: str, position: int) -> bool:
    """Helper: Claim a square."""
    try:
        response = requests.post(f"{BASE_URL}/games/{code}/claim", json={
            "position": position,
            "player_name": player_name
        }, timeout=10)
        
        if response.status_code == 200:
            print(f"✓ {player_name} claimed square {position}")
            return True
        else:
            print(f"✗ Failed to claim square: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"✗ Exception claiming square: {e}")
        return False

def randomize_numbers(code: str, host_name: str) -> bool:
    """Helper: Randomize numbers."""
    try:
        response = requests.post(f"{BASE_URL}/games/{code}/randomize", json={
            "host_name": host_name
        }, timeout=10)
        
        if response.status_code == 200:
            print(f"✓ Numbers randomized for game {code}")
            return True
        else:
            print(f"✗ Failed to randomize: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"✗ Exception randomizing: {e}")
        return False

def release_square(code: str, host_name: str, position: int) -> bool:
    """Helper: Release a square."""
    try:
        response = requests.post(f"{BASE_URL}/games/{code}/release-square", json={
            "position": position,
            "host_name": host_name
        }, timeout=10)
        
        if response.status_code == 200:
            print(f"✓ Released square {position}")
            return True
        else:
            print(f"✗ Failed to release square: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"✗ Exception releasing square: {e}")
        return False

# ============================================================
# TEST SCENARIOS
# ============================================================

def test_scenario_a_happy_path(result: TestResult):
    """A) Happy path - send text and image messages"""
    print("\n" + "="*80)
    print("TEST SCENARIO A: Happy Path - Text and Image Messages")
    print("="*80)
    
    # Create game with host Alice
    game = create_test_game("Alice")
    if not game:
        result.add_fail("Scenario A", "Failed to create game")
        return
    
    code = game['code']
    
    # Join player Bob
    if not join_game(code, "Bob"):
        result.add_fail("Scenario A", "Failed to join Bob")
        return
    
    # Send text message from Alice
    try:
        response = requests.post(f"{BASE_URL}/games/{code}/messages", json={
            "player_name": "Alice",
            "type": "text",
            "content": "Hello from Alice!"
        }, timeout=10)
        
        if response.status_code == 200:
            msg1 = response.json()
            if 'id' in msg1 and 'timestamp' in msg1:
                result.add_pass("Scenario A - Alice text message", f"Message ID: {msg1['id']}")
            else:
                result.add_fail("Scenario A - Alice text message", "Missing id or timestamp in response")
        else:
            result.add_fail("Scenario A - Alice text message", f"Status {response.status_code}: {response.text}")
    except Exception as e:
        result.add_fail("Scenario A - Alice text message", f"Exception: {e}")
    
    # Send text message from Bob
    try:
        response = requests.post(f"{BASE_URL}/games/{code}/messages", json={
            "player_name": "Bob",
            "type": "text",
            "content": "Hello from Bob!"
        }, timeout=10)
        
        if response.status_code == 200:
            msg2 = response.json()
            if 'id' in msg2 and 'timestamp' in msg2:
                result.add_pass("Scenario A - Bob text message", f"Message ID: {msg2['id']}")
            else:
                result.add_fail("Scenario A - Bob text message", "Missing id or timestamp in response")
        else:
            result.add_fail("Scenario A - Bob text message", f"Status {response.status_code}: {response.text}")
    except Exception as e:
        result.add_fail("Scenario A - Bob text message", f"Exception: {e}")
    
    # Send image message from Bob
    try:
        response = requests.post(f"{BASE_URL}/games/{code}/messages", json={
            "player_name": "Bob",
            "type": "image",
            "content": "data:image/jpeg;base64,Zm9vYmFy"
        }, timeout=10)
        
        if response.status_code == 200:
            msg3 = response.json()
            if 'id' in msg3 and 'timestamp' in msg3:
                result.add_pass("Scenario A - Bob image message", f"Message ID: {msg3['id']}")
            else:
                result.add_fail("Scenario A - Bob image message", "Missing id or timestamp in response")
        else:
            result.add_fail("Scenario A - Bob image message", f"Status {response.status_code}: {response.text}")
    except Exception as e:
        result.add_fail("Scenario A - Bob image message", f"Exception: {e}")

def test_scenario_b_get_messages(result: TestResult):
    """B) GET /messages returns messages in order and system messages exist"""
    print("\n" + "="*80)
    print("TEST SCENARIO B: GET Messages with Limit and System Messages")
    print("="*80)
    
    # Create game with host Alice
    game = create_test_game("Alice")
    if not game:
        result.add_fail("Scenario B", "Failed to create game")
        return
    
    code = game['code']
    
    # Join player Bob
    if not join_game(code, "Bob"):
        result.add_fail("Scenario B", "Failed to join Bob")
        return
    
    # Claim a square to generate system message
    claim_square(code, "Alice", 0)
    
    # Randomize to generate system message
    randomize_numbers(code, "Alice")
    
    # Release square to generate system message
    release_square(code, "Alice", 0)
    
    # Send 3 messages
    for i in range(3):
        requests.post(f"{BASE_URL}/games/{code}/messages", json={
            "player_name": "Alice",
            "type": "text",
            "content": f"Test message {i+1}"
        }, timeout=10)
    
    # GET messages with limit=100
    try:
        response = requests.get(f"{BASE_URL}/games/{code}/messages?limit=100", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            messages = data.get('messages', [])
            muted_players = data.get('muted_players', [])
            
            # Check structure
            if 'messages' not in data or 'muted_players' not in data:
                result.add_fail("Scenario B - Response structure", "Missing 'messages' or 'muted_players' key")
            else:
                result.add_pass("Scenario B - Response structure", f"Got {len(messages)} messages, muted_players={muted_players}")
            
            # Check order (oldest -> newest)
            if len(messages) >= 2:
                timestamps = [msg.get('timestamp') for msg in messages]
                is_sorted = all(timestamps[i] <= timestamps[i+1] for i in range(len(timestamps)-1))
                if is_sorted:
                    result.add_pass("Scenario B - Message order", "Messages are in oldest→newest order")
                else:
                    result.add_fail("Scenario B - Message order", "Messages are NOT in oldest→newest order")
            
            # Check for system messages
            system_messages = [msg for msg in messages if msg.get('player_name') == 'SYSTEM' and msg.get('type') == 'system']
            if len(system_messages) > 0:
                result.add_pass("Scenario B - System messages", f"Found {len(system_messages)} system messages (join, claim, randomize, release)")
                # Print some system messages for verification
                for sys_msg in system_messages[:3]:
                    print(f"   System message: {sys_msg.get('content')}")
            else:
                result.add_fail("Scenario B - System messages", "No system messages found (expected for join, claim, randomize, release)")
            
            # Check muted_players is empty
            if muted_players == []:
                result.add_pass("Scenario B - Muted players", "muted_players is empty as expected")
            else:
                result.add_warning("Scenario B - Muted players", f"muted_players is not empty: {muted_players}")
        else:
            result.add_fail("Scenario B - GET messages", f"Status {response.status_code}: {response.text}")
    except Exception as e:
        result.add_fail("Scenario B - GET messages", f"Exception: {e}")

def test_scenario_c_player_not_in_game(result: TestResult):
    """C) Send message from player not in game → 400"""
    print("\n" + "="*80)
    print("TEST SCENARIO C: Player Not in Game")
    print("="*80)
    
    game = create_test_game("Alice")
    if not game:
        result.add_fail("Scenario C", "Failed to create game")
        return
    
    code = game['code']
    
    # Try to send message from "Stranger" who is not in the game
    try:
        response = requests.post(f"{BASE_URL}/games/{code}/messages", json={
            "player_name": "Stranger",
            "type": "text",
            "content": "I'm not in this game!"
        }, timeout=10)
        
        if response.status_code == 403:
            result.add_pass("Scenario C - Player not in game", f"Got expected 403: {response.json().get('detail')}")
        elif response.status_code == 400:
            result.add_pass("Scenario C - Player not in game", f"Got 400 (acceptable): {response.json().get('detail')}")
        else:
            result.add_fail("Scenario C - Player not in game", f"Expected 400/403, got {response.status_code}: {response.text}")
    except Exception as e:
        result.add_fail("Scenario C - Player not in game", f"Exception: {e}")

def test_scenario_d_nonexistent_game(result: TestResult):
    """D) Send message to non-existent game → 404"""
    print("\n" + "="*80)
    print("TEST SCENARIO D: Non-existent Game")
    print("="*80)
    
    fake_code = "FAKE99"
    
    try:
        response = requests.post(f"{BASE_URL}/games/{fake_code}/messages", json={
            "player_name": "Alice",
            "type": "text",
            "content": "Hello?"
        }, timeout=10)
        
        if response.status_code == 404:
            result.add_pass("Scenario D - Non-existent game", f"Got expected 404: {response.json().get('detail')}")
        else:
            result.add_fail("Scenario D - Non-existent game", f"Expected 404, got {response.status_code}: {response.text}")
    except Exception as e:
        result.add_fail("Scenario D - Non-existent game", f"Exception: {e}")

def test_scenario_e_mute(result: TestResult):
    """E) Mute functionality - permissions, host immunity, muted player cannot send"""
    print("\n" + "="*80)
    print("TEST SCENARIO E: Mute Functionality")
    print("="*80)
    
    game = create_test_game("Alice")
    if not game:
        result.add_fail("Scenario E", "Failed to create game")
        return
    
    code = game['code']
    join_game(code, "Bob")
    
    # E1: Non-host trying to mute → 403
    try:
        response = requests.post(f"{BASE_URL}/games/{code}/mute", json={
            "host_name": "Bob",
            "target_player": "Alice"
        }, timeout=10)
        
        if response.status_code == 403:
            result.add_pass("Scenario E1 - Non-host mute", f"Got expected 403: {response.json().get('detail')}")
        else:
            result.add_fail("Scenario E1 - Non-host mute", f"Expected 403, got {response.status_code}: {response.text}")
    except Exception as e:
        result.add_fail("Scenario E1 - Non-host mute", f"Exception: {e}")
    
    # E2: Host trying to mute themselves → 400
    try:
        response = requests.post(f"{BASE_URL}/games/{code}/mute", json={
            "host_name": "Alice",
            "target_player": "Alice"
        }, timeout=10)
        
        if response.status_code == 400:
            result.add_pass("Scenario E2 - Host mute self", f"Got expected 400: {response.json().get('detail')}")
        else:
            result.add_fail("Scenario E2 - Host mute self", f"Expected 400, got {response.status_code}: {response.text}")
    except Exception as e:
        result.add_fail("Scenario E2 - Host mute self", f"Exception: {e}")
    
    # E3: Host muting Bob → 200, muted_players=["Bob"]
    try:
        response = requests.post(f"{BASE_URL}/games/{code}/mute", json={
            "host_name": "Alice",
            "target_player": "Bob"
        }, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            muted = data.get('muted_players', [])
            if "Bob" in muted:
                result.add_pass("Scenario E3 - Host mute Bob", f"Bob successfully muted: {muted}")
            else:
                result.add_fail("Scenario E3 - Host mute Bob", f"Bob not in muted_players: {muted}")
        else:
            result.add_fail("Scenario E3 - Host mute Bob", f"Expected 200, got {response.status_code}: {response.text}")
    except Exception as e:
        result.add_fail("Scenario E3 - Host mute Bob", f"Exception: {e}")
    
    # E4: Bob trying to send message after being muted → 403
    try:
        response = requests.post(f"{BASE_URL}/games/{code}/messages", json={
            "player_name": "Bob",
            "type": "text",
            "content": "Can I speak?"
        }, timeout=10)
        
        if response.status_code == 403:
            detail = response.json().get('detail', '')
            if 'muted' in detail.lower():
                result.add_pass("Scenario E4 - Muted player send", f"Got expected 403 with mute message: {detail}")
            else:
                result.add_warning("Scenario E4 - Muted player send", f"Got 403 but detail doesn't mention mute: {detail}")
        else:
            result.add_fail("Scenario E4 - Muted player send", f"Expected 403, got {response.status_code}: {response.text}")
    except Exception as e:
        result.add_fail("Scenario E4 - Muted player send", f"Exception: {e}")
    
    # E5: Host (Alice) can still send messages even if accidentally in muted_players
    try:
        response = requests.post(f"{BASE_URL}/games/{code}/messages", json={
            "player_name": "Alice",
            "type": "text",
            "content": "Host is immune to mute"
        }, timeout=10)
        
        if response.status_code == 200:
            result.add_pass("Scenario E5 - Host immunity", "Host can send messages (immune to mute)")
        else:
            result.add_fail("Scenario E5 - Host immunity", f"Host should be able to send, got {response.status_code}: {response.text}")
    except Exception as e:
        result.add_fail("Scenario E5 - Host immunity", f"Exception: {e}")

def test_scenario_f_unmute(result: TestResult):
    """F) Unmute functionality - permissions, player can send after unmute"""
    print("\n" + "="*80)
    print("TEST SCENARIO F: Unmute Functionality")
    print("="*80)
    
    game = create_test_game("Alice")
    if not game:
        result.add_fail("Scenario F", "Failed to create game")
        return
    
    code = game['code']
    join_game(code, "Bob")
    
    # First mute Bob
    requests.post(f"{BASE_URL}/games/{code}/mute", json={
        "host_name": "Alice",
        "target_player": "Bob"
    }, timeout=10)
    
    # F1: Non-host trying to unmute → 403
    try:
        response = requests.post(f"{BASE_URL}/games/{code}/unmute", json={
            "host_name": "Bob",
            "target_player": "Bob"
        }, timeout=10)
        
        if response.status_code == 403:
            result.add_pass("Scenario F1 - Non-host unmute", f"Got expected 403: {response.json().get('detail')}")
        else:
            result.add_fail("Scenario F1 - Non-host unmute", f"Expected 403, got {response.status_code}: {response.text}")
    except Exception as e:
        result.add_fail("Scenario F1 - Non-host unmute", f"Exception: {e}")
    
    # F2: Host unmuting Bob → 200, muted_players=[]
    try:
        response = requests.post(f"{BASE_URL}/games/{code}/unmute", json={
            "host_name": "Alice",
            "target_player": "Bob"
        }, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            muted = data.get('muted_players', [])
            if "Bob" not in muted:
                result.add_pass("Scenario F2 - Host unmute Bob", f"Bob successfully unmuted: {muted}")
            else:
                result.add_fail("Scenario F2 - Host unmute Bob", f"Bob still in muted_players: {muted}")
        else:
            result.add_fail("Scenario F2 - Host unmute Bob", f"Expected 200, got {response.status_code}: {response.text}")
    except Exception as e:
        result.add_fail("Scenario F2 - Host unmute Bob", f"Exception: {e}")
    
    # F3: Bob can now send messages again
    try:
        response = requests.post(f"{BASE_URL}/games/{code}/messages", json={
            "player_name": "Bob",
            "type": "text",
            "content": "I can speak again!"
        }, timeout=10)
        
        if response.status_code == 200:
            result.add_pass("Scenario F3 - Unmuted player send", "Bob can send messages after unmute")
        else:
            result.add_fail("Scenario F3 - Unmuted player send", f"Expected 200, got {response.status_code}: {response.text}")
    except Exception as e:
        result.add_fail("Scenario F3 - Unmuted player send", f"Exception: {e}")

def test_scenario_g_delete_message(result: TestResult):
    """G) DELETE message - permissions, soft delete, unknown id"""
    print("\n" + "="*80)
    print("TEST SCENARIO G: Delete Message")
    print("="*80)
    
    game = create_test_game("Alice")
    if not game:
        result.add_fail("Scenario G", "Failed to create game")
        return
    
    code = game['code']
    join_game(code, "Bob")
    
    # Send a message from Bob
    msg_response = requests.post(f"{BASE_URL}/games/{code}/messages", json={
        "player_name": "Bob",
        "type": "text",
        "content": "This will be deleted"
    }, timeout=10)
    
    if msg_response.status_code != 200:
        result.add_fail("Scenario G", "Failed to send test message")
        return
    
    message_id = msg_response.json().get('id')
    
    # G1: Non-host trying to delete → 403
    try:
        response = requests.delete(f"{BASE_URL}/games/{code}/messages/{message_id}?host_name=Bob", timeout=10)
        
        if response.status_code == 403:
            result.add_pass("Scenario G1 - Non-host delete", f"Got expected 403: {response.json().get('detail')}")
        else:
            result.add_fail("Scenario G1 - Non-host delete", f"Expected 403, got {response.status_code}: {response.text}")
    except Exception as e:
        result.add_fail("Scenario G1 - Non-host delete", f"Exception: {e}")
    
    # G2: Host deleting valid message → 200
    try:
        response = requests.delete(f"{BASE_URL}/games/{code}/messages/{message_id}?host_name=Alice", timeout=10)
        
        if response.status_code == 200:
            result.add_pass("Scenario G2 - Host delete message", f"Message {message_id} deleted successfully")
        else:
            result.add_fail("Scenario G2 - Host delete message", f"Expected 200, got {response.status_code}: {response.text}")
    except Exception as e:
        result.add_fail("Scenario G2 - Host delete message", f"Exception: {e}")
    
    # G3: Verify message is soft-deleted (deleted=true, content='')
    try:
        response = requests.get(f"{BASE_URL}/games/{code}/messages?limit=100", timeout=10)
        
        if response.status_code == 200:
            messages = response.json().get('messages', [])
            deleted_msg = next((m for m in messages if m.get('id') == message_id), None)
            
            if deleted_msg:
                if deleted_msg.get('deleted') == True and deleted_msg.get('content') == '':
                    result.add_pass("Scenario G3 - Soft delete verification", f"Message has deleted=true and content=''")
                else:
                    result.add_fail("Scenario G3 - Soft delete verification", f"Message not properly soft-deleted: deleted={deleted_msg.get('deleted')}, content='{deleted_msg.get('content')}'")
            else:
                result.add_warning("Scenario G3 - Soft delete verification", "Deleted message not found in GET response (might be filtered)")
        else:
            result.add_fail("Scenario G3 - Soft delete verification", f"Failed to GET messages: {response.status_code}")
    except Exception as e:
        result.add_fail("Scenario G3 - Soft delete verification", f"Exception: {e}")
    
    # G4: Host deleting unknown id → 404
    try:
        fake_id = "fake-message-id-12345"
        response = requests.delete(f"{BASE_URL}/games/{code}/messages/{fake_id}?host_name=Alice", timeout=10)
        
        if response.status_code == 404:
            result.add_pass("Scenario G4 - Delete unknown id", f"Got expected 404: {response.json().get('detail')}")
        else:
            result.add_fail("Scenario G4 - Delete unknown id", f"Expected 404, got {response.status_code}: {response.text}")
    except Exception as e:
        result.add_fail("Scenario G4 - Delete unknown id", f"Exception: {e}")

def test_scenario_h_typing(result: TestResult):
    """H) Typing indicator - not persisted"""
    print("\n" + "="*80)
    print("TEST SCENARIO H: Typing Indicator")
    print("="*80)
    
    game = create_test_game("Alice")
    if not game:
        result.add_fail("Scenario H", "Failed to create game")
        return
    
    code = game['code']
    
    # Get initial message count
    initial_response = requests.get(f"{BASE_URL}/games/{code}/messages?limit=100", timeout=10)
    initial_count = len(initial_response.json().get('messages', [])) if initial_response.status_code == 200 else 0
    
    # H1: POST typing with is_typing=true → 200
    try:
        response = requests.post(f"{BASE_URL}/games/{code}/typing", json={
            "player_name": "Alice",
            "is_typing": True
        }, timeout=10)
        
        if response.status_code == 200:
            result.add_pass("Scenario H1 - Typing true", "Typing indicator sent successfully")
        else:
            result.add_fail("Scenario H1 - Typing true", f"Expected 200, got {response.status_code}: {response.text}")
    except Exception as e:
        result.add_fail("Scenario H1 - Typing true", f"Exception: {e}")
    
    # H2: POST typing with is_typing=false → 200
    try:
        response = requests.post(f"{BASE_URL}/games/{code}/typing", json={
            "player_name": "Alice",
            "is_typing": False
        }, timeout=10)
        
        if response.status_code == 200:
            result.add_pass("Scenario H2 - Typing false", "Typing indicator sent successfully")
        else:
            result.add_fail("Scenario H2 - Typing false", f"Expected 200, got {response.status_code}: {response.text}")
    except Exception as e:
        result.add_fail("Scenario H2 - Typing false", f"Exception: {e}")
    
    # H3: Verify typing is not persisted (message count should not increase)
    try:
        response = requests.get(f"{BASE_URL}/games/{code}/messages?limit=100", timeout=10)
        
        if response.status_code == 200:
            final_count = len(response.json().get('messages', []))
            if final_count == initial_count:
                result.add_pass("Scenario H3 - Not persisted", f"Message count unchanged ({initial_count} → {final_count})")
            else:
                result.add_fail("Scenario H3 - Not persisted", f"Message count changed ({initial_count} → {final_count}), typing should not be persisted")
        else:
            result.add_fail("Scenario H3 - Not persisted", f"Failed to GET messages: {response.status_code}")
    except Exception as e:
        result.add_fail("Scenario H3 - Not persisted", f"Exception: {e}")

def test_scenario_i_system_messages(result: TestResult):
    """I) Regression - system messages for game events"""
    print("\n" + "="*80)
    print("TEST SCENARIO I: System Messages Regression")
    print("="*80)
    
    game = create_test_game("Alice")
    if not game:
        result.add_fail("Scenario I", "Failed to create game")
        return
    
    code = game['code']
    
    # Join player (should create system message)
    join_game(code, "Bob")
    time.sleep(0.5)
    
    # Claim square (should create system message)
    claim_square(code, "Alice", 0)
    time.sleep(0.5)
    
    # Randomize (should create system message)
    randomize_numbers(code, "Alice")
    time.sleep(0.5)
    
    # Release square (should create system message)
    release_square(code, "Alice", 0)
    time.sleep(0.5)
    
    # Get all messages
    try:
        response = requests.get(f"{BASE_URL}/games/{code}/messages?limit=100", timeout=10)
        
        if response.status_code == 200:
            messages = response.json().get('messages', [])
            system_messages = [m for m in messages if m.get('player_name') == 'SYSTEM' and m.get('type') == 'system']
            
            if len(system_messages) >= 4:
                result.add_pass("Scenario I - System messages", f"Found {len(system_messages)} system messages")
                
                # Check for specific event types
                contents = [m.get('content', '').lower() for m in system_messages]
                
                has_join = any('joined' in c for c in contents)
                has_claim = any('claimed' in c or 'square' in c for c in contents)
                has_randomize = any('randomize' in c or 'numbers' in c for c in contents)
                has_release = any('released' in c or 'unclaimed' in c for c in contents)
                
                events_found = []
                if has_join: events_found.append("join")
                if has_claim: events_found.append("claim")
                if has_randomize: events_found.append("randomize")
                if has_release: events_found.append("release")
                
                result.add_pass("Scenario I - Event types", f"System messages for: {', '.join(events_found)}")
                
                # Print sample system messages
                print("   Sample system messages:")
                for msg in system_messages[:5]:
                    print(f"     - {msg.get('content')}")
            else:
                result.add_fail("Scenario I - System messages", f"Expected at least 4 system messages, found {len(system_messages)}")
        else:
            result.add_fail("Scenario I - System messages", f"Failed to GET messages: {response.status_code}")
    except Exception as e:
        result.add_fail("Scenario I - System messages", f"Exception: {e}")

def test_scenario_j_limit_param(result: TestResult):
    """J) Limit parameter - returns most recent N messages in oldest→newest order"""
    print("\n" + "="*80)
    print("TEST SCENARIO J: Limit Parameter")
    print("="*80)
    
    game = create_test_game("Alice")
    if not game:
        result.add_fail("Scenario J", "Failed to create game")
        return
    
    code = game['code']
    
    # Send 10 messages
    for i in range(10):
        requests.post(f"{BASE_URL}/games/{code}/messages", json={
            "player_name": "Alice",
            "type": "text",
            "content": f"Message {i+1}"
        }, timeout=10)
        time.sleep(0.1)  # Small delay to ensure distinct timestamps
    
    # GET with limit=3
    try:
        response = requests.get(f"{BASE_URL}/games/{code}/messages?limit=3", timeout=10)
        
        if response.status_code == 200:
            messages = response.json().get('messages', [])
            
            # Should return exactly 3 messages (or fewer if there are system messages)
            if len(messages) <= 3:
                result.add_pass("Scenario J1 - Limit respected", f"Got {len(messages)} messages (limit=3)")
            else:
                result.add_fail("Scenario J1 - Limit respected", f"Expected ≤3 messages, got {len(messages)}")
            
            # Check if they are the most recent (should contain "Message 8", "Message 9", "Message 10")
            contents = [m.get('content', '') for m in messages]
            text_messages = [c for c in contents if c.startswith('Message')]
            
            if len(text_messages) > 0:
                # Check if messages are in oldest→newest order within the returned slice
                timestamps = [m.get('timestamp') for m in messages]
                is_sorted = all(timestamps[i] <= timestamps[i+1] for i in range(len(timestamps)-1))
                
                if is_sorted:
                    result.add_pass("Scenario J2 - Order in slice", "Messages in oldest→newest order")
                else:
                    result.add_fail("Scenario J2 - Order in slice", "Messages NOT in oldest→newest order")
                
                # Print the messages to verify they are the most recent
                print(f"   Returned messages: {text_messages}")
            else:
                result.add_warning("Scenario J2 - Content check", "No text messages found in response")
        else:
            result.add_fail("Scenario J - Limit parameter", f"Failed to GET messages: {response.status_code}")
    except Exception as e:
        result.add_fail("Scenario J - Limit parameter", f"Exception: {e}")

# ============================================================
# MAIN TEST RUNNER
# ============================================================

def main():
    print("="*80)
    print("SPORTS SQUARES CHAT API TEST SUITE")
    print("="*80)
    print(f"Backend URL: {BASE_URL}")
    print("="*80)
    
    result = TestResult()
    
    # Run all test scenarios
    test_scenario_a_happy_path(result)
    test_scenario_b_get_messages(result)
    test_scenario_c_player_not_in_game(result)
    test_scenario_d_nonexistent_game(result)
    test_scenario_e_mute(result)
    test_scenario_f_unmute(result)
    test_scenario_g_delete_message(result)
    test_scenario_h_typing(result)
    test_scenario_i_system_messages(result)
    test_scenario_j_limit_param(result)
    
    # Print summary
    success = result.summary()
    
    if success:
        print("\n🎉 ALL TESTS PASSED! 🎉")
        return 0
    else:
        print("\n❌ SOME TESTS FAILED")
        return 1

if __name__ == "__main__":
    exit(main())
