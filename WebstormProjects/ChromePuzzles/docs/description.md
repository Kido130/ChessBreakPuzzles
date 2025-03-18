# Chess Puzzle Website

## Features
- Uses chessboard.js for chess board visualization
- Puzzle selection based on user rating (starting at 650)
- Adaptive difficulty with +200/-200 rating range
- Puzzle history stored in browser cache
- Rating adjustments:
  - Success: +10 points ±1 point per 100 ELO difference
  - Failure: -5 points ±0.5 points per 100 ELO difference
- Interactive feedback with green/red indicators for moves
- Computer plays first move, user plays as the side to move second

## Puzzle Format
```
PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags
```

## Technical Details
- Board is centered on X axis
- Puzzle selection:
  - Finds 3 puzzles within rating range
  - Randomly selects 1 from the matches
  - Range increases by 100 if no puzzles found
- Move validation with visual feedback
- Success message and next puzzle button on completion 