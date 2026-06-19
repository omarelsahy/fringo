# FRINGO AI AGENT PROJECT HANDOFF

machine_readability: high
human_polish_priority: low
project_working_title: Fringo
project_type: configurable hidden-event social bingo game
primary_target_platform: PWA first; eventual iOS/Android via native wrapper or native rebuild
recommended_stack: Vite + React + TypeScript + Supabase + Postgres RLS + Supabase Realtime + Tailwind/shadcn; Capacitor later for mobile app packaging
source: visible ChatGPT conversation between user and assistant
purpose: This document is intended to be uploaded to other AI coding/design agents so they can build the project without requiring the user to re-explain the game design.

---

# 0. AGENT INSTRUCTIONS

You are an AI agent being handed this project. Treat this document as the canonical current product/design/architecture source.

Build toward an MVP first. Do not overcomplicate with native mobile, AI generation, majority-vote disputes, payments, or large-scale moderation unless explicitly requested later.

Core design invariant: every player is also a target. Every player has private boards for every other player. Every target has a hidden shared action pool visible only to non-target players. All non-target observers get the same target actions but in different randomized layouts.

Do not reveal target actions to the target during setup or active gameplay. Privacy/visibility rules are the highest-risk part of the project.

---

# 1. ONE-PARAGRAPH PRODUCT SUMMARY

Fringo is a configurable social bingo game played during real-world activities or other games. A group creates a game around an event/category such as game night, a bar outing, spring break, a convention, or a months-long friend challenge. For each player, all other players secretly submit actions/predictions/challenges that the target might do. Non-target players upvote submissions for each target. The top-voted actions become that target's shared action pool. Every non-target player receives a private randomized bingo board containing those same target actions in a different layout. During play, players privately mark actions they personally witness the target perform. First player to get bingo on a target board claims that target for points, locking that target from further scoring. Targets have limited guesses and can try to deduce actions about themselves; correct guesses can lock actions and sometimes award points or penalize the player who made the action obvious.

---

# 2. CORE GAME DESIGN

## 2.1 Fundamental Loop

1. Create a game around a category/activity/duration.
2. Invite players.
3. Setup phase begins.
4. For every target player, all non-target players submit hidden actions/predictions/challenges for that target.
5. Non-target players upvote other non-target submissions for each target.
6. Host/admin finalizes setup.
7. Top-voted actions for each target become the selected action pool for that target.
8. For each observer-target pair, generate a private randomized board using the selected action pool for that target.
9. Gameplay begins.
10. Players privately mark squares on their boards when they personally witness the target perform that action and notice it is on their board.
11. First player to complete a bingo on a target board claims that target and scores.
12. Once a target is claimed, all boards for that target become irrelevant/locked for scoring.
13. Gameplay continues until every target has been claimed or the round/game ends by configured end condition/manual host action.
14. Winner is the player with the highest score.
15. After the round ends, all actions, boards, submitters, and relevant score history can be revealed.

## 2.2 Core Identity of Game

Fringo is not merely standard bingo. It combines:

- social prediction
- hidden information
- real-world observation
- subtle manipulation
- deduction by targets
- sabotage risk
- private board state
- shared target-specific event pools

A useful shorthand: "hidden-events social bingo where everyone is both player and target."

---

# 3. TERMINOLOGY

## 3.1 Player

A participant in the game. Every player has two roles simultaneously:

- observer/player: they have boards about other people and try to score bingos
- target: other players have hidden boards/actions about them

## 3.2 Target

The player whom an action pool or board is about.

Example: On an "Omar board," Omar is the target. Omar cannot see the Omar action pool or Omar boards during setup/gameplay.

## 3.3 Observer / Board Owner

The player who owns a private board for a target.

Example: Sarah's Omar board has owner Sarah and target Omar.

## 3.4 Action / Event / Submission

A proposed real-world thing the target might do.

Examples:

- "Omar orders fries"
- "Sarah checks her phone during a board game"
- "Jake explains a rule incorrectly"
- "Michelle says she hates this game but keeps playing"

Use `action_submission` for proposed actions during setup. Use `selected_action` for finalized actions included in boards.

## 3.5 Action Pool

The selected set of actions for a target. This is shared across all boards for that target.

Example: All non-target players' Omar boards use the same selected Omar actions.

## 3.6 Board

A private randomized bingo grid owned by one observer for one target.

Example: Omar, Sarah, Jake, Michelle are playing.

- Omar has boards for Sarah, Jake, Michelle.
- Sarah has boards for Omar, Jake, Michelle.
- Jake has boards for Omar, Sarah, Michelle.
- Michelle has boards for Omar, Sarah, Jake.

No player has a board for themselves.

## 3.7 Square

A board cell that references a selected action, or a free space if enabled.

## 3.8 Mark

A private state change by an observer indicating they witnessed and noticed the target perform an action.

## 3.9 Bingo

A completed line/pattern according to game settings. MVP can support rows, columns, and optional diagonals. Later versions can support custom patterns.

## 3.10 Target Claim

When a player gets bingo on a board for a target, that target is claimed. The claiming player scores. Once claimed, nobody else can earn bingo points from boards for that target.

## 3.11 Guess

A limited attempt by a target to deduce an action about themselves before or after it has occurred.

## 3.12 Giveaway Player

A non-target player who makes an action obvious enough that the target correctly guesses it after some players may have already marked it. The giveaway player loses 1 point under current rules.

---

# 4. CANONICAL RULES SO FAR

## 4.1 Participation Rules

- Every player is a target for all other players.
- Every player has a board for every other player.
- No player has a board for themselves.
- Only non-target players can submit actions for a target.
- The target cannot see actions submitted about themselves during setup or gameplay.
- The target cannot vote on actions about themselves.
- The target cannot know their selected action pool until reveal after the round.

## 4.2 Setup Rules

- Setup is fluid, not a rigid wizard.
- Players can freely submit and upvote actions for all other targets during setup.
- Example: Omar might submit one action for Jake, then two for Sarah, then another for Jake, then upvote a submission about Michelle.
- All actions submitted for a target appear in that target's hidden setup list visible only to non-targets.
- Non-targets can upvote submissions from other non-targets.
- Recommended MVP constraint: players cannot upvote their own submissions.
- Recommended MVP constraint: one upvote per player per submission.
- Host/admin can finalize the action selection and override upvote results if needed.
- Submitter identity should be hidden during gameplay and saved for reveal after round.

## 4.3 Selection Rules

- For each target, select the top-voted submissions according to configured `actions_per_target`.
- If ties occur around the cutoff, host/admin may resolve or system can randomly choose. Recommended MVP: host override/resolve ties.
- The selected target actions become the canonical action pool for that target.
- Every non-target board for that target must include the same selected actions, just shuffled into a unique layout.

## 4.4 Board Rules

- Board size must be configurable.
- Do not hardcode 5x5 or 24 actions.
- Common presets:
  - Game Night: 3x3, 8 actions + 1 free space, 3-in-row, 2 guesses, duration 2-4 hours.
  - Night Out/Bar Night: 5x5, 24 actions + 1 free space, 5-in-row, 3-5 guesses, one evening.
  - Trip/Spring Break: 5x5 or 7x7, 24-48 actions, optional free space, more guesses, duration days/week.
  - Long-Term Friend Group Game: large board or multiple boards, weeks/months/years.
- A board has an owner/observer and a target.
- The board owner can see and mark their board.
- The target cannot see the board about themselves until reveal.
- Other players cannot see another observer's board layout or marks during gameplay.

## 4.5 Marking Rules

- Honor system for MVP.
- Each observer manually marks an action on their private board if:
  - they witnessed the target do the action,
  - they were present when it occurred,
  - they noticed it was on their board.
- Multiple observers can mark the same target action if they witness it and notice it.
- Marks are private during gameplay.
- Players who fail to notice an action miss out; there is no automatic global marking.
- If a target is already claimed, further marks on that target's boards are irrelevant and should be blocked/disabled.
- If an action is locked for a player, that player cannot mark it after lock.

## 4.6 Scoring Rules

- Normal bingo on a target board: +1 point to the player who completes it.
- If one marked square creates two bingos simultaneously: +3 points total.
- The double-bingo bonus only applies if a single new mark completes multiple lines at once.
- Once a target is claimed by a bingo, all other boards for that target are locked/irrelevant.
- A player can score bingos for multiple different targets in the same round.
- Winner is highest total score after the game/round ends.
- Store scores as ledger events, not only as a mutable total, for auditability.

## 4.7 Target Guess Rules

Targets get a limited number of guesses to deduce actions about themselves.

Current rule model:

Case A: Correct pre-action guess

- Target guesses an action before any non-target has marked it completed.
- Target gets +1 point.
- That action is locked for all non-target players.
- No non-target can use that action to get bingo moving forward.

Case B: Correct post-action guess

- Some non-target players already got the target to perform the action and marked it.
- A later player makes the action obvious; target guesses correctly.
- Players who already marked it keep their mark.
- The giveaway player loses 1 point.
- The action becomes locked for the giveaway player and all remaining non-target players who had not already marked it.
- Target does not get a point because the action had already been marked by at least one non-target.

Case C: Incorrect guess

- Not fully specified, recommended MVP behavior:
  - consumes one guess token
  - no action is locked
  - no points awarded/deducted
  - optionally visible to group as an incorrect guess event

Guess matching:

- Exact text match is not required.
- "Close enough" is decided by player/group discretion under honor system.
- Future version may use voting/adjudication.

Guess confirmation:

- MVP: group honor system.
- Future: majority vote / challenge system.

## 4.8 Reveal Rules

When the round ends:

- Everyone can see everyone else's boards.
- Everyone can see all selected actions for themselves and others.
- Everyone can see who submitted each action.
- Optionally reveal who marked what; this may be fun but may also create arguments, so make it configurable later.
- Score history should be visible.

