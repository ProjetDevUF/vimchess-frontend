import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges
} from '@angular/core';
import {CommonModule} from '@angular/common';

@Component({
  selector: 'app-chessboard',
  templateUrl: './chessboard.component.html',
  styleUrls: ['./chessboard.component.scss'],
  standalone: true,
  imports: [CommonModule]
})
export class ChessboardComponent implements OnInit, OnChanges {
  /** Représentation du plateau d'échecs reçue du serveur */
  @Input() board: any = null;

  /** Côté joué par l'utilisateur ('white' ou 'black') */
  @Input() side: string = 'white';

  /** Information sur le dernier coup joué */
  @Input() lastMove: any = null;

  /** Indique le côté dont c'est le tour ('white' ou 'black') */
  @Input() currentTurn: string = 'white';

  /**
   * Indique si la pièce ou le joueur est actuellement en situation d'échec.
   * Cette propriété est passée du composant parent et permet d'afficher visuellement
   * l'état d'échec sur l'échiquier.
   *
   * @default false
   */
  @Input() inCheck: boolean = false;

  /**
   * Identifie le camp qui met l'adversaire en échec ('white' ou 'black').
   * Cette information est utilisée pour déterminer quelles cases doivent être
   * mises en évidence comme menacées.
   *
   * @default '' - Chaîne vide si aucun camp ne met l'autre en échec
   */
  @Input() checkingSide: string = '';


  /** Événement émis quand un coup est joué */
  @Output() moveMade = new EventEmitter<{ figure: string, cell: string }>();

  /** Tableau pour représenter l'échiquier (8x8) */
  squares: { row: number, col: number, position: string, color: string }[] = [];

  /** Noms des colonnes pour la notation d'échecs */
  columns = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

  /** Pièces actuellement sur l'échiquier */
  pieces: { [key: string]: { type: string, color: string } } = {};

  /** Case sélectionnée par l'utilisateur */
  selectedSquare: string | null = null;

  /** Cases surlignées (généralement pour indiquer le dernier coup) */
  highlightedSquares: string[] = [];

  /** Cases où la pièce sélectionnée peut se déplacer */
  possibleMoves: string[] = [];

  /** Indique si c'est au tour du joueur actuel de jouer */
  isOurTurn: boolean = false;

  /** Structure complète du plateau reçue du serveur pour accéder aux IDs des pièces */
  boardData: any = null;

  /**
   * Détermine si l'échiquier doit être retourné (noir en bas).
   * @returns {boolean} Vrai si le joueur joue les noirs, faux sinon.
   */
  get shouldFlipBoard(): boolean {
    return this.normalizeSide(this.side) === 'b';
  }

  /**
   * Initialise le composant avec la référence au détecteur de changements.
   * @param {ChangeDetectorRef} changeDetector - Service Angular pour forcer la détection des changements.
   */
  constructor(
    private changeDetector: ChangeDetectorRef
  ) {
  }

  /**
   * Initialise l'échiquier au chargement du composant.
   * Crée la structure du plateau et place les pièces en position initiale.
   */
  ngOnInit() {
    this.initializeBoard();
    this.setupInitialPosition();
    this.updateTurnStatus();
  }

  /**
   * Réagit aux changements des propriétés d'entrée.
   * @param {SimpleChanges} changes - Objet contenant les propriétés modifiées.
   */
  ngOnChanges(changes: SimpleChanges) {

    if (changes['board'] && changes['board'].currentValue) {
      this.updateBoard(changes['board'].currentValue);
    }

    if (changes['lastMove'] && changes['lastMove'].currentValue) {
      const moveData = changes['lastMove'].currentValue;
      this.highlightLastMove(moveData);

      if (moveData.prevCell && moveData.cell) {
        this.applyMove(moveData.prevCell, moveData.cell);
      }
    }

    if (changes['currentTurn']) {
      this.updateTurnStatus();
    }

    if (changes['side']) {
      this.updateTurnStatus();
    }
  }

