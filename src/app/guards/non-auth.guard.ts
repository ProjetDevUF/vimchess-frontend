import { Injectable } from '@angular/core';
import {
  CanActivate,
  Router,
  UrlTree
} from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from '../service/auth/auth.service';

@Injectable({
  providedIn: 'root'
})
export class NonAuthGuard implements CanActivate {

  /**
   * Initialise le garde avec les services nécessaires.
   *
   * @param authService Service d'authentification pour vérifier l'état de connexion
   * @param router Service de routage pour la redirection vers la page d'accueil
   */
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  /**
   * Détermine si l'utilisateur peut accéder à une route protégée par ce garde.
   *
   * Vérifie si l'utilisateur n'est PAS connecté via le service d'authentification.
   * Si l'utilisateur n'est pas connecté, l'accès est autorisé.
   * Si l'utilisateur est déjà connecté, il est redirigé vers la page d'accueil.
   *
   * @returns true si l'utilisateur n'est pas connecté, sinon un UrlTree pointant vers la page d'accueil
   */
  canActivate(): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    if (!this.authService.isLoggedIn) {
      return true;
    }

    return this.router.createUrlTree(['/home']);
  }
}
