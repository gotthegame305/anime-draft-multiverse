# Battle Animation Handoff

## Goal

Build a standalone front-end battle replay prototype for Anime Draft Multiverse so I can experiment with:

- card attack animations
- pre-battle effect animations
- score updates
- better battle presentation than a plain text log
- replay / timing / effects polish

This prototype does not need backend wiring. It should be easy to port back into the real app later.

## Current App Stack

- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- Prisma/Postgres on the real app
- Pusher for multiplayer sync in the real app

For the prototype, backend is not required.

## Relevant Real Files

- `app/actions.ts`
- `lib/battleEngine.ts`
- `lib/gameConfig.ts`
- `components/MultiplayerGame.tsx`
- `components/DraftGame.tsx`

## Existing Data Shapes

### Role keys

```ts
type RoleKey =
  | 'captain'
  | 'viceCaptain'
  | 'tank'
  | 'duelist'
  | 'support'
  | 'aura'
  | 'traitor';
```

### Character item

```ts
interface RoleStats {
  captain: number;
  viceCaptain: number;
  tank: number;
  duelist: number;
  support: number;
  aura: number;
  traitor: number;
  reason?: string;
}

interface CharacterItem {
  id: number;
  name: string;
  imageUrl: string;
  animeUniverse: string;
  stats: {
    favorites: number;
    roleStats: RoleStats;
  };
}
```

### Match result

```ts
interface BattleResult {
  isWin: boolean;
  userScore: number;
  cpuScore: number;
  logs: string[];
}
```

### Multiplayer finished-state shape

```ts
interface GameState {
  currentTurn: number;
  round: number;
  playerTeams: { [userId: string]: (CharacterItem | null)[] };
  skipsRemaining: { [userId: string]: number };
  currentDraw: CharacterItem | null;
  status: 'SETUP' | 'DRAFTING' | 'GRADING' | 'FINISHED';
  selectedUniverses: string[];
  activeRoles?: RoleKey[];
  results?: {
    winnerId: string;
    scores: { [userId: string]: number };
    logs: string[];
  } | null;
  hostId?: string;
}
```

## Current Battle Rules

The real battle engine is deterministic once teams and roles are known.

### Base power formula

```ts
power = (effectiveStars * 20) + Math.log(favorites)
```

### Pre-battle modifiers

- `support` buffs allies before combat
- `aura` debuffs enemies before combat
- `traitor` debuffs allies before combat

Modifier strength depends on that character's star value in the modifier role:

- 1-2 stars: affects a random valid target by 1 star
- 3 stars: affects the lowest-star valid target by 1 star
- 4 stars: affects the highest-star valid target by 1 star
- 5+ stars: affects all valid targets by 1 star

### Combat rounds

- Each role slot fights the matching opposing slot.
- Higher power wins the round.
- Exact ties score nothing.
- `traitor` round reverses the point outcome:
  - if your traitor is stronger, the enemy gets the point
  - if enemy traitor is stronger, you get the point

## Current UI At Match End

The current real UI shows:

- big "Game Over" title
- winner label
- two team panels
- each card shown as a small image tile
- score text for both sides
- a scrollable monospace battle log box
- buttons below:
  - `Back to Lobby`
  - `Start Rematch` for host
  - or `Waiting for host to start the rematch...` for guests

The prototype should preserve that overall information architecture, but make the battle feel visual and animated.

## What I Want From The Prototype

Create a front-end prototype that simulates the battle visually.

### Minimum prototype behavior

- Show both teams as card rows or grids
- Animate pre-battle effects before combat starts
- Animate each round one at a time
- Show which card is acting and which card is being hit
- Update score live as rounds resolve
- Keep a readable battle log on screen
- Let the user replay the sequence

### Ideal effects to experiment with

- card lunge / slide toward target
- impact flash or hit burst
- shake on being hit
- buff glow for support
- debuff pulse or dark aura for aura / traitor
- winner highlight
- role badge highlight for current round
- star or stat badge emphasis during comparisons
- slow-motion or pause before result reveal

### Controls I want in the prototype

- `Play Replay`
- `Pause`
- `Resume`
- `Replay From Start`
- `Step Next`
- `Speed x1 / x2 / x4`
- optional `Randomize Sample Match`

## Strong Recommendation For The Prototype

