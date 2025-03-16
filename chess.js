/**
 * Chess.js - Core chess logic
 * Implements the basic chess functionality without puzzles
 */

class ChessBoard {
    constructor(element) {
        this.element = element;
        this.selectedSquare = null;
        this.position = {};
        this.sideToMove = 'w';
        this.orientation = 'white'; // 'white' or 'black'
        this.lastMove = null;
        this.files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        this.ranks = ['1', '2', '3', '4', '5', '6', '7', '8'];
        this.pieceTypes = {
            'k': 'king',
            'q': 'queen',
            'r': 'rook',
            'b': 'bishop',
            'n': 'knight',
            'p': 'pawn'
        };
        
        this.createBoard();
        this.setupInitialPosition();
        this.addEventListeners();
    }
    
    createBoard() {
        // Clear the element
        this.element.innerHTML = '';
        
        // Create the main container
        const boardContainer = document.createElement('div');
        boardContainer.className = 'cg-wrap orientation-' + this.orientation;
        
        const cgContainer = document.createElement('cg-container');
        
        // Create the board
        const cgBoard = document.createElement('cg-board');
        cgContainer.appendChild(cgBoard);
        
        // Create coordinates
        this.createCoordinates(cgContainer);
        
        // Add ghost piece for drag & drop
        const ghostPiece = document.createElement('piece');
        ghostPiece.className = 'ghost';
        ghostPiece.style.visibility = 'hidden';
        cgContainer.appendChild(ghostPiece);
        
        boardContainer.appendChild(cgContainer);
        this.element.appendChild(boardContainer);
        
        // Calculate square size based on container size
        const boardWidth = this.element.clientWidth;
        cgContainer.style.width = boardWidth + 'px';
        cgContainer.style.height = boardWidth + 'px';
        
        // Set up the 8x8 grid
        this.squares = {};
        for (let rank = 8; rank >= 1; rank--) {
            for (let file = 0; file < 8; file++) {
                const fileStr = this.files[file];
                const rankStr = rank.toString();
                const squareId = fileStr + rankStr;
                
                // We don't create actual DOM elements for squares, just keep track of positions
                this.squares[squareId] = {
                    id: squareId,
                    x: file,
                    y: 8 - rank,
                    fileStr,
                    rankStr
                };
            }
        }
    }
    
    createCoordinates(container) {
        // Create ranks (1-8)
        const ranksEl = document.createElement('coords');
        ranksEl.className = 'ranks ' + this.orientation;
        for (let rank = 1; rank <= 8; rank++) {
            const coord = document.createElement('coord');
            coord.textContent = rank;
            ranksEl.appendChild(coord);
        }
        container.appendChild(ranksEl);
        
        // Create files (a-h)
        const filesEl = document.createElement('coords');
        filesEl.className = 'files ' + this.orientation;
        for (let file = 0; file < 8; file++) {
            const coord = document.createElement('coord');
            coord.textContent = this.files[file];
            filesEl.appendChild(coord);
        }
        container.appendChild(filesEl);
    }
    
