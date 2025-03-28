// Dynamic sizing based on viewport dimensions
function adjustSizing() {
    const referenceWidth = 1400;
    const referenceHeight = 1050;
    const boardContainer = document.getElementById('board-container');
    
    // Apply chessboard size to match aspect ratio
    if (boardContainer) {
        // Make sure the board is square
        const width = boardContainer.offsetWidth;
        boardContainer.style.height = `${width}px`;
        
        // Resize board if chessboard library is available
        if (window.board && typeof window.board.resize === 'function') {
            window.board.resize();
        }
    }
}

// Initialize and add resize listener
window.addEventListener('load', adjustSizing);
window.addEventListener('resize', adjustSizing);

// Set current date for privacy policy
document.getElementById('privacy-date').textContent = new Date().toLocaleDateString();

// Modal functionality
const modals = {
    'about-link': 'about-modal',
    'contact-link': 'contact-modal',
    'privacy-link': 'privacy-modal'
};

// Open modal when link is clicked
Object.keys(modals).forEach(linkId => {
    document.getElementById(linkId).addEventListener('click', function(event) {
        event.preventDefault();
        document.getElementById(modals[linkId]).style.display = 'block';
    });
});

// Close modal when close button is clicked
document.querySelectorAll('.close-modal').forEach(closeBtn => {
    closeBtn.addEventListener('click', function() {
        this.closest('.modal').style.display = 'none';
    });
});

// Close modal when clicking outside the modal content
window.addEventListener('click', function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
}); 