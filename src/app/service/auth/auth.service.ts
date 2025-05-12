import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Router} from '@angular/router';
import {BehaviorSubject, catchError, Observable, switchMap, tap, throwError} from 'rxjs';
import {environment} from '../../../environments/environment';
import {Storage} from '@ionic/storage-angular';
import {LoginCredentials, RegisterCredentials, User, UserAuth} from "../../models/user/user.module";
import {StorageService} from "../storage/storage.service";
import {v4 as uuidv4} from 'uuid';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private _storage: Storage | null = null;
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser = this.currentUserSubject.asObservable();
  private readonly userKey = 'user_data';
  private readonly tokenKey = 'access_token';
  private readonly refreshTokenKey = 'refresh_token';
  private readonly deviceKey = 'device_id';

  /**
   * Initialise le service d'authentification.
   *
   * @param http - Client HTTP pour effectuer des requêtes vers l'API.
   * @param router - Service de routage pour la navigation dans l'application.
   * @param storage - Service de stockage pour persister les données utilisateur.
   * @param storageService - Service offrant des méthodes simplifiées pour le stockage.
   */
  constructor(
    private http: HttpClient,
    private router: Router,
    private storage: Storage,
    private storageService: StorageService
  ) {
    this.init();
  }

  /**
   * Initialise le stockage et vérifie si un utilisateur est déjà connecté.
   * Cette méthode est appelée automatiquement lors de l'initialisation du service.
   */
  async init() {
    this._storage = await this.storage.create();
    this.checkStoredUser();
  }

  /**
   * Vérifie si un utilisateur est présent dans le stockage local et met à jour le BehaviorSubject.
   * @private
   */
  private async checkStoredUser() {
    const token = await this._storage?.get(this.tokenKey);
    const user = await this._storage?.get(this.userKey);
    if (token && user) {
      this.currentUserSubject.next(user);
    }
  }

  /**
   * Vérifie si un utilisateur est actuellement connecté.
   * Si un token est présent mais que les données utilisateur ne sont pas disponibles,
   * tente de récupérer le profil utilisateur.
   *
   * @returns {boolean} - True si l'utilisateur est connecté, false sinon.
   */
  get isLoggedIn(): boolean {
    const token = this.storageService.get(this.tokenKey);
    if (!token) {
      return false;
    }

    const userData = this.storageService.get(this.userKey);

    if (!userData) {
      this.getUserProfile().subscribe({
        next: () => console.log('Profil utilisateur récupéré automatiquement'),
        error: () => {
          this.storageService.remove('token');
          this.storageService.remove('refresh_token');
          console.error('Token invalide détecté, déconnexion automatique');
        }
      });
    }
    return true;
  }

  /**
   * Connecte un utilisateur avec ses identifiants.
   * Stocke les tokens d'authentification et récupère le profil utilisateur après connexion.
   *
   * @param {LoginCredentials} credentials - Identifiants de connexion (email, mot de passe, appareil).
   * @returns {Observable<UserAuth>} - Observable contenant les informations d'authentification.
   */
  login(credentials: LoginCredentials): Observable<UserAuth> {
    const apiUrl = `${environment.apiUrl}/api/auth/login`;

    return this.http.post<UserAuth>(apiUrl, credentials).pipe(
      tap(response => {
        this.storageService.set(this.tokenKey, response.accessToken);
        this.storageService.set(this.refreshTokenKey, response.refreshToken);

        this.getUserProfile().subscribe({
          next: (user) => {
            this.currentUser = new BehaviorSubject<User | null>(user);
          },
          error: (err) => {
            return throwError(() => new Error('Impossible de se connecter'))
          }
        });
      })
    );
  }

  /**
   * Inscrit un nouvel utilisateur avec les informations fournies.
   *
   * @param {RegisterCredentials} userData - Données d'inscription (nom, email, mot de passe, etc.).
   * @returns {Observable<UserAuth>} - Observable contenant les informations d'authentification.
   */
  register(userData: RegisterCredentials): Observable<UserAuth> {
    const apiUrl = `${environment.apiUrl}/api/auth/register`;

    return this.http.post<UserAuth>(apiUrl, userData);
  }

  /**
   * Déconnecte l'utilisateur actuel.
   * Supprime les tokens et les informations utilisateur du stockage,
   * puis redirige vers la page de connexion.
   */
  async logout() {
    await this.storageService.remove(this.tokenKey);
    await this.storageService.remove(this.refreshTokenKey);
    await this.storageService.remove(this.userKey);
    await this.storageService.remove(this.deviceKey);
    this.currentUserSubject.next(null);
    await this.router.navigate(['/login']);
  }

  /**
   * Récupère le token d'accès depuis le stockage.
   *
   * @returns {string|null} - Le token d'accès ou null s'il n'existe pas.
   */
  getAccessToken(): string | null {
    return this.storageService.get(this.tokenKey);
  }

  /**
   * Rafraîchit le token d'accès à l'aide du refresh token.
   * En cas d'échec, déconnecte l'utilisateur.
   *
   * @returns {Observable<UserAuth>} - Observable contenant les nouveaux tokens.
   */
  refreshToken(): Observable<UserAuth> {
    const refreshToken = this.storageService.get(this.refreshTokenKey);

    if (!refreshToken) {
      return throwError(() => new Error('Aucun refresh token disponible'));
    }

    const apiUrl = `${environment.apiUrl}/api/auth/refresh-token`;

    return this.http.post<UserAuth>(apiUrl, { refreshToken }).pipe(
      tap(response => {
        this.storageService.set(this.tokenKey, response.accessToken);
        this.storageService.set(this.refreshTokenKey, response.refreshToken);
      }),
      catchError(error => {
        this.logout();
        return throwError(() => new Error('Session expirée, veuillez vous reconnecter'));
      })
    );
  }

  /**
   * Récupère le profil de l'utilisateur connecté.
   * Si le token est expiré, tente de le rafraîchir et réessaie.
   *
   * @returns {Observable<User>} - Observable contenant les informations de l'utilisateur.
   */
  getUserProfile(): Observable<User> {
    const token = this.storageService.get(this.tokenKey);
    if (!token) {
      return throwError(() => new Error('Pas de token disponible'));
    }
    const apiUrl = `${environment.apiUrl}/api/users/me`;

    return this.http.get<User>(apiUrl, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }).pipe(
      tap(user => {
        this.storageService.set(this.userKey, user);
        this.currentUserSubject.next(user);
      }),
      catchError(error => {
        return this.refreshToken().pipe(
          switchMap(() => {
            const newToken = this.storageService.get(this.refreshTokenKey);
            console.log('refreshToken: ', newToken);
            return this.http.get<User>(apiUrl, {
              headers: {
                Authorization: `Bearer ${newToken}`
              }
            }).pipe(
              tap(user => {
                console.log('Profil utilisateur récupéré après rafraîchissement:', user);
                this.storageService.set(this.userKey, user);
                this.currentUserSubject.next(user);
              })
            );
          })
        );

      })
    );
  }

  /**
   * Met à jour le profil de l'utilisateur.
   * Après la mise à jour, actualise les données stockées localement.
   *
   * @param {Partial<User>} userData - Données à mettre à jour (champs partiels).
   * @returns {Observable<User>} - Observable contenant les informations mises à jour.
   */
  updateUserProfile(userData: Partial<User>): Observable<User> {
    const apiUrl = `${environment.apiUrl}/api/users/profile`;
    return this.http.put<User>(apiUrl, userData).pipe(
      tap((updatedUser) => {
        const currentUser = this.currentUserSubject.value;
        if (currentUser) {
          const newUserData = {...currentUser, ...updatedUser};
          this._storage?.set(this.userKey, newUserData);
          this.currentUserSubject.next(newUserData);
        }
      })
    );
  }

  /**
   * Récupère l'identifiant unique de l'appareil.
   * Si l'identifiant n'existe pas, en génère un nouveau.
   *
   * @returns {string} - Identifiant unique de l'appareil.
   */
  getDeviceId(): string {
    let deviceId = localStorage.getItem('device_id');

    if (!deviceId) {
      deviceId = this.generateDeviceId();
      localStorage.setItem('device_id', deviceId);
    }

    return deviceId;
  }

  /**
   * Génère un nouvel identifiant unique pour l'appareil.
   *
   * @private
   * @returns {string} - Identifiant UUID v4 généré.
   */
  private generateDeviceId(): string {
    return uuidv4();
  }

  /**
   * Supprime le compte utilisateur identifié par l'ID fourni.
   *
   * @param {string|undefined} id - Identifiant de l'utilisateur à supprimer.
   * @returns {Observable<User>} - Observable confirmant la suppression.
   */
  deleteAccount(id: string | undefined) {
    const apiUrl = `${environment.apiUrl}/api/users/${id}`;
    return this.http.delete<User>(apiUrl);
  }
}
