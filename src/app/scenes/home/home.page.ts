import {Component, OnInit} from '@angular/core';
import {
  IonHeader,
  IonContent,
} from '@ionic/angular/standalone';
import {AuthService} from "../../service/auth/auth.service";
import {User} from "../../models/user/user.module";
import {HeaderComponent} from "../components/header/header.component";
import {UserService} from "../../service/user/user.service";
import {Observable, Subscription, tap} from "rxjs";
import {CommonModule} from '@angular/common';
import {GameSocketService} from "../../service/socket-client/game-socket.service";
import {Router} from "@angular/router";

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [IonHeader, IonContent, HeaderComponent, CommonModule, ],
})
export class HomePage implements OnInit {
  user: User | null = null;
  connectedUsers: any[] = [];
  private subscriptions: Subscription[] = [];

  constructor(
    private authService: AuthService,
    private userService: UserService,
    private gameSocketService: GameSocketService,
    private router: Router,
  ) {
  }

  ngOnInit() {
    this.gameSocketService.connect();
    this.getUser()

    this.subscriptions.push(
      this.gameSocketService.connectedUsers$.subscribe(users => {
        console.log('Utilisateurs connectés mis à jour:', users);
        this.connectedUsers = users || [];
      })
    );
  }

  getUser() {
    this.authService.getUserProfile().subscribe({
      next: (userData) => {
        this.user = userData;
      },
      error: (error) => {
        console.error('Erreur lors de la récupération du profil:', error);
      }
    });
  }

  nagigateTo(path: string) {
    this.router.navigate([path]);
  }
}
