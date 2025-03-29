// Global variables
let board = null;
let game = new Chess();
let currentPuzzle = null;
let moveIndex = 0;
let userRating = 650;
let puzzlesSolved = 0;
let hintShown = false;
let hintSquare = null;
let premove = null;
let oldRating = 650;

// Add variable to track current puzzle index
let currentPuzzleIndex = 0;

// Add variable to track player's color
let playerColor = 'white';

// Add variable to track if current puzzle has been failed
let currentPuzzleFailed = false;

// Add move sound
const moveSound = new Audio('Sounds/Move.MP3');

// Add countdown variables
let countdownInterval = null;
let countdownTimeLeft = 3.0;

// Add failure indicator timer
let failureTimeout = null;

// Add to global variables at the top
let currentPuzzleRatingChange = 0;
let currentPuzzleFailures = [];  // Track all rating changes for the current puzzle
const HINT_PENALTY = 5;

// Constants
const DEFAULT_RATING = 650;
const RATING_RANGE = 200;
const SUCCESS_POINTS = 10;
const FAILURE_POINTS = 5;
const POINTS_PER_100_ELO = 1;
const MIN_RATING = 100;
const MAX_RATING = 3000;
const PUZZLE_FILE_PATH = 'puzzles.txt';
const USE_FALLBACK = false; // Set to false to try loading puzzles.txt
const COUNTDOWN_DURATION = 5.0; // 5 seconds
const FAILURE_DISPLAY_DURATION = 2000; // 2 seconds

// Update premove handling
let premoveHighlight = null;

// Add function to highlight premove
function highlightPremove(source, target) {
    // Clear any existing premove highlight
    clearPremoveHighlight();
    
    // Add highlight to source and target squares
    const sourceSquare = document.querySelector(`.square-${source}`);
    const targetSquare = document.querySelector(`.square-${target}`);
    
    if (sourceSquare && targetSquare) {
        sourceSquare.style.boxShadow = 'inset 0 0 3px 3px rgba(173, 216, 230, 0.8)';
        targetSquare.style.boxShadow = 'inset 0 0 3px 3px rgba(173, 216, 230, 0.8)';
        premoveHighlight = { source, target };
    }
}

// Add function to clear premove highlight
function clearPremoveHighlight() {
    if (premoveHighlight) {
        const { source, target } = premoveHighlight;
        const sourceSquare = document.querySelector(`.square-${source}`);
        const targetSquare = document.querySelector(`.square-${target}`);
        
        if (sourceSquare) sourceSquare.style.boxShadow = '';
        if (targetSquare) targetSquare.style.boxShadow = '';
        premoveHighlight = null;
    }
}

// Play move sound
function playMoveSound() {
    // Clone and play the sound to allow overlapping sounds
    moveSound.cloneNode(true).play().catch(error => {
        console.warn('Failed to play move sound:', error);
    });
}

// Show failure indicator
function showFailureIndicator() {
    // Clear any existing timeout
    if (failureTimeout) {
        clearTimeout(failureTimeout);
    }
    
    // Show the failure indicator
    const failureIndicator = document.getElementById('failure-indicator');
    if (failureIndicator) {
        failureIndicator.style.display = 'block';
        
        // Hide it after the specified duration
        failureTimeout = setTimeout(() => {
            failureIndicator.style.display = 'none';
        }, FAILURE_DISPLAY_DURATION);
    }
    
    // Show the next puzzle button after failure
    document.getElementById('next-puzzle').style.display = 'block';
    
    // Mark current puzzle as failed
    currentPuzzleFailed = true;
}

// Function to start the countdown timer
function startCountdown() {
    // Reset time left
    countdownTimeLeft = COUNTDOWN_DURATION;
    
    // Update display
    document.getElementById('countdown-timer').textContent = `Next puzzle in: ${countdownTimeLeft.toFixed(1)}s`;
    
    // Clear any existing interval
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }
    
    // Start countdown
    countdownInterval = setInterval(() => {
        countdownTimeLeft -= 0.1;
        
        // Update display with one decimal place
        document.getElementById('countdown-timer').textContent = `Next puzzle in: ${countdownTimeLeft.toFixed(1)}s`;
        
        // Check if countdown is complete
        if (countdownTimeLeft <= 0) {
            clearInterval(countdownInterval);
            startNewPuzzle();
        }
    }, 100);
    
    // Set up cancel button
    document.getElementById('cancel-countdown').onclick = function() {
        if (countdownInterval) {
            clearInterval(countdownInterval);
            startNewPuzzle();
        }
    };
}