## 4.9 Admin/Host Rules

Host/admin privileges can include:

- manage game settings
- invite/remove players before active phase
- start setup
- finalize setup
- override selected actions
- resolve vote ties
- generate boards
- start game
- manually lock/unlock actions
- adjust scores
- end round/game
- reveal round

MVP admin controls should be minimal but powerful enough to prevent setup/game flow from getting stuck.

---

# 5. CONFIGURATION SYSTEM

Do not hardcode the game as classic 5x5 bingo.

## 5.1 Game-Level Settings

Recommended settings:

```yaml
game_settings:
  board_rows: integer
  board_cols: integer
  has_free_space: boolean
  free_space_position: center | custom | none
  actions_per_target: integer
  guesses_per_target: integer
  normal_bingo_points: integer # default 1
  multi_bingo_points: integer # default 3
  pre_action_guess_points: integer # default 1
  giveaway_penalty_points: integer # default -1
  allow_diagonals: boolean
  bingo_patterns: rows_columns_diagonals | rows_columns_only | custom_future
  end_condition: manual | all_targets_claimed | time_limit | hybrid
  starts_at: timestamp nullable
  ends_at: timestamp nullable
  reveal_marks_after_round: boolean default false
  allow_self_upvote: boolean default false
  allow_submitter_identity_during_game: boolean default false
```

## 5.2 Presets

Presets should populate settings but remain editable.

```yaml
presets:
  game_night:
    board_rows: 3
    board_cols: 3
    has_free_space: true
    actions_per_target: 8
    guesses_per_target: 2
    allow_diagonals: true
    expected_duration: hours
  night_out:
    board_rows: 5
    board_cols: 5
    has_free_space: true
    actions_per_target: 24
    guesses_per_target: 4
    allow_diagonals: true
    expected_duration: evening
  spring_break:
    board_rows: 5_or_7
    board_cols: 5_or_7
    has_free_space: configurable
    actions_per_target: configurable
    guesses_per_target: configurable
    allow_diagonals: true
    expected_duration: days_or_week
  custom:
    all_settings_editable: true
```

---

# 6. RECOMMENDED MVP TECH STACK

## 6.1 Frontend

- Vite
- React
- TypeScript
- Tailwind CSS
- shadcn/ui optional
- React Router or TanStack Router
- Zustand or simple React Query state; TanStack Query recommended for server state
- PWA manifest/service worker

## 6.2 Backend

- Supabase Auth
- Supabase Postgres
- Supabase Row Level Security
- Supabase Realtime for updates
- Supabase Edge Functions if server-side finalization/board generation should not run client-side

## 6.3 Mobile Future

- PWA first
- Capacitor later for iOS/Android packaging
- Later native rebuild only if push notifications/background/native UX require it

## 6.4 Non-MVP

Do not include in initial MVP unless requested:

- AI action generation
- complex dispute voting
- payments
- public matchmaking
- social graph beyond invite links
- native-only features
- media proof uploads
- advanced moderation

---

# 7. DATA MODEL

The following model assumes Supabase/Postgres.

## 7.1 profiles

Represents app-level user profile.

```sql
profiles (
  id uuid primary key references auth.users(id),
  display_name text not null,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
)
```

## 7.2 games

```sql
games (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  status text not null check (status in ('lobby','setup','active','ended','revealed','archived')),
  created_by uuid references profiles(id),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
)
```

## 7.3 game_settings

```sql
game_settings (
  game_id uuid primary key references games(id) on delete cascade,
  board_rows int not null default 5,
  board_cols int not null default 5,
  has_free_space boolean not null default true,
  free_space_row int,
  free_space_col int,
  actions_per_target int not null default 24,
  guesses_per_target int not null default 4,
  normal_bingo_points int not null default 1,
  multi_bingo_points int not null default 3,
  pre_action_guess_points int not null default 1,
  giveaway_penalty_points int not null default -1,
  allow_diagonals boolean not null default true,
  end_condition text not null default 'all_targets_claimed',
  reveal_marks_after_round boolean not null default false,
  allow_self_upvote boolean not null default false,
  allow_submitter_identity_during_game boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
)
```

Validation:

- if `has_free_space`, then `actions_per_target = board_rows * board_cols - 1` in classic mode, but user may configure alternate action count if custom board/pattern support is added later.
- for MVP, enforce exact count needed for board.

## 7.4 game_players

Represents membership and per-game identity.

```sql
game_players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  user_id uuid references profiles(id),
  display_name text not null,
  role text not null default 'player' check (role in ('host','admin','player')),
  status text not null default 'active' check (status in ('invited','active','left','removed')),
  score int not null default 0, -- denormalized convenience only; score_events is source of truth
  guesses_remaining int, -- may be per player globally or per target; see guesses section
  joined_at timestamptz default now(),
  unique(game_id, user_id)
)
```

Note: Guest/no-auth player support may require nullable `user_id` and invite/session token logic. MVP can require auth or support lightweight guest names depending on product priority.

## 7.5 action_submissions

Proposed actions during setup.

```sql
action_submissions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  target_player_id uuid not null references game_players(id) on delete cascade,
  submitted_by_player_id uuid not null references game_players(id) on delete cascade,
  text text not null,
  status text not null default 'submitted' check (status in ('submitted','selected','rejected','removed')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  check (target_player_id <> submitted_by_player_id)
)
```

Rules:

- target cannot submit actions for themselves.
- target cannot read rows targeting themselves during setup/active gameplay.
- submitter identity hidden from non-admin players during setup/active gameplay if desired; however the row exists.
- after reveal, submitter identity is visible.

## 7.6 action_upvotes

```sql
action_upvotes (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references action_submissions(id) on delete cascade,
  voter_player_id uuid not null references game_players(id) on delete cascade,
  created_at timestamptz default now(),
  unique(submission_id, voter_player_id)
)
```

Rules enforced via RLS/function:

- voter must be in same game.
- voter cannot be target of submission.
- recommended: voter cannot be submitter if `allow_self_upvote = false`.

## 7.7 selected_actions

Canonical selected action pool for each target.

```sql
selected_actions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  target_player_id uuid not null references game_players(id) on delete cascade,
  submission_id uuid not null references action_submissions(id),
  action_text text not null,
  selected_rank int,
  global_state text not null default 'active' check (global_state in ('active','locked','revealed')),
  locked_reason text check (locked_reason in ('pre_action_guess','post_action_guess','admin','target_claim','other') or locked_reason is null),
  locked_at timestamptz,
  created_at timestamptz default now(),
  unique(game_id, target_player_id, submission_id)
)
```

Important: `action_text` is denormalized snapshot so later edits to submissions do not change active boards.

## 7.8 boards

```sql
boards (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  owner_player_id uuid not null references game_players(id) on delete cascade,
  target_player_id uuid not null references game_players(id) on delete cascade,
  state text not null default 'active' check (state in ('active','target_claimed','revealed','archived')),
  created_at timestamptz default now(),
  unique(game_id, owner_player_id, target_player_id),
  check (owner_player_id <> target_player_id)
)
```

## 7.9 board_squares

```sql
board_squares (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references boards(id) on delete cascade,
  selected_action_id uuid references selected_actions(id) on delete cascade,
  row_index int not null,
  col_index int not null,
  state text not null default 'unmarked' check (state in ('unmarked','marked','locked','winning','free')),
  marked_at timestamptz,
  locked_at timestamptz,
  created_at timestamptz default now(),
  unique(board_id, row_index, col_index)
)
```

For a free space, `selected_action_id` may be null and state = `free` or `marked` depending implementation. Simpler MVP: insert a free square as already marked/free.

## 7.10 guesses

A guess by a target about their own hidden selected action.

```sql
guesses (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  target_player_id uuid not null references game_players(id) on delete cascade,
  guessed_by_player_id uuid not null references game_players(id) on delete cascade,
  guess_text text not null,
  matched_selected_action_id uuid references selected_actions(id),
  result text not null check (result in ('pending','correct_pre_action','correct_post_action','incorrect','void')),
  accused_giveaway_player_id uuid references game_players(id),
  resolved_by_player_id uuid references game_players(id),
  created_at timestamptz default now(),
  resolved_at timestamptz,
  check (target_player_id = guessed_by_player_id)
)
```

Note: A target guesses actions about themselves, so target_player_id equals guessed_by_player_id. This duplication improves readability but can be simplified.

Guess tokens: Decide whether guesses are per game/player or per target/action pool. User said targets get limited guesses; since every player is target exactly once per game, this can be stored per `game_players.guesses_remaining` initialized from settings. If multiple rounds are added, use `round_players` or per-round guess allocation.

## 7.11 target_claims

```sql
target_claims (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  target_player_id uuid not null references game_players(id) on delete cascade,
  claimed_by_player_id uuid not null references game_players(id) on delete cascade,
  board_id uuid not null references boards(id),
  points_awarded int not null,
  bingo_line_count int not null default 1,
  created_at timestamptz default now(),
  unique(game_id, target_player_id)
)
```

Unique constraint enforces only one claim per target.

## 7.12 score_events

Source of truth for scoring.

```sql
score_events (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  player_id uuid not null references game_players(id) on delete cascade,
  points int not null,
  reason text not null check (reason in ('bingo','multi_bingo','pre_action_guess','giveaway_penalty','admin_adjustment')),
  related_target_player_id uuid references game_players(id),
  related_selected_action_id uuid references selected_actions(id),
  related_board_id uuid references boards(id),
  related_guess_id uuid references guesses(id),
  note text,
  created_at timestamptz default now()
)
```

Update `game_players.score` transactionally as denormalized cached total.

## 7.13 event_log optional but recommended