Do not build the first version by parsing raw text logs.

Instead, create or mock a structured replay format like this:

```ts
interface ReplayEvent {
  type:
    | 'phase-start'
    | 'modifier'
    | 'round-start'
    | 'attack'
    | 'score'
    | 'round-end'
    | 'final';
  actorId?: number;
  targetId?: number;
  role?: RoleKey;
  team?: 'left' | 'right';
  delta?: number;
  text: string;
}
```

A mocked event array is fine for the prototype. If the prototype is good, we can later decide whether to:

- parse `results.logs`
- or upgrade the real battle engine to emit structured events

## Port-Back Constraints

The prototype should be easy to port into the real app later.

### Preferred constraints

- React + TypeScript
- Tailwind-friendly
- avoid heavy dependencies if possible
- if animation library is used, keep it modest and easy to transplant
- no backend requirement
- keep logic in a reusable component

### Best output shape for later porting

Something like:

```ts
<BattleReplay
  leftName="Carl P"
  rightName="Guest URNXL"
  leftTeam={leftTeam}
  rightTeam={rightTeam}
  roles={roles}
  replayEvents={events}
  finalScores={{ left: 3, right: 3 }}
  winnerName="Carl P"
/>
```

## Visual Direction

This should feel more like a dramatic match presentation than a plain admin log.

Desired tone:

- flashy but readable
- anime battle energy
- strong color contrast
- obvious turn/round focus
- not cluttered

Avoid:

- generic dashboard look
- plain list rendering with tiny micro-animations only
- over-designed fantasy chrome that makes porting difficult

## Sample Teams For Mocking

Use any believable mock data, but keep the shape compatible with the interfaces above.

Example roles:

```ts
const roles: RoleKey[] = [
  'captain',
  'viceCaptain',
  'tank',
  'duelist',
  'support',
  'traitor',
];
```

Use six cards per side when modifier mode is active and five when it is not.

## Example Log Semantics

The real log currently looks like this:

```txt
--- PRE-BATTLE MODIFIERS ---
Carl P's SUPPORT activates
Guest URNXL's SUPPORT activates
--- COMBAT PHASE ---
CAPTAIN: A defeats B
VICECAPTAIN: C loses to D
...
FINAL SCORE: 4-1
```

The prototype should visually represent the same sequence instead of only dumping text.

## What To Return

Return something I can run locally and tweak visually.

Best options:

1. A single self-contained React component plus mock data
2. A small demo page with one or two helper files
3. A standalone HTML/CSS/JS sandbox version if that is faster for pure animation testing

## Paste-Into-Another-AI Prompt

Use this prompt:

```txt
I need a front-end prototype for an anime card battle replay screen.

Context:
- This is for a Next.js/React/TypeScript/Tailwind project.
- I do NOT need backend wiring.
- I want a standalone prototype I can run and visually iterate on.
- The current app already has match results, card images, roles, and a text battle log.
- I want to replace the plain battle log experience with an animated replay.

Data shape:
- CharacterItem: { id, name, imageUrl, animeUniverse, stats: { favorites, roleStats } }
- Roles: captain, viceCaptain, tank, duelist, support, aura, traitor
- At the end of a match there are left team cards, right team cards, final scores, winner, and battle events/logs.

Battle rules to reflect:
- power = (effectiveStars * 20) + Math.log(favorites)
- support buffs allies before combat
- aura debuffs enemies before combat
- traitor debuffs allies before combat
- then each role slot fights the opposing slot
- higher power wins the point
- traitor round reverses who gets the point

What I want:
- animated battle replay UI
- both teams visible
- role-by-role sequence
- clear pre-battle modifier animations
- attack / impact / buff / debuff effects
- score updates live
- battle log still visible and synchronized
- replay controls: play, pause, replay, step, speed controls

Important:
- build the first prototype using mocked structured replay events, not raw text log parsing
- keep the code easy to port back into a real React app
- prefer React + TypeScript
- avoid unnecessary dependencies
- focus on visual clarity and animation polish

Please output the component code and any small helper files needed, with mock data included.
```

## Notes For Porting Back Later

When I bring the prototype back into the real repo, the integration target will probably be the finished-state section of:

- `components/MultiplayerGame.tsx`

and possibly later:

- `components/DraftGame.tsx`

So keep the API clean and componentized.
