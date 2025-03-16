/**
 * Main application file
 */

document.addEventListener('DOMContentLoaded', () => {
    // Initialize the chessboard
    const chessboardElement = document.getElementById('chessboard');
    const chessboard = new ChessBoard(chessboardElement);
    
    // Set the orientation to black (like Lichess example)
    chessboard.setBlackOrientation();
    
    // Get UI elements
    const resetBtn = document.getElementById('resetBtn');
    const nextPuzzleBtn = document.getElementById('nextPuzzleBtn');
    const messageElement = document.getElementById('message');
    const userRatingElement = document.getElementById('userRating');
    const puzzlesSolvedElement = document.getElementById('puzzlesSolved');
    
    // Initialize user data from localStorage or use defaults
    let userData = JSON.parse(localStorage.getItem('chessUserData')) || {
        rating: 1500,
        puzzlesSolved: 0
    };
    
    // Update UI with user data
    updateUserData();
    
    // Event listeners
    resetBtn.addEventListener('click', () => {
        chessboard.resetPosition();
        clearMessage();
    });
    
    nextPuzzleBtn.addEventListener('click', () => {
        // Load a sample puzzle position (similar to the Lichess example)
        loadSamplePuzzle(chessboard);
        clearMessage();
    });
    
    // Load a sample puzzle on startup
    loadSamplePuzzle(chessboard);
    
    // Helper functions
    function updateUserData() {
        userRatingElement.textContent = userData.rating;
        puzzlesSolvedElement.textContent = userData.puzzlesSolved;
        
        // Save to localStorage
        localStorage.setItem('chessUserData', JSON.stringify(userData));
    }
    
    function showMessage(text, isSuccess = true) {
        messageElement.textContent = text;
        messageElement.className = `message ${isSuccess ? 'success' : 'error'}`;
    }
    
    function clearMessage() {
        messageElement.textContent = '';
        messageElement.className = 'message';
    }
    
    function loadSamplePuzzle(board) {
        // This is a sample puzzle FEN similar to the Lichess example
        // Black to move - black king on g7, white rook on b6, etc.
        const fen = 'q5k1/6r1/1R4p1/5p2/8/8/1P4K1/5R2 b - - 0 1';
        board.setPosition(fen);
        
        // Set the last move (optional)
        board.setLastMove('b7', 'b6');
        
        // Set the side to move
        board.sideToMove = 'b';
        board.updateSideToMove();
        
        // Update puzzle instruction
        document.getElementById('puzzleDescription').textContent = 'Find the best move for black.';
    }
}); 