/**
 * Chess Opening Learning System
 * Implementation of an interactive system that teaches chess openings progressively
 */

// Global Variables
let board = null;
let game = new Chess();
let currentOpening = null;
let currentVariation = null;
let currentLine = null;
let currentMoveIndex = 0;
let allOpenings = {};
let userProgress = {
    learnedMoves: {},
    completedLines: {},
    currentOpening: null,
    currentVariation: null,
    currentLine: null,
    currentMoveIndex: 0, // Added to track the exact move the user was at
    reviewMoves: [], // Moves that need to be reviewed
    reviewedMoves: {}, // Tracks which moves have been successfully reviewed
    moveCompletionCounts: {},
    moveAttempts: {} // Track all attempts, not just completions
};
let moveSound = new Audio('Sounds/Move.MP3');
let errorSound = new Audio('Sounds/Error.MP3'); // Added error sound
let colorPreference = 'both'; // Default to both colors
let currentColor = 'both';
let learnMode = 'practice';
let userMoves = [];
let movePaths = {};
let totalMovesInOpening = 0;
let currentOpeningMoves = [];
let moveChoices = [];
let moveHistory = [];
let activeHighlights = [];
let moveArrows = [];
let moveColors = {
    optionA: '#4e7ab5', // Blue
    optionB: '#b5764e'  // Orange
};
let descriptions = {}; // Store opening descriptions
let inReviewMode = false; // Whether we're reviewing previously learned moves
let movesSinceLastReview = 0; // Count new moves since last review
let currentReviewMoves = []; // Current moves being reviewed
let currentReviewIndex = 0; // Index in the review moves

// DOM Elements - Initialize after DOM is loaded
let elements = {};

// Cache for storing the current line being studied and its variations
let lineCache = {
    currentLine: null,
    variations: {}, // Stores variations of the current line
    incorrectMoves: {}, // Stores incorrect moves for each position
    lastUpdated: null
};

// Initialize the system
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM fully loaded');
    
    // Log the current file contents
    console.log('Current file contents:', {
        currentOpening,
        currentVariation,
        currentLine,
        currentMoveIndex,
        lineCache,
        userProgress
    });
    
    // Initialize DOM element references
    initializeElements();
    
    // First initialize the board
    await initializeChessboard();
    
    // Then load opening descriptions
    await loadOpeningDescriptions();
    
    // Load user progress
    loadUserProgress();
    
    // If there's a saved position, load it
    if (userProgress.currentPosition) {
        console.log('Loading saved position:', userProgress.currentPosition);
        game = new Chess();
        if (game.load(userProgress.currentPosition)) {
            // Update board position without animation
            board.position(game.fen(), false);
        } else {
            console.error('Failed to load saved position');
            game.reset();
            board.start();
        }
    }
    
    await loadOpenings();
    updateProgressDisplay();
    setupEventListeners();
    checkFirstTimeUser();
    
    // Initialize with random color scheme
    shuffleColorScheme();
});

// Initialize the chessboard
async function initializeChessboard() {
    return new Promise((resolve) => {
        game = new Chess();
        
        // Define a custom piece theme mapping
        const pieceMapping = {
            'wP': 'Chess_plt45.webp',
            'wN': 'Chess_nlt45.webp',
            'wB': 'Chess_blt45.webp',
            'wR': 'Chess_rlt45.webp',
            'wQ': 'Chess_qlt45.webp',
            'wK': 'Chess_klt45.webp',
            'bP': 'Chess_pdt45.webp',
            'bN': 'Chess_ndt45.webp',
            'bB': 'Chess_bdt45.webp',
            'bR': 'Chess_rdt45.webp',
            'bQ': 'Chess_qdt45.webp',
            'bK': 'Chess_kdt45.webp'
        };
        
        // Function to check if an image exists
        function imageExists(imageUrl) {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => resolve(true);
                img.onerror = () => {
                    // Try with default images if custom fails
                    if (imageUrl.includes('images/')) {
                        console.log('Failed to load custom piece:', imageUrl);
                        resolve(false);
                    } else {
                        resolve(true);
                    }
                };
                img.src = imageUrl;
            });
        }
        
        // Check if at least one piece image exists
        imageExists(`images/${pieceMapping['wP']}`)
            .then(exists => {
                let pieceTheme;
                
                if (exists) {
                    console.log('Custom chess pieces found, using them');
                    pieceTheme = (piece) => `images/${pieceMapping[piece]}`;
                } else {
                    console.log('Custom chess pieces not found, using default');
                    pieceTheme = 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png';
                }
                
                // If board already exists, destroy it
                if (board) {
                    board.destroy();
                }
                
                const config = {
                    draggable: true,
                    position: game.fen(),
                    onDragStart: onDragStart,
                    onDrop: onDrop,
                    onSnapEnd: onSnapEnd,
                    pieceTheme: pieceTheme,
                    animation: {
                        duration: 500,
                        concurrent: true
                    }
                };
                
                // Create new board
                board = Chessboard('board', config);
                
                // Adjust board size for responsive design
                window.addEventListener('resize', () => {
                    if (board && board.resize) {
                        board.resize();
                    }
                });
                
                // Log board state
                console.log('Board initialized with FEN:', game.fen());
                
                resolve();
            });
    });
}

// Load opening data from JSON files
async function loadOpenings() {
    try {
        console.log('Attempting to load openings');
        
        // Try different paths to find the opening files
        const possiblePaths = [
            '', // Current directory
            './', // Explicit current directory
            '../', // Parent directory
            '/' // Root directory
        ];
        
        let standardOpeningsData = null;
        let evaluatedOpeningsData = null;
        let loadedStandardPath = null;
        let loadedEvaluatedPath = null;
        let lastError = null;
        
        // Function to fetch a JSON file with error handling
        async function fetchJsonFile(basePath, filename) {
            const path = basePath + filename;
            console.log(`Trying to load from path: ${path}`);
            
            try {
                const response = await fetch(path, {
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'Cache-Control': 'no-cache'
                    }
                });
                
                if (!response.ok) {
                    console.log(`Path ${path} failed with status: ${response.status}`);
                    return null;
                }
                
                const text = await response.text();
                if (!text || !text.trim()) {
                    console.log(`Path ${path} returned empty response`);
                    return null;
                }
                
                try {
                    const data = JSON.parse(text);
                    if (data && Object.keys(data).length > 0) {
                        console.log(`Successfully loaded from ${path}`);
                        return { data, path };
                    } else {
                        console.log(`Path ${path} returned invalid JSON`);
                        return null;
                    }
                } catch (parseError) {
                    console.error(`Failed to parse JSON from ${path}:`, parseError);
                    lastError = parseError;
                    return null;
                }
            } catch (fetchError) {
                console.warn(`Error trying path ${path}:`, fetchError);
                lastError = fetchError;
                return null;
            }
        }
        
        // Try to load both opening files
        for (const basePath of possiblePaths) {
            // Try to load standard openings
            if (!standardOpeningsData) {
                const result = await fetchJsonFile(basePath, 'best_chess_openings.json');
                if (result) {
                    standardOpeningsData = result.data;
                    loadedStandardPath = result.path;
                }
            }
            
            // Try to load evaluated openings
            if (!evaluatedOpeningsData) {
                const result = await fetchJsonFile(basePath, 'evaluated_openings.json');
                if (result) {
                    evaluatedOpeningsData = result.data;
                    loadedEvaluatedPath = result.path;
                }
            }
            
            // If we've loaded both files, we can break out of the loop
            if (standardOpeningsData && evaluatedOpeningsData) {
                break;
            }
        }
        
        // Use standard openings as base
        if (standardOpeningsData && Object.keys(standardOpeningsData).length > 0) {
            console.log(`Successfully loaded ${Object.keys(standardOpeningsData).length} standard openings from ${loadedStandardPath}`);
            allOpenings = standardOpeningsData;
            
            // Add evaluations from evaluated openings if available
            if (evaluatedOpeningsData && Object.keys(evaluatedOpeningsData).length > 0) {
                console.log(`Successfully loaded ${Object.keys(evaluatedOpeningsData).length} evaluated openings from ${loadedEvaluatedPath}`);
                
                // Merge evaluations into the main openings data
                for (const openingName in evaluatedOpeningsData) {
                    if (allOpenings[openingName]) {
                        // Add evaluation to existing opening
                        allOpenings[openingName].evaluation = evaluatedOpeningsData[openingName].evaluation;
                        
                        // Add evaluations to variations if they exist
                        if (allOpenings[openingName].variations && evaluatedOpeningsData[openingName].variations) {
                            for (const variationName in evaluatedOpeningsData[openingName].variations) {
                                if (allOpenings[openingName].variations[variationName]) {
                                    allOpenings[openingName].variations[variationName].evaluation = 
                                        evaluatedOpeningsData[openingName].variations[variationName].evaluation;
                                }
                            }
                        }
                    } else {
                        // This opening only exists in evaluated_openings.json, add it to allOpenings
                        allOpenings[openingName] = evaluatedOpeningsData[openingName];
                    }
                }
            } else {
                console.warn('Evaluated openings data not found, continuing without evaluations.');
            }
            
            // Update UI after loading data
            updateProgressDisplay();
            
            // Check if user already has an opening they're studying
            if (!userProgress.currentOpening) {
                // First-time user, show selection modal
                const topOpenings = getTopOpenings(5);
                populateOpeningSelection(topOpenings, true);
                openOpeningSelectionModal();
            } else {
                // Returning user with an opening selected, load their progress directly
                loadSavedOpening();
            }
        } else {
            throw new Error(`Failed to load openings data from any path. Last error: ${lastError?.message || 'Unknown error'}`);
        }
    } catch (error) {
        console.error('Error in loadOpenings function:', error);
        
        // Show a more detailed error message
        const errorMessage = document.createElement('div');
        errorMessage.style.position = 'fixed';
        errorMessage.style.top = '20px';
        errorMessage.style.left = '50%';
        errorMessage.style.transform = 'translateX(-50%)';
        errorMessage.style.backgroundColor = 'rgba(255, 0, 0, 0.9)';
        errorMessage.style.color = 'white';
        errorMessage.style.padding = '15px 20px';
        errorMessage.style.borderRadius = '5px';
        errorMessage.style.zIndex = '2000';
        errorMessage.style.textAlign = 'center';
        errorMessage.innerHTML = `
            <strong>Error loading openings data</strong><br>
            Please try refreshing the page. If the error persists, check your internet connection.<br>
            Error details: ${error.message}
        `;
        
        document.body.appendChild(errorMessage);
        
        // Remove the error message after 5 seconds
        setTimeout(() => {
            errorMessage.style.opacity = '0';
            setTimeout(() => errorMessage.remove(), 500);
        }, 5000);
        
        // Try to continue with saved position even if openings fail to load
        if (userProgress.currentPosition) {
            console.log('Continuing with saved position despite openings load failure');
            game = new Chess();
            if (game.load(userProgress.currentPosition)) {
                board.position(game.fen(), false);
            }
        }
    }
}