```sql
event_log (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  actor_player_id uuid references game_players(id),
  event_type text not null,
  payload jsonb not null default '{}',
  visibility text not null default 'public' check (visibility in ('public','private','admin','post_reveal')),
  created_at timestamptz default now()
)
```

Useful for realtime UI, audit, replay, and debugging.

---

# 8. VISIBILITY / RLS MATRIX

This is the highest-risk part. Implement carefully.

Definitions:

- `current_player`: game_players row matching authenticated user for a game.
- `game.status` determines visibility.
- `is_admin`: current player's role in ('host','admin').
- `is_revealed`: game.status in ('revealed','archived').

## 8.1 During setup

Player can see:

- game lobby/settings for games they are in
- other active players
- submissions targeting other players
- vote counts on submissions targeting other players
- their own submissions for other players
- anonymous submissions for other players

Player cannot see:

- submissions targeting themselves
- upvotes on submissions targeting themselves
- selected actions targeting themselves
- who submitted what, if submitter identity hidden until reveal

## 8.2 During active gameplay

Player can see:

- their own boards for other targets
- their own board squares/actions
- their own marks
- public scoreboard
- target claims
- public score events
- how many guesses they have remaining

Player cannot see:

- boards owned by others
- board layouts owned by others
- marks made by others
- selected actions targeting themselves
- action submitter identities

## 8.3 After reveal

Player can see:

- all submissions
- all selected actions
- all boards
- all submitters
- all target claims
- all score events
- optionally all marks depending setting

## 8.4 Suggested Implementation Approach

Do as much mutation as possible through Postgres RPC functions or Supabase Edge Functions with explicit validation. Do not trust the client to enforce visibility or scoring.

Key RPCs:

- submit_action(game_id, target_player_id, text)
- upvote_submission(submission_id)
- finalize_game(game_id)
- mark_square(board_square_id)
- submit_guess(game_id, guess_text)
- resolve_guess(guess_id, result, matched_action_id, giveaway_player_id)
- reveal_game(game_id)

---

# 9. GAME STATE MACHINES

## 9.1 Game Status

```yaml
game.status:
  lobby: players joining; settings editable
  setup: submissions and upvotes are open
  active: boards generated; gameplay ongoing
  ended: gameplay ended; scoring final; reveal not necessarily shown
  revealed: postgame reveal visible
  archived: old game retained but inactive
```

Simplified MVP can combine lobby/setup or ended/revealed, but explicit states are safer.

## 9.2 Submission Status

```yaml
action_submissions.status:
  submitted: candidate action during setup
  selected: chosen for board
  rejected: not selected
  removed: admin removed/inappropriate/spam
```

## 9.3 Selected Action Global State

```yaml
selected_actions.global_state:
  active: can be marked if square not individually locked
  locked: globally unavailable due to pre-action guess, admin lock, etc.
  revealed: visible after round
```

Caveat: Post-action guesses lock the action for only some players. Therefore use individual board_squares.state = locked for players who had not marked it, while preserving marked state for players who had already marked it. The selected action may remain active or get a special locked state depending how rules are implemented. Recommended: global lock for pre-action guesses; per-square lock for post-action guesses.

## 9.4 Board State

```yaml
boards.state:
  active: board can be played
  target_claimed: target has been claimed, board can no longer score
  revealed: postgame visible
  archived: inactive history
```

## 9.5 Board Square State

```yaml
board_squares.state:
  unmarked: available, not marked
  marked: observer marked it completed
  locked: unavailable to this observer
  winning: part of claimed winning bingo line; optional state
  free: free space
```

## 9.6 Guess Result

```yaml
guesses.result:
  pending: submitted but not resolved; optional if group/admin confirmation needed
  correct_pre_action: target guessed before any observer marked the action
  correct_post_action: target guessed after at least one observer marked it
  incorrect: guess was not close enough
  void: invalid/admin canceled
```

---

# 10. CORE ALGORITHMS / PSEUDOCODE

## 10.1 Finalize Action Selection

```pseudo
function finalize_actions_for_target(game_id, target_player_id):
    settings = get_game_settings(game_id)
    required_count = settings.actions_per_target

    submissions = get_submissions_for_target(game_id, target_player_id)
      where status = 'submitted'
      with vote_count
      order by vote_count desc, created_at asc

    if count(submissions) < required_count:
        throw NotEnoughActionsError unless host explicitly allows smaller/custom board

    selected = host_override_selection if provided else top required_count submissions

    for each submission in selected:
        create selected_actions row
        update submission.status = 'selected'

    for each nonselected submission:
        update submission.status = 'rejected'
```

Tie behavior:

- MVP: host resolves ties before finalizing.
- Alternative: deterministic random with seed.

## 10.2 Generate Boards

```pseudo
function generate_boards_for_game(game_id):
    players = active_game_players(game_id)
    settings = get_game_settings(game_id)
    cells = all grid positions board_rows x board_cols

    if has_free_space:
        free_pos = settings.free_space_position or center
        action_positions = cells excluding free_pos
    else:
        action_positions = cells

    for each target in players:
        selected_actions = get_selected_actions(game_id, target.id)
        assert count(selected_actions) == count(action_positions)

        for each owner in players where owner.id != target.id:
            board = create_board(game_id, owner.id, target.id)
            shuffled_actions = deterministic_or_random_shuffle(selected_actions, seed = board.id or secure random)

            for each pos in cells:
                if pos == free_pos:
                    create board_square(board.id, selected_action_id=null, row, col, state='free')
                else:
                    action = next shuffled_actions
                    create board_square(board.id, action.id, row, col, state='unmarked')
```

Need unique randomized layouts per owner-target board. Layouts may coincidentally match by random chance; acceptable but can be minimized by regenerating if duplicate layout for same target.

## 10.3 Mark Square

```pseudo
function mark_square(player_id, board_square_id):
    square = get_square(board_square_id)
    board = get_board(square.board_id)
    game = get_game(board.game_id)

    assert game.status == 'active'
    assert board.owner_player_id == player_id
    assert board.owner_player_id != board.target_player_id
    assert board.state == 'active'
    assert target_not_claimed(board.game_id, board.target_player_id)
    assert square.state == 'unmarked'

    selected_action = get_selected_action(square.selected_action_id)
    assert selected_action.global_state == 'active'

    update square.state = 'marked', marked_at = now()

    completed_lines = evaluate_bingo(board.id, newly_marked_square_id = square.id)

    if completed_lines.count > 0:
        claim_target_from_bingo(board, completed_lines)
```

## 10.4 Evaluate Bingo

MVP supports rows, columns, diagonals.

```pseudo
function evaluate_bingo(board_id, newly_marked_square_id):
    settings = get_game_settings_for_board(board_id)
    squares = get_board_squares(board_id)
    newly_marked = get_square(newly_marked_square_id)

    candidate_lines = []
    candidate_lines.add(all squares in newly_marked.row)
    candidate_lines.add(all squares in newly_marked.col)

    if settings.allow_diagonals:
        if newly_marked is on main diagonal:
            candidate_lines.add(main diagonal)
        if newly_marked is on anti diagonal:
            candidate_lines.add(anti diagonal)

    completed_lines = []
    for line in candidate_lines:
        if every square.state in ('marked','free','winning'):
            completed_lines.add(line)

    return completed_lines
```

## 10.5 Claim Target

```pseudo
function claim_target_from_bingo(board, completed_lines):
    game_id = board.game_id
    target_player_id = board.target_player_id
    claimant_player_id = board.owner_player_id

    assert no target_claim exists for (game_id, target_player_id)

    line_count = completed_lines.count
    if line_count >= 2:
        points = settings.multi_bingo_points # default 3
        reason = 'multi_bingo'
    else:
        points = settings.normal_bingo_points # default 1
        reason = 'bingo'

    create target_claim(game_id, target_player_id, claimant_player_id, board.id, points, line_count)
    create score_event(game_id, claimant_player_id, points, reason, related_target_player_id=target_player_id, related_board_id=board.id)
    increment game_players.score by points

    update all boards in game where target_player_id = target_player_id set state = 'target_claimed'

    optional: mark winning squares on claimant board as 'winning'

    if all targets claimed and settings.end_condition includes all_targets_claimed:
        update game.status = 'ended'
```

## 10.6 Submit Guess

Two possible MVP flows:

1. Immediate honor-system resolution by target/group in UI.
2. Create pending guess, then host/admin/group resolves.

Recommended MVP for data integrity: pending guess + host/admin resolve. If honor system only, any player with admin/host can resolve.

```pseudo
function submit_guess(target_player_id, guess_text):
    game = active game
    assert player is target_player_id
    assert guesses_remaining > 0
    assert game.status == 'active'

    create guesses row result='pending'
    decrement guesses_remaining
```

## 10.7 Resolve Correct Pre-Action Guess

```pseudo
function resolve_guess_pre_action(guess_id, matched_selected_action_id):
    guess = get_guess(guess_id)
    action = get_selected_action(matched_selected_action_id)
    target = guess.target_player_id

    assert action.target_player_id == target

    marked_count = count board_squares
      where selected_action_id = action.id
      and state in ('marked','winning')

    assert marked_count == 0

    update guess.result = 'correct_pre_action', matched_selected_action_id = action.id, resolved_at = now()
    update selected_actions.global_state = 'locked', locked_reason='pre_action_guess', locked_at=now()
    update all board_squares where selected_action_id=action.id and state='unmarked' set state='locked', locked_at=now()

    create score_event(player_id=target, points=settings.pre_action_guess_points, reason='pre_action_guess', related_action_id=action.id)
    increment target.score
```

## 10.8 Resolve Correct Post-Action Guess

