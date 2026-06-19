# Fringo MVP Testing Checklist

Run with Docker Desktop + local Supabase (`npm run supabase:start`).

## Setup

1. Start Supabase and copy anon key to `.env`
2. Open app in 3+ browser profiles (or incognito windows)
3. Profile A: Create game → note invite code
4. Profiles B/C: Join with code + display names

## Visibility (Section 17.1)

- [ ] During setup, player cannot see submissions targeting themselves
- [ ] Player can see submissions for other targets
- [ ] Player cannot upvote actions about themselves
- [ ] During active play, player cannot see selected actions about themselves
- [ ] Player cannot see another player's board layout
- [ ] After reveal, all submissions/boards/submitters visible

## Setup & Upvotes (17.2)

- [ ] Non-target can submit for target
- [ ] Self-target submit blocked
- [ ] One upvote per voter per submission
- [ ] Self-upvote blocked
- [ ] Vote counts update via realtime

## Board Generation (17.3)

For N active players:

- [ ] N×(N-1) boards created
- [ ] No board where owner = target
- [ ] Same selected action IDs per target across all observer boards
- [ ] Different square layouts per observer
- [ ] Free space at center when enabled

## Marking & Bingo (17.4–17.5)

- [ ] Owner can mark unmarked square
- [ ] Locked/claimed squares cannot be marked
- [ ] Row bingo claims target (+1)
- [ ] Column bingo claims target
- [ ] Diagonal bingo when enabled
- [ ] Single mark completing 2 lines = +3 (multi_bingo)
- [ ] Second claim on same target fails

## Guesses (17.6)

- [ ] Pre-action correct guess: target +1, action locked globally
- [ ] Post-action correct guess: giveaway -1, unmarked squares locked
- [ ] Incorrect guess consumes token, no score change
- [ ] Blocked when guesses_remaining = 0

## End/Reveal (17.7)

- [ ] Game ends when all targets claimed (if configured)
- [ ] Reveal exposes hidden data
- [ ] Score ledger totals match player scores
