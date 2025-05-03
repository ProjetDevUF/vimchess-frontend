import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon,
  IonContent, IonRefresher, IonRefresherContent, IonList, IonItem,
  IonLabel, IonSpinner, IonInput, ToastController, AlertController
} from '@ionic/angular/standalone';
import { GameSocketService } from '../../service/socket-client/game-socket.service';
import { AuthService } from '../../service/auth/auth.service';
import { Subscription } from 'rxjs';

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
    IonLabel, IonSpinner, IonInput
  ]
})
export class GamePage implements OnInit, OnDestroy {
  // Liste des parties disponibles
  games: any[] = [];

  // Partie actuelle
  currentGame: any = null;

  // État de chargement
  loading: boolean = false;

  // Chat
  messages: any[] = [];
  newMessage: string = '';
  currentUserId: string = '';

  // Gestion des abonnements
  private subscriptions: Subscription[] = [];

  // Stocker l'utilisateur courant
  currentUser: any = null;

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

  ngOnInit() {
    console.log('[Game] Initialisation');

    // Se connecter au serveur
    this.gameSocketService.connect();

    // S'abonner aux mises à jour du lobby
    this.subscriptions.push(
      this.gameSocketService.onLobbyUpdate().subscribe(games => {
        this.ngZone.run(() => {
          this.games = games || [];
        });
      })
    );

    // S'abonner aux événements bruts
    this.subscriptions.push(
      this.gameSocketService.rawEvents$.subscribe(event => {
        this.handleEvent(event.event, event.data);
      })
    );

    // S'abonner aux messages de chat
    this.subscriptions.push(
      this.gameSocketService.onGameMessage().subscribe(message => {
        this.ngZone.run(() => {
          // Vérifier si c'est un de nos messages temporaires (pour éviter les doublons)
          const existingTempIndex = this.messages.findIndex(m =>
            m.tempId && m.text === message.text && m.senderId === this.currentUserId
          );

          if (existingTempIndex >= 0) {
            // Remplacer le message temporaire par celui du serveur
            this.messages[existingTempIndex] = {
              ...message,
              isMine: true
            };
          } else {
            // C'est un nouveau message (probablement de l'adversaire)
            if (message.senderId === this.currentUserId) {
              message.isMine = true;
              message.sender = 'Moi';
            }

            // Ajouter à la liste
            this.messages.push(message);
          }
        });
      })
    );

    // Charger la liste des parties
    this.refreshLobby();
  }

  ngOnDestroy() {
    // Nettoyer les abonnements
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = [];

    // Se déconnecter si plus de partie active
    if (!this.currentGame) {
      this.gameSocketService.disconnect();
    }
  }

