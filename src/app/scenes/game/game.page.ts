import {Component, OnInit, OnDestroy, NgZone} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon,
  IonContent, IonRefresher, IonRefresherContent, IonList, IonItem,
  IonLabel, IonSpinner, IonInput, ToastController, AlertController
} from '@ionic/angular/standalone';
import {GameSocketService} from '../../service/socket-client/game-socket.service';
import {AuthService} from '../../service/auth/auth.service';
import {Subscription, Subject} from 'rxjs';
import {ChessboardComponent} from '../components/chessboard/chessboard.component';
import {HeaderComponent} from "../components/header/header.component";

@Component({
  selector: 'app-game',
  templateUrl: './game.page.html',
  styleUrls: ['./game.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon,
    IonContent, IonRefresher, IonRefresherContent, IonList, IonItem,
    IonLabel, IonSpinner, IonInput,
    ChessboardComponent, HeaderComponent
  ]
})
export class GamePage implements OnInit, OnDestroy {
  /** Liste des parties disponibles dans le lobby */
  games: any[] = [];

  /** Données de la partie en cours */
  currentGame: any = null;

  /** Couleur dont c'est le tour ('w' pour blanc, 'b' pour noir) */
  currentTurn: string = 'w';

  /** Indicateur de chargement */
  loading: boolean = false;

  /** Dernier coup joué, utilisé pour le surlignage sur l'échiquier */
  lastMove: any = null;

  /** Messages de chat dans la partie en cours */
  messages: any[] = [];

  /** Message de chat en cours de saisie */
  newMessage: string = '';

  /** Identifiant de l'utilisateur courant */
  currentUserId: string = '';

  /** Abonnements aux observables, pour nettoyage à la destruction du composant */
  private subscriptions: Subscription[] = [];

  /** Profil de l'utilisateur connecté */
  currentUser: any = null;

  /** Subject pour signaler les mises à jour du plateau aux composants enfants */
  private gameUpdated = new Subject<any>();

  /**
   * Initialise les services nécessaires et récupère le profil utilisateur.
   *
   * @param {GameSocketService} gameSocketService - Service de communication WebSocket.
   * @param {AuthService} authService - Service d'authentification.
   * @param {ToastController} toastController - Contrôleur pour afficher des messages toast.
   * @param {AlertController} alertController - Contrôleur pour afficher des alertes.
   * @param {NgZone} ngZone - Service Angular pour exécuter du code dans la zone Angular.
   */
  constructor(
    public gameSocketService: GameSocketService,
    public authService: AuthService,
    private toastController: ToastController,
    private alertController: AlertController,
    private ngZone: NgZone
  ) {
    this.authService.getUserProfile().subscribe(user => {
      this.currentUser = user;
      this.currentUserId = user?.uid || '';
      console.log('[Game] Utilisateur actuel:', this.currentUser);
    });
  }

  /**
   * Initialise la page au chargement.
   * Établit la connexion WebSocket, configure les abonnements aux événements
   * et charge la liste des parties disponibles.
   */
  ngOnInit() {
    console.log('[Game] Initialisation');

    this.gameSocketService.connect();

    this.subscriptions.push(
      this.gameSocketService.onLobbyUpdate().subscribe(games => {
        this.ngZone.run(() => {
          this.games = games || [];
        });
      })
    );

    this.subscriptions.push(
      this.gameSocketService.rawEvents$.subscribe(event => {
        this.handleEvent(event.event, event.data);
      })
    );

    this.subscriptions.push(
      this.gameSocketService.onGameMessage().subscribe(message => {
        this.ngZone.run(() => {
          const existingTempIndex = this.messages.findIndex(m =>
            m.tempId && m.text === message.text && m.senderId === this.currentUserId
          );

          if (existingTempIndex >= 0) {
            this.messages[existingTempIndex] = {
              ...message,
              isMine: true
            };
          } else {
            if (message.senderId === this.currentUserId) {
              message.isMine = true;
              message.sender = 'Moi';
            }

            this.messages.push(message);
          }
        });
      })
    );

    // S'abonner aux mises à jour du jeu
    this.subscriptions.push(
      this.gameUpdated.subscribe(update => {
        console.log('[Game] Mise à jour du jeu reçue:', update);
      })
    );

    // Charger la liste des parties
    this.refreshLobby();
  }

  /**
   * Nettoie les ressources lors de la destruction du composant.
   * Annule tous les abonnements et ferme la connexion WebSocket si nécessaire.
   */
  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = [];

