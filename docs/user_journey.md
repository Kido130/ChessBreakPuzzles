# Chess Puzzle User Journey

## Initial Setup
1. User visits the website for the first time
2. System prompts user to set initial rating
3. User sets desired starting rating
4. Rating is saved to browser's localStorage

## Success Flow
1. User is presented with a chess puzzle
2. User analyzes the position
3. User makes the correct move
4. System shows green visual indicator
5. "Success!" message appears
6. Rating increases by 10 points (if the puzzle is in 200 range of user rating and -/+ 1 point for every 100 additional rating points from the user rating.)
7. New rating is displayed and saved
8. System offers "Next Puzzle" button
9. Previous puzzle is marked as completed in history

## Failure Flow
1. User is presented with a chess puzzle
2. User analyzes the position
3. User makes an incorrect move
4. System shows red visual indicator
5. "Incorrect - Try Again" message appears
6. Original position is restored (rating goes down based on puzzle rating distance from user rating)
7. User can:
   - Try again
   - View hint
   - Skip to next puzzle (rating unchanged)
   - View solution

## Rating System Details
- Rating stored in localStorage
- Format: { rating: number, puzzlesSolved: number }
- Updates after each successful solve
- Persists between sessions
- Can be reset in settings

## Visual Indicators
### Success
- Green highlight on correct move
- Checkmark animation
- Success sound (if enabled)
- Rating increase animation

### Failure
- Red highlight on wrong move
- Piece returns to original position
- Error sound (if enabled)
- Shake animation on wrong move

## Additional Features
- Puzzle difficulty indicator
- Current streak counter
- Progress statistics