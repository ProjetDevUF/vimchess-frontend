import { Routes } from '@angular/router';
import {NonAuthGuard} from "./guards/non-auth.guard";

export const routes: Routes = [
  {
    path: 'home',
    loadComponent: () => import('./scenes/home/home.page').then((m) => m.HomePage),
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
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
];
