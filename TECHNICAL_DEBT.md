# Technical Debt & Fixes Required

## 🔴 CRITICAL BUGS
---

### Bug #1: Prisma Schema Missing User Relationships
**Location:** `prisma/schema.prisma` L100+  
**Priority:** CRITICAL  
**Status:** Needs Migration

**Problem:**
```prisma
model Room {
  hostId      String    // Foreign key but no @relation!
  // ...
}
```

The `Room.hostId` references a User but has no `@relation` defined. This breaks:
- Type-safe queries: `await room.host.email` would fail
- Data validation: No referential integrity enforced
- API responses: Can't include host data without joins

**Solution:**

1. Update schema:
```prisma
model Room {
  id          String      @id @default(cuid())
  code        String      @unique
  hostId      String
  host        User        @relation("RoomHost", fields: [hostId], references: [id], onDelete: Cascade)
  status      RoomStatus  @default(WAITING)
  maxPlayers  Int         @default(4)
  players     RoomPlayer[]
  createdAt   DateTime    @default(now())
  startedAt   DateTime?
  gameState   Json?
  
  @@index([hostId])
}

model User {
  // ... existing fields
  hostedRooms Room[]      @relation("RoomHost")
  // ... rest of model
}
```

2. Create migration:
```bash
npx prisma migrate dev --name add_room_host_relation
```

3. Test:
```typescript
const room = await prisma.room.findUnique({
  where: { id: roomId },
  include: { host: true }  // Now works!
});
```

---

### Bug #2: Environment Variables Missing
**Location:** `.env`  
**Priority:** CRITICAL  
**Status:** Needs Configuration

**Problem:**
```env
DATABASE_URL="postgres://..."  ✅ Only this is set
NEXTAUTH_SECRET=""             ❌ EMPTY
NEXTAUTH_URL=""                ❌ EMPTY
GOOGLE_CLIENT_ID=""            ❌ EMPTY
GOOGLE_CLIENT_SECRET=""        ❌ EMPTY
DISCORD_CLIENT_ID=""           ❌ EMPTY
DISCORD_CLIENT_SECRET=""       ❌ EMPTY
NEXT_PUBLIC_PUSHER_APP_ID=""   ❌ EMPTY
NEXT_PUBLIC_PUSHER_KEY=""      ❌ EMPTY
NEXT_PUBLIC_PUSHER_CLUSTER=""  ❌ EMPTY
PUSHER_SECRET=""               ❌ EMPTY
```

**Solution:**

1. Generate NEXTAUTH_SECRET:
```bash
openssl rand -base64 32
# Output: e.g., "abc123xyz789=="
```

2. Get OAuth credentials:
   - **Google:** https://console.cloud.google.com/
   - **Discord:** https://discord.com/developers/applications
   - Generate each, copy ID and Secret

3. Get Pusher credentials:
   - Sign up: https://pusher.com/
   - Dashboard → App Keys
   - Copy App ID, Key, Cluster, and Secret

4. Update `.env`:
```env
DATABASE_URL="postgres://a19821a177a344ad5e6facae41e6a6c68562e86f071c9318b1bf7e41ca4300c0:sk_tNPS2yyzknimkPVOkWSLR@db.prisma.io:5432/postgres?sslmode=require"

NEXTAUTH_SECRET="your-generated-secret-here"
NEXTAUTH_URL="http://localhost:3000"

GOOGLE_CLIENT_ID="your-google-id"
GOOGLE_CLIENT_SECRET="your-google-secret"

DISCORD_CLIENT_ID="your-discord-id"
DISCORD_CLIENT_SECRET="your-discord-secret"

NEXT_PUBLIC_PUSHER_APP_ID="your-pusher-app-id"
NEXT_PUBLIC_PUSHER_KEY="your-pusher-key"
NEXT_PUBLIC_PUSHER_CLUSTER="mt1"
PUSHER_SECRET="your-pusher-secret"
```

5. Verify:
```bash
npm run dev
# Check console - should NOT see Pusher initialization error
```

---

### Bug #3: Debug Logging Exposes Game State
**Location:** Multiple files  
**Priority:** CRITICAL (Security)  
**Status:** Needs Removal

**Problem:**

```typescript
// ❌ BAD - Visible in production, reveals character stats
console.log(`[DEBUG] ${char.name} RoleRatings:`, aiStats);

// ❌ Also problematic
console.log("[LOBBY DEBUG] Turn Check:", { roomId, userId, currentTurn });
console.error('[DEBUG] FATAL ERROR fetching room state:', error);
```

