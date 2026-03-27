// Renderer for Prince of Persia Web
// Procedural/geometric rendering — no sprite assets needed

import {
  type GameState,
  type Player,
  type Guard,
  type Room,
  type Tile,
  TileType,
  PlayerState,
  GuardState,
  GuardType,
  Direction,
  TILE_WIDTH,
  TILE_HEIGHT,
  ROOM_COLS,
  ROOM_ROWS,
  CANVAS_WIDTH,
  PLAYER_WIDTH,
  PLAYER_HEIGHT,
  GUARD_WIDTH,
  GUARD_HEIGHT,
} from './types';
import { getLevel } from './levels';

// Color palettes
const DUNGEON_COLORS = {
  background: '#0a0a1a',
  floor: '#555566',
  floorTop: '#777788',
  floorEdge: '#333344',
  wall: '#444455',
  wallHighlight: '#666677',
  wallShadow: '#222233',
  brick: '#3a3a4a',
  brickLine: '#2a2a3a',
  torch: '#ffaa00',
  torchGlow: '#ffdd44',
  pillar: '#666677',
  pillarHighlight: '#888899',
};

const PALACE_COLORS = {
  background: '#1a0a1a',
  floor: '#886644',
  floorTop: '#aa8866',
  floorEdge: '#664422',
  wall: '#774433',
  wallHighlight: '#996655',
  wallShadow: '#552211',
  brick: '#885544',
  brickLine: '#663322',
  torch: '#ffcc00',
  torchGlow: '#ffee66',
  pillar: '#997755',
  pillarHighlight: '#bb9977',
};

// Player colors
const PLAYER_COLORS = {
  skin: '#e8b478',
  hair: '#442200',
  shirt: '#ffffff',
  pants: '#8844aa',
  sword: '#ccccdd',
  swordHighlight: '#ffffff',
};