```pseudo
function resolve_guess_post_action(guess_id, matched_selected_action_id, giveaway_player_id):
    guess = get_guess(guess_id)
    action = get_selected_action(matched_selected_action_id)
    target = guess.target_player_id

    assert action.target_player_id == target

    marked_squares = get board_squares where selected_action_id=action.id and state in ('marked','winning')
    assert count(marked_squares) > 0

    update guess.result='correct_post_action', matched_selected_action_id=action.id, accused_giveaway_player_id=giveaway_player_id, resolved_at=now()

    # Preserve existing marks.
    # Lock remaining unmarked squares for this action.
    update board_squares where selected_action_id=action.id and state='unmarked' set state='locked', locked_at=now()

    create score_event(player_id=giveaway_player_id, points=settings.giveaway_penalty_points, reason='giveaway_penalty', related_action_id=action.id, related_guess_id=guess.id)
    decrement giveaway_player.score by abs(penalty)

    # Target gets no points in post-action case.
```

Clarification: User said action gets locked out for the person who tried to get them to do it and all remaining non-target players. If the giveaway player had not already marked it, the above covers them. If they had marked it previously and then gave it away later, preserve mark? This edge case is unresolved. Recommended rule: if giveaway player already marked it before giving it away, they keep the mark but still lose 1 point; remaining unmarked players lose access.

## 10.9 Resolve Incorrect Guess

```pseudo
function resolve_guess_incorrect(guess_id):
    update guess.result='incorrect', resolved_at=now()
    # token already consumed at submit time
```

## 10.10 Reveal Game

```pseudo
function reveal_game(game_id):
    assert game.status in ('ended','active') and requester is admin/host or end condition met
    update game.status='revealed'
    update selected_actions.global_state='revealed' where game_id=game_id
    update boards.state='revealed' where game_id=game_id
    # RLS should now allow broad read access to all game members
```

---

# 11. UI / APP SCREENS

## 11.1 Home

- Create game
- Join game by invite/link/code
- Active games
- Past games

## 11.2 Create Game

Fields:

- game name
- category/activity/theme
- preset selection
- custom settings
- invite players
- host/admin options

## 11.3 Lobby

- players list
- host controls
- game settings summary
- start setup

## 11.4 Setup: Unified Action Market

This is a critical product decision.

Setup should not be a rigid per-target wizard. It should be a fluid unified interface where a player can submit and vote for any target except themselves.

Suggested UI:

- target filter chips: All | Jake | Sarah | Michelle
- action feed with cards
- quick submit composer
- progress indicators per target

Submission card fields:

- target player name
- action text
- upvote button
- vote count
- selected status after finalization
- DO NOT show submitter identity during setup/gameplay unless admin or setting allows

Composer:

- target dropdown defaulting to last selected target
- action text
- submit button

A player must not be able to access their own target feed.

## 11.5 Host Setup Controls

- see progress per target: submissions count, votes count, selected count readiness
- finalize selections
- resolve ties
- override selected actions
- start game/generate boards

## 11.6 My Boards

During active gameplay:

- list/tab/grid of target boards for every other player
- target claimed status visible
- progress on each private board, e.g. marks count, closest bingo line maybe optional
- do not expose other players' marks

## 11.7 Board Detail

- grid with actions
- tap square to mark completed
- disabled/locked visual for locked actions
- disabled if target claimed
- if mark creates bingo, show claim/score confirmation

## 11.8 Guess Screen

For the target:

- remaining guesses
- text input for guess
- submit guess
- honor-system resolution flow

Possible UX:

- Target submits guess verbally/in app.
- Group/host resolves in app as incorrect/correct pre/correct post.
- If correct post, select giveaway player.

## 11.9 Scoreboard

- current scores
- claimed targets
- unclaimed targets
- score event feed
- guess tokens remaining maybe private or public; decide later

## 11.10 Reveal/Postgame

- reveal all target action pools
- reveal submitters
- reveal board layouts
- reveal winning lines
- reveal score ledger
- optional: reveal marks if setting enabled

---

# 12. API / RPC FUNCTION LIST

Prefer server-side validation for sensitive operations.

## 12.1 Game Management

```text
create_game(input_settings) -> game_id
join_game(invite_code) -> game_player_id
update_game_settings(game_id, settings) -> void [host/admin only, before active]
start_setup(game_id) -> void [host/admin]
finalize_setup(game_id, optional_overrides) -> void [host/admin]
start_game(game_id) -> void [host/admin]
end_game(game_id) -> void [host/admin]
reveal_game(game_id) -> void [host/admin]
```

## 12.2 Setup Actions

```text
submit_action(game_id, target_player_id, text) -> submission_id
edit_own_submission(submission_id, text) -> void [before selected]
remove_own_submission(submission_id) -> void [before selected]
admin_remove_submission(submission_id) -> void
upvote_submission(submission_id) -> void
downvote/remove_upvote(submission_id) -> void
```

## 12.3 Board Play

```text
mark_square(board_square_id) -> result { marked, bingo_claimed?, points_awarded? }
unmark_square(board_square_id) -> optional MVP? [probably not allowed once marked unless admin]
```

Recommendation: Do not allow normal unmarking after mark if it could affect scoring. If needed, allow before bingo/claim or admin correction only.

## 12.4 Guessing

```text
submit_guess(game_id, guess_text) -> guess_id
resolve_guess(guess_id, result, matched_selected_action_id?, giveaway_player_id?) -> void
```

## 12.5 Admin Corrections

```text
admin_adjust_score(game_id, player_id, points, note) -> score_event_id
admin_lock_action(selected_action_id, reason) -> void
admin_unlock_action(selected_action_id) -> void
admin_reopen_target(target_player_id) -> void [dangerous, later]
```

---

# 13. SUPABASE RLS POLICY CONCEPTS

Exact SQL policies can be written during implementation. Conceptual policies:

## 13.1 games

- SELECT if user is game member.
- INSERT if authenticated.
- UPDATE if user is host/admin of game.

## 13.2 game_players

- SELECT if same game member.
- INSERT via join function only.
- UPDATE self display_name maybe; host/admin can update role/status before active.

## 13.3 action_submissions

- SELECT if:
  - game is revealed, and user is game member; OR
  - user is game admin; OR
  - current player's game_player_id != target_player_id and user is game member.
- INSERT only if:
  - game.status = setup
  - submitted_by_player_id = current_player
  - target_player_id != current_player
  - target is in same game
- UPDATE/DELETE own before selected; admin anytime before active.

Important: hiding submitter identity may require views/RPCs because RLS controls rows, not columns. Use a view like `visible_action_submissions` that omits `submitted_by_player_id` until reveal, or only expose via RPC.

## 13.4 action_upvotes

- SELECT aggregate counts for visible submissions.
- INSERT only if voter can see submission and is not target and not self-upvoting if disallowed.
- DELETE own upvote during setup.

## 13.5 selected_actions

- SELECT if:
  - game revealed; OR
  - current player is not target and owns/has access to board/action.
- Target cannot select their own selected_actions during active/setup.

## 13.6 boards

- SELECT if:
  - board.owner_player_id = current_player during active; OR
  - game revealed; OR
  - admin maybe.
- INSERT only via generate_boards function.

## 13.7 board_squares

- SELECT if board visible.
- UPDATE mark only if board.owner_player_id = current_player and game active.

## 13.8 guesses

- SELECT visible to game members? Need decide. Guess attempts might be public/social. Recommended: public to game members after submission, because guessing is social/honor adjudicated.
- INSERT only by target about themselves.
- UPDATE/resolve by host/admin or group mechanism.

## 13.9 score_events / target_claims

- SELECT public to game members.
- INSERT only via server functions/admin.

---

# 14. REALTIME EVENTS

Use Supabase Realtime or polling.

Useful realtime channels:

- game status changes
- setup submission/upvote counts for visible targets
- board square changes for current user's own boards only
- score events
- target claims
- guesses submitted/resolved
- reveal state

Privacy warning: Do not broadcast hidden target actions to target clients through realtime payloads. Use filtered subscriptions/RLS-safe views. Never include full hidden data in a global public event payload.

---

# 15. EDGE CASES / OPEN DECISIONS

## 15.1 Insufficient Actions

What if target does not have enough submissions to fill board?

Recommended MVP:

- host cannot start until each target has enough selected actions, unless host lowers board/action count.
- show progress per target.

## 15.2 Tied Upvotes

Recommended MVP:

- host resolves ties during finalization.

## 15.3 Duplicate/Semantically Similar Actions

MVP:

- allow duplicates but host/admin can remove/override.

Future:

- duplicate detection, merge suggestions.

## 15.4 Player Leaves Mid-Game

Need decide.

MVP recommendation:

- if player leaves before active, remove them and their submissions/votes or mark inactive.
- if player leaves after active, keep them as target and observer but mark inactive; host can end/continue.

## 15.5 Unmarking

MVP recommendation:

- allow unmark only before it contributes to a claim? Simpler: no unmark except admin correction.

## 15.6 Guess Accuracy

User specified close-enough and player discretion. MVP can make this social/honor system.

## 15.7 Giveaway Player Already Marked Action

Unresolved. User case assumes player 3 had not already marked it. Recommended interpretation:

- any player who already marked before post-action guess keeps mark.
- giveaway player loses 1 point whether or not they had already marked.
- unmarked players get locked out.

## 15.8 Multiple Simultaneous Claims

Race condition if two players mark bingos for same target at same time.

Implementation must enforce unique target_claim(game_id, target_player_id). First successful transaction wins. Later transaction sees target already claimed and fails/does not score.

## 15.9 Board Layout Fairness

Same action pool, randomized layout. Some layouts may be easier due to action difficulty clustering. Difficulty scoring is explicitly not wanted now. Randomization accepted.

## 15.10 Marks Private But Score Events Public

