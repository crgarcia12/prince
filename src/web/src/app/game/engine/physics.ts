// Physics and collision detection for Prince of Persia Web

import {
  type GameState,
  type Player,
  type Tile,
  type TilePos,
  TileType,
  PlayerState,
  Direction,
  TILE_WIDTH,
  TILE_HEIGHT,
  ROOM_COLS,
  ROOM_ROWS,
  PLAYER_WIDTH,
  PLAYER_HEIGHT,
  GRAVITY,
  MAX_FALL_SPEED,
  SAFE_FALL_DISTANCE,
  DAMAGE_FALL_DISTANCE,
  FATAL_FALL_DISTANCE,
} from './types';
import { getLevel } from './levels';

/**
 * Get the tile at a given pixel position in the current room
 */
export function getTileAt(state: GameState, room: number, pixelX: number, pixelY: number): Tile | null {
  const level = getLevel(state.currentLevel);
  if (!level) return null;

  const roomData = level.rooms[room];
  if (!roomData) return null;

  const col = Math.floor(pixelX / TILE_WIDTH);
  const row = Math.floor(pixelY / TILE_HEIGHT);

  if (col < 0 || col >= ROOM_COLS || row < 0 || row >= ROOM_ROWS) {
    return null;
  }

  return roomData.tiles[row][col];
}

/**
 * Get tile position from pixel coordinates
 */
export function pixelToTile(pixelX: number, pixelY: number): { col: number; row: number } {
  return {
    col: Math.floor(pixelX / TILE_WIDTH),
    row: Math.floor(pixelY / TILE_HEIGHT),
  };
}

/**
 * Check if a tile position has a solid floor
 */
export function hasFloor(state: GameState, room: number, col: number, row: number): boolean {
  const level = getLevel(state.currentLevel);
  if (!level) return false;

  const roomData = level.rooms[room];
  if (!roomData) return false;

  if (col < 0 || col >= ROOM_COLS || row < 0 || row >= ROOM_ROWS) {
    // Check adjacent room
    if (row >= ROOM_ROWS && roomData.links.down > 0) {
      return hasFloor(state, roomData.links.down, col, 0);
    }
    if (col < 0 && roomData.links.left > 0) {
      return hasFloor(state, roomData.links.left, ROOM_COLS - 1, row);
    }
    if (col >= ROOM_COLS && roomData.links.right > 0) {
      return hasFloor(state, roomData.links.right, 0, row);
    }
    return false;
  }

  const tile = roomData.tiles[row][col];
  if (!tile) return false;

  // Check if loose floor is gone
  if (tile.type === TileType.LooseFloor) {
    const looseState = state.looseFloors.find(
      (l) => l.room === room && l.col === col && l.row === row
    );
    if (looseState?.gone) return false;
  }

  // Solid floor types
  return [
    TileType.Floor,
    TileType.Pillar,
    TileType.Spikes,
    TileType.RaiseButton,
    TileType.DropButton,
    TileType.LooseFloor,
    TileType.Chomper,
    TileType.Potion,
    TileType.Sword,
    TileType.ExitDoorFrame,
    TileType.ExitDoor,
  ].includes(tile.type);
}

/**
 * Check if a tile is a wall (blocks horizontal movement)
 */
export function isWall(state: GameState, room: number, col: number, row: number): boolean {
  const level = getLevel(state.currentLevel);
  if (!level) return true;

  const roomData = level.rooms[room];
  if (!roomData) return true;

  if (col < 0 || col >= ROOM_COLS || row < 0 || row >= ROOM_ROWS) {
    return false; // allow room transitions
  }

  const tile = roomData.tiles[row][col];
  if (!tile) return false;

  // Check closed gate
  if (tile.type === TileType.Gate) {
    const gateState = state.gates.find(
      (g) => g.room === room && g.col === col && g.row === row
    );
    return !gateState || gateState.open < 80;
  }

  return tile.type === TileType.BrickWall || tile.type === TileType.Wall;
}

