# Product Requirements Document — Prince of Persia Web

## 1. Overview

A browser-based recreation of the classic Prince of Persia (1989) platformer game, built with HTML5 Canvas and TypeScript. The player controls the Prince — a young man who must escape dungeons and palace rooms, avoid deadly traps, fight guards, and reach the Princess within 60 minutes. The game features tile-based levels, fluid character animation, sword combat, and environmental puzzles.

This PRD is derived from the open-source SDLPoP project (https://github.com/NagyD/SDLPoP), which is a faithful C port of Jordan Mechner's original Prince of Persia.

## 2. Goals

- Deliver a fully playable Prince of Persia experience in the browser using HTML5 Canvas.
- Faithfully reproduce core gameplay mechanics: movement, climbing, combat, traps, potions, and the 60-minute timer.
- Provide multiple levels with dungeon and palace environments.
- Run at 60fps with smooth animation on modern browsers.
- No external assets required — use procedural/geometric rendering for all visuals.

## 3. User Stories

### US-1: Core Movement
**As a** player,  
**I want to** control the Prince with keyboard inputs (arrow keys + Shift),  
**So that** I can run, jump, climb, and navigate through levels.

**Acceptance Criteria:**
- Left/Right arrows move the Prince in the corresponding direction.
- Up arrow makes the Prince jump (standing jump or running jump depending on state).
- Down arrow makes the Prince crouch or climb down from ledges.
- Shift key enables careful step (walk instead of run) and grab ledges.
- The Prince can grab and hang from ledge edges.
- The Prince can climb up from a hanging position.
- The Prince can perform running jumps to cross gaps.
- Falling more than 2 stories is fatal; 1 story is safe; in between causes damage.

### US-2: Level Navigation
**As a** player,  
**I want to** navigate through tile-based rooms and transition between screens,  
**So that** I can explore each level and find the exit.

**Acceptance Criteria:**
- Each level consists of multiple rooms arranged in a grid.
- Each room is a 10×3 tile grid.
- Walking/running off a room edge transitions to the adjacent room.
- Rooms contain floor tiles, walls, pillars, and empty space.
- The level exit door opens when triggered by buttons/events.
- Walking into an open exit door advances to the next level.

### US-3: Traps and Hazards
**As a** player,  
**I want to** encounter and avoid deadly traps,  
**So that** the game provides challenge and tension.

**Acceptance Criteria:**
- **Spikes**: Pop up from floor tiles; instant kill if the Prince runs/falls onto them.
- **Chompers**: Cyclical snap traps; instant kill if caught.
- **Loose floors**: Shake when stepped on, then fall after a short delay; can chain-react.
- **Gates**: Open/close via pressure plate buttons; can trap or block the player.
- **Falling**: Excessive fall distance causes damage or death.

### US-4: Combat System
**As a** player,  
**I want to** engage in sword fights with guards,  
**So that** I can defeat enemies and progress through levels.

**Acceptance Criteria:**
- The Prince picks up a sword (on level 2) and can draw it when guards are near.
- Shift key attacks (strike); Up key defends (block/parry).
- Guards have HP and skill-based AI (varying strike, block, and advance probabilities).
- Successful strikes deal 1 HP damage and push the opponent back.
- Guards can be pushed off ledges for instant kills.
- Skeleton guards cannot be killed — only knocked back.

### US-5: Potions
**As a** player,  
**I want to** find and drink potions with various effects,  
**So that** I can heal, increase max health, or gain special abilities.

**Acceptance Criteria:**
- **Health potion (red, small)**: Restore 1 HP.
- **Life potion (red, large)**: Increase max HP by 1 and fully heal.
- **Poison (blue)**: Lose 1 HP.
- **Feather fall (green)**: Eliminate fall damage for ~30 seconds.
- Potions are consumed by pressing Down while standing on the potion tile.

### US-6: Timer Mechanic
**As a** player,  
**I want to** race against a 60-minute countdown,  
**So that** there is urgency and tension throughout the game.

**Acceptance Criteria:**
- A 60-minute countdown begins when the game starts.
- The timer displays when the player presses a key or on the HUD.
- If the timer reaches zero before the player defeats the final boss, the game is over.
- Defeating the final boss (Jaffar) stops the timer.

### US-7: HUD and Game State
**As a** player,  
**I want to** see my health, remaining time, and current level,  
**So that** I can make informed decisions during gameplay.

**Acceptance Criteria:**
- Health is displayed as hearts/bars at the bottom of the screen.
- Guard health is displayed at the top when in combat.
- Current level number is displayed.
- Game over screen appears on death with option to restart level.
- Victory screen appears when the game is completed.

### US-8: Title Screen
**As a** player,  
**I want to** see a title screen when the game loads,  
**So that** I can start the game when ready.

**Acceptance Criteria:**
- Title screen shows game name "Prince of Persia" and instructions.
- Press Enter or Space to start the game.
- Brief controls reference is displayed.

## 4. Functional Requirements

### FR-1: Game Engine
- **Rendering**: HTML5 Canvas 2D context, 320×200 logical resolution scaled to fit viewport.
- **Game loop**: Fixed timestep at ~12 ticks per second (matching original game speed), rendered at 60fps.
- **Input**: Keyboard-driven (arrow keys + Shift + Space + Enter).
- **State machine**: Player and guard characters use state machines for animation and behavior.

### FR-2: Tile System
Each tile is 32×63 pixels (10 tiles wide × 3 tiles tall = 320×189 viewport).

| Tile Type | ID | Behavior |
|---|---|---|
| Empty | 0 | Void — character falls through |
| Floor | 1 | Walkable surface |
| Spikes | 2 | Lethal trap — pops up on contact |
| Pillar | 3 | Decorative floor with pillar |
| Gate | 4 | Opens/closes via buttons |
| Drop Button | 6 | Pressure plate — closes linked gate |
| Potion | 10 | Consumable — various effects |
| Loose Floor | 11 | Falls when stepped on (11-frame delay) |
| Raise Button | 15 | Pressure plate — opens linked gate |
| Exit Door | 16 | Level exit — opens when triggered |
| Chomper | 18 | Cyclical lethal trap |
| Torch | 19 | Light source (decorative) |
| Wall | 20 | Impassable barrier |
| Sword | 22 | Pickable weapon |

### FR-3: Character Movement States
| State | Frames | Description |
|---|---|---|
| Stand | 1 | Idle position |
| Run | 14 | Multi-frame run cycle |
| Turn | 6 | Change facing direction |
| Jump | 18 | Standing or running jump arc |
| Crouch | 4 | Duck down |
| Hang | 5 | Hanging from ledge |
| Climb | 15 | Pull up onto ledge |
| Fall | variable | Freefall with gravity |
| Drink | 8 | Consume potion |
| Fight Stance | 1 | Sword drawn idle |
| Strike | 6 | Sword attack swing |
| Block | 4 | Defend against strike |
| Die | 8 | Death animation |

### FR-4: Guard AI
- Guards patrol or stand in fixed positions.
- When the Prince is in the same room and visible, guards draw swords.
- AI behavior is controlled by skill level (0–11) which sets probabilities for strike, block, advance, and counter-attack.
- Guard types: Normal Guard, Fat Guard (more HP), Skeleton (unkillable), Vizier (final boss).

### FR-5: Level Structure
- Minimum 3 playable levels for MVP (dungeon environments).
- Each level has up to 24 rooms in a grid layout.
- Level data includes tile grid, room links, guard placements, and event triggers.
- Level environments: Dungeon (dark stone) and Palace (ornate).

### FR-6: Frontend Integration
| Route | Description |
|---|---|
| `/` | Landing page with link to play the game |
| `/game` | Full-screen game canvas with Prince of Persia |

## 5. Non-Functional Requirements

- **NFR-1:** Game must run at 60fps on modern browsers (Chrome, Firefox, Safari, Edge).
- **NFR-2:** Game canvas must scale responsively to fill the viewport while maintaining aspect ratio.
- **NFR-3:** No external asset files — all rendering is procedural/geometric.
- **NFR-4:** Game state is managed entirely client-side (no server required for gameplay).
- **NFR-5:** Total JavaScript bundle size < 500KB.

## 6. Out of Scope

- Multiplayer or online features.
- Save/load game state to server.
- Audio/sound effects (can be added later).
- All 14 original levels (MVP targets 3 levels).
- Mobile/touch controls (keyboard only for MVP).
- Replay system.

## 7. Level Design Specifications

### Level 1: The Dungeon (Tutorial)
- 5-6 rooms introducing basic movement.
- Simple platforming: floors, gaps, ledges to climb.
- One health potion.
- Exit door triggered by a raise button.
- No enemies.

### Level 2: First Guard
- 6-8 rooms with a sword pickup.
- First guard encounter after picking up the sword.
- Introduction to spikes trap.
- One health potion, one life potion.

### Level 3: The Gauntlet
- 8-10 rooms with multiple guards.
- Chomper traps and loose floors introduced.
- Multiple gate puzzles (buttons opening/closing gates).
- Skeleton guard (unkillable — must be avoided or pushed off ledge).

## 8. Technical Stack

- **Frontend:** Next.js (App Router, TypeScript, Tailwind CSS)
- **Game Engine:** HTML5 Canvas 2D, custom TypeScript engine
- **Rendering:** Procedural/geometric (no sprite assets)
- **State Management:** Client-side game state machine
- **Deployment:** Azure Container Apps via AZD