  /**
   * Met à jour l'état indiquant si c'est au tour du joueur actuel de jouer.
   * Compare la couleur jouée par l'utilisateur avec le tour actuel.
   */
  updateTurnStatus() {
    const normalizedSide = this.normalizeSide(this.side);
    const normalizedTurn = this.normalizeSide(this.currentTurn);

    this.isOurTurn = normalizedSide === normalizedTurn;

    if (!this.isOurTurn) {
      this.selectedSquare = null;
      this.possibleMoves = [];
    }
  }

  /**
   * Normalise les différentes représentations des couleurs vers un format standard.
   * @param {string} side - Chaîne représentant une couleur ('white', 'w', 'black', 'b', etc.).
   * @returns {string} Format normalisé ('w' pour blanc, 'b' pour noir).
   */
  normalizeSide(side: string): string {
    if (!side) return '';

    const sideLower = side.toLowerCase();

    if (sideLower === 'w' || sideLower === 'white' || sideLower.startsWith('w')) {
      return 'w';
    }

    if (sideLower === 'b' || sideLower === 'black' || sideLower.startsWith('b')) {
      return 'b';
    }

    return sideLower;
  }

  /**
   * Initialise la représentation en grille de l'échiquier.
   * Crée un tableau de cases avec leurs coordonnées et couleurs.
   */
  initializeBoard() {
    this.squares = [];
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        let position = this.columns[col] + (8 - row);
        let color = (row + col) % 2 === 0 ? 'w' : 'b';

        this.squares.push({
          row,
          col,
          position,
          color
        });
      }
    }
  }

  /**
   * Configure la position initiale standard des pièces.
   * Utilise la notation FEN pour la position de départ.
   */
  setupInitialPosition() {
    const initialFEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    this.parseFEN(initialFEN);
  }

  /**
   * Met à jour l'échiquier avec les nouvelles données reçues.
   * Gère différents formats de données (FEN, objets structurés, etc.).
   * @param {any} boardData - Données du plateau à afficher.
   */
  updateBoard(boardData: any) {
    if (!boardData) return;

    this.boardData = boardData;

    this.pieces = {};

    if (boardData.w && boardData.b) {
      Object.entries(boardData.w).forEach(([position, pieceId]: [string, any]) => {
        if (position.length === 2) {
          this.pieces[position] = {
            type: this.getPieceTypeFromId(pieceId),
            color: 'w'
          };
        }
      });

      Object.entries(boardData.b).forEach(([position, pieceId]: [string, any]) => {
        if (position.length === 2) {
          this.pieces[position] = {
            type: this.getPieceTypeFromId(pieceId),
            color: 'b'
          };
        }
      });
    } else if (typeof boardData === 'string') {
      this.parseFEN(boardData);
    } else {

      if (Object.keys(boardData).some(key => key.length === 2 && /[a-h][1-8]/.test(key))) {
        Object.entries(boardData).forEach(([position, piece]: [string, any]) => {
          if (piece && position.length === 2) {
            this.pieces[position] = {
              type: piece.type || this.getPieceTypeFromSymbol(piece.symbol) || 'pawn',
              color: piece.color || (piece.symbol && this.getColorFromSymbol(piece.symbol)) || 'w'
            };
          }
        });
      } else if (boardData.pieces) {
        Object.entries(boardData.pieces).forEach(([position, piece]: [string, any]) => {
          if (piece && position.length === 2) {
            this.pieces[position] = {
              type: piece.type || this.getPieceTypeFromSymbol(piece.symbol) || 'pawn',
              color: piece.color || (piece.symbol && this.getColorFromSymbol(piece.symbol)) || 'w'
            };
          }
        });
      } else {
        console.warn('[Chessboard] Format de données inconnu, impossible de mettre à jour le plateau');
      }
    }

    this.selectedSquare = null;
    this.possibleMoves = [];

    this.updateTurnStatus();
  }

  /**
   * Extrait le type de pièce à partir de son identifiant.
   * @param {string} pieceId - Identifiant de la pièce (ex: "pawn1").
   * @returns {string} Type de la pièce (ex: "pawn").
   * @private
   */
  private getPieceTypeFromId(pieceId: string): string {
    return pieceId.replace(/\d+$/, '');
  }

  /**
   * Analyse une chaîne en notation FEN et met à jour l'état de l'échiquier.
   * @param {string} fen - Chaîne en notation Forsyth-Edwards.
   */
  parseFEN(fen: string) {
    this.pieces = {};

    const position = fen.split(' ')[0];
    const rows = position.split('/');

    for (let row = 0; row < 8; row++) {
      let col = 0;
      for (let char of rows[row]) {
        if ('12345678'.includes(char)) {
          col += parseInt(char);
        } else {
          const position = this.columns[col] + (8 - row);
          const color = char === char.toUpperCase() ? 'w' : 'b';
          const type = this.getPieceTypeFromSymbol(char.toLowerCase());

          this.pieces[position] = {type, color};
          col++;
        }
      }
    }
  }

  /**
   * Convertit un symbole FEN en type de pièce.
   * @param {string} char - Caractère représentant une pièce en notation FEN.
   * @returns {string} Type de pièce correspondant.
   */
  getPieceTypeFromSymbol(char: string): string {
    const pieceMap: { [key: string]: string } = {
      'p': 'pawn',
      'r': 'rook',
      'n': 'knight',
      'b': 'bishop',
      'q': 'queen',
      'k': 'king'
    };
    return pieceMap[char.toLowerCase()] || 'pawn';
  }

  /**
   * Détermine la couleur d'une pièce à partir de son symbole en notation FEN.
   *
   * @param {string} symbol - Symbole de la pièce en notation FEN.
   * @returns {string} 'w' pour les pièces blanches (symbole en majuscule) ou 'b' pour les pièces noires.
   */
  getColorFromSymbol(symbol: string): string {
    return symbol === symbol.toUpperCase() ? 'w' : 'b';
  }

  /**
   * Surligne les cases impliquées dans le dernier coup joué.
   *
   * @param {any} moveData - Données du mouvement contenant les positions de départ et d'arrivée.
   */
  highlightLastMove(moveData: any) {
    this.highlightedSquares = [];

    if (moveData) {
      if (moveData.prevCell) {
        this.highlightedSquares.push(moveData.prevCell);
      }
      if (moveData.cell) {
        this.highlightedSquares.push(moveData.cell);
      }
    }
  }

  /**
   * Détermine si une cellule contient un roi en échec
   * @param position - Position à vérifier
   * @returns {boolean} - Vrai si cette position contient un roi en échec
   */
  isKingInCheck(position: string): boolean {
    if (!this.inCheck) return false;

    const piece = this.pieces[position];
    if (!piece || piece.type !== 'king') return false;

    return this.normalizeSide(piece.color) === this.normalizeSide(this.checkingSide);
  }


  /**
   * Calcule tous les mouvements possibles pour une pièce à une position donnée.
   * Implémente les règles de déplacement spécifiques pour chaque type de pièce.
   *
   * @param {string} position - Position de la pièce en notation algébrique (ex: 'e4').
   * @returns {string[]} Liste des positions où la pièce peut se déplacer.
   */
  calculatePossibleMoves(position: string): string[] {
    if (!this.pieces[position]) return [];

    const piece = this.pieces[position];
    const moves: string[] = [];

    const col = position.charCodeAt(0) - 'a'.charCodeAt(0);
    const row = parseInt(position[1]);

    if (piece.type === 'pawn') {
      const direction = piece.color === 'w' ? 1 : -1;

      if (row + direction >= 1 && row + direction <= 8) {
        const newPos = String.fromCharCode('a'.charCodeAt(0) + col) + (row + direction);
        if (!this.pieces[newPos]) {
          moves.push(newPos);
        }
      }

      const startingRow = piece.color === 'w' ? 2 : 7;
      if (row === startingRow && !this.pieces[String.fromCharCode('a'.charCodeAt(0) + col) + (row + direction)]) {
        const newPos = String.fromCharCode('a'.charCodeAt(0) + col) + (row + 2 * direction);
        if (!this.pieces[newPos]) {
          moves.push(newPos);
        }
      }

      for (let i = -1; i <= 1; i += 2) {
        if (col + i >= 0 && col + i < 8 && row + direction >= 1 && row + direction <= 8) {
          const capturePos = String.fromCharCode('a'.charCodeAt(0) + col + i) + (row + direction);
          if (this.pieces[capturePos] && this.pieces[capturePos].color !== piece.color) {
            moves.push(capturePos);
          }
        }
      }
    }

    if (piece.type === 'rook' || piece.type === 'queen') {
      this.addMovesInDirection(moves, position, piece.color, 1, 0);  // Droite
      this.addMovesInDirection(moves, position, piece.color, -1, 0); // Gauche
      this.addMovesInDirection(moves, position, piece.color, 0, 1);  // Haut
      this.addMovesInDirection(moves, position, piece.color, 0, -1); // Bas
    }

    if (piece.type === 'bishop' || piece.type === 'queen') {
      this.addMovesInDirection(moves, position, piece.color, 1, 1);   // Diagonale haut-droite
      this.addMovesInDirection(moves, position, piece.color, 1, -1);  // Diagonale bas-droite
      this.addMovesInDirection(moves, position, piece.color, -1, 1);  // Diagonale haut-gauche
      this.addMovesInDirection(moves, position, piece.color, -1, -1); // Diagonale bas-gauche
    }

    if (piece.type === 'knight') {
      this.addKnightMoves(moves, col, row, piece.color);
    }


    if (piece.type === 'king') {
      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          if (i === 0 && j === 0) continue;

          const newCol = col + i;
          const newRow = row + j;

          if (newCol >= 0 && newCol < 8 && newRow >= 1 && newRow <= 8) {
            const newPos = String.fromCharCode('a'.charCodeAt(0) + newCol) + newRow;
            if (!this.pieces[newPos] || this.pieces[newPos].color !== piece.color) {
              moves.push(newPos);
            }
          }
        }
      }
    }

    return moves;
  }

  /**
   * Ajoute les mouvements possibles dans une direction donnée (pour les pièces à longue portée).
   * S'arrête lorsqu'une pièce est rencontrée ou lorsque le bord de l'échiquier est atteint.
   *
   * @param {string[]} moves - Tableau des mouvements possibles à compléter.
   * @param {string} position - Position initiale de la pièce.
   * @param {string} pieceColor - Couleur de la pièce ('w' ou 'b').
   * @param {number} deltaCol - Déplacement horizontal par pas (-1, 0 ou 1).
   * @param {number} deltaRow - Déplacement vertical par pas (-1, 0 ou 1).
   * @private
   */
  private addMovesInDirection(moves: string[], position: string, pieceColor: string, deltaCol: number, deltaRow: number) {
    const col = position.charCodeAt(0) - 'a'.charCodeAt(0);
    const row = parseInt(position[1]);

    let newCol = col + deltaCol;
    let newRow = row + deltaRow;

    while (newCol >= 0 && newCol < 8 && newRow >= 1 && newRow <= 8) {
      const newPos = String.fromCharCode('a'.charCodeAt(0) + newCol) + newRow;

      if (this.pieces[newPos]) {
        if (this.pieces[newPos].color !== pieceColor) {
          moves.push(newPos);
        }
        break;
      }

      moves.push(newPos);

      newCol += deltaCol;
      newRow += deltaRow;
    }
  }

  /**
   * Ajoute les mouvements possibles pour un cavalier.
   * Gère les déplacements en L caractéristiques (2 cases dans une direction, 1 dans l'autre).
   *
   * @param {string[]} moves - Tableau des mouvements possibles à compléter.
   * @param {number} col - Index de colonne (0-7) de la position actuelle.
   * @param {number} row - Numéro de rangée (1-8) de la position actuelle.
   * @param {string} pieceColor - Couleur de la pièce ('w' ou 'b').
   * @private
   */
  private addKnightMoves(moves: string[], col: number, row: number, pieceColor: string) {
    const knightMoves = [
      {x: 2, y: 1}, {x: 2, y: -1},
      {x: -2, y: 1}, {x: -2, y: -1},
      {x: 1, y: 2}, {x: 1, y: -2},
      {x: -1, y: 2}, {x: -1, y: -2}
    ];

    for (const move of knightMoves) {
      const newCol = col + move.x;
      const newRow = row + move.y;

      if (newCol >= 0 && newCol < 8 && newRow >= 1 && newRow <= 8) {
        const newPos = String.fromCharCode('a'.charCodeAt(0) + newCol) + newRow;
        if (!this.pieces[newPos] || this.pieces[newPos].color !== pieceColor) {
          moves.push(newPos);
        }
      }
    }
  }

  /**
   * Gère les clics sur les cases de l'échiquier.
   * Permet de sélectionner une pièce et de la déplacer si c'est au tour du joueur.
   *
   * @param {string} position - Position de la case cliquée en notation algébrique (ex: 'e4').
   */
  onSquareClick(position: string) {

    if (!this.isOurTurn) {
      return;
    }

    const piece = this.pieces[position];

    const isPieceOurs = piece && this.normalizeSide(piece.color) === this.normalizeSide(this.side);

    if (isPieceOurs) {
      if (this.selectedSquare === position) {
        this.selectedSquare = null;
        this.possibleMoves = [];
      } else {
        this.selectedSquare = position;

        if (!this.isOurTurn) {
          this.possibleMoves = [];
          return;
        }

        this.possibleMoves = this.calculatePossibleMoves(position);
      }
    }
    else if (this.selectedSquare && this.possibleMoves.includes(position)) {
      const playerColor = this.normalizeSide(this.side);
      const pieceId = this.findPieceIdAtPosition(this.selectedSquare, playerColor);

      if (pieceId) {
        this.selectedSquare = null;
        this.possibleMoves = [];

        this.moveMade.emit({
          figure: pieceId,
          cell: position
        });
      }
    }
  }

  /**
   * Applique visuellement un mouvement sur l'échiquier.
   * Déplace une pièce d'une position à une autre et met à jour les données du plateau.
   *
   * @param {string} from - Position de départ en notation algébrique.
   * @param {string} to - Position d'arrivée en notation algébrique.
   * @returns {boolean} Vrai si le mouvement a été appliqué avec succès, faux sinon.
   */
  applyMove(from: string, to: string) {
    if (!this.pieces[from]) {
      return false;
    }

    const piece = {...this.pieces[from]};

    delete this.pieces[from];

    this.pieces[to] = piece;

    if (this.boardData) {
      const color = piece.color;
      if (this.boardData[color]) {
        const pieceId = Object.entries(this.boardData[color]).find(
          ([pos, id]) => pos === from
        )?.[1];

        if (pieceId) {
          delete this.boardData[color][from];
          this.boardData[color][to] = pieceId;
        }
      }
    }

    this.changeDetector.detectChanges();

    return true;
  }

  /**
   * Trouve l'identifiant d'une pièce à une position donnée.
   * Utilise plusieurs stratégies pour identifier la pièce, en commençant par la recherche directe
   * dans les données du plateau, puis par déduction basée sur le type.
   *
   * @param {string} position - Position en notation algébrique où chercher la pièce.
   * @param {string} playerColor - Couleur du joueur ('w' ou 'b').
   * @returns {string|null} Identifiant de la pièce si trouvée, null sinon.
   */
  findPieceIdAtPosition(position: string, playerColor: string): string | null {
    if (!this.boardData) {
      return null;
    }

    if (this.boardData[playerColor] && this.boardData[playerColor][position]) {
      return this.boardData[playerColor][position];
    }

    const piece = this.pieces[position];
    if (piece && this.normalizeSide(piece.color) === playerColor) {
      for (const [origPos, pieceId] of Object.entries(this.boardData[playerColor] || {})) {
        if (typeof pieceId === 'string' && pieceId.startsWith(piece.type) && !this.pieces[origPos]) {

          if (!this.boardData[playerColor]) this.boardData[playerColor] = {};
          this.boardData[playerColor][position] = pieceId;
          delete this.boardData[playerColor][origPos];

          return pieceId;
        }
      }

      const fallbackId = `${piece.type}${Date.now() % 1000}`;

      if (!this.boardData[playerColor]) this.boardData[playerColor] = {};
      this.boardData[playerColor][position] = fallbackId;

      return fallbackId;
    }

    return null;
  }
}
