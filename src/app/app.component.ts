// src/app/app.component.ts
import { Component } from '@angular/core';
import { IonApp, IonRouterOutlet, Platform, ToastController } from '@ionic/angular/standalone';
import { Storage } from '@ionic/storage-angular';
import { GameSocketService } from "./service/socket-client/game-socket.service";
import { NavigationEnd, Router } from "@angular/router";
import { filter } from "rxjs";

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  standalone: true,
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent {
  constructor(
    private storage: Storage,
    private router: Router,
    private platform: Platform,
    private gameSocketService: GameSocketService,
    private toastController: ToastController
  ) {
    this.initStorage();
    this.setupAppConnectivity();
  }

  async initStorage() {
    await this.storage.create();
  }

  setupAppConnectivity() {
    // Gestion de la connectivité du socket en fonction de la navigation
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      // Connecter le socket seulement quand on est sur la page de jeu
      if (event.url.includes('/game')) {
        this.gameSocketService.connect();
      } else {
        this.gameSocketService.disconnect();
      }
    });

    // Gérer les erreurs Socket.IO
    this.gameSocketService.rawEvents$.subscribe(event => {
      if (event.event === 'exception' || event.event === 'error') {
        this.handleSocketError(event.data);
      }
    });

    // Gérer la mise en pause/reprise de l'application
    this.platform.ready().then(() => {
      this.platform.pause.subscribe(() => {
        // Déconnecter quand l'app est en arrière-plan
        this.gameSocketService.disconnect();
      });

      this.platform.resume.subscribe(() => {
        // Reconnecter si on revient sur la page de jeu
        if (this.router.url.includes('/game')) {
          this.gameSocketService.connect();
        }
      });
    });
  }

  private async handleSocketError(error: any) {
    // Ignorer les erreurs de partie non trouvée
    if (error.message?.includes('not found') || error.statusCode === 404) {
      console.log('Partie non trouvée (erreur ignorée):', error);
      return;
    }

    // Afficher les autres erreurs
    const toast = await this.toastController.create({
      message: `Erreur de connexion: ${error.message || 'Problème de communication'}`,
      duration: 2000,
      position: 'top',
      color: 'danger'
    });

    await toast.present();
  }
}
