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
    player_name: Optional[str] = None
    claimed: bool = False

class Winner(BaseModel):
    quarter: int  # 1-4
    position: int  # 0-99
    player_name: Optional[str] = None

class Game(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    code: str = Field(default_factory=lambda: ''.join(random.choices('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', k=6)))
    host_id: str
    team_horizontal: str = "Team A"
    team_vertical: str = "Team B"
    squares: List[Square] = Field(default_factory=lambda: [Square(position=i) for i in range(100)])
    numbers_top: Optional[List[int]] = None  # 0-9 randomized
    numbers_left: Optional[List[int]] = None  # 0-9 randomized
    numbers_randomized: bool = False
    randomize_time: Optional[str] = None  # ISO datetime string
    winners: List[Winner] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    current_turn: int = 0  # Index of whose turn it is
    players: List[str] = Field(default_factory=list)  # List of player names
    is_active: bool = True

class CreateGameRequest(BaseModel):
    host_id: str
    host_name: str
    team_horizontal: Optional[str] = "Team A"
    team_vertical: Optional[str] = "Team B"
    randomize_time: Optional[str] = None

class JoinGameRequest(BaseModel):
    code: str
    player_name: str

class ClaimSquareRequest(BaseModel):
    position: int
    player_name: str

class SetWinnerRequest(BaseModel):
    quarter: int
    position: int

class UpdateTeamsRequest(BaseModel):
    team_horizontal: str
    team_vertical: str

# API Routes
@api_router.get("/")
async def root():
    return {"message": "Sports Squares API"}

@api_router.post("/games", response_model=Game)
async def create_game(request: CreateGameRequest):
    """Create a new game"""
    game = Game(
        host_id=request.host_id,
        team_horizontal=request.team_horizontal or "Team A",
        team_vertical=request.team_vertical or "Team B",
        randomize_time=request.randomize_time,
        players=[request.host_name]
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
    
    # Add player to the game
    await db.games.update_one(
        {"code": code.upper()},
        {"$push": {"players": request.player_name}}
    )
    
    updated_game = await db.games.find_one({"code": code.upper()})
    updated_game.pop('_id', None)
    
    # Emit socket event for player joined
    await sio.emit('player_joined', {
        'player_name': request.player_name,
        'players': updated_game.get('players', [])
    }, room=code.upper())
    
    return updated_game

@api_router.post("/games/{code}/claim")
async def claim_square(code: str, request: ClaimSquareRequest):
    """Claim a square"""
    game = await db.games.find_one({"code": code.upper()})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    squares = game.get('squares', [])
    if request.position < 0 or request.position >= 100:
        raise HTTPException(status_code=400, detail="Invalid position")
    
    if squares[request.position].get('claimed', False):
        raise HTTPException(status_code=400, detail="Square already claimed")
    
    # Update the square
    squares[request.position] = {
        'position': request.position,
        'player_name': request.player_name,
        'claimed': True
    }
    
    # Move to next turn
    players = game.get('players', [])
    current_turn = game.get('current_turn', 0)
    next_turn = (current_turn + 1) % len(players) if players else 0
    
    await db.games.update_one(
        {"code": code.upper()},
        {
            "$set": {
                "squares": squares,
                "current_turn": next_turn
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
        'current_turn': next_turn
    }, room=code.upper())
    
    return updated_game

@api_router.post("/games/{code}/randomize")
async def randomize_numbers(code: str):
    """Randomize the numbers on axes"""
    game = await db.games.find_one({"code": code.upper()})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
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
