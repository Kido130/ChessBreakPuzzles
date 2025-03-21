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
    completedLines: {}
};
let moveSound = new Audio('Sounds/Move.MP3');
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
let isSetupMode = false; // Track if we're in setup testing mode
let newMovesLearned = 0; // Count of new moves learned since last setup test
let targetPosition = ''; // The FEN of the position the user needs to set up
let setupStartTime = null; // Track when the setup test started

// DOM Elements - Initialize after DOM is loaded
let elements = {};

// Initialize the system
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM fully loaded');
    
    // Initialize DOM element references
    elements = {
        board: document.getElementById('board'),
        currentOpeningName: document.getElementById('currentOpeningName'),
        currentVariation: document.getElementById('currentVariation'),
        moveHistory: document.getElementById('moveHistory'),
        progressBar: document.getElementById('progressBar'),
        progressText: document.getElementById('progressText'),
        choiceA: document.getElementById('choiceA'),
        choiceB: document.getElementById('choiceB'),
        playAgainBtn: document.getElementById('playAgainBtn'),
        nextMoveBtn: document.getElementById('nextMoveBtn'),
        openingSelectionBtn: document.getElementById('openingSelectionBtn'),
        openingLibraryBtn: document.getElementById('openingLibraryBtn'),
        openingList: document.getElementById('openingList'),
        variationList: document.getElementById('variationList'),
        lineList: document.getElementById('lineList'),
        libraryOpeningList: document.getElementById('libraryOpeningList'),
        openingSearch: document.getElementById('openingSearch'),
        sortByPopularity: document.getElementById('sortByPopularity'),
        sortAlphabetically: document.getElementById('sortAlphabetically'),
        totalProgress: document.getElementById('total-progress'),
        openingsMastered: document.getElementById('openings-mastered'),
        congratsModal: document.getElementById('congratsModal'),
        learnAnotherLine: document.getElementById('learnAnotherLine'),
        learnNewOpening: document.getElementById('learnNewOpening')
    };
    
    // Log if any elements weren't found
    Object.entries(elements).forEach(([key, value]) => {
        if (!value) {
            console.warn(`Element not found: ${key}`);
        }
    });
    
    // First load opening descriptions
    await loadOpeningDescriptions();
    
    initializeChessboard();
    await loadOpenings();
    loadUserProgress();
    updateProgressDisplay();
    setupEventListeners();
    checkFirstTimeUser();
    
    // Initialize with random color scheme
    shuffleColorScheme();
});

// Initialize the chessboard
function initializeChessboard() {
    game = new Chess();
    
    // Define a custom piece theme mapping
    const pieceMapping = {
        'wP': 'Chess_plt45.svg.png',
        'wN': 'Chess_nlt45.svg.png',
        'wB': 'Chess_blt45.svg.png',
        'wR': 'Chess_rlt45.svg.png',
        'wQ': 'Chess_qlt45.svg.png',
        'wK': 'Chess_klt45.svg.png',
        'bP': 'Chess_pdt45.svg.png',
        'bN': 'Chess_ndt45.svg.png',
        'bB': 'Chess_bdt45.svg.png',
        'bR': 'Chess_rdt45.svg.png',
        'bQ': 'Chess_qdt45.svg.png',
        'bK': 'Chess_kdt45.svg.png'
    };
    
    // Function to check if an image exists
    function imageExists(imageUrl) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
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
            
            const config = {
                draggable: true,
                position: 'start',
                onDragStart: onDragStart,
                onDrop: onDrop,
                onSnapEnd: onSnapEnd,
                pieceTheme: pieceTheme,
                animation: {
                    duration: 300, // Animation speed in milliseconds
                    concurrent: true // Allow concurrent animations
                }
            };
            
            board = Chessboard('board', config);
            
            // Adjust board size for responsive design
            window.addEventListener('resize', () => {
                if (board && board.resize) {
                    board.resize();
                }
            });
        });
}