// Load user progress from localStorage
function loadUserProgress() {
    const savedProgress = localStorage.getItem('chessOpeningsProgress');
    if (savedProgress) {
        try {
            userProgress = JSON.parse(savedProgress);
            
            // Ensure required properties exist in case of incomplete saved data
            userProgress.learnedMoves = userProgress.learnedMoves || {};
            userProgress.completedLines = userProgress.completedLines || {};
            userProgress.masteredOpenings = userProgress.masteredOpenings || [];
            userProgress.colorPreference = userProgress.colorPreference || 'both';
            userProgress.reviewMoves = userProgress.reviewMoves || [];
            userProgress.reviewedMoves = userProgress.reviewedMoves || {};
            userProgress.moveCompletionCounts = userProgress.moveCompletionCounts || {};
            userProgress.moveAttempts = userProgress.moveAttempts || {};
            
            // Load global state variables
            inReviewMode = userProgress.inReviewMode || false;
            currentReviewMoves = userProgress.currentReviewMoves || [];
            currentReviewIndex = userProgress.currentReviewIndex || 0;
            movesSinceLastReview = userProgress.movesSinceLastReview || 0;
            
            // Load color preference
            colorPreference = userProgress.colorPreference;
            
            // Update color preference UI
            setTimeout(() => {
                const colorOptions = document.querySelectorAll('input[name="color"]');
                colorOptions.forEach(option => {
                    if (option.value === colorPreference) {
                        option.checked = true;
                        option.closest('.color-option').classList.add('selected');
                    }
                });
            }, 100);
            
        } catch (error) {
            console.error('Error parsing saved progress:', error);
            resetUserProgress();
        }
    } else {
        resetUserProgress();
    }
}

// Reset user progress with default values
function resetUserProgress() {
    userProgress = {
        currentOpening: null,
        currentVariation: null,
        currentLine: null,
        currentMoveIndex: 0, // Added to track progress at the move level
        colorPreference: 'both',
        learnedMoves: {},
        lastVisit: new Date().toString(),
        completedLines: {},
        masteredOpenings: [],
        reviewMoves: [], // Moves that need to be reviewed
        reviewedMoves: {}, // Tracks which moves have been successfully reviewed
        moveCompletionCounts: {},
        moveAttempts: {} // Track all attempts, not just completions
    };
    saveUserProgress();
}

// Save user progress to localStorage
function saveUserProgress() {
    // Update the current progress state
    userProgress.currentOpening = currentOpening;
    userProgress.currentVariation = currentVariation;
    userProgress.currentLine = currentLine;
    userProgress.currentMoveIndex = currentMoveIndex; // Save the current move index
    userProgress.inReviewMode = inReviewMode;
    userProgress.currentReviewMoves = currentReviewMoves;
    userProgress.currentReviewIndex = currentReviewIndex;
    userProgress.movesSinceLastReview = movesSinceLastReview;
    userProgress.lastVisit = new Date().toString();
    userProgress.currentPosition = game.fen(); // Save current board position
    
    // Ensure moveCompletionCounts exists
    userProgress.moveCompletionCounts = userProgress.moveCompletionCounts || {};
    
    // Ensure moveAttempts exists
    userProgress.moveAttempts = userProgress.moveAttempts || {};
        
    localStorage.setItem('chessOpeningsProgress', JSON.stringify(userProgress));
}

// Set up event listeners
function setupEventListeners() {
    // Move choice buttons
    elements.choiceA.addEventListener('click', () => handleMoveChoice('A'));
    elements.choiceB.addEventListener('click', () => handleMoveChoice('B'));
    
    // Modal opening buttons
    elements.openingLibraryBtn.addEventListener('click', openOpeningLibraryModal);
    
    // Opening search
    elements.openingSearch.addEventListener('input', filterOpenings);
    
    // Congratulations modal buttons
    elements.learnAnotherLine.addEventListener('click', () => {
        document.getElementById('congratsModal').style.display = 'none';
        openVariationSelectionModal(currentOpening);
    });
    
    elements.learnNewOpening.addEventListener('click', () => {
        document.getElementById('congratsModal').style.display = 'none';
        openOpeningLibraryModal();
    });
    
    // Color preference radio buttons
    const colorOptions = document.querySelectorAll('input[name="color"]');
    colorOptions.forEach(option => {
        option.addEventListener('change', function() {
            colorPreference = this.value;
            userProgress.colorPreference = colorPreference;
            saveUserProgress();
            
            // Apply the selected style
            document.querySelectorAll('.color-option').forEach(opt => {
                if (opt.querySelector('input').value === colorPreference) {
                    opt.classList.add('selected');
                } else {
                    opt.classList.remove('selected');
                }
            });
        });
    });
}

// Check if this is a first-time user and show opening selection
function checkFirstTimeUser() {
    if (!userProgress.currentOpening) {
        // First time user - show top 5 popular openings
        const topOpenings = getTopOpenings(5);
        populateOpeningSelection(topOpenings, true);
        openOpeningSelectionModal();
    } else {
        // Returning user - load their current opening
        loadSavedOpening();
    }
}

// Get the top N most popular openings
function getTopOpenings(count) {
    const openings = Object.entries(allOpenings)
        .map(([name, data]) => ({ name, totalPlays: data.totalPlays }))
        .sort((a, b) => b.totalPlays - a.totalPlays)
        .slice(0, count);
    
    return openings;
}

// Load the user's saved opening state
function loadSavedOpening() {
    if (!userProgress.currentOpening || !allOpenings[userProgress.currentOpening]) {
        console.log('No saved opening found, starting fresh');
        return;
    }
    
    // Initialize the cache with the current opening's variations
    lineCache = {
        currentLine: userProgress.currentLine,
        variations: {},
        incorrectMoves: {},
        lastUpdated: new Date()
    };
    
    // Store variations of the current line
    const opening = allOpenings[userProgress.currentOpening];
    if (opening) {
        // Store main line
        lineCache.variations['Main Line'] = {
            moves: opening.moves,
            evaluation: opening.evaluation
        };
        
        // Store other variations
        if (opening.variations) {
            for (const [varName, varData] of Object.entries(opening.variations)) {
                lineCache.variations[varName] = {
                    moves: varData.moves,
                    evaluation: varData.evaluation
                };
            }
        }
    }
    
    console.log('Line cache initialized in loadSavedOpening:', lineCache);
    
    // Set the current opening and variation
    currentOpening = userProgress.currentOpening;
    currentVariation = userProgress.currentVariation;
    currentLine = userProgress.currentLine;
    
    // Update the UI to show the current opening
    elements.currentOpeningName.textContent = currentOpening;
    elements.currentVariation.textContent = currentVariation || 'Main Line';
    
    // Update the current opening display in the library modal
    if (elements.currentOpeningDisplay) {
        const displayText = currentVariation ? 
            `${currentOpening}: ${currentVariation}` : 
            `${currentOpening}: Main Line`;
        elements.currentOpeningDisplay.textContent = displayText;
    }
    
    // If we have a saved position, restore it
    if (userProgress.currentPosition) {
        game = new Chess();
        game.load(userProgress.currentPosition);
        board.position(game.fen());
        
        // Update move history and prepare next move
        updateMoveHistory();
        prepareNextMoveChoices();
    } else if (typeof userProgress.currentMoveIndex === 'number') {
        // Fallback to old method if no saved position
        startLearningSession(userProgress.currentMoveIndex);
    } else {
        startLearningSession(0);
    }
}

// Open the opening selection modal
function openOpeningSelectionModal() {
    const modal = document.getElementById('openingSelectionModal');
    modal.style.display = 'block';
    
    // Hide variation and line lists
    elements.variationList.classList.add('hidden');
    elements.lineList.classList.add('hidden');
    
    // Show opening list
    elements.openingList.classList.remove('hidden');
    
    // Populate with all openings sorted by popularity
    const allOpeningsList = Object.entries(allOpenings)
        .map(([name, data]) => ({ name, totalPlays: data.totalPlays }))
        .sort((a, b) => b.totalPlays - a.totalPlays);
    
    populateOpeningSelection(allOpeningsList);
}

// Open the opening library modal
function openOpeningLibraryModal() {
    const modal = document.getElementById('openingLibraryModal');
    modal.style.display = 'block';
    
    // Update currently studying display
    if (currentOpening) {
        const displayText = currentVariation ? 
            `${currentOpening}: ${currentVariation}` : 
            `${currentOpening}: Main Line`;
        elements.currentOpeningDisplay.textContent = displayText;
    } else {
        elements.currentOpeningDisplay.textContent = "None selected";
    }
    
    // Hide variation and line lists initially
    if (elements.libraryVariationList) {
        elements.libraryVariationList.classList.add('hidden');
    }
    if (elements.libraryLineList) {
        elements.libraryLineList.classList.add('hidden');
    }
    
    // Show opening list
    elements.libraryOpeningList.classList.remove('hidden');
    
    // Populate with all openings sorted by popularity
    const allOpeningsList = Object.entries(allOpenings)
        .map(([name, data]) => ({ name, totalPlays: data.totalPlays }))
        .sort((a, b) => b.totalPlays - a.totalPlays);
    
    populateLibraryOpenings(allOpeningsList);
}

// Populate the opening selection list
function populateOpeningSelection(openings, isFirstTime = false) {
    if (!elements.openingList) {
        console.error('Opening list element not found');
        return;
    }
    
    elements.openingList.innerHTML = '';
    
    // Filter out openings with less than 100 plays
    const filteredOpenings = openings.filter(opening => opening.totalPlays >= 100);
    
    filteredOpenings.forEach(opening => {
        if (!opening || !opening.name) return;
        
        const openingItem = document.createElement('div');
        openingItem.className = 'opening-item';
        
        // Check if opening has been started/completed
        let progressStatus = '';
        let progressClass = '';
        
        if (userProgress.completedLines && userProgress.completedLines[opening.name]) {
            const completed = Object.keys(userProgress.completedLines[opening.name]).length;
            const total = getTotalVariationCount(opening.name);
            
            if (completed >= total) {
                progressClass = 'opening-complete';
                progressStatus = `<div class="opening-progress complete">Mastered</div>`;
            } else {
                const percentComplete = Math.round((completed / total) * 100);
                progressClass = 'opening-in-progress';
                progressStatus = `<div class="opening-progress">${completed}/${total} lines (${percentComplete}%)</div>`;
            }
        } else if (userProgress.moveAttempts && userProgress.moveAttempts[opening.name]) {
            const totalAttempts = getTotalMoveAttempts(opening.name);
            progressClass = 'opening-started';
            progressStatus = `<div class="opening-progress started">${totalAttempts} moves attempted</div>`;
        } else if (userProgress.learnedMoves && userProgress.learnedMoves[opening.name]) {
            const totalMovesTried = getTotalMovesTried(opening.name);
            progressClass = 'opening-started';
            progressStatus = `<div class="opening-progress started">${totalMovesTried} moves learned</div>`;
        }
        
        openingItem.className = `opening-item ${progressClass}`;
        
        // Ensure totalPlays exists
        const plays = opening.totalPlays || 0;
        
        openingItem.innerHTML = `
            <div class="opening-name">${opening.name}</div>
            ${progressStatus}
            <div class="opening-plays">${numberWithCommas(plays)} plays</div>
        `;
        
        openingItem.addEventListener('click', () => {
            currentOpening = opening.name;
            userProgress.currentOpening = opening.name;
            saveUserProgress();
            
            elements.openingList.classList.add('hidden');
            openVariationSelectionModal(opening.name);
        });
        
        elements.openingList.appendChild(openingItem);
    });
    
    if (isFirstTime) {
        const title = document.querySelector('#openingSelectionModal h2');
        if (title) {
            title.textContent = 'Select an opening to learn';
        }
    }
}