// Custom piece theme mapping function
function customPieceTheme(piece) {
    // Map piece codes to image file paths
    // Image naming convention:
    // Chess_[piece][color]t45.webp
    // where [piece] is k (king), q (queen), r (rook), b (bishop), n (knight), p (pawn)
    // and [color] is l (light/white) or d (dark/black)
    // t45 indicates the piece is turned 45 degrees
    const pieceMap = {
        'wK': 'images/Chess_klt45.webp', // white king
        'wQ': 'images/Chess_qlt45.webp', // white queen
        'wR': 'images/Chess_rlt45.webp', // white rook
        'wB': 'images/Chess_blt45.webp', // white bishop
        'wN': 'images/Chess_nlt45.webp', // white knight
        'wP': 'images/Chess_plt45.webp', // white pawn
        'bK': 'images/Chess_kdt45.webp', // black king
        'bQ': 'images/Chess_qdt45.webp', // black queen
        'bR': 'images/Chess_rdt45.webp', // black rook
        'bB': 'images/Chess_bdt45.webp', // black bishop
        'bN': 'images/Chess_ndt45.webp', // black knight
        'bP': 'images/Chess_pdt45.webp'  // black pawn
    };
    return pieceMap[piece];
}

// Function to update turn indicator
function updateTurnDisplay() {
    const turnIndicator = document.getElementById('turn-indicator');
    if (!turnIndicator) return;
    
    const pieceIcon = turnIndicator.querySelector('.piece-icon');
    const textSpan = turnIndicator.querySelector('span');
    
    // If it's the player's turn, show their color, otherwise show opponent's color
    const colorToMove = game.turn() === 'w' ? 'White' : 'Black';
    
    // Set the piece icon
    pieceIcon.className = 'piece-icon';
    pieceIcon.classList.add(game.turn() === 'w' ? 'white-turn' : 'black-turn');
    
    // Set the text
    textSpan.textContent = `${colorToMove} to move`;
}

// Check if browser supports localStorage
const storageAvailable = (type) => {
    try {
        const storage = window[type];
        const x = '__storage_test__';
        storage.setItem(x, x);
        storage.removeItem(x);
        return true;
    } catch (e) {
        return false;
    }
};

// Load user data from local storage
function loadUserData() {
    if (!storageAvailable('localStorage')) {
        console.warn('Local storage is not available. Progress will not be saved.');
        return [];
    }
    
    const savedRating = localStorage.getItem('chessUserRating');
    const savedPuzzlesSolved = localStorage.getItem('chessPuzzlesSolved');
    const completedPuzzles = JSON.parse(localStorage.getItem('chessCompletedPuzzles') || '[]');
    
    if (savedRating) {
        userRating = parseInt(savedRating);
        document.getElementById('user-rating').textContent = userRating;
    }
    
    if (savedPuzzlesSolved) {
        puzzlesSolved = parseInt(savedPuzzlesSolved);
        document.getElementById('puzzles-solved').textContent = puzzlesSolved;
    }
    
    return completedPuzzles;
}

// Save user data to local storage
function saveUserData(completedPuzzles) {
    if (!storageAvailable('localStorage')) {
        return;
    }
    
    try {
        localStorage.setItem('chessUserRating', userRating.toString());
        localStorage.setItem('chessPuzzlesSolved', puzzlesSolved.toString());
        if (completedPuzzles) {
            localStorage.setItem('chessCompletedPuzzles', JSON.stringify(completedPuzzles));
        }
        
        // Broadcast storage update for multi-tab support
        window.dispatchEvent(new StorageEvent('storage', {
            key: 'chessUserRating',
            newValue: userRating.toString()
        }));
    } catch (e) {
        console.error('Error saving to localStorage:', e);
    }
}

// Reset progress (for testing or when all puzzles are completed)
function resetProgress() {
    if (confirm('Are you sure you want to reset your progress? This will erase your rating and completed puzzles.')) {
        userRating = DEFAULT_RATING;
        puzzlesSolved = 0;
        
        document.getElementById('user-rating').textContent = userRating;
        document.getElementById('puzzles-solved').textContent = puzzlesSolved;
        
        if (storageAvailable('localStorage')) {
            localStorage.removeItem('chessUserRating');
            localStorage.removeItem('chessPuzzlesSolved');
            localStorage.removeItem('chessCompletedPuzzles');
        }
        
        startNewPuzzle();
    }
}

