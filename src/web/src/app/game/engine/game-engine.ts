// Main game engine — game loop, input handling, state management
// Prince of Persia Web

import {
  type GameState,
  type InputState,
  type Player,
  type Guard,
  type LooseFloorState,
  type GateState,
  type SpikeState,
  type ChomperState,
  TileType,
  PotionType,
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
  RUN_SPEED,
  WALK_SPEED,
  JUMP_VELOCITY,
  RUNJUMP_VELOCITY_X,
  RUNJUMP_VELOCITY_Y,
  TOTAL_TIME_SECONDS,
  LOOSE_FLOOR_DELAY,
  CHOMPER_CYCLE,
  SPIKE_EXTEND_DURATION,
  GATE_SPEED,
  GRAVITY,
  MAX_FALL_SPEED,
} from './types';
import { getLevel, GUARD_SKILLS } from './levels';
import {
  hasFloor,
  isWall,
  getFloorY,
  checkRoomTransition,
  getTileUnderPlayer,
  calculateFallDamage,
  canGrabLedge,
  getDistance,
} from './physics';
import { Renderer } from './renderer';

export class GameEngine {
  private state: GameState;
  private input: InputState;
  private renderer: Renderer;
  private canvas: HTMLCanvasElement;
  private lastTick: number;
  private tickAccumulator: number;
  private animationFrame: number | null = null;
  private tickRate: number = 1000 / 12; // ~12 ticks per second
  private running = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    this.renderer = new Renderer(ctx, canvas.width, canvas.height);
    this.input = {
      left: false, right: false, up: false, down: false,
      shift: false, space: false, enter: false,
    };
    this.state = this.createInitialState();
    this.lastTick = 0;
    this.tickAccumulator = 0;