A bingo claim necessarily reveals that claimant completed a target board, but not necessarily which actions/line until reveal. During gameplay, claim event can show: "Sarah claimed Omar" and points, without revealing line/actions.

---

# 16. MVP BUILD PLAN

## Phase 1: Core Data + Auth

- Supabase project
- profiles
- games
- game_settings
- game_players
- invite/join flow
- RLS foundation

## Phase 2: Setup Action Market

- create game/lobby
- unified setup screen
- submit actions for non-self targets
- view visible submissions by target/all
- upvote visible submissions
- hide own target actions
- host progress/controls

## Phase 3: Finalization + Board Generation

- select top-voted actions per target
- tie handling/host override
- generate boards and board_squares
- transition to active

## Phase 4: Gameplay Boards

- My Boards list
- Board detail grid
- mark square
- bingo detection
- target claim
- score event creation
- target lock

## Phase 5: Guess Mechanic

- guess token allocation
- submit guess
- honor/admin resolution
- correct pre-action lock + point
- correct post-action partial lock + giveaway penalty

## Phase 6: End/Reveal

- end condition all targets claimed
- manual end
- reveal all actions/boards/submitters
- score ledger

## Phase 7: PWA Polish

- responsive mobile-first UI
- installable PWA manifest
- offline-ish handling not necessary for MVP but graceful network errors needed
- add Capacitor later

---

# 17. TEST CASES

## 17.1 Visibility Tests

- Omar cannot see submissions targeting Omar during setup.
- Omar can see submissions targeting Jake/Sarah/Michelle.
- Omar cannot vote on Omar submissions.
- Omar can vote on other target submissions.
- Omar cannot see selected actions targeting Omar during active play.
- Sarah cannot see Omar's Sarah board layout.
- After reveal, all players can see all boards/actions/submitters.

## 17.2 Submission/Upvote Tests

- Non-target can submit action for target.
- Target cannot submit action for self.
- One upvote per voter per submission.
- Self-upvote blocked if disabled.
- Upvote counts correctly aggregate.

## 17.3 Board Generation Tests

- For N players, generate N*(N-1) boards.
- No board has same owner and target.
- For each target, all observer boards contain same selected_action IDs.
- Layouts are shuffled per observer.
- Free space placed correctly if enabled.

## 17.4 Marking Tests

- Board owner can mark own square.
- Non-owner cannot mark another player's square.
- Target cannot mark board about themselves because they have no such board.
- Locked square cannot be marked.
- Square cannot be marked after target claimed.

## 17.5 Bingo Tests

- Completed row claims target and awards normal points.
- Completed column claims target and awards normal points.
- Completed diagonal claims target if diagonals enabled.
- One square completing row+column awards multi-bingo points.
- Once target claimed, another claim for same target fails.

## 17.6 Guess Tests

- Correct pre-action guess locks all matching unmarked squares and awards target +1.
- Correct post-action guess preserves existing marked squares, locks unmarked squares, penalizes giveaway player -1, target gets no point.
- Incorrect guess consumes token and no lock/score.
- Guess blocked when no tokens remaining.

## 17.7 End/Reveal Tests

- Game ends when all targets claimed if configured.
- Reveal exposes all previously hidden data to game members.
- Score ledger total matches denormalized player scores.

---

# 18. FUTURE FEATURES / ROADMAP

Do not build before MVP unless asked.

- majority vote verification for action completion/guesses
- photo/video evidence
- AI-assisted action suggestions
- templates/presets marketplace
- custom bingo patterns/shapes
- multiple rounds per game
- teams
- public/private game discovery
- push notifications
- action difficulty ratings; user explicitly said no for now
- moderation/reporting tools
- duplicate action detection
- chat/comments
- achievements/postgame recap

---

# 19. TRANSCRIPT / SOURCE CONVERSATION

This section captures the visible design conversation that produced the current spec. It is included as reference for future AI agents.

## Turn 1 — User

I have an idea for a game and I need you to help me flesh it out and come up with a coherent full picture plan for the architecture. Here's the idea: bingo with friends. Working title is Fringo. Basically the idea is to have a group of friends play bingo together, but the spots on the cards are things that everyone comes up with for each player. In other words, for player A, players B-G all submit actions they predict player A will do, or things they think they can get player A to do. Then when the group has come up with enough actions that everyone is satisfied with (presumably 24 of them for a 5x5 bingo board with one free space), each player B-G gets their own randomized board of player A actions. This repeats for every player until every player has a unique bingo board for every other player. Then the game begins, with the goal for each player to try to get bingo on their boards for each player. Whenever a player gets a bingo on one of their boards, they get a point and everyone's boards for the player whose actions are on the board are locked  and cannot be won. This continues until every player has had one of their bingo boards completed by someone, then the round ends. The winner is the player with the most points. 

The replayability of this game comes from the different scenarios in which the game can be played. Essentially, it's a game you play while playing other games/activities. For example, you could start the game before a friends night out at the bar, and make all the actions related to things that might happen at the bar.

Ask me questions about this project to help iron out some specifics.

## Turn 2 — Assistant

This is a surprisingly strong social game concept because it creates three simultaneous dynamics:

1. **Prediction** ("I bet Omar will order a second drink")
2. **Manipulation** ("Can I convince Omar to karaoke?")
3. **Observation** ("Wait, did that count?")

Those three things reinforce each other and naturally generate stories.

Before getting into architecture, I want to nail down the game design because a lot of technical decisions depend on the answers.

## Core Gameplay Questions

### 1. How long is a round intended to last?

Examples:

- A single evening at a bar (3-5 hours)
- A board game night (6-8 hours)
- A weekend trip
- An entire week
- Completely configurable

This affects:
- board size
- scoring
- notification systems
- whether actions can be edited after the game starts

---

### 2. Who decides whether an action happened?

For example:

**Square:** "Omar orders mozzarella sticks"

Possible verification systems:

#### Option A: Self-report
Omar checks it off.

#### Option B: Majority vote
Someone submits it and the group votes.

#### Option C: Photo/video evidence
Attach proof.

#### Option D: Owner approval
The player whose board it is confirms.

#### Option E: Hybrid
Anyone can submit, owner can challenge.

This is probably the biggest design decision.

---

### 3. Should players know what is on other players' boards?

Example:

I have a square:

> "Omar says 'actually' five times"

Do I keep that secret?

Or can Omar see all the squares targeting him?

#### Secret boards
Pros:
- More strategy
- More surprises

Cons:
- Harder to intentionally cause events

#### Public boards
Pros:
- Encourages sabotage/manipulation

Cons:
- Less mystery

#### Semi-public
You see actions submitted for you, but not where they are on boards.

This is the option I'm currently leaning toward.

---

### 4. Can multiple people score from the same action?

Example:

Action occurs:

> Omar orders wings

Five people have that square checked.

Should:

#### A
Everyone gets the square

or

#### B
Only the first person to claim it gets credit

or

#### C
Everyone gets the square but only one bingo can ultimately win

---

### 5. What happens if someone gets multiple bingos on one board?

Suppose my Omar board has:

- horizontal bingo
- vertical bingo

Do I get:

- 1 point
- 2 points
- bonus points?

---

### 6. What prevents boring squares?

Without restrictions, players will submit:

- Omar drinks water
- Omar uses his phone
- Omar breathes oxygen

Do you envision:

#### Difficulty ratings?

Example:

- Easy
- Medium
- Hard

Or

#### Submission voting?

Example:

Group votes on whether a square is acceptable.

---

## Content Generation Questions

### 7. How are squares collected?

I see two possible flows.

#### Flow A: Manual

Everyone enters suggestions.

Pros:
- Personal

Cons:
- Slower

#### Flow B: AI-assisted

Prompt:

> Give me 20 funny predictions for Omar at a bar night.

Then players edit.

This dramatically improves onboarding.

---

### 8. Should there be categories?

Example:

Bar Night

- Drinks
- Social
- Food
- Embarrassing
- Competitive

Road Trip

- Navigation
- Food
- Music
- Mishaps

Vacation

- Tourist
- Food
- Photos
- Transportation

Categories make AI generation much easier later.

---

## Social Dynamics Questions

### 9. Are players allowed to intentionally force actions?

This sounds obvious, but it's actually fundamental.

Example:

I literally hand Omar a mozzarella stick.

Does that count?

Or must actions happen naturally?

Your description suggests:

> Things they predict OR think they can get someone to do

Which implies intentional manipulation is part of the game.

If that's true, I would lean heavily into it.

---

### 10. Are squares visible after completion?

Example:

Omar's action occurs.

Should everyone immediately see:

> ✓ Omar ordered wings

Or only people who had that square?

---

## Product Questions

### 11. Is this intended as:

#### A. Mobile-first app

(iOS/Android)

#### B. Web/PWA first

Given your previous interest in PWAs and fast iteration, I'd strongly recommend PWA first.

This game is almost entirely:
- forms
- notifications
- real-time updates

which PWAs handle extremely well.

---

### 12. What is the desired player count?

The combinatorics get interesting.

For 8 players:

Every player needs boards for 7 others.

That means:

7 boards × 8 players = 56 boards

That's a lot.

I suspect we may want to rethink board generation if groups exceed 6–8 people.

---

## One Design Idea I'd Consider

Instead of creating 24 unique actions per player, create a shared "action pool."

Example:

For Omar:

40 approved actions exist.

Each player's Omar board randomly draws 24.

Benefits:

- More variety
- Easier content generation
- Better replayability
- Less work for players

---

The question I'm most interested in first is:

**When an action happens, who decides that it happened and how is it verified?**

That answer will drive a huge portion of both the game design and the technical architecture.

## Turn 3 — User