// Load puzzles from text file
async function loadPuzzles() {
    return new Promise((resolve, reject) => {
        // If we already have loaded puzzles, return them
        if (window.puzzlesCache) {
            resolve(window.puzzlesCache);
            return;
        }
        
        // If fallback is enabled or we're in a local file context, use fallback puzzles
        if (USE_FALLBACK || window.location.protocol === 'file:') {
            if (typeof window.loadFallbackPuzzles === 'function') {
                window.puzzlesCache = window.loadFallbackPuzzles();
                console.log(`Using ${window.puzzlesCache.length} embedded puzzles`);
                resolve(window.puzzlesCache);
                return;
            }
        }
        
        // Try XMLHttpRequest approach
        const xhr = new XMLHttpRequest();
        xhr.open('GET', PUZZLE_FILE_PATH, true);
        
        xhr.onload = function() {
            if (xhr.status === 200 || xhr.status === 0) { // Status 0 is successful for local files
                try {
                    // Process the text file line by line
                    const puzzleLines = xhr.responseText.split('\n');
                    
                    // Skip any header lines (first few lines might be comments)
                    const startLine = puzzleLines.findIndex(line => 
                        !line.startsWith('//') && 
                        !line.includes('const puzzles') && 
                        line.trim() !== '');
                    
                    // Process the puzzle lines
                    window.puzzlesCache = [];
                    
                    for (let i = Math.max(0, startLine); i < puzzleLines.length; i++) {
                        const line = puzzleLines[i].trim();
                        
                        // Skip empty lines, comments, and closing brackets
                        if (!line || line.startsWith('//') || line === ']' || line === '];') {
                            continue;
                        }
                        
                        // Clean up the line (remove quotes, brackets, commas)
                        let cleanLine = line;
                        
                        // Extract content from quoted strings if present
                        if (line.includes('"')) {
                            const match = line.match(/"([^"]+)"/);
                            if (match && match[1]) {
                                cleanLine = match[1].trim();
                            }
                        }
                        
                        // Remove trailing commas
                        cleanLine = cleanLine.replace(/,$/, '');
                        
                        // Add to puzzles cache if not empty
                        if (cleanLine) {
                            window.puzzlesCache.push(cleanLine);
                        }
                    }
                    
                    console.log(`Loaded ${window.puzzlesCache.length} puzzles from text file`);
                    resolve(window.puzzlesCache);
                } catch (e) {
                    console.error('Error parsing text file:', e);
                    // Fall back to embedded puzzles
                    if (typeof window.loadFallbackPuzzles === 'function') {
                        window.puzzlesCache = window.loadFallbackPuzzles();
                        console.log(`Using ${window.puzzlesCache.length} embedded puzzles (fallback after parse error)`);
                        resolve(window.puzzlesCache);
                    } else {
                        reject(e);
                    }
                }
            } else {
                console.error(`Failed to load puzzles: ${xhr.statusText}`);
                // Fall back to embedded puzzles
                if (typeof window.loadFallbackPuzzles === 'function') {
                    window.puzzlesCache = window.loadFallbackPuzzles();
                    console.log(`Using ${window.puzzlesCache.length} embedded puzzles (fallback after HTTP error)`);
                    resolve(window.puzzlesCache);
                } else {
                    reject(new Error(`Failed to load puzzles: ${xhr.statusText}`));
                }
            }
        };
        
        xhr.onerror = function() {
            console.error('Error loading puzzles file');
            // Fall back to embedded puzzles
            if (typeof window.loadFallbackPuzzles === 'function') {
                window.puzzlesCache = window.loadFallbackPuzzles();
                console.log(`Using ${window.puzzlesCache.length} embedded puzzles (fallback after network error)`);
                resolve(window.puzzlesCache);
            } else {
                reject(new Error('Error loading puzzles file'));
            }
        };
        
        xhr.send();
    });
}