    if (!this.currentGame) {
      this.gameSocketService.disconnect();
    }
  }

  /**
   * Répartit les événements WebSocket reçus vers les gestionnaires appropriés.
   *
   * @param {string} eventName - Nom de l'événement reçu.
   * @param {any} data - Données associées à l'événement.
   * @private
   */
  private handleEvent(eventName: string, data: any) {
    console.log(`[Game] Événement: ${eventName}`, data);

    switch (eventName) {
      case 'game:created':
      case 'gameCreated':
        this.handleGameCreated(data);
        break;

      case 'game:init-data':
        if (data && data.gameId) {
          console.log('[Game] Données initiales reçues:', data);

          let playerSide = data.side || 'w';
          const sideLower = playerSide.toLowerCase();

          if (sideLower === 'w') {
            playerSide = 'w';
          } else if (sideLower === 'b') {
            playerSide = 'b';
          }

          this.currentGame = {
            id: data.gameId,
            gameId: data.gameId,
            board: data.board,
            side: playerSide,
            maxTime: data.maxTime,
            status: data.status || 'joined'
          };

          console.log(`[Game] Partie initialisée avec couleur: ${playerSide}`);
          this.loading = false;
        }
        break;

      case 'game:board-update':
      case 'boardUpdate':
        this.handleBoardUpdate(data);
        break;

      case 'game:move':
      case 'move':
        if (data && (data.board || data.update)) {
          this.handleBoardUpdate(data);
        }
        break;

      case 'error':
      case 'exception':
        if (data && data.dataSent && data.dataSent.figure) {
          this.handleMoveError(data);
        }
        break;

      case 'joined':
      case 'playerJoined':
        this.handlePlayerJoined(data);
        break;

      case 'game:start':
      case 'gameStart':
        this.handleGameStart(data);
        break;

      case 'game:shah':
        this.showToast('Échec!', 'warning');
        break;

      case 'game:mate':
        this.showToast('Échec et mat!', 'danger');
        break;

      case 'game:end':
        this.handleGameEnd(data);
        break;
    }
  }

  /**
   * Gère l'événement de création d'une partie.
   *
   * @param {any} gameData - Données de la partie créée.
   * @private
   */
  private handleGameCreated(gameData: any) {
    this.ngZone.run(() => {
      this.loading = false;

      const creatorId = gameData.creator?.id || gameData.creatorId;

      if (creatorId === this.currentUserId) {
        console.log('[Game] Partie créée par moi:', gameData);
        this.currentGame = gameData;
        this.showToast('Partie créée avec succès!', 'success');
      }

      this.refreshLobby();
    });
  }

  /**
   * Gère les erreurs liées aux mouvements de pièces.
   * Affiche un message d'erreur approprié et restaure l'état du plateau si nécessaire.
   *
   * @param {any} errorData - Données d'erreur reçues du serveur.
   * @private
   */
  private handleMoveError(errorData: any) {
    this.ngZone.run(() => {
      console.error('[Game] Erreur de mouvement complète:', errorData);
      console.error('[Game] Données envoyées qui ont causé l\'erreur:', errorData.dataSent);
      console.error(`[Game] Statut actuel:
      - Ma couleur: ${this.currentGame?.side}
      - Tour actuel: ${this.currentTurn}
      - Est-ce mon tour (calculé): ${this.normalizeSide(this.currentGame?.side) === this.normalizeSide(this.currentTurn)}
    `);

      let errorMessage = "Mouvement invalide";

      if (errorData.details) {
        if (errorData.details.includes("Can't move this figure in cell")) {
          errorMessage = "Ce mouvement n'est pas autorisé";
        } else if (errorData.details.includes("Not your turn")) {
          errorMessage = "Ce n'est pas votre tour";
        } else {
          errorMessage = errorData.details;
        }
      }

      this.showToast(errorMessage, 'danger');

      if (this.currentGame && this.currentGame.board) {
        const currentBoard = {...this.currentGame.board};
        setTimeout(() => {
          this.currentGame.board = null;
          setTimeout(() => {
            this.currentGame.board = currentBoard;
          }, 10);
        }, 10);
      }
    });
  }

  /**
   * Gère l'événement d'un joueur rejoignant la partie.
   * Met à jour la liste des joueurs et affiche une notification.
   *
   * @param {any} data - Données du joueur qui a rejoint.
   * @private
   */
  private handlePlayerJoined(data: any) {
    this.ngZone.run(() => {
      if (this.currentGame) {
        const gameId = data.gameId || data.id;
        const currentGameId = this.currentGame.id || this.currentGame.gameId;

        if (String(gameId) === String(currentGameId)) {
          if (data.players) {
            this.currentGame.players = data.players;
          } else if (data.player) {
            if (!this.currentGame.players) {
              this.currentGame.players = [];
            }

            const playerExists = this.currentGame.players.some(
              (p: any) => p.id === data.player.id || p.uid === data.player.uid
            );

            if (!playerExists) {
              this.currentGame.players.push(data.player);
              this.showToast('Un joueur a rejoint la partie!', 'info');
            }
          }
        }
      }

      this.refreshLobby();
    });
  }

  /**
   * Gère le démarrage d'une partie.
   * Initialise le tour et met à jour le statut du jeu.
   *
   * @param {any} data - Données de démarrage de la partie.
   * @private
   */
  private handleGameStart(data: any) {
    this.ngZone.run(() => {
      if (this.currentGame) {
        this.currentGame.status = 'started';

        if (this.currentGame.side) {
          const normalizedSide = this.normalizeSide(this.currentGame.side);
          this.currentGame.side = normalizedSide;
        }

        this.currentTurn = 'w';

        console.log(`[Game] Partie démarrée:
        - Tour actuel: ${this.currentTurn}
        - Ma couleur: ${this.currentGame.side}
        - Est-ce mon tour: ${this.currentGame.side === this.currentTurn}
        - Données reçues:`, data);

        this.showToast('La partie commence!', 'success');
      }
    });
  }

  /**
   * Normalise les différentes représentations des couleurs vers un format standard.
   *
   * @param {string} side - Chaîne représentant une couleur ('white', 'w', 'black', 'b', etc.).
   * @returns {string} Format normalisé ('w' pour blanc, 'b' pour noir).
   */
  private normalizeSide(side: string): string {
    if (!side) return 'white';

    const sideLower = side.toLowerCase();
    if (sideLower === 'w' || sideLower.startsWith('w')) return 'w';
    if (sideLower === 'b' || sideLower.startsWith('b')) return 'b';
    return sideLower;
  }

  /**
   * Gère les mises à jour du plateau d'échecs.
   * Met à jour l'état du jeu, le tour courant et le dernier coup joué.
   *
   * @param {any} data - Données de mise à jour du plateau.
   * @private
   */
  private handleBoardUpdate(data: any) {
    this.ngZone.run(() => {
      if (this.currentGame && data) {
        console.log('[Game] Mise à jour du plateau complet:', data);

        if (data.update) {

          console.log('[Game] Données du dernier mouvement:', JSON.stringify(data.update));
          console.log('[Game] prevCell:', data.update.prevCell);
          console.log('[Game] cell:', data.update.cell);
          console.log('[Game] figure:', data.update.figure);


          this.lastMove = data.update;

          const sideWhoPlayed = data.update.side;
          if (sideWhoPlayed === 'w' || sideWhoPlayed === 'w') {
            this.currentTurn = 'b';
          } else {
            this.currentTurn = 'w';
          }

          console.log(`[Game] Tour mis à jour: ${this.currentTurn}`);
        } else {
          console.warn('[Game] Reçu une mise à jour du plateau sans données de coup');
        }

        if (data.board) {
          this.currentGame.board = data.board;
        }

        this.processGameUpdate(data);
      }
    });
  }

  /**
   * Gère la fin d'une partie.
   * Affiche un message approprié selon la raison de fin et met à jour le statut.
   *
   * @param {any} data - Données de fin de partie.
   * @private
   */
  private handleGameEnd(data: any) {
    this.ngZone.run(() => {
      if (this.currentGame) {
        let message = 'Partie terminée';
        let color = 'primary';

        if (data.reason) {
          switch (data.reason) {
            case 'mate':
              message = 'Échec et mat!';
              color = 'danger';
              break;
            case 'surrender':
              message = 'Abandon de l\'adversaire!';
              color = 'success';
              break;
            case 'draw':
              message = 'Partie nulle!';
              color = 'warning';
              break;
            case 'timeout':
              message = 'Temps écoulé!';
              color = 'danger';
              break;
            case 'playerLeave':
              message = 'L\'adversaire a quitté la partie!';
              color = 'success';
              break;
          }
        }

        this.showToast(message, color);

        this.currentGame.status = 'ended';

        this.showGameEndAlert(data);
      }
    });
  }

  /**
   * Affiche une alerte avec les détails de fin de partie.
   *
   * @param {any} data - Données de fin de partie.
   * @returns {Promise<void>}
   */
  async showGameEndAlert(data: any) {
    const alert = await this.alertController.create({
      header: 'Partie terminée',
      message: `La partie est terminée. Raison: ${data.reason || 'Non spécifiée'}`,
      buttons: [
        {
          text: 'OK',
          handler: () => {
            this.currentGame = null;
            this.refreshLobby();
          }
        }
      ]
    });

    await alert.present();
  }

  /**
   * Rafraîchit la liste des parties disponibles dans le lobby.
   */
  refreshLobby() {
    console.log('[Game] Rafraîchissement du lobby');
    this.gameSocketService.getLobbyGames();
  }

  /**
   * Affiche une boîte de dialogue pour créer une nouvelle partie.
   * Permet de choisir le contrôle du temps et la couleur des pièces.
   *
   * @returns {Promise<void>}
   */
  async createGame() {
    console.log('[Game] Création d\'une partie');
    this.loading = true;

    const alert = await this.alertController.create({
      header: 'Créer une partie',
      inputs: [
        {
          name: 'timeControl',
          type: 'text',
          placeholder: 'Contrôle du temps (ex: 5+0)',
          value: '5+0'
        },
        {
          name: 'side',
          type: 'radio',
          label: 'Aléatoire',
          value: 'rand',
          checked: true
        },
        {
          name: 'side',
          type: 'radio',
          label: 'Blanc',
          value: 'w'
        },
        {
          name: 'side',
          type: 'radio',
          label: 'Noir',
          value: 'b'
        }
      ],
      buttons: [
        {
          text: 'Annuler',
          role: 'cancel',
          handler: () => {
            this.loading = false;
          }
        },
        {
          text: 'Créer',
          handler: (data) => {
            this.gameSocketService.createGame({
              timeControl: data.timeControl,
              side: data.side || 'rand',
              isPublic: true
            });
          }
        }
      ]
    });

    await alert.present();
  }

  /**
   * Rejoint une partie existante par son identifiant.
   * S'assure que la connexion WebSocket est active avant de tenter de rejoindre.
   *
   * @param {string} gameId - Identifiant de la partie à rejoindre.
   */
  joinGame(gameId: string) {
    console.log('[Game] Tentative de rejoindre la partie:', gameId);
    this.loading = true;

    if (!this.gameSocketService.isConnected) {
      this.gameSocketService.connect();
      setTimeout(() => this.doJoinGame(gameId), 1000);
      return;
    }

    this.doJoinGame(gameId);
  }

  /**
   * Effectue la jointure à une partie et gère la réception des données initiales.
   *
   * @param {string} gameId - Identifiant de la partie à rejoindre.
   * @private
   */
  private doJoinGame(gameId: string) {
    this.gameSocketService.joinGame(Number(gameId));

    const subscription = this.gameSocketService.rawEvents$.subscribe(event => {
      if (event.event === 'game:init-data') {
        const gameData = event.data;

        this.ngZone.run(() => {
          this.currentGame = {
            id: gameData.gameId,
            gameId: gameData.gameId,
            board: gameData.board,
            side: gameData.side,
            maxTime: gameData.maxTime,
            status: 'joined'
          };

          this.loading = false;
          this.showToast('Partie rejointe avec succès!', 'success');

          subscription.unsubscribe();
        });
      } else if (event.event === 'exception') {
        this.ngZone.run(() => {
          this.loading = false;
          this.showToast('Impossible de rejoindre la partie', 'danger');

          subscription.unsubscribe();
        });
      }
    });

    setTimeout(() => {
      if (this.loading) {
        this.loading = false;
        this.showToast('Délai d\'attente dépassé', 'warning');
        subscription.unsubscribe();
      }
    }, 5000);
  }

  /**
   * Quitte la partie en cours et retourne au lobby.
   */
  leaveGame() {
    if (!this.currentGame) return;

    const gameId = this.currentGame.id || this.currentGame.gameId;
    console.log('[Game] Quitter la partie:', gameId);

    this.gameSocketService.leaveGame(String(gameId));
    this.currentGame = null;
    this.messages = [];
    this.lastMove = null;

    this.refreshLobby();
  }

  /**
   * Gère un mouvement de pièce émis par le composant échiquier.
   * Envoie le mouvement au serveur via WebSocket.
   *
   * @param {Object} moveData - Données du mouvement.
   * @param {string} moveData.figure - Identifiant de la pièce à déplacer.
   * @param {string} moveData.cell - Case de destination en notation algébrique.
   */
  handleMove(moveData: { figure: string, cell: string }) {
    if (!this.currentGame) return;

    const gameId = this.currentGame.id || this.currentGame.gameId;
    console.log(`[Game] Coup joué: pièce ${moveData.figure} vers case ${moveData.cell}`);

    console.log(`[Game] Vérification du tour: mon côté=${this.currentGame.side}, tour actuel=${this.currentTurn}`);

    if (this.normalizeSide(this.currentGame.side) === 'b') {
      console.log('[Game] Envoi d\'un coup en tant que joueur noir avec side=b');

      this.gameSocketService.socket.emit('move', {
        gameId: Number(gameId),
        figure: moveData.figure,
        cell: moveData.cell,
        side: 'b'
      });
    } else {
      this.gameSocketService.makeMove(
        Number(gameId),
        moveData.figure,
        moveData.cell
      );
    }
  }

  /**
   * Envoie un message dans le chat de la partie en cours.
   * Ajoute temporairement le message localement pour un affichage immédiat.
   */
  sendMessage() {
    if (!this.newMessage.trim() || !this.currentGame) return;

    const gameId = this.currentGame.id || this.currentGame.gameId;
    const messageText = this.newMessage.trim();

    console.log('[Game] Envoi de message:', messageText);

    this.gameSocketService.sendChatMessage(String(gameId), messageText);

    this.messages.push({
      tempId: `temp-${Date.now()}`,
      senderId: this.currentUserId,
      sender: 'Moi',
      text: messageText,
      isMine: true,
      timestamp: new Date().toISOString()
    });

    this.newMessage = '';
  }

  /**
   * Traite les mises à jour du plateau reçues du serveur.
   * Met à jour l'état du jeu et notifie les composants abonnés.
   *
   * @param {any} data - Données de mise à jour du plateau.
   */
  public processGameUpdate(data: any) {
    if (!data || !this.currentGame) return;

    console.log('[GameService] Traitement d\'une mise à jour de jeu', data);

    if (data.board) {
      this.currentGame.board = data.board;
    }

    if (data.update) {
      const sideWhoJustPlayed = this.normalizeSide(data.update.side);

      this.currentTurn = sideWhoJustPlayed === 'w' ? 'b' : 'w';

      this.lastMove = data.update;

      console.log(`[GameService] Mise à jour du tour:
      - Joueur qui vient de jouer: ${sideWhoJustPlayed}
      - Prochain tour: ${this.currentTurn}
      - Mon côté: ${this.currentGame.side}
      - Est-ce mon tour: ${this.currentTurn === this.normalizeSide(this.currentGame.side)}
    `);
    }

    this.gameUpdated.next({
      board: this.currentGame.board,
      turn: this.currentTurn,
      lastMove: this.lastMove
    });
  }

  /**
   * Propose une partie nulle à l'adversaire.
   */
  proposeDraw() {
    if (!this.currentGame) return;

    const gameId = this.currentGame.id || this.currentGame.gameId;
    this.gameSocketService.socket.emit('drawPropose', {gameId: Number(gameId)});
    this.showToast('Proposition de nulle envoyée', 'info');
  }

  /**
   * Affiche une confirmation d'abandon de partie.
   *
   * @returns {Promise<void>}
   */
  async surrender() {
    if (!this.currentGame) return;

    const alert = await this.alertController.create({
      header: 'Abandonner',
      message: 'Êtes-vous sûr de vouloir abandonner cette partie?',
      buttons: [
        {
          text: 'Annuler',
          role: 'cancel'
        },
        {
          text: 'Abandonner',
          handler: () => {
            const gameId = this.currentGame.id || this.currentGame.gameId;
            this.gameSocketService.socket.emit('surrender', {gameId: Number(gameId)});
          }
        }
      ]
    });

    await alert.present();
  }

  /**
   * Affiche un message toast à l'utilisateur.
   *
   * @param {string} message - Message à afficher.
   * @param {string} color - Couleur du toast (primary, success, warning, danger, etc.).
   * @returns {Promise<void>}
   */
  async showToast(message: string, color: string = 'primary') {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      color,
      position: 'top'
    });

    await toast.present();
  }
}
