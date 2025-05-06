import {Injectable} from '@angular/core';
import {Socket} from 'ngx-socket-io';
import {AuthService} from '../auth/auth.service';
import {Observable, Subject, BehaviorSubject} from 'rxjs';
import {Lobby, Game, room} from '../../models/socket/socket-events.enum';

@Injectable({
  providedIn: 'root'
})
export class GameSocketService {
  /** Indique si la connexion au serveur de jeu est active */
  isConnected = false;

  /** Subject BehaviorSubject pour stocker la liste des parties disponibles dans le lobby */
  private lobbyGamesSubject = new BehaviorSubject<any[]>([]);

  /** Observable public pour s'abonner aux mises à jour de la liste des parties */
  public lobbyGames$ = this.lobbyGamesSubject.asObservable();

  /** Subject pour les événements bruts reçus du serveur (utile pour le débogage) */
  private rawEventsSubject = new Subject<{ event: string, data: any }>();

  /** Observable public pour s'abonner à tous les événements bruts */
  public rawEvents$ = this.rawEventsSubject.asObservable();

  /**
   * Initialise le service et configure les écouteurs d'événements de base.
   *
   * @param {Socket} socket - Instance de Socket.io pour la communication WebSocket.
   * @param {AuthService} authService - Service d'authentification pour récupérer les informations de l'utilisateur.
   */
  constructor(
    public socket: Socket,
    private authService: AuthService
  ) {
    this.setupBasicListeners();
    this.socket.on('exception', (error) => {
      console.error('[Socket] Erreur reçue du serveur:', error);
      if (error.dataSent) {
        console.error('[Socket] Données qui ont causé l\'erreur:', error.dataSent);
      }
    });

  }

  /**
   * Établit la connexion au serveur de jeu avec les identifiants de l'utilisateur.
   * Ajoute le token d'authentification et l'ID de l'appareil aux paramètres de connexion.
   * Configure les écouteurs d'événements de connexion et déconnexion.
   */
  connect(): void {
    if (this.isConnected) return;

    try {
      console.log('[Socket] Connexion au serveur...');

      const token = this.authService.getAccessToken();
      const deviceId = this.authService.getDeviceId();

      if (token) {
        this.socket.ioSocket.io.opts.query = {
          Authorization: token,
          deviceId
        };
      }

      this.socket.connect();

      this.socket.on('connect', () => {
        console.log('[Socket] Connecté au namespace game');
        this.isConnected = true;
        this.getLobbyGames();
      });

      this.socket.on('disconnect', () => {
        console.log('[Socket] Déconnecté du serveur');
        this.isConnected = false;
      });
    } catch (error) {
      console.error('[Socket] Erreur de connexion:', error);
    }
  }

  /**
   * Ferme la connexion au serveur de jeu.
   */
  disconnect(): void {
    console.log('[Socket] Déconnexion du serveur');
    this.socket.disconnect();
    this.isConnected = false;
  }

  /**
   * Configure les écouteurs d'événements de base pour le traitement des données reçues.
   * Capture tous les événements et met à jour les Subjects correspondants.
   * @private
   */
  private setupBasicListeners(): void {
    this.socket.onAny((event, data) => {
      console.log(`[Socket] Événement reçu: ${event}`, data);
      this.rawEventsSubject.next({event, data});

      if (event === Lobby.update) {
        this.lobbyGamesSubject.next(data || []);
      }
    });

    this.socket.on(Game.message, (message) => {
      console.log('[Socket] Message de chat détaillé:', message);
    });

    this.socket.on('exception', (error) => {
      console.error('[Socket] Erreur reçue:', error);
      this.rawEventsSubject.next({event: 'exception', data: error});
    });
  }

  /**
   * Rejoint une partie d'échecs existante.
   *
   * @param {number} gameId - Identifiant de la partie à rejoindre.
   */
  joinGame(gameId: number): void {
    console.log(`[Socket] Rejoindre la partie simplifiée: ${gameId}`);
    this.socket.emit('join', {gameId});
  }

