// Core game types for Prince of Persia Web

export enum TileType {
  Empty = 0,
  Floor = 1,
  Spikes = 2,
  Pillar = 3,
  Gate = 4,
  Wall = 5,
  DropButton = 6,
  ExitDoorFrame = 7,
  Potion = 10,
  LooseFloor = 11,
  RaiseButton = 15,
  ExitDoor = 16,
  Chomper = 18,
  Torch = 19,
  BrickWall = 20,
  Sword = 22,
}

export enum PotionType {
  Empty = 0,
  Health = 1,     // Restore 1 HP
  Life = 2,       // +1 max HP + full heal
  Poison = 3,     // Lose 1 HP
  FeatherFall = 4, // No fall damage for 30s
}

export enum PlayerState {
  Stand = 'stand',
  Run = 'run',
  Turn = 'turn',
  Jump = 'jump',
  RunJump = 'runjump',
  Crouch = 'crouch',
  Hang = 'hang',
  ClimbUp = 'climbup',
  ClimbDown = 'climbdown',
  Fall = 'fall',
  Land = 'land',
  HardLand = 'hardland',
  Drink = 'drink',
  PickupSword = 'pickupsword',
  FightStance = 'fightstance',
  Strike = 'strike',
  Block = 'block',
  StrikeRecover = 'strikerecover',
  Hurt = 'hurt',
  StepForward = 'stepforward',
  StepBack = 'stepback',
  Die = 'die',
  CrouchHop = 'crouchhop',
  EnterDoor = 'enterdoor',
  FallDie = 'falldie',
  SpikeDie = 'spikedie',
  ChomperDie = 'chomperdie',
}

export enum GuardType {
  Normal = 'normal',
  Fat = 'fat',
  Skeleton = 'skeleton',
  Vizier = 'vizier',
}

export enum GuardState {
  Inactive = 'inactive',
  Active = 'active',
  Fight = 'fight',
  Strike = 'strike',
  Block = 'block',
  Hurt = 'hurt',
  Advance = 'advance',
  Retreat = 'retreat',
  Die = 'die',
  Dead = 'dead',
}

export enum Direction {
  Left = -1,
  Right = 1,
}

export interface Position {
  x: number;
  y: number;
}

export interface TilePos {
  room: number;
  col: number; // 0-9
  row: number; // 0-2
}

export interface Tile {
  type: TileType;
  modifier?: number; // For potions: PotionType, for gates: link ID, for buttons: gate link
  state?: number;    // For gates: open amount (0-100), for spikes: extended, for chomper: timer
}

export interface RoomLinks {
  left: number;   // room number or -1
  right: number;
  up: number;
  down: number;
}

export interface Room {
  tiles: Tile[][]; // [row][col] — 3 rows, 10 cols
  links: RoomLinks;
}

export interface GuardPlacement {
  room: number;
  col: number;
  row: number;
  direction: Direction;
  type: GuardType;
  hp: number;
  skill: number;
}

export interface EventTrigger {
  type: 'button_gate' | 'level_start' | 'sword_pickup' | 'exit_open';
  sourceRoom?: number;
  sourceCol?: number;
  sourceRow?: number;
  targetRoom?: number;
  targetCol?: number;
  targetRow?: number;
  action?: string;
}

export interface LevelData {
  id: number;
  name: string;
  environment: 'dungeon' | 'palace';
  startRoom: number;
  startCol: number;
  startRow: number;
  startDirection: Direction;
  rooms: Record<number, Room>;
  guards: GuardPlacement[];
  events: EventTrigger[];
}

export interface GuardSkill {
  strikeProb: number;     // 0-255
  restrikeProb: number;
  blockProb: number;
  advanceProb: number;
  refractTimer: number;   // frames
  extraStrength: number;
}

export interface Guard {
  x: number;
  y: number;
  room: number;
  direction: Direction;
  state: GuardState;
  type: GuardType;
  hp: number;
  maxHp: number;
  skill: GuardSkill;
  stateTimer: number;
  animFrame: number;
  refractTimer: number;
  alive: boolean;
}

export interface Player {
  x: number;
  y: number;
  room: number;
  direction: Direction;
  state: PlayerState;
  stateTimer: number;
  animFrame: number;
  hp: number;
  maxHp: number;
  hasSword: boolean;
  swordDrawn: boolean;
  fallDistance: number;
  featherFallTimer: number;
  alive: boolean;
  jumpVelocityY: number;
  onGround: boolean;
}

export interface LooseFloorState {
  room: number;
  col: number;
  row: number;
  shakeTimer: number;
  falling: boolean;
  fallY: number;
  gone: boolean;
}

export interface GateState {
  room: number;
  col: number;
  row: number;
  open: number; // 0 = closed, 100 = fully open
  targetOpen: number;
}

export interface SpikeState {
  room: number;
  col: number;
  row: number;
  extended: boolean;
  timer: number;
}

export interface ChomperState {
  room: number;
  col: number;
  row: number;
  timer: number;
  closed: boolean;
}

export interface GameState {
  currentLevel: number;
  player: Player;
  guards: Guard[];
  looseFloors: LooseFloorState[];
  gates: GateState[];
  spikes: SpikeState[];
  chompers: ChomperState[];
  timeRemaining: number; // in seconds
  timerRunning: boolean;
  gameOver: boolean;
  victory: boolean;
  paused: boolean;
  titleScreen: boolean;
  levelComplete: boolean;
  levelTransitionTimer: number;
  consumedPotions: Set<string>; // "room-col-row" keys
  pickedUpSword: boolean;
}

export interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  shift: boolean;
  space: boolean;
  enter: boolean;
}

// Rendering constants
export const TILE_WIDTH = 32;
export const TILE_HEIGHT = 63;
export const ROOM_COLS = 10;
export const ROOM_ROWS = 3;
export const CANVAS_WIDTH = TILE_WIDTH * ROOM_COLS;  // 320
export const CANVAS_HEIGHT = TILE_HEIGHT * ROOM_ROWS; // 189
export const DISPLAY_HEIGHT = 200; // Extra space for HUD
export const PLAYER_WIDTH = 16;
export const PLAYER_HEIGHT = 48;
export const GUARD_WIDTH = 16;
export const GUARD_HEIGHT = 48;

// Physics constants
export const GRAVITY = 2;
export const MAX_FALL_SPEED = 16;
export const RUN_SPEED = 4;
export const WALK_SPEED = 2;
export const JUMP_VELOCITY = -12;
export const RUNJUMP_VELOCITY_X = 5;
export const RUNJUMP_VELOCITY_Y = -10;
export const SAFE_FALL_DISTANCE = TILE_HEIGHT; // 1 row
export const DAMAGE_FALL_DISTANCE = TILE_HEIGHT * 2; // 2 rows
export const FATAL_FALL_DISTANCE = TILE_HEIGHT * 3; // 3+ rows

// Game timing
export const GAME_TPS = 12; // Ticks per second (original game speed)
export const FIGHT_TPS = 10;
export const TOTAL_TIME_SECONDS = 3600; // 60 minutes
export const LOOSE_FLOOR_DELAY = 11; // frames before falling
export const CHOMPER_CYCLE = 15; // frames per cycle
export const SPIKE_EXTEND_DURATION = 8;
export const GATE_SPEED = 4; // units per tick