1. Completely configurable
2. Honor system to start, maybe majority vote later
3. Every player should have the same events for a specific player as everyone else, just in a formation that is different for each player. And the player that the boards are about should not know what the events about them are.
4. Yes, multiple people can mark off the same event if they are present when it occurs (and notice it occurring).
5. If someone can get two bingos at the same time with one square, they get 3 points. But the risk is that it will take longer to set up and pull off, and if someone else gets a bingo for that player before they do, that player becomes "locked" and no one else can earn points by completing a bingo on their board.
6. It will involve some kind of voting system in the future, but for now it will be the honor system. 
7. A: Manual.
8. The category will just be the event/activity that the bingo game will be played during. So if it's intended to be played 
9. This is where I'm considering adding a mechanic where if a player is able to guess what a card about them is before they do the action, that card gets locked out for everyone and no one can use that card to get bingo moving forward. And if the player it's about guesses correctly, they get 1 extra point.
10. Everyone will have the same squares, so if it's on one person's board, it'll be on everyone else's too. But each player needs to manually mark it as completed when they notice it happen, or they miss out on it.
11. It can be a PWA first and will eventually need to be an android and iOS app.


To answer your question at the very end of your response, when an action happens, every player who witnesses the action occur and realizes it's on the bingo board for that player can mark it off on their board (the one they have for the player that committed the action).

## Turn 4 — Assistant

That clears up the core loop a lot. The biggest architecture implication is that “events” are shared per target player, while “boards” are private randomized layouts derived from that same event pool.

Here’s the clearer current model:

**Fringo = hidden asymmetric bingo around real-world friend behavior.**

For each target player, everyone else sees the same 24 hidden events about that target, but each observer gets a different board layout. The target does **not** know their own events. Players manually mark events they witness. First bingo on a target locks that target’s board category for everyone. Double-bingo from one square = 3 points. Correct target guess before doing the action locks that event and gives the target 1 point.

A few key questions to iron out next:

1. **Can the target player score points from guessing multiple events about themselves, or only once per round?**

2. **When someone guesses an event about themselves, do they have to guess the exact wording, or close enough?**  
Example: “Omar orders fries” vs “Omar orders food for the table.”

3. **Who confirms a successful guess?**  
The person who submitted it? Anyone who has that board? Group honor system?

4. **Can players discuss/coordinate secretly?**  
Example: Player B and C both know “Omar sings karaoke” is on the board. Can they team up to make it happen?

5. **When a target gets locked because someone scored bingo, what happens to incomplete marked squares on that target’s boards?**  
They become irrelevant immediately, right?

6. **Can a player win multiple bingos for different target players in the same round?**  
I assume yes.

7. **Can a player have multiple boards active at once?**  
Example: I’m playing with Omar, Sarah, and Jake, so I have one board for Omar, one for Sarah, one for Jake.

8. **Who submits events for a target?**  
Can everyone submit actions for everyone, or only non-target players submit for that target?

9. **Does the target ever see the events after the round ends?**  
This could be part of the fun: reveal all hidden predictions afterward.

10. **Should event difficulty matter for scoring later?**  
For MVP, I’d avoid this. Later, you could have easy/medium/hard event ratings.

The architecture is starting to look like:

**Game**
→ has players, settings, round duration/activity theme

**Round**
→ contains one event pool per target player

**Target Event Pool**
→ 24 approved events about one target player

**Board**
→ private randomized layout for one observer targeting one player

**Square State**
→ unmarked / marked / locked / guessed

**Score Event**
→ bingo, double bingo, successful self-guess, maybe future vote bonus

The most important next design decision is:

**How exact does a self-guess need to be to lock an event?**

## Turn 5 — User

1. Targets get a limited number of guesses that they can use to try to guess what an action is. If they can guess what it is before they do it once, they get a point and that action is locked out for all of the non-target players. If they guess an action correctly after they've already done it once, it gets locked out for the person who tried to get them to do it and all remaining non-target players. In other words, if players 1 and 2 are able to get the target to do the action without the target knowing, and then the target catches on when player 3 tries to get them to do the action, then  players 1 and 2 keep that square marked as complete, but player 3 and all remaining players have it locked out, and the player that gave it away (in this case player 3) loses 1 point. The target does not get a point unless they are able to guess it before any non-targets have marked the square as completed. 
2. Close enough, will be up to player discretion.
3. Group honor system
4. If they want to, sure. But showing someone what your board looks like could also lead to sabotage
5. Yes, they become irrelevant. That target is claimed and players move on to other targets.
6. Yes.
7. Yes, every player will have a board for every other player in the game. So every player is a target for every other player. 
8. Only non-target players can submit actions for a target. The whole point is that the target doesn't know what actions the non-target players have submitted for them.
9. Yes, when the round ends, everyone can see everyone else's boards and the actions that are listed for them (the targets).
10. No.

The important thing to note here is that every player in the game is a target for all of the other players.

## Turn 6 — Assistant

I think we just uncovered the thing that makes Fringo interesting.

Originally I thought it was "social bingo."

It's actually **social bingo + hidden information + deduction + sabotage.**

The guessing mechanic fundamentally changes the game from passive observation into a battle between:

- Players trying to engineer events
- Targets trying to identify those events before they happen
- Players trying to hide their intentions
- Players potentially sabotaging each other

That creates much deeper gameplay than standard bingo.

---

# What I Think The Core Loop Is

## Setup Phase

Players create a game.

Theme:
- Bar night
- Road trip
- Wedding
- Vacation
- Board game night
- Convention
- etc.

For each target player:

1. Non-target players submit events.
2. Group narrows them down to 24.
3. Event pool is finalized.
4. Every observer gets a randomized board using those same 24 events.

Example:

Target = Omar

Event pool:

- Orders wings
- Talks about AI
- Mentions Egypt
- Sings karaoke
- Buys someone a drink
- etc.

Player A's board layout differs from Player B's board layout.

---

# Gameplay Phase

At any moment a square can be in one of four states:

### Hidden

Nobody has triggered it.

### Claimed

A player witnessed it and marked it.

### Locked

Unavailable forever.

### Revealed

End-of-round state.

---

# The Most Important Mechanic: Event Ownership

I think this needs to exist.

Suppose:

Event:
> Omar sings karaoke.

Who submitted it?

Player 4.

That means Player 4 is the **owner** of that event.

This becomes important because of your guess mechanic.

---

# Example Scenario

Target:
Omar

Event owner:
Sarah

Event:
"Omar orders a shot."

---

Sarah subtly encourages Omar.

Omar refuses.

---

Later:

Jake says:

> "Come on Omar, you should totally order a shot."

Now it's obvious.

Omar says:

> Wait, is one of my cards "Omar orders a shot"?

Correct.

---

Result:

Sarah keeps any completed marks she already earned.

Jake loses 1 point.

Event becomes locked for everyone who hasn't already marked it.

Omar gets no point because the event was already completed.

This is a really elegant mechanic.

---

# The Strategy Meta Emerging

Players will eventually learn:

## Bad Strategy

Blatantly force events.

Because you risk:

- revealing the event
- helping the target guess
- losing points

---

## Good Strategy

Create situations where the target naturally does the thing.

For example:

Bad:

> Omar, tell us about Egypt.

Good:

Conversation drifts toward travel.

Omar brings up Egypt naturally.

Much safer.

---

# Architecture Observation

You don't actually have a "bingo square."

You have:

## Event

Shared across everyone.

Example:

"Omar orders wings."

---

Then each player has:

## Personal Board Position

Player A:
Row 1 Col 3

Player B:
Row 5 Col 1

Player C:
Row 2 Col 2

Same event.

Different locations.

This distinction will matter tremendously in the database.

---

# I Would Add One More Rule

Right now there is almost no cost to guessing.

If I'm the target, I should just spam guesses.

I'd recommend:

### Guess Tokens

Example:

5-player game

Each target gets:

- 3 guesses
- 5 guesses
- configurable

Once they're gone:

No more guessing.

Otherwise optimal play becomes:

> Is one square about food?
>
> Is one square about drinks?
>
> Is one square about karaoke?
>
> Is one square about talking about work?

and so on.

---

# MVP Architecture

If I were building Version 1:

## Entities

### User

- id
- displayName

### Game

- id
- theme
- status

### Player

- gameId
- userId
- score

### Event

- id
- targetPlayerId
- ownerPlayerId
- description
- status

status:
- active
- completed
- locked

### Board

- observerPlayerId
- targetPlayerId

### BoardSquare

- boardId
- eventId
- row
- col
- marked

### Guess

- targetPlayerId
- eventId
- timestamp
- correct

---

# Biggest Unanswered Design Question

This is the one I'd focus on next:

### How are events selected?

Suppose there are 6 players.

For Omar:

Each of the other 5 players submits 10 events.

Now we have 50 events.

How do we get down to 24?

Options:

1. Majority voting
2. Target count per submitter (each person contributes exactly 4-5)
3. Draft system
4. Upvote/downvote
5. Host decides

The answer to that question will have a huge effect on setup time, which I suspect is the biggest challenge Fringo will face. The game itself sounds fun; the risk is that setup becomes a 30-minute chore before every bar night.

## Turn 7 — User

We'll start with upvotes for now. So all of the actions submitted will appear in that target's list that everyone but the target can see, and all of the non-targets can "upvote" submissions from other non-targets. The submissions with the most upvotes become the actions that will be used on everyone's board. I'm not too worried about the setup time right now because it can be heavily customizable. The game could be played for a few hours all the way up to years if the players want. So setup can take a bit longer if needed. For example, if the "category" is game night, that'll only be a couple hours and the actions will need to be pretty specific to playing board games together, and the number of actions per bingo card can be tweaked accordingly. Whereas if the category is "spring break" then players can expand the number of actions required to achieve a bingo and make it last a full week.

## Turn 8 — Assistant

