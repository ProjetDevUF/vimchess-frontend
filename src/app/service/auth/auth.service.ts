import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Storage } from '@ionic/storage-angular';
import {LoginCredentials, RegisterCredentials, User, UserAuth} from "../../models/user/user.module";

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
    private storage: Storage
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
    return !!this.currentUserSubject.value;
  }

  get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  login(credentials: LoginCredentials): Observable<UserAuth> {
    const apiUrl = `${environment.apiUrl}/api/auth/login`;

    return this.http.post<UserAuth>(apiUrl, credentials).pipe(
      tap(response => {
        console.log(response);
        this.storeUserData(response.accessToken, response.refreshToken, response.user);
        this.currentUserSubject.next(response.user);
      })
    );
  }

  register(userData: RegisterCredentials): Observable<UserAuth> {
    const apiUrl = `${environment.apiUrl}/api/auth/register`;

    return this.http.post<UserAuth>(apiUrl, userData).pipe(
      tap(response => {
        console.log(response);
      })
    );
  }

  private async storeUserData(accessToken: string, refreshToken: string, user: User): Promise<void> {
    if (!this._storage) {
      await this.init();
    }

    await this._storage?.set(this.tokenKey, accessToken);
    await this._storage?.set(this.refreshTokenKey, refreshToken);
    await this._storage?.set(this.userKey, user);
  }

  async logout() {
    if (!this._storage) {
      await this.init();
    }

    await this._storage?.remove(this.tokenKey);
    await this._storage?.remove(this.refreshTokenKey);
    await this._storage?.remove(this.userKey);
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  getUserProfile(): Observable<User> {
    const apiUrl = `${environment.apiUrl}/api/users/me`;
    return this.http.get<User>(apiUrl);
  }

  updateUserProfile(userData: Partial<User>): Observable<User> {
    const apiUrl = `${environment.apiUrl}/api/users/profile`;
    return this.http.put<User>(apiUrl, userData).pipe(
      tap((updatedUser) => {
        // Mettre à jour l'utilisateur stocké localement
        const currentUser = this.currentUserSubject.value;
        if (currentUser) {
          const newUserData = { ...currentUser, ...updatedUser };
          this._storage?.set(this.userKey, newUserData);
          this.currentUserSubject.next(newUserData);
        }
      })
    );
  }
}
