#!/usr/bin/env python3
"""
Backend API Testing for Sports Squares App
Focus: Release Square API (Host removes erroneous picks)
"""

import requests
import json
import sys
import time
from typing import Dict, Any, Optional

# Backend URL from frontend/.env
BACKEND_URL = "https://sports-squares-debug.preview.emergentagent.com/api"

class TestResult:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.errors = []
    
    def success(self, test_name: str):
        self.passed += 1
        print(f"✅ {test_name}")
    
    def failure(self, test_name: str, error: str):
        self.failed += 1
        self.errors.append(f"{test_name}: {error}")
        print(f"❌ {test_name}: {error}")
    
    def summary(self):
        total = self.passed + self.failed
        print(f"\n=== TEST SUMMARY ===")
        print(f"Total: {total}, Passed: {self.passed}, Failed: {self.failed}")
        if self.errors:
            print("\nFAILURES:")
            for error in self.errors:
                print(f"  - {error}")
        return self.failed == 0

def make_request(method: str, endpoint: str, data: Optional[Dict] = None) -> requests.Response:
    """Make HTTP request with error handling"""
    url = f"{BACKEND_URL}{endpoint}"
    try:
        if method.upper() == "GET":
            response = requests.get(url, timeout=10)
        elif method.upper() == "POST":
            response = requests.post(url, json=data, timeout=10)
        elif method.upper() == "PUT":
            response = requests.put(url, json=data, timeout=10)
        else:
            raise ValueError(f"Unsupported method: {method}")
        return response
    except requests.exceptions.RequestException as e:
        print(f"Request failed: {e}")
        raise

