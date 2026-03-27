// Level data for Prince of Persia Web
import {
  type LevelData,
  type Room,
  type Tile,
  TileType,
  PotionType,
  Direction,
  GuardType,
} from './types';

// Helper to create a row of tiles
function row(...types: (TileType | [TileType, number?])[]): Tile[] {
  return types.map((t) => {
    if (Array.isArray(t)) {
      return { type: t[0], modifier: t[1] };
    }
    return { type: t };
  });
}

const E = TileType.Empty;
const F = TileType.Floor;
const W = TileType.BrickWall;
const S = TileType.Spikes;
const P = TileType.Pillar;
const G = TileType.Gate;
const RB = TileType.RaiseButton;
const DB = TileType.DropButton;
const LF = TileType.LooseFloor;
const CH = TileType.Chomper;
const T = TileType.Torch;
const EX = TileType.ExitDoor;
const SW = TileType.Sword;

function makeRoom(
  r0: (TileType | [TileType, number?])[],
  r1: (TileType | [TileType, number?])[],
  r2: (TileType | [TileType, number?])[],
  links: { left: number; right: number; up: number; down: number }
): Room {
  return {
    tiles: [row(...r0), row(...r1), row(...r2)],
    links,
  };
}

// ============================================================
// LEVEL 1: The Dungeon (Tutorial)
// Layout (6 rooms, 2 wide x 3 tall):
//   Room 1  Room 2
//   Room 3  Room 4
//   Room 5  Room 6
// ============================================================
const level1: LevelData = {
  id: 1,
  name: 'The Dungeon',
  environment: 'dungeon',
  startRoom: 5,
  startCol: 2,
  startRow: 1,
  startDirection: Direction.Right,
  rooms: {
    // Room 1: Upper left - corridor with torch
    1: makeRoom(
      [W, W, W, W, W, W, W, W, W, W],
      [W, T, E, E, E, E, E, E, E, E],
      [W, F, F, F, F, F, F, F, F, F],
      { left: -1, right: 2, up: -1, down: 3 }
    ),
    // Room 2: Upper right - exit room with door
    2: makeRoom(
      [W, W, W, W, W, W, W, W, W, W],
      [E, E, E, E, E, EX, E, E, T, W],
      [F, F, F, F, F, F, F, F, F, W],
      { left: 1, right: -1, up: -1, down: 4 }
    ),
    // Room 3: Middle left - gap and raise button
    3: makeRoom(
      [W, E, E, E, E, E, E, E, E, E],
      [W, E, E, E, E, E, E, E, E, E],
      [W, F, F, F, E, E, F, F, [RB, 1], F],
      { left: -1, right: 4, up: 1, down: 5 }
    ),
    // Room 4: Middle right - platforms and potion
    4: makeRoom(
      [E, E, E, E, E, E, E, E, E, W],
      [E, E, E, E, E, E, E, E, E, W],
      [F, F, F, [TileType.Potion, PotionType.Health], E, E, F, F, F, W],
      { left: 3, right: -1, up: 2, down: 6 }
    ),
    // Room 5: Lower left - start room
    5: makeRoom(
      [W, E, E, E, E, E, E, E, E, E],
      [W, E, E, E, E, E, E, E, E, E],
      [W, F, F, F, F, F, F, F, F, F],
      { left: -1, right: 6, up: 3, down: -1 }
    ),
    // Room 6: Lower right - climbing area
    6: makeRoom(
      [E, E, E, E, E, E, E, E, E, W],
      [E, E, E, E, E, E, E, E, E, W],
      [F, F, F, F, F, LF, LF, F, F, W],
      { left: 5, right: -1, up: 4, down: -1 }
    ),
  },
  guards: [],
  events: [
    {
      type: 'button_gate',
      sourceRoom: 3,
      sourceCol: 8,
      sourceRow: 2,
      targetRoom: 2,
      targetCol: 5,
      targetRow: 1,
      action: 'open',
    },
  ],
};