  /**
   * Demande la liste des parties disponibles dans le lobby.
   * Nécessite que la connexion soit active.
   */
  getLobbyGames(): void {
    console.log('[Socket] Demande de la liste des parties');
    if (this.isConnected) {
      this.socket.emit('getLobby');
    }
  }

  /**
   * Retourne un Observable pour suivre les mises à jour de la liste des parties.
   *
   * @returns {Observable<any[]>} Observable émettant la liste mise à jour des parties.
   */
  onLobbyUpdate(): Observable<any[]> {
    return this.lobbyGames$;
  }

  /**
   * Crée une nouvelle partie d'échecs avec les paramètres spécifiés.
   * Si aucune couleur n'est spécifiée, en attribue une aléatoirement.
   *
   * @param {any} config - Configuration de la partie (couleur, temps, options).
   */
  createGame(config: any = {}): void {
    if (!config.side) {
      config.side = Math.random() < 0.5 ? 'w' : 'b';
    }

    console.log(`[Socket] Création d'une partie avec configuration:`, config);
    this.socket.emit('create', config);
  }

  /**
   * Quitte une partie d'échecs en cours.
   *
   * @param {string} gameId - Identifiant de la partie à quitter.
   */
  leaveGame(gameId: string): void {
    console.log(`[Socket] Quitter la partie #${gameId}`);
    this.socket.emit('leave', {gameId: Number(gameId)});
  }

  /**
   * Envoie un mouvement d'échecs au serveur.
   *
   * @param {number} gameId - Identifiant de la partie.
   * @param {string} figure - Identifiant de la pièce à déplacer.
   * @param {string} cell - Case de destination en notation algébrique.
   * @param {string} [side] - Couleur du joueur (optionnel).
   */
  makeMove(gameId: number, figure: string, cell: string, side?: string): void {
    console.log(`[Socket] Tentative de mouvement: pièce ${figure} vers case ${cell}`);

    const payload: any = {
      gameId,
      figure,
      cell
    };

    if (side) {
      payload.side = side;
    }

    console.log('[Socket] Envoi du coup:', payload);
    this.socket.emit('move', payload);
  }

  /**
   * Envoie un message dans le chat de la partie.
   * Récupère l'identifiant de l'utilisateur courant et l'ajoute au message.
   *
   * @param {string} gameId - Identifiant de la partie.
   * @param {string} text - Contenu du message à envoyer.
   */
  sendChatMessage(gameId: string, text: string): void {
    console.log(`[Socket] Envoi de message dans la partie #${gameId}:`, text);

    this.authService.getUserProfile().subscribe(user => {
      const userId = user?.uid || 'anonymous';
      console.log(`[Socket] Message envoyé par utilisateur #${userId}`);

      const messageData = {
        gameId: Number(gameId),
        text,
        senderId: userId
      };

      this.socket.emit('chatMessage', messageData);
    });
  }

  /**
   * Crée un Observable pour suivre les messages reçus dans le chat.
   * Traite les messages pour normaliser leur format et déterminer s'ils proviennent de l'utilisateur courant.
   *
   * @returns {Observable<any>} Observable émettant les messages de chat traités.
   */
  onGameMessage(): Observable<any> {
    return new Observable<any>(observer => {
      const subscription = this.rawEvents$.subscribe(event => {
        if (event.event === Game.message) {
          console.log('[Socket] Message brut reçu complet:', JSON.stringify(event.data));

          const messageData = {
            ...event.data,
            senderId: event.data.senderId || event.data.uid || '',
            sender: event.data.sender || event.data.username || event.data.user?.username || 'Joueur',
            text: event.data.text || event.data.message || event.data.content || ''
          };

          this.authService.getUserProfile().subscribe(user => {
            if (user) {
              messageData.isMine = (messageData.senderId === user.uid);

              if (messageData.isMine) {
                messageData.sender = 'Moi';
              }

              console.log('[Socket] Message traité:', messageData, 'Mon UID:', user.uid);
              observer.next(messageData);
            } else {
              console.log('[Socket] Message traité sans utilisateur connecté:', messageData);
              observer.next(messageData);
            }
          });
        }
      });

      return () => subscription.unsubscribe();
    });
  }
}
