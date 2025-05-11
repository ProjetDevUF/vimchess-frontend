import { Injectable } from '@angular/core';
import {
  CanActivate,
  CanActivateChild,
  Router,
  UrlTree
} from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from '../service/auth/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate, CanActivateChild {

  /**
   * Initialise le garde avec les services nécessaires.
   *
   * @param authService Service d'authentification pour vérifier l'état de connexion
   * @param router Service de routage pour la redirection vers la page de connexion
   */
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  /**
   * Détermine si l'utilisateur peut accéder à une route protégée.
   *
   * Vérifie si l'utilisateur est connecté via le service d'authentification.
   * Si l'utilisateur est connecté, l'accès est autorisé.
   * Sinon, l'utilisateur est redirigé vers la page de connexion.
   *
   * @returns true si l'utilisateur est connecté, sinon un UrlTree pointant vers la page de connexion
   */
  canActivate(): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    if (this.authService.isLoggedIn) {
      return true;
    }

    return this.router.createUrlTree(['/login']);
  }

  /**
   * Détermine si l'utilisateur peut accéder aux routes enfants d'une route protégée.
   *
   * Réutilise la logique de canActivate pour maintenir une gestion cohérente
   * des autorisations entre routes parentes et enfants.
   *
   * @returns Le même résultat que canActivate() : true si l'utilisateur est connecté,
   * sinon un UrlTree pointant vers la page de connexion
   */
  canActivateChild(): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    return this.canActivate();
  }
}