// Find a suitable puzzle sequentially or by rating
async function findPuzzle(completedPuzzles) {
    // Make sure we have the puzzles cache
    if (!window.puzzlesCache) {
        try {
            // Initialize puzzles from text file
            console.log("Attempting to load puzzles...");
            await loadPuzzles();
            console.log(`Successfully loaded ${window.puzzlesCache.length} puzzles.`);
        } catch (error) {
            console.error('Error loading puzzles:', error);
            return null;
        }
    }
    
    // If we have no puzzles, return null
    if (!window.puzzlesCache || window.puzzlesCache.length === 0) {
        console.error('No puzzles available after loading');
        return null;
    }
    
    console.log(`Finding puzzle starting from index: ${currentPuzzleIndex}/${window.puzzlesCache.length}`);
    
    // Find the 3 best puzzles that match the user's rating
    const maxAttempts = window.puzzlesCache.length;
    let attempts = 0;
    let suitablePuzzles = [];
    
    // Keep track of a fallback puzzle in case we can't find one in the right rating range
    let fallbackPuzzle = null;
    
    while (attempts < maxAttempts && suitablePuzzles.length < 3) {
        // Get a puzzle and increment the index
        const puzzle = window.puzzlesCache[currentPuzzleIndex];
        currentPuzzleIndex = (currentPuzzleIndex + 1) % window.puzzlesCache.length;
        attempts++;
        
        if (!puzzle) {
            console.error('Invalid puzzle at index:', currentPuzzleIndex - 1);
            continue;
        }
        
        // Parse the puzzle data
        try {
            const parts = puzzle.split(',');
            
            // Format is expected to be: id,fen,moves,rating,ratingDeviation,plays,themes,gameUrl
            if (parts.length < 4) {
                console.error('Invalid puzzle format:', puzzle);
                continue;
            }
            
            const puzzleId = parts[0];
            const puzzleRating = parseInt(parts[3]);
            
            // Skip if we've already solved this puzzle
            if (completedPuzzles.includes(puzzleId)) {
                continue;
            }
            
            // Save as a fallback if we don't have one yet
            if (fallbackPuzzle === null) {
                fallbackPuzzle = puzzle;
            }
            
            // Check if the puzzle rating is within range of the user's rating
            if (Math.abs(puzzleRating - userRating) <= RATING_RANGE) {
                console.log(`Found suitable puzzle: ${puzzleId}, rating: ${puzzleRating}`);
                // Add to our collection of suitable puzzles if not already added
                if (!suitablePuzzles.some(p => p.split(',')[0] === puzzleId)) {
                    suitablePuzzles.push(puzzle);
                }
            }
        } catch (e) {
            console.error('Error parsing puzzle:', puzzle, e);
            continue;
        }
    }
    
    // If we found suitable puzzles, randomly select one
    if (suitablePuzzles.length > 0) {
        const randomIndex = Math.floor(Math.random() * suitablePuzzles.length);
        console.log(`Randomly selecting puzzle ${randomIndex + 1} of ${suitablePuzzles.length} suitable puzzles`);
        return suitablePuzzles[randomIndex];
    }
    
    // If we couldn't find suitable puzzles, use the fallback or restart
    if (fallbackPuzzle) {
        console.log('Using fallback puzzle (rating out of range)');
        return fallbackPuzzle;
    }
    
    // If all puzzles have been solved, show a message and offer to reset
    if (completedPuzzles.length >= window.puzzlesCache.length) {
        console.log('All puzzles have been solved!');
        
        // Ask to reset progress
        if (confirm('Congratulations! You have solved all available puzzles. Would you like to reset your progress and start again?')) {
            // Reset completed puzzles but keep the rating
            if (storageAvailable('localStorage')) {
                localStorage.removeItem('chessCompletedPuzzles');
            }
            
            // Try again with empty completed puzzles
            return await findPuzzle([]);
        } else {
            // User doesn't want to reset, just pick a random puzzle
            const randomIndex = Math.floor(Math.random() * window.puzzlesCache.length);
            return window.puzzlesCache[randomIndex];
        }
    }
    
    // Should not reach here, but just in case
    console.error('Could not find any suitable puzzle');
    return null;
}

// Update the user's rating based on performance
function updateRating(puzzleRating, success) {
    // Clear any hint highlighting if present
    clearHint();
    
    const ratingDiff = Math.abs(puzzleRating - userRating);
    const ratingModifier = Math.floor(ratingDiff / 100) * POINTS_PER_100_ELO;
    
    // Store old rating for animation
    oldRating = userRating;
    
    // Get puzzle ID to mark as completed
    const puzzleId = currentPuzzle.split(',')[0];
    
    // Get completed puzzles list
    const completedPuzzles = JSON.parse(localStorage.getItem('chessCompletedPuzzles') || '[]');
    
    // Add to completed puzzles if not already there
    if (!completedPuzzles.includes(puzzleId)) {
        completedPuzzles.push(puzzleId);
        saveUserData(completedPuzzles);
    }
    
    let ratingChange = 0;
    if (success) {
        ratingChange = SUCCESS_POINTS + (puzzleRating > userRating ? ratingModifier : 0);
        userRating += ratingChange;
    } else {
        ratingChange = -(FAILURE_POINTS + (puzzleRating < userRating ? ratingModifier : 0));
        userRating += ratingChange;
        
        // Show the failure indicator
        showFailureIndicator();
    }
    
    // Update total rating change for this puzzle
    currentPuzzleRatingChange = ratingChange;
    
    // Enforce rating bounds
    userRating = Math.max(MIN_RATING, Math.min(MAX_RATING, userRating));
    
    // Save rating immediately
    saveUserData(completedPuzzles);
    
    // Animate rating change
    animateRating(oldRating, userRating, ratingChange);
    
    // If success, update success message to show total rating change
    if (success) {
        const successMsg = document.getElementById('success-message');
        const ratingChangeText = document.createElement('div');
        ratingChangeText.style.color = currentPuzzleRatingChange > 0 ? '#62ff00' : '#ff4444';
        ratingChangeText.style.fontSize = '2.4vh';
        ratingChangeText.style.marginTop = '1vh';
        ratingChangeText.textContent = `${currentPuzzleRatingChange > 0 ? '+' : ''}${currentPuzzleRatingChange} Rating`;
        
        // Insert before countdown timer
        const countdownTimer = document.getElementById('countdown-timer');
        successMsg.insertBefore(ratingChangeText, countdownTimer);
    }
}