  // Gérer les événements reçus
  private handleEvent(eventName: string, data: any) {
    console.log(`[Game] Événement: ${eventName}`, data);

    switch (eventName) {
      case 'game:created':
      case 'gameCreated':
        this.handleGameCreated(data);
        break;

      case 'game:init-data':
        // Si on n'a pas encore de partie actuelle, la définir
        if (!this.currentGame && data && data.gameId) {
          this.currentGame = {
            id: data.gameId,
            gameId: data.gameId,
            board: data.board,
            side: data.side,
            maxTime: data.maxTime,
            status: 'joined'
          };
          this.loading = false;
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
    }
  }

  // Gérer la création d'une partie
  private handleGameCreated(gameData: any) {
    this.ngZone.run(() => {
      this.loading = false;

      // Vérifier si c'est notre partie
      const gameId = gameData.id || gameData.gameId;
      const creatorId = gameData.creator?.id || gameData.creatorId;

      if (creatorId === this.currentUserId) {
        console.log('[Game] Partie créée par moi:', gameData);
        this.currentGame = gameData;
        this.showToast('Partie créée avec succès!', 'success');
      }

      // Rafraîchir le lobby
      this.refreshLobby();
    });
  }

  // Gérer un joueur qui rejoint
  private handlePlayerJoined(data: any) {
    this.ngZone.run(() => {
      if (this.currentGame) {
        const gameId = data.gameId || data.id;
        const currentGameId = this.currentGame.id || this.currentGame.gameId;

        if (String(gameId) === String(currentGameId)) {
          // Mettre à jour les joueurs
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

      // Rafraîchir le lobby
      this.refreshLobby();
    });
  }

  // Gérer le démarrage d'une partie
  private handleGameStart(data: any) {
    this.ngZone.run(() => {
      if (this.currentGame) {
        // Si data est undefined ou null, on continue quand même
        const gameId = data?.gameId || data?.id || this.currentGame.gameId || this.currentGame.id;

        // Mettre à jour le statut
        this.currentGame.status = 'started';
        this.showToast('La partie commence!', 'success');
      }
    });
  }

  // Rafraîchir la liste des parties
  refreshLobby() {
    console.log('[Game] Rafraîchissement du lobby');
    this.gameSocketService.getLobbyGames();
  }

  // Créer une nouvelle partie
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
              isPublic: true
            });
          }
        }
      ]
    });

    await alert.present();
  }

  // Rejoindre une partie
  joinGame(gameId: string) {
    console.log('[Game] Tentative de rejoindre la partie:', gameId);
    this.loading = true;

    // S'assurer d'être connecté
    if (!this.gameSocketService.isConnected) {
      this.gameSocketService.connect();
      setTimeout(() => this.doJoinGame(gameId), 1000);
      return;
    }

    this.doJoinGame(gameId);
  }

  // Effectuer la jointure
  private doJoinGame(gameId: string) {
    // Utiliser la méthode simple (déjà implémentée)
    this.gameSocketService.joinGame(Number(gameId));

    // Créer une souscription temporaire pour détecter quand on rejoint la partie
    const subscription = this.gameSocketService.rawEvents$.subscribe(event => {
      if (event.event === 'game:init-data') {
        // Récupérer les données initiales de la partie
        const gameData = event.data;

        this.ngZone.run(() => {
          // Construire l'objet de partie complet
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

          // Nettoyage
          subscription.unsubscribe();
        });
      } else if (event.event === 'exception') {
        this.ngZone.run(() => {
          this.loading = false;
          this.showToast('Impossible de rejoindre la partie', 'danger');

          // Nettoyage
          subscription.unsubscribe();
        });
      }
    });

    // Ajouter un timeout pour éviter de bloquer indéfiniment
    setTimeout(() => {
      if (this.loading) {
        this.loading = false;
        this.showToast('Délai d\'attente dépassé', 'warning');
        subscription.unsubscribe();
      }
    }, 5000);
  }

  // Quitter une partie
  leaveGame() {
    if (!this.currentGame) return;

    const gameId = this.currentGame.id || this.currentGame.gameId;
    console.log('[Game] Quitter la partie:', gameId);

    this.gameSocketService.leaveGame(String(gameId));
    this.currentGame = null;
    this.messages = [];

    // Rafraîchir le lobby
    this.refreshLobby();
  }

  // Envoyer un message de chat
  sendMessage() {
    if (!this.newMessage.trim() || !this.currentGame) return;

    const gameId = this.currentGame.id || this.currentGame.gameId;
    const messageText = this.newMessage.trim();

    console.log('[Game] Envoi de message:', messageText);

    // Envoyer au serveur
    this.gameSocketService.sendChatMessage(String(gameId), messageText);

    // Ajouter temporairement notre message localement pour un affichage immédiat
    this.messages.push({
      tempId: `temp-${Date.now()}`, // ID temporaire pour identification
      senderId: this.currentUserId,
      sender: 'Moi',
      text: messageText,
      isMine: true, // Marqueur explicite que c'est notre message
      timestamp: new Date().toISOString()
    });

    this.newMessage = '';
  }

  // Afficher un toast
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