// Load opening data from JSON file
async function loadOpenings() {
    try {
        console.log('Attempting to load openings from best_chess_openings.json');
        
        // Try different paths to find the file
        const possiblePaths = ['best_chess_openings.json', './best_chess_openings.json', '../best_chess_openings.json'];
        let jsonData = null;
        let loadedPath = null;
        
        for (const path of possiblePaths) {
            try {
                console.log(`Trying to load from path: ${path}`);
                const response = await fetch(path, {
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    cache: 'no-store'
                });
                
                if (response.ok) {
                    const text = await response.text();
                    if (text && text.trim()) {
                        jsonData = JSON.parse(text);
                        loadedPath = path;
                        console.log(`Successfully loaded from ${path}`);
                        break;
                    } else {
                        console.log(`Path ${path} returned empty response`);
                    }
                } else {
                    console.log(`Path ${path} failed with status: ${response.status}`);
                }
            } catch (error) {
                console.warn(`Error trying path ${path}:`, error);
            }
        }
        
        if (jsonData && Object.keys(jsonData).length > 0) {
            console.log(`Successfully loaded ${Object.keys(jsonData).length} openings from ${loadedPath}`);
            allOpenings = jsonData;
            
            // Update UI after loading data
            updateProgressDisplay();
            
            // If we're a first-time user, show the selection modal
            if (!userProgress.currentOpening) {
                const topOpenings = getTopOpenings(5);
                populateOpeningSelection(topOpenings, true);
                openOpeningSelectionModal();
            } else {
                loadSavedOpening();
            }
        } else {
            throw new Error('Failed to load openings data from any path');
        }
    } catch (error) {
        console.error('Error in loadOpenings function:', error);
        if (elements.currentOpeningName) {
            elements.currentOpeningName.textContent = 'Error loading openings: ' + error.message;
        }
        
        // Show an error alert to the user
        alert('Failed to load chess openings. Please check the console for details.');
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
        colorPreference: 'both',
        learnedMoves: {},
        lastVisit: new Date().toString(),
        completedLines: {},
        masteredOpenings: []
    };
    saveUserProgress();
}

// Save user progress to localStorage
function saveUserProgress() {
    userProgress.lastVisit = new Date().toString();
    localStorage.setItem('chessOpeningsProgress', JSON.stringify(userProgress));
}