**Impact:**
- Attackers can see character power levels and stats
- Can see user IDs and room IDs
- Can see internal error details

**Solution:**

Replace all `console.*` with:
```typescript
if (process.env.NODE_ENV === 'development') {
  console.log(`[DEBUG] ${char.name} RoleRatings:`, aiStats);
}
```

Or use a logger utility:
```typescript
// lib/logger.ts
export const debugLog = (message: string, data?: unknown) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(message, data);
  }
};

// Usage:
debugLog(`[DEBUG] ${char.name} RoleRatings:`, aiStats);
```

**Files to fix:**
- `app/actions.ts` - Line 58 (character debug)
- `app/api/rooms/[roomId]/state/route.ts` - Multiple lines (room state debug)
- `components/DraftGame.tsx` - Audio error handling
- `components/MultiplayerGame.tsx` - Line 51 (turn check debug)

---

### Bug #4: Type Safety - `any` Types
**Location:** `app/actions.ts` L140  
**Priority:** HIGH  
**Status:** Needs Type Definition

**Problem:**
```typescript
teamDrafted: { user: userTeam, cpu: cpuTeam } as any,  // Disables type checking!
```

This allows invalid data structures to save to database undetected.

**Solution:**

1. Define proper types:
```typescript
// At top of actions.ts
interface TeamData {
  user: (CharacterItem | null)[];
  cpu: (CharacterItem | null)[];
}
```

2. Use the type:
```typescript
// Change from:
teamDrafted: { user: userTeam, cpu: cpuTeam } as any,

// To:
teamDrafted: {
  user: userTeam,
  cpu: cpuTeam
} as TeamData,
```

3. Or better yet, let TypeScript infer:
```typescript
const teamData: TeamData = {
  user: userTeam,
  cpu: cpuTeam
};

await prisma.match.create({
  data: {
    winnerId: isWin ? userId : "Anonymous",
    teamDrafted: teamData as unknown, // Prisma Json field
  }
});
```

---

### Bug #5: API Input Validation Missing
**Location:** `app/api/rooms/[roomId]/state/route.ts`  
**Priority:** HIGH  
**Status:** Needs Implementation

**Problem:**
```typescript
export async function POST(
    req: Request,
    { params }: { params: { roomId: string } }
) {
    // ❌ NO VALIDATION
    const body = await req.json();
    const { action, data } = body;  // Could be anything!
    
    if (action === 'start' && room.hostId === session.user.id) {
        // If action is "DELETE_ALL_USERS", this would execute
    }
}
```

**Risk:** 
- Invalid actions could trigger unintended behavior
- Malformed data could crash endpoint
- Could be exploited for denial of service

**Solution:**

```typescript
import { z } from 'zod';  // or any validator

const actionSchema = z.enum(['start', 'updateState', 'placePick', 'skipCard']);
const bodySchema = z.object({
  action: actionSchema,
  data: z.record(z.unknown()).optional()
});

export async function POST(
    req: Request,
    { params }: { params: { roomId: string } }
) {
    try {
        const body = await req.json();
        const validated = bodySchema.safeParse(body);
        
        if (!validated.success) {
            return NextResponse.json(
                { error: 'Invalid request', details: validated.error },
                { status: 400 }
            );
        }
        
        const { action, data } = validated.data;
        // Now we know action is one of these strings
        
    } catch (error) {
        // ...
    }
}
```

---

## 🟡 HIGH-PRIORITY FIXES
---

### Issue #6: Multiplayer Game Logic Incomplete
**Location:** `components/MultiplayerGame.tsx`  
**Priority:** HIGH  
**Status:** Uncommitted, Incomplete

**Problems:**
1. File is 379 lines but logic seems cut off mid-function
2. Turn validation uses fragile string normalization:
   ```typescript
   const normUserId = userId.toLowerCase().trim();  // Race condition risk
   ```
3. No error recovery if game state sync fails
4. No timeout handling if a player's turn hangs

**Fix Approach:**

