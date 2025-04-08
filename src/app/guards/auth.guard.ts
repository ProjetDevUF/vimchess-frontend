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

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    if (this.authService.isLoggedIn) {
      return true;
    }

    return this.router.createUrlTree(['/login']);
  }

  canActivateChild(): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    return this.canActivate();
  }
}