The upvote system fits the hidden-information premise well. I’d treat “game duration” and “board density” as first-class settings, not special cases, so Fringo can scale from one night to a semester.

That makes sense. I’d now frame Fringo as a **configurable hidden-events bingo engine**, not just a fixed 5×5 bingo game.

The key architectural move is: **do not hardcode 24 actions, 5×5 boards, or one-night rounds.** Those should all be game settings.

## Updated Core Model

Every game has:

- A group of players
- A theme/category/activity
- A duration or end condition
- A ruleset
- One hidden action pool per target player
- One private randomized board per observer/target pair

So in a 6-player game:

- Omar has a hidden action pool visible to the other 5 players
- Sarah has a hidden action pool visible to the other 5 players
- Jake has a hidden action pool visible to the other 5 players
- etc.

Each player sees boards for everyone else, but never the board/actions about themselves.

---

# Setup Flow

## 1. Create Game

Host chooses:

- Game name
- Category/activity
- Start time
- End time or manual end
- Board size
- Number of selected actions per target
- Guess limit per target
- Whether free spaces exist
- Bingo pattern rules

Examples:

### Game Night

- 3×3 board
- 8 actions + 1 free space
- 3 in a row to bingo
- 2 guesses per target
- Expected duration: 2–4 hours

### Bar Night

- 5×5 board
- 24 actions + 1 free space
- 5 in a row to bingo
- 3–5 guesses per target
- Expected duration: one evening

### Spring Break

- 7×7 board
- 48 actions + 1 free space
- 7 in a row to bingo
- More guesses
- Expected duration: one week

### Long-Term Friend Group Game

- Larger board or multiple boards
- Could run for months
- Maybe no free space
- Could require multiple bingos to claim a target

---

# Submission and Upvote Flow

For each target player:

1. Every non-target player submits actions.
2. All submitted actions appear in that target’s hidden action list.
3. Non-target players can upvote submissions.
4. The target cannot see, submit, or vote on their own actions.
5. Top-voted actions are selected for the final board.
6. Ties can be resolved by host choice, random selection, or extra voting.
7. Once finalized, everyone gets the same selected actions in different board layouts.

I would make the MVP rule:

**Players cannot upvote their own submissions.**

That makes upvotes more meaningful and discourages spam.

---

# Important Distinction: Action Pool vs Board Layout

For a target named Omar, the selected action pool might be:

- Omar orders fries
- Omar mentions work
- Omar says “actually”
- Omar checks his phone during a game
- Omar takes a group photo
- Omar asks what time it is

Every non-target player has those same actions.

But:

### Sarah’s Omar Board

| A | B | C |
|---|---|---|
| D | Free | E |
| F | G | H |

### Jake’s Omar Board

| F | C | A |
|---|---|---|
| H | Free | B |
| D | E | G |

Same events, different formation.

That is the whole strategic engine of the game.

---

# Event States

Each target action should have a global state and each board square should have an individual state.

## Global Action State

An action can be:

- **Active**
- **Locked**
- **Revealed**

## Individual Board Square State

For each player’s board, that action can be:

- **Unmarked**
- **Marked**
- **Locked**
- **Part of winning bingo**
- **Revealed after round**

This is important because of the self-guess mechanic.

---

# Self-Guess Mechanic

This is one of the best parts of the design.

## Case 1: Target guesses before anyone marks it

Example:

Omar says:

> “Is one of my actions that I order mozzarella sticks?”

If correct:

- Omar gets +1 point
- That action is locked for everyone
- No non-target player can score from it

## Case 2: Target guesses after some players already marked it

Example:

Sarah and Jake already marked “Omar orders mozzarella sticks.”

Then Mike makes it obvious, Omar guesses correctly.

Result:

- Sarah keeps the square marked
- Jake keeps the square marked
- Mike loses 1 point
- Everyone who had not already marked it gets it locked
- Omar gets no point

This is not just a penalty mechanic. It creates social strategy.

Players have to decide:

> Do I risk making this obvious to finish my bingo?

That is great.

---

# Target Locking

When a player gets bingo on a target board:

Example:

Sarah gets bingo on her Omar board.

Then:

- Sarah gets points
- Omar becomes “claimed” or “locked”
- Nobody else can earn bingo points from Omar boards
- Existing Omar-board marks become irrelevant
- Players move focus to other target boards

I would call this state:

**Target Claimed**

Rather than just “locked,” because it means someone successfully claimed that target for the round.

---

# Scoring Ledger

Instead of storing only a score number, I’d store score events.

Example:

| Player | Event | Points |
|---|---:|---:|
| Sarah | Bingo on Omar | +1 |
| Jake | Double bingo on Sarah | +3 |
| Omar | Correct pre-action guess | +1 |
| Mike | Gave away action | -1 |

This makes the game history understandable later.

It also helps with disputes because players can see why the score is what it is.

---

# MVP Database Structure

This could work well in Supabase.

## users

- id
- display_name
- avatar_url

## games

- id
- name
- category
- status
- created_by
- starts_at
- ends_at
- created_at

## game_players

- id
- game_id
- user_id
- display_name
- score

## game_settings

- game_id
- board_rows
- board_cols
- has_free_space
- free_space_position
- actions_per_target
- guesses_per_target
- bingo_rule
- allow_diagonals
- allow_multiple_bingo_bonus
- double_bingo_points
- normal_bingo_points
- pre_action_guess_points
- giveaway_penalty_points

## action_submissions

- id
- game_id
- target_player_id
- submitted_by_player_id
- text
- created_at
- status

Statuses:

- submitted
- selected
- rejected
- locked
- revealed

## action_upvotes

- id
- submission_id
- voter_player_id
- created_at

Constraint:

- one upvote per voter per submission
- voter cannot be target
- voter probably cannot be submitter

## selected_actions

This can either be a separate table or just a status on `action_submissions`.

I’d probably use a separate table for clarity:

- id
- game_id
- target_player_id
- submission_id
- action_text
- selected_rank

## boards

- id
- game_id
- owner_player_id
- target_player_id

Where:

- `owner_player_id` = the player holding the board
- `target_player_id` = the person the board is about

Important rule:

`owner_player_id` cannot equal `target_player_id`.

## board_squares

- id
- board_id
- selected_action_id
- row
- col
- state
- marked_at

States:

- unmarked
- marked
- locked
- winning

## guesses

- id
- game_id
- target_player_id
- guessed_by_player_id
- selected_action_id
- guess_text
- result
- accused_giveaway_player_id
- created_at

Results:

- correct_pre_action
- correct_after_action
- incorrect

## target_claims

- id
- game_id
- target_player_id
- claimed_by_player_id
- board_id
- points_awarded
- created_at

## score_events

- id
- game_id
- player_id
- points
- reason
- related_target_player_id
- related_action_id
- created_at

---

# Board Generation Logic

Once voting ends for a target:

1. Sort submissions by upvotes.
2. Pick top `actions_per_target`.
3. Generate a board for every non-target player.
4. Shuffle action placement uniquely per board.
5. Insert board squares.

Pseudo-logic:

```text
for each target in game.players:
    selected_actions = top_voted_actions_for(target)

    for each observer in game.players except target:
        shuffled_actions = shuffle(selected_actions)

        create board:
            owner = observer
            target = target

        place actions into board cells
        insert free space if enabled
```

For fairness, everyone has the same action pool for a target.

For strategy, everyone has a different layout.

---

# Bingo Detection Logic

Whenever a player marks a square:

1. Check whether the target has already been claimed.
2. Check whether the action is locked.
3. Mark the square.
4. Evaluate the board for completed lines.
5. If one line is completed, award normal bingo points.
6. If two or more new lines are completed by that mark, award double-bingo bonus.
7. Mark that target as claimed.
8. Lock all other boards for that target.

The double-bingo rule should only trigger when the newly marked square creates multiple lines at the same time.

So not:

> I already had one bingo and later got another.

But:

> This one square completed two lines simultaneously.

That keeps it clean.

---

# Configurable Rulesets

I’d avoid making “Game Night,” “Bar Night,” and “Spring Break” hardcoded game modes.

Instead, make them presets.

## Preset: Game Night

- 3×3
- 8 actions
- 1 free space
- 2 guesses
- 3 in a row

## Preset: Night Out

- 5×5
- 24 actions
- 1 free space
- 4 guesses
- 5 in a row

## Preset: Trip

- 5×5 or 7×7
- 24–48 actions
- Optional free space
- 5–7 guesses
- Longer duration

## Preset: Custom

Everything editable.

This gives new users an easy starting point without limiting power users.

---

# MVP App Flow

## Screen 1: Home

- Create game
- Join game
- Active games
- Past games

## Screen 2: Create Game

- Game name
- Category/activity
- Invite players
- Choose preset
- Customize rules

## Screen 3: Lobby

Shows all players.

Game phases:

- Waiting for players
- Submitting actions
- Voting
- Generating boards
- Active
- Round ended

## Screen 4: Target Submission

For each other player:

> Submit actions you think Omar might do.

The target cannot access this screen for themselves.

## Screen 5: Voting

For each target:

> Vote on actions for Omar.

Visible only to non-targets.

## Screen 6: My Boards

Tabs/cards:

- Sarah board
- Jake board
- Mike board
- etc.

No board for yourself.

## Screen 7: Board Detail

Player taps a target board and sees their randomized bingo board.

Tap square to mark it.

## Screen 8: Guess Screen

For the target:

> Use one of your guesses.

They type a guess, and the group confirms on honor system.

For MVP, this could be manual:

- Correct before action
- Correct after action
- Incorrect
- Who gave it away? Optional

## Screen 9: Scoreboard

- Player scores
- Claimed targets
- Remaining targets
- Guess tokens left

## Screen 10: Round Reveal

After the round:

