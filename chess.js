/**
 * Chess.js - Core chess logic
 * Implements the basic chess functionality without puzzles
 */

class ChessBoard {
    constructor(element) {
        this.element = element;
        this.selectedSquare = null;
        this.draggedPiece = null;
        this.draggedPieceStartPosition = null;
        this.position = {};
        this.sideToMove = 'w';
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
        
        // Keep track of the last move for highlighting
        this.lastMove = {
            from: null,
            to: null
        };
        
        this.createBoard();
        this.setupInitialPosition();
        this.addEventListeners();
        this.addCoordinates();
    }
    
    createBoard() {
        this.element.innerHTML = '';
        
        // Create board squares
        for (let rank = 8; rank >= 1; rank--) {
            for (let file = 0; file < 8; file++) {
                const square = document.createElement('div');
                const isWhite = (rank + file) % 2 === 1;
                const fileStr = this.files[file];
                const rankStr = rank.toString();
                const squareId = fileStr + rankStr;
                
                square.id = `square-${squareId}`;
                square.className = `square ${isWhite ? 'white' : 'black'}`;
                square.dataset.square = squareId;
                square.dataset.file = fileStr;
                square.dataset.rank = rankStr;
                
                this.element.appendChild(square);
            }
        }
    }
    
    addCoordinates() {
        const container = this.element.parentElement;
        
        // Add rank coordinates (1-8)
        const rankCoords = document.createElement('div');
        rankCoords.className = 'coordinates-rank';
        for (let rank = 1; rank <= 8; rank++) {
            const coord = document.createElement('div');
            coord.textContent = rank;
            rankCoords.appendChild(coord);
        }
        container.appendChild(rankCoords);
        
        // Add file coordinates (a-h)
        const fileCoords = document.createElement('div');
        fileCoords.className = 'coordinates-file';
        for (let file = 0; file < 8; file++) {
            const coord = document.createElement('div');
            coord.textContent = this.files[file];
            fileCoords.appendChild(coord);
        }
        container.appendChild(fileCoords);
    }
    