// Get total number of moves attempted for an opening across all variations
function getTotalMoveAttempts(openingName) {
    if (!userProgress.moveAttempts || !userProgress.moveAttempts[openingName]) {
        return 0;
    }
    
    let totalAttempts = 0;
    const openingAttempts = userProgress.moveAttempts[openingName];
    
    // Sum up attempts across all variations
    for (const variation in openingAttempts) {
        // Count number of total attempts across all moves
        const movesInVariation = openingAttempts[variation];
        for (const moveKey in movesInVariation) {
            totalAttempts += movesInVariation[moveKey];
        }
    }
    
    return totalAttempts;
}

// Get recommended color for an opening
function getRecommendedColor(openingName) {
    // Common white openings
    const whiteOpenings = [
        "Ruy Lopez", "Italian Game", "Scotch Game", "Vienna Game", "King's Gambit",
        "London System", "Queen's Gambit", "English Opening", "Catalan Opening",
        "Réti Opening", "King's Indian Attack", "Colle System"
    ];

    // Common black openings
    const blackOpenings = [
        "Sicilian Defense", "French Defense", "Caro-Kann Defense", "Pirc Defense",
        "Modern Defense", "Alekhine's Defense", "Dutch Defense", "King's Indian Defense",
        "Nimzo-Indian Defense", "Queen's Indian Defense", "Grünfeld Defense",
        "Benoni Defense", "Benko Gambit", "Scandinavian Defense"
    ];

    if (whiteOpenings.some(opening => openingName.includes(opening))) {
        return "White";
    } else if (blackOpenings.some(opening => openingName.includes(opening))) {
        return "Black";
    }
    return "Both";
}

// Populate openings in the library
function populateLibraryOpenings(openings) {
    const container = elements.libraryOpeningList;
    container.innerHTML = '';
    
    openings.forEach(({ name, totalPlays }) => {
        const opening = allOpenings[name];
        if (!opening) return;
        
        const openingItem = document.createElement('div');
        openingItem.className = 'opening-item';
        
        // Add status classes
        if (userProgress.completedOpenings?.includes(name)) {
            openingItem.classList.add('opening-complete');
        } else if (userProgress.currentOpening === name) {
            openingItem.classList.add('opening-in-progress');
        } else if (userProgress.startedOpenings?.includes(name)) {
            openingItem.classList.add('opening-started');
        }
        
        // Get description for popular openings
        let description = '';
        if (totalPlays > 10000) {
            description = descriptions[name]?.mainLine || "A fundamental opening that forms the basis of many strategic concepts.";
        }
        
        // Get recommended color
        const recommendedColor = getRecommendedColor(name);
        
        openingItem.innerHTML = `
            <div class="opening-name">${name}</div>
            ${recommendedColor ? `<div class="recommended-color">Recommended for: ${recommendedColor}</div>` : ''}
            <div class="opening-plays">${numberWithCommas(totalPlays)} plays</div>
            ${description ? `<div class="opening-description">${description}</div>` : ''}
            <div class="item-actions">
                <button class="study-btn">Study This Opening</button>
            </div>
        `;
        
        // Add study button click handler
        openingItem.querySelector('.study-btn').addEventListener('click', () => {
            currentOpening = name;
            userProgress.currentOpening = currentOpening;
            saveUserProgress();
            
            // Hide opening list
            elements.libraryOpeningList.classList.add('hidden');
            
            // Open variation selection
            openLibraryVariationSelection(name);
        });
        
        container.appendChild(openingItem);
    });
}

// Add CSS for recommended color text
const style = document.createElement('style');
style.textContent = `
    .recommended-color {
        font-size: 14px;
        color: #5c8b1c;
        font-style: italic;
        margin-left: 8px;
    }
`;
document.head.appendChild(style);

// Get total number of moves tried for an opening across all variations
function getTotalMovesTried(openingName) {
    if (!userProgress.learnedMoves || !userProgress.learnedMoves[openingName]) {
        return 0;
    }
    
    let totalMoves = 0;
    const openingProgress = userProgress.learnedMoves[openingName];
    
    // Sum up moves across all variations
    for (const variation in openingProgress) {
        // learnedMoves stores an object of move keys, not an array,
        // so we need to count the number of keys
        totalMoves += Object.keys(openingProgress[variation]).length;
    }
    
    return totalMoves;
}

// Show opening details in the library
function showOpeningDetails(openingName) {
    if (!allOpenings[openingName]) return;
    
    const opening = allOpenings[openingName];
    currentOpening = openingName;
    
    document.getElementById('opening-name').textContent = openingName;
    
    // Get description for the opening
    let descriptionText = "No description available.";
    if (descriptions[openingName] && descriptions[openingName].description) {
        descriptionText = descriptions[openingName].description;
    }
    
    // Get user progress for this opening
    const totalLines = opening.variations ? Object.keys(opening.variations).length + 1 : 1;
    const completedLines = userProgress.completedLines[openingName] ? Object.keys(userProgress.completedLines[openingName]).length : 0;
    const totalMovesTried = getTotalMovesTried(openingName);
    
    // Create HTML for the details section
    let detailsHTML = `
        <div class="opening-description">${descriptionText}</div>
        <div class="opening-progress">
    `;
    
    // Add progress indicator
    if (completedLines >= totalLines) {
        detailsHTML += `<div class="progress-indicator mastered">Mastered</div>`;
    } else if (totalMovesTried > 0) {
        const percentComplete = Math.floor((completedLines / totalLines) * 100);
        detailsHTML += `
            <div class="progress-indicator in-progress">
                <div class="progress-text">In Progress: ${percentComplete}%</div>
                <div class="progress-bar-container">
                    <div class="progress-bar" style="width: ${percentComplete}%"></div>
                </div>
            </div>
        `;
    } else {
        detailsHTML += `<div class="progress-indicator not-started">Not Started</div>`;
    }
    
    detailsHTML += `</div>`;
    
    // Add variations section
    detailsHTML += `<div class="variations-section">
        <h3>Variations</h3>
        <ul class="variations-list">
            <li data-variation="" class="variation-item">Main Line</li>
    `;
    
    if (opening.variations) {
        for (const variation in opening.variations) {
            // Get description for the variation
            let variationDescription = "";
            if (descriptions[openingName] && descriptions[openingName].variations && descriptions[openingName].variations[variation]) {
                variationDescription = ` - ${descriptions[openingName].variations[variation]}`;
            }
            
            // Add completion status for this variation
            let completionStatus = "";
            if (userProgress.completedLines[openingName] && userProgress.completedLines[openingName][variation]) {
                completionStatus = " <span class='variation-complete'>✓</span>";
            } else if (userProgress.learnedMoves[openingName] && userProgress.learnedMoves[openingName][variation]) {
                completionStatus = ` <span class='variation-progress'>(${Object.keys(userProgress.learnedMoves[openingName][variation]).length} moves)</span>`;
            }
            
            detailsHTML += `<li data-variation="${variation}" class="variation-item">${variation}${variationDescription}${completionStatus}</li>`;
        }
    }
    
    detailsHTML += `</ul></div>`;
    
    // Update the details container
    document.getElementById('opening-details').innerHTML = detailsHTML;
    
    // Add event listeners for variations
    document.querySelectorAll('.variation-item').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.variation-item').forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');
            selectVariation(item.getAttribute('data-variation'));
            });
        });
    
    // Select the main line by default
    document.querySelector('.variation-item').classList.add('selected');
    selectVariation("");
    
    // Toggle view
    document.getElementById('openings-list').classList.add('hidden');
    document.getElementById('opening-details').classList.remove('hidden');
    document.getElementById('back-to-list').classList.remove('hidden');
}

// Play a preview of the opening moves
function playOpeningPreview(moves) {
    const moveList = parseMoves(moves);
    
    game = new Chess();
    board.position(game.fen());
    
    let moveIndex = 0;
    
    // Show first move immediately
    if (moveList.length > 0) {
        game.move(moveList[0]);
        board.position(game.fen(), true); // true enables animation
        moveIndex++;
    }
    
    // Show remaining moves with delay
    const previewInterval = setInterval(() => {
        if (moveIndex < moveList.length) {
            game.move(moveList[moveIndex]);
            board.position(game.fen(), true); // true enables animation
            moveIndex++;
        } else {
            clearInterval(previewInterval);
        }
    }, 800);
}

// Open the variation selection modal
function openVariationSelectionModal(openingName) {
    if (!allOpenings[openingName]) return;
    
    const opening = allOpenings[openingName];
    const modal = document.getElementById('openingSelectionModal');
    modal.style.display = 'block';
    
    // Update modal title
    const title = document.querySelector('#openingSelectionModal h2');
    title.textContent = `Select a variation of ${openingName}`;
    
    // Hide opening list and line list
    elements.openingList.classList.add('hidden');
    elements.lineList.classList.add('hidden');
    
    // Show variation list
    elements.variationList.classList.remove('hidden');
    elements.variationList.innerHTML = '';
    
    // Add the main line
    const mainLineItem = document.createElement('div');
    mainLineItem.className = 'variation-item';
    mainLineItem.innerHTML = `
        <div class="opening-name">Main Line</div>
        <div class="opening-plays">${numberWithCommas(opening.plays)} plays</div>
        <div class="opening-moves">${formatMovesForDisplay(opening.moves)}</div>
    `;
    
    mainLineItem.addEventListener('click', () => {
        currentVariation = 'Main Line';
        userProgress.currentVariation = currentVariation;
        currentLine = opening.moves;
        userProgress.currentLine = currentLine;
        saveUserProgress();
        
        // Set continue to 1 when variation is selected
        document.getElementById('continue').value = '1';
        
        modal.style.display = 'none';
        startLearningSession();
    });
    
    elements.variationList.appendChild(mainLineItem);
    
    // Add all variations
    if (opening.variations) {
        const variations = Object.entries(opening.variations)
            .map(([name, data]) => ({ name, plays: data.plays, moves: data.moves }))
            .sort((a, b) => b.plays - a.plays);
        
        variations.forEach(variation => {
            const variationItem = document.createElement('div');
            variationItem.className = 'variation-item';
            variationItem.innerHTML = `
                <div class="opening-name">${variation.name}</div>
                <div class="opening-plays">${numberWithCommas(variation.plays)} plays</div>
                <div class="opening-moves">${formatMovesForDisplay(variation.moves)}</div>
            `;
            
            variationItem.addEventListener('click', () => {
                currentVariation = variation.name;
                userProgress.currentVariation = currentVariation;
                currentLine = variation.moves;
                userProgress.currentLine = currentLine;
                saveUserProgress();
                
                // Set continue to 1 when variation is selected
                document.getElementById('continue').value = '1';
                
                modal.style.display = 'none';
                startLearningSession();
            });
            
            elements.variationList.appendChild(variationItem);
        });
    }
    
    // Add a back button
    const backButton = document.createElement('button');
    backButton.className = 'control-btn';
    backButton.textContent = '← Back to Openings';
    backButton.style.marginTop = '20px';
    backButton.addEventListener('click', () => {
        elements.variationList.classList.add('hidden');
        elements.openingList.classList.remove('hidden');
        title.textContent = 'Select an Opening to Learn';
    });
    
    elements.variationList.appendChild(backButton);
}