// Animate rating change
function animateRating(start, end, change) {
    const duration = 1000; // 1 second animation
    const startTime = performance.now();
    const ratingElement = document.getElementById('user-rating');
    
    // Remove any existing rating change indicators
    const existingIndicators = ratingElement.querySelectorAll('.rating-change-indicator');
    existingIndicators.forEach(indicator => indicator.remove());
    
    // Create and add temporary rating change indicator
    const changeIndicator = document.createElement('span');
    changeIndicator.className = 'rating-change-indicator';
    changeIndicator.style.color = change > 0 ? '#62ff00' : '#ff4444';
    changeIndicator.style.marginLeft = '10px';
    changeIndicator.style.fontSize = '0.8em';
    changeIndicator.style.opacity = '1';
    changeIndicator.textContent = `${change > 0 ? '+' : ''}${change}`;
    ratingElement.appendChild(changeIndicator);
    
    function updateRating(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function for smooth animation
        const easeOutQuad = t => t * (2 - t);
        const easedProgress = easeOutQuad(progress);
        
        const currentValue = Math.round(start + (end - start) * easedProgress);
        ratingElement.childNodes[0].textContent = currentValue;
        
        // Fade out the change indicator
        if (progress < 1) {
            changeIndicator.style.opacity = (1 - progress).toString();
            requestAnimationFrame(updateRating);
        } else {
            // Keep the indicator visible with reduced opacity
            changeIndicator.style.opacity = '0.7';
        }
    }
    
    requestAnimationFrame(updateRating);
}

// Update showHint function
function showHint() {
    // Clear any existing hint
    clearHint();
    
    if (!currentPuzzle) return;
    
    try {
        const movesList = currentPuzzle.split(',')[2].split(' ');
        if (moveIndex >= movesList.length) return;
        
        const expectedMove = movesList[moveIndex];
        const fromSquare = expectedMove.substring(0, 2);
        
        // Apply hint penalty
        if (!hintShown) {
            const oldRating = userRating;
            userRating = Math.max(MIN_RATING, userRating - HINT_PENALTY);
            currentPuzzleRatingChange -= HINT_PENALTY;
            currentPuzzleFailures.push(-HINT_PENALTY);  // Track hint penalty
            
            // Save rating immediately
            saveUserData();
            
            // Animate the rating change
            animateRating(oldRating, userRating, -HINT_PENALTY);
        }
        
        // Highlight the piece to move
        const squareElement = document.querySelector(`.square-${fromSquare}`);
        if (squareElement) {
            squareElement.classList.add('highlight-hint');
            hintSquare = fromSquare;
            hintShown = true;
        }
    } catch (e) {
        console.error('Error showing hint:', e);
    }
}

// Clear the hint highlighting
function clearHint() {
    if (hintSquare) {
        const squareElement = document.querySelector(`.square-${hintSquare}`);
        if (squareElement) {
            squareElement.classList.remove('highlight-hint');
        }
        hintSquare = null;
        hintShown = false;
    }
}

// Display a move indicator (checkmark/x) at the target square
function showMoveIndicator(square, isCorrect) {
    // Clear any hint highlighting
    clearHint();
    
    const indicator = document.getElementById('move-indicator');
    const squareElement = document.querySelector(`.square-${square}`);
    
    if (!squareElement) {
        console.error('Square element not found:', square);
        return;
    }
    
    const rect = squareElement.getBoundingClientRect();
    const boardRect = document.getElementById('myBoard').getBoundingClientRect();
    
    // Position the indicator at the center of the square
    indicator.style.left = `${rect.left - boardRect.left + rect.width / 2}px`;
    indicator.style.top = `${rect.top - boardRect.top + rect.height / 2}px`;
    
    // Set the indicator content and color
    indicator.textContent = isCorrect ? '✓' : '✗';
    indicator.style.color = isCorrect ? '#629924' : '#c33';
    
    // Add highlighting to the square
    squareElement.classList.add(isCorrect ? 'highlight-correct' : 'highlight-wrong');
    
    // Show the indicator
    indicator.classList.add('visible');
    
    // Hide the indicator after a delay
    setTimeout(() => {
        indicator.classList.remove('visible');
        squareElement.classList.remove('highlight-correct', 'highlight-wrong');
    }, 2000);
}