    addEventListeners() {
        // Mouse down - start dragging or select a piece
        this.element.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return; // Only left mouse button
            
            const square = e.target.closest('.square');
            if (!square) return;
            
            const piece = square.querySelector('.piece');
            if (!piece) return;
            
            const squareId = square.dataset.square;
            const pieceCode = piece.dataset.piece;
            
            if (!this.isPieceCorrectSide(pieceCode)) return;
            
            // Start dragging
            this.draggedPiece = piece;
            this.draggedPieceStartPosition = squareId;
            
            // Add dragging class
            piece.classList.add('dragging');
            
            // Show legal moves for this piece
            this.showLegalMoves(squareId);
            
            // Calculate offset for centering the piece under cursor
            const rect = piece.getBoundingClientRect();
            this.dragOffsetX = e.clientX - (rect.left + rect.width / 2);
            this.dragOffsetY = e.clientY - (rect.top + rect.height / 2);
            
            // Update piece position
            this.updateDraggedPiecePosition(e.clientX, e.clientY);
            
            // Prevent text selection
            e.preventDefault();
        });
        
        // Mouse move - drag the piece
        document.addEventListener('mousemove', (e) => {
            if (!this.draggedPiece) return;
            this.updateDraggedPiecePosition(e.clientX, e.clientY);
        });
        
        // Mouse up - drop the piece or complete click-to-move
        document.addEventListener('mouseup', (e) => {
            if (!this.draggedPiece) {
                // Handle click-to-move if no drag is in progress
                if (this.selectedSquare) {
                    const square = e.target.closest('.square');
                    if (square) {
                        const targetSquare = square.dataset.square;
                        if (targetSquare !== this.selectedSquare) {
                            // Attempt to make the move
                            if (this.isLegalMove(this.selectedSquare, targetSquare)) {
                                this.makeMove(this.selectedSquare, targetSquare);
                            }
                        }
                        // Clear selection
                        this.clearSelection();
                    }
                } else {
                    // Select a piece for click-to-move
                    const square = e.target.closest('.square');
                    if (square) {
                        const pieceEl = square.querySelector('.piece');
                        if (pieceEl && this.isPieceCorrectSide(pieceEl.dataset.piece)) {
                            this.selectedSquare = square.dataset.square;
                            square.classList.add('selected');
                            this.showLegalMoves(this.selectedSquare);
                        }
                    }
                }
                return;
            }
            
            // Find the square under the cursor for dropping
            const targetElement = document.elementFromPoint(e.clientX, e.clientY);
            const targetSquare = targetElement?.closest('.square');
            
            // Remove dragging class
            this.draggedPiece.classList.remove('dragging');
            
            if (targetSquare) {
                const targetSquareId = targetSquare.dataset.square;
                
                // Only make the move if it's a different square
                if (targetSquareId !== this.draggedPieceStartPosition) {
                    // Check if the move is legal
                    if (this.isLegalMove(this.draggedPieceStartPosition, targetSquareId)) {
                        this.makeMove(this.draggedPieceStartPosition, targetSquareId);
                    } else {
                        // Return the piece to its original position
                        this.draggedPiece.style.transform = '';
                    }
                } else {
                    // Reset the piece position if dropped on the same square
                    this.draggedPiece.style.transform = '';
                }
            } else {
                // Reset the piece position if dropped outside the board
                this.draggedPiece.style.transform = '';
            }
            
            // Clean up dragging state
            this.draggedPiece = null;
            this.draggedPieceStartPosition = null;
            
            // Clear legal move indicators
            this.clearLegalMoves();
        });
        
        // Touch events for mobile
        this.element.addEventListener('touchstart', (e) => {
            if (e.touches.length !== 1) return;
            
            const touch = e.touches[0];
            const square = document.elementFromPoint(touch.clientX, touch.clientY).closest('.square');
            if (!square) return;
            
            const piece = square.querySelector('.piece');
            if (!piece) return;
            
            const squareId = square.dataset.square;
            const pieceCode = piece.dataset.piece;
            
            if (!this.isPieceCorrectSide(pieceCode)) return;
            
            // Start dragging
            this.draggedPiece = piece;
            this.draggedPieceStartPosition = squareId;
            
            // Add dragging class
            piece.classList.add('dragging');
            
            // Show legal moves for this piece
            this.showLegalMoves(squareId);
            
            // Calculate offset (centered)
            const rect = piece.getBoundingClientRect();
            this.dragOffsetX = touch.clientX - (rect.left + rect.width / 2);
            this.dragOffsetY = touch.clientY - (rect.top + rect.height / 2);
            
            // Update piece position
            this.updateDraggedPiecePosition(touch.clientX, touch.clientY);
            
            e.preventDefault();
        });
        
        this.element.addEventListener('touchmove', (e) => {
            if (!this.draggedPiece || e.touches.length !== 1) return;
            
            const touch = e.touches[0];
            this.updateDraggedPiecePosition(touch.clientX, touch.clientY);
            e.preventDefault();
        });
        
        this.element.addEventListener('touchend', (e) => {
            if (!this.draggedPiece) return;
            
            const touch = e.changedTouches[0];
            const targetElement = document.elementFromPoint(touch.clientX, touch.clientY);
            const targetSquare = targetElement?.closest('.square');
            
            // Remove dragging class
            this.draggedPiece.classList.remove('dragging');
            
            if (targetSquare) {
                const targetSquareId = targetSquare.dataset.square;
                
                // Only make the move if it's a different square
                if (targetSquareId !== this.draggedPieceStartPosition) {
                    // Check if the move is legal
                    if (this.isLegalMove(this.draggedPieceStartPosition, targetSquareId)) {
                        this.makeMove(this.draggedPieceStartPosition, targetSquareId);
                    } else {
                        // Return the piece to its original position
                        this.draggedPiece.style.transform = '';
                    }
                } else {
                    // Reset the piece position if dropped on the same square
                    this.draggedPiece.style.transform = '';
                }
            } else {
                // Reset the piece position if dropped outside the board
                this.draggedPiece.style.transform = '';
            }
            
            // Clean up dragging state
            this.draggedPiece = null;
            this.draggedPieceStartPosition = null;
            
            // Clear legal move indicators
            this.clearLegalMoves();
            
            e.preventDefault();
        });
    }
    
    updateDraggedPiecePosition(clientX, clientY) {
        if (!this.draggedPiece) return;
        
        const boardRect = this.element.getBoundingClientRect();
        const x = clientX - boardRect.left - this.dragOffsetX;
        const y = clientY - boardRect.top - this.dragOffsetY;
        
        this.draggedPiece.style.transform = `translate(${x}px, ${y}px)`;
    }
    
    isPieceCorrectSide(pieceCode) {
        const pieceColor = pieceCode.charAt(0);
        return (pieceColor === 'w' && this.sideToMove === 'w') || 
               (pieceColor === 'b' && this.sideToMove === 'b');
    }
    
    clearSelection() {
        const selected = document.querySelector('.square.selected');
        if (selected) {
            selected.classList.remove('selected');
        }
        this.selectedSquare = null;
        this.clearLegalMoves();
    }
    
    isLegalMove(from, to) {
        // This is a simplified legal move checker
        // In a complete chess implementation, you would implement full rules
        
        const piece = this.position[from];
        if (!piece) return false;
        
        const pieceColor = piece.charAt(0);
        const pieceType = piece.charAt(1).toLowerCase();
        
        // Cannot capture own pieces
        if (this.position[to] && this.position[to].charAt(0) === pieceColor) {
            return false;
        }
        
        const fromCoords = this.squareToCoordinates(from);
        const toCoords = this.squareToCoordinates(to);
        
        const dx = toCoords.x - fromCoords.x;
        const dy = toCoords.y - fromCoords.y;
        
        // Basic move validation based on piece type
        switch (pieceType) {
            case 'p': // Pawn
                const direction = pieceColor === 'w' ? -1 : 1;
                const startRank = pieceColor === 'w' ? 6 : 1;
                
                // Moving forward
                if (dx === 0 && !this.position[to]) {
                    if (dy === direction) return true;
                    if (dy === 2 * direction && fromCoords.y === startRank && !this.position[this.coordinatesToSquare(fromCoords.x, fromCoords.y + direction)]) {
                        return true;
                    }
                }
                
                // Capturing
                if (Math.abs(dx) === 1 && dy === direction && this.position[to]) {
                    return true;
                }
                
                return false;
                
            case 'n': // Knight
                return (Math.abs(dx) === 1 && Math.abs(dy) === 2) || 
                       (Math.abs(dx) === 2 && Math.abs(dy) === 1);
                
            case 'b': // Bishop
                if (Math.abs(dx) !== Math.abs(dy)) return false;
                
                return this.isPathClear(fromCoords, toCoords);
                
            case 'r': // Rook
                if (dx !== 0 && dy !== 0) return false;
                
                return this.isPathClear(fromCoords, toCoords);
                
            case 'q': // Queen
                if (dx !== 0 && dy !== 0 && Math.abs(dx) !== Math.abs(dy)) return false;
                
                return this.isPathClear(fromCoords, toCoords);
                
            case 'k': // King
                return Math.abs(dx) <= 1 && Math.abs(dy) <= 1;
                
            default:
                return false;
        }
    }
    
    squareToCoordinates(square) {
        const file = this.files.indexOf(square.charAt(0));
        const rank = 8 - parseInt(square.charAt(1));
        return { x: file, y: rank };
    }
    
    coordinatesToSquare(x, y) {
        return `${this.files[x]}${8 - y}`;
    }
    
    isPathClear(from, to) {
        const dx = Math.sign(to.x - from.x);
        const dy = Math.sign(to.y - from.y);
        
        let x = from.x + dx;
        let y = from.y + dy;
        
        while (x !== to.x || y !== to.y) {
            const square = this.coordinatesToSquare(x, y);
            if (this.position[square]) {
                return false;
            }
            x += dx;
            y += dy;
        }
        
        return true;
    }
    
    showLegalMoves(square) {
        this.clearLegalMoves();
        
        for (let rank = 0; rank < 8; rank++) {
            for (let file = 0; file < 8; file++) {
                const targetSquare = this.coordinatesToSquare(file, rank);
                if (this.isLegalMove(square, targetSquare)) {
                    const targetElement = document.getElementById(`square-${targetSquare}`);
                    
                    if (this.position[targetSquare]) {
                        targetElement.classList.add('legal-capture');
                    } else {
                        targetElement.classList.add('legal-move');
                    }
                }
            }
        }
    }
    
    clearLegalMoves() {
        document.querySelectorAll('.square.legal-move, .square.legal-capture').forEach(square => {
            square.classList.remove('legal-move', 'legal-capture');
        });
    }
    
    makeMove(from, to) {
        const sourceSquare = document.getElementById(`square-${from}`);
        const targetSquare = document.getElementById(`square-${to}`);
        const piece = sourceSquare.querySelector('.piece');
        
        if (!piece) return false;
        
        // Remove captured piece if any
        if (targetSquare.querySelector('.piece')) {
            targetSquare.removeChild(targetSquare.querySelector('.piece'));
        }
        
        // Update position object
        this.position[to] = this.position[from];
        delete this.position[from];
        
        // Move piece to new square
        sourceSquare.removeChild(piece);
        targetSquare.appendChild(piece);
        
        // Reset piece position if it was being dragged
        piece.style.transform = '';
        
        // Store last move for highlighting
        this.lastMove = { from, to };
        
        // Highlight the move
        this.highlightLastMove();
        
        // Switch side to move
        this.sideToMove = this.sideToMove === 'w' ? 'b' : 'w';
        this.updateSideToMove();
        
        return true;
    }
    
    highlightLastMove() {
        // Remove previous highlights
        document.querySelectorAll('.square.highlight-source, .square.highlight-target').forEach(square => {
            square.classList.remove('highlight-source', 'highlight-target');
        });
        
        if (this.lastMove.from && this.lastMove.to) {
            const sourceSquare = document.getElementById(`square-${this.lastMove.from}`);
            const targetSquare = document.getElementById(`square-${this.lastMove.to}`);
            
            if (sourceSquare && targetSquare) {
                sourceSquare.classList.add('highlight-source');
                targetSquare.classList.add('highlight-target');
            }
        }
    }
    
    updateSideToMove() {
        const sideToMoveEl = document.getElementById('sideToMove');
        if (sideToMoveEl) {
            sideToMoveEl.textContent = this.sideToMove === 'w' ? 'white' : 'black';
        }
    }
    
    setPiece(square, pieceCode) {
        const squareElement = document.getElementById(`square-${square}`);
        if (!squareElement) return;
        
        // Remove existing piece if any
        const existingPiece = squareElement.querySelector('.piece');
        if (existingPiece) {
            squareElement.removeChild(existingPiece);
        }
        
        if (pieceCode) {
            const piece = document.createElement('div');
            piece.className = 'piece';
            piece.dataset.piece = pieceCode;
            
            const color = pieceCode.charAt(0);
            const type = pieceCode.charAt(1).toLowerCase();
            
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
            
            squareElement.appendChild(piece);
            this.position[square] = pieceCode;
        } else {
            delete this.position[square];
        }
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
        document.querySelectorAll('.piece').forEach(piece => piece.remove());
        
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
    
    clearHighlights() {
        document.querySelectorAll('.square.highlight-source, .square.highlight-target, .square.highlight-check, .square.selected, .square.legal-move, .square.legal-capture')
            .forEach(el => {
                el.classList.remove('highlight-source', 'highlight-target', 'highlight-check', 'selected', 'legal-move', 'legal-capture');
            });
    }
    
    resetPosition() {
        this.setupInitialPosition();
        this.clearHighlights();
        this.selectedSquare = null;
        this.lastMove = { from: null, to: null };
    }
    
    // Method to set a custom position from FEN
    setPosition(fen) {
        this.setPositionFromFen(fen);
        this.clearHighlights();
        this.selectedSquare = null;
        this.lastMove = { from: null, to: null };
    }
} 