// ============================================================
// LEVEL 2: First Guard
// Layout (8 rooms, 2 wide x 4 tall):
//   Room 1  Room 2
//   Room 3  Room 4
//   Room 5  Room 6
//   Room 7  Room 8
// ============================================================
const level2: LevelData = {
  id: 2,
  name: 'First Blood',
  environment: 'dungeon',
  startRoom: 7,
  startCol: 1,
  startRow: 1,
  startDirection: Direction.Right,
  rooms: {
    // Room 1: Exit room
    1: makeRoom(
      [W, W, W, W, W, W, W, W, W, W],
      [W, T, E, E, EX, E, E, E, T, W],
      [W, F, F, F, F, F, F, F, F, W],
      { left: -1, right: 2, up: -1, down: 3 }
    ),
    // Room 2: Upper right - gate puzzle
    2: makeRoom(
      [W, W, W, W, W, W, W, W, W, W],
      [E, E, E, E, E, E, E, E, E, W],
      [F, F, F, [G, 2], F, F, F, [RB, 1], F, W],
      { left: 1, right: -1, up: -1, down: 4 }
    ),
    // Room 3: First spikes
    3: makeRoom(
      [W, E, E, E, E, E, E, E, E, E],
      [W, E, E, E, E, E, E, E, E, E],
      [W, F, F, S, F, F, S, F, F, F],
      { left: -1, right: 4, up: 1, down: 5 }
    ),
    // Room 4: Corridor with potion
    4: makeRoom(
      [E, E, E, E, E, E, E, E, E, W],
      [E, E, E, E, E, E, E, E, E, W],
      [F, F, F, F, [TileType.Potion, PotionType.Life], F, F, F, F, W],
      { left: 3, right: -1, up: 2, down: 6 }
    ),
    // Room 5: Guard room
    5: makeRoom(
      [W, E, E, E, E, E, E, E, E, E],
      [W, E, E, E, E, E, E, E, E, E],
      [W, F, F, F, F, F, F, F, F, F],
      { left: -1, right: 6, up: 3, down: 7 }
    ),
    // Room 6: Raise button for exit
    6: makeRoom(
      [E, E, E, E, E, E, E, E, E, W],
      [E, E, E, E, E, E, E, E, E, W],
      [F, F, F, F, [RB, 1], F, F, F, F, W],
      { left: 5, right: -1, up: 4, down: 8 }
    ),
    // Room 7: Start room with sword
    7: makeRoom(
      [W, E, E, E, E, E, E, E, E, E],
      [W, E, E, E, E, SW, E, E, E, E],
      [W, F, F, F, F, F, F, F, F, F],
      { left: -1, right: 8, up: 5, down: -1 }
    ),
    // Room 8: Lower right - health potion
    8: makeRoom(
      [E, E, E, E, E, E, E, E, E, W],
      [E, E, E, E, E, E, E, E, E, W],
      [F, F, F, [TileType.Potion, PotionType.Health], F, F, F, F, F, W],
      { left: 7, right: -1, up: 6, down: -1 }
    ),
  },
  guards: [
    {
      room: 5,
      col: 7,
      row: 2,
      direction: Direction.Left,
      type: GuardType.Normal,
      hp: 3,
      skill: 2,
    },
  ],
  events: [
    {
      type: 'button_gate',
      sourceRoom: 2,
      sourceCol: 7,
      sourceRow: 2,
      targetRoom: 2,
      targetCol: 3,
      targetRow: 2,
      action: 'open',
    },
    {
      type: 'button_gate',
      sourceRoom: 6,
      sourceCol: 4,
      sourceRow: 2,
      targetRoom: 1,
      targetCol: 4,
      targetRow: 1,
      action: 'open',
    },
  ],
};

