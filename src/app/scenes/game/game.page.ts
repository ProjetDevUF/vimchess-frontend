import {Component, NgZone, OnDestroy, OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {
  AlertController,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
  ToastController
} from '@ionic/angular/standalone';
import {GameSocketService} from '../../service/socket-client/game-socket.service';
import {AuthService} from '../../service/auth/auth.service';
import {interval, Subject, Subscription} from 'rxjs';
import {ChessboardComponent} from '../components/chessboard/chessboard.component';
import {HeaderComponent} from "../components/header/header.component";
import {Game, Matchmaking} from "../../models/socket/socket-events.enum";
import {Router} from "@angular/router";

@Component({
  selector: 'app-game',
  templateUrl: './game.page.html',
  styleUrls: ['./game.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader, IonButtons, IonButton, IonIcon,
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
   * Indique si un roi est actuellement en échec sur l'échiquier.
   * Utilisé pour surveiller et afficher l'état d'échec pendant une partie.
   */
  isKingInCheck: boolean = false;

  /**
   * Identifie le camp qui met le roi adverse en échec ('white' ou 'black').
   * Vide si aucun roi n'est en échec.
   */
  checkingSide: string = '';

  /**
   * Indique si le joueur actuel est en situation d'échec.
   * Utilisé pour déterminer les mouvements légaux et les notifications.
   */
  isInCheck: boolean = false;

  /**
   * Identifie le camp qui est actuellement en échec ('white' ou 'black').
   * Vide si aucun camp n'est en échec.
   */
  sideInCheck: string = '';

  /**
   * Indique si le joueur est actuellement en recherche de partie.
   * Lorsque true, le joueur est dans la file d'attente de matchmaking.
   */
  matchmakingActive: boolean = false;

  /**
   * Contient les détails d'une proposition de match reçue.
   * null quand aucune proposition n'est active.
   */
  matchProposal: any = null;

  /**
   * Compte à rebours en secondes pour accepter ou refuser une proposition de match.
   * La valeur par défaut est de 30 secondes.
   */
  matchCountdown: number = 30;

  /**
   * Référence à l'intervalle qui gère le compte à rebours du matchmaking.
   * Permet d'annuler le compte à rebours si nécessaire.
   */
  matchCountdownInterval: any = null;

  /**
   * Indique si le joueur a proposé une revanche
   * Utilisé pour désactiver le bouton après que la proposition ait été envoyée
   */
  isRematchProposed: boolean = false;

  /**
   * Contient les détails d'une proposition de revanche reçue
   * null quand aucune proposition n'est active
   */
  rematchProposal: any = null;

  /**
   * Identifiant de la dernière partie terminée, utilisé pour les propositions de revanche
   */
  lastFinishedGameId: number | null = null;


  /**
   * Initialise les services nécessaires et récupère le profil utilisateur.
   *
   * @param {GameSocketService} gameSocketService - Service de communication WebSocket.
   * @param {AuthService} authService - Service d'authentification.
   * @param {ToastController} toastController - Contrôleur pour afficher des messages toast.
   * @param {AlertController} alertController - Contrôleur pour afficher des alertes.
   * @param {NgZone} ngZone - Service Angular pour exécuter du code dans la zone Angular.
   * @param router
   */
  constructor(
    public gameSocketService: GameSocketService,
    public authService: AuthService,
    private toastController: ToastController,
    private alertController: AlertController,
    private ngZone: NgZone,
    private router: Router,
  ) {
    this.authService.getUserProfile().subscribe(user => {
      this.currentUser = user;
      this.currentUserId = user?.uid || '';
    });
  }

  /**
   * Initialise la page au chargement.
   * Établit la connexion WebSocket, configure les abonnements aux événements
   * et charge la liste des parties disponibles.
   */
  ngOnInit() {
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
        if (event.event === Game.created || event.event === 'game:created') {
          this.ngZone.run(() => {
            console.log('[Game] Partie créée via matchmaking:', event.data);
            this.loading = false;
            this.matchmakingActive = false;

            if (this.matchProposal) {
              const gameId = event.data.id || event.data.gameId;
              if (gameId) {
                console.log('[Game] Auto-rejoindre la partie de matchmaking:', gameId);
                this.joinGame(gameId.toString());
              }
            }
          });
        }

        if (event.event === Matchmaking.queueStatus) {
          if (event.data.position === -1 && this.matchmakingActive) {
            this.loading = true;
          }
        }
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

    this.subscriptions.push(
      this.gameSocketService.onRematchProposed().subscribe((data: any) => {
        this.ngZone.run(() => {
          this.rematchProposal = data;
        });
      })
    );

    this.subscriptions.push(
      this.gameSocketService.onRematchAccepted().subscribe((data: any) => {
        this.ngZone.run(() => {
          this.isRematchProposed = false;
          this.rematchProposal = null;
          this.showToast('Revanche acceptée! Nouvelle partie en cours...', 'success');
        });
      })
    );

    this.subscriptions.push(
      this.gameSocketService.onRematchRejected().subscribe((data: any) => {
        this.ngZone.run(() => {
          this.isRematchProposed = false;
          this.showToast('Votre adversaire a refusé la revanche', 'warning');
        });
      })
    );

    this.subscriptions.push(
      this.gameUpdated.subscribe(update => {
        console.log('[Game] Mise à jour du jeu reçue:', update);
      })
    );

    this.refreshLobby();
  }

  /**
   * Nettoie les ressources lors de la destruction du composant.
   * Annule tous les abonnements et ferme la connexion WebSocket si nécessaire.
   */
  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = [];
    this.clearMatchCountdown();

    if (this.matchmakingActive) {
      this.leaveMatchmaking();
    }

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

      case 'game:draw-propose':
      case 'drawPropose':
        this.ngZone.run(() => {
          this.showDrawProposalAlert();
        });
        break;

      case Game.drawPropose:
      case 'game:draw_propose':
        this.ngZone.run(() => {
          this.showDrawProposalAlert();
        });
        break;

      case Game.rejectDraw:
      case 'game:draw_rejected':
        this.ngZone.run(() => {
          this.showToast('Votre proposition de nulle a été refusée', 'warning');
        });
        break;

      case Game.draw:
      case 'game:draw':
        this.ngZone.run(() => {
          this.showToast('Partie nulle acceptée!', 'success');
          this.currentGame.status = 'ended';
          this.showGameEndAlert({reason: 'draw'});
        });
        break;

      case 'game:shah':
        this.ngZone.run(() => {
          this.isInCheck = true;
          this.sideInCheck = data.side || this.currentTurn;

          const isMyKingInCheck = this.sideInCheck === this.currentGame?.side;

          if (isMyKingInCheck) {
            this.showToast('Votre roi est en échec! Vous devez résoudre cette situation.', 'warning');
          } else {
            this.showToast('Le roi adverse est en échec!', 'info');
          }
        });
        break;

      case 'game:mate':
        this.showToast('Échec et mat!', 'danger');
        break;

      case 'game:end':
        this.handleGameEnd(data);
        break;

      case Matchmaking.rematchPropose:
        this.ngZone.run(() => {
          console.log('[Game] Proposition de revanche reçue:', data);
          this.rematchProposal = data;
        });
        break;

      case Matchmaking.rematchAccept:
        this.ngZone.run(() => {
          console.log('[Game] Revanche acceptée:', data);
          this.isRematchProposed = false;
          this.rematchProposal = null;
          this.showToast('Revanche acceptée! Nouvelle partie en cours...', 'success');
        });
        break;

      case Matchmaking.rematchReject:
        this.ngZone.run(() => {
          console.log('[Game] Revanche refusée:', data);
          this.isRematchProposed = false;
          this.showToast('Votre adversaire a refusé la revanche', 'warning');
        });
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
      console.error('[Game] Erreur de mouvement:', errorData);

      let errorMessage = "Mouvement invalide";

      if (errorData.details) {
        if (errorData.details.includes("Stil shah")) {
          errorMessage = "Votre roi est toujours en échec! Vous devez d'abord résoudre cette situation.";
        } else if (errorData.details.includes("Can't move this figure in cell")) {
          errorMessage = "Ce mouvement n'est pas autorisé";
        } else if (errorData.details.includes("Not your turn")) {
          errorMessage = "Ce n'est pas votre tour";
        } else {
          errorMessage = errorData.details;
        }
      }

      this.showToast(errorMessage, 'danger');

      if (this.currentGame) {
        this.gameSocketService.socket.emit('getGame', { gameId: this.currentGame.id });
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
   * @private
   */
  private handleGameStart(data: any) {
    this.ngZone.run(() => {
      if (this.currentGame) {
        this.currentGame.status = 'started';

        if (this.currentGame.side) {
          this.currentGame.side = this.normalizeSide(this.currentGame.side);
        }

        this.currentTurn = 'w';

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
      this.isKingInCheck = false;
      this.checkingSide = '';
      this.isInCheck = false;
      this.sideInCheck = '';


      if (this.currentGame && data) {
        if (data.update) {

          this.lastMove = data.update;

          const sideWhoPlayed = data.update.side;
          if (sideWhoPlayed === 'w' || sideWhoPlayed === 'w') {
            this.currentTurn = 'b';
          } else {
            this.currentTurn = 'w';
          }

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
        this.lastFinishedGameId = this.currentGame.id;
        this.showGameEndAlert(data);
      }
    });
  }

  /**
   * Propose une revanche à l'adversaire après une partie terminée.
   */
  proposeRematch() {
    if (!this.currentGame || this.currentGame.status !== 'ended' || !this.lastFinishedGameId) {
      this.showToast('Impossible de proposer une revanche maintenant', 'danger');
      return;
    }

    const gameId = this.lastFinishedGameId;

    this.gameSocketService.socket.emit(Matchmaking.rematchPropose, { gameId });
    this.isRematchProposed = true;
    this.showToast('Proposition de revanche envoyée', 'info');
  }

  /**
   * Accepte une proposition de revanche reçue de l'adversaire.
   */
  acceptRematch() {
    if (!this.rematchProposal) {
      this.showToast('Aucune proposition de revanche à accepter', 'warning');
      return;
    }

    const gameId = this.rematchProposal.gameId;
    console.log(`[Game] Accepter la revanche pour la partie ${gameId}`);

    this.gameSocketService.socket.emit(Matchmaking.rematchAccept, { gameId });
    this.rematchProposal = null;
    this.showToast('Vous avez accepté la revanche', 'success');
    this.loading = true; // Activer l'indicateur de chargement en attendant la nouvelle partie
  }

  /**
   * Refuse une proposition de revanche reçue de l'adversaire.
   */
  rejectRematch() {
    if (!this.rematchProposal) {
      return;
    }

    const gameId = this.rematchProposal.gameId;

    this.gameSocketService.socket.emit(Matchmaking.rematchReject, { gameId });
    this.rematchProposal = null;
    this.showToast('Vous avez refusé la revanche', 'info');
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
    this.gameSocketService.getLobbyGames();
  }

  /**
   * Affiche une boîte de dialogue pour créer une nouvelle partie.
   * Permet de choisir le contrôle du temps et la couleur des pièces.
   *
   * @returns {Promise<void>}
   */
  async createGame() {
    this.loading = true;

    const alert = await this.alertController.create({
      header: 'Créer une partie',
      inputs: [
        {
          name: 'timeControl',
          type: 'text',
          placeholder: 'Contrôle du temps (ex: 5+0)',
          value: '5+0'
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
    this.loading = true;
    this.messages = [];

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

    if (this.normalizeSide(this.currentGame.side) !== this.currentTurn) {
      this.showToast("Ce n'est pas votre tour", 'danger');
      return;
    }

    if (this.isKingInCheck && this.checkingSide === this.currentGame.side) {
      this.showToast("Attention: votre roi est en échec! Vous devez prioritairement résoudre cette situation.", 'warning');
    }

    if (this.normalizeSide(this.currentGame.side) === 'b') {

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

    if (data.board) {
      this.currentGame.board = data.board;
    }

    if (data.update) {
      const sideWhoJustPlayed = this.normalizeSide(data.update.side);

      this.currentTurn = sideWhoJustPlayed === 'w' ? 'b' : 'w';

      this.lastMove = data.update;
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
   * Affiche une alerte pour demander au joueur s'il accepte la proposition de nulle.
   */
  async showDrawProposalAlert() {
    if (!this.currentGame) return;

    const alert = await this.alertController.create({
      header: 'Proposition de nulle',
      message: 'Votre adversaire propose une partie nulle. Acceptez-vous?',
      buttons: [
        {
          text: 'Refuser',
          role: 'cancel',
          handler: () => {
            const gameId = this.currentGame.id || this.currentGame.gameId;
            this.gameSocketService.socket.emit('drawReject', {gameId: Number(gameId)});
            this.showToast('Vous avez refusé la proposition de nulle', 'info');
          }
        },
        {
          text: 'Accepter',
          handler: () => {
            const gameId = this.currentGame.id || this.currentGame.gameId;
            this.gameSocketService.socket.emit('drawAccept', {gameId: Number(gameId)});
            this.showToast('Vous avez accepté la proposition de nulle', 'success');
          }
        }
      ]
    });

    await alert.present();
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

    this.messages = [];

    await alert.present();
  }

  /**
   * Rejoint la file d'attente de matchmaking
   * @param options Options de matchmaking (temps, elo, etc.)
   */
  joinMatchmaking(options: any = {}) {
    this.loading = true;
    this.matchmakingActive = true;
    this.messages = [];

    if (!this.gameSocketService.isConnected) {
      this.gameSocketService.connect();
      setTimeout(() => {
        this.gameSocketService.joinMatchmaking(options);
      }, 1000);
      return;
    }

    this.gameSocketService.joinMatchmaking(options);

    this.subscriptions.push(
      this.gameSocketService.onMatchFound().subscribe(matchData => {
        this.ngZone.run(async () => {
          this.loading = false;

          if (matchData.timeout) {
            this.showToast('Vous n\'avez pas accepté le match à temps', 'warning');
            this.matchmakingActive = false;
            this.matchProposal = null;
            this.clearMatchCountdown();
            return;
          }

          if (matchData.opponentTimeout) {
            this.showToast('Votre adversaire n\'a pas accepté le match', 'warning');
            this.matchmakingActive = false;
            this.matchProposal = null;
            this.clearMatchCountdown();
            return;
          }

          this.matchProposal = matchData;
          this.showMatchFoundAlert(matchData);
          this.startMatchCountdown();
        });
      })
    );

    this.subscriptions.push(
      this.gameSocketService.onQueueStatus().subscribe(status => {
        this.ngZone.run(() => {
          console.log('[Game] Statut de la file d\'attente:', status);
        });
      })
    );
  }


  /**
   * Quitte la file d'attente de matchmaking
   */
  leaveMatchmaking() {
    console.log('[Game] Quitter la file d\'attente de matchmaking');
    this.gameSocketService.leaveMatchmaking();
    this.loading = false;
    this.matchmakingActive = false;
    this.matchProposal = null;
    this.clearMatchCountdown();
  }


  /**
   * Accepte un match trouvé
   */
  acceptMatch() {
    if (!this.matchProposal) {
      this.showToast('Aucun match à accepter', 'warning');
      return;
    }

    // Utiliser gameId au lieu de matchId
    const gameId = this.matchProposal.gameId;

    if (!gameId) {
      this.showToast('Identifiant de match invalide', 'warning');
      console.error('[Game] Proposition de match invalide:', this.matchProposal);
      return;
    }

    console.log('[Game] Accepter le match avec gameId:', gameId);
    this.gameSocketService.acceptMatch(gameId);
    this.clearMatchCountdown();
    this.matchmakingActive = false;
    this.loading = true;
  }

  /**
   * Affiche une alerte lorsqu'un adversaire potentiel est trouvé.
   * Crée une fenêtre modale permettant au joueur d'accepter ou de refuser le match proposé,
   * avec un compte à rebours pour prendre une décision.
   *
   * @param matchData Les données du match proposé, incluant les informations sur l'adversaire
   * @returns Une promesse résolue lorsque l'alerte est affichée
   */
  async showMatchFoundAlert(matchData: any) {
    const alert = await this.alertController.create({
      header: 'Match trouvé!',
      message: `Un adversaire a été trouvé (${matchData.opponent?.username || 'Joueur'} - Elo: ${matchData.opponent?.elo || '?'}).<br>Vous avez ${this.matchCountdown} secondes pour accepter.`,
      backdropDismiss: false,
      buttons: [
        {
          text: 'Refuser',
          role: 'cancel',
          handler: () => {
            this.leaveMatchmaking();
          }
        },
        {
          text: 'Accepter',
          cssClass: 'alert-button-accept',
          handler: () => {
            this.acceptMatch();
          }
        }
      ]
    });

    await alert.present();

    this.subscriptions.push(
      interval(1000).subscribe(() => {
        if (this.matchCountdown > 0 && alert) {
          this.matchCountdown--;
          alert.message = `Un adversaire a été trouvé (${matchData.opponent?.username || 'Joueur'} - Elo: ${matchData.opponent?.elo || '?'}).<br>Vous avez ${this.matchCountdown} secondes pour accepter.`;
        } else if (this.matchCountdown <= 0) {
          alert.dismiss();
          this.leaveMatchmaking();
        }
      })
    );
  }

  /**
   * Démarre le compte à rebours pour la proposition de match.
   * Initialise le compteur à 30 secondes et décrémente chaque seconde.
   * Lorsque le compteur atteint zéro, le compte à rebours est automatiquement nettoyé.
   */
  startMatchCountdown() {
    this.matchCountdown = 30;
    this.clearMatchCountdown();

    this.matchCountdownInterval = setInterval(() => {
      this.ngZone.run(() => {
        this.matchCountdown--;

        if (this.matchCountdown <= 0) {
          this.clearMatchCountdown();
        }
      });
    }, 1000);
  }

  /**
   * Nettoie le compte à rebours du matchmaking en cours.
   * Annule l'intervalle de temps pour éviter les fuites de mémoire
   * et réinitialise la référence à l'intervalle.
   */
  clearMatchCountdown() {
    if (this.matchCountdownInterval) {
      clearInterval(this.matchCountdownInterval);
      this.matchCountdownInterval = null;
    }
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