def test_release_square_api():
    """Test the Release Square API endpoint"""
    result = TestResult()
    
    # Test data
    host_name = "Alice"
    player_name = "Bob"
    
    try:
        print("=== TESTING RELEASE SQUARE API ===\n")
        
        # 1. Create a game
        print("1. Creating game...")
        create_response = make_request("POST", "/games", {
            "host_id": "host123",
            "host_name": host_name,
            "team_horizontal": "Team A",
            "team_vertical": "Team B"
        })
        
        if create_response.status_code != 200:
            result.failure("Create game", f"Expected 200, got {create_response.status_code}")
            return result
        
        game_data = create_response.json()
        game_code = game_data["code"]
        print(f"Game created with code: {game_code}")
        
        # 2. Join player Bob
        print("2. Adding player Bob...")
        join_response = make_request("POST", f"/games/{game_code}/join", {
            "code": game_code,
            "player_name": player_name
        })
        
        if join_response.status_code != 200:
            result.failure("Join game", f"Expected 200, got {join_response.status_code}")
            return result
        
        # 3. Alice claims square 5 (her turn)
        print("3. Alice claims square 5...")
        claim_response = make_request("POST", f"/games/{game_code}/claim", {
            "position": 5,
            "player_name": host_name
        })
        
        if claim_response.status_code != 200:
            result.failure("Alice claim square 5", f"Expected 200, got {claim_response.status_code}")
            return result
        
        # 4. Bob claims square 10 (his turn)
        print("4. Bob claims square 10...")
        claim_response = make_request("POST", f"/games/{game_code}/claim", {
            "position": 10,
            "player_name": player_name
        })
        
        if claim_response.status_code != 200:
            result.failure("Bob claim square 10", f"Expected 200, got {claim_response.status_code}")
            return result
        
        # TEST 1: Happy path - Host releases a player's pick
        print("\n=== TEST 1: Happy path - Host releases Alice's square 5 ===")
        release_response = make_request("POST", f"/games/{game_code}/release-square", {
            "position": 5,
            "host_name": host_name
        })
        
        if release_response.status_code == 200:
            release_data = release_response.json()
            square_5 = release_data["squares"][5]
            
            if (not square_5.get("claimed", True) and 
                square_5.get("player_name") is None and 
                not square_5.get("locked", True) and
                not release_data.get("board_locked", True)):
                result.success("Happy path - Release square 5")
            else:
                result.failure("Happy path - Release square 5", 
                             f"Square not properly released: claimed={square_5.get('claimed')}, player_name={square_5.get('player_name')}, locked={square_5.get('locked')}")
        else:
            result.failure("Happy path - Release square 5", 
                         f"Expected 200, got {release_response.status_code}: {release_response.text}")
        
        # TEST 2: Permission - non-host gets 403
        print("\n=== TEST 2: Permission check - Non-host tries to release ===")
        release_response = make_request("POST", f"/games/{game_code}/release-square", {
            "position": 10,
            "host_name": player_name  # Bob trying to release (not host)
        })
        
        if release_response.status_code == 403:
            response_data = release_response.json()
            if "Only the host can release squares" in response_data.get("detail", ""):
                result.success("Permission check - Non-host gets 403")
            else:
                result.failure("Permission check - Non-host gets 403", 
                             f"Wrong error message: {response_data.get('detail')}")
        else:
            result.failure("Permission check - Non-host gets 403", 
                         f"Expected 403, got {release_response.status_code}")
        
        # TEST 3: Cannot release unclaimed square
        print("\n=== TEST 3: Cannot release unclaimed square ===")
        release_response = make_request("POST", f"/games/{game_code}/release-square", {
            "position": 50,  # Unclaimed square
            "host_name": host_name
        })
        
        if release_response.status_code == 400:
            response_data = release_response.json()
            if "Square is not claimed" in response_data.get("detail", ""):
                result.success("Cannot release unclaimed square")
            else:
                result.failure("Cannot release unclaimed square", 
                             f"Wrong error message: {response_data.get('detail')}")
        else:
            result.failure("Cannot release unclaimed square", 
                         f"Expected 400, got {release_response.status_code}")
        
        # TEST 4: Cannot release a square that already won a quarter
        print("\n=== TEST 4: Cannot release square that won a quarter ===")
        
        # First, claim more squares and randomize numbers
        print("4a. Claiming more squares...")
        for pos in [15, 25, 35, 45]:
            make_request("POST", f"/games/{game_code}/claim", {
                "position": pos,
                "player_name": host_name if pos % 2 == 1 else player_name
            })
        
        # Lock the board by claiming all remaining squares (simplified - just claim enough)
        print("4b. Claiming enough squares to lock board...")
        positions_to_claim = list(range(0, 100))
        claimed_positions = [5, 10, 15, 25, 35, 45]  # Already claimed
        unclaimed = [p for p in positions_to_claim if p not in claimed_positions]
        
        # Claim first 10 more squares to have enough for testing
        for i, pos in enumerate(unclaimed[:10]):
            make_request("POST", f"/games/{game_code}/claim", {
                "position": pos,
                "player_name": host_name if i % 2 == 0 else player_name
            })
        
        # Randomize numbers
        print("4c. Randomizing numbers...")
        randomize_response = make_request("POST", f"/games/{game_code}/randomize")
        if randomize_response.status_code != 200:
            print(f"Warning: Could not randomize numbers: {randomize_response.status_code}")
        
        # Set a winner on square 10
        print("4d. Setting winner on square 10...")
        winner_response = make_request("POST", f"/games/{game_code}/winner", {
            "quarter": 1,
            "position": 10
        })
        
        if winner_response.status_code == 200:
            # Now try to release the winning square
            release_response = make_request("POST", f"/games/{game_code}/release-square", {
                "position": 10,
                "host_name": host_name
            })
            
            if release_response.status_code == 400:
                response_data = release_response.json()
                if "already won" in response_data.get("detail", "").lower():
                    result.success("Cannot release winning square")
                else:
                    result.failure("Cannot release winning square", 
                                 f"Wrong error message: {response_data.get('detail')}")
            else:
                result.failure("Cannot release winning square", 
                             f"Expected 400, got {release_response.status_code}")
        else:
            result.failure("Cannot release winning square", 
                         f"Could not set winner: {winner_response.status_code}")
        
        # TEST 5: Game not found (404)
        print("\n=== TEST 5: Game not found ===")
        release_response = make_request("POST", "/games/FAKE123/release-square", {
            "position": 5,
            "host_name": host_name
        })
        
        if release_response.status_code == 404:
            result.success("Game not found - 404")
        else:
            result.failure("Game not found - 404", 
                         f"Expected 404, got {release_response.status_code}")
        
        # TEST 6: Invalid position
        print("\n=== TEST 6: Invalid position ===")
        
        # Test position -1
        release_response = make_request("POST", f"/games/{game_code}/release-square", {
            "position": -1,
            "host_name": host_name
        })
        
        if release_response.status_code == 400:
            response_data = release_response.json()
            if "Invalid position" in response_data.get("detail", ""):
                result.success("Invalid position -1")
            else:
                result.failure("Invalid position -1", 
                             f"Wrong error message: {response_data.get('detail')}")
        else:
            result.failure("Invalid position -1", 
                         f"Expected 400, got {release_response.status_code}")
        
        # Test position 100
        release_response = make_request("POST", f"/games/{game_code}/release-square", {
            "position": 100,
            "host_name": host_name
        })
        
        if release_response.status_code == 400:
            response_data = release_response.json()
            if "Invalid position" in response_data.get("detail", ""):
                result.success("Invalid position 100")
            else:
                result.failure("Invalid position 100", 
                             f"Wrong error message: {response_data.get('detail')}")
        else:
            result.failure("Invalid position 100", 
                         f"Expected 400, got {release_response.status_code}")
        
        # TEST 7: Released square can be re-claimed
        print("\n=== TEST 7: Released square can be re-claimed ===")
        
        # Create a new game for this test to have clean state
        create_response = make_request("POST", "/games", {
            "host_id": "host456",
            "host_name": host_name,
            "team_horizontal": "Team A",
            "team_vertical": "Team B"
        })
        
        if create_response.status_code == 200:
            new_game_data = create_response.json()
            new_game_code = new_game_data["code"]
            
            # Join Bob and Charlie to have 3 players (snake draft pattern)
            make_request("POST", f"/games/{new_game_code}/join", {
                "code": new_game_code,
                "player_name": player_name
            })
            make_request("POST", f"/games/{new_game_code}/join", {
                "code": new_game_code,
                "player_name": "Charlie"
            })
            
            # Alice claims square 5 (her turn)
            make_request("POST", f"/games/{new_game_code}/claim", {
                "position": 5,
                "player_name": host_name
            })
            
            # Release square 5
            release_response = make_request("POST", f"/games/{new_game_code}/release-square", {
                "position": 5,
                "host_name": host_name
            })
            
            if release_response.status_code == 200:
                # Bob claims a square (his turn)
                make_request("POST", f"/games/{new_game_code}/claim", {
                    "position": 15,
                    "player_name": player_name
                })
                
                # Charlie claims a square (his turn)
                make_request("POST", f"/games/{new_game_code}/claim", {
                    "position": 25,
                    "player_name": "Charlie"
                })
                
                # Charlie claims another square (snake draft - he gets 2 consecutive turns)
                make_request("POST", f"/games/{new_game_code}/claim", {
                    "position": 35,
                    "player_name": "Charlie"
                })
                
                # Bob claims another square (his turn in reverse snake)
                make_request("POST", f"/games/{new_game_code}/claim", {
                    "position": 45,
                    "player_name": player_name
                })
                
                # Now it's Alice's turn again - try to claim square 5 again
                reclaim_response = make_request("POST", f"/games/{new_game_code}/claim", {
                    "position": 5,
                    "player_name": host_name
                })
                
                if reclaim_response.status_code == 200:
                    reclaim_data = reclaim_response.json()
                    square_5 = reclaim_data["squares"][5]
                    
                    if (square_5.get("claimed", False) and 
                        square_5.get("player_name") == host_name and 
                        square_5.get("locked", False)):
                        result.success("Released square can be re-claimed")
                    else:
                        result.failure("Released square can be re-claimed", 
                                     f"Square not properly re-claimed: {square_5}")
                else:
                    result.failure("Released square can be re-claimed", 
                                 f"Could not re-claim: {reclaim_response.status_code}")
            else:
                result.failure("Released square can be re-claimed", 
                             f"Could not release square: {release_response.status_code}")
        else:
            result.failure("Released square can be re-claimed", 
                         f"Could not create new game: {create_response.status_code}")
        
        # REGRESSION TEST: Quick smoke test
        print("\n=== REGRESSION TEST: End-to-end flow ===")
        
        # Create → Join → Claim → Randomize → Winner
        create_response = make_request("POST", "/games", {
            "host_id": "regression123",
            "host_name": "TestHost",
            "team_horizontal": "Team A",
            "team_vertical": "Team B"
        })
        
        if create_response.status_code == 200:
            reg_game_data = create_response.json()
            reg_game_code = reg_game_data["code"]
            
            # Join
            join_response = make_request("POST", f"/games/{reg_game_code}/join", {
                "code": reg_game_code,
                "player_name": "TestPlayer"
            })
            
            # Claim using host-claim to bypass turn restrictions
            claim_response = make_request("POST", f"/games/{reg_game_code}/host-claim", {
                "position": 0,
                "player_name": "TestHost"
            })
            
            # Claim more squares using host-claim to lock board quickly
            for pos in range(1, 100):
                make_request("POST", f"/games/{reg_game_code}/host-claim", {
                    "position": pos,
                    "player_name": "TestHost" if pos % 2 == 0 else "TestPlayer"
                })
            
            # Randomize
            randomize_response = make_request("POST", f"/games/{reg_game_code}/randomize")
            
            # Winner
            winner_response = make_request("POST", f"/games/{reg_game_code}/winner", {
                "quarter": 1,
                "position": 0
            })
            
            if all(r.status_code == 200 for r in [join_response, claim_response, randomize_response, winner_response]):
                result.success("Regression test - End-to-end flow")
            else:
                result.failure("Regression test - End-to-end flow", 
                             f"Some endpoints failed: join={join_response.status_code}, claim={claim_response.status_code}, randomize={randomize_response.status_code}, winner={winner_response.status_code}")
        else:
            result.failure("Regression test - End-to-end flow", 
                         f"Could not create game: {create_response.status_code}")
        
    except Exception as e:
        result.failure("Test execution", f"Unexpected error: {str(e)}")
    
    return result

if __name__ == "__main__":
    print("Starting Release Square API Tests...")
    print(f"Backend URL: {BACKEND_URL}")
    print("=" * 50)
    
    result = test_release_square_api()
    success = result.summary()
    
    sys.exit(0 if success else 1)