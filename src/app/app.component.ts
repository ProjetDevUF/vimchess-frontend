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

  /**
   * Initialise le composant racine de l'application.
   * Configure le stockage et les mécanismes de connectivité.
   *
   * @param storage - Service de stockage pour l'application.
   * @param router - Service de routage pour la navigation.
   * @param platform - Service pour interagir avec la plateforme native.
   * @param gameSocketService - Service de connexion socket pour les jeux.
   * @param toastController - Contrôleur pour afficher des notifications toast.
   */
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

  /**
   * Initialise le stockage de l'application.
   * Cette méthode est appelée au démarrage de l'application.
   */
  async initStorage() {
    await this.storage.create();
  }

  /**
   * Gère la connexion du socket en fonction de la route actuelle.
   * Connecte le socket sur toutes les routes authentifiées et le déconnecte
   * uniquement sur les routes d'authentification spécifiques.
   *
   * @param url La route actuelle de l'application
   * @returns {boolean} Vrai si le socket doit être connecté
   */
  private shouldConnectSocket(url: string): boolean {
    const excludedRoutes = ['/login', '/register'];
    return !excludedRoutes.some(route => url.includes(route));
  }

  /**
   * Configure la gestion de la connectivité des sockets en fonction de la navigation.
   * Établit des abonnements pour gérer :
   * - La connexion/déconnexion automatique selon les routes
   * - Les erreurs de socket
   * - Les événements de mise en pause/reprise de l'application
   */
  setupAppConnectivity() {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      if (this.shouldConnectSocket(event.url)) {
        this.gameSocketService.connect();
      } else {
        this.gameSocketService.disconnect();
      }
    });

    this.gameSocketService.rawEvents$.subscribe(event => {
      if (event.event === 'exception' || event.event === 'error') {
        this.handleSocketError(event.data);
      }
    });

    this.platform.ready().then(() => {
      this.platform.pause.subscribe(() => {
        this.gameSocketService.disconnect();
      });

      this.platform.resume.subscribe(() => {
        if (this.shouldConnectSocket(this.router.url)) {
          this.gameSocketService.connect();
        }
      });
    });
  }

  /**
   * Gère les erreurs de socket en affichant des notifications appropriées.
   * Ignore certaines erreurs non critiques comme "partie non trouvée".
   *
   * @param {any} error - L'erreur de socket à traiter.
   * @private
   */
  private async handleSocketError(error: any) {
    if (error.message?.includes('not found') || error.statusCode === 404) {
      console.log('Partie non trouvée (erreur ignorée):', error);
      return;
    }

    const toast = await this.toastController.create({
      message: `Erreur de connexion: ${error.message || 'Problème de communication'}`,
      duration: 2000,
      position: 'top',
      color: 'danger'
    });

    await toast.present();
  }
}