// Update onDragStart function
function onDragStart(source, piece, position, orientation) {
    // Clear any existing premove when starting a new drag
    if (premove) {
        clearPremoveHighlight();
        premove = null;
    }
    
    // Allow dragging even when it's not player's turn (for premoves)
    const isPlayersTurn = (game.turn() === 'w' && piece.search(/^w/) !== -1) ||
                         (game.turn() === 'b' && piece.search(/^b/) !== -1);
    
    // If it's not player's turn, only allow dragging their own pieces for premoves
    if (!isPlayersTurn) {
        return piece.search(/^w/) !== -1 ? orientation === 'white' : orientation === 'black';
    }
    
    // Don't allow moving opponent's pieces on player's turn
    if ((game.turn() === 'w' && piece.search(/^b/) !== -1) ||
        (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
        return false;
    }
    
    // Don't allow moving pieces if the game is over
    if (game.game_over()) {
        return false;
    }
    
    return true;
}

// Update onDrop function
function onDrop(source, target) {
    try {
        // Check if it's player's turn
        const isPlayersTurn = (game.turn() === 'w' && board.orientation() === 'white') ||
                            (game.turn() === 'b' && board.orientation() === 'black');
        
        if (!isPlayersTurn) {
            // Validate premove
            const piece = game.get(source);
            if (!piece) return 'snapback';
            
            // Store premove
            premove = { source, target };
            highlightPremove(source, target);
            return 'snapback';
        }
        
        // Clear any existing premove
        if (premove) {
            clearPremoveHighlight();
            premove = null;
        }
        
        // Don't allow illegal moves
        const move = game.move({
            from: source,
            to: target,
            promotion: 'q' // Always promote to queen for simplicity
        });
        
        // If the move is illegal
        if (move === null) {
            return 'snapback';
        }
        
        // Play move sound for user move
        playMoveSound();
        
        // Update turn indicator
        updateTurnDisplay();
        
        // Get the expected move at this position in the puzzle sequence
        if (!currentPuzzle) {
            console.error('No current puzzle');
            return;
        }
        
        const movesList = currentPuzzle.split(',')[2].split(' ');
        const expectedMove = movesList[moveIndex];
        
        // Check if the player's move matches the expected move
        const expectedSource = expectedMove.substring(0, 2);
        const expectedTarget = expectedMove.substring(2, 4);
        
        const isCorrect = source === expectedSource && target === expectedTarget;
        
        // Show the indicator if the move is correct/wrong
        showMoveIndicator(target, isCorrect);
        
        if (!isCorrect) {
            // Wrong move, undo and return to the position
            setTimeout(() => {
                game.undo();
                board.position(game.fen(), true);
                updateTurnDisplay();
            }, 1000);
            
            // Update rating for failure
            const puzzleRating = parseInt(currentPuzzle.split(',')[3]);
            updateRating(puzzleRating, false);
            
            return;
        }
        
        // If the move is correct, advance to the next move in the sequence
        moveIndex++;
        
        // If there are more moves in the puzzle, make the computer response
        if (moveIndex < movesList.length) {
            // Delay the computer's move to make it more natural
            setTimeout(() => {
                try {
                    // Make the computer move
                    const computerMove = movesList[moveIndex];
                    const from = computerMove.substring(0, 2);
                    const to = computerMove.substring(2, 4);
                    
                    // Make the move on the board
                    const result = game.move({
                        from: from,
                        to: to,
                        promotion: 'q'
                    });
                    
                    if (result === null) {
                        console.error('Invalid computer move:', computerMove);
                        return;
                    }
                    
                    // Play move sound for computer move
                    playMoveSound();
                    
                    // Update the board
                    board.position(game.fen(), true);
                    
                    // Update turn indicator
                    updateTurnDisplay();
                    
                    // Show the indicator for the computer's move
                    showMoveIndicator(to, true);
                    
                    // Advance to the next move for the player
                    moveIndex++;
                    
                    // Check for premove
                    if (premove) {
                        setTimeout(() => {
                            executePremove();
                        }, 100);
                    }
                } catch (e) {
                    console.error('Error making computer move:', e);
                    alert('Error in puzzle data. Moving to next puzzle.');
                    startNewPuzzle();
                }
            }, 500);
        } else {
            // Puzzle completed successfully
            const puzzleRating = parseInt(currentPuzzle.split(',')[3]);
            updateRating(puzzleRating, true);
            puzzlesSolved++;
            document.getElementById('puzzles-solved').textContent = puzzlesSolved;
            
            // Reset the puzzle failed flag
            currentPuzzleFailed = false;
            
            // Show success message and start countdown for next puzzle
            document.getElementById('success-message').style.display = 'block';
            startCountdown();
            
            // Hide next puzzle button as we have the countdown now
            document.getElementById('next-puzzle').style.display = 'none';
            
            // Hide failure indicator if visible
            document.getElementById('failure-indicator').style.display = 'none';
        }
    } catch (e) {
        console.error('Error in onDrop function:', e);
        alert('An error occurred. Restarting with a new puzzle.');
        startNewPuzzle();
    }
}

function onSnapEnd() {
    board.position(game.fen(), true);
}

// Validate puzzle moves against chess rules
function validatePuzzleMoves(fen, moves) {
    const tempGame = new Chess(fen);
    const movesList = moves.split(' ');
    
    for (let i = 0; i < movesList.length; i++) {
        const move = movesList[i];
        const from = move.substring(0, 2);
        const to = move.substring(2, 4);
        
        const result = tempGame.move({
            from: from,
            to: to,
            promotion: 'q'
        });
        
        if (result === null) {
            return false;
        }
    }
    
    return true;
}

// Update executePremove function
function executePremove() {
    if (!premove) return false;
    
    const { source, target } = premove;
    clearPremoveHighlight();
    premove = null;
    
    // Validate the premove is still legal
    const piece = game.get(source);
    if (!piece) return false;
    
    // Try to make the premoved move
    const move = game.move({
        from: source,
        to: target,
        promotion: 'q'
    });
    
    if (move === null) {
        return false;
    }
    
    // Update board position
    board.position(game.fen(), true);
    
    // Play move sound
    playMoveSound();
    
    // Update turn indicator
    updateTurnDisplay();
    
    // Continue with move validation and puzzle logic
    const movesList = currentPuzzle.split(',')[2].split(' ');
    const expectedMove = movesList[moveIndex];
    const expectedSource = expectedMove.substring(0, 2);
    const expectedTarget = expectedMove.substring(2, 4);
    
    const isCorrect = source === expectedSource && target === expectedTarget;
    
    // Show the indicator
    showMoveIndicator(target, isCorrect);
    
    if (!isCorrect) {
        // Wrong move handling
        setTimeout(() => {
            game.undo();
            board.position(game.fen(), true);
            updateTurnDisplay();
        }, 1000);
        
        const puzzleRating = parseInt(currentPuzzle.split(',')[3]);
        updateRating(puzzleRating, false);
        return false;
    }
    
    // Handle correct move
    moveIndex++;
    
    // Check if puzzle is completed
    if (moveIndex >= movesList.length) {
        // Puzzle completed successfully
        const puzzleRating = parseInt(currentPuzzle.split(',')[3]);
        updateRating(puzzleRating, true);
        puzzlesSolved++;
        document.getElementById('puzzles-solved').textContent = puzzlesSolved;
        
        // Reset the puzzle failed flag
        currentPuzzleFailed = false;
        
        // Show success message and start countdown for next puzzle
        document.getElementById('success-message').style.display = 'block';
        startCountdown();
        
        // Hide next puzzle button as we have the countdown now
        document.getElementById('next-puzzle').style.display = 'none';
        
        // Hide failure indicator if visible
        document.getElementById('failure-indicator').style.display = 'none';
        return true;
    }
    
    // If there are more moves, make the computer's move
    if (moveIndex < movesList.length) {
        setTimeout(() => {
            try {
                // Make the computer move
                const computerMove = movesList[moveIndex];
                const from = computerMove.substring(0, 2);
                const to = computerMove.substring(2, 4);
                
                // Make the move on the board
                const result = game.move({
                    from: from,
                    to: to,
                    promotion: 'q'
                });
                
                if (result === null) {
                    console.error('Invalid computer move:', computerMove);
                    return;
                }
                
                // Play move sound for computer move
                playMoveSound();
                
                // Update the board
                board.position(game.fen(), true);
                
                // Update turn indicator
                updateTurnDisplay();
                
                // Show the indicator for the computer's move
                showMoveIndicator(to, true);
                
                // Advance to the next move for the player
                moveIndex++;
            } catch (e) {
                console.error('Error making computer move:', e);
                alert('Error in puzzle data. Moving to next puzzle.');
                startNewPuzzle();
            }
        }, 500);
    }
    
    return true;
}

// Start a new puzzle
async function startNewPuzzle() {
    // Clear any premove
    if (premove) {
        clearPremoveHighlight();
        premove = null;
    }
    
    // Reset current puzzle rating change and failures
    currentPuzzleRatingChange = 0;
    currentPuzzleFailures = [];
    
    // Clear any hint highlighting
    clearHint();
    hintShown = false;
    
    // Reset puzzle failed flag
    currentPuzzleFailed = false;
    
    // Hide failure indicator
    document.getElementById('failure-indicator').style.display = 'none';
    
    // Clear any active countdown
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
    
    // Clear any failure timeout
    if (failureTimeout) {
        clearTimeout(failureTimeout);
        failureTimeout = null;
    }
    
    // Hide success message
    document.getElementById('success-message').style.display = 'none';
    
    // Clear any rating change indicators
    const ratingElement = document.getElementById('user-rating');
    const changeIndicators = ratingElement.querySelectorAll('.rating-change-indicator');
    changeIndicators.forEach(indicator => indicator.remove());
    
    // Set loading state
    document.getElementById('puzzle-info').textContent = 'Loading puzzle...';
    document.getElementById('puzzle-id').textContent = 'Loading...';
    
    // Show loading indicator in board
    const boardContainer = document.getElementById('board-container');
    const loadingIndicator = document.createElement('div');
    loadingIndicator.id = 'loading-indicator';
    loadingIndicator.innerHTML = '<div class="spinner"></div><p>Loading puzzles...</p>';
    loadingIndicator.style.position = 'absolute';
    loadingIndicator.style.top = '0';
    loadingIndicator.style.left = '0';
    loadingIndicator.style.width = '100%';
    loadingIndicator.style.height = '100%';
    loadingIndicator.style.display = 'flex';
    loadingIndicator.style.flexDirection = 'column';
    loadingIndicator.style.justifyContent = 'center';
    loadingIndicator.style.alignItems = 'center';
    loadingIndicator.style.backgroundColor = 'rgba(46, 42, 36, 0.8)';
    loadingIndicator.style.zIndex = '1000';
    loadingIndicator.style.color = '#bababa';
    
    // Add spinner style if not already in document
    if (!document.getElementById('spinner-style')) {
        const style = document.createElement('style');
        style.id = 'spinner-style';
        style.textContent = `
            .spinner {
                border: 5px solid #484541;
                border-top: 5px solid #bababa;
                border-radius: 50%;
                width: 40px;
                height: 40px;
                animation: spin 1s linear infinite;
                margin-bottom: 10px;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }
    
    boardContainer.appendChild(loadingIndicator);
    
    try {
        // Make sure puzzles are loaded
        await loadPuzzles();
        
        // Load user data including completed puzzles
        const completedPuzzles = loadUserData();
        
        // Find a suitable puzzle
        currentPuzzle = await findPuzzle(completedPuzzles);
        
        // Remove loading indicator
        const loadingElement = document.getElementById('loading-indicator');
        if (loadingElement) {
            loadingElement.remove();
        }
        
        if (!currentPuzzle) {
            // This is now handled in findPuzzle
            return;
        }
        
        try {
            // Parse puzzle data (still using comma format for compatibility)
            const puzzleData = currentPuzzle.split(',');
            const puzzleId = puzzleData[0];
            const fen = puzzleData[1];
            const moves = puzzleData[2];
            const puzzleRating = puzzleData[3];
            
            // Validate puzzle moves
            if (!validatePuzzleMoves(fen, moves)) {
                console.error('Invalid puzzle moves:', currentPuzzle);
                // Skip to next puzzle
                startNewPuzzle();
                return;
            }
            
            // Update puzzle info in the UI
            document.getElementById('puzzle-info').textContent = `Rating: ${puzzleRating}`;
            document.getElementById('puzzle-id').textContent = `ID: ${puzzleId}`;
            
            // Reset the chess game with the new FEN
            game = new Chess(fen);
            moveIndex = 0;
            
            // Determine board orientation (player plays as the side that moves second)
            const orientation = game.turn() === 'w' ? 'black' : 'white';
            playerColor = orientation; // Set player color
            
            // Configure the chess board
            const config = {
                draggable: true,
                position: fen,
                orientation: orientation,
                onDragStart: onDragStart,
                onDrop: onDrop,
                onSnapEnd: onSnapEnd,
                pieceTheme: customPieceTheme,
                animation: {
                    duration: 500, // Increased animation duration for smoother transitions
                    concurrent: true // Allow concurrent animations
                }
            };
            
            // Create or update the board
            if (board === null) {
                board = Chessboard('myBoard', config);
                // Make board responsive
                window.addEventListener('resize', () => {
                    // Debounce resize event
                    clearTimeout(window.resizeTimer);
                    window.resizeTimer = setTimeout(() => {
                        board.resize();
                    }, 250);
                });
            } else {
                board = Chessboard('myBoard', config);
            }
            
            // Update turn indicator
            updateTurnDisplay();
            
            // Make the first computer move (always the first move in the puzzle)
            setTimeout(() => {
                const movesList = moves.split(' ');
                const firstMove = movesList[moveIndex];
                const from = firstMove.substring(0, 2);
                const to = firstMove.substring(2, 4);
                
                const result = game.move({
                    from: from,
                    to: to,
                    promotion: 'q'
                });
                
                if (result === null) {
                    console.error('Invalid first move in puzzle:', firstMove);
                    startNewPuzzle();
                    return;
                }
                
                // Play move sound for the first computer move
                playMoveSound();
                
                board.position(game.fen(), true);
                moveIndex++;
                
                // Update turn indicator after move
                updateTurnDisplay();
                
                // Hide the success message and next button
                document.getElementById('success-message').style.display = 'none';
                document.getElementById('next-puzzle').style.display = 'none';
            }, 500);
        } catch (e) {
            console.error('Error setting up puzzle:', e);
            alert('Error setting up puzzle. Trying another one.');
            currentPuzzleIndex = (currentPuzzleIndex + 1) % window.puzzlesCache.length;
            startNewPuzzle();
        }
    } catch (e) {
        console.error('Error starting new puzzle:', e);
        alert('Error loading puzzles. Please check your internet connection and try again.');
        
        // Remove loading indicator
        const loadingElement = document.getElementById('loading-indicator');
        if (loadingElement) {
            loadingElement.remove();
        }
    }
}

// Initialize the game when the page loads
$(document).ready(function() {
    // Start the first puzzle
    startNewPuzzle();
    
    // Set up the next puzzle button
    $('#next-puzzle').on('click', function() {
        startNewPuzzle();
    });
    
    // Set up the hint button
    $('#hint-button').on('click', function() {
        showHint();
    });
    
    // Initially hide the next puzzle button
    document.getElementById('next-puzzle').style.display = 'none';
});

// Handle keyboard shortcuts
$(document).keydown(function(e) {
    // Allow 'n' key to start a new puzzle
    if (e.key === 'n' || e.keyCode === 78) {
        startNewPuzzle();
    }
    
    // Allow 'h' key to show hint
    if (e.key === 'h' || e.keyCode === 72) {
        showHint();
    }
});