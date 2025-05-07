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

  constructor(
    private http: HttpClient,
    private router: Router,
    private storage: Storage,
    private storageService: StorageService
  ) {
    this.init();
  }

  async init() {
    this._storage = await this.storage.create();
    this.checkStoredUser();
  }

  private async checkStoredUser() {
    const token = await this._storage?.get(this.tokenKey);
    const user = await this._storage?.get(this.userKey);
    if (token && user) {
      this.currentUserSubject.next(user);
    }
  }

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

  register(userData: RegisterCredentials): Observable<UserAuth> {
    const apiUrl = `${environment.apiUrl}/api/auth/register`;

    return this.http.post<UserAuth>(apiUrl, userData);
  }

  async logout() {
    await this.storageService.remove(this.tokenKey);
    await this.storageService.remove(this.refreshTokenKey);
    await this.storageService.remove(this.userKey);
    this.currentUserSubject.next(null);
    await this.router.navigate(['/login']);
  }

  getAccessToken(): string | null {
    return this.storageService.get(this.tokenKey);
  }

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

  getDeviceId(): string {
    let deviceId = localStorage.getItem('device_id');

    if (!deviceId) {
      deviceId = this.generateDeviceId();
      localStorage.setItem('device_id', deviceId);
    }

    return deviceId;
  }

  private generateDeviceId(): string {
    return uuidv4();
  }
  
  deleteAccount(id: string | undefined) {
    const apiUrl = `${environment.apiUrl}/api/users/${id}`;
    return this.http.delete<User>(apiUrl);
  }
}