1. Complete the `calculateWinner` function (ensure it's defined to the end)
2. Add turn timeout:
   ```typescript
   const TURN_TIMEOUT_MS = 30000; // 30 seconds
   
   useEffect(() => {
     if (isMyTurn) {
       const timer = setTimeout(() => {
         console.warn('Turn timeout - auto-passing');
         passToNextTurn();
       }, TURN_TIMEOUT_MS);
       
       return () => clearTimeout(timer);
     }
   }, [isMyTurn]);
   ```

3. Add error recovery:
   ```typescript
   const syncState = useCallback(async (state: GameState) => {
     try {
       const response = await fetch(`/api/rooms/${roomId}/state`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ action: 'updateState', data: state })
       });
       
       if (!response.ok) {
         console.error('Sync failed:', response.status);
         // Retry logic or user notification
       }
     } catch (error) {
       console.error('Network error during sync:', error);
       // Queue for retry
     }
   }, [roomId]);
   ```

---

### Issue #7: Pusher Not Initialized
**Location:** Build output shows `[PUSHER] Server initialization skipped`  
**Priority:** HIGH  
**Status:** Needs Configuration

**Problem:** Real-time features (chat, game state updates) won't work without Pusher

**Solution:**
1. Fill in `.env` variables (see Bug #2)
2. Verify Pusher library loads: `lib/pusher.ts` or `lib/pusher-client.ts`
3. Test with:
   ```bash
   npm run dev
   # Watch console - should NOT log "[PUSHER] Server initialization skipped"
   ```

---

### Issue #8: Uncommitted Changes Risk
**Location:** Git status shows modified files  
**Priority:** HIGH  
**Status:** Needs Resolution

**Problem:**
```
modified:   app/api/rooms/[roomId]/state/route.ts
modified:   components/MultiplayerGame.tsx
```

**Action:**
```bash
# Option A: Commit if changes are good
git add .
git commit -m "Fix: complete multiplayer game logic and state sync"

# Option B: Discard if experimental
git restore app/api/rooms/[roomId]/state/route.ts
git restore components/MultiplayerGame.tsx
```

**Then:**
```bash
git status  # Should be clean
```

---

## 🟠 MEDIUM-PRIORITY OPTIMIZATIONS
---

### Optimization #9: Remove Hardcoded Values
**Files:** `components/DraftGame.tsx`, other component files

**Current:**
```typescript
const ROLES = ['Captain', 'Vice Captain', 'Tank', 'Duelist', 'Support']
const INITIAL_SKIPS = 2
const MAX_PLAYERS = 4
```

**Better:**
```typescript
// config/gameConfig.ts
export const GAME_CONFIG = {
  roles: ['Captain', 'Vice Captain', 'Tank', 'Duelist', 'Support'],
  initialSkips: 2,
  maxPlayers: 4,
  turnTimeoutMs: 30000,
} as const;

// Usage in components:
import { GAME_CONFIG } from '@/config/gameConfig';

const ROLES = GAME_CONFIG.roles;
const INITIAL_SKIPS = GAME_CONFIG.initialSkips;
```

---

### Optimization #10: Add Pagination to Character Fetching
**File:** `app/actions.ts` - `getCharacters()`

**Current:**
```typescript
const characters = await prisma.character.findMany({
  take: limit,  // 500 by default - too many!
  orderBy: { stats: 'desc' },
})
```

**Better:**
```typescript
export async function getCharacters(skip = 0, take = 50) {
  return await prisma.character.findMany({
    skip,
    take,
    orderBy: { stats: 'desc' },
  });
}

// Or use cursor-based pagination
export async function getCharactersPaginated(cursor?: string, take = 50) {
  return await prisma.character.findMany({
    ...(cursor && { skip: 1, cursor: { id: cursor } }),
    take,
    orderBy: { id: 'desc' },
  });
}
```

---

## Testing Verification

After fixes, verify each with:

```typescript
// Test 1: Prisma relationships work
const room = await prisma.room.findFirst({
  include: { host: true }
});
console.log(room.host.email); // Should work!

// Test 2: No debug logs in production
const proc = require('child_process').spawn('npm', ['run', 'build']);
const output = proc.stdout.toString();
if (output.includes('[DEBUG]')) {
  console.error('WARNING: Debug logs found in build output');
}

// Test 3: Auth env vars set
if (!process.env.NEXTAUTH_SECRET) {
  throw new Error('NEXTAUTH_SECRET not set');
}
```

---

## Summary of Command-Line Fixes

```bash
# 1. Generate secret
openssl rand -base64 32

# 2. Fill .env file
# (manual - requires OAuth credentials)

# 3. Run Prisma migration
npx prisma migrate dev --name fix_room_relationships

# 4. Remove debug logs (per files listed above)
# (manual edits or search/replace)

# 5. Add type definitions
# (manual - app/actions.ts update)

# 6. Add input validation
# (manual - route handler update)

# 7. Commit changes
git add .
git commit -m "fix: critical security and schema issues"

# 8. Test build
npm run build

# 9. Run locally
npm run dev
# Verify: No console errors, can sign in, can start game
```

---

*This document tracks all technical debt. Update as issues are resolved.*