// ============================================================
// LEVEL 3: The Gauntlet
// Layout (10 rooms):
//   Room 1  Room 2  Room 3
//   Room 4  Room 5  Room 6
//   Room 7  Room 8  Room 9
//                   Room 10
// ============================================================
const level3: LevelData = {
  id: 3,
  name: 'The Gauntlet',
  environment: 'dungeon',
  startRoom: 7,
  startCol: 1,
  startRow: 1,
  startDirection: Direction.Right,
  rooms: {
    // Room 1: Upper left with chomper
    1: makeRoom(
      [W, W, W, W, W, W, W, W, W, W],
      [W, E, E, E, E, E, E, E, E, E],
      [W, F, F, CH, F, F, F, F, F, F],
      { left: -1, right: 2, up: -1, down: 4 }
    ),
    // Room 2: Exit room
    2: makeRoom(
      [W, W, W, W, W, W, W, W, W, W],
      [E, E, E, EX, E, E, E, E, E, E],
      [F, F, F, F, F, F, CH, F, F, F],
      { left: 1, right: 3, up: -1, down: 5 }
    ),
    // Room 3: Upper right - dead end with life potion
    3: makeRoom(
      [W, W, W, W, W, W, W, W, W, W],
      [E, E, E, E, E, E, E, E, T, W],
      [F, F, [TileType.Potion, PotionType.Life], F, F, S, S, F, F, W],
      { left: 2, right: -1, up: -1, down: 6 }
    ),
    // Room 4: Guard room 1
    4: makeRoom(
      [W, E, E, E, E, E, E, E, E, E],
      [W, E, E, E, E, E, E, E, E, E],
      [W, F, F, F, F, F, F, F, F, F],
      { left: -1, right: 5, up: 1, down: 7 }
    ),
    // Room 5: Central - gate puzzle hub
    5: makeRoom(
      [E, E, E, E, E, E, E, E, E, E],
      [E, E, E, E, E, E, E, E, E, E],
      [F, F, [G, 3], F, F, F, F, [RB, 3], F, F],
      { left: 4, right: 6, up: 2, down: 8 }
    ),
    // Room 6: Guard room 2 and loose floors
    6: makeRoom(
      [E, E, E, E, E, E, E, E, E, W],
      [E, E, E, E, E, E, E, E, E, W],
      [F, F, LF, LF, F, F, F, F, F, W],
      { left: 5, right: -1, up: 3, down: 9 }
    ),
    // Room 7: Start room
    7: makeRoom(
      [W, E, E, E, E, E, E, E, E, E],
      [W, E, E, E, E, E, E, E, E, E],
      [W, F, F, F, F, F, F, [TileType.Potion, PotionType.Health], F, F],
      { left: -1, right: 8, up: 4, down: -1 }
    ),
    // Room 8: Skeleton room
    8: makeRoom(
      [E, E, E, E, E, E, E, E, E, E],
      [E, E, E, E, E, E, E, E, E, E],
      [F, F, F, F, E, E, F, F, F, F],
      { left: 7, right: 9, up: 5, down: -1 }
    ),
    // Room 9: Lower right - button for exit
    9: makeRoom(
      [E, E, E, E, E, E, E, E, E, W],
      [E, E, E, E, E, E, E, E, E, W],
      [F, F, F, F, F, [RB, 1], F, F, F, W],
      { left: 8, right: -1, up: 6, down: -1 }
    ),
  },
  guards: [
    {
      room: 4,
      col: 6,
      row: 2,
      direction: Direction.Left,
      type: GuardType.Normal,
      hp: 3,
      skill: 3,
    },
    {
      room: 6,
      col: 7,
      row: 2,
      direction: Direction.Left,
      type: GuardType.Normal,
      hp: 4,
      skill: 4,
    },
    {
      room: 8,
      col: 7,
      row: 2,
      direction: Direction.Left,
      type: GuardType.Skeleton,
      hp: 3,
      skill: 5,
    },
  ],
  events: [
    {
      type: 'button_gate',
      sourceRoom: 5,
      sourceCol: 7,
      sourceRow: 2,
      targetRoom: 5,
      targetCol: 2,
      targetRow: 2,
      action: 'open',
    },
    {
      type: 'button_gate',
      sourceRoom: 9,
      sourceCol: 5,
      sourceRow: 2,
      targetRoom: 2,
      targetCol: 3,
      targetRow: 1,
      action: 'open',
    },
  ],
};

export const LEVELS: LevelData[] = [level1, level2, level3];

export function getLevel(id: number): LevelData | undefined {
  return LEVELS.find((l) => l.id === id);
}

// Guard skill presets (indexed 0-11)
export const GUARD_SKILLS = [
  { strikeProb: 61,  restrikeProb: 0,   blockProb: 0,   advanceProb: 255, refractTimer: 16, extraStrength: 0 },
  { strikeProb: 100, restrikeProb: 0,   blockProb: 0,   advanceProb: 200, refractTimer: 16, extraStrength: 0 },
  { strikeProb: 61,  restrikeProb: 0,   blockProb: 100, advanceProb: 200, refractTimer: 12, extraStrength: 0 },
  { strikeProb: 61,  restrikeProb: 0,   blockProb: 150, advanceProb: 200, refractTimer: 10, extraStrength: 0 },
  { strikeProb: 61,  restrikeProb: 100, blockProb: 200, advanceProb: 200, refractTimer: 8,  extraStrength: 1 },
  { strikeProb: 100, restrikeProb: 150, blockProb: 220, advanceProb: 150, refractTimer: 8,  extraStrength: 1 },
  { strikeProb: 150, restrikeProb: 150, blockProb: 230, advanceProb: 100, refractTimer: 8,  extraStrength: 2 },
  { strikeProb: 200, restrikeProb: 200, blockProb: 240, advanceProb: 50,  refractTimer: 6,  extraStrength: 2 },
  { strikeProb: 200, restrikeProb: 200, blockProb: 250, advanceProb: 50,  refractTimer: 6,  extraStrength: 3 },
  { strikeProb: 48,  restrikeProb: 255, blockProb: 255, advanceProb: 100, refractTimer: 6,  extraStrength: 3 },
  { strikeProb: 220, restrikeProb: 220, blockProb: 250, advanceProb: 0,   refractTimer: 4,  extraStrength: 4 },
  { strikeProb: 255, restrikeProb: 255, blockProb: 255, advanceProb: 0,   refractTimer: 4,  extraStrength: 5 },
];
