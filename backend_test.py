#!/usr/bin/env python3
"""
Sports Squares Backend API Testing
Tests the new Customize Square API endpoint and regression tests for Square model changes.
"""

import requests
import json
import uuid
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
        print(f"\n📊 Test Summary: {self.passed}/{total} passed")
        if self.errors:
            print("\n🔍 Failures:")
            for error in self.errors:
                print(f"  - {error}")

def make_request(method: str, endpoint: str, data: Optional[Dict] = None) -> requests.Response:
    """Make HTTP request to backend API"""
    url = f"{BACKEND_URL}{endpoint}"
    headers = {"Content-Type": "application/json"}
    
    try:
        if method.upper() == "GET":
            response = requests.get(url, headers=headers, timeout=10)
        elif method.upper() == "POST":
            response = requests.post(url, json=data, headers=headers, timeout=10)
        elif method.upper() == "PUT":
            response = requests.put(url, json=data, headers=headers, timeout=10)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        return response
    except requests.exceptions.RequestException as e:
        print(f"Request failed: {e}")
        raise

def test_customize_square_api():
    """Test the new Customize Square API endpoint"""
    result = TestResult()
    
    print("🧪 Testing Customize Square API...")
    
    # Test 1: Happy path - Player customizes own square
    try:
        # Create a game with host "Alice"
        create_response = make_request("POST", "/games", {
            "host_id": str(uuid.uuid4()),
            "host_name": "Alice",
            "team_horizontal": "Team A",
            "team_vertical": "Team B"
        })
        
        if create_response.status_code != 200:
            result.failure("Create game for customize test", f"Status {create_response.status_code}: {create_response.text}")
            return result
        
        game_data = create_response.json()
        game_code = game_data["code"]
        
        # Alice claims square at position 5
        claim_response = make_request("POST", f"/games/{game_code}/claim", {
            "position": 5,
            "player_name": "Alice",
            "claimed_by_host": False
        })
        
        if claim_response.status_code != 200:
            result.failure("Alice claims square 5", f"Status {claim_response.status_code}: {claim_response.text}")
            return result
        
        # Alice customizes her square
        customize_response = make_request("POST", f"/games/{game_code}/customize-square", {
            "position": 5,
            "player_name": "Alice",
            "color": "#FF5722",
            "pattern": "football"
        })
        
        if customize_response.status_code == 200:
            customize_data = customize_response.json()
            square = customize_data["squares"][5]
            if square.get("color") == "#FF5722" and square.get("pattern") == "football":
                result.success("Happy path - Player customizes own square")
            else:
                result.failure("Happy path - Player customizes own square", f"Color/pattern not set correctly: {square}")
        else:
            result.failure("Happy path - Player customizes own square", f"Status {customize_response.status_code}: {customize_response.text}")
        
        # Test 2: Permission check - Other player cannot customize
        # Add player "Bob"
        join_response = make_request("POST", f"/games/{game_code}/join", {
            "code": game_code,
            "player_name": "Bob"
        })
        
        if join_response.status_code != 200:
            result.failure("Bob joins game", f"Status {join_response.status_code}: {join_response.text}")
            return result
        
        # Bob claims square 1 (Alice claims for Bob since it's turn-based)
        claim_bob_response = make_request("POST", f"/games/{game_code}/claim", {
            "position": 1,
            "player_name": "Bob",
            "claimed_by_host": True  # Host claiming for Bob
        })
        
        if claim_bob_response.status_code != 200:
            result.failure("Bob claims square 1", f"Status {claim_bob_response.status_code}: {claim_bob_response.text}")
            return result
        
        # Bob tries to customize Alice's square (should fail with 403)
        bob_customize_response = make_request("POST", f"/games/{game_code}/customize-square", {
            "position": 5,
            "player_name": "Bob",
            "color": "#00FF00",
            "pattern": "basketball"
        })
        
        if bob_customize_response.status_code == 403:
            response_data = bob_customize_response.json()
            if "You can only customize your own squares" in response_data.get("detail", ""):
                result.success("Permission check - Other player cannot customize")
            else:
                result.failure("Permission check - Other player cannot customize", f"Wrong error message: {response_data}")
        else:
            result.failure("Permission check - Other player cannot customize", f"Expected 403, got {bob_customize_response.status_code}: {bob_customize_response.text}")
        
        # Test 3: Host can customize any claimed square
        alice_customize_bob_response = make_request("POST", f"/games/{game_code}/customize-square", {
            "position": 1,
            "player_name": "Alice",  # Alice is the host
            "color": "#0000FF",
            "pattern": "soccer"
        })
        
        if alice_customize_bob_response.status_code == 200:
            alice_data = alice_customize_bob_response.json()
            bob_square = alice_data["squares"][1]
            if bob_square.get("color") == "#0000FF" and bob_square.get("pattern") == "soccer":
                result.success("Host can customize any claimed square")
            else:
                result.failure("Host can customize any claimed square", f"Color/pattern not set correctly: {bob_square}")
        else:
            result.failure("Host can customize any claimed square", f"Status {alice_customize_bob_response.status_code}: {alice_customize_bob_response.text}")
        
        # Test 4: Cannot customize unclaimed square
        unclaimed_customize_response = make_request("POST", f"/games/{game_code}/customize-square", {
            "position": 50,  # Unclaimed position
            "player_name": "Alice",
            "color": "#FFFF00",
            "pattern": "tennis"
        })
        
        if unclaimed_customize_response.status_code == 400:
            response_data = unclaimed_customize_response.json()
            if "Square is not claimed yet" in response_data.get("detail", ""):
                result.success("Cannot customize unclaimed square")
            else:
                result.failure("Cannot customize unclaimed square", f"Wrong error message: {response_data}")
        else:
            result.failure("Cannot customize unclaimed square", f"Expected 400, got {unclaimed_customize_response.status_code}: {unclaimed_customize_response.text}")
        
        # Test 6: Clear customization (null values)
        clear_customize_response = make_request("POST", f"/games/{game_code}/customize-square", {
            "position": 5,
            "player_name": "Alice",
            "color": None,
            "pattern": None
        })
        
        if clear_customize_response.status_code == 200:
            clear_data = clear_customize_response.json()
            cleared_square = clear_data["squares"][5]
            if cleared_square.get("color") is None and cleared_square.get("pattern") is None:
                result.success("Clear customization (null values)")
            else:
                result.failure("Clear customization (null values)", f"Color/pattern not cleared: {cleared_square}")
        else:
            result.failure("Clear customization (null values)", f"Status {clear_customize_response.status_code}: {clear_customize_response.text}")
        
        # Test 7: Invalid position
        invalid_pos_response = make_request("POST", f"/games/{game_code}/customize-square", {
            "position": -1,
            "player_name": "Alice",
            "color": "#FF0000",
            "pattern": "hockey"
        })
        
        if invalid_pos_response.status_code == 400:
            response_data = invalid_pos_response.json()
            if "Invalid position" in response_data.get("detail", ""):
                result.success("Invalid position (-1)")
            else:
                result.failure("Invalid position (-1)", f"Wrong error message: {response_data}")
        else:
            result.failure("Invalid position (-1)", f"Expected 400, got {invalid_pos_response.status_code}: {invalid_pos_response.text}")
        
        # Test invalid position 100
        invalid_pos2_response = make_request("POST", f"/games/{game_code}/customize-square", {
            "position": 100,
            "player_name": "Alice",
            "color": "#FF0000",
            "pattern": "hockey"
        })
        
        if invalid_pos2_response.status_code == 400:
            response_data = invalid_pos2_response.json()
            if "Invalid position" in response_data.get("detail", ""):
                result.success("Invalid position (100)")
            else:
                result.failure("Invalid position (100)", f"Wrong error message: {response_data}")
        else:
            result.failure("Invalid position (100)", f"Expected 400, got {invalid_pos2_response.status_code}: {invalid_pos2_response.text}")
        
    except Exception as e:
        result.failure("Customize Square API tests", f"Exception: {str(e)}")
    
    # Test 5: Game not found
    try:
        not_found_response = make_request("POST", "/games/NOTFOUND/customize-square", {
            "position": 0,
            "player_name": "Alice",
            "color": "#FF0000",
            "pattern": "hockey"
        })
        
        if not_found_response.status_code == 404:
            result.success("Game not found")
        else:
            result.failure("Game not found", f"Expected 404, got {not_found_response.status_code}: {not_found_response.text}")
    except Exception as e:
        result.failure("Game not found test", f"Exception: {str(e)}")
    
    return result