// Guard colors by type
const GUARD_COLORS: Record<string, { skin: string; shirt: string; pants: string }> = {
  normal: { skin: '#d4a464', shirt: '#4444aa', pants: '#333366' },
  fat: { skin: '#d4a464', shirt: '#aa4444', pants: '#663333' },
  skeleton: { skin: '#ccccaa', shirt: '#999977', pants: '#888866' },
  vizier: { skin: '#c4a484', shirt: '#880000', pants: '#440000' },
};

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  private frameCount = 0;

  constructor(ctx: CanvasRenderingContext2D, width: number, height: number) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
  }

  render(state: GameState): void {
    this.frameCount++;
    const ctx = this.ctx;

    if (state.titleScreen) {
      this.renderTitleScreen();
      return;
    }

    if (state.gameOver) {
      this.renderGameOver(state);
      return;
    }

    if (state.victory) {
      this.renderVictory(state);
      return;
    }

    // Get current level data
    const level = getLevel(state.currentLevel);
    if (!level) return;

    const colors = level.environment === 'dungeon' ? DUNGEON_COLORS : PALACE_COLORS;

    // Clear background
    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, this.width, this.height);

    // Render current room
    const room = level.rooms[state.player.room];
    if (room) {
      this.renderRoom(room, colors, state);
    }

    // Render guards in this room
    for (const guard of state.guards) {
      if (guard.room === state.player.room && guard.alive) {
        this.renderGuard(guard);
      }
    }

    // Render player
    this.renderPlayer(state.player);

    // Render HUD
    this.renderHUD(state);

    // Render level transition overlay
    if (state.levelComplete) {
      this.renderLevelTransition(state);
    }

    // Render pause overlay
    if (state.paused) {
      this.renderPauseOverlay();
    }
  }

  private renderRoom(room: Room, colors: typeof DUNGEON_COLORS, state: GameState): void {
    const ctx = this.ctx;

    for (let row = 0; row < ROOM_ROWS; row++) {
      for (let col = 0; col < ROOM_COLS; col++) {
        const tile = room.tiles[row][col];
        const x = col * TILE_WIDTH;
        const y = row * TILE_HEIGHT;
        this.renderTile(tile, x, y, colors, state, row, col);
      }
    }
  }

  private renderTile(
    tile: Tile,
    x: number,
    y: number,
    colors: typeof DUNGEON_COLORS,
    state: GameState,
    row: number,
    col: number
  ): void {
    const ctx = this.ctx;

    switch (tile.type) {
      case TileType.Floor:
        this.renderFloor(x, y, colors);
        break;

      case TileType.BrickWall:
      case TileType.Wall:
        this.renderWall(x, y, colors);
        break;

      case TileType.Pillar:
        this.renderFloor(x, y, colors);
        this.renderPillar(x, y, colors);
        break;

      case TileType.Spikes: {
        this.renderFloor(x, y, colors);
        // Check if spikes are extended
        const spikeState = state.spikes.find(
          (s) => s.room === state.player.room && s.col === col && s.row === row
        );
        if (spikeState?.extended) {
          this.renderSpikes(x, y, true);
        } else {
          this.renderSpikes(x, y, false);
        }
        break;
      }

      case TileType.Gate: {
        // Render floor under gate
        this.renderFloor(x, y, colors);
        const gateState = state.gates.find(
          (g) => g.room === state.player.room && g.col === col && g.row === row
        );
        const openAmount = gateState ? gateState.open : 0;
        this.renderGate(x, y, openAmount, colors);
        break;
      }

      case TileType.RaiseButton:
      case TileType.DropButton:
        this.renderFloor(x, y, colors);
        this.renderButton(x, y);
        break;

      case TileType.Potion: {
        this.renderFloor(x, y, colors);
        const potionKey = `${state.player.room}-${col}-${row}`;
        if (!state.consumedPotions.has(potionKey)) {
          this.renderPotion(x, y, tile.modifier ?? 1);
        }
        break;
      }

      case TileType.LooseFloor: {
        const looseState = state.looseFloors.find(
          (l) => l.room === state.player.room && l.col === col && l.row === row
        );
        if (!looseState?.gone) {
          const shaking = looseState && looseState.shakeTimer > 0 && !looseState.falling;
          const offsetX = shaking ? (Math.random() - 0.5) * 3 : 0;
          const offsetY = looseState?.falling ? looseState.fallY : 0;
          this.renderFloor(x + offsetX, y + offsetY, colors);
          // Crack lines to show it's loose
          ctx.strokeStyle = '#ff8800';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x + 4, y + TILE_HEIGHT - 6);
          ctx.lineTo(x + TILE_WIDTH - 4, y + TILE_HEIGHT - 10);
          ctx.stroke();
        }
        break;
      }

      case TileType.Chomper: {
        this.renderFloor(x, y, colors);
        const chomperState = state.chompers.find(
          (c) => c.room === state.player.room && c.col === col && c.row === row
        );
        this.renderChomper(x, y, chomperState?.closed ?? false);
        break;
      }

      case TileType.Torch:
        this.renderTorch(x, y, colors);
        break;

      case TileType.ExitDoor: {
        this.renderFloor(x, y, colors);
        // Check if exit is open
        const exitGate = state.gates.find(
          (g) => g.room === state.player.room && g.col === col && g.row === row
        );
        const exitOpen = exitGate ? exitGate.open >= 100 : false;
        this.renderExitDoor(x, y, exitOpen, colors);
        break;
      }

      case TileType.Sword: {
        this.renderFloor(x, y, colors);
        if (!state.pickedUpSword) {
          this.renderSwordPickup(x, y);
        }
        break;
      }

      case TileType.Empty:
        // Nothing to render
        break;

      default:
        // Unknown tile — render as floor
        this.renderFloor(x, y, colors);
        break;
    }
  }

  private renderFloor(x: number, y: number, colors: typeof DUNGEON_COLORS): void {
    const ctx = this.ctx;
    const floorY = y + TILE_HEIGHT - 12;

    // Floor surface
    ctx.fillStyle = colors.floorTop;
    ctx.fillRect(x, floorY, TILE_WIDTH, 3);

    // Floor body
    ctx.fillStyle = colors.floor;
    ctx.fillRect(x, floorY + 3, TILE_WIDTH, 9);

    // Floor edge (bottom)
    ctx.fillStyle = colors.floorEdge;
    ctx.fillRect(x, floorY + 9, TILE_WIDTH, 3);

    // Floor texture lines
    ctx.strokeStyle = colors.floorEdge;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 8, floorY + 4);
    ctx.lineTo(x + 24, floorY + 4);
    ctx.stroke();
  }

  private renderWall(x: number, y: number, colors: typeof DUNGEON_COLORS): void {
    const ctx = this.ctx;

    // Wall base
    ctx.fillStyle = colors.wall;
    ctx.fillRect(x, y, TILE_WIDTH, TILE_HEIGHT);

    // Brick pattern
    ctx.strokeStyle = colors.brickLine;
    ctx.lineWidth = 1;
    for (let by = 0; by < TILE_HEIGHT; by += 10) {
      ctx.beginPath();
      ctx.moveTo(x, y + by);
      ctx.lineTo(x + TILE_WIDTH, y + by);
      ctx.stroke();

      const offset = (by / 10) % 2 === 0 ? 0 : TILE_WIDTH / 2;
      ctx.beginPath();
      ctx.moveTo(x + offset, y + by);
      ctx.lineTo(x + offset, y + by + 10);
      ctx.stroke();
      if (offset > 0) {
        ctx.beginPath();
        ctx.moveTo(x + TILE_WIDTH, y + by);
        ctx.lineTo(x + TILE_WIDTH, y + by + 10);
        ctx.stroke();
      }
    }

    // Highlight edge
    ctx.fillStyle = colors.wallHighlight;
    ctx.fillRect(x, y, 2, TILE_HEIGHT);
  }

  private renderPillar(x: number, y: number, colors: typeof DUNGEON_COLORS): void {
    const ctx = this.ctx;
    const px = x + TILE_WIDTH / 2 - 4;
    const floorY = y + TILE_HEIGHT - 12;

    // Pillar shaft
    ctx.fillStyle = colors.pillar;
    ctx.fillRect(px, y, 8, floorY - y);

    // Highlight
    ctx.fillStyle = colors.pillarHighlight;
    ctx.fillRect(px, y, 2, floorY - y);

    // Capital (top)
    ctx.fillStyle = colors.pillar;
    ctx.fillRect(px - 3, y, 14, 4);

    // Base
    ctx.fillStyle = colors.pillar;
    ctx.fillRect(px - 2, floorY - 3, 12, 3);
  }

  private renderSpikes(x: number, y: number, extended: boolean): void {
    const ctx = this.ctx;
    const floorY = y + TILE_HEIGHT - 12;
    const spikeHeight = extended ? 20 : 4;

    ctx.fillStyle = extended ? '#cc4444' : '#888888';
    for (let i = 0; i < 5; i++) {
      const sx = x + 3 + i * 6;
      ctx.beginPath();
      ctx.moveTo(sx, floorY);
      ctx.lineTo(sx + 3, floorY - spikeHeight);
      ctx.lineTo(sx + 6, floorY);
      ctx.fill();
    }
  }

  private renderGate(x: number, y: number, openAmount: number, colors: typeof DUNGEON_COLORS): void {
    const ctx = this.ctx;
    const floorY = y + TILE_HEIGHT - 12;
    const gateHeight = TILE_HEIGHT - 12;
    const openPixels = (openAmount / 100) * gateHeight;

    // Gate frame
    ctx.fillStyle = '#888899';
    ctx.fillRect(x + 2, y, 2, gateHeight);
    ctx.fillRect(x + TILE_WIDTH - 4, y, 2, gateHeight);

    // Gate bars (closed portion)
    const closedHeight = gateHeight - openPixels;
    if (closedHeight > 0) {
      ctx.fillStyle = '#666677';
      for (let i = 0; i < 4; i++) {
        const bx = x + 6 + i * 6;
        ctx.fillRect(bx, y + openPixels, 2, closedHeight);
      }
      // Horizontal bars
      for (let j = 0; j < closedHeight; j += 8) {
        ctx.fillRect(x + 4, y + openPixels + j, TILE_WIDTH - 8, 1);
      }
    }
  }

  private renderButton(x: number, y: number): void {
    const ctx = this.ctx;
    const floorY = y + TILE_HEIGHT - 12;

    // Button plate
    ctx.fillStyle = '#aa8866';
    ctx.fillRect(x + 8, floorY - 2, 16, 2);
    ctx.fillStyle = '#886644';
    ctx.fillRect(x + 10, floorY - 3, 12, 1);
  }

  private renderPotion(x: number, y: number, type: number): void {
    const ctx = this.ctx;
    const floorY = y + TILE_HEIGHT - 12;
    const px = x + TILE_WIDTH / 2;
    const py = floorY - 10;

    // Bottle shape
    const potionColors: Record<number, string> = {
      1: '#ff4444', // Health (red small)
      2: '#ff2222', // Life (red large)
      3: '#4444ff', // Poison (blue)
      4: '#44ff44', // Feather fall (green)
    };

    const color = potionColors[type] ?? '#ff4444';

    // Bottle body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(px, py + 4, 5, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bottle neck
    ctx.fillStyle = color;
    ctx.fillRect(px - 2, py - 4, 4, 6);

    // Bottle cap
    ctx.fillStyle = '#cccccc';
    ctx.fillRect(px - 3, py - 5, 6, 2);

    // Shimmer
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(px - 3, py + 1, 2, 4);

    // Glow effect for potions
    const glowAlpha = 0.15 + 0.05 * Math.sin(this.frameCount * 0.1);
    ctx.fillStyle = `${color}${Math.floor(glowAlpha * 255).toString(16).padStart(2, '0')}`;
    ctx.beginPath();
    ctx.ellipse(px, py + 2, 10, 10, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  private renderChomper(x: number, y: number, closed: boolean): void {
    const ctx = this.ctx;
    const floorY = y + TILE_HEIGHT - 12;

    // Chomper jaws
    ctx.fillStyle = '#888899';
    const jawHeight = closed ? 25 : 10;

    // Left jaw
    ctx.beginPath();
    ctx.moveTo(x + 2, floorY);
    ctx.lineTo(x + 2, floorY - jawHeight);
    ctx.lineTo(x + TILE_WIDTH / 2, floorY - (closed ? 5 : jawHeight));
    ctx.lineTo(x + TILE_WIDTH / 2, floorY);
    ctx.fill();

    // Right jaw
    ctx.beginPath();
    ctx.moveTo(x + TILE_WIDTH - 2, floorY);
    ctx.lineTo(x + TILE_WIDTH - 2, floorY - jawHeight);
    ctx.lineTo(x + TILE_WIDTH / 2, floorY - (closed ? 5 : jawHeight));
    ctx.lineTo(x + TILE_WIDTH / 2, floorY);
    ctx.fill();

    // Teeth
    ctx.fillStyle = '#ccccdd';
    if (!closed) {
      for (let i = 0; i < 3; i++) {
        // Left teeth
        ctx.beginPath();
        ctx.moveTo(x + 6 + i * 4, floorY - jawHeight + 2);
        ctx.lineTo(x + 8 + i * 4, floorY - jawHeight + 8);
        ctx.lineTo(x + 10 + i * 4, floorY - jawHeight + 2);
        ctx.fill();
        // Right teeth
        const rx = x + TILE_WIDTH - 14 + i * 4;
        ctx.beginPath();
        ctx.moveTo(rx, floorY - jawHeight + 2);
        ctx.lineTo(rx + 2, floorY - jawHeight + 8);
        ctx.lineTo(rx + 4, floorY - jawHeight + 2);
        ctx.fill();
      }
    }

    // Blood if closed
    if (closed) {
      ctx.fillStyle = '#880000';
      ctx.fillRect(x + TILE_WIDTH / 2 - 3, floorY - 6, 6, 2);
    }
  }

  private renderTorch(x: number, y: number, colors: typeof DUNGEON_COLORS): void {
    const ctx = this.ctx;

    // Torch holder
    ctx.fillStyle = '#886644';
    ctx.fillRect(x + TILE_WIDTH / 2 - 2, y + 15, 4, 20);

    // Flame (animated)
    const flicker = Math.sin(this.frameCount * 0.3) * 2;
    const flame1 = Math.sin(this.frameCount * 0.5) * 1.5;

    ctx.fillStyle = colors.torch;
    ctx.beginPath();
    ctx.ellipse(x + TILE_WIDTH / 2 + flame1, y + 12, 5, 8 + flicker, 0, 0, Math.PI * 2);
    ctx.fill();

    // Inner flame
    ctx.fillStyle = colors.torchGlow;
    ctx.beginPath();
    ctx.ellipse(x + TILE_WIDTH / 2, y + 13, 3, 5 + flicker * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Glow
    const gradient = ctx.createRadialGradient(
      x + TILE_WIDTH / 2, y + 12, 0,
      x + TILE_WIDTH / 2, y + 12, 30
    );
    gradient.addColorStop(0, 'rgba(255, 200, 50, 0.15)');
    gradient.addColorStop(1, 'rgba(255, 200, 50, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(x - 10, y - 10, TILE_WIDTH + 20, TILE_HEIGHT);
  }

  private renderExitDoor(x: number, y: number, isOpen: boolean, colors: typeof DUNGEON_COLORS): void {
    const ctx = this.ctx;
    const floorY = y + TILE_HEIGHT - 12;
    const doorHeight = 45;

    // Door frame
    ctx.fillStyle = '#886644';
    ctx.fillRect(x + 4, floorY - doorHeight, TILE_WIDTH - 8, doorHeight);

    if (isOpen) {
      // Open door — dark interior
      ctx.fillStyle = '#000011';
      ctx.fillRect(x + 6, floorY - doorHeight + 2, TILE_WIDTH - 12, doorHeight - 4);

      // Light from inside
      const glow = 0.3 + 0.1 * Math.sin(this.frameCount * 0.05);
      ctx.fillStyle = `rgba(100, 150, 255, ${glow})`;
      ctx.fillRect(x + 6, floorY - doorHeight + 2, TILE_WIDTH - 12, doorHeight - 4);

      // Arrow indicator
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('↑', x + TILE_WIDTH / 2, floorY - doorHeight / 2);
    } else {
      // Closed door
      ctx.fillStyle = '#664422';
      ctx.fillRect(x + 6, floorY - doorHeight + 2, TILE_WIDTH - 12, doorHeight - 4);

      // Door planks
      ctx.strokeStyle = '#553311';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + TILE_WIDTH / 2, floorY - doorHeight + 2);
      ctx.lineTo(x + TILE_WIDTH / 2, floorY - 2);
      ctx.stroke();

      // Door knob
      ctx.fillStyle = '#aa8844';
      ctx.beginPath();
      ctx.arc(x + TILE_WIDTH / 2 + 5, floorY - doorHeight / 2, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Arch top
    ctx.strokeStyle = '#aa8866';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x + TILE_WIDTH / 2, floorY - doorHeight, TILE_WIDTH / 2 - 6, Math.PI, 0);
    ctx.stroke();
  }

  private renderSwordPickup(x: number, y: number): void {
    const ctx = this.ctx;
    const floorY = y + TILE_HEIGHT - 12;

    // Sword on ground
    ctx.fillStyle = PLAYER_COLORS.sword;
    ctx.fillRect(x + 8, floorY - 2, 16, 2);

    // Blade shine
    ctx.fillStyle = PLAYER_COLORS.swordHighlight;
    ctx.fillRect(x + 10, floorY - 2, 8, 1);

    // Guard (crosspiece)
    ctx.fillStyle = '#aa8844';
    ctx.fillRect(x + 7, floorY - 4, 4, 6);

    // Handle
    ctx.fillStyle = '#664422';
    ctx.fillRect(x + 4, floorY - 3, 4, 4);

    // Glow
    const glow = 0.2 + 0.1 * Math.sin(this.frameCount * 0.08);
    ctx.fillStyle = `rgba(200, 200, 255, ${glow})`;
    ctx.beginPath();
    ctx.ellipse(x + TILE_WIDTH / 2, floorY - 2, 14, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  private renderPlayer(player: Player): void {
    const ctx = this.ctx;
    const { x, y, direction, state, animFrame, swordDrawn } = player;

    if (!player.alive && state !== PlayerState.Die && state !== PlayerState.FallDie &&
        state !== PlayerState.SpikeDie && state !== PlayerState.ChomperDie) {
      return;
    }

    const facingRight = direction === Direction.Right;
    const px = x;
    const py = y;

    ctx.save();

    if (!facingRight) {
      ctx.translate(px + PLAYER_WIDTH / 2, 0);
      ctx.scale(-1, 1);
      ctx.translate(-(px + PLAYER_WIDTH / 2), 0);
    }

    // Death states
    if (state === PlayerState.Die || state === PlayerState.FallDie ||
        state === PlayerState.SpikeDie || state === PlayerState.ChomperDie) {
      this.renderDeadPlayer(px, py, state, animFrame);
      ctx.restore();
      return;
    }

    // Body based on state
    switch (state) {
      case PlayerState.Crouch:
      case PlayerState.CrouchHop:
        this.renderCrouchingPlayer(px, py);
        break;
      case PlayerState.Hang:
        this.renderHangingPlayer(px, py);
        break;
      case PlayerState.ClimbUp:
        this.renderClimbingPlayer(px, py, animFrame);
        break;
      case PlayerState.Jump:
      case PlayerState.RunJump:
        this.renderJumpingPlayer(px, py, animFrame);
        break;
      case PlayerState.Run:
        this.renderRunningPlayer(px, py, animFrame);
        break;
      case PlayerState.Fall:
        this.renderFallingPlayer(px, py);
        break;
      case PlayerState.FightStance:
      case PlayerState.Strike:
      case PlayerState.Block:
      case PlayerState.StrikeRecover:
      case PlayerState.StepForward:
      case PlayerState.StepBack:
        this.renderFightingPlayer(px, py, state, animFrame);
        break;
      case PlayerState.Drink:
        this.renderDrinkingPlayer(px, py, animFrame);
        break;
      case PlayerState.EnterDoor:
        this.renderEnteringDoor(px, py, animFrame);
        break;
      default:
        this.renderStandingPlayer(px, py, swordDrawn);
        break;
    }

    ctx.restore();
  }

  private renderStandingPlayer(x: number, y: number, swordDrawn: boolean): void {
    const ctx = this.ctx;

    // Legs
    ctx.fillStyle = PLAYER_COLORS.pants;
    ctx.fillRect(x + 4, y + 32, 4, 16);
    ctx.fillRect(x + 8, y + 32, 4, 16);

    // Body
    ctx.fillStyle = PLAYER_COLORS.shirt;
    ctx.fillRect(x + 3, y + 16, 10, 16);

    // Head
    ctx.fillStyle = PLAYER_COLORS.skin;
    ctx.fillRect(x + 5, y + 6, 8, 10);

    // Hair
    ctx.fillStyle = PLAYER_COLORS.hair;
    ctx.fillRect(x + 5, y + 4, 8, 4);

    // Arms
    ctx.fillStyle = PLAYER_COLORS.skin;
    ctx.fillRect(x + 1, y + 18, 3, 10);
    ctx.fillRect(x + 12, y + 18, 3, 10);

    if (swordDrawn) {
      // Sword held
      ctx.fillStyle = PLAYER_COLORS.sword;
      ctx.fillRect(x + 14, y + 12, 2, 18);
      ctx.fillStyle = PLAYER_COLORS.swordHighlight;
      ctx.fillRect(x + 14, y + 12, 1, 18);
    }
  }

  private renderRunningPlayer(x: number, y: number, frame: number): void {
    const ctx = this.ctx;
    const legOffset = Math.sin(frame * 0.8) * 4;

    // Legs (animated)
    ctx.fillStyle = PLAYER_COLORS.pants;
    ctx.fillRect(x + 3 - legOffset, y + 32, 4, 16);
    ctx.fillRect(x + 9 + legOffset, y + 32, 4, 16);

    // Body (leaning forward)
    ctx.fillStyle = PLAYER_COLORS.shirt;
    ctx.fillRect(x + 4, y + 16, 10, 16);

    // Head
    ctx.fillStyle = PLAYER_COLORS.skin;
    ctx.fillRect(x + 6, y + 6, 8, 10);

    // Hair
    ctx.fillStyle = PLAYER_COLORS.hair;
    ctx.fillRect(x + 6, y + 4, 8, 4);

    // Arms (pumping)
    ctx.fillStyle = PLAYER_COLORS.skin;
    ctx.fillRect(x + 1 + legOffset, y + 18, 3, 8);
    ctx.fillRect(x + 12 - legOffset, y + 18, 3, 8);
  }

  private renderCrouchingPlayer(x: number, y: number): void {
    const ctx = this.ctx;

    // Legs (bent)
    ctx.fillStyle = PLAYER_COLORS.pants;
    ctx.fillRect(x + 2, y + 38, 6, 10);
    ctx.fillRect(x + 8, y + 38, 6, 10);

    // Body (lower)
    ctx.fillStyle = PLAYER_COLORS.shirt;
    ctx.fillRect(x + 3, y + 26, 10, 12);

    // Head
    ctx.fillStyle = PLAYER_COLORS.skin;
    ctx.fillRect(x + 5, y + 18, 8, 8);

    // Hair
    ctx.fillStyle = PLAYER_COLORS.hair;
    ctx.fillRect(x + 5, y + 16, 8, 4);
  }

  private renderHangingPlayer(x: number, y: number): void {
    const ctx = this.ctx;

    // Arms reaching up
    ctx.fillStyle = PLAYER_COLORS.skin;
    ctx.fillRect(x + 3, y, 3, 16);
    ctx.fillRect(x + 10, y, 3, 16);

    // Body
    ctx.fillStyle = PLAYER_COLORS.shirt;
    ctx.fillRect(x + 3, y + 14, 10, 16);

    // Head
    ctx.fillStyle = PLAYER_COLORS.skin;
    ctx.fillRect(x + 5, y + 6, 6, 8);

    // Hair
    ctx.fillStyle = PLAYER_COLORS.hair;
    ctx.fillRect(x + 5, y + 4, 6, 4);

    // Legs (dangling)
    ctx.fillStyle = PLAYER_COLORS.pants;
    ctx.fillRect(x + 4, y + 30, 4, 16);
    ctx.fillRect(x + 8, y + 30, 4, 14);
  }

  private renderClimbingPlayer(x: number, y: number, frame: number): void {
    const ctx = this.ctx;
    const progress = Math.min(frame / 10, 1);
    const yOffset = -progress * 20;

    // Arms
    ctx.fillStyle = PLAYER_COLORS.skin;
    ctx.fillRect(x + 3, y + yOffset, 3, 12);
    ctx.fillRect(x + 10, y + yOffset, 3, 12);

    // Body
    ctx.fillStyle = PLAYER_COLORS.shirt;
    ctx.fillRect(x + 3, y + 10 + yOffset, 10, 16);

    // Head
    ctx.fillStyle = PLAYER_COLORS.skin;
    ctx.fillRect(x + 5, y + 2 + yOffset, 6, 8);

    // Legs
    ctx.fillStyle = PLAYER_COLORS.pants;
    ctx.fillRect(x + 4, y + 26 + yOffset, 4, 14);
    ctx.fillRect(x + 8, y + 26 + yOffset, 4, 14);
  }

  private renderJumpingPlayer(x: number, y: number, frame: number): void {
    const ctx = this.ctx;

    // Legs (extended)
    ctx.fillStyle = PLAYER_COLORS.pants;
    ctx.fillRect(x + 2, y + 34, 5, 14);
    ctx.fillRect(x + 9, y + 30, 5, 14);

    // Body
    ctx.fillStyle = PLAYER_COLORS.shirt;
    ctx.fillRect(x + 3, y + 16, 10, 16);

    // Head
    ctx.fillStyle = PLAYER_COLORS.skin;
    ctx.fillRect(x + 5, y + 6, 8, 10);

    // Hair
    ctx.fillStyle = PLAYER_COLORS.hair;
    ctx.fillRect(x + 5, y + 4, 8, 4);

    // Arms (reaching forward/up)
    ctx.fillStyle = PLAYER_COLORS.skin;
    ctx.fillRect(x + 12, y + 12, 4, 3);
    ctx.fillRect(x, y + 14, 4, 3);
  }

  private renderFallingPlayer(x: number, y: number): void {
    const ctx = this.ctx;

    // Legs (spread)
    ctx.fillStyle = PLAYER_COLORS.pants;
    ctx.fillRect(x + 1, y + 34, 5, 14);
    ctx.fillRect(x + 10, y + 34, 5, 14);

    // Body
    ctx.fillStyle = PLAYER_COLORS.shirt;
    ctx.fillRect(x + 3, y + 18, 10, 16);

    // Head
    ctx.fillStyle = PLAYER_COLORS.skin;
    ctx.fillRect(x + 5, y + 8, 8, 10);

    // Arms (flailing)
    ctx.fillStyle = PLAYER_COLORS.skin;
    const armWave = Math.sin(this.frameCount * 0.5) * 4;
    ctx.fillRect(x - 2, y + 14 + armWave, 5, 3);
    ctx.fillRect(x + 13, y + 14 - armWave, 5, 3);
  }

  private renderFightingPlayer(x: number, y: number, state: PlayerState, frame: number): void {
    const ctx = this.ctx;

    // Legs (fighting stance)
    ctx.fillStyle = PLAYER_COLORS.pants;
    ctx.fillRect(x + 2, y + 32, 4, 16);
    ctx.fillRect(x + 10, y + 34, 4, 14);

    // Body
    ctx.fillStyle = PLAYER_COLORS.shirt;
    ctx.fillRect(x + 3, y + 16, 10, 16);

    // Head
    ctx.fillStyle = PLAYER_COLORS.skin;
    ctx.fillRect(x + 5, y + 6, 8, 10);

    // Hair
    ctx.fillStyle = PLAYER_COLORS.hair;
    ctx.fillRect(x + 5, y + 4, 8, 4);

    // Sword arm based on state
    ctx.fillStyle = PLAYER_COLORS.skin;

    if (state === PlayerState.Strike) {
      // Striking — sword extended forward
      ctx.fillRect(x + 12, y + 16, 6, 3);
      ctx.fillStyle = PLAYER_COLORS.sword;
      ctx.fillRect(x + 16, y + 14, 14, 2);
      ctx.fillStyle = PLAYER_COLORS.swordHighlight;
      ctx.fillRect(x + 16, y + 14, 14, 1);
    } else if (state === PlayerState.Block) {
      // Blocking — sword up
      ctx.fillRect(x + 12, y + 14, 4, 3);
      ctx.fillStyle = PLAYER_COLORS.sword;
      ctx.fillRect(x + 14, y + 2, 2, 14);
      ctx.fillStyle = PLAYER_COLORS.swordHighlight;
      ctx.fillRect(x + 14, y + 2, 1, 14);
    } else {
      // Fight stance — sword at ready
      ctx.fillRect(x + 12, y + 18, 4, 3);
      ctx.fillStyle = PLAYER_COLORS.sword;
      ctx.fillRect(x + 14, y + 8, 2, 14);
      ctx.fillStyle = PLAYER_COLORS.swordHighlight;
      ctx.fillRect(x + 14, y + 8, 1, 14);
    }

    // Shield arm
    ctx.fillStyle = PLAYER_COLORS.skin;
    ctx.fillRect(x - 1, y + 18, 4, 8);
  }

  private renderDrinkingPlayer(x: number, y: number, frame: number): void {
    const ctx = this.ctx;

    // Standing body
    this.renderStandingPlayer(x, y, false);

    // Arm raised with bottle
    ctx.fillStyle = PLAYER_COLORS.skin;
    ctx.fillRect(x + 5, y + 4, 3, 12);

    // Potion bottle
    ctx.fillStyle = '#ff4444';
    ctx.fillRect(x + 4, y, 5, 6);
  }

  private renderEnteringDoor(x: number, y: number, frame: number): void {
    const ctx = this.ctx;
    const alpha = Math.max(0, 1 - frame / 15);

    ctx.globalAlpha = alpha;
    this.renderStandingPlayer(x, y, false);
    ctx.globalAlpha = 1;
  }

  private renderDeadPlayer(x: number, y: number, state: PlayerState, frame: number): void {
    const ctx = this.ctx;

    if (state === PlayerState.SpikeDie) {
      // Impaled on spikes
      ctx.fillStyle = PLAYER_COLORS.shirt;
      ctx.fillRect(x + 2, y + 20, 12, 10);
      ctx.fillStyle = PLAYER_COLORS.pants;
      ctx.fillRect(x + 4, y + 30, 8, 8);
      ctx.fillStyle = PLAYER_COLORS.skin;
      ctx.fillRect(x + 4, y + 14, 8, 6);
      ctx.fillStyle = '#880000';
      ctx.fillRect(x + 6, y + 38, 4, 4);
    } else if (state === PlayerState.ChomperDie) {
      // Nothing to render — chomped
      ctx.fillStyle = '#880000';
      ctx.fillRect(x + 4, y + 40, 8, 4);
    } else {
      // Collapsed
      ctx.fillStyle = PLAYER_COLORS.shirt;
      ctx.fillRect(x, y + 40, 16, 6);
      ctx.fillStyle = PLAYER_COLORS.pants;
      ctx.fillRect(x + 2, y + 42, 12, 6);
      ctx.fillStyle = PLAYER_COLORS.skin;
      ctx.fillRect(x + 12, y + 38, 6, 4);
      ctx.fillStyle = PLAYER_COLORS.hair;
      ctx.fillRect(x + 14, y + 37, 4, 3);
    }
  }

  private renderGuard(guard: Guard): void {
    const ctx = this.ctx;
    const { x, y, direction, state: gState, type, animFrame } = guard;
    const colors = GUARD_COLORS[type] ?? GUARD_COLORS.normal;
    const facingRight = direction === Direction.Right;

    ctx.save();

    if (!facingRight) {
      ctx.translate(x + GUARD_WIDTH / 2, 0);
      ctx.scale(-1, 1);
      ctx.translate(-(x + GUARD_WIDTH / 2), 0);
    }

    if (gState === GuardState.Die || gState === GuardState.Dead) {
      // Dead guard — collapsed
      ctx.fillStyle = colors.shirt;
      ctx.fillRect(x, y + 40, 16, 6);
      ctx.fillStyle = colors.pants;
      ctx.fillRect(x + 2, y + 42, 12, 6);
      ctx.fillStyle = colors.skin;
      ctx.fillRect(x + 12, y + 38, 6, 4);
      ctx.restore();
      return;
    }

    // Legs
    ctx.fillStyle = colors.pants;
    if (gState === GuardState.Advance || gState === GuardState.Retreat) {
      const legOff = Math.sin(animFrame * 0.6) * 3;
      ctx.fillRect(x + 3 - legOff, y + 32, 4, 16);
      ctx.fillRect(x + 9 + legOff, y + 32, 4, 16);
    } else {
      ctx.fillRect(x + 4, y + 32, 4, 16);
      ctx.fillRect(x + 8, y + 34, 4, 14);
    }

    // Body
    ctx.fillStyle = colors.shirt;
    ctx.fillRect(x + 3, y + 16, 10, 16);

    // Head
    ctx.fillStyle = colors.skin;
    ctx.fillRect(x + 5, y + 6, 8, 10);

    // Helmet/turban
    ctx.fillStyle = type === GuardType.Skeleton ? '#666644' : '#dd4444';
    ctx.fillRect(x + 4, y + 3, 10, 5);

    // Sword
    if (gState === GuardState.Strike) {
      ctx.fillStyle = '#ccccdd';
      ctx.fillRect(x + 14, y + 14, 14, 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 14, y + 14, 14, 1);
    } else if (gState === GuardState.Block) {
      ctx.fillStyle = '#ccccdd';
      ctx.fillRect(x + 14, y + 2, 2, 14);
    } else if (gState !== GuardState.Inactive) {
      ctx.fillStyle = '#ccccdd';
      ctx.fillRect(x + 14, y + 8, 2, 14);
    }

    // Skeleton special: bone-white, glowing eyes
    if (type === GuardType.Skeleton) {
      ctx.fillStyle = '#ff4444';
      ctx.fillRect(x + 6, y + 9, 2, 2);
      ctx.fillRect(x + 10, y + 9, 2, 2);
    }

    ctx.restore();
  }

  private renderHUD(state: GameState): void {
    const ctx = this.ctx;
    const hudY = ROOM_ROWS * TILE_HEIGHT;

    // HUD background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, hudY, CANVAS_WIDTH, 11);

    // Player HP (hearts)
    for (let i = 0; i < state.player.maxHp; i++) {
      const hx = 4 + i * 10;
      const hy = hudY + 2;

      if (i < state.player.hp) {
        // Filled heart
        ctx.fillStyle = '#ff2222';
        this.renderHeart(hx, hy, true);
      } else {
        // Empty heart
        ctx.fillStyle = '#442222';
        this.renderHeart(hx, hy, false);
      }
    }

    // Guard HP (if fighting)
    const activeGuard = state.guards.find(
      (g) => g.room === state.player.room && g.alive && g.state !== GuardState.Inactive
    );
    if (activeGuard) {
      for (let i = 0; i < activeGuard.maxHp; i++) {
        const hx = CANVAS_WIDTH - 8 - (activeGuard.maxHp - i) * 10;
        const hy = hudY + 2;

        if (i < activeGuard.hp) {
          ctx.fillStyle = '#4444ff';
          this.renderHeart(hx, hy, true);
        } else {
          ctx.fillStyle = '#222244';
          this.renderHeart(hx, hy, false);
        }
      }
    }

    // Timer (center)
    const mins = Math.floor(state.timeRemaining / 60);
    const secs = Math.floor(state.timeRemaining % 60);
    ctx.fillStyle = state.timeRemaining < 300 ? '#ff4444' : '#aaaaaa';
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(
      `${mins}:${secs.toString().padStart(2, '0')}`,
      CANVAS_WIDTH / 2,
      hudY + 9
    );

    // Level indicator
    ctx.fillStyle = '#888888';
    ctx.textAlign = 'left';
    ctx.fillText(`L${state.currentLevel}`, 2, 8);
  }

  private renderHeart(x: number, y: number, filled: boolean): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + 4, y + 7);
    ctx.bezierCurveTo(x + 4, y + 5, x, y, x, y + 3);
    ctx.bezierCurveTo(x, y + 5, x + 4, y + 7, x + 4, y + 7);
    ctx.bezierCurveTo(x + 4, y + 7, x + 8, y + 5, x + 8, y + 3);
    ctx.bezierCurveTo(x + 8, y, x + 4, y + 5, x + 4, y + 7);
    ctx.fill();
  }

  renderTitleScreen(): void {
    const ctx = this.ctx;

    // Background
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, this.width, this.height);

    // Decorative frame
    ctx.strokeStyle = '#886644';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, this.width - 20, this.height - 20);
    ctx.strokeRect(14, 14, this.width - 28, this.height - 28);

    // Title
    ctx.fillStyle = '#ff8844';
    ctx.font = 'bold 18px serif';
    ctx.textAlign = 'center';
    ctx.fillText('PRINCE OF PERSIA', this.width / 2, 50);

    // Subtitle
    ctx.fillStyle = '#aa6633';
    ctx.font = '10px serif';
    ctx.fillText('A Web Recreation', this.width / 2, 65);

    // Decorative sword
    ctx.strokeStyle = '#ccccdd';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.width / 2 - 30, 80);
    ctx.lineTo(this.width / 2 + 30, 80);
    ctx.stroke();
    ctx.fillStyle = '#aa8844';
    ctx.fillRect(this.width / 2 - 3, 76, 6, 8);

    // Instructions
    ctx.fillStyle = '#888899';
    ctx.font = '8px monospace';
    const instructions = [
      '← → : Move / Run',
      '↑ : Jump / Climb up',
      '↓ : Crouch / Climb down',
      'Shift : Careful step / Attack',
      'Up (in combat) : Block',
      '',
      'Escape the dungeon.',
      'Defeat the guards.',
      'Save the Princess.',
      'You have 60 minutes.',
    ];

    instructions.forEach((line, i) => {
      ctx.fillText(line, this.width / 2, 100 + i * 10);
    });

    // Start prompt (blinking)
    if (Math.floor(this.frameCount / 30) % 2 === 0) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px monospace';
      ctx.fillText('Press ENTER to start', this.width / 2, this.height - 20);
    }
  }

  private renderGameOver(state: GameState): void {
    const ctx = this.ctx;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 16px serif';
    ctx.textAlign = 'center';

    if (state.timeRemaining <= 0) {
      ctx.fillText('TIME HAS RUN OUT', this.width / 2, this.height / 2 - 20);
      ctx.fillStyle = '#888888';
      ctx.font = '10px serif';
      ctx.fillText('The Princess is lost...', this.width / 2, this.height / 2);
    } else {
      ctx.fillText('YOU HAVE DIED', this.width / 2, this.height / 2 - 20);
      ctx.fillStyle = '#888888';
      ctx.font = '10px serif';
      const mins = Math.floor(state.timeRemaining / 60);
      ctx.fillText(`${mins} minutes remaining`, this.width / 2, this.height / 2);
    }

    if (Math.floor(this.frameCount / 30) % 2 === 0) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px monospace';
      ctx.fillText('Press ENTER to retry', this.width / 2, this.height / 2 + 30);
    }
  }

  private renderVictory(state: GameState): void {
    const ctx = this.ctx;

    ctx.fillStyle = '#0a0a2a';
    ctx.fillRect(0, 0, this.width, this.height);

    // Stars
    for (let i = 0; i < 30; i++) {
      const sx = (i * 37 + this.frameCount * 0.3) % this.width;
      const sy = (i * 23 + this.frameCount * 0.1) % (this.height - 60);
      ctx.fillStyle = `rgba(255,255,200,${0.3 + Math.sin(i + this.frameCount * 0.05) * 0.3})`;
      ctx.fillRect(sx, sy, 2, 2);
    }

    ctx.fillStyle = '#ffdd44';
    ctx.font = 'bold 16px serif';
    ctx.textAlign = 'center';
    ctx.fillText('VICTORY!', this.width / 2, 50);

    ctx.fillStyle = '#ffffff';
    ctx.font = '10px serif';
    ctx.fillText('You have saved the Princess!', this.width / 2, 75);

    const mins = Math.floor((3600 - state.timeRemaining) / 60);
    const secs = Math.floor((3600 - state.timeRemaining) % 60);
    ctx.fillStyle = '#aaaacc';
    ctx.font = '10px monospace';
    ctx.fillText(`Time: ${mins}m ${secs}s`, this.width / 2, 100);

    // Princess silhouette
    ctx.fillStyle = '#ffaacc';
    ctx.beginPath();
    ctx.ellipse(this.width / 2, 135, 8, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(this.width / 2 - 10, 143, 20, 30);

    // Prince silhouette
    ctx.fillStyle = '#aaaaff';
    ctx.beginPath();
    ctx.ellipse(this.width / 2 - 20, 140, 6, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(this.width / 2 - 26, 146, 12, 24);

    if (Math.floor(this.frameCount / 30) % 2 === 0) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px monospace';
      ctx.fillText('Press ENTER to play again', this.width / 2, this.height - 15);
    }
  }

  private renderLevelTransition(state: GameState): void {
    const ctx = this.ctx;
    const progress = Math.min(state.levelTransitionTimer / 60, 1);

    ctx.fillStyle = `rgba(0, 0, 0, ${progress})`;
    ctx.fillRect(0, 0, this.width, this.height);

    if (progress > 0.5) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px serif';
      ctx.textAlign = 'center';
      ctx.fillText(`Level ${state.currentLevel}`, this.width / 2, this.height / 2 - 10);

      const level = getLevel(state.currentLevel);
      if (level) {
        ctx.fillStyle = '#aaaaaa';
        ctx.font = '10px serif';
        ctx.fillText(level.name, this.width / 2, this.height / 2 + 10);
      }
    }
  }

  private renderPauseOverlay(): void {
    const ctx = this.ctx;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.fillStyle = '#ffffff';
    ctx.font = '14px serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', this.width / 2, this.height / 2);

    ctx.fillStyle = '#888888';
    ctx.font = '8px monospace';
    ctx.fillText('Press ESC to resume', this.width / 2, this.height / 2 + 16);
  }
}