// Start the learning session for the current opening/variation
function startLearningSession(savedMoveIndex = 0, nextMoveOptions = null) {
    if (!currentOpening || !currentLine) {
        console.error('No opening or line selected');
        return;
    }
    
    // Reset cache when starting new session
    lineCache = {
        currentLine: currentLine,
        variations: {},
        incorrectMoves: {},
        lastUpdated: new Date()
    };
    
    // Store variations of the current line
    const opening = allOpenings[currentOpening];
    if (opening) {
        // Store main line
        lineCache.variations['Main Line'] = {
            moves: opening.moves,
            evaluation: opening.evaluation
        };
        
        // Store other variations
        if (opening.variations) {
            for (const [varName, varData] of Object.entries(opening.variations)) {
                lineCache.variations[varName] = {
                    moves: varData.moves,
                    evaluation: varData.evaluation
                };
            }
        }
    }
    
    // Log the cache after initialization
    console.log('Line cache initialized:', lineCache);
    
    // Update display
    elements.currentOpeningName.textContent = currentOpening;
    elements.currentVariation.textContent = currentVariation || 'Main Line';
    
    // Update the current opening display in the library modal
    if (elements.currentOpeningDisplay) {
        const displayText = currentVariation ? 
            `${currentOpening}: ${currentVariation}` : 
            `${currentOpening}: Main Line`;
        elements.currentOpeningDisplay.textContent = displayText;
    }
    
    // If we have a saved position in userProgress, use that
    if (userProgress.currentPosition && savedMoveIndex > 0) {
        game = new Chess();
        game.load(userProgress.currentPosition);
        board.position(game.fen());
        currentMoveIndex = savedMoveIndex;
        
        // Update move history and prepare next move
        updateMoveHistory();
        prepareNextMoveChoices();
        return;
    }
    
    // Otherwise, reset board and replay moves
    game = new Chess();
    board.position(game.fen());
    
    // If we have a saved position, restore to that move
    if (savedMoveIndex > 0) {
        const moveList = parseMoves(currentLine);
        console.log(`Restoring to saved position at move index ${savedMoveIndex}`);
        
        // Play all moves up to the saved position
        for (let i = 0; i < savedMoveIndex && i < moveList.length; i++) {
            try {
                const moveResult = game.move(moveList[i]);
                if (!moveResult) {
                    console.error(`Failed to make move ${moveList[i]} at index ${i}`);
                }
            } catch (e) {
                console.error(`Error making move ${moveList[i]} at index ${i}:`, e);
            }
        }
        
        currentMoveIndex = savedMoveIndex;
        board.position(game.fen());
        console.log(`Position restored. FEN: ${game.fen()}`);
    } else {
        currentMoveIndex = 0;
    }
    
    // Update move history
    updateMoveHistory();
    
    // If resuming from a saved position, go directly to move choices
    if (savedMoveIndex > 0) {
        prepareNextMoveChoices();
    } else {
        // Otherwise play the first few moves based on color preference
        playFirstMoves();
    }
}

// Play the first moves automatically based on color preference
function playFirstMoves() {
    const moveList = parseMoves(currentLine);
    let movesToPlay = 0; // Initialize with 0
    
    // Calculate how many initial moves to play automatically
    if (colorPreference === 'white') {
        // For white, play black's moves automatically (even indices)
        const firstWhiteMoveIndex = 0; // First white move (index 0)
        movesToPlay = Math.min(moveList.length, Math.max(1, firstWhiteMoveIndex));
    } else if (colorPreference === 'black') {
        // For black, play white's opening moves automatically (odd indices)
        const firstBlackMoveIndex = 1; // First black move (index 1)
        movesToPlay = Math.min(moveList.length, Math.max(1, firstBlackMoveIndex));
    } else {
        // For 'both' colors, play first two moves automatically
        movesToPlay = Math.min(moveList.length, 0); // Start with user's move immediately
    }
    
    // Always hide choice buttons initially
    elements.choiceA.parentElement.parentElement.style.visibility = 'hidden';
    
    // Play initial moves
    game = new Chess();
    board.position(game.fen());
    currentMoveIndex = 0;
    
    // Function to play moves with delay
    function playMoveWithDelay(index) {
        if (index < movesToPlay) {
            setTimeout(() => {
                if (index < moveList.length) {
                    // Convert move if needed and apply it
                    const move = moveList[index];
                    let result;
                    
                    if (move.length === 4 && /^[a-h][1-8][a-h][1-8]$/.test(move)) {
                        // Source-target format
                        const from = move.substring(0, 2);
                        const to = move.substring(2, 4);
                        result = game.move({from: from, to: to, promotion: 'q'});
                    } else {
                        // Standard algebraic notation
                        result = game.move(move);
                    }
                    
                    if (result) {
                        board.position(game.fen(), true); // Enable animation
                        moveSound.play();
                        currentMoveIndex = index + 1;
                        updateMoveHistory();
                        
                        // Continue with next move
                        playMoveWithDelay(index + 1);
                    }
                }
            }, 200);
        } else {
            // After playing initial moves, prepare for user interaction
            setTimeout(() => {
                prepareNextMoveChoices();
            }, 200);
        }
    }
    
    // Start playing initial moves if any
    if (movesToPlay > 0) {
    playMoveWithDelay(0);
    } else {
        // If no moves to play automatically, go straight to user choices
        prepareNextMoveChoices();
    }
}

// Function to highlight squares and draw arrows for move options
function showMoveOptionsOnBoard(correctMove, incorrectMove) {
    // Clear existing highlights and arrows
    clearMoveVisualization();
    
    // Get which button is correct
    const isACorrect = elements.choiceA.dataset.correct === 'true';
    
    // Parse moves to get source and target squares
    const correctMoveObj = parseMoveToSourceTarget(correctMove);
    const incorrectMoveObj = parseMoveToSourceTarget(incorrectMove);
    
    // Set button colors first
    elements.choiceA.style.backgroundColor = moveColors.optionA;
    elements.choiceB.style.backgroundColor = moveColors.optionB;
    
    // Set text colors based on background
    elements.choiceA.style.color = isColorDark(moveColors.optionA) ? '#ffffff' : '#222222';
    elements.choiceB.style.color = isColorDark(moveColors.optionB) ? '#ffffff' : '#222222';
    
    // Force a reflow to ensure colors are applied
    elements.choiceA.offsetHeight;
    elements.choiceB.offsetHeight;
    
    // Always use optionA color for the first move and optionB for the second move
    // regardless of which is correct
    if (correctMoveObj) {
        const squareEl = document.querySelector(`.square-${correctMoveObj.from}`);
        if (squareEl) {
            squareEl.style.boxShadow = `inset 0 0 0.3vh 0.3vh ${moveColors.optionA}`;
        }
        drawArrow(correctMoveObj.from, correctMoveObj.to, moveColors.optionA);
    }
    
    if (incorrectMoveObj) {
        const squareEl = document.querySelector(`.square-${incorrectMoveObj.from}`);
        if (squareEl) {
            squareEl.style.boxShadow = `inset 0 0 0.3vh 0.3vh ${moveColors.optionB}`;
        }
        drawArrow(incorrectMoveObj.from, incorrectMoveObj.to, moveColors.optionB);
    }
}

// Clear all move visualizations
function clearMoveVisualization() {
    // Remove all highlighted squares
    document.querySelectorAll('.highlight-green, .highlight-red').forEach(el => {
        el.classList.remove('highlight-green', 'highlight-red');
    });
    
    // Remove all arrows
    document.querySelectorAll('.move-arrow').forEach(el => {
        el.remove();
    });
}

// Draw an arrow from source to target square
function drawArrow(from, to, color) {
    const boardElement = document.getElementById('board');
    const boardRect = boardElement.getBoundingClientRect();
    const squareSize = boardRect.width / 8;
    
    // Get source and target square positions
    const fromSquareEl = document.querySelector(`.square-${from}`);
    const toSquareEl = document.querySelector(`.square-${to}`);
    
    if (!fromSquareEl || !toSquareEl) return;
    
    const fromRect = fromSquareEl.getBoundingClientRect();
    const toRect = toSquareEl.getBoundingClientRect();
    
    // Calculate center points
    const fromX = (fromRect.left + fromRect.right) / 2 - boardRect.left;
    const fromY = (fromRect.top + fromRect.bottom) / 2 - boardRect.top;
    const toX = (toRect.left + toRect.right) / 2 - boardRect.left;
    const toY = (toRect.top + toRect.bottom) / 2 - boardRect.top;
    
    // Create arrow element
    const arrowSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    arrowSvg.setAttribute("width", boardRect.width);
    arrowSvg.setAttribute("height", boardRect.height);
    arrowSvg.style.position = "absolute";
    arrowSvg.style.top = "0";
    arrowSvg.style.left = "0";
    arrowSvg.style.pointerEvents = "none";
    arrowSvg.style.zIndex = "900";
    arrowSvg.classList.add("move-arrow");
    
    // Draw arrow line
    const arrow = document.createElementNS("http://www.w3.org/2000/svg", "line");
    arrow.setAttribute("x1", fromX);
    arrow.setAttribute("y1", fromY);
    arrow.setAttribute("x2", toX);
    arrow.setAttribute("y2", toY);
    
    // Use the provided color directly
    arrow.setAttribute("stroke", color);
    arrow.setAttribute("stroke-width", "4");
    arrow.setAttribute("marker-end", `url(#arrowhead-${color})`);
    
    // Add arrow head
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
    marker.setAttribute("id", `arrowhead-${color}`);
    marker.setAttribute("markerWidth", "10");
    marker.setAttribute("markerHeight", "7");
    marker.setAttribute("refX", "7");
    marker.setAttribute("refY", "3.5");
    marker.setAttribute("orient", "auto");
    
    const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    polygon.setAttribute("points", "0 0, 10 3.5, 0 7");
    
    // Use the provided color directly
    polygon.setAttribute("fill", color);
    
    marker.appendChild(polygon);
    defs.appendChild(marker);
    arrowSvg.appendChild(defs);
    arrowSvg.appendChild(arrow);
    
    // Add pulsing animation
    const keyframes = [
        { opacity: 0.5, strokeWidth: "3px" },
        { opacity: 0.9, strokeWidth: "5px" },
        { opacity: 0.5, strokeWidth: "3px" }
    ];
    
    arrow.animate(keyframes, {
        duration: 1500,
        iterations: Infinity
    });
    
    // Add to board
    boardElement.appendChild(arrowSvg);
}

