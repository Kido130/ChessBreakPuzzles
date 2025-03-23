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
    moveCompletionCounts: {}
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
let inReviewMode = false; // Whether we're reviewing previously learned moves
let movesSinceLastReview = 0; // Count new moves since last review
let currentReviewMoves = []; // Current moves being reviewed
let currentReviewIndex = 0; // Index in the review moves

// DOM Elements - Initialize after DOM is loaded
let elements = {};

// Initialize the system
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM fully loaded');
    
    // Initialize DOM element references
    initializeElements();
    
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
                    duration: 500, // Increased animation duration for smoother transitions
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
            
            // Check if user already has an opening they're studying
            if (!userProgress.currentOpening || !userProgress.currentLine) {
                // First-time user or no specific line selected, show selection modal
                const topOpenings = getTopOpenings(5);
                populateOpeningSelection(topOpenings, true);
                openOpeningSelectionModal();
            } else {
                // Returning user with an opening and line selected, load their progress directly
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
            userProgress.reviewMoves = userProgress.reviewMoves || [];
            userProgress.reviewedMoves = userProgress.reviewedMoves || {};
            userProgress.moveCompletionCounts = userProgress.moveCompletionCounts || {};
            
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
        moveCompletionCounts: {}
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
    
    // Ensure moveCompletionCounts exists
    userProgress.moveCompletionCounts = userProgress.moveCompletionCounts || {};
    
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
        
        // Show a welcome back message if they have progress
        if (userProgress.currentMoveIndex > 0) {
            const openingName = userProgress.currentOpening;
            const variationName = userProgress.currentVariation || 'Main Line';
            
            // Create a temporary welcome back message
            const welcomeMsg = document.createElement('div');
            welcomeMsg.style.position = 'fixed';
            welcomeMsg.style.top = '20px';
            welcomeMsg.style.left = '50%';
            welcomeMsg.style.transform = 'translateX(-50%)';
            welcomeMsg.style.padding = '15px 20px';
            welcomeMsg.style.backgroundColor = 'rgba(92, 139, 28, 0.9)';
            welcomeMsg.style.color = 'white';
            welcomeMsg.style.borderRadius = '5px';
            welcomeMsg.style.zIndex = '2000';
            welcomeMsg.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
            welcomeMsg.style.transition = 'opacity 0.5s ease';
            welcomeMsg.innerHTML = `<strong>Welcome back!</strong> Continuing from move ${userProgress.currentMoveIndex} in ${openingName} (${variationName})`;
            
            document.body.appendChild(welcomeMsg);
            
            // Fade out and remove after 4 seconds
            setTimeout(() => {
                welcomeMsg.style.opacity = '0';
                setTimeout(() => welcomeMsg.remove(), 500);
            }, 4000);
        }
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
        
        // Load review state
        inReviewMode = userProgress.inReviewMode || false;
        currentReviewMoves = userProgress.currentReviewMoves || [];
        currentReviewIndex = userProgress.currentReviewIndex || 0;
        movesSinceLastReview = userProgress.movesSinceLastReview || 0;
        
        // If there's a saved move index, we'll resume from there
        if (typeof userProgress.currentMoveIndex === 'number') {
            // Always start learning session with the saved move index, even if it's 0
            // This ensures we properly restore the exact position
            startLearningSession(userProgress.currentMoveIndex);
        } else {
            startLearningSession(0);
        }
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
            title.textContent = 'Welcome! Select an opening to learn';
        }
    }
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
        return "white";
    } else if (blackOpenings.some(opening => openingName.includes(opening))) {
        return "black";
    }
    return "both";
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
        
        // Get description for the opening
        let descriptionText = descriptions[opening.name] ? 
            descriptions[opening.name].description : 
            generateGenericDescription(opening.name);
        
        // Get recommended color
        const recommendedColor = getRecommendedColor(opening.name);
        const colorText = recommendedColor !== 'both' ? 
            `<div class="recommended-color">(recommended as ${recommendedColor})</div>` : '';
        
        openingItem.innerHTML = `
            <div class="opening-name">${opening.name}</div>
            ${colorText}
            <div class="opening-plays">${opening.totalPlays.toLocaleString()} games played</div>
            <div class="opening-description">${descriptionText}</div>
            ${progressStatus}
            <div class="item-actions">
                <button class="study-btn">Study Opening</button>
            </div>
        `;
        
        // Add click handler for the study button
        const studyBtn = openingItem.querySelector('.study-btn');
        studyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Set current opening
            currentOpening = opening.name;
            userProgress.currentOpening = opening.name;
            saveUserProgress();
            
            // Hide opening list
            elements.libraryOpeningList.classList.add('hidden');
            
            // Open variation selection
            openLibraryVariationSelection(opening.name);
        });
        
        elements.libraryOpeningList.appendChild(openingItem);
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
function startLearningSession(savedMoveIndex = 0) {
    if (!currentOpening || !currentLine) {
        console.error('No opening or line selected');
        return;
    }
    
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
    
    // Reset board and game
    game = new Chess();
    board.position(game.fen());
    
    // If we have a saved position, restore to that move
    if (savedMoveIndex > 0) {
        const moveList = parseMoves(currentLine);
        // Play all moves up to the saved position
        for (let i = 0; i < savedMoveIndex && i < moveList.length; i++) {
            game.move(moveList[i]);
        }
        currentMoveIndex = savedMoveIndex;
        board.position(game.fen());
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
    
    // Hide choice buttons during animation
    elements.choiceA.parentElement.parentElement.style.visibility = 'hidden';
    
    if (isCorrect) {
        // Apply the correct move
        if (move) {
            // Clear any move visualizations after a small delay
            setTimeout(() => clearMoveVisualization(), 20);
            
            game.move(move);
            board.position(game.fen(), true); // Enable animation
            moveSound.play();
            
            // Create a key for tracking this move
            const moveKey = `${game.fen()}_${move}`;
            
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
            
            // Check if the move has been completed twice
            if (userProgress.moveCompletionCounts[currentOpening][currentVariation || 'Main Line'][moveKey] >= 2) {
                // Move has been completed at least twice, proceed to next move
                playNextComputerMove();
                showMessage('Great! Moving to the next move.');
            } else {
                // First time completing this move, ask to repeat it
                showMessage('Good! Let\'s check if you remember this move again.');
                
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
                        console.warn('Undo failed, rebuilding position', e);
                        
                        // If undo fails, rebuild the position
                        game = new Chess();
                        const moveList = parseMoves(currentLine);
                        
                        // Replay all moves up to the target position
                        for (let i = 0; i < prevMoveIndex; i++) {
                            game.move(moveList[i]);
                        }
                    }
                    
                    // Update board position
                    board.position(game.fen());
                    
                    // Reset current move index
                    currentMoveIndex = prevMoveIndex;
                    
                    // Update move history display
                    updateMoveHistory();
                    
                    // Save the updated position with the corrected move index
                    saveUserProgress();
                    
                    // Show choice buttons with a delay to allow animations to complete
                    setTimeout(() => {
                        prepareNextMoveChoices();
                    }, 500);
                }, 1200);
            }
        }
        
        // Use visual feedback that preserves the button's color
        button.style.boxShadow = '0 0 10px 5px rgba(255, 255, 255, 0.5)';
        button.style.transform = 'scale(1.05)';
        
        // Add to learned moves if not already learned
        if (!userProgress.learnedMoves[currentOpening]) {
            userProgress.learnedMoves[currentOpening] = {};
        }
        if (!userProgress.learnedMoves[currentOpening][currentVariation || 'Main Line']) {
            userProgress.learnedMoves[currentOpening][currentVariation || 'Main Line'] = {};
        }
        
        // Create a key for this move
        const moveKey = `${game.fen()}_${move}`;
        
        // Mark this move as learned
        userProgress.learnedMoves[currentOpening][currentVariation || 'Main Line'][moveKey] = true;
        
        // Reset visual feedback after a delay
        setTimeout(() => {
            button.style.boxShadow = '';
            button.style.transform = '';
        }, 700);
    } else {
        // Clear move visualization after a small delay
        setTimeout(() => clearMoveVisualization(), 20);
        
        // Wrong choice feedback
        button.classList.add('incorrect');
        
        // Show visual cue for correct move
        otherButton.classList.add('correct');
        
        // Wait a bit before continuing
        setTimeout(() => {
            // Clear visual feedback
            button.classList.remove('incorrect');
            otherButton.classList.remove('correct');
            button.style.boxShadow = '';
            button.style.transform = '';
            
            // Continue with normal learning (stay at the same position)
            prepareNextMoveChoices();
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
        !elements.totalProgress) {
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
        
        // Add additional descriptions for openings that might not be in the file
        const additionalDescriptions = {
            "Pirc Defense": {
                "description": "Black allows White to build a strong center with pawns, then undermines it with piece pressure and timely counterattacks."
            },
            "Modern Defense": {
                "description": "Similar to the Pirc, Black develops the king's bishop via fianchetto and allows White to occupy the center before challenging it."
            },
            "Alekhine's Defense": {
                "description": "Black tempts White to advance pawns in pursuit of the knight, aiming to undermine the resulting pawn structure."
            },
            "Dutch Defense": {
                "description": "Black immediately fights for control of the e4 square with f5, creating asymmetrical positions with distinct pawn structures."
            },
            "Grünfeld Defense": {
                "description": "Black allows White to establish a strong pawn center, then immediately challenges it with piece pressure and the d5 break."
            },
            "Benoni Defense": {
                "description": "Black concedes central space to White, countering with pressure against White's central pawns from the flanks."
            },
            "Benko Gambit": {
                "description": "Black sacrifices a pawn for long-lasting pressure on White's queenside, aiming for open lines and active piece play."
            },
            "Vienna Game": {
                "description": "White develops the knight before pushing pawns, maintaining flexibility in the center while preparing kingside action."
            },
            "King's Gambit": {
                "description": "White sacrifices a pawn to accelerate development and open lines against Black's king, leading to sharp tactical positions."
            },
            "Budapest Gambit": {
                "description": "Black sacrifices a pawn to develop quickly and create immediate threats against White's center."
            },
            "London System": {
                "description": "White develops pieces to standard squares, creating a solid structure that can be used against various Black setups."
            },
            "Catalan Opening": {
                "description": "White combines d4 with a kingside fianchetto, creating pressure on the central dark squares while maintaining a solid position."
            },
            "Réti Opening": {
                "description": "White controls the center with pieces rather than pawns, preparing for strategic battles based on piece activity."
            }
        };
        
        // Merge with existing descriptions
        descriptions = {...descriptions, ...additionalDescriptions};
        
    } catch (error) {
        console.error('Error loading opening descriptions:', error);
        
        // Fallback with some basic descriptions if loading fails
        descriptions = {
            "Sicilian Defense": {
                "description": "Black immediately challenges White's center control, creating asymmetrical positions with dynamic counterplay."
            },
            "Italian Game": {
                "description": "White develops the bishop to an active diagonal, targeting Black's f7 square while preparing castling."
            },
            "Queen's Gambit": {
                "description": "White offers a pawn to control the center, gaining spatial advantage and better piece development."
            },
            "French Defense": {
                "description": "Black establishes a solid pawn chain but initially restricts the king's bishop development."
            },
            "King's Indian Defense": {
                "description": "Black allows White to establish a broad pawn center, then challenges it with piece pressure."
            },
            "Ruy Lopez": {
                "description": "White develops the bishop to apply pressure on Black's knight, creating complex strategic positions."
            }
        };
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
        
        // Board control buttons
        playAgainBtn: document.getElementById('playAgainBtn'),
        nextMoveBtn: document.getElementById('nextMoveBtn'),
        
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
        
        // Search and sort
        openingSearch: document.getElementById('openingSearch'),
        sortByPopularity: document.getElementById('sortByPopularity'),
        sortAlphabetically: document.getElementById('sortAlphabetically'),
        
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
        <div class="opening-moves">${formatMovesForDisplay(opening.moves)}</div>
        <button class="study-btn">Study This Line</button>
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
                <div class="opening-moves">${formatMovesForDisplay(variation.moves)}</div>
                <button class="study-btn">Study This Line</button>
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
