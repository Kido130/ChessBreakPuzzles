/**
 * Main application file
 */

document.addEventListener('DOMContentLoaded', () => {
    // Initialize the chessboard
    const chessboardElement = document.getElementById('chessboard');
    const chessboard = new ChessBoard(chessboardElement);
    
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
        // Load a sample position
        loadSamplePosition(chessboard);
        showMessage("Find the best move", true);
    });
    
    // Test custom position
    // Uncomment to test with a custom position
    // setTimeout(() => {
    //     chessboard.setPosition('r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3');
    // }, 1000);
    
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
    
    function loadSamplePosition(board) {
        // A simple position with some pieces
        const fen = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3';
        board.setPosition(fen);
        document.getElementById('puzzleDescription').textContent = 'Make the best move for white.';
    }
    
    // Load a sample position on startup
    loadSamplePosition(chessboard);
    showMessage("Your turn", true);
}); 