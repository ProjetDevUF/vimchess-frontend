import { Component, OnInit } from '@angular/core';
import { AuthService } from "../../../service/auth/auth.service";
import {Router, RouterLink} from '@angular/router';
import { User } from '../../../models/user/user.module';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  imports: [
    RouterLink,
  ]
})
export class HeaderComponent implements OnInit {

  /**
   * Indique si un utilisateur est actuellement connecté
   * Utilisé pour conditionner l'affichage de certains éléments de navigation
   */
  isLoggedIn = false;

  /**
   * Données de l'utilisateur actuellement connecté
   * null si aucun utilisateur n'est connecté
   */
  currentUser: User | null = null;

  /**
   * État d'ouverture du menu mobile/responsive
   * Contrôle l'affichage du menu sur les appareils à petit écran
   */
  isMenuOpen = false;

  /**
   * Initialise le composant avec les services nécessaires
   *
   * @param authService Service d'authentification pour gérer l'état de connexion
   * @param router Service de routage pour la navigation entre les pages
   */
  constructor(
    public authService: AuthService,
    private router: Router
  ) { }

  /**
   * Initialise le composant lors de son chargement
   * S'abonne aux changements d'état de l'utilisateur courant
   */
  ngOnInit() {
    this.authService.currentUser.subscribe(user => {
      this.currentUser = user;
      this.isLoggedIn = !!user;
    });
  }

  /**
   * Bascule l'état d'ouverture du menu mobile
   * Appelé lorsque l'utilisateur clique sur le bouton de menu hamburger
   */
  toggleMenu() {
    this.isMenuOpen = !this.isMenuOpen;
  }

  /**
   * Déconnecte l'utilisateur actuel
   * Ferme le menu mobile avant de déclencher la déconnexion
   */
  logout() {
    this.isMenuOpen = false;
    this.authService.logout();
  }
}
