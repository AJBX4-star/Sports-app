#!/usr/bin/env python3
"""
Backend API Testing for Sports Squares App
Tests the Player Style API endpoint and regression tests for related endpoints.
"""

import requests
import json
import base64
import os
from typing import Dict, Any

# Get backend URL from environment
BACKEND_URL = "https://sports-squares-debug.preview.emergentagent.com/api"

class TestRunner:
    def __init__(self):
        self.test_results = []
        self.game_code = None
        self.host_id = "test-host-123"
        
    def log_test(self, test_name: str, passed: bool, details: str = ""):
        """Log test result"""
        status = "✅ PASS" if passed else "❌ FAIL"
        self.test_results.append({
            'test': test_name,
            'passed': passed,
            'details': details
        })
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
        print()
    
    def create_test_game(self) -> str:
        """Create a test game and return the game code"""
        try:
            response = requests.post(f"{BACKEND_URL}/games", json={
                "host_id": self.host_id,
                "host_name": "Alice",
                "team_horizontal": "Team A",
                "team_vertical": "Team B"
            })
            
            if response.status_code == 200:
                game_data = response.json()
                self.game_code = game_data['code']
                
                # Verify player_styles field exists and is empty dict
                player_styles = game_data.get('player_styles', None)
                if player_styles == {}:
                    self.log_test("Create Game - player_styles field", True, "Empty dict {} present")
                else:
                    self.log_test("Create Game - player_styles field", False, f"Expected empty dict, got: {player_styles}")
                
                return self.game_code
            else:
                self.log_test("Create Game", False, f"Status: {response.status_code}, Response: {response.text}")
                return None
                
        except Exception as e:
            self.log_test("Create Game", False, f"Exception: {str(e)}")
            return None
    
    def join_player(self, player_name: str) -> bool:
        """Add a player to the game"""
        try:
            response = requests.post(f"{BACKEND_URL}/games/{self.game_code}/join", json={
                "code": self.game_code,
                "player_name": player_name
            })
            
            if response.status_code == 200:
                game_data = response.json()
                # Verify player_styles field is still present and unchanged
                player_styles = game_data.get('player_styles', None)
                if player_styles == {}:
                    self.log_test(f"Join Player {player_name} - player_styles unchanged", True)
                else:
                    self.log_test(f"Join Player {player_name} - player_styles unchanged", False, f"Expected empty dict, got: {player_styles}")
                return True
            else:
                self.log_test(f"Join Player {player_name}", False, f"Status: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test(f"Join Player {player_name}", False, f"Exception: {str(e)}")
            return False
    
    def claim_square(self, position: int, player_name: str) -> bool:
        """Claim a square for a player"""
        try:
            response = requests.post(f"{BACKEND_URL}/games/{self.game_code}/claim", json={
                "position": position,
                "player_name": player_name
            })
            
            if response.status_code == 200:
                game_data = response.json()
                # Verify player_styles field is still present
                player_styles = game_data.get('player_styles', None)
                if isinstance(player_styles, dict):
                    self.log_test(f"Claim Square {position} by {player_name} - player_styles preserved", True)
                else:
                    self.log_test(f"Claim Square {position} by {player_name} - player_styles preserved", False, f"Expected dict, got: {player_styles}")
                return True
            else:
                self.log_test(f"Claim Square {position} by {player_name}", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test(f"Claim Square {position} by {player_name}", False, f"Exception: {str(e)}")
            return False
    
    def test_player_style_happy_path(self):
        """Test 1: Happy path - Player sets own style"""
        try:
            # Alice sets her own style
            response = requests.post(f"{BACKEND_URL}/games/{self.game_code}/player-style", json={
                "player_name": "Alice",
                "requester_name": "Alice",
                "color": "#FF0000",
                "pattern": "football",
                "image": "data:image/jpeg;base64,abc123"
            })
            
            if response.status_code == 200:
                game_data = response.json()
                player_styles = game_data.get('player_styles', {})
                alice_style = player_styles.get('Alice', {})
                
                expected_style = {
                    "color": "#FF0000",
                    "pattern": "football", 
                    "image": "data:image/jpeg;base64,abc123"
                }
                
                if alice_style == expected_style:
                    self.log_test("Happy Path - Alice sets own style", True, f"Style correctly set: {alice_style}")
                else:
                    self.log_test("Happy Path - Alice sets own style", False, f"Expected: {expected_style}, Got: {alice_style}")
            else:
                self.log_test("Happy Path - Alice sets own style", False, f"Status: {response.status_code}, Response: {response.text}")
                
        except Exception as e:
            self.log_test("Happy Path - Alice sets own style", False, f"Exception: {str(e)}")
    
    def test_color_uniqueness_conflict(self):
        """Test 2: Color uniqueness (409 Conflict)"""
        try:
            # Bob tries to set the same color as Alice (#FF0000)
            response = requests.post(f"{BACKEND_URL}/games/{self.game_code}/player-style", json={
                "player_name": "Bob",
                "requester_name": "Bob",
                "color": "#FF0000",
                "pattern": "basketball",
                "image": None
            })
            
            if response.status_code == 409:
                error_detail = response.json().get('detail', '')
                if 'Alice' in error_detail and 'already taken' in error_detail.lower():
                    self.log_test("Color Uniqueness - 409 Conflict", True, f"Correct error: {error_detail}")
                else:
                    self.log_test("Color Uniqueness - 409 Conflict", False, f"Wrong error message: {error_detail}")
            else:
                self.log_test("Color Uniqueness - 409 Conflict", False, f"Expected 409, got {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Color Uniqueness - 409 Conflict", False, f"Exception: {str(e)}")
    
    def test_color_uniqueness_success(self):
        """Test 2b: Bob sets a different color successfully"""
        try:
            # Bob sets a different color
            response = requests.post(f"{BACKEND_URL}/games/{self.game_code}/player-style", json={
                "player_name": "Bob",
                "requester_name": "Bob",
                "color": "#0000FF",
                "pattern": "basketball",
                "image": None
            })
            
            if response.status_code == 200:
                game_data = response.json()
                player_styles = game_data.get('player_styles', {})
                bob_style = player_styles.get('Bob', {})
                
                expected_style = {
                    "color": "#0000FF",
                    "pattern": "basketball",
                    "image": None
                }
                
                if bob_style == expected_style:
                    self.log_test("Color Uniqueness - Bob sets different color", True, f"Bob's style: {bob_style}")
                else:
                    self.log_test("Color Uniqueness - Bob sets different color", False, f"Expected: {expected_style}, Got: {bob_style}")
            else:
                self.log_test("Color Uniqueness - Bob sets different color", False, f"Status: {response.status_code}, Response: {response.text}")
                
        except Exception as e:
            self.log_test("Color Uniqueness - Bob sets different color", False, f"Exception: {str(e)}")
    
    def test_permission_non_owner_403(self):
        """Test 3: Permission - non-owner non-host gets 403"""
        try:
            # Bob tries to update Alice's style
            response = requests.post(f"{BACKEND_URL}/games/{self.game_code}/player-style", json={
                "player_name": "Alice",
                "requester_name": "Bob",
                "color": "#00FF00",
                "pattern": "soccer",
                "image": None
            })
            
            if response.status_code == 403:
                error_detail = response.json().get('detail', '')
                if 'only customize your own' in error_detail.lower():
                    self.log_test("Permission - Non-owner 403", True, f"Correct error: {error_detail}")
                else:
                    self.log_test("Permission - Non-owner 403", False, f"Wrong error message: {error_detail}")
            else:
                self.log_test("Permission - Non-owner 403", False, f"Expected 403, got {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Permission - Non-owner 403", False, f"Exception: {str(e)}")
    
    def test_permission_host_can_update_any(self):
        """Test 4: Permission - host can update any player's style"""
        try:
            # Alice (host) updates Bob's style
            response = requests.post(f"{BACKEND_URL}/games/{self.game_code}/player-style", json={
                "player_name": "Bob",
                "requester_name": "Alice",
                "color": "#00FF00",
                "pattern": "soccer",
                "image": None
            })
            
            if response.status_code == 200:
                game_data = response.json()
                player_styles = game_data.get('player_styles', {})
                bob_style = player_styles.get('Bob', {})
                
                expected_style = {
                    "color": "#00FF00",
                    "pattern": "soccer",
                    "image": None
                }
                
                if bob_style == expected_style:
                    self.log_test("Permission - Host updates any player", True, f"Bob's updated style: {bob_style}")
                else:
                    self.log_test("Permission - Host updates any player", False, f"Expected: {expected_style}, Got: {bob_style}")
            else:
                self.log_test("Permission - Host updates any player", False, f"Status: {response.status_code}, Response: {response.text}")
                
        except Exception as e:
            self.log_test("Permission - Host updates any player", False, f"Exception: {str(e)}")
    
    def test_player_not_in_game_400(self):
        """Test 5: Player not in game (400)"""
        try:
            # Stranger tries to set style
            response = requests.post(f"{BACKEND_URL}/games/{self.game_code}/player-style", json={
                "player_name": "Stranger",
                "requester_name": "Stranger",
                "color": "#FFFF00",
                "pattern": "tennis",
                "image": None
            })
            
            if response.status_code == 400:
                error_detail = response.json().get('detail', '')
                if 'not in this game' in error_detail.lower():
                    self.log_test("Player Not In Game - 400", True, f"Correct error: {error_detail}")
                else:
                    self.log_test("Player Not In Game - 400", False, f"Wrong error message: {error_detail}")
            else:
                self.log_test("Player Not In Game - 400", False, f"Expected 400, got {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Player Not In Game - 400", False, f"Exception: {str(e)}")
    
    def test_game_not_found_404(self):
        """Test 6: Game not found (404)"""
        try:
            # Use non-existent game code
            response = requests.post(f"{BACKEND_URL}/games/NONEXIST/player-style", json={
                "player_name": "Alice",
                "requester_name": "Alice",
                "color": "#FF0000",
                "pattern": "football",
                "image": None
            })
            
            if response.status_code == 404:
                error_detail = response.json().get('detail', '')
                if 'not found' in error_detail.lower():
                    self.log_test("Game Not Found - 404", True, f"Correct error: {error_detail}")
                else:
                    self.log_test("Game Not Found - 404", False, f"Wrong error message: {error_detail}")
            else:
                self.log_test("Game Not Found - 404", False, f"Expected 404, got {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Game Not Found - 404", False, f"Exception: {str(e)}")
    
    def test_clear_style_null_values(self):
        """Test 7: Clear style (null values)"""
        try:
            # Alice clears her style
            response = requests.post(f"{BACKEND_URL}/games/{self.game_code}/player-style", json={
                "player_name": "Alice",
                "requester_name": "Alice",
                "color": None,
                "pattern": None,
                "image": None
            })
            
            if response.status_code == 200:
                game_data = response.json()
                player_styles = game_data.get('player_styles', {})
                alice_style = player_styles.get('Alice', {})
                
                expected_style = {
                    "color": None,
                    "pattern": None,
                    "image": None
                }
                
                if alice_style == expected_style:
                    self.log_test("Clear Style - Null values", True, f"Alice's cleared style: {alice_style}")
                    
                    # Now Bob should be able to set #FF0000 (Alice freed it)
                    response2 = requests.post(f"{BACKEND_URL}/games/{self.game_code}/player-style", json={
                        "player_name": "Bob",
                        "requester_name": "Bob",
                        "color": "#FF0000",
                        "pattern": "football",
                        "image": None
                    })
                    
                    if response2.status_code == 200:
                        self.log_test("Clear Style - Bob can now use freed color", True, "Bob successfully set #FF0000")
                    else:
                        self.log_test("Clear Style - Bob can now use freed color", False, f"Bob couldn't set freed color: {response2.status_code}")
                        
                else:
                    self.log_test("Clear Style - Null values", False, f"Expected: {expected_style}, Got: {alice_style}")
            else:
                self.log_test("Clear Style - Null values", False, f"Status: {response.status_code}, Response: {response.text}")
                
        except Exception as e:
            self.log_test("Clear Style - Null values", False, f"Exception: {str(e)}")
    
    def test_large_image_storage(self):
        """Test 8: Image storage (large base64)"""
        try:
            # Generate a moderately large base64 string (5KB)
            large_data = "A" * 5000  # 5KB of 'A' characters
            large_base64 = base64.b64encode(large_data.encode()).decode()
            large_image = f"data:image/jpeg;base64,{large_base64}"
            
            response = requests.post(f"{BACKEND_URL}/games/{self.game_code}/player-style", json={
                "player_name": "Alice",
                "requester_name": "Alice",
                "color": "#FFFF00",
                "pattern": "baseball",
                "image": large_image
            })
            
            if response.status_code == 200:
                game_data = response.json()
                player_styles = game_data.get('player_styles', {})
                alice_style = player_styles.get('Alice', {})
                
                returned_image = alice_style.get('image', '')
                if returned_image == large_image:
                    self.log_test("Large Image Storage", True, f"Large image ({len(large_image)} chars) stored and returned correctly")
                else:
                    self.log_test("Large Image Storage", False, f"Image mismatch. Expected length: {len(large_image)}, Got length: {len(returned_image)}")
            else:
                self.log_test("Large Image Storage", False, f"Status: {response.status_code}, Response: {response.text}")
                
        except Exception as e:
            self.log_test("Large Image Storage", False, f"Exception: {str(e)}")
    
    def run_all_tests(self):
        """Run all Player Style API tests"""
        print("=== PLAYER STYLE API TESTING ===\n")
        
        # Setup: Create game and add players
        if not self.create_test_game():
            print("❌ Failed to create test game. Aborting tests.")
            return
            
        if not self.join_player("Bob"):
            print("❌ Failed to add Bob to game. Aborting tests.")
            return
            
        # Alice claims a square (she's the host)
        if not self.claim_square(0, "Alice"):
            print("❌ Failed to claim square for Alice. Aborting tests.")
            return
            
        # Run all Player Style API tests
        self.test_player_style_happy_path()
        self.test_color_uniqueness_conflict()
        self.test_color_uniqueness_success()
        self.test_permission_non_owner_403()
        self.test_permission_host_can_update_any()
        self.test_player_not_in_game_400()
        self.test_game_not_found_404()
        self.test_clear_style_null_values()
        self.test_large_image_storage()
        
        # Print summary
        print("\n=== TEST SUMMARY ===")
        passed = sum(1 for result in self.test_results if result['passed'])
        total = len(self.test_results)
        print(f"Passed: {passed}/{total}")
        
        if passed < total:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result['passed']:
                    print(f"  - {result['test']}: {result['details']}")
        else:
            print("\n✅ ALL TESTS PASSED!")
        
        return passed == total

if __name__ == "__main__":
    runner = TestRunner()
    success = runner.run_all_tests()
    exit(0 if success else 1)