// Parse algebraic notation to source and target squares
function parseMoveToSourceTarget(move) {
    if (!move) return null;
    
    // For moves already in source-target format (e.g., "e2e4")
    if (move.length === 4 && /^[a-h][1-8][a-h][1-8]$/.test(move)) {
        return {
            from: move.substring(0, 2),
            to: move.substring(2, 4)
        };
    }
    
    // For castling
    if (move === 'O-O') {
        return game.turn() === 'w' ? 
            { from: 'e1', to: 'g1' } : 
            { from: 'e8', to: 'g8' };
    }
    if (move === 'O-O-O') {
        return game.turn() === 'w' ? 
            { from: 'e1', to: 'c1' } : 
            { from: 'e8', to: 'c8' };
    }
    
    // For standard algebraic notation (SAN)
    try {
        // Create a temporary game to test the move
        const tempGame = new Chess(game.fen());
        const moveResult = tempGame.move(move, {sloppy: true});
        
        if (moveResult) {
            return {
                from: moveResult.from,
                to: moveResult.to
            };
        }
    } catch (e) {
        console.error("Error parsing move:", e);
    }
    
    return null;
}

// Prepare the next move choices for the user
function prepareNextMoveChoices() {
    const moveList = parseMoves(currentLine);
    
    // Log the current move index and the corresponding move
    console.log('prepareNextMoveChoices - currentMoveIndex:', currentMoveIndex);
    console.log('moveList length:', moveList.length);
    console.log('Next move to present:', moveList[currentMoveIndex]);
    
    // Check if we've reached the end of the line
    if (currentMoveIndex >= moveList.length) {
        completeLine();
        return;
    }
    
    // Check if this move should be played automatically based on color preference
    const isWhiteMove = (currentMoveIndex % 2 === 0);
    
    if ((colorPreference === 'white' && !isWhiteMove) ||
        (colorPreference === 'black' && isWhiteMove)) {
        // This move should be played automatically by the computer
        playNextComputerMove();
        return;
    }
    
    // At this point, it's confirmed that it's the user's turn to make a move
    
    // Shuffle the color scheme for this move
    shuffleColorScheme();
    
    // Find all lines in all openings that match the current position
    const matchingLines = findMatchingLines();
    console.log('Found matching lines:', matchingLines);
    
    if (matchingLines.length >= 2) {
        // We have multiple matching lines - implement the new behavior
        // Take the top 2 lines by popularity
        const topLines = matchingLines.slice(0, 2);
        
        // Check if both moves are the same
        if (topLines[0].nextMove === topLines[1].nextMove) {
            // If moves are identical, find a move from the opposite side
            const oppositeMove = getIncorrectMove(topLines[0].nextMove);
     // j       
            // Compare evaluations to determine which position is worse
            if (topLines[0].evaluation < topLines[1].evaluation) {
                // First line has worse evaluation, replace it with opposite move
                elements.choiceA.textContent = formatMoveWithEval(oppositeMove);
                elements.choiceA.dataset.move = oppositeMove;
                elements.choiceA.dataset.correct = 'false';
                
                elements.choiceB.textContent = formatMoveWithEval(topLines[1].nextMove, topLines[1].evaluation);
                elements.choiceB.dataset.move = topLines[1].nextMove;
                elements.choiceB.dataset.correct = 'true';
                elements.choiceB.dataset.openingName = topLines[1].opening;
                elements.choiceB.dataset.variationName = topLines[1].variation;
            } else {
                // Second line has worse evaluation, replace it with opposite move
                elements.choiceA.textContent = formatMoveWithEval(topLines[0].nextMove, topLines[0].evaluation);
                elements.choiceA.dataset.move = topLines[0].nextMove;
                elements.choiceA.dataset.correct = 'true';
                elements.choiceA.dataset.openingName = topLines[0].opening;
                elements.choiceA.dataset.variationName = topLines[0].variation;
                
                elements.choiceB.textContent = formatMoveWithEval(oppositeMove);
                elements.choiceB.dataset.move = oppositeMove;
                elements.choiceB.dataset.correct = 'false';
            }
        } else {
            // Moves are different, use both as correct options
            elements.choiceA.textContent = formatMoveWithEval(topLines[0].nextMove, topLines[0].evaluation);
            elements.choiceA.dataset.move = topLines[0].nextMove;
            elements.choiceA.dataset.correct = 'true';
            elements.choiceA.dataset.openingName = topLines[0].opening;
            elements.choiceA.dataset.variationName = topLines[0].variation;
            
            elements.choiceB.textContent = formatMoveWithEval(topLines[1].nextMove, topLines[1].evaluation);
            elements.choiceB.dataset.move = topLines[1].nextMove;
            elements.choiceB.dataset.correct = 'true';
            elements.choiceB.dataset.openingName = topLines[1].opening;
            elements.choiceB.dataset.variationName = topLines[1].variation;
        }
        
        // Use neutral styling for both options
        elements.choiceA.classList.remove('correct', 'incorrect');
        elements.choiceB.classList.remove('correct', 'incorrect');

    } else {
        // Use original behavior if 0 or 1 lines match
        // Get the correct next move
        const correctMove = moveList[currentMoveIndex];
        
        // Check if this move has been attempted before
        const moveKey = `${game.fen()}_${correctMove}`;
        
        // Initialize tracking structures if needed
        if (!userProgress.moveAttempts) {
            userProgress.moveAttempts = {};
        }
        if (!userProgress.moveAttempts[currentOpening]) {
            userProgress.moveAttempts[currentOpening] = {};
        }
        if (!userProgress.moveAttempts[currentOpening][currentVariation || 'Main Line']) {
            userProgress.moveAttempts[currentOpening][currentVariation || 'Main Line'] = {};
        }
        
        // Get the current attempt count
        const attemptCount = userProgress.moveAttempts[currentOpening][currentVariation || 'Main Line'][moveKey] || 0;
        
        // Get the number of correct completions
        let correctCount = 0;
        if (userProgress.moveCompletionCounts && 
            userProgress.moveCompletionCounts[currentOpening] && 
            userProgress.moveCompletionCounts[currentOpening][currentVariation || 'Main Line'] && 
            userProgress.moveCompletionCounts[currentOpening][currentVariation || 'Main Line'][moveKey]) {
            correctCount = userProgress.moveCompletionCounts[currentOpening][currentVariation || 'Main Line'][moveKey];
        }
        
        // Get an incorrect move (from another opening or variation)
        const incorrectMove = getIncorrectMove(correctMove);
        
        // Randomly decide which button gets the correct move
        const correctButton = Math.random() < 0.5 ? 'A' : 'B';
        console.log('Random button selection:', correctButton, 'will contain correct move');
        
        // Set up the buttons with randomized positions
        if (correctButton === 'A') {
            // Add evaluation to the displayed move if available
            const evaluation = matchingLines.length > 0 ? matchingLines[0].evaluation : null;
            elements.choiceA.textContent = formatMoveWithEval(correctMove, evaluation);
            elements.choiceA.dataset.move = correctMove;
            elements.choiceA.dataset.correct = 'true';
            console.log('Button A set to correct move:', correctMove);
            
            elements.choiceB.textContent = formatSingleMove(incorrectMove);
            elements.choiceB.dataset.move = incorrectMove;
            elements.choiceB.dataset.correct = 'false';
            console.log('Button B set to incorrect move:', incorrectMove);
        } else {
            elements.choiceA.textContent = formatSingleMove(incorrectMove);
            elements.choiceA.dataset.move = incorrectMove;
            elements.choiceA.dataset.correct = 'false';
            console.log('Button A set to incorrect move:', incorrectMove);
            
            // Add evaluation to the displayed move if available
            const evaluation = matchingLines.length > 0 ? matchingLines[0].evaluation : null;
            elements.choiceB.textContent = formatMoveWithEval(correctMove, evaluation);
            elements.choiceB.dataset.move = correctMove;
            elements.choiceB.dataset.correct = 'true';
            console.log('Button B set to correct move:', correctMove);
        }
    }
    
    // Show the choice buttons only now that we've confirmed it's the user's turn
    elements.choiceA.parentElement.parentElement.style.visibility = 'visible';
    elements.choiceA.classList.remove('correct', 'incorrect');
    elements.choiceB.classList.remove('correct', 'incorrect');
    
    // Only draw the arrows after a short delay to ensure animations are complete
    setTimeout(() => {
        // Visualize the moves on the board
        if (elements.choiceA.dataset.move && elements.choiceB.dataset.move) {
            showMoveOptionsOnBoard(elements.choiceA.dataset.move, elements.choiceB.dataset.move);
        }
    }, 50);
}