- Reveal all actions
- Reveal everyone’s boards
- Show who submitted what
- Show funniest missed actions
- Show score history

---

# Main Technical Risk

The hardest part will not be board generation.

It will be **permissions**.

You need to make sure:

- Omar cannot see actions targeting Omar
- Omar cannot see boards where Omar is the target
- Omar can see boards where Omar is the observer
- Non-targets can see the shared action pool before boards are generated
- Only non-targets can vote on target actions
- After the round ends, everything becomes visible

That means visibility rules should be designed carefully from the beginning.

---

# Supabase Is a Good Fit

This is a strong Supabase project because you need:

- Auth
- Realtime updates
- Postgres relational data
- Row-level security
- Easy PWA deployment
- Eventually mobile app support

A PWA could use:

- React / Next.js or Vite
- Supabase Auth
- Supabase Postgres
- Supabase Realtime
- Tailwind or shadcn/ui
- Capacitor later for iOS/Android wrapping

I would probably build:

**Vite + React + Supabase + Capacitor later**

rather than starting native.

---

# The Next Design Questions

I think the next things to decide are:

1. **Does voting happen separately for each target, or is there one big setup screen where you cycle through targets?**

2. **Can the host manually override the upvote results before boards are generated?**

3. **Should selected actions reveal their submitter to non-target players during gameplay, or only after the round?**

4. **When someone marks a square, is that private to them, or do others see that they marked something on that target’s board?**

My recommendation: markings should be private during gameplay. Otherwise, if everyone sees Sarah is suddenly marking Omar squares, they may infer what she is trying to get Omar to do.

## Turn 9 — User

1. It doesn't necessarily have to be all on one big setup screen, but yes, during the setup phase, players should be able to freely submit actions and vote on other submissions for all players. So if Omar is playing with Jake, Sarah, and Michelle, he might think of one action for Jake, then a couple in a row for Sarah, then remember something about Jake and submit one more for him, then see someone's submission about Michelle and upvote it. It needs to be fluid and easy to submit and upvote for all other targets.
2. Sure, I guess? I guess the host can have admin privileges, essentially.
3. No, save it for after the round.
4. Keep marks private. 

## Turn 10 — Assistant

This makes the setup phase feel more like a shared hidden “idea market” than a wizard. That’s good: players can jump between targets naturally, which should make setup much less tedious.

This solidifies the MVP shape. I’d design the setup experience around a **unified action feed**, not separate step-by-step forms.

# Fringo Setup Phase

During setup, each player can freely move between all valid targets.

Example: Omar’s setup view would show:

- Jake’s submissions
- Sarah’s submissions
- Michelle’s submissions

But **not Omar’s own submissions/actions**.

Omar can:

- submit an action for Jake
- submit an action for Sarah
- upvote someone else’s action for Michelle
- go back and add another action for Jake
- filter by target
- see which targets still need more submissions

That means setup should feel like:

> “Here are all the secret actions for everyone else. Add ideas, upvote the good ones, and help build the game.”

Not:

> “Step 1: submit for Jake. Step 2: submit for Sarah. Step 3: submit for Michelle.”

---

# Recommended Setup UI

## Main Setup Screen

Use target tabs or filter chips:

```text
All | Jake | Sarah | Michelle
```

Then a feed of submissions:

```text
Target: Sarah
"Sarah checks her phone during the game"
▲ 3 votes

Target: Jake
"Jake explains the rules incorrectly"
▲ 5 votes

Target: Michelle
"Michelle says she hates this game but keeps playing"
▲ 2 votes
```

Each submission card should show:

- target player
- action text
- upvote button
- vote count
- maybe “selected” status once finalized

But it should **not** show the submitter until after the round.

---

# Submission Composer

The action composer should be fast:

```text
Target: [Sarah ▼]

Action:
[ Sarah says "wait, whose turn is it?" ]

[Submit]
```

After submitting, keep the same target selected so someone can quickly add several ideas for the same person.

Also include quick target switching so someone can easily jump from Sarah to Jake without backing out.

---

# Visibility Rules

This is now one of the most important parts of the app.

## During setup

A player can see:

- submissions targeting other players
- upvote counts for other players
- their own submissions for other players
- other people’s anonymous submissions for other players

A player cannot see:

- submissions targeting themselves
- vote counts for actions targeting themselves
- who submitted what
- who upvoted what, unless you decide to reveal that later

## During gameplay

A player can see:

- their own boards for every other player
- their own marks
- which targets have been claimed
- public score changes
- public lock/claim events

A player cannot see:

- anyone else’s board layout
- anyone else’s marked squares
- actions targeting themselves
- who submitted an action

## After the round

Everyone can see:

- all action pools
- all board layouts
- who submitted each action
- who marked what, optionally
- score history
- winning bingos
- locked/guessed actions

I’d make “who marked what” optional in postgame because it could be fun, but it might also create arguments.

---

# Host/Admin Powers

The host can basically act as the game moderator.

For MVP, admin privileges should include:

- start setup
- end setup
- finalize selected actions
- override selected actions
- resolve vote ties
- start game
- manually lock/unlock actions
- adjust scores
- end round
- reveal round

I would not overbuild admin powers visually. Just add a small **Host Controls** panel.

The most important host power is:

> Finalize boards even if the voting/submission process is imperfect.

That prevents setup from getting stuck.

---

# Action Selection Logic

For each target:

1. Gather all submissions targeting that player.
2. Sort by upvote count.
3. Select top `actions_per_target`.
4. If there is a tie near the cutoff, use host override or random selection.
5. Generate unique board layouts for every non-target player.

Example:

Game setting:

```text
Actions per target: 24
Board: 5×5
Free space: yes
```

For Sarah:

- top 24 actions targeting Sarah are selected
- Omar gets a Sarah board with those 24 actions shuffled
- Jake gets a Sarah board with those 24 actions shuffled differently
- Michelle gets a Sarah board with those 24 actions shuffled differently
- Sarah gets no Sarah board and cannot see Sarah actions

---

# Private Marks

Keeping marks private is definitely the right call.

If marks were public, players could reverse-engineer strategy too easily.

Example:

If everyone sees Omar suddenly marked three Jake squares, they might infer:

> Omar is close to bingo on Jake.

Then they might sabotage Omar or try to claim Jake first.

That could be fun later as a variant, but private marks should be the default.

---

# Updated Data Model Implications

The current schema still works, but I’d add a couple concepts.

## action_submissions

Add:

```text
target_player_id
submitted_by_player_id
text
status
created_at
```

Status:

```text
submitted
selected
rejected
locked
revealed
```

## action_upvotes

```text
submission_id
voter_player_id
created_at
```

Rules:

- voter cannot be target
- voter cannot upvote same submission twice
- optional: voter cannot upvote their own submission

I’d strongly recommend **no self-upvoting**.

## selected_actions

```text
game_id
target_player_id
submission_id
selected_order
```

This represents the final canonical action pool for a target.

## boards

```text
game_id
owner_player_id
target_player_id
```

Rules:

```text
owner_player_id != target_player_id
```

## board_squares

```text
board_id
selected_action_id
row
col
state
marked_at
```

This is where each player’s private board state lives.

---

# Game Phases

I’d use a clear finite state machine for the game.

```text
draft
lobby
setup
voting
finalizing
active
ended
revealed
```

But for MVP, you can simplify:

```text
lobby
setup
active
ended
revealed
```

Setup includes both submitting and voting.

That matches your desired fluid behavior better.

---

# Key Product Design Decision

I would make setup one combined phase where submissions and voting happen at the same time.

Do **not** make players submit first, then vote later, unless the host enables that as a stricter variant.

Default:

> Submit and upvote freely until the host finalizes the game.

That supports the way you described people actually thinking of ideas.

---

# Current Fringo MVP Rules

Here’s the clean version so far:

1. Every player is a target.
2. Players submit hidden actions for every other player.
3. Targets cannot see actions about themselves.
4. Non-targets upvote submissions for each target.
5. Top-voted submissions become that target’s action pool.
6. Every non-target gets the same actions for that target, but in a unique randomized layout.
7. Players have one private board for every other player.
8. Players manually mark actions they personally witness.
9. Marks are private.
10. First player to bingo on a target claims that target.
11. Once a target is claimed, nobody else can score from that target.
12. A one-square double bingo is worth 3 points.
13. Targets get limited guesses.
14. Correct pre-action guess gives the target +1 and locks that action for everyone.
15. Correct post-action guess locks the action for players who had not already marked it.
16. The player who gave away the action loses 1 point.
17. After the round, all boards/actions/submitters are revealed.

That is now a coherent game.

The next thing I’d decide is the **board configuration system**: whether Fringo should support only square boards like 3×3, 5×5, 7×7, or whether it should support custom shapes and custom bingo patterns too.

## Turn 11 — User

Create a document that I can upload to other AI agents that I will use to actually build this project. Include a full transcript of this conversation as a reference, and a full breakdown of the plan and architecture for this project that we've designed so far.

## Turn 12 — Assistant

I’ll turn the design into a reusable project brief with two parts: a clean build plan/architecture spec and a transcript/reference section capturing the decisions from this conversation.

I’m going to make this useful for both humans and coding agents: a polished DOCX plus a plain Markdown version that agents can ingest more reliably.

## Turn 13 — User

don't worry about making a version that's readable for humans. I just need other AI agents to be able to read it

## Turn 14 — Assistant

Understood. I’ll optimize the handoff as a machine-readable Markdown spec with dense structure, explicit rules, schemas, pseudocode, and a transcript/reference section rather than a polished human-facing doc.

---

# 20. END OF CURRENT HANDOFF

Future agents should continue from this document. If asked to implement, start with data model/RLS and MVP screens. Do not ask the user to repeat the rules unless a genuinely unresolved edge case blocks implementation.