    this.setupInput();
  }

  private createInitialState(): GameState {
    return {
      currentLevel: 1,
      player: this.createPlayer(1),
      guards: [],
      looseFloors: [],
      gates: [],
      spikes: [],
      chompers: [],
      timeRemaining: TOTAL_TIME_SECONDS,
      timerRunning: false,
      gameOver: false,
      victory: false,
      paused: false,
      titleScreen: true,
      levelComplete: false,
      levelTransitionTimer: 0,
      consumedPotions: new Set(),
      pickedUpSword: false,
    };
  }

  private createPlayer(levelId: number): Player {
    const level = getLevel(levelId);
    if (!level) {
      return this.defaultPlayer();
    }

    const floorY = getFloorY(level.startRow);

    return {
      x: level.startCol * TILE_WIDTH + 8,
      y: floorY - PLAYER_HEIGHT,
      room: level.startRoom,
      direction: level.startDirection,
      state: PlayerState.Stand,
      stateTimer: 0,
      animFrame: 0,
      hp: 3,
      maxHp: 3,
      hasSword: false,
      swordDrawn: false,
      fallDistance: 0,
      featherFallTimer: 0,
      alive: true,
      jumpVelocityY: 0,
      onGround: true,
    };
  }

  private defaultPlayer(): Player {
    return {
      x: 80, y: 100,
      room: 1,
      direction: Direction.Right,
      state: PlayerState.Stand,
      stateTimer: 0,
      animFrame: 0,
      hp: 3, maxHp: 3,
      hasSword: false, swordDrawn: false,
      fallDistance: 0, featherFallTimer: 0,
      alive: true, jumpVelocityY: 0, onGround: true,
    };
  }

  private loadLevel(levelId: number): void {
    const level = getLevel(levelId);
    if (!level) {
      this.state.victory = true;
      return;
    }

    this.state.currentLevel = levelId;

    // Keep player HP between levels
    const prevHp = this.state.player.hp;
    const prevMaxHp = this.state.player.maxHp;
    const prevSword = this.state.player.hasSword;

    this.state.player = this.createPlayer(levelId);
    this.state.player.hp = prevHp;
    this.state.player.maxHp = prevMaxHp;
    this.state.player.hasSword = prevSword;

    // Initialize guards
    this.state.guards = level.guards.map((gp) => {
      const skill = GUARD_SKILLS[Math.min(gp.skill, GUARD_SKILLS.length - 1)];
      const floorY = getFloorY(gp.row);
      return {
        x: gp.col * TILE_WIDTH + 8,
        y: floorY - GUARD_HEIGHT,
        room: gp.room,
        direction: gp.direction,
        state: GuardState.Inactive,
        type: gp.type,
        hp: gp.hp + skill.extraStrength,
        maxHp: gp.hp + skill.extraStrength,
        skill,
        stateTimer: 0,
        animFrame: 0,
        refractTimer: 0,
        alive: true,
      };
    });

    // Initialize loose floors
    this.state.looseFloors = [];
    this.state.gates = [];
    this.state.spikes = [];
    this.state.chompers = [];

    // Scan rooms for dynamic tiles
    for (const [roomIdStr, room] of Object.entries(level.rooms)) {
      const roomId = parseInt(roomIdStr, 10);
      for (let row = 0; row < ROOM_ROWS; row++) {
        for (let col = 0; col < ROOM_COLS; col++) {
          const tile = room.tiles[row][col];
          switch (tile.type) {
            case TileType.LooseFloor:
              this.state.looseFloors.push({
                room: roomId, col, row,
                shakeTimer: 0, falling: false, fallY: 0, gone: false,
              });
              break;
            case TileType.Gate:
              this.state.gates.push({
                room: roomId, col, row,
                open: 0, targetOpen: 0,
              });
              break;
            case TileType.ExitDoor:
              this.state.gates.push({
                room: roomId, col, row,
                open: 0, targetOpen: 0,
              });
              break;
            case TileType.Spikes:
              this.state.spikes.push({
                room: roomId, col, row,
                extended: false, timer: 0,
              });
              break;
            case TileType.Chomper:
              this.state.chompers.push({
                room: roomId, col, row,
                timer: Math.floor(Math.random() * CHOMPER_CYCLE),
                closed: false,
              });
              break;
          }
        }
      }
    }

    this.state.levelComplete = false;
    this.state.levelTransitionTimer = 0;
  }

  private setupInput(): void {
    const handleKey = (e: KeyboardEvent, pressed: boolean) => {
      switch (e.key) {
        case 'ArrowLeft': this.input.left = pressed; break;
        case 'ArrowRight': this.input.right = pressed; break;
        case 'ArrowUp': this.input.up = pressed; break;
        case 'ArrowDown': this.input.down = pressed; break;
        case 'Shift': this.input.shift = pressed; break;
        case ' ': this.input.space = pressed; break;
        case 'Enter': this.input.enter = pressed; break;
        case 'Escape':
          if (pressed && !this.state.titleScreen && !this.state.gameOver && !this.state.victory) {
            this.state.paused = !this.state.paused;
          }
          break;
      }
      // Prevent default for game keys
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Shift'].includes(e.key)) {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', (e) => handleKey(e, true));
    window.addEventListener('keyup', (e) => handleKey(e, false));
  }

  start(): void {
    this.running = true;
    this.lastTick = performance.now();
    this.tickAccumulator = 0;
    this.gameLoop(performance.now());
  }

  stop(): void {
    this.running = false;
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  private gameLoop(timestamp: number): void {
    if (!this.running) return;

    const delta = timestamp - this.lastTick;
    this.lastTick = timestamp;
    this.tickAccumulator += delta;

    // Process game ticks at fixed rate
    while (this.tickAccumulator >= this.tickRate) {
      this.tickAccumulator -= this.tickRate;
      this.gameTick();
    }

    // Render at display refresh rate
    this.renderer.render(this.state);

    this.animationFrame = requestAnimationFrame((t) => this.gameLoop(t));
  }

  private gameTick(): void {
    // Title screen
    if (this.state.titleScreen) {
      if (this.input.enter) {
        this.state.titleScreen = false;
        this.state.timerRunning = true;
        this.loadLevel(1);
        this.input.enter = false;
      }
      return;
    }

    // Game over
    if (this.state.gameOver) {
      if (this.input.enter) {
        this.restartLevel();
        this.input.enter = false;
      }
      return;
    }

    // Victory
    if (this.state.victory) {
      if (this.input.enter) {
        this.state = this.createInitialState();
        this.input.enter = false;
      }
      return;
    }

    // Paused
    if (this.state.paused) return;

    // Level transition
    if (this.state.levelComplete) {
      this.state.levelTransitionTimer++;
      if (this.state.levelTransitionTimer > 90) {
        this.loadLevel(this.state.currentLevel + 1);
      }
      return;
    }

    // Timer
    if (this.state.timerRunning) {
      this.state.timeRemaining -= 1 / 12; // 12 ticks per second
      if (this.state.timeRemaining <= 0) {
        this.state.timeRemaining = 0;
        this.state.gameOver = true;
        return;
      }
    }

    // Feather fall timer
    if (this.state.player.featherFallTimer > 0) {
      this.state.player.featherFallTimer -= 1 / 12;
    }

    // Update player
    this.updatePlayer();

    // Update guards
    this.updateGuards();

    // Update traps
    this.updateTraps();

    // Check interactions
    this.checkInteractions();
  }

  private updatePlayer(): void {
    const player = this.state.player;
    if (!player.alive) return;

    const input = this.input;

    // Handle state transitions
    switch (player.state) {
      case PlayerState.Stand:
        this.handleStanding(player, input);
        break;
      case PlayerState.Run:
        this.handleRunning(player, input);
        break;
      case PlayerState.Jump:
        this.handleJump(player);
        break;
      case PlayerState.RunJump:
        this.handleRunJump(player);
        break;
      case PlayerState.Fall:
        this.handleFall(player);
        break;
      case PlayerState.Crouch:
        this.handleCrouch(player, input);
        break;
      case PlayerState.CrouchHop:
        this.handleCrouchHop(player);
        break;
      case PlayerState.Hang:
        this.handleHang(player, input);
        break;
      case PlayerState.ClimbUp:
        this.handleClimbUp(player);
        break;
      case PlayerState.ClimbDown:
        this.handleClimbDown(player);
        break;
      case PlayerState.Turn:
        this.handleTurn(player);
        break;
      case PlayerState.Land:
      case PlayerState.HardLand:
        this.handleLand(player);
        break;
      case PlayerState.Drink:
        this.handleDrink(player);
        break;
      case PlayerState.PickupSword:
        this.handlePickupSword(player);
        break;
      case PlayerState.FightStance:
        this.handleFightStance(player, input);
        break;
      case PlayerState.Strike:
        this.handleStrike(player);
        break;
      case PlayerState.Block:
        this.handleBlock(player);
        break;
      case PlayerState.StrikeRecover:
        this.handleStrikeRecover(player);
        break;
      case PlayerState.Hurt:
        this.handleHurt(player);
        break;
      case PlayerState.StepForward:
      case PlayerState.StepBack:
        this.handleStep(player);
        break;
      case PlayerState.Die:
      case PlayerState.FallDie:
      case PlayerState.SpikeDie:
      case PlayerState.ChomperDie:
        this.handleDeath(player);
        break;
      case PlayerState.EnterDoor:
        this.handleEnterDoor(player);
        break;
    }

    // Room transitions
    this.checkPlayerRoomTransition();

    // Check if player needs to auto-draw sword
    this.checkAutoDrawSword();
  }

  private handleStanding(player: Player, input: InputState): void {
    player.stateTimer = 0;
    player.animFrame = 0;
    player.onGround = true;

    // Check if still on ground
    const col = Math.floor((player.x + PLAYER_WIDTH / 2) / TILE_WIDTH);
    const row = Math.floor((player.y + PLAYER_HEIGHT) / TILE_HEIGHT);

    if (!hasFloor(this.state, player.room, col, row)) {
      player.state = PlayerState.Fall;
      player.jumpVelocityY = 0;
      player.fallDistance = 0;
      return;
    }

    // Turn
    if ((input.left && player.direction === Direction.Right) ||
        (input.right && player.direction === Direction.Left)) {
      player.state = PlayerState.Turn;
      player.stateTimer = 0;
      return;
    }

    // Jump up
    if (input.up && !input.left && !input.right) {
      // Check if can grab ledge above
      if (row > 0 && canGrabLedge(this.state, player.room, col, row - 1)) {
        // Jump to hang
        player.state = PlayerState.Hang;
        player.y = (row - 1) * TILE_HEIGHT + 10;
        player.stateTimer = 0;
        return;
      }
      // Standing jump
      player.state = PlayerState.Jump;
      player.jumpVelocityY = JUMP_VELOCITY;
      player.fallDistance = 0;
      player.onGround = false;
      return;
    }

    // Crouch
    if (input.down) {
      player.state = PlayerState.Crouch;
      player.stateTimer = 0;
      return;
    }

    // Run or walk
    if (input.left || input.right) {
      const dir = input.left ? Direction.Left : Direction.Right;

      if (dir !== player.direction) {
        player.state = PlayerState.Turn;
        player.stateTimer = 0;
        return;
      }

      if (input.shift) {
        // Careful step
        const newX = player.x + dir * WALK_SPEED;
        const nextCol = Math.floor((newX + (dir === Direction.Right ? PLAYER_WIDTH : 0)) / TILE_WIDTH);

        if (!isWall(this.state, player.room, nextCol, row)) {
          // Check if there's floor ahead
          if (hasFloor(this.state, player.room, nextCol, row)) {
            player.x = newX;
          }
          // else: edge — stop (careful step prevents falling)
        }
      } else {
        player.state = PlayerState.Run;
        player.animFrame = 0;
      }
    }
  }

  private handleRunning(player: Player, input: InputState): void {
    const dir = player.direction;
    const speed = RUN_SPEED;

    player.animFrame++;

    // Running jump
    if (input.up) {
      player.state = PlayerState.RunJump;
      player.jumpVelocityY = RUNJUMP_VELOCITY_Y;
      player.fallDistance = 0;
      player.onGround = false;
      return;
    }

    // Stop running
    if ((dir === Direction.Left && !input.left) || (dir === Direction.Right && !input.right)) {
      player.state = PlayerState.Stand;
      return;
    }

    // Move
    const newX = player.x + dir * speed;
    const nextCol = Math.floor((newX + (dir === Direction.Right ? PLAYER_WIDTH : 0)) / TILE_WIDTH);
    const currentRow = Math.floor((player.y + PLAYER_HEIGHT) / TILE_HEIGHT);

    // Wall check
    if (isWall(this.state, player.room, nextCol, currentRow)) {
      player.state = PlayerState.Stand;
      return;
    }

    player.x = newX;

    // Ground check
    const col = Math.floor((player.x + PLAYER_WIDTH / 2) / TILE_WIDTH);
    if (!hasFloor(this.state, player.room, col, currentRow)) {
      player.state = PlayerState.Fall;
      player.jumpVelocityY = 0;
      player.fallDistance = 0;
      player.onGround = false;
    }
  }

  private handleJump(player: Player): void {
    player.stateTimer++;
    player.y += player.jumpVelocityY;
    player.jumpVelocityY += GRAVITY;

    if (player.jumpVelocityY > 0) {
      // Falling phase of jump
      player.fallDistance += player.jumpVelocityY;

      const col = Math.floor((player.x + PLAYER_WIDTH / 2) / TILE_WIDTH);
      const row = Math.floor((player.y + PLAYER_HEIGHT) / TILE_HEIGHT);
      const floorY = getFloorY(row);

      if (hasFloor(this.state, player.room, col, row) && player.y + PLAYER_HEIGHT >= floorY) {
        player.y = floorY - PLAYER_HEIGHT;
        this.handleLanding(player);
      }
    }

    // Ceiling check
    if (player.jumpVelocityY < 0) {
      const col = Math.floor((player.x + PLAYER_WIDTH / 2) / TILE_WIDTH);
      const headRow = Math.floor(player.y / TILE_HEIGHT);
      if (headRow >= 0 && isWall(this.state, player.room, col, headRow)) {
        player.jumpVelocityY = 0;
      }
    }

    if (player.stateTimer > 30) {
      player.state = PlayerState.Fall;
    }
  }

  private handleRunJump(player: Player): void {
    player.stateTimer++;
    player.animFrame++;

    // Move forward
    player.x += player.direction * RUNJUMP_VELOCITY_X;
    player.y += player.jumpVelocityY;
    player.jumpVelocityY += GRAVITY;

    if (player.jumpVelocityY > 0) {
      player.fallDistance += player.jumpVelocityY;

      const col = Math.floor((player.x + PLAYER_WIDTH / 2) / TILE_WIDTH);
      const row = Math.floor((player.y + PLAYER_HEIGHT) / TILE_HEIGHT);
      const floorY = getFloorY(row);

      if (hasFloor(this.state, player.room, col, row) && player.y + PLAYER_HEIGHT >= floorY) {
        player.y = floorY - PLAYER_HEIGHT;
        this.handleLanding(player);
      }
    }

    // Wall check
    const nextCol = Math.floor((player.x + (player.direction === Direction.Right ? PLAYER_WIDTH : 0)) / TILE_WIDTH);
    const currentRow = Math.floor((player.y + PLAYER_HEIGHT / 2) / TILE_HEIGHT);
    if (isWall(this.state, player.room, nextCol, currentRow)) {
      player.x -= player.direction * RUNJUMP_VELOCITY_X;
      player.jumpVelocityY = Math.max(player.jumpVelocityY, 0);
    }

    // Grab ledge check
    if (player.jumpVelocityY >= 0) {
      const grabCol = Math.floor((player.x + PLAYER_WIDTH / 2 + player.direction * 8) / TILE_WIDTH);
      const grabRow = Math.floor(player.y / TILE_HEIGHT);
      if (grabRow >= 0 && canGrabLedge(this.state, player.room, grabCol, grabRow + 1)) {
        const edgeY = grabRow * TILE_HEIGHT + TILE_HEIGHT - 12;
        if (Math.abs(player.y - edgeY + 10) < 15) {
          player.state = PlayerState.Hang;
          player.y = grabRow * TILE_HEIGHT + 10;
          player.x = grabCol * TILE_WIDTH - (player.direction === Direction.Right ? 0 : PLAYER_WIDTH - TILE_WIDTH);
          player.jumpVelocityY = 0;
          player.fallDistance = 0;
          return;
        }
      }
    }

    if (player.stateTimer > 30) {
      player.state = PlayerState.Fall;
    }
  }

  private handleFall(player: Player): void {
    player.jumpVelocityY = Math.min(player.jumpVelocityY + GRAVITY, MAX_FALL_SPEED);
    player.y += player.jumpVelocityY;
    player.fallDistance += Math.abs(player.jumpVelocityY);

    const col = Math.floor((player.x + PLAYER_WIDTH / 2) / TILE_WIDTH);
    const row = Math.floor((player.y + PLAYER_HEIGHT) / TILE_HEIGHT);

    if (row >= 0 && row < ROOM_ROWS) {
      const floorY = getFloorY(row);
      if (hasFloor(this.state, player.room, col, row) && player.y + PLAYER_HEIGHT >= floorY) {
        player.y = floorY - PLAYER_HEIGHT;
        this.handleLanding(player);
      }
    }
  }

  private handleLanding(player: Player): void {
    const damage = calculateFallDamage(
      player.fallDistance,
      player.featherFallTimer > 0
    );

    player.jumpVelocityY = 0;
    player.onGround = true;
    player.fallDistance = 0;

    if (damage >= 100) {
      this.killPlayer(PlayerState.FallDie);
      return;
    }

    if (damage > 0) {
      player.hp -= damage;
      if (player.hp <= 0) {
        this.killPlayer(PlayerState.FallDie);
        return;
      }
      player.state = PlayerState.HardLand;
    } else {
      player.state = PlayerState.Land;
    }
    player.stateTimer = 0;
  }

  private handleCrouch(player: Player, input: InputState): void {
    player.stateTimer++;

    if (!input.down) {
      player.state = PlayerState.Stand;
      return;
    }

    // Crouch hop
    if (input.left || input.right) {
      const dir = input.left ? Direction.Left : Direction.Right;
      player.direction = dir;
      player.state = PlayerState.CrouchHop;
      player.stateTimer = 0;
      return;
    }

    // Climb down
    const col = Math.floor((player.x + PLAYER_WIDTH / 2) / TILE_WIDTH);
    const row = Math.floor((player.y + PLAYER_HEIGHT) / TILE_HEIGHT);

    // Check edge for climb-down
    const edgeCol = player.direction === Direction.Right ? col + 1 : col - 1;
    if (edgeCol >= 0 && edgeCol < ROOM_COLS) {
      if (!hasFloor(this.state, player.room, edgeCol, row) && input.down) {
        // Can climb down at edge
        if (player.stateTimer > 6) {
          player.state = PlayerState.ClimbDown;
          player.stateTimer = 0;
        }
      }
    }
  }

  private handleCrouchHop(player: Player): void {
    player.stateTimer++;
    if (player.stateTimer < 6) {
      player.x += player.direction * 2;
    } else {
      player.state = PlayerState.Crouch;
      player.stateTimer = 0;
    }
  }

  private handleHang(player: Player, input: InputState): void {
    player.stateTimer++;

    if (input.up) {
      player.state = PlayerState.ClimbUp;
      player.stateTimer = 0;
      return;
    }

    if (input.down || (!input.shift && player.stateTimer > 30)) {
      // Let go
      player.state = PlayerState.Fall;
      player.jumpVelocityY = 0;
      player.fallDistance = 0;
      player.y += 20;
    }
  }

  private handleClimbUp(player: Player): void {
    player.stateTimer++;
    player.animFrame = player.stateTimer;

    if (player.stateTimer >= 12) {
      // Find the floor we're climbing onto
      const col = Math.floor((player.x + PLAYER_WIDTH / 2) / TILE_WIDTH);
      const currentRow = Math.floor(player.y / TILE_HEIGHT);
      const floorY = getFloorY(currentRow);

      player.y = floorY - PLAYER_HEIGHT;
      player.state = PlayerState.Stand;
      player.onGround = true;
    }
  }

  private handleClimbDown(player: Player): void {
    player.stateTimer++;

    if (player.stateTimer < 6) {
      // Lower down animation
      player.y += 4;
    } else {
      // Now hanging
      player.state = PlayerState.Hang;
      player.stateTimer = 0;
    }
  }

  private handleTurn(player: Player): void {
    player.stateTimer++;
    if (player.stateTimer >= 4) {
      player.direction = player.direction === Direction.Left ? Direction.Right : Direction.Left;
      player.state = PlayerState.Stand;
    }
  }

  private handleLand(player: Player): void {
    player.stateTimer++;
    const duration = player.state === PlayerState.HardLand ? 12 : 4;
    if (player.stateTimer >= duration) {
      player.state = PlayerState.Stand;
    }
  }

  private handleDrink(player: Player): void {
    player.stateTimer++;
    if (player.stateTimer >= 20) {
      player.state = PlayerState.Stand;
    }
  }

  private handlePickupSword(player: Player): void {
    player.stateTimer++;
    if (player.stateTimer >= 15) {
      player.hasSword = true;
      player.state = PlayerState.Stand;
    }
  }

  // Combat states
  private handleFightStance(player: Player, input: InputState): void {
    player.stateTimer++;

    // Check if guards are far away — sheathe sword
    const nearGuard = this.state.guards.find(
      (g) => g.room === player.room && g.alive && g.state !== GuardState.Inactive &&
             getDistance(player.x, g.x) < 120
    );
    if (!nearGuard) {
      player.swordDrawn = false;
      player.state = PlayerState.Stand;
      return;
    }

    // Attack
    if (input.shift) {
      player.state = PlayerState.Strike;
      player.stateTimer = 0;
      return;
    }

    // Block
    if (input.up) {
      player.state = PlayerState.Block;
      player.stateTimer = 0;
      return;
    }

    // Step forward/back
    if (input.left || input.right) {
      const inputDir = input.left ? Direction.Left : Direction.Right;
      if (inputDir === player.direction) {
        player.state = PlayerState.StepForward;
      } else {
        player.state = PlayerState.StepBack;
      }
      player.stateTimer = 0;
    }
  }

  private handleStrike(player: Player): void {
    player.stateTimer++;
    player.animFrame = player.stateTimer;

    // Check hit on guards
    if (player.stateTimer === 3) {
      this.checkPlayerStrikeHit();
    }

    if (player.stateTimer >= 8) {
      player.state = PlayerState.StrikeRecover;
      player.stateTimer = 0;
    }
  }

  private handleBlock(player: Player): void {
    player.stateTimer++;
    if (player.stateTimer >= 6) {
      player.state = PlayerState.FightStance;
      player.stateTimer = 0;
    }
  }

  private handleStrikeRecover(player: Player): void {
    player.stateTimer++;
    if (player.stateTimer >= 6) {
      player.state = PlayerState.FightStance;
      player.stateTimer = 0;
    }
  }

  private handleHurt(player: Player): void {
    player.stateTimer++;
    // Push back
    if (player.stateTimer <= 3) {
      const pushDir = player.direction === Direction.Right ? Direction.Left : Direction.Right;
      const newX = player.x + pushDir * 4;
      const col = Math.floor((newX + (pushDir === Direction.Right ? PLAYER_WIDTH : 0)) / TILE_WIDTH);
      const row = Math.floor((player.y + PLAYER_HEIGHT) / TILE_HEIGHT);
      if (!isWall(this.state, player.room, col, row)) {
        player.x = newX;
      }
    }
    if (player.stateTimer >= 8) {
      if (player.hp <= 0) {
        this.killPlayer(PlayerState.Die);
      } else {
        player.state = PlayerState.FightStance;
        player.stateTimer = 0;
      }
    }
  }

  private handleStep(player: Player): void {
    player.stateTimer++;
    const dir = player.state === PlayerState.StepForward
      ? player.direction
      : (player.direction === Direction.Left ? Direction.Right : Direction.Left);

    if (player.stateTimer <= 4) {
      const newX = player.x + dir * 2;
      const col = Math.floor((newX + (dir === Direction.Right ? PLAYER_WIDTH : 0)) / TILE_WIDTH);
      const row = Math.floor((player.y + PLAYER_HEIGHT) / TILE_HEIGHT);
      if (!isWall(this.state, player.room, col, row) && hasFloor(this.state, player.room, col, row)) {
        player.x = newX;
      }
    }

    if (player.stateTimer >= 6) {
      player.state = PlayerState.FightStance;
      player.stateTimer = 0;
    }
  }

  private handleDeath(player: Player): void {
    player.stateTimer++;
    if (player.stateTimer >= 30) {
      this.state.gameOver = true;
    }
  }

  private handleEnterDoor(player: Player): void {
    player.stateTimer++;
    player.animFrame = player.stateTimer;
    if (player.stateTimer >= 20) {
      this.state.levelComplete = true;
      this.state.levelTransitionTimer = 0;
    }
  }

  private checkPlayerRoomTransition(): void {
    const player = this.state.player;
    const transition = checkRoomTransition(this.state, player.room, player.x, player.y);

    if (transition) {
      if (transition.room === -1) {
        // Fell out of level
        this.killPlayer(PlayerState.FallDie);
        return;
      }
      player.room = transition.room;
      player.x = transition.x;
      player.y = transition.y;
    }
  }

  private checkAutoDrawSword(): void {
    const player = this.state.player;
    if (!player.hasSword || player.swordDrawn) return;
    if (player.state !== PlayerState.Stand && player.state !== PlayerState.Run) return;

    // Check for active guards in the same room
    const nearGuard = this.state.guards.find(
      (g) => g.room === player.room && g.alive &&
             g.state !== GuardState.Inactive && g.state !== GuardState.Dead &&
             getDistance(player.x, g.x) < 90
    );

    if (nearGuard) {
      player.swordDrawn = true;
      player.state = PlayerState.FightStance;
      player.stateTimer = 0;
      // Face the guard
      player.direction = nearGuard.x > player.x ? Direction.Right : Direction.Left;
    }
  }

  private checkPlayerStrikeHit(): void {
    const player = this.state.player;
    const strikeRange = 30;

    for (const guard of this.state.guards) {
      if (guard.room !== player.room || !guard.alive) continue;
      if (guard.state === GuardState.Dead || guard.state === GuardState.Inactive) continue;

      const dist = getDistance(player.x, guard.x);
      const facing = (player.direction === Direction.Right && guard.x > player.x) ||
                     (player.direction === Direction.Left && guard.x < player.x);

      if (dist < strikeRange + PLAYER_WIDTH && facing) {
        // Check if guard is blocking
        if (guard.state === GuardState.Block) {
          // Clang — blocked
          guard.stateTimer = 0;
          return;
        }

        // Hit!
        guard.hp--;
        if (guard.hp <= 0 && guard.type !== GuardType.Skeleton) {
          guard.state = GuardState.Die;
          guard.stateTimer = 0;
        } else {
          guard.state = GuardState.Hurt;
          guard.stateTimer = 0;
          guard.refractTimer = guard.skill.refractTimer;
        }

        // Push guard back
        const pushDir = player.direction;
        guard.x += pushDir * 15;
      }
    }
  }

  // Guard AI
  private updateGuards(): void {
    for (const guard of this.state.guards) {
      if (!guard.alive || guard.state === GuardState.Dead) continue;
      this.updateGuard(guard);
    }
  }

  private updateGuard(guard: Guard): void {
    const player = this.state.player;
    guard.animFrame++;

    if (guard.refractTimer > 0) {
      guard.refractTimer--;
    }

    switch (guard.state) {
      case GuardState.Inactive:
        // Activate when player is in the same room and close
        if (guard.room === player.room && player.alive) {
          const dist = getDistance(guard.x, player.x);
          if (dist < 100) {
            guard.state = GuardState.Active;
            guard.direction = player.x > guard.x ? Direction.Right : Direction.Left;
          }
        }
        break;

      case GuardState.Active:
      case GuardState.Fight:
        if (guard.room !== player.room || !player.alive) {
          guard.state = GuardState.Inactive;
          return;
        }
        this.guardFightAI(guard);
        break;

      case GuardState.Strike:
        guard.stateTimer++;
        if (guard.stateTimer === 3) {
          this.checkGuardStrikeHit(guard);
        }
        if (guard.stateTimer >= 8) {
          guard.state = GuardState.Fight;
          guard.stateTimer = 0;
        }
        break;

      case GuardState.Block:
        guard.stateTimer++;
        if (guard.stateTimer >= 6) {
          guard.state = GuardState.Fight;
          guard.stateTimer = 0;
        }
        break;

      case GuardState.Hurt:
        guard.stateTimer++;
        // Push back
        if (guard.stateTimer <= 3) {
          const pushDir = guard.direction === Direction.Right ? Direction.Left : Direction.Right;
          const newX = guard.x + pushDir * 4;
          const col = Math.floor((newX + (pushDir === Direction.Right ? GUARD_WIDTH : 0)) / TILE_WIDTH);
          const row = Math.floor((guard.y + GUARD_HEIGHT) / TILE_HEIGHT);

          // Check for edge — guard can fall
          if (!hasFloor(this.state, guard.room, col, row)) {
            // Guard falls off edge — die (or for skeleton, respawn)
            if (guard.type === GuardType.Skeleton) {
              guard.hp = guard.maxHp;
              guard.state = GuardState.Inactive;
            } else {
              guard.state = GuardState.Die;
            }
            guard.stateTimer = 0;
            return;
          }

          if (!isWall(this.state, guard.room, col, row)) {
            guard.x = newX;
          }
        }
        if (guard.stateTimer >= 8) {
          if (guard.hp <= 0 && guard.type !== GuardType.Skeleton) {
            guard.state = GuardState.Die;
          } else {
            guard.state = GuardState.Fight;
          }
          guard.stateTimer = 0;
        }
        break;

      case GuardState.Advance:
        guard.stateTimer++;
        guard.direction = player.x > guard.x ? Direction.Right : Direction.Left;
        guard.x += guard.direction * 2;
        if (guard.stateTimer >= 8) {
          guard.state = GuardState.Fight;
          guard.stateTimer = 0;
        }
        break;

      case GuardState.Retreat:
        guard.stateTimer++;
        guard.x -= guard.direction * 2;
        if (guard.stateTimer >= 6) {
          guard.state = GuardState.Fight;
          guard.stateTimer = 0;
        }
        break;

      case GuardState.Die:
        guard.stateTimer++;
        if (guard.stateTimer >= 20) {
          guard.state = GuardState.Dead;
          guard.alive = false;
        }
        break;
    }
  }

  private guardFightAI(guard: Guard): void {
    const player = this.state.player;
    const dist = getDistance(guard.x, player.x);

    guard.direction = player.x > guard.x ? Direction.Right : Direction.Left;

    if (guard.refractTimer > 0) return;

    const { strikeProb, blockProb, advanceProb, restrikeProb } = guard.skill;
    const roll = Math.floor(Math.random() * 256);

    if (dist < 35) {
      // Close range — fight
      guard.state = GuardState.Fight;

      // Check if player is striking
      if (player.state === PlayerState.Strike && player.stateTimer <= 4) {
        if (roll < blockProb) {
          guard.state = GuardState.Block;
          guard.stateTimer = 0;
          return;
        }
      }

      // Attack
      if (roll < strikeProb) {
        guard.state = GuardState.Strike;
        guard.stateTimer = 0;
        return;
      }

      // Retreat
      if (roll > 200) {
        guard.state = GuardState.Retreat;
        guard.stateTimer = 0;
      }
    } else if (dist < 80) {
      // Medium range — advance or attack
      if (roll < advanceProb) {
        guard.state = GuardState.Advance;
        guard.stateTimer = 0;
      }
    } else {
      // Far — advance
      guard.state = GuardState.Advance;
      guard.stateTimer = 0;
    }
  }

  private checkGuardStrikeHit(guard: Guard): void {
    const player = this.state.player;
    if (!player.alive || player.room !== guard.room) return;

    const dist = getDistance(guard.x, player.x);
    const facing = (guard.direction === Direction.Right && player.x > guard.x) ||
                   (guard.direction === Direction.Left && player.x < guard.x);

    if (dist < 30 + GUARD_WIDTH && facing) {
      // Check if player is blocking
      if (player.state === PlayerState.Block) {
        // Blocked!
        return;
      }

      // Player hit
      player.hp--;
      if (player.hp <= 0) {
        this.killPlayer(PlayerState.Die);
      } else {
        player.state = PlayerState.Hurt;
        player.stateTimer = 0;
      }
    }
  }

  // Traps
  private updateTraps(): void {
    this.updateLooseFloors();
    this.updateChompers();
    this.updateSpikes();
    this.updateGates();
  }

  private updateLooseFloors(): void {
    const player = this.state.player;

    for (const lf of this.state.looseFloors) {
      if (lf.gone) continue;

      // Check if player is on this loose floor
      if (player.room === lf.room && player.onGround && player.alive) {
        const pcol = Math.floor((player.x + PLAYER_WIDTH / 2) / TILE_WIDTH);
        const prow = Math.floor((player.y + PLAYER_HEIGHT) / TILE_HEIGHT);

        if (pcol === lf.col && prow === lf.row && lf.shakeTimer === 0 && !lf.falling) {
          lf.shakeTimer = 1;
        }
      }

      // Shake timer
      if (lf.shakeTimer > 0 && !lf.falling) {
        lf.shakeTimer++;
        if (lf.shakeTimer > LOOSE_FLOOR_DELAY) {
          lf.falling = true;
          lf.fallY = 0;
        }
      }

      // Falling
      if (lf.falling) {
        lf.fallY += 8;
        if (lf.fallY > TILE_HEIGHT) {
          lf.gone = true;
        }
      }
    }
  }

  private updateChompers(): void {
    for (const chomper of this.state.chompers) {
      chomper.timer = (chomper.timer + 1) % CHOMPER_CYCLE;
      chomper.closed = chomper.timer >= CHOMPER_CYCLE - 3;

      // Check if player is in chomper
      if (chomper.closed) {
        const player = this.state.player;
        if (player.room === chomper.room && player.alive) {
          const pcol = Math.floor((player.x + PLAYER_WIDTH / 2) / TILE_WIDTH);
          const prow = Math.floor((player.y + PLAYER_HEIGHT) / TILE_HEIGHT);

          if (pcol === chomper.col && prow === chomper.row) {
            this.killPlayer(PlayerState.ChomperDie);
          }
        }
      }
    }
  }

  private updateSpikes(): void {
    const player = this.state.player;

    for (const spike of this.state.spikes) {
      if (spike.extended) {
        spike.timer--;
        if (spike.timer <= 0) {
          spike.extended = false;
        }
      }

      // Trigger spikes when player steps on them or falls onto them
      if (player.room === spike.room && player.alive) {
        const pcol = Math.floor((player.x + PLAYER_WIDTH / 2) / TILE_WIDTH);
        const prow = Math.floor((player.y + PLAYER_HEIGHT) / TILE_HEIGHT);

        if (pcol === spike.col && prow === spike.row) {
          if (!spike.extended && (player.state === PlayerState.Run ||
              player.state === PlayerState.Fall || player.state === PlayerState.Land)) {
            spike.extended = true;
            spike.timer = SPIKE_EXTEND_DURATION;

            // Kill if running or falling onto extended spikes
            if (player.state === PlayerState.Run || player.state === PlayerState.Fall) {
              this.killPlayer(PlayerState.SpikeDie);
            }
          }

          if (spike.extended) {
            this.killPlayer(PlayerState.SpikeDie);
          }
        }
      }
    }
  }

  private updateGates(): void {
    for (const gate of this.state.gates) {
      if (gate.open < gate.targetOpen) {
        gate.open = Math.min(gate.open + GATE_SPEED, gate.targetOpen);
      } else if (gate.open > gate.targetOpen) {
        gate.open = Math.max(gate.open - GATE_SPEED, gate.targetOpen);
      }
    }
  }

  // Interactions
  private checkInteractions(): void {
    const player = this.state.player;
    if (!player.alive) return;
    if (!player.onGround) return;
    if (player.state === PlayerState.Die || player.state === PlayerState.FallDie) return;

    const col = Math.floor((player.x + PLAYER_WIDTH / 2) / TILE_WIDTH);
    const row = Math.floor((player.y + PLAYER_HEIGHT) / TILE_HEIGHT);

    if (col < 0 || col >= ROOM_COLS || row < 0 || row >= ROOM_ROWS) return;

    const level = getLevel(this.state.currentLevel);
    if (!level) return;

    const room = level.rooms[player.room];
    if (!room) return;

    const tile = room.tiles[row][col];
    if (!tile) return;

    // Button interactions (step on)
    if (tile.type === TileType.RaiseButton || tile.type === TileType.DropButton) {
      this.triggerButton(player.room, col, row, tile);
    }

    // Potion
    if (tile.type === TileType.Potion && this.input.down) {
      const potionKey = `${player.room}-${col}-${row}`;
      if (!this.state.consumedPotions.has(potionKey)) {
        this.drinkPotion(tile.modifier ?? 1, potionKey);
      }
    }

    // Sword pickup
    if (tile.type === TileType.Sword && !this.state.pickedUpSword) {
      this.state.pickedUpSword = true;
      player.state = PlayerState.PickupSword;
      player.stateTimer = 0;
    }

    // Exit door
    if (tile.type === TileType.ExitDoor) {
      const exitGate = this.state.gates.find(
        (g) => g.room === player.room && g.col === col && g.row === row
      );
      if (exitGate && exitGate.open >= 100 && this.input.up && player.state === PlayerState.Stand) {
        player.state = PlayerState.EnterDoor;
        player.stateTimer = 0;
      }
    }
  }

  private triggerButton(room: number, col: number, row: number, tile: { type: TileType; modifier?: number }): void {
    const level = getLevel(this.state.currentLevel);
    if (!level) return;

    // Find matching event
    for (const event of level.events) {
      if (event.type === 'button_gate' &&
          event.sourceRoom === room &&
          event.sourceCol === col &&
          event.sourceRow === row) {
        // Find the target gate
        const targetGate = this.state.gates.find(
          (g) => g.room === event.targetRoom && g.col === event.targetCol && g.row === event.targetRow
        );
        if (targetGate) {
          if (tile.type === TileType.RaiseButton) {
            targetGate.targetOpen = 100;
          } else {
            targetGate.targetOpen = 0;
          }
        }
      }
    }
  }

  private drinkPotion(type: number, key: string): void {
    const player = this.state.player;
    this.state.consumedPotions.add(key);

    player.state = PlayerState.Drink;
    player.stateTimer = 0;

    switch (type) {
      case PotionType.Health:
        player.hp = Math.min(player.hp + 1, player.maxHp);
        break;
      case PotionType.Life:
        player.maxHp = Math.min(player.maxHp + 1, 10);
        player.hp = player.maxHp;
        break;
      case PotionType.Poison:
        player.hp = Math.max(player.hp - 1, 0);
        if (player.hp <= 0) {
          this.killPlayer(PlayerState.Die);
        }
        break;
      case PotionType.FeatherFall:
        player.featherFallTimer = 30; // 30 seconds
        break;
    }
  }

  private killPlayer(deathState: PlayerState): void {
    const player = this.state.player;
    player.alive = false;
    player.hp = 0;
    player.state = deathState;
    player.stateTimer = 0;
  }

  private restartLevel(): void {
    this.state.gameOver = false;
    this.loadLevel(this.state.currentLevel);
    this.state.player.hp = this.state.player.maxHp;
    this.state.player.alive = true;
  }
}
