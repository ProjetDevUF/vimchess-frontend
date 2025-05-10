import {Component, OnInit} from '@angular/core';
import {
  IonHeader,
  IonContent,
} from '@ionic/angular/standalone';
import {AuthService} from "../../service/auth/auth.service";
import {User} from "../../models/user/user.module";
import {HeaderComponent} from "../components/header/header.component";
import {Subscription} from "rxjs";
import {CommonModule} from '@angular/common';
import {GameSocketService} from "../../service/socket-client/game-socket.service";
import {Router} from "@angular/router";

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [IonHeader, IonContent, HeaderComponent, CommonModule,],
})
export class HomePage implements OnInit {
  /**
   * Utilisateur actuellement connecté, ou null si aucun utilisateur n'est connecté.
   * Contient toutes les informations du profil utilisateur chargées depuis le serveur.
   */
  user: User | null = null;

  /**
   * Liste des utilisateurs actuellement connectés à l'application.
   * Mise à jour en temps réel via les websockets.
   */
  connectedUsers: any[] = [];

  /**
   * Collection des abonnements aux observables pour faciliter leur nettoyage lors de la destruction du composant.
   * Évite les fuites de mémoire en stockant toutes les souscriptions actives.
   */
  private subscriptions: Subscription[] = [];

  /**
   * Initialise le composant HomePage avec les services nécessaires.
   *
   * @param authService Service d'authentification pour récupérer les informations de l'utilisateur
   * @param gameSocketService Service de socket pour la gestion des connexions en temps réel
   * @param router Service de routage pour la navigation entre les pages
   */
  constructor(
    private authService: AuthService,
    private gameSocketService: GameSocketService,
    private router: Router,
  ) {
  }

  /**
   * Initialise le composant en établissant une connexion socket,
   * récupère les informations de l'utilisateur connecté et
   * s'abonne aux mises à jour de la liste des utilisateurs connectés.
   */
  ngOnInit() {
    this.gameSocketService.connect();
    this.getUser()

    this.subscriptions.push(
      this.gameSocketService.connectedUsers$.subscribe(users => {
        console.log('Utilisateurs connectés mis à jour:', users);
        this.connectedUsers = users || [];
      })
    );
  }

  /**
   * Récupère les informations du profil de l'utilisateur connecté depuis le service d'authentification.
   * Met à jour la propriété user avec les données récupérées ou affiche une erreur en cas d'échec.
   */
  getUser() {
    this.authService.getUserProfile().subscribe({
      next: (userData) => {
        this.user = userData;
      },
      error: (error) => {
        console.error('Erreur lors de la récupération du profil:', error);
      }
    });
  }

  /**
   * Navigue vers le chemin spécifié dans l'application.
   *
   * @param path Le chemin de destination pour la navigation
   */
  nagigateTo(path: string) {
    this.router.navigate([path]);
  }
}
