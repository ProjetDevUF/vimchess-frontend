import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, from, of } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { Storage } from '@ionic/storage-angular';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private currentUserSubject = new BehaviorSubject<any>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  private _storage: Storage | null = null;
  private tokenKey = 'auth_token';
  private userKey = 'current_user';

  constructor(
    private http: HttpClient,
    private router: Router,
    private storageService: Storage
  ) {
    this.initStorage();
  }

  async initStorage() {
    this._storage = await this.storageService.create();

    const token = await this._storage?.get(this.tokenKey);
    const user = await this._storage?.get(this.userKey);

    if (token && user) {
      this.currentUserSubject.next(user);
    }
  }


  private async loadStoredUser() {
    if (this._storage) {
      const token = await this._storage.get(this.tokenKey);
      const user = await this._storage.get(this.userKey);

      if (token && user) {
        this.currentUserSubject.next(user);
      }
    }
  }

  login(credentials: { email: string; password: string }): Observable<any> {
    const apiUrl = `${environment.apiUrl}/api/auth/login`;

    return this.http.post<any>(apiUrl, credentials).pipe(
      tap(response => {
        localStorage.setItem('token', response.accessToken);
        this.currentUserSubject.next(response.user);
      })
    );
  }

  private async storeUserData(accessToken: string, refreshToken: string, user: any): Promise<void> {
    if (!this._storage) {
      this._storage = await this.storageService.create();
    }

    await this._storage?.set('access_token', accessToken);
    await this._storage?.set('refresh_token', refreshToken);
    await this._storage?.set('user_data', user);
  }

  logout(): Observable<boolean> {
    return from(this.clearStorage()).pipe(
      tap(() => {
        this.currentUserSubject.next(null);
        this.router.navigate(['/login']);
      }),
      map(() => true)
    );
  }

  private async clearStorage(): Promise<void> {
    if (this._storage) {
      await this._storage.remove(this.tokenKey);
      await this._storage.remove(this.userKey);
    }
  }
  register(userData: { email: string; firstname: string, lastname: string, password: string; username: string }): Observable<any> {
    const apiUrl = `${environment.apiUrl}/api/auth/register`;

    return this.http.post<any>(apiUrl, userData);
  }

  isAuthenticated(): Observable<boolean> {
    return this.getToken().pipe(
      map(token => !!token)
    );
  }

  getToken(): Observable<string | null> {
    if (!this._storage) {
      return of(null);
    }

    return from(this._storage.get(this.tokenKey));
  }

  getCurrentUser(): Observable<any> {
    return this.currentUser$;
  }

  // Pour rafraîchir les informations de l'utilisateur depuis le serveur
  refreshUserData(): Observable<any> {
    return this.getToken().pipe(
      switchMap(token => {
        if (!token) {
          throw new Error('Token non disponible');
        }

        // Remplacez cette URL par votre endpoint d'API réel
        const apiUrl = `${environment.apiUrl}/auth/me`;

        return this.http.get<any>(apiUrl).pipe(
          tap(user => {
            if (this._storage) {
              this._storage.set(this.userKey, user);
            }
            this.currentUserSubject.next(user);
          })
        );
      })
    );
  }
}
