import { Injectable } from '@angular/core';
import { Socket } from 'ngx-socket-io';
import { AuthService } from '../auth/auth.service';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { Lobby, Game, room } from '../../models/socket/socket-events.enum';

@Injectable({
  providedIn: 'root'
})
export class GameSocketService {
  isConnected = false;

  private lobbyGamesSubject = new BehaviorSubject<any[]>([]);
  public lobbyGames$ = this.lobbyGamesSubject.asObservable();

  private rawEventsSubject = new Subject<{ event: string, data: any }>();
  public rawEvents$ = this.rawEventsSubject.asObservable();

  constructor(
    public socket: Socket,
    private authService: AuthService
  ) {
    this.setupBasicListeners();
  }

  // Méthode pour se connecter au serveur
  connect(): void {
    if (this.isConnected) return;

    try {
      console.log('[Socket] Connexion au serveur...');

      // Configurer l'authentification dans les query parameters
      const token = this.authService.getAccessToken();
      const deviceId = this.authService.getDeviceId();

      if (token) {
        this.socket.ioSocket.io.opts.query = {
          Authorization: token,
          deviceId
        };
      }

      // Se connecter
      this.socket.connect();

      // Écouter l'événement connect
      this.socket.on('connect', () => {
        console.log('[Socket] Connecté au namespace game');
        this.isConnected = true;
        this.getLobbyGames();
      });

      // Écouter l'événement disconnect
      this.socket.on('disconnect', () => {
        console.log('[Socket] Déconnecté du serveur');
        this.isConnected = false;
      });
    } catch (error) {
      console.error('[Socket] Erreur de connexion:', error);
    }
  }

  // Méthode pour se déconnecter
  disconnect(): void {
    console.log('[Socket] Déconnexion du serveur');
    this.socket.disconnect();
    this.isConnected = false;
  }

  // Configuration des écouteurs de base
  private setupBasicListeners(): void {
    // Capturer tous les événements pour faciliter le débogage
    this.socket.onAny((event, data) => {
      console.log(`[Socket] Événement reçu: ${event}`, data);
      this.rawEventsSubject.next({ event, data });

      // Traitement spécifique pour certains événements
      if (event === Lobby.update) {
        this.lobbyGamesSubject.next(data || []);
      }
    });

    // Écoute spécifique pour les messages de chat
    this.socket.on(Game.message, (message) => {
      console.log('[Socket] Message de chat détaillé:', message);
      // Le reste est géré par le Subject général
    });

    // Gestion des erreurs
    this.socket.on('exception', (error) => {
      console.error('[Socket] Erreur reçue:', error);
      this.rawEventsSubject.next({ event: 'exception', data: error });
    });
  }

  // Observable pour les erreurs socket
  onException(): Observable<any> {
    return new Observable(observer => {
      const subscription = this.rawEvents$.subscribe(event => {
        if (event.event === 'exception' || event.event === 'error') {
          observer.next(event.data);
        }
      });

      return () => subscription.unsubscribe();
    });
  }

  joinGame(gameId: number): void {
    console.log(`[Socket] Rejoindre la partie simplifiée: ${gameId}`);

    // Émettre l'événement 'join' directement
    this.socket.emit('join', { gameId });
  }


  // Méthode pour obtenir la liste des parties
  getLobbyGames(): void {
    console.log('[Socket] Demande de la liste des parties');
    if (this.isConnected) {
      this.socket.emit('getLobby');
    }
  }

  // Observable pour les mises à jour du lobby
  onLobbyUpdate(): Observable<any[]> {
    return this.lobbyGames$;
  }

  // Méthode pour créer une partie (correspond à 'create' dans votre backend)
  createGame(options: { timeControl: string, isPublic: boolean }): void {
    console.log('[Socket] Création d\'une partie:', options);

    const gameData = {
      timeControl: options.timeControl || '5+0',
      isPublic: options.isPublic,
      side: 'rand' // Valeur par défaut dans votre backend
    };

    this.socket.emit('create', gameData);
  }