// Handle the user's move choice
function handleMoveChoice(choice) {
    const button = choice === 'A' ? elements.choiceA : elements.choiceB;
    const otherButton = choice === 'A' ? elements.choiceB : elements.choiceA;
    const isCorrect = button.dataset.correct === 'true';
    const move = button.dataset.move;
    
    // Set continue to 1 when a move is made
    document.getElementById('continue').value = '1';
    
    // Hide choice buttons during animation
    elements.choiceA.parentElement.parentElement.style.visibility = 'hidden';
    
    // Create a key for tracking this move
    const moveKey = `${game.fen()}_${move}`;
    
    // Initialize attempt tracking structures if needed
    if (!userProgress.moveAttempts) {
        userProgress.moveAttempts = {};
    }
    if (!userProgress.moveAttempts[currentOpening]) {
        userProgress.moveAttempts[currentOpening] = {};
    }
    if (!userProgress.moveAttempts[currentOpening][currentVariation || 'Main Line']) {
        userProgress.moveAttempts[currentOpening][currentVariation || 'Main Line'] = {};
    }
    
    // Track the attempt
    userProgress.moveAttempts[currentOpening][currentVariation || 'Main Line'][moveKey] = 
        (userProgress.moveAttempts[currentOpening][currentVariation || 'Main Line'][moveKey] || 0) + 1;
    
    // Get the current attempt number 
    const attemptNumber = userProgress.moveAttempts[currentOpening][currentVariation || 'Main Line'][moveKey];
    console.log(`Move attempt #${attemptNumber} for ${moveKey} - ${isCorrect ? 'Correct' : 'Incorrect'}`);
    
    // Display attempt information
    showMessage(`Attempt #${attemptNumber} - ${isCorrect ? 'Correct!' : 'Incorrect'}`);
    
    // Check if both moves are correct (multiple lines scenario)
    const bothCorrect = (elements.choiceA.dataset.correct === 'true' && elements.choiceB.dataset.correct === 'true');
    
    // If both options are correct, switch to the chosen line
    if (bothCorrect) {
        // Get the opening and variation from the chosen button
        const newOpeningName = button.dataset.openingName;
        const newVariationName = button.dataset.variationName;
        
        // Only change the current line if we have valid opening/variation data
        if (newOpeningName && allOpenings[newOpeningName]) {
            const newOpening = allOpenings[newOpeningName];
            
            if (newVariationName === 'Main Line' && newOpening.moves) {
                // Update to the main line of the chosen opening
                currentOpening = newOpeningName;
                currentVariation = 'Main Line';
                currentLine = newOpening.moves;
                console.log(`Switched to ${currentOpening} - Main Line`);
            } else if (newOpening.variations && newOpening.variations[newVariationName] && 
                       newOpening.variations[newVariationName].moves) {
                // Update to the chosen variation
                currentOpening = newOpeningName;
                currentVariation = newVariationName;
                currentLine = newOpening.variations[newVariationName].moves;
                console.log(`Switched to ${currentOpening} - ${currentVariation}`);
            }
            
            // Save the new current line to user progress
            userProgress.currentOpening = currentOpening;
            userProgress.currentVariation = currentVariation;
            userProgress.currentLine = currentLine;
            saveUserProgress();
        }
    }
    
    // Save progress immediately to ensure attempt is recorded
    saveUserProgress();
    
    if (isCorrect) {
        // Apply the correct move
        if (move) {
            // Clear any move visualizations after a small delay
            setTimeout(() => clearMoveVisualization(), 20);
            
            game.move(move);
            board.position(game.fen(), true); // Enable animation
            moveSound.play();
            
            // Initialize tracking structures if needed
            if (!userProgress.moveCompletionCounts) {
                userProgress.moveCompletionCounts = {};
            }
            if (!userProgress.moveCompletionCounts[currentOpening]) {
                userProgress.moveCompletionCounts[currentOpening] = {};
            }
            if (!userProgress.moveCompletionCounts[currentOpening][currentVariation || 'Main Line']) {
                userProgress.moveCompletionCounts[currentOpening][currentVariation || 'Main Line'] = {};
            }
            
            // Track how many times this move has been completed correctly
            const currentCount = userProgress.moveCompletionCounts[currentOpening][currentVariation || 'Main Line'][moveKey] || 0;
            userProgress.moveCompletionCounts[currentOpening][currentVariation || 'Main Line'][moveKey] = currentCount + 1;
            
            // Update move history in UI
            currentMoveIndex++;
            updateMoveHistory();
            
            // Save progress immediately to ensure move count is stored
            saveUserProgress();
            
            // If both moves were correct (multiple lines scenario), skip the repetition
            if (bothCorrect) {
                // Proceed directly to the next move
                playNextComputerMove();
                showMessage(`Selected line: ${currentOpening} ${currentVariation || 'Main Line'}`);
            } else {
                // Check if the move has now been completed twice (including this time)
                if (userProgress.moveCompletionCounts[currentOpening][currentVariation || 'Main Line'][moveKey] >= 2) {
                    // Move has been completed at least twice, proceed to next move
                    playNextComputerMove();
                    showMessage('Great! Moving to the next move. (2/2 completions)');
                } else {
                    // First time completing this move, ask to repeat it
                    showMessage('Good! Let\'s check if you remember this move again. (1/2 completions)');
                    
                    // Store the current position details
                    const prevMoveIndex = currentMoveIndex - 1;
                    console.log('Will reset to move index:', prevMoveIndex);
                    
                    // Reset to the position before this move to repeat it
                    setTimeout(() => {
                        try {
                            // First try using undo
                            game.undo();
                            console.log('Undo successful');
                        } catch (e) {
                            console.error('Failed to undo move:', e);
                            
                            // If undo fails, rebuild the position up to the previous move
                            try {
                                // Reset and replay up to the previous position
                                game = new Chess();
                                const moveList = parseMoves(currentLine);
                                
                                for (let i = 0; i < prevMoveIndex; i++) {
                                    game.move(moveList[i]);
                                }
                                console.log('Position rebuild successful');
                            } catch (e2) {
                                console.error('Failed to rebuild position:', e2);
                            }
                        }
                        
                        // Update the board and current move index
                        board.position(game.fen(), true);
                        currentMoveIndex = prevMoveIndex;
                        updateMoveHistory();
                        
                        // Show move options again after a short delay
                        setTimeout(() => {
                            prepareNextMoveChoices();
                        }, 300);
                    }, 1000);
                }
            }
        }
    } else {
        // Incorrect move chosen
        button.classList.add('incorrect');
        otherButton.classList.add('correct');
        
        // Play error sound
        errorSound.play();
        
        // Show the error briefly, then reset
        setTimeout(() => {
            // Reset UI
            elements.choiceA.classList.remove('correct', 'incorrect');
            elements.choiceB.classList.remove('correct', 'incorrect');
            elements.choiceA.parentElement.parentElement.style.visibility = 'visible';
        }, 2000);
    }
}

// Play computer's next move with animation
function playNextComputerMove() {
    if (!currentLine) return;
    
    const moveList = parseMoves(currentLine);
    
    // Check if we're at the end of the line
    if (currentMoveIndex >= moveList.length) {
        // If at the end of the line, complete the line
        completeLine();
        return;
    }
    
    // Make sure buttons are hidden during computer's move
    elements.choiceA.parentElement.parentElement.style.visibility = 'hidden';
    
    // Clear any existing move visualizations after a small delay
    setTimeout(() => clearMoveVisualization(), 20);
    
    // Play the next move with animation
    game.move(moveList[currentMoveIndex]);
    board.position(game.fen(), true); // Enable animation
    moveSound.play();
    currentMoveIndex++;
    
    // Save progress after computer's move
    saveUserProgress();
    
    updateMoveHistory();
    
    // Wait for animation to complete before proceeding
    setTimeout(() => {
        // If we reached the end, complete the line
        if (currentMoveIndex >= moveList.length) {
            completeLine();
        } else {
            // Check if next move should be played by computer based on color preference
            prepareNextMoveChoices();
        }
    }, 600);
}

// Complete the current line
function completeLine() {
    // Reset only the lineCache when completing line
    lineCache = {
        currentLine: null,
        variations: {},
        incorrectMoves: {},
        lastUpdated: null
    };
    
    // Log the cache reset
    console.log('Line cache reset after completing line');
    
    // Hide choice buttons
    elements.choiceA.parentElement.parentElement.style.visibility = 'hidden';
    
    // Make sure userProgress.completedLines exists
    if (!userProgress.completedLines) {
        userProgress.completedLines = {};
    }
    
    // Update progress tracking
    if (!userProgress.completedLines[currentOpening]) {
        userProgress.completedLines[currentOpening] = {};
    }
    userProgress.completedLines[currentOpening][currentVariation || 'Main Line'] = true;
    
    // Check if all variations of this opening are completed
    const opening = allOpenings[currentOpening];
    if (opening) {
        const totalVariations = Object.keys(opening.variations || {}).length + 1; // +1 for main line
        const completedVariations = Object.keys(userProgress.completedLines[currentOpening]).length;
        
        // Check if all variations are completed and add to mastered openings if needed
        if (completedVariations >= totalVariations && 
            !userProgress.masteredOpenings.includes(currentOpening)) {
            if (!userProgress.masteredOpenings) {
                userProgress.masteredOpenings = [];
            }
            userProgress.masteredOpenings.push(currentOpening);
        }
    }
    
    saveUserProgress();
    updateProgressDisplay();
    
    // Show congratulations modal
    if (document.getElementById('congratsModal')) {
        document.getElementById('congratsModal').style.display = 'block';
    }
}

// Get an incorrect move for the learning options
function getIncorrectMove(correctMove) {
    // First check if we have cached incorrect moves for this position
    const positionKey = game.fen();
    console.log('Checking cache for position:', positionKey);
    
    if (lineCache.incorrectMoves[positionKey]) {
        const incorrectMoves = lineCache.incorrectMoves[positionKey];
        // Filter out the correct move
        const availableMoves = incorrectMoves.filter(move => move !== correctMove);
        if (availableMoves.length > 0) {
            console.log('Using cached incorrect move');
            return availableMoves[Math.floor(Math.random() * availableMoves.length)];
        }
    }
    
    // If no cached moves or all were used, generate new ones
    const allMoves = [];
    
    // Get moves from other variations of the current line
    for (const [varName, varData] of Object.entries(lineCache.variations)) {
        if (varName !== currentVariation) {
            const moves = parseMoves(varData.moves);
            if (moves.length > 0) {
                allMoves.push(moves[0]);
            }
        }
    }
    
    // Filter out the correct move and any illegal moves
    const legalMoves = allMoves.filter(move => {
        if (move === correctMove) return false;
        
        // Check if the move is legal in the current position
        try {
            const tempGame = new Chess(game.fen());
            const result = tempGame.move(move);
            return result !== null;
        } catch {
            return false;
        }
    });
    
    if (legalMoves.length > 0) {
        // Cache these moves for future use
        lineCache.incorrectMoves[positionKey] = legalMoves;
        console.log('Cached new incorrect moves for position:', positionKey);
        return legalMoves[Math.floor(Math.random() * legalMoves.length)];
    }
    
    // If no suitable move was found, generate a random legal move
    const legalMovesInPosition = game.moves({ verbose: true });
    if (legalMovesInPosition.length > 0) {
        const randomMove = legalMovesInPosition[Math.floor(Math.random() * legalMovesInPosition.length)];
        const move = randomMove.from + randomMove.to;
        // Cache this move
        lineCache.incorrectMoves[positionKey] = [move];
        console.log('Cached random legal move for position:', positionKey);
        return move;
    }
    
    // Fallback (shouldn't happen)
    return 'e2e4';
}

// Parse the moves string into an array of individual moves
function parseMoves(movesStr) {
    if (!movesStr) return [];
    
    // Split by spaces, removing any numbering or annotations
    const moves = movesStr.split(' ')
        .map(move => move.trim())
        .filter(move => move && !move.includes('.') && !move.startsWith('1-') && !move.startsWith('0-'));
    
    // Convert any source-target formatted moves to standard algebraic notation
    return moves.map(move => formatSingleMove(move));
}

// Format moves for display (with numbering)
function formatMovesForDisplay(movesStr) {
    if (!movesStr) return '';
    
    const moves = parseMoves(movesStr);
    let formattedMoves = '';
    
    for (let i = 0; i < moves.length; i++) {
        if (i % 2 === 0) {
            formattedMoves += `${Math.floor(i/2) + 1}. `;
        }
        formattedMoves += `${moves[i]} `;
    }
    
    return formattedMoves.trim();
}