/**
 * Check if player can grab a ledge at the given position
 */
export function canGrabLedge(state: GameState, room: number, col: number, row: number): boolean {
  // There must be a floor at (col, row) and empty space at (col, row-1)
  if (row <= 0) return false;
  return hasFloor(state, room, col, row) && !isWall(state, room, col, row - 1);
}

/**
 * Get the Y position of the floor surface at a given row
 */
export function getFloorY(row: number): number {
  return (row + 1) * TILE_HEIGHT - 12; // Floor surface is 12px from bottom of tile
}

/**
 * Apply gravity to a falling entity
 */
export function applyGravity(velocityY: number): number {
  return Math.min(velocityY + GRAVITY, MAX_FALL_SPEED);
}

/**
 * Calculate fall damage based on distance fallen
 */
export function calculateFallDamage(fallDistance: number, hasFeatherFall: boolean): number {
  if (hasFeatherFall) return 0;
  if (fallDistance < SAFE_FALL_DISTANCE) return 0;
  if (fallDistance < DAMAGE_FALL_DISTANCE) return 1;
  if (fallDistance < FATAL_FALL_DISTANCE) return 1;
  return 100; // Fatal
}

/**
 * Check room transition — returns new room number and adjusted position
 */
export function checkRoomTransition(
  state: GameState,
  room: number,
  x: number,
  y: number
): { room: number; x: number; y: number } | null {
  const level = getLevel(state.currentLevel);
  if (!level) return null;

  const roomData = level.rooms[room];
  if (!roomData) return null;

  // Left edge
  if (x < 0) {
    const leftRoom = roomData.links.left;
    if (leftRoom > 0) {
      return { room: leftRoom, x: ROOM_COLS * TILE_WIDTH + x, y };
    }
    return null; // wall
  }

  // Right edge
  if (x + PLAYER_WIDTH > ROOM_COLS * TILE_WIDTH) {
    const rightRoom = roomData.links.right;
    if (rightRoom > 0) {
      return { room: rightRoom, x: x - ROOM_COLS * TILE_WIDTH, y };
    }
    return null; // wall
  }

  // Top edge
  if (y < 0) {
    const upRoom = roomData.links.up;
    if (upRoom > 0) {
      return { room: upRoom, x, y: ROOM_ROWS * TILE_HEIGHT + y };
    }
    return null;
  }

  // Bottom edge (falling)
  if (y > ROOM_ROWS * TILE_HEIGHT) {
    const downRoom = roomData.links.down;
    if (downRoom > 0) {
      return { room: downRoom, x, y: y - ROOM_ROWS * TILE_HEIGHT };
    }
    // Fell out of level — fatal
    return { room: -1, x, y };
  }

  return null;
}

/**
 * Get tile info at player's feet
 */
export function getTileUnderPlayer(state: GameState): TilePos | null {
  const { x, y, room } = state.player;
  const centerX = x + PLAYER_WIDTH / 2;
  const feetY = y + PLAYER_HEIGHT;
  const col = Math.floor(centerX / TILE_WIDTH);
  const row = Math.floor(feetY / TILE_HEIGHT);

  if (col >= 0 && col < ROOM_COLS && row >= 0 && row < ROOM_ROWS) {
    return { room, col, row };
  }
  return null;
}

/**
 * Check if player is standing on a specific tile type
 */
export function isPlayerOnTile(state: GameState, tileType: TileType): TilePos | null {
  const tilePos = getTileUnderPlayer(state);
  if (!tilePos) return null;

  const level = getLevel(state.currentLevel);
  if (!level) return null;

  const roomData = level.rooms[tilePos.room];
  if (!roomData) return null;

  const tile = roomData.tiles[tilePos.row][tilePos.col];
  if (tile && tile.type === tileType) {
    return tilePos;
  }
  return null;
}

/**
 * Get the distance between two entities in the same room
 */
export function getDistance(x1: number, x2: number): number {
  return Math.abs(x1 - x2);
}