  // Méthode pour rejoindre une partie (correspond à 'join' dans votre backend)
  joinGameViaLobby(gameId: number): Observable<any> {
    console.log(`[Socket] Rejoindre la partie #${gameId}`);

    const resultSubject = new Subject<any>();

    // Émettre l'événement 'join' attendu par votre backend
    this.socket.emit('join', { gameId });

    // Observer les événements pour détecter quand on a rejoint la partie
    const subscription = this.rawEvents$.subscribe(event => {
      if (event.event === Game.init || event.event === Game.start) {
        resultSubject.next(event.data);
        resultSubject.complete();
      } else if (event.event === 'exception') {
        resultSubject.error(event.data);
      }
    });

    // Nettoyer l'abonnement quand on complète l'opération
    resultSubject.subscribe({
      complete: () => subscription.unsubscribe(),
      error: () => subscription.unsubscribe()
    });

    return resultSubject.asObservable();
  }

  // Méthode pour quitter une partie (correspond à 'leave' dans votre backend)
  leaveGame(gameId: string): void {
    console.log(`[Socket] Quitter la partie #${gameId}`);
    this.socket.emit('leave', { gameId: Number(gameId) });
  }

  // Méthode pour envoyer un mouvement d'échecs (correspond à 'move' dans votre backend)
  makeMove(gameId: number, figure: string, cell: string): void {
    this.socket.emit('move', { gameId, figure, cell });
  }

  // Méthode pour envoyer un message de chat (correspond à 'chatMessage' dans votre backend)
  sendChatMessage(gameId: string, text: string): void {
    console.log(`[Socket] Envoi de message dans la partie #${gameId}:`, text);

    // Obtenir l'UID de l'utilisateur actuel pour le log local (facultatif)
    this.authService.getUserProfile().subscribe(user => {
      const userId = user?.uid || 'anonymous';
      console.log(`[Socket] Message envoyé par utilisateur #${userId}`);

      // Envoyer le message au serveur
      const messageData = {
        gameId: Number(gameId),
        text,
        // Optionnel: vous pouvez ajouter ces infos, mais le backend pourrait les ignorer
        senderId: userId
      };

      this.socket.emit('chatMessage', messageData);
    });
  }

  // Observable pour les messages de chat
  onGameMessage(): Observable<any> {
    return new Observable<any>(observer => {
      const subscription = this.rawEvents$.subscribe(event => {
        if (event.event === Game.message) {
          console.log('[Socket] Message brut reçu complet:', JSON.stringify(event.data));

          // Extraire les données du message et les étendre avec des propriétés supplémentaires
          const messageData = {
            ...event.data,
            // Tenter de récupérer l'ID d'expéditeur de tous les endroits possibles
            senderId: event.data.senderId || event.data.uid || '',
            sender: event.data.sender || event.data.username || event.data.user?.username || 'Joueur',
            text: event.data.text || event.data.message || event.data.content || ''
          };

          // Vérifier si c'est mon message en comparant avec mon UID
          this.authService.getUserProfile().subscribe(user => {
            if (user) {
              messageData.isMine = (messageData.senderId === user.uid);

              // Si c'est mon message, mettre à jour le nom d'affichage
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


  // Observable pour les événements de création de partie
  onGameCreated(): Observable<any> {
    return new Observable<any>(observer => {
      const subscription = this.rawEvents$.subscribe(event => {
        if (event.event === Game.created ||
          event.event === 'gameCreated') {
          observer.next(event.data);
        }
      });

      return () => subscription.unsubscribe();
    });
  }

  // Méthode pour obtenir les informations détaillées d'une partie
  getGameInfo(gameId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      // Vérifier d'abord si la partie est dans le lobby
      const games = this.lobbyGamesSubject.getValue();
      const game = games.find(g => String(g.id) === gameId);

      if (game) {
        resolve(game);
        return;
      }

      // Si non trouvée, essayer de rejoindre la partie temporairement
      const joinTimeout = setTimeout(() => {
        reject(new Error('Game not found'));
      }, 5000);

      this.socket.emit('join', { gameId: Number(gameId) });

      const subscription = this.rawEvents$.subscribe(event => {
        if ((event.event === Game.init || event.event === Game.start) &&
          event.data && (event.data.id === Number(gameId) || event.data.gameId === Number(gameId))) {
          clearTimeout(joinTimeout);
          subscription.unsubscribe();
          resolve(event.data);
        } else if (event.event === 'exception') {
          clearTimeout(joinTimeout);
          subscription.unsubscribe();
          reject(event.data);
        }
      });
    });
  }

  // Méthode pour marquer une partie comme non existante
  markGameAsNonExistent(gameId: string): void {
    console.log(`[Socket] Marquage de la partie #${gameId} comme non existante`);
    this.rawEventsSubject.next({
      event: 'game:nonexistent',
      data: { gameId }
    });
  }
}