// Format a single move for display
function formatSingleMove(move) {
    if (!move) return '';
    
    // For moves already in standard algebraic notation (e.g., "e4", "Nf3", "Qxd5")
    if (/^[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](\=[QRBN])?[+#]?$/.test(move) || 
        move === 'O-O' || move === 'O-O-O') {
        return move; // Already in proper notation
    }
    
    // For moves in source-target format (e.g., "e2e4")
    if (move.length === 4 && /^[a-h][1-8][a-h][1-8]$/.test(move)) {
        try {
            // Create temporary game at current position
            const tempGame = new Chess(game.fen());
            
            // Get source and target squares
            const from = move.substring(0, 2);
            const to = move.substring(2, 4);
            
            // Get the piece at the source square
            const piece = tempGame.get(from);
            
            // Check if this move is a capture
            const isCapture = tempGame.get(to) !== null || 
                             // Check for en passant
                             (piece && piece.type === 'p' && from[0] !== to[0] && tempGame.get(to) === null);
            
            // Convert to standard algebraic notation
            let san = '';
            
            // Add piece letter (except pawns)
            if (piece && piece.type !== 'p') {
                san += piece.type.toUpperCase() === 'N' ? 'N' : piece.type.toUpperCase();
            }
            
            // Add capture symbol if needed
            if (isCapture) {
                // For pawn captures, add the file
                if (piece && piece.type === 'p') {
                    san += from[0];
                }
                san += 'x';
            }
            
            // Add destination square
            san += to;
            
            // Make the move to check for check/checkmate
            const moveResult = tempGame.move({from, to, promotion: 'q'});
            
            // Add + for check or # for checkmate
            if (moveResult) {
                if (tempGame.in_checkmate()) {
                    san += '#';
                } else if (tempGame.in_check()) {
                    san += '+';
                }
            }
            
            return san;
        } catch (e) {
            console.error("Error formatting move:", e);
            
            // Try using chess.js's built-in move method with san output
            try {
                const tempGame = new Chess(game.fen());
                const from = move.substring(0, 2);
                const to = move.substring(2, 4);
                const result = tempGame.move({from: from, to: to, promotion: 'q'});
                if (result && result.san) {
                    return result.san;
                }
            } catch (err) {
                console.error("Second attempt error:", err);
            }
            
            return move; // Fallback to original format
        }
    }
    
    // If we can't determine the format, return as is
    return move;
}

// Update the move history display - only show moves that have been played
function updateMoveHistory() {
    if (!currentLine) return;
    
    const moveList = parseMoves(currentLine);
    let historyHtml = '';
    
    for (let i = 0; i < moveList.length; i++) {
        // Only show moves that have already been played
        if (i < currentMoveIndex) {
            if (i % 2 === 0) {
                historyHtml += `<span class="move-number">${Math.floor(i/2) + 1}.</span> `;
            }
            historyHtml += `<span class="move played">${moveList[i]}</span> `;
        }
    }
    
    elements.moveHistory.innerHTML = historyHtml;
    elements.moveHistory.scrollTop = elements.moveHistory.scrollHeight;
}

// Update the progress display
function updateProgressDisplay() {
    // Skip if elements don't exist
    if (!elements.progressBar || !elements.progressText || !elements.totalProgress) {
        console.log('Progress display elements not found - skipping progress update');
        return;
    }
    
    // Update current opening progress
    if (currentOpening && currentVariation && currentLine) {
        const moveList = parseMoves(currentLine);
        const totalMoves = moveList.length;
        
        // Ensure necessary objects and arrays exist
        if (!userProgress.learnedMoves) userProgress.learnedMoves = {};
        if (!userProgress.learnedMoves[currentOpening]) userProgress.learnedMoves[currentOpening] = {};
        
        const completedMoves = userProgress.learnedMoves[currentOpening] && 
                               userProgress.learnedMoves[currentOpening][currentVariation || 'Main Line'] ?
                               userProgress.learnedMoves[currentOpening][currentVariation || 'Main Line'].length : 0;
        
        const progressPercent = totalMoves > 0 ? Math.round((completedMoves / totalMoves) * 100) : 0;
        
        elements.progressBar.style.width = `${progressPercent}%`;
        elements.progressText.textContent = `${progressPercent}% Complete`;
    }
    
    // Update overall progress
    let totalLines = 0;
    let completedLines = 0;
    
    for (const openingName in allOpenings) {
        if (!allOpenings[openingName]) continue;
        
        // Count main line
        totalLines++;
        
        // Count all variations
        const variations = allOpenings[openingName].variations;
        if (variations) {
            totalLines += Object.keys(variations).length;
        }
        
        // Count completed lines
        if (userProgress.completedLines && userProgress.completedLines[openingName]) {
            completedLines += Object.keys(userProgress.completedLines[openingName]).length;
        }
    }
    
    const overallProgress = totalLines > 0 ? Math.round((completedLines / totalLines) * 100) : 0;
    elements.totalProgress.textContent = `${overallProgress}%`;
}

// Filter openings in the library
function filterOpenings() {
    const searchTerm = elements.openingSearch.value.toLowerCase();
    
    // Check if we're in variation view
    if (!elements.libraryVariationList.classList.contains('hidden')) {
        // We're in variation view, filter variations
        const opening = allOpenings[currentOpening];
        if (!opening) return;

        // Clear and rebuild variation list
        elements.libraryVariationList.innerHTML = '';
        
        // Add main line if it matches search
        if ('main line'.includes(searchTerm) || opening.moves.toLowerCase().includes(searchTerm)) {
            const mainLineItem = document.createElement('div');
            mainLineItem.className = 'variation-item';
            let mainLineDesc = descriptions[currentOpening]?.mainLine || "The principal line of the opening with standard piece development.";
            
            mainLineItem.innerHTML = `
                <div class="opening-name">Main Line</div>
                <div class="opening-plays">${numberWithCommas(opening.plays)} plays</div>
                <div class="opening-moves">${formatMovesForDisplay(opening.moves)}</div>
                <div class="opening-description">${mainLineDesc}</div>
                <div class="item-actions">
                    <button class="study-btn">Study This Line</button>
                </div>
            `;
            
            mainLineItem.querySelector('.study-btn').addEventListener('click', () => {
                currentVariation = 'Main Line';
                userProgress.currentVariation = currentVariation;
                currentLine = opening.moves;
                userProgress.currentLine = currentLine;
                saveUserProgress();
                
                const displayText = `${currentOpening}: Main Line`;
                elements.currentOpeningDisplay.textContent = displayText;
                
                document.getElementById('openingLibraryModal').style.display = 'none';
                startLearningSession();
            });
            
            elements.libraryVariationList.appendChild(mainLineItem);
        }
        
        // Filter and add variations
        if (opening.variations) {
            Object.entries(opening.variations).forEach(([variationName, variation]) => {
                if (variationName.toLowerCase().includes(searchTerm) || 
                    variation.moves.toLowerCase().includes(searchTerm)) {
                    
                    const variationItem = document.createElement('div');
                    variationItem.className = 'variation-item';
                    
                    let variationDesc = descriptions[currentOpening]?.variations?.[variationName] || 
                        "An alternative approach to the main line with its own strategic concepts.";
                    
                    variationItem.innerHTML = `
                        <div class="opening-name">${variationName}</div>
                        <div class="opening-plays">${numberWithCommas(variation.plays)} plays</div>
                        <div class="opening-moves">${formatMovesForDisplay(variation.moves)}</div>
                        <div class="opening-description">${variationDesc}</div>
                        <div class="item-actions">
                            <button class="study-btn">Study This Line</button>
                        </div>
                    `;
                    
                    variationItem.querySelector('.study-btn').addEventListener('click', () => {
                        currentVariation = variationName;
                        userProgress.currentVariation = currentVariation;
                        currentLine = variation.moves;
                        userProgress.currentLine = currentLine;
                        saveUserProgress();
                        
                        const displayText = `${currentOpening}: ${variationName}`;
                        elements.currentOpeningDisplay.textContent = displayText;
                        
                        document.getElementById('openingLibraryModal').style.display = 'none';
                        startLearningSession();
                    });
                    
                    elements.libraryVariationList.appendChild(variationItem);
                }
            });
        }
        return;
    }
    
    // We're in opening list view
    let openings = Object.entries(allOpenings)
        .map(([name, data]) => ({ name, totalPlays: data.totalPlays }))
        .sort((a, b) => b.totalPlays - a.totalPlays); // Always sort by popularity
    
    // Filter by search term
    if (searchTerm) {
        openings = openings.filter(opening => {
            const openingData = allOpenings[opening.name];
            // Search in opening name and moves
            if (opening.name.toLowerCase().includes(searchTerm) || 
                openingData.moves.toLowerCase().includes(searchTerm)) {
                return true;
            }
            // Search in variation names and moves
            if (openingData.variations) {
                return Object.entries(openingData.variations).some(([varName, varData]) => 
                    varName.toLowerCase().includes(searchTerm) || 
                    varData.moves.toLowerCase().includes(searchTerm)
                );
            }
            return false;
        });
    }
    
    // Update display
    populateLibraryOpenings(openings);
}

// Restart the current line
function restartCurrentLine() {
    if (!currentLine) return;
    
    startLearningSession();
}

// Chess board drag functions
function onDragStart(source, piece, position, orientation) {
    // Do not allow piece movement during learning
    return false;
}

function onDrop(source, target) {
    // Handled by the drag start prevention
    return 'snapback';
}

function onSnapEnd() {
    // Update the board position after the piece snap
    board.position(game.fen());
}

// Utility: Format number with commas
function numberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Shuffle the color scheme randomly
function shuffleColorScheme() {
    // Array of color pairs (option A color, option B color)
    const colorPairs = [
        ['#4e7ab5', '#b5764e'], // Blue/Orange
        ['#7a4eb5', '#b5b54e'], // Purple/Gold
        ['#4eb5a4', '#b54e7a'], // Teal/Pink
        ['#b54e4e', '#4eb54e'], // Red/Green
        ['#4e4eb5', '#b5a44e']  // Navy/Amber
    ];
    
    // Select a random color pair
    const randomPair = colorPairs[Math.floor(Math.random() * colorPairs.length)];
    
    // Always use the same order for consistency
    moveColors.optionA = randomPair[0];
    moveColors.optionB = randomPair[1];
    
    // Update the button colors
    if (elements.choiceA && elements.choiceB) {
        elements.choiceA.style.backgroundColor = moveColors.optionA;
        elements.choiceB.style.backgroundColor = moveColors.optionB;
        
        // Set text color based on background brightness
        elements.choiceA.style.color = isColorDark(moveColors.optionA) ? '#ffffff' : '#222222';
        elements.choiceB.style.color = isColorDark(moveColors.optionB) ? '#ffffff' : '#222222';
    }
}

// Helper to determine if a color is dark (for text contrast)
function isColorDark(hexColor) {
    const r = parseInt(hexColor.substr(1, 2), 16);
    const g = parseInt(hexColor.substr(3, 2), 16);
    const b = parseInt(hexColor.substr(5, 2), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness < 128;
}

// Add this new function to load opening descriptions
async function loadOpeningDescriptions() {
    try {
        const response = await fetch('docs/opening_descriptions.txt');
        const text = await response.text();
        const lines = text.split('\n').filter(line => line.trim());
        
        descriptions = {};
        lines.forEach(line => {
            const [opening, description] = line.split(':').map(s => s.trim());
            if (opening && description) {
                descriptions[opening] = {
                    mainLine: description
                };
            }
        });
    } catch (error) {
        console.error('Error loading opening descriptions:', error);
    }
}

// Add CSS for the setup test mode
document.addEventListener('DOMContentLoaded', () => {
    // Add CSS for setup test mode
    const style = document.createElement('style');
    style.textContent = `
        .setup-modal {
            max-width: 800px;
        }
        .setup-board {
            width: 400px;
            margin: 0 auto;
            margin-top: 20px;
            margin-bottom: 20px;
        }
        .setup-instructions {
            margin-bottom: 15px;
            padding: 10px;
            background-color: #f7f7f7;
            border-radius: 4px;
        }
        .setup-controls {
            display: flex;
            justify-content: center;
            gap: 10px;
            margin-top: 15px;
        }
        .setup-feedback {
            margin-top: 15px;
            padding: 10px;
            background-color: #f9f9f9;
            border-radius: 4px;
            min-height: 60px;
        }
        .position-differences {
            margin-top: 10px;
            text-align: left;
            font-size: 14px;
        }
        .success {
            color: green;
            font-weight: bold;
        }
        .error {
            color: red;
            font-weight: bold;
        }
    `;
    document.head.appendChild(style);
});

// Show message to the user
function showMessage(message) {
    const messageEl = document.createElement('div');
    messageEl.style.position = 'fixed';
    messageEl.style.top = '50%';
    messageEl.style.left = '50%';
    messageEl.style.transform = 'translate(-50%, -50%)';
    messageEl.style.backgroundColor = 'rgba(92, 139, 28, 0.9)';
    messageEl.style.color = 'white';
    messageEl.style.padding = '20px 30px';
    messageEl.style.borderRadius = '5px';
    messageEl.style.fontSize = '18px';
    messageEl.style.fontWeight = 'bold';
    messageEl.style.textAlign = 'center';
    messageEl.style.zIndex = '1000';
    messageEl.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
    messageEl.style.transition = 'opacity 0.5s ease';
    messageEl.innerHTML = message;
    
    document.body.appendChild(messageEl);
    
    setTimeout(() => {
        messageEl.style.opacity = '0';
        setTimeout(() => messageEl.remove(), 500);
    }, 1200);
}

// Initialize DOM elements
function initializeElements() {
    elements = {
        // Board
        board: document.getElementById('board'),
        
        // Main display elements
        currentOpeningName: document.getElementById('currentOpeningName'),
        currentVariation: document.getElementById('currentVariation'),
        moveHistory: document.getElementById('moveHistory'),
        
        // Progress elements
        progressBar: document.getElementById('progressBar'),
        progressText: document.getElementById('progressText'),
        totalProgress: document.getElementById('total-progress'),
        
        // Control buttons
        openingLibraryBtn: document.getElementById('openingLibraryBtn'),
        
        // Move choice buttons
        choiceA: document.getElementById('choiceA'),
        choiceB: document.getElementById('choiceB'),
        
        // Opening selection modal elements
        openingList: document.getElementById('openingList'),
        variationList: document.getElementById('variationList'),
        lineList: document.getElementById('lineList'),
        
        // Library modal elements
        libraryOpeningList: document.getElementById('libraryOpeningList'),
        libraryVariationList: document.getElementById('libraryVariationList'),
        libraryLineList: document.getElementById('libraryLineList'),
        currentOpeningDisplay: document.getElementById('current-opening-display'),
        
        // Search
        openingSearch: document.getElementById('openingSearch'),
        
        // Congratulations modal buttons
        learnAnotherLine: document.getElementById('learnAnotherLine'),
        learnNewOpening: document.getElementById('learnNewOpening')
    };
}

// Open the library variation selection
function openLibraryVariationSelection(openingName) {
    if (!allOpenings[openingName]) return;
    
    const opening = allOpenings[openingName];
    
    // Update modal title
    const title = document.querySelector('#openingLibraryModal h2');
    title.textContent = `Select a variation of ${openingName}`;
    
    // Show variation list
    elements.libraryVariationList.classList.remove('hidden');
    elements.libraryVariationList.innerHTML = '';
    
    // Add the main line
    const mainLineItem = document.createElement('div');
    mainLineItem.className = 'variation-item';
    
    // Get description for the main line or create a generic one
    let mainLineDesc = "The principal line of the opening with standard piece development.";
    if (descriptions[openingName] && descriptions[openingName].mainLine) {
        mainLineDesc = descriptions[openingName].mainLine;
    }
    
    mainLineItem.innerHTML = `
        <div class="opening-name">Main Line</div>
        <div class="opening-plays">${numberWithCommas(opening.plays)} plays</div>
        <div class="opening-description">${mainLineDesc}</div>
        <div class="item-actions">
            <button class="study-btn">Study This Line</button>
        </div>
    `;
    
    mainLineItem.querySelector('.study-btn').addEventListener('click', () => {
        currentVariation = 'Main Line';
        userProgress.currentVariation = currentVariation;
        currentLine = opening.moves;
        userProgress.currentLine = currentLine;
        saveUserProgress();
        
        // Update currently studying display
        const displayText = `${openingName}: Main Line`;
        elements.currentOpeningDisplay.textContent = displayText;
        
        document.getElementById('openingLibraryModal').style.display = 'none';
        startLearningSession();
    });
    
    elements.libraryVariationList.appendChild(mainLineItem);
    
    // Add all variations
    if (opening.variations) {
        Object.entries(opening.variations).forEach(([variationName, variation]) => {
            const variationItem = document.createElement('div');
            variationItem.className = 'variation-item';
            
            // Get description for the variation or create a generic one
            let variationDesc = "";
            if (descriptions[openingName] && 
                descriptions[openingName].variations && 
                descriptions[openingName].variations[variationName]) {
                variationDesc = descriptions[openingName].variations[variationName];
    } else {
                // Generate generic description
                if (variationName.includes("Attack")) {
                    variationDesc = "An aggressive approach focused on direct attacks against the opponent's position.";
                } else if (variationName.includes("Variation")) {
                    variationDesc = "An alternative approach to the main line with distinct strategic ideas.";
                } else if (variationName.includes("Defense") || variationName.includes("Defence")) {
                    variationDesc = "A solid defensive setup that addresses specific threats in this opening.";
                } else if (variationName.includes("Gambit")) {
                    variationDesc = "A line where material is sacrificed for rapid development and attacking prospects.";
                } else if (variationName.includes("System")) {
                    variationDesc = "A flexible setup that can be used against various opponent responses.";
                } else {
                    variationDesc = "An alternative approach to the main line with its own strategic concepts.";
                }
                
                // Store this description for future use
                if (!descriptions[openingName]) {
                    descriptions[openingName] = { variations: {} };
                } else if (!descriptions[openingName].variations) {
                    descriptions[openingName].variations = {};
                }
                descriptions[openingName].variations[variationName] = variationDesc;
            }
            
            variationItem.innerHTML = `
                <div class="opening-name">${variationName}</div>
                <div class="opening-plays">${numberWithCommas(variation.plays)} plays</div>
                <div class="opening-description">${variationDesc}</div>
                <div class="item-actions">
                    <button class="study-btn">Study This Line</button>
                </div>
            `;
            
            variationItem.querySelector('.study-btn').addEventListener('click', () => {
                currentVariation = variationName;
                userProgress.currentVariation = currentVariation;
                currentLine = variation.moves;
                userProgress.currentLine = currentLine;
                saveUserProgress();
                
                // Update currently studying display
                const displayText = `${openingName}: ${variationName}`;
                elements.currentOpeningDisplay.textContent = displayText;
                
                document.getElementById('openingLibraryModal').style.display = 'none';
                startLearningSession();
            });
            
            elements.libraryVariationList.appendChild(variationItem);
        });
    }
}

// Format moves for display
function formatMovesForDisplay(moves) {
    if (!moves) return '';
    const moveList = moves.split(' ');
    let formattedMoves = '';
    for (let i = 0; i < moveList.length; i++) {
        if (i % 2 === 0) {
            formattedMoves += `${Math.floor(i/2 + 1)}. `;
        }
        formattedMoves += moveList[i] + ' ';
    }
    return formattedMoves.trim();
}

// Find all lines in all openings that match the current position
function findMatchingLines() {
    if (!currentLine || !currentMoveIndex) return [];
    
    const currentMoves = parseMoves(currentLine).slice(0, currentMoveIndex);
    const results = [];
    
    // Search through all openings
    for (const openingName in allOpenings) {
        // Stop if we hit a different opening name
        if (openingName !== currentOpening) break;
        
        const opening = allOpenings[openingName];
        
        // Check main line
        if (opening.moves) {
            const movesArr = parseMoves(opening.moves);
            // Check if moves match up to current index
            if (movesArr.slice(0, currentMoveIndex).every((move, i) => move === currentMoves[i]) && 
                currentMoveIndex < movesArr.length) {
                results.push({
                    opening: openingName,
                    variation: 'Main Line',
                    nextMove: movesArr[currentMoveIndex],
                    plays: opening.plays || 0,
                    evaluation: opening.evaluation || 0
                });
            }
        }
        
        // Check variations
        if (opening.variations) {
            for (const variationName in opening.variations) {
                const variation = opening.variations[variationName];
                if (variation.moves) {
                    const movesArr = parseMoves(variation.moves);
                    // Check if moves match up to current index
                    if (movesArr.slice(0, currentMoveIndex).every((move, i) => move === currentMoves[i]) && 
                        currentMoveIndex < movesArr.length) {
                        results.push({
                            opening: openingName,
                            variation: variationName,
                            nextMove: movesArr[currentMoveIndex],
                            plays: variation.plays || 0,
                            evaluation: variation.evaluation || 0
                        });
                    }
                }
            }
        }
    }
    
    // Sort by number of plays (most popular first)
    results.sort((a, b) => b.plays - a.plays);
    
    return results;
}

// Format a move with its evaluation
function formatMoveWithEval(move, evaluation) {
    if (evaluation === undefined || evaluation === null) {
        return formatSingleMove(move);
    }
    
    // Format the evaluation to 2 decimal places
    const evalStr = evaluation.toFixed(2);
    // Use + sign for positive evaluations
    const formattedEval = evaluation > 0 ? `+${evalStr}` : evalStr;
    
    return `${formatSingleMove(move)} (${formattedEval})`;
}
