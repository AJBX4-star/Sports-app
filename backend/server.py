from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
import uuid
from datetime import datetime
import random
import socketio

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create Socket.IO server
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    logger=True,
    engineio_logger=True
)

# Create the main FastAPI app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Define Models
class Square(BaseModel):
    position: int  # 0-99
    number: int  # 1-100 display number
    player_name: Optional[str] = None
    claimed: bool = False
    locked: bool = False  # Once claimed, square is locked

class Winner(BaseModel):
    quarter: int  # 1-4
    position: int  # 0-99
    player_name: Optional[str] = None

class Game(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    code: str = Field(default_factory=lambda: ''.join(random.choices('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', k=6)))
    host_id: str
    host_name: str = ""
    team_horizontal: str = "Team A"
    team_vertical: str = "Team B"
    squares: List[Square] = Field(default_factory=lambda: [Square(position=i, number=i+1) for i in range(100)])
    numbers_top: Optional[List[int]] = None  # 0-9 randomized
    numbers_left: Optional[List[int]] = None  # 0-9 randomized
    numbers_randomized: bool = False
    randomize_time: Optional[str] = None  # ISO datetime string
    winners: List[Winner] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    current_turn: int = 0  # Index of whose turn it is
    players: List[str] = Field(default_factory=list)  # List of player names
    player_order: List[str] = Field(default_factory=list)  # Order for snake draft
    is_active: bool = True
    picks_per_turn: int = 1  # Number of squares a player can pick per turn
    picks_this_turn: int = 0  # Track picks in current turn
    draft_style: str = "snake"  # "snake" or "standard" or "custom"
    draft_direction: int = 1  # 1 for forward, -1 for backward (snake draft)
    board_locked: bool = False  # Lock board when all squares claimed
    draft_started: bool = False  # Has the draft started
    # Live score tracking
    score_horizontal: int = 0  # Score for horizontal team
    score_vertical: int = 0  # Score for vertical team
    # Undo history
    last_claim: Optional[Dict] = None  # Last claimed square for undo

class CreateGameRequest(BaseModel):
    host_id: str
    host_name: str
    team_horizontal: Optional[str] = "Team A"
    team_vertical: Optional[str] = "Team B"
    randomize_time: Optional[str] = None
    picks_per_turn: Optional[int] = 1
    draft_style: Optional[str] = "snake"  # "snake", "standard", "custom"

class JoinGameRequest(BaseModel):
    code: str
    player_name: str

class ClaimSquareRequest(BaseModel):
    position: int
    player_name: str
    claimed_by_host: bool = False  # If host is claiming for someone

class HostClaimRequest(BaseModel):
    position: int
    player_name: Optional[str] = None  # None means unclaimed/host marking
    as_unclaimed: bool = False  # Mark as unclaimed spot

class SetWinnerRequest(BaseModel):
    quarter: int
    position: int

class UpdateTeamsRequest(BaseModel):
    team_horizontal: str
    team_vertical: str

class UpdateSettingsRequest(BaseModel):
    picks_per_turn: Optional[int] = None
    draft_style: Optional[str] = None

class SetPlayerOrderRequest(BaseModel):
    player_order: List[str]
    randomize: bool = False

class StartDraftRequest(BaseModel):
    randomize_order: bool = False

class UndoClaimRequest(BaseModel):
    position: int

class AddPlayerRequest(BaseModel):
    player_name: str

class RemovePlayerRequest(BaseModel):
    player_name: str
    release_squares: bool = False  # Release their squares back to unclaimed

class UpdateScoreRequest(BaseModel):
    score_horizontal: int
    score_vertical: int

# API Routes
@api_router.get("/")
async def root():
    return {"message": "Sports Squares API"}

@api_router.post("/games", response_model=Game)
async def create_game(request: CreateGameRequest):
    """Create a new game"""
    game = Game(
        host_id=request.host_id,
        host_name=request.host_name,
        team_horizontal=request.team_horizontal or "Team A",
        team_vertical=request.team_vertical or "Team B",
        randomize_time=request.randomize_time,
        players=[request.host_name],
        player_order=[request.host_name],
        picks_per_turn=request.picks_per_turn or 1,
        draft_style=request.draft_style or "snake"
    )
    game_dict = game.model_dump()
    game_dict['created_at'] = game.created_at.isoformat()
    await db.games.insert_one(game_dict)
    return game

@api_router.get("/games/{code}")
async def get_game(code: str):
    """Get game by code"""
    game = await db.games.find_one({"code": code.upper()})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    game.pop('_id', None)
    return game

@api_router.post("/games/{code}/join")
async def join_game(code: str, request: JoinGameRequest):
    """Join an existing game"""
    game = await db.games.find_one({"code": code.upper()})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    if request.player_name in game.get('players', []):
        # Player already in game, return current state
        game.pop('_id', None)
        return game
    
    # Add player to the game and player order
    await db.games.update_one(
        {"code": code.upper()},
        {
            "$push": {
                "players": request.player_name,
                "player_order": request.player_name
            }
        }
    )
    
    updated_game = await db.games.find_one({"code": code.upper()})
    updated_game.pop('_id', None)
    
    # Emit socket event for player joined
    await sio.emit('player_joined', {
        'player_name': request.player_name,
        'players': updated_game.get('players', []),
        'player_order': updated_game.get('player_order', [])
    }, room=code.upper())
    
    return updated_game

@api_router.post("/games/{code}/claim")
async def claim_square(code: str, request: ClaimSquareRequest):
    """Claim a square"""
    game = await db.games.find_one({"code": code.upper()})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    # Check if board is locked
    if game.get('board_locked', False):
        raise HTTPException(status_code=400, detail="Board is locked")
    
    squares = game.get('squares', [])
    if request.position < 0 or request.position >= 100:
        raise HTTPException(status_code=400, detail="Invalid position")
    
    # Check if square is already claimed/locked
    if squares[request.position].get('claimed', False) or squares[request.position].get('locked', False):
        raise HTTPException(status_code=400, detail="Square already claimed")
    
    # Check if it's this player's turn (unless host is claiming for them)
    if not request.claimed_by_host:
        player_order = game.get('player_order', game.get('players', []))
        current_turn = game.get('current_turn', 0)
        if player_order and len(player_order) > 0:
            current_player = player_order[current_turn % len(player_order)]
            if current_player != request.player_name:
                raise HTTPException(status_code=400, detail=f"It's {current_player}'s turn")
    
    # Update the square - lock it immediately
    squares[request.position] = {
        'position': request.position,
        'number': request.position + 1,
        'player_name': request.player_name,
        'claimed': True,
        'locked': True
    }
    
    # Handle turn progression
    picks_per_turn = game.get('picks_per_turn', 1)
    picks_this_turn = game.get('picks_this_turn', 0) + 1
    current_turn = game.get('current_turn', 0)
    draft_direction = game.get('draft_direction', 1)
    draft_style = game.get('draft_style', 'snake')
    player_order = game.get('player_order', game.get('players', []))
    
    # Check if player has made all their picks for this turn
    if picks_this_turn >= picks_per_turn:
        picks_this_turn = 0
        
        if draft_style == 'snake':
            # Snake draft logic
            next_turn = current_turn + draft_direction
            # Check if we need to reverse direction
            if next_turn >= len(player_order):
                draft_direction = -1
                next_turn = len(player_order) - 1
            elif next_turn < 0:
                draft_direction = 1
                next_turn = 0
            current_turn = next_turn
        else:
            # Standard draft - just cycle through
            current_turn = (current_turn + 1) % len(player_order) if player_order else 0
    
    # Check if all squares are claimed
    claimed_count = sum(1 for s in squares if s.get('claimed', False))
    board_locked = claimed_count >= 100
    
    # Store last claim for undo functionality
    last_claim = {
        'position': request.position,
        'player_name': request.player_name,
        'previous_turn': game.get('current_turn', 0),
        'previous_picks': game.get('picks_this_turn', 0),
        'previous_direction': game.get('draft_direction', 1)
    }
    
    await db.games.update_one(
        {"code": code.upper()},
        {
            "$set": {
                "squares": squares,
                "current_turn": current_turn,
                "picks_this_turn": picks_this_turn,
                "draft_direction": draft_direction,
                "board_locked": board_locked,
                "last_claim": last_claim
            }
        }
    )
    
    updated_game = await db.games.find_one({"code": code.upper()})
    updated_game.pop('_id', None)
    
    # Emit socket event
    await sio.emit('square_claimed', {
        'position': request.position,
        'player_name': request.player_name,
        'squares': updated_game.get('squares', []),
        'current_turn': current_turn,
        'picks_this_turn': picks_this_turn,
        'board_locked': board_locked
    }, room=code.upper())
    
    return updated_game

@api_router.post("/games/{code}/host-claim")
async def host_claim_square(code: str, request: HostClaimRequest):
    """Host claims a square for another player or marks as unclaimed"""
    game = await db.games.find_one({"code": code.upper()})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    squares = game.get('squares', [])
    if request.position < 0 or request.position >= 100:
        raise HTTPException(status_code=400, detail="Invalid position")
    
    # Check if square is already claimed/locked
    if squares[request.position].get('claimed', False) or squares[request.position].get('locked', False):
        raise HTTPException(status_code=400, detail="Square already claimed")
    
    # Update the square
    if request.as_unclaimed:
        # Mark as unclaimed but locked (reserved spot)
        squares[request.position] = {
            'position': request.position,
            'number': request.position + 1,
            'player_name': None,
            'claimed': True,
            'locked': True
        }
    else:
        # Claim for specific player
        squares[request.position] = {
            'position': request.position,
            'number': request.position + 1,
            'player_name': request.player_name,
            'claimed': True,
            'locked': True
        }
    
    # Check if all squares are claimed
    claimed_count = sum(1 for s in squares if s.get('claimed', False))
    board_locked = claimed_count >= 100
    
    await db.games.update_one(
        {"code": code.upper()},
        {
            "$set": {
                "squares": squares,
                "board_locked": board_locked
            }
        }
    )
    
    updated_game = await db.games.find_one({"code": code.upper()})
    updated_game.pop('_id', None)
    
    # Emit socket event
    await sio.emit('square_claimed', {
        'position': request.position,
        'player_name': request.player_name,
        'squares': updated_game.get('squares', []),
        'board_locked': board_locked
    }, room=code.upper())
    
    return updated_game

@api_router.post("/games/{code}/randomize")
async def randomize_numbers(code: str):
    """Randomize the numbers on axes - only allowed when board is locked"""
    game = await db.games.find_one({"code": code.upper()})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    # Check if board is locked (all squares claimed)
    if not game.get('board_locked', False):
        raise HTTPException(status_code=400, detail="Board must be locked (all squares claimed) before randomizing numbers")
    
    numbers_top = list(range(10))
    numbers_left = list(range(10))
    random.shuffle(numbers_top)
    random.shuffle(numbers_left)
    
    await db.games.update_one(
        {"code": code.upper()},
        {
            "$set": {
                "numbers_top": numbers_top,
                "numbers_left": numbers_left,
                "numbers_randomized": True
            }
        }
    )
    
    updated_game = await db.games.find_one({"code": code.upper()})
    updated_game.pop('_id', None)
    
    # Emit socket event
    await sio.emit('numbers_randomized', {
        'numbers_top': numbers_top,
        'numbers_left': numbers_left
    }, room=code.upper())
    
    return updated_game

@api_router.post("/games/{code}/winner")
async def set_winner(code: str, request: SetWinnerRequest):
    """Set a quarter winner"""
    game = await db.games.find_one({"code": code.upper()})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    squares = game.get('squares', [])
    if request.position < 0 or request.position >= 100:
        raise HTTPException(status_code=400, detail="Invalid position")
    
    square = squares[request.position]
    winner = Winner(
        quarter=request.quarter,
        position=request.position,
        player_name=square.get('player_name')
    )
    
    # Remove existing winner for this quarter and add new one
    winners = [w for w in game.get('winners', []) if w.get('quarter') != request.quarter]
    winners.append(winner.model_dump())
    
    await db.games.update_one(
        {"code": code.upper()},
        {"$set": {"winners": winners}}
    )
    
    updated_game = await db.games.find_one({"code": code.upper()})
    updated_game.pop('_id', None)
    
    # Emit socket event
    await sio.emit('winner_selected', {
        'quarter': request.quarter,
        'position': request.position,
        'player_name': square.get('player_name'),
        'winners': updated_game.get('winners', [])
    }, room=code.upper())
    
    return updated_game

@api_router.put("/games/{code}/teams")
async def update_teams(code: str, request: UpdateTeamsRequest):
    """Update team names"""
    game = await db.games.find_one({"code": code.upper()})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    await db.games.update_one(
        {"code": code.upper()},
        {
            "$set": {
                "team_horizontal": request.team_horizontal,
                "team_vertical": request.team_vertical
            }
        }
    )
    
    updated_game = await db.games.find_one({"code": code.upper()})
    updated_game.pop('_id', None)
    
    # Emit socket event
    await sio.emit('teams_updated', {
        'team_horizontal': request.team_horizontal,
        'team_vertical': request.team_vertical
    }, room=code.upper())
    
    return updated_game

@api_router.put("/games/{code}/settings")
async def update_settings(code: str, request: UpdateSettingsRequest):
    """Update game settings"""
    game = await db.games.find_one({"code": code.upper()})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    update_fields = {}
    if request.picks_per_turn is not None:
        update_fields['picks_per_turn'] = request.picks_per_turn
    if request.draft_style is not None:
        update_fields['draft_style'] = request.draft_style
    
    if update_fields:
        await db.games.update_one(
            {"code": code.upper()},
            {"$set": update_fields}
        )
    
    updated_game = await db.games.find_one({"code": code.upper()})
    updated_game.pop('_id', None)
    
    # Emit socket event
    await sio.emit('settings_updated', update_fields, room=code.upper())
    
    return updated_game

@api_router.put("/games/{code}/player-order")
async def set_player_order(code: str, request: SetPlayerOrderRequest):
    """Set or randomize player order"""
    game = await db.games.find_one({"code": code.upper()})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    if request.randomize:
        # Randomize the current player list
        players = game.get('players', []).copy()
        random.shuffle(players)
        player_order = players
    else:
        player_order = request.player_order
    
    await db.games.update_one(
        {"code": code.upper()},
        {"$set": {"player_order": player_order}}
    )
    
    updated_game = await db.games.find_one({"code": code.upper()})
    updated_game.pop('_id', None)
    
    # Emit socket event
    await sio.emit('player_order_updated', {
        'player_order': player_order
    }, room=code.upper())
    
    return updated_game

@api_router.post("/games/{code}/start-draft")
async def start_draft(code: str, request: StartDraftRequest):
    """Start the draft"""
    game = await db.games.find_one({"code": code.upper()})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    player_order = game.get('player_order', game.get('players', []))
    
    if request.randomize_order:
        player_order = player_order.copy()
        random.shuffle(player_order)
    
    await db.games.update_one(
        {"code": code.upper()},
        {
            "$set": {
                "draft_started": True,
                "player_order": player_order,
                "current_turn": 0,
                "picks_this_turn": 0,
                "draft_direction": 1
            }
        }
    )
    
    updated_game = await db.games.find_one({"code": code.upper()})
    updated_game.pop('_id', None)
    
    # Emit socket event
    await sio.emit('draft_started', {
        'player_order': player_order,
        'current_turn': 0
    }, room=code.upper())
    
    return updated_game

@api_router.post("/games/{code}/undo")
async def undo_last_claim(code: str):
    """Undo the last square claim (host only)"""
    game = await db.games.find_one({"code": code.upper()})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    last_claim = game.get('last_claim')
    if not last_claim:
        raise HTTPException(status_code=400, detail="No claim to undo")
    
    squares = game.get('squares', [])
    position = last_claim.get('position')
    
    # Reset the square
    squares[position] = {
        'position': position,
        'number': position + 1,
        'player_name': None,
        'claimed': False,
        'locked': False
    }
    
    # Restore turn state
    await db.games.update_one(
        {"code": code.upper()},
        {
            "$set": {
                "squares": squares,
                "current_turn": last_claim.get('previous_turn', 0),
                "picks_this_turn": last_claim.get('previous_picks', 0),
                "draft_direction": last_claim.get('previous_direction', 1),
                "board_locked": False,
                "last_claim": None
            }
        }
    )
    
    updated_game = await db.games.find_one({"code": code.upper()})
    updated_game.pop('_id', None)
    
    # Emit socket event
    await sio.emit('square_unclaimed', {
        'position': position,
        'squares': updated_game.get('squares', []),
        'current_turn': last_claim.get('previous_turn', 0)
    }, room=code.upper())
    
    return updated_game

@api_router.post("/games/{code}/add-player")
async def add_player(code: str, request: AddPlayerRequest):
    """Manually add a player to the game"""
    game = await db.games.find_one({"code": code.upper()})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    if request.player_name in game.get('players', []):
        raise HTTPException(status_code=400, detail="Player already in game")
    
    await db.games.update_one(
        {"code": code.upper()},
        {
            "$push": {
                "players": request.player_name,
                "player_order": request.player_name
            }
        }
    )
    
    updated_game = await db.games.find_one({"code": code.upper()})
    updated_game.pop('_id', None)
    
    await sio.emit('player_joined', {
        'player_name': request.player_name,
        'players': updated_game.get('players', []),
        'player_order': updated_game.get('player_order', [])
    }, room=code.upper())
    
    return updated_game

@api_router.post("/games/{code}/remove-player")
async def remove_player(code: str, request: RemovePlayerRequest):
    """Remove a player from the game"""
    game = await db.games.find_one({"code": code.upper()})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    if request.player_name not in game.get('players', []):
        raise HTTPException(status_code=400, detail="Player not in game")
    
    # Don't allow removing the host
    if request.player_name == game.get('host_name'):
        raise HTTPException(status_code=400, detail="Cannot remove the host")
    
    squares = game.get('squares', [])
    
    # Optionally release their squares
    if request.release_squares:
        for i, square in enumerate(squares):
            if square.get('player_name') == request.player_name:
                squares[i] = {
                    'position': i,
                    'number': i + 1,
                    'player_name': None,
                    'claimed': False,
                    'locked': False
                }
    
    # Remove from players and player_order
    players = [p for p in game.get('players', []) if p != request.player_name]
    player_order = [p for p in game.get('player_order', []) if p != request.player_name]
    
    # Adjust current turn if needed
    current_turn = game.get('current_turn', 0)
    if current_turn >= len(player_order):
        current_turn = 0
    
    await db.games.update_one(
        {"code": code.upper()},
        {
            "$set": {
                "players": players,
                "player_order": player_order,
                "squares": squares,
                "current_turn": current_turn,
                "board_locked": sum(1 for s in squares if s.get('claimed', False)) >= 100
            }
        }
    )
    
    updated_game = await db.games.find_one({"code": code.upper()})
    updated_game.pop('_id', None)
    
    await sio.emit('player_removed', {
        'player_name': request.player_name,
        'players': updated_game.get('players', []),
        'player_order': updated_game.get('player_order', []),
        'squares': updated_game.get('squares', [])
    }, room=code.upper())
    
    return updated_game

@api_router.put("/games/{code}/score")
async def update_score(code: str, request: UpdateScoreRequest):
    """Update live scores"""
    game = await db.games.find_one({"code": code.upper()})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    await db.games.update_one(
        {"code": code.upper()},
        {
            "$set": {
                "score_horizontal": request.score_horizontal,
                "score_vertical": request.score_vertical
            }
        }
    )
    
    updated_game = await db.games.find_one({"code": code.upper()})
    updated_game.pop('_id', None)
    
    # Emit socket event
    await sio.emit('score_updated', {
        'score_horizontal': request.score_horizontal,
        'score_vertical': request.score_vertical
    }, room=code.upper())
    
    return updated_game

# Socket.IO events
@sio.event
async def connect(sid, environ):
    logger.info(f"Client connected: {sid}")

@sio.event
async def disconnect(sid):
    logger.info(f"Client disconnected: {sid}")

@sio.event
async def join_room(sid, data):
    """Join a game room"""
    room = data.get('code', '').upper()
    if room:
        sio.enter_room(sid, room)
        logger.info(f"Client {sid} joined room {room}")
        await sio.emit('joined_room', {'room': room}, room=sid)

@sio.event
async def leave_room(sid, data):
    """Leave a game room"""
    room = data.get('code', '').upper()
    if room:
        sio.leave_room(sid, room)
        logger.info(f"Client {sid} left room {room}")

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Wrap FastAPI app with Socket.IO - rename to 'app' for uvicorn
fastapi_app = app
app = socketio.ASGIApp(sio, other_asgi_app=fastapi_app)

@fastapi_app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
