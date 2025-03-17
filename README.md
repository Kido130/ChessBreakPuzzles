# Chess Puzzles Website

An interactive chess puzzle website built with chessboard.js and chess.js that provides personalized puzzles based on user rating.

## Features

- **Adaptive Difficulty**: Puzzles are selected based on user rating (±200 points)
- **Rating System**: User ratings adjust based on performance (+10/-5 points with ELO difference modifiers)
- **Progress Tracking**: Completed puzzles are stored in browser cache
- **Visual Feedback**: Green checkmarks/red X marks indicate correct/incorrect moves
- **Responsive Design**: Works on desktop and mobile devices
- **Multi-tab Support**: Rating and progress sync between tabs
- **Custom Piece Theme**: Uses custom chess piece images from the images folder
- **Large Puzzle Collection**: 100,000 high-quality puzzles with popularity > 95 and plays > 5000

## Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/chess-puzzles.git
   cd chess-puzzles
   ```

2. Open `index.html` in your browser:
   - For testing, you can use a local server like `python -m http.server` or VS Code's Live Server extension

## How to Use

1. The website loads with a puzzle appropriate for your rating (starting at 650)
2. The board is oriented so you play as the side that moves second
3. The computer will make the first move in the puzzle
4. When you make a move:
   - If correct: You'll see a green checkmark and the computer will make the next move
   - If incorrect: You'll see a red X mark and the move will be undone after a short delay
5. After completing a puzzle, click "Next Puzzle" to continue

## Technical Details

- **User Rating**: Starts at 650, adjusts based on performance
- **Puzzle Selection**: Finds 3 puzzles within rating range and picks one randomly
- **Rating Formula**:
  - Success: +10 points ±1 point per 100 ELO difference
  - Failure: -5 points ±0.5 points per 100 ELO difference
- **Data Storage**: Uses localStorage for persistent progress
- **Custom Piece Images**:
  - Located in the `images` folder
  - Follows naming convention: `Chess_[piece][color]t45.svg.png`
  - Where:
    - `[piece]` is k (king), q (queen), r (rook), b (bishop), n (knight), p (pawn)
    - `[color]` is l (light/white) or d (dark/black)
- **Puzzle Database**:
  - 100,000 curated puzzles from Lichess database
  - Filtered for high popularity (>95) and many plays (>5000)
  - Includes a variety of themes and difficulty levels

## Adding More Puzzles

The puzzles are stored in `js/puzzles.js` in the following format:
```
PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags
```

To extract more puzzles from the Lichess database:
1. Download the database file from lichess.org
2. Run the included `extract_puzzles.py` script
3. Customize the filter criteria as needed in the script

## Dependencies

- [chessboard.js](https://chessboardjs.com/) - For chess board visualization
- [chess.js](https://github.com/jhlywa/chess.js) - For chess move validation and game logic
- [jQuery](https://jquery.com/) - Required by chessboard.js

## License

This project is released under the MIT License. 