def test_regression_apis():
    """Test existing APIs to ensure Square model changes don't break them"""
    result = TestResult()
    
    print("\n🔄 Testing Regression APIs...")
    
    try:
        # Test 1: POST /api/games (create game)
        create_response = make_request("POST", "/games", {
            "host_id": str(uuid.uuid4()),
            "host_name": "TestHost",
            "team_horizontal": "Team Alpha",
            "team_vertical": "Team Beta"
        })
        
        if create_response.status_code == 200:
            game_data = create_response.json()
            # Check that squares have color and pattern fields
            squares = game_data.get("squares", [])
            if len(squares) == 100:
                first_square = squares[0]
                if "color" in first_square and "pattern" in first_square:
                    result.success("Create game - squares have color/pattern fields")
                else:
                    result.failure("Create game - squares have color/pattern fields", f"Missing fields in square: {first_square}")
            else:
                result.failure("Create game - 100 squares", f"Expected 100 squares, got {len(squares)}")
        else:
            result.failure("Create game", f"Status {create_response.status_code}: {create_response.text}")
            return result
        
        game_code = game_data["code"]
        
        # Test 2: POST /api/games/{code}/join
        join_response = make_request("POST", f"/games/{game_code}/join", {
            "code": game_code,
            "player_name": "TestPlayer"
        })
        
        if join_response.status_code == 200:
            result.success("Join game")
        else:
            result.failure("Join game", f"Status {join_response.status_code}: {join_response.text}")
        
        # Test 3: POST /api/games/{code}/claim
        claim_response = make_request("POST", f"/games/{game_code}/claim", {
            "position": 0,
            "player_name": "TestHost",
            "claimed_by_host": False
        })
        
        if claim_response.status_code == 200:
            claim_data = claim_response.json()
            claimed_square = claim_data["squares"][0]
            # Check that color and pattern fields exist (should be None initially)
            if "color" in claimed_square and "pattern" in claimed_square:
                result.success("Claim square - preserves color/pattern fields")
            else:
                result.failure("Claim square - preserves color/pattern fields", f"Missing fields: {claimed_square}")
        else:
            result.failure("Claim square", f"Status {claim_response.status_code}: {claim_response.text}")
        
        # Claim more squares to fill the board for randomize test
        for i in range(1, 100):
            player_name = "TestHost" if i % 2 == 0 else "TestPlayer"
            make_request("POST", f"/games/{game_code}/claim", {
                "position": i,
                "player_name": player_name,
                "claimed_by_host": True  # Host claiming for speed
            })
        
        # Test 4: POST /api/games/{code}/randomize
        randomize_response = make_request("POST", f"/games/{game_code}/randomize")
        
        if randomize_response.status_code == 200:
            randomize_data = randomize_response.json()
            if "numbers_top" in randomize_data and "numbers_left" in randomize_data:
                result.success("Randomize numbers")
            else:
                result.failure("Randomize numbers", f"Missing numbers fields: {randomize_data}")
        else:
            result.failure("Randomize numbers", f"Status {randomize_response.status_code}: {randomize_response.text}")
        
        # Test 5: POST /api/games/{code}/winner
        winner_response = make_request("POST", f"/games/{game_code}/winner", {
            "quarter": 1,
            "position": 0
        })
        
        if winner_response.status_code == 200:
            winner_data = winner_response.json()
            if "winners" in winner_data:
                result.success("Set winner")
            else:
                result.failure("Set winner", f"Missing winners field: {winner_data}")
        else:
            result.failure("Set winner", f"Status {winner_response.status_code}: {winner_response.text}")
        
    except Exception as e:
        result.failure("Regression API tests", f"Exception: {str(e)}")
    
    return result

def main():
    """Run all tests"""
    print("🚀 Starting Sports Squares Backend API Tests")
    print(f"🌐 Backend URL: {BACKEND_URL}")
    
    # Test the new Customize Square API
    customize_result = test_customize_square_api()
    
    # Test regression APIs
    regression_result = test_regression_apis()
    
    # Combined results
    total_passed = customize_result.passed + regression_result.passed
    total_failed = customize_result.failed + regression_result.failed
    total_errors = customize_result.errors + regression_result.errors
    
    print(f"\n🏁 Overall Test Summary: {total_passed}/{total_passed + total_failed} passed")
    
    if total_errors:
        print("\n🔍 All Failures:")
        for error in total_errors:
            print(f"  - {error}")
    
    return total_failed == 0

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)