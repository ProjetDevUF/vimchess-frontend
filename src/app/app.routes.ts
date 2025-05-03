import { Routes } from '@angular/router';
import {NonAuthGuard} from "./guards/non-auth.guard";
import {AuthGuard} from "./guards/auth.guard";

export const routes: Routes = [
  {
    path: 'home',
    loadComponent: () => import('./scenes/home/home.page').then((m) => m.HomePage),
    canActivate: [AuthGuard],
  },
  {
    path: 'login',
    loadComponent: () => import('./scenes/login/login.page').then(m => m.LoginPage),
    canActivate: [NonAuthGuard],
  },
  {
    path: 'register',
    loadComponent: () => import('./scenes/register/register.page').then( m => m.RegisterPage),
    canActivate: [NonAuthGuard],
  },
  {
    path: 'profile',
    loadComponent: () => import('./scenes/profile/profile.page').then( m => m.ProfilePage)
  },
  {
    path: 'game',
    loadComponent: () => import('./scenes/game/game.page').then(m => m.GamePage),
    canActivate: [AuthGuard],
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
  {
    path: 'game',
    loadComponent: () => import('./scenes/game/game.page').then( m => m.GamePage)
  },
];