    addEventListeners() {
        const board = this.element.querySelector('cg-board');
        
        // Mouse down on a piece to start dragging or select
        board.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return; // Only left mouse button
            
            const position = this.getSquareFromCoords(e.clientX, e.clientY);
            if (!position) return;
            
            const piece = this.position[position];
            if (!piece) return;
            
            // Check if it's this side's turn to move
            if (!this.isPieceCorrectSide(piece)) return;
            
            this.selectedSquare = position;
            this.showSelected(position);
            
            // Prevent text selection
            e.preventDefault();
        });
        
        // Mouse move for drag operations
        board.addEventListener('mousemove', (e) => {
            if (!this.selectedSquare) return;
            
            // Update ghost piece position
            const ghost = this.element.querySelector('.ghost');
            if (ghost) {
                ghost.style.visibility = 'visible';
                ghost.style.transform = `translate(${e.clientX - this.element.getBoundingClientRect().left - 20}px, ${e.clientY - this.element.getBoundingClientRect().top - 20}px)`;
                
                // Set the ghost piece to match the selected piece
                const pieceCode = this.position[this.selectedSquare];
                if (pieceCode) {
                    const color = pieceCode.charAt(0);
                    const type = pieceCode.charAt(1).toLowerCase();
                    ghost.className = `ghost ${color === 'w' ? 'white' : 'black'} ${this.pieceTypes[type]}`;
                }
            }
        });
        
        // Mouse up to complete the move
        board.addEventListener('mouseup', (e) => {
            if (!this.selectedSquare) return;
            
            const targetPosition = this.getSquareFromCoords(e.clientX, e.clientY);
            if (targetPosition && targetPosition !== this.selectedSquare) {
                this.makeMove(this.selectedSquare, targetPosition);
            }
            
            // Hide ghost and clear selection
            const ghost = this.element.querySelector('.ghost');
            if (ghost) {
                ghost.style.visibility = 'hidden';
            }
            
            this.clearSelected();
            this.selectedSquare = null;
        });
        
        // Touch events for mobile
        board.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            const position = this.getSquareFromCoords(touch.clientX, touch.clientY);
            if (!position) return;
            
            const piece = this.position[position];
            if (!piece || !this.isPieceCorrectSide(piece)) return;
            
            this.selectedSquare = position;
            this.showSelected(position);
            
            e.preventDefault();
        });
        
        board.addEventListener('touchmove', (e) => {
            if (!this.selectedSquare) return;
            e.preventDefault();
        });
        
        board.addEventListener('touchend', (e) => {
            if (!this.selectedSquare) return;
            
            const touch = e.changedTouches[0];
            const targetPosition = this.getSquareFromCoords(touch.clientX, touch.clientY);
            
            if (targetPosition && targetPosition !== this.selectedSquare) {
                this.makeMove(this.selectedSquare, targetPosition);
            }
            
            this.clearSelected();
            this.selectedSquare = null;
        });
    }
    
    getSquareFromCoords(x, y) {
        const rect = this.element.getBoundingClientRect();
        const boardSize = Math.min(rect.width, rect.height);
        const squareSize = boardSize / 8;
        
        // Convert client coordinates to local board coordinates
        const boardX = x - rect.left;
        const boardY = y - rect.top;
        
        // Check if coordinates are within board bounds
        if (boardX < 0 || boardX >= boardSize || boardY < 0 || boardY >= boardSize) {
            return null;
        }
        
        // Calculate file and rank
        let file, rank;
        if (this.orientation === 'white') {
            file = Math.floor(boardX / squareSize);
            rank = 7 - Math.floor(boardY / squareSize);
        } else {
            file = 7 - Math.floor(boardX / squareSize);
            rank = Math.floor(boardY / squareSize);
        }
        
        return this.files[file] + (rank + 1);
    }
    
    showSelected(square) {
        this.clearSelected();
        const piece = this.getPieceElement(square);
        if (piece) {
            piece.classList.add('selected');
        }
    }
    
    clearSelected() {
        const pieces = this.element.querySelectorAll('.piece.selected');
        pieces.forEach(piece => piece.classList.remove('selected'));
    }
    
    isPieceCorrectSide(pieceCode) {
        const pieceColor = pieceCode.charAt(0);
        return (pieceColor === 'w' && this.sideToMove === 'w') || 
               (pieceColor === 'b' && this.sideToMove === 'b');
    }
    
    makeMove(from, to) {
        const piece = this.position[from];
        if (!piece) return false;
        
        // Check if move is legal (simplified for now)
        // In a full implementation, we would check valid moves here
        
        // Remove captured piece if any
        if (this.position[to]) {
            this.removePiece(to);
        }
        
        // Update position object
        this.position[to] = this.position[from];
        delete this.position[from];
        
        // Move piece visually
        this.removePiece(from);
        this.setPiece(to, piece);
        
        // Update last move for highlighting
        this.setLastMove(from, to);
        
        // Switch side to move
        this.sideToMove = this.sideToMove === 'w' ? 'b' : 'w';
        this.updateSideToMove();
        
        return true;
    }
    
    setLastMove(from, to) {
        // Clear previous last move
        this.clearLastMoveHighlight();
        
        // Save last move
        this.lastMove = { from, to };
        
        // Add highlight
        this.addLastMoveHighlight();
    }
    
    clearLastMoveHighlight() {
        const board = this.element.querySelector('cg-board');
        const existingSquares = board.querySelectorAll('square.last-move');
        existingSquares.forEach(sq => board.removeChild(sq));
    }
    
    addLastMoveHighlight() {
        if (!this.lastMove) return;
        
        const board = this.element.querySelector('cg-board');
        const { from, to } = this.lastMove;
        
        // Create highlight squares for source and target
        const squareFrom = this.createHighlightSquare(from, 'last-move');
        const squareTo = this.createHighlightSquare(to, 'last-move');
        
        board.appendChild(squareFrom);
        board.appendChild(squareTo);
    }
    
    createHighlightSquare(position, className) {
        const square = document.createElement('square');
        square.className = className;
        
        const coords = this.getSquareCoordinates(position);
        if (coords) {
            square.style.transform = `translate(${coords.x * 12.5}%, ${coords.y * 12.5}%)`;
        }
        
        return square;
    }
    
    getSquareCoordinates(position) {
        const file = this.files.indexOf(position.charAt(0));
        const rank = 8 - parseInt(position.charAt(1), 10);
        
        if (file === -1 || rank < 0 || rank > 7) return null;
        
        return { x: file, y: rank };
    }
    
    updateSideToMove() {
        const sideToMoveEl = document.getElementById('sideToMove');
        if (sideToMoveEl) {
            sideToMoveEl.textContent = this.sideToMove === 'w' ? 'white' : 'black';
        }
    }
    
    getPieceElement(square) {
        const cgBoard = this.element.querySelector('cg-board');
        return cgBoard.querySelector(`piece[data-square="${square}"]`);
    }
    
    removePiece(square) {
        const piece = this.getPieceElement(square);
        if (piece) {
            piece.parentNode.removeChild(piece);
        }
    }
    
    setPiece(square, pieceCode) {
        // Create new piece element
        const piece = document.createElement('piece');
        piece.className = 'piece';
        piece.dataset.piece = pieceCode;
        piece.dataset.square = square;
        
        const color = pieceCode.charAt(0);
        const type = pieceCode.charAt(1).toLowerCase();
        
        // Add color and type classes
        piece.classList.add(color === 'w' ? 'white' : 'black');
        piece.classList.add(this.pieceTypes[type]);
        
        // Position the piece
        const coords = this.getSquareCoordinates(square);
        if (coords) {
            piece.style.transform = `translate(${coords.x * 12.5}%, ${coords.y * 12.5}%)`;
        }
        
        // Use the existing image naming convention
        let imageName;
        if (color === 'w') {
            // White pieces use 'lt' (light)
            imageName = `Chess_${type}lt45.svg.png`;
        } else {
            // Black pieces use 'dt' (dark)
            imageName = `Chess_${type}dt45.svg.png`;
        }
        
        piece.style.backgroundImage = `url('images/${imageName}')`;
        
        // Add to board
        const cgBoard = this.element.querySelector('cg-board');
        cgBoard.appendChild(piece);
        
        // Update position data
        this.position[square] = pieceCode;
    }
    
    setupInitialPosition() {
        this.position = {};
        this.sideToMove = 'w';
        
        // Set up the initial chess position
        this.setPositionFromFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
        
        this.updateSideToMove();
    }
    
    setPositionFromFen(fen) {
        // Clear the board
        this.position = {};
        const cgBoard = this.element.querySelector('cg-board');
        const pieces = cgBoard.querySelectorAll('.piece');
        pieces.forEach(piece => cgBoard.removeChild(piece));
        
        // Clear last move highlight
        this.clearLastMoveHighlight();
        
        const parts = fen.split(' ');
        const position = parts[0];
        this.sideToMove = parts[1];
        
        let rank = 8;
        let file = 0;
        
        for (let i = 0; i < position.length; i++) {
            const char = position.charAt(i);
            
            if (char === '/') {
                rank--;
                file = 0;
            } else if (/[1-8]/.test(char)) {
                file += parseInt(char, 10);
            } else {
                const square = this.files[file] + rank;
                const color = char === char.toUpperCase() ? 'w' : 'b';
                const pieceType = char.toLowerCase();
                this.setPiece(square, color + pieceType);
                file++;
            }
        }
        
        this.updateSideToMove();
    }
    
    setOrientation(color) {
        this.orientation = color;
        
        // Update board orientation class
        const wrap = this.element.querySelector('.cg-wrap');
        if (wrap) {
            wrap.className = `cg-wrap orientation-${color}`;
        }
        
        // Update coords orientation
        const files = this.element.querySelector('.coords.files');
        const ranks = this.element.querySelector('.coords.ranks');
        if (files) files.className = `coords files ${color}`;
        if (ranks) ranks.className = `coords ranks ${color}`;
        
        // Redraw pieces with new orientation
        this.redrawPieces();
    }
    
    redrawPieces() {
        const currentPosition = {...this.position};
        const cgBoard = this.element.querySelector('cg-board');
        
        // Clear all pieces
        const pieces = cgBoard.querySelectorAll('.piece');
        pieces.forEach(piece => cgBoard.removeChild(piece));
        
        // Redraw all pieces in correct positions
        for (const [square, pieceCode] of Object.entries(currentPosition)) {
            this.setPiece(square, pieceCode);
        }
        
        // Refresh last move highlights
        this.clearLastMoveHighlight();
        if (this.lastMove) {
            this.addLastMoveHighlight();
        }
    }
    
    clearHighlights() {
        const cgBoard = this.element.querySelector('cg-board');
        const highlights = cgBoard.querySelectorAll('square');
        highlights.forEach(sq => cgBoard.removeChild(sq));
    }
    
    resetPosition() {
        this.setupInitialPosition();
        this.clearHighlights();
        this.selectedSquare = null;
        this.lastMove = null;
    }
    
    // Method to set a custom position from FEN
    setPosition(fen) {
        this.setPositionFromFen(fen);
        this.clearHighlights();
        this.selectedSquare = null;
        this.lastMove = null;
    }
    
    // Set orientation to black (pieces displayed from black's perspective)
    setBlackOrientation() {
        this.setOrientation('black');
    }
    
    // Set orientation to white (pieces displayed from white's perspective)
    setWhiteOrientation() {
        this.setOrientation('white');
    }
} 