// Set up event listeners
function setupEventListeners() {
    // Board control buttons
    elements.playAgainBtn.addEventListener('click', restartCurrentLine);
    elements.nextMoveBtn.addEventListener('click', playNextMove);
    
    // Move choice buttons
    elements.choiceA.addEventListener('click', () => handleMoveChoice('A'));
    elements.choiceB.addEventListener('click', () => handleMoveChoice('B'));
    
    // Modal opening buttons
    elements.openingSelectionBtn.addEventListener('click', openOpeningSelectionModal);
    elements.openingLibraryBtn.addEventListener('click', openOpeningLibraryModal);
    
    // Opening search and sort
    elements.openingSearch.addEventListener('input', filterOpenings);
    elements.sortByPopularity.addEventListener('click', () => sortOpenings('popularity'));
    elements.sortAlphabetically.addEventListener('click', () => sortOpenings('alphabetical'));
    
    // Congratulations modal buttons
    elements.learnAnotherLine.addEventListener('click', () => {
        document.getElementById('congratsModal').style.display = 'none';
        openVariationSelectionModal(currentOpening);
    });
    
    elements.learnNewOpening.addEventListener('click', () => {
        document.getElementById('congratsModal').style.display = 'none';
        openOpeningSelectionModal();
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
        openOpeningSelectionModal();
        return;
    }
    
    currentOpening = userProgress.currentOpening;
    
    if (userProgress.currentVariation) {
        currentVariation = userProgress.currentVariation;
    }
    
    if (userProgress.currentLine) {
        currentLine = userProgress.currentLine;
        startLearningSession();
    } else {
        openVariationSelectionModal(currentOpening);
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
    
    openings.forEach(opening => {
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
        } else if (userProgress.learnedMoves && userProgress.learnedMoves[opening.name]) {
            // Opening started but no lines completed
            const totalMovesTried = getTotalMovesTried(opening.name);
            progressClass = 'opening-started';
            progressStatus = `<div class="opening-progress started">${totalMovesTried} moves tried</div>`;
        }
        
        openingItem.className = `opening-item ${progressClass}`;
        
        // Ensure totalPlays exists
        const plays = opening.totalPlays || 0;
        
        openingItem.innerHTML = `
            <div class="opening-name">${opening.name}</div>
            <div class="opening-plays">${numberWithCommas(plays)} plays</div>
            ${progressStatus}
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
            title.textContent = 'Welcome! Select an opening to learn';
        }
    }
}

// Populate the library openings list
function populateLibraryOpenings(openings) {
    elements.libraryOpeningList.innerHTML = '';
    
    openings.forEach(opening => {
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
        } else if (userProgress.learnedMoves && userProgress.learnedMoves[opening.name]) {
            // Opening started but no lines completed
            const totalMovesTried = getTotalMovesTried(opening.name);
            progressClass = 'opening-started';
            progressStatus = `<div class="opening-progress started">${totalMovesTried} moves tried</div>`;
        }
        
        openingItem.className = `opening-item ${progressClass}`;
        openingItem.innerHTML = `
            <div class="opening-name">${opening.name}</div>
            <div class="opening-plays">${numberWithCommas(opening.totalPlays)} plays</div>
            ${progressStatus}
        `;
        
        openingItem.addEventListener('click', () => {
            // When clicked in library, show details but don't select for learning
            showOpeningDetails(opening.name);
        });
        
        elements.libraryOpeningList.appendChild(openingItem);
    });
}

// Get total number of moves tried for an opening across all variations
function getTotalMovesTried(openingName) {
    if (!userProgress.learnedMoves || !userProgress.learnedMoves[openingName]) {
        return 0;
    }
    
    let totalMoves = 0;
    const openingProgress = userProgress.learnedMoves[openingName];
    
    // Sum up moves across all variations
    for (const variation in openingProgress) {
        totalMoves += openingProgress[variation].length;
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
function startLearningSession() {
    if (!currentOpening || !currentLine) {
        console.error('No opening or line selected');
        return;
    }
    
    // Update display
    elements.currentOpeningName.textContent = currentOpening;
    elements.currentVariation.textContent = currentVariation || 'Main Line';
    
    // Reset board and game
    game = new Chess();
    board.position(game.fen());
    currentMoveIndex = 0;
    
    // Update move history
    updateMoveHistory();
    
    // Play the first few moves based on color preference
    playFirstMoves();
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
    
    // Determine which color to use for each move
    const correctColor = isACorrect ? 'optionA' : 'optionB';
    const incorrectColor = isACorrect ? 'optionB' : 'optionA';
    
    if (correctMoveObj) {
        // Only highlight source square and draw arrow
        highlightSquare(correctMoveObj.from, correctColor);
        drawArrow(correctMoveObj.from, correctMoveObj.to, correctColor);
    }
    
    if (incorrectMoveObj) {
        // Only highlight source square and draw arrow
        highlightSquare(incorrectMoveObj.from, incorrectColor);
        drawArrow(incorrectMoveObj.from, incorrectMoveObj.to, incorrectColor);
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

// Highlight a square with specified color
function highlightSquare(square, color) {
    const squareEl = document.querySelector(`.square-${square}`);
    if (squareEl) {
        squareEl.classList.add(`highlight-${color}`);
    }
}

// Draw an arrow from source to target square
function drawArrow(from, to, colorKey) {
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
    
    // Use the moveColors object for arrow color
    const arrowColor = moveColors[colorKey];
    arrow.setAttribute("stroke", arrowColor);
    arrow.setAttribute("stroke-width", "4");
    arrow.setAttribute("marker-end", `url(#arrowhead-${colorKey})`);
    
    // Add arrow head
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
    marker.setAttribute("id", `arrowhead-${colorKey}`);
    marker.setAttribute("markerWidth", "10");
    marker.setAttribute("markerHeight", "7");
    marker.setAttribute("refX", "7");
    marker.setAttribute("refY", "3.5");
    marker.setAttribute("orient", "auto");
    
    const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    polygon.setAttribute("points", "0 0, 10 3.5, 0 7");
    
    // Use the moveColors object for arrowhead color
    polygon.setAttribute("fill", arrowColor);
    
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
        playNextMove();
        return;
    }
    
    // At this point, it's confirmed that it's the user's turn to make a move
    
    // Shuffle the color scheme for this move
    shuffleColorScheme();
    
    // Get the correct next move
    const correctMove = moveList[currentMoveIndex];
    
    // Get an incorrect move (from another opening or variation)
    const incorrectMove = getIncorrectMove(correctMove);
    
    // Randomly decide which button gets the correct move
    const correctButton = Math.random() < 0.5 ? 'A' : 'B';
    
    // Set up the buttons
    if (correctButton === 'A') {
        elements.choiceA.textContent = formatSingleMove(correctMove);
        elements.choiceA.dataset.move = correctMove;
        elements.choiceA.dataset.correct = 'true';
        
        elements.choiceB.textContent = formatSingleMove(incorrectMove);
        elements.choiceB.dataset.move = incorrectMove;
        elements.choiceB.dataset.correct = 'false';
    } else {
        elements.choiceA.textContent = formatSingleMove(incorrectMove);
        elements.choiceA.dataset.move = incorrectMove;
        elements.choiceA.dataset.correct = 'false';
        
        elements.choiceB.textContent = formatSingleMove(correctMove);
        elements.choiceB.dataset.move = correctMove;
        elements.choiceB.dataset.correct = 'true';
    }
    
    // Show the choice buttons only now that we've confirmed it's the user's turn
    elements.choiceA.parentElement.parentElement.style.visibility = 'visible';
    elements.choiceA.classList.remove('correct', 'incorrect');
    elements.choiceB.classList.remove('correct', 'incorrect');
    
    // Only draw the arrows after a short delay to ensure animations are complete
    setTimeout(() => {
        // Visualize the moves on the board
        showMoveOptionsOnBoard(correctMove, incorrectMove);
    }, 50);
}

// Handle the user's move choice
function handleMoveChoice(choice) {
    const button = choice === 'A' ? elements.choiceA : elements.choiceB;
    const otherButton = choice === 'A' ? elements.choiceB : elements.choiceA;
    const isCorrect = button.dataset.correct === 'true';
    const move = button.dataset.move;
    
    // Clear move visualization immediately when a choice is made
    clearMoveVisualization();
    
    // Hide choice buttons during animation
    elements.choiceA.parentElement.parentElement.style.visibility = 'hidden';
    
    if (isCorrect) {
        // Apply the correct move
        if (move) {
            game.move(move);
            board.position(game.fen(), true); // Enable animation
            moveSound.play();
            currentMoveIndex++;
            updateMoveHistory();
        }
        
        // Use visual feedback that preserves the button's color
        button.style.boxShadow = '0 0 10px 5px rgba(255, 255, 255, 0.5)';
        button.style.transform = 'scale(1.05)';
        
        // Check if this is a new move learned
        let isNewMove = false;
        
        // Add to learned moves
        if (!userProgress.learnedMoves[currentOpening]) {
            userProgress.learnedMoves[currentOpening] = {};
        }
        if (!userProgress.learnedMoves[currentOpening][currentVariation || 'Main Line']) {
            userProgress.learnedMoves[currentOpening][currentVariation || 'Main Line'] = [];
        }
        
        const learnedMoves = userProgress.learnedMoves[currentOpening][currentVariation || 'Main Line'];
        if (!learnedMoves.includes(currentMoveIndex - 1)) {
            learnedMoves.push(currentMoveIndex - 1);
            isNewMove = true;
            newMovesLearned++;
        }
        saveUserProgress();
        
        // Update progress
        updateProgressDisplay();
        
        // Wait for user's move animation to complete before making computer's move
        setTimeout(() => {
            // Reset the button styling
            button.style.boxShadow = '';
            button.style.transform = '';
            
            // Now prepare and play the computer's move with animation
            playNextComputerMove(isNewMove);
        }, 300); // Reduced from 400ms to 300ms
    } else {
        // Store the current position before applying the incorrect move
        const currentPosition = game.fen();
        const correctMove = otherButton.dataset.move; // Store correct move for later
        
        // Apply the incorrect move and show it briefly
        if (move) {
            try {
                // Try to make the move - it might be illegal
                const moveResult = game.move(move);
                
                if (moveResult) {
                    // If the move was successfully applied
                    board.position(game.fen(), true); // Enable animation
                    moveSound.play();
                    
                    // Use visual feedback that preserves the button's color
                    button.style.boxShadow = '0 0 10px 5px rgba(0, 0, 0, 0.5)';
                    button.style.transform = 'scale(0.95)';
                    
                    // Highlight the correct choice
                    otherButton.style.boxShadow = '0 0 10px 5px rgba(255, 255, 255, 0.5)';
                    otherButton.style.transform = 'scale(1.05)';
                    
                    // Wait 500ms, then revert the move with animation
                    setTimeout(() => {
                        // Reset to the stored position instead of just undoing the move
                        game.load(currentPosition);
                        board.position(game.fen(), true); // Enable animation for reverting
                        
                        // Reset the button styling
                        setTimeout(() => {
                            button.style.boxShadow = '';
                            button.style.transform = '';
                            otherButton.style.boxShadow = '';
                            otherButton.style.transform = '';
                            
                            // Show choice buttons again after animation
                            resetMoveOptions(correctMove);
                        }, 200); // Animation delay
                    }, 500); // How long to show the incorrect move
                } else {
                    // The move was illegal
                    handleInvalidMove(correctMove);
                }
            } catch (error) {
                console.error("Error applying incorrect move:", error);
                handleInvalidMove(correctMove);
            }
        } else {
            handleInvalidMove(correctMove);
        }
        
        // Helper function to handle invalid moves
        function handleInvalidMove(correctMove) {
            // Just provide visual feedback without changing the board
            button.style.boxShadow = '0 0 10px 5px rgba(0, 0, 0, 0.5)';
            button.style.transform = 'scale(0.95)';
            otherButton.style.boxShadow = '0 0 10px 5px rgba(255, 255, 255, 0.5)';
            otherButton.style.transform = 'scale(1.05)';
            
            setTimeout(() => {
                button.style.boxShadow = '';
                button.style.transform = '';
                otherButton.style.boxShadow = '';
                otherButton.style.transform = '';
                
                // Show choice buttons again
                resetMoveOptions(correctMove);
            }, 300);
        }
        
        // Helper function to reset move options with the correct move
        function resetMoveOptions(correctMove) {
            const moveList = parseMoves(currentLine);
            const incorrectMove = getIncorrectMove(correctMove);
            
            // Shuffle colors for new attempt
            shuffleColorScheme();
            
            // Randomly decide which button gets the correct move
            const correctButton = Math.random() < 0.5 ? 'A' : 'B';
            
            // Re-setup the buttons with proper assignments
            if (correctButton === 'A') {
                elements.choiceA.textContent = formatSingleMove(correctMove);
                elements.choiceA.dataset.move = correctMove;
                elements.choiceA.dataset.correct = 'true';
                
                elements.choiceB.textContent = formatSingleMove(incorrectMove);
                elements.choiceB.dataset.move = incorrectMove;
                elements.choiceB.dataset.correct = 'false';
            } else {
                elements.choiceA.textContent = formatSingleMove(incorrectMove);
                elements.choiceA.dataset.move = incorrectMove;
                elements.choiceA.dataset.correct = 'false';
                
                elements.choiceB.textContent = formatSingleMove(correctMove);
                elements.choiceB.dataset.move = correctMove;
                elements.choiceB.dataset.correct = 'true';
            }
            
            // Make buttons visible again
            elements.choiceA.parentElement.parentElement.style.visibility = 'visible';
            
            // Show move options after a slight delay
            setTimeout(() => {
                showMoveOptionsOnBoard(correctMove, incorrectMove);
            }, 50);
        }
    }
}

// Play computer's next move with animation
function playNextComputerMove(wasNewUserMove = false) {
    if (!currentLine) return;
    
    const moveList = parseMoves(currentLine);
    
    // Check if we're at the end of the line
    if (currentMoveIndex >= moveList.length) {
        // If at the end of the line, show setup test
        startSetupTest();
        return;
    }
    
    // Make sure buttons are hidden during computer's move
    elements.choiceA.parentElement.parentElement.style.visibility = 'hidden';
    
    // Clear any existing move visualizations
    clearMoveVisualization();
    
    // Play the next move with animation
    game.move(moveList[currentMoveIndex]);
    board.position(game.fen(), true); // Enable animation
    moveSound.play();
    currentMoveIndex++;
    updateMoveHistory();
    
    // Check if this was a computer move following a new user move
    // and if we've learned 2 new moves (user move + computer move)
    if (wasNewUserMove && (newMovesLearned % 2 === 0) && newMovesLearned > 0) {
        // After animation completes, start setup test
        setTimeout(() => {
            startSetupTest();
        }, 500);
    } else {
        // Wait for animation to complete before proceeding
        setTimeout(() => {
            // If we reached the end, complete the line
            if (currentMoveIndex >= moveList.length) {
                startSetupTest(); // Always test at end of line
            } else {
                // Check if next move should be played by computer based on color preference
                prepareNextMoveChoices();
            }
        }, 200); // Wait for animation to complete
    }
}

// Start the setup test mode
function startSetupTest() {
    // Save the current position as the target
    targetPosition = game.fen();
    
    // Create a new modal for the setup test
    const setupModal = document.createElement('div');
    setupModal.id = 'setupTestModal';
    setupModal.className = 'modal';
    setupModal.style.display = 'block';
    
    setupModal.innerHTML = `
        <div class="modal-content setup-modal">
            <h2>Position Setup Test</h2>
            <p>Set up the board from the starting position to reach the current position.</p>
            <div class="setup-instructions">
                <p>Drag pieces to set up the position as you remember it.</p>
                <p>This tests your knowledge of the ${currentOpening} opening.</p>
            </div>
            <div id="setupBoard" class="setup-board"></div>
            <div class="setup-controls">
                <button id="checkSetupBtn" class="control-btn">Check Position</button>
                <button id="resetSetupBtn" class="control-btn">Reset to Start</button>
                <button id="skipSetupBtn" class="control-btn">Skip Test</button>
            </div>
            <div id="setupFeedback" class="setup-feedback"></div>
        </div>
    `;
    
    // Add the modal to the document
    document.body.appendChild(setupModal);
    
    // Create a new board for the setup test
    const setupConfig = {
        draggable: true,
        position: 'start',
        pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png',
        sparePieces: true // Enable spare pieces for setup
    };
    
    // Initialize the setup board after a short delay to ensure DOM is ready
    setTimeout(() => {
        const setupBoard = Chessboard('setupBoard', setupConfig);
        
        // Add event listeners for setup controls
        document.getElementById('checkSetupBtn').addEventListener('click', () => {
            checkSetupPosition(setupBoard);
        });
        
        document.getElementById('resetSetupBtn').addEventListener('click', () => {
            setupBoard.position('start');
        });
        
        document.getElementById('skipSetupBtn').addEventListener('click', () => {
            completeSetupTest(false);
        });
        
        // Start timing
        setupStartTime = new Date();
    }, 100);
    
    // Enter setup mode
    isSetupMode = true;
}

// Check if the setup position matches the target position
function checkSetupPosition(setupBoard) {
    const setupFeedback = document.getElementById('setupFeedback');
    
    // Get the current position from the setup board
    const setupPosition = setupBoard.position();
    
    // Create a new chess instance for validation
    const setupGame = new Chess();
    setupGame.load('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'); // Start position
    
    // Convert setup position to FEN
    try {
        // Clear the board first
        setupGame.clear();
        
        // Place all pieces from the setup position
        for (const square in setupPosition) {
            const piece = setupPosition[square];
            const color = piece.charAt(0) === 'w' ? 'w' : 'b';
            const pieceType = piece.charAt(1).toLowerCase();
            setupGame.put({ type: pieceType, color: color }, square);
        }
        
        // Get FEN of the setup position (ignore castling rights and en passant for comparison)
        const setupFen = setupGame.fen().split(' ')[0]; // Just compare piece positions
        const targetFen = targetPosition.split(' ')[0];
        
        if (setupFen === targetFen) {
            // Success!
            setupFeedback.innerHTML = '<div class="success">Correct! Well done!</div>';
            setupFeedback.style.color = 'green';
            
            // Calculate the time taken
            const setupEndTime = new Date();
            const timeInSeconds = Math.floor((setupEndTime - setupStartTime) / 1000);
            
            // Update feedback with timing
            setupFeedback.innerHTML += `<div>Time taken: ${timeInSeconds} seconds</div>`;
            
            // After a short delay, complete the test
            setTimeout(() => {
                completeSetupTest(true);
            }, 2000);
        } else {
            // Wrong position
            setupFeedback.innerHTML = '<div class="error">Not quite right. Try again!</div>';
            setupFeedback.style.color = 'red';
            
            // Compare piece by piece to give specific feedback
            const differences = comparePositions(targetFen, setupFen);
            if (differences.length > 0) {
                let diffHtml = '<ul class="position-differences">';
                differences.forEach(diff => {
                    diffHtml += `<li>${diff}</li>`;
                });
                diffHtml += '</ul>';
                setupFeedback.innerHTML += diffHtml;
            }
        }
    } catch (error) {
        console.error('Error validating setup:', error);
        setupFeedback.innerHTML = 'Error validating board position. Please try again.';
        setupFeedback.style.color = 'red';
    }
}

// Compare two positions to give specific feedback
function comparePositions(targetFen, setupFen) {
    const differences = [];
    
    // Parse FEN strings to get board positions
    const targetBoard = fenToBoard(targetFen);
    const setupBoard = fenToBoard(setupFen);
    
    // Check for missing pieces in the setup
    for (const square in targetBoard) {
        const targetPiece = targetBoard[square];
        const setupPiece = setupBoard[square];
        
        if (!setupPiece) {
            differences.push(`Missing ${getPieceName(targetPiece)} on ${square}`);
        } else if (targetPiece !== setupPiece) {
            differences.push(`Wrong piece on ${square}. Should be ${getPieceName(targetPiece)}, not ${getPieceName(setupPiece)}`);
        }
    }
    
    // Check for extra pieces in the setup
    for (const square in setupBoard) {
        if (!targetBoard[square]) {
            differences.push(`Extra ${getPieceName(setupBoard[square])} on ${square}`);
        }
    }
    
    // Limit to the first 5 differences to avoid overwhelming the user
    return differences.slice(0, 5);
}

// Helper to convert FEN position to a board object
function fenToBoard(fen) {
    const board = {};
    const rows = fen.split('/');
    
    let rankIndex = 8;
    rows.forEach(row => {
        let fileIndex = 0;
        
        for (let i = 0; i < row.length; i++) {
            const char = row.charAt(i);
            
            if (/[1-8]/.test(char)) {
                fileIndex += parseInt(char);
            } else {
                const file = String.fromCharCode(97 + fileIndex); // 'a' + fileIndex
                const rank = rankIndex;
                const square = file + rank;
                board[square] = char;
                fileIndex++;
            }
        }
        
        rankIndex--;
    });
    
    return board;
}

// Helper to get human-readable piece name
function getPieceName(pieceChar) {
    const pieceNames = {
        'P': 'White Pawn',
        'N': 'White Knight',
        'B': 'White Bishop',
        'R': 'White Rook',
        'Q': 'White Queen',
        'K': 'White King',
        'p': 'Black Pawn',
        'n': 'Black Knight',
        'b': 'Black Bishop',
        'r': 'Black Rook',
        'q': 'Black Queen',
        'k': 'Black King'
    };
    
    return pieceNames[pieceChar] || pieceChar;
}

// Complete the setup test and continue
function completeSetupTest(success) {
    // Remove the setup modal
    const setupModal = document.getElementById('setupTestModal');
    if (setupModal) {
        setupModal.remove();
    }
    
    // Reset the setup mode flag
    isSetupMode = false;
    
    // Reset the new moves counter if successful
    if (success) {
        newMovesLearned = 0;
    }
    
    // Continue based on where we were
    if (currentMoveIndex >= parseMoves(currentLine).length) {
        // We were at the end of a line
        completeLine();
    } else {
        // Continue with next move
        prepareNextMoveChoices();
    }
}

// Complete the current line
function completeLine() {
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
    // Get a move from a different opening or variation
    const allMoves = [];
    
    for (const openingName in allOpenings) {
        if (openingName !== currentOpening) {
            const opening = allOpenings[openingName];
            const mainLineMoves = parseMoves(opening.moves);
            if (mainLineMoves.length > 0) {
                allMoves.push(mainLineMoves[0]); // Use the first move
            }
            
            // Add moves from variations
            for (const variationName in opening.variations) {
                const variation = opening.variations[variationName];
                const variationMoves = parseMoves(variation.moves);
                if (variationMoves.length > 0) {
                    allMoves.push(variationMoves[0]);
                }
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
        // Return a random incorrect move
        return legalMoves[Math.floor(Math.random() * legalMoves.length)];
    }
    
    // If no suitable move was found, generate a random legal move
    const legalMovesInPosition = game.moves({ verbose: true });
    if (legalMovesInPosition.length > 0) {
        const randomMove = legalMovesInPosition[Math.floor(Math.random() * legalMovesInPosition.length)];
        return randomMove.from + randomMove.to;
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
    // Check if elements exist
    if (!elements.progressBar || !elements.progressText || 
        !elements.totalProgress || !elements.openingsMastered) {
        console.warn('Progress display elements not found');
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
    elements.openingsMastered.textContent = userProgress.masteredOpenings ? userProgress.masteredOpenings.length : 0;
}

// Filter openings in the library
function filterOpenings() {
    const searchTerm = elements.openingSearch.value.toLowerCase();
    
    // Get all openings sorted by current method
    const sortMethod = elements.sortByPopularity.classList.contains('active') ? 'popularity' : 'alphabetical';
    let openings = Object.entries(allOpenings)
        .map(([name, data]) => ({ name, totalPlays: data.totalPlays }));
    
    if (sortMethod === 'popularity') {
        openings = openings.sort((a, b) => b.totalPlays - a.totalPlays);
    } else {
        openings = openings.sort((a, b) => a.name.localeCompare(b.name));
    }
    
    // Filter by search term
    if (searchTerm) {
        openings = openings.filter(opening => opening.name.toLowerCase().includes(searchTerm));
    }
    
    // Update display
    populateLibraryOpenings(openings);
}

// Sort openings
function sortOpenings(method) {
    if (method === 'popularity') {
        elements.sortByPopularity.classList.add('active');
        elements.sortAlphabetically.classList.remove('active');
    } else {
        elements.sortByPopularity.classList.remove('active');
        elements.sortAlphabetically.classList.add('active');
    }
    
    // Re-filter with new sort method
    filterOpenings();
}

// Get the total number of variations for an opening
function getTotalVariationCount(openingName) {
    if (!allOpenings[openingName]) return 0;
    
    // Count main line + all variations
    return 1 + Object.keys(allOpenings[openingName].variations || {}).length;
}

// Restart the current line
function restartCurrentLine() {
    if (!currentLine) return;
    
    startLearningSession();
}

// Play the next move
function playNextMove() {
    if (!currentLine) return;
    
    const moveList = parseMoves(currentLine);
    
    // Check if we're at the end of the line
    if (currentMoveIndex >= moveList.length) {
        return;
    }
    
    // Play the next move
    game.move(moveList[currentMoveIndex]);
    board.position(game.fen(), true); // true enables animation
    moveSound.play();
    currentMoveIndex++;
    updateMoveHistory();
    
    // If we reached the end, complete the line
    if (currentMoveIndex >= moveList.length) {
        completeLine();
    } else {
        prepareNextMoveChoices();
    }
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
    
    // Randomly swap the colors
    if (Math.random() > 0.5) {
        moveColors.optionA = randomPair[0];
        moveColors.optionB = randomPair[1];
    } else {
        moveColors.optionA = randomPair[1];
        moveColors.optionB = randomPair[0];
    }
    
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
        const response = await fetch('opening_descriptions.json');
        const data = await response.json();
        descriptions = data.openings;
        console.log('Loaded opening descriptions:', descriptions);
    } catch (error) {
        console.error('Error loading opening descriptions:', error);
        descriptions = {}; // Default to empty if loading fails
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
