import {Component, OnInit} from '@angular/core';
import {
  IonHeader,
  IonContent,
} from '@ionic/angular/standalone';
import {AuthService} from "../../service/auth/auth.service";
import {User} from "../../models/user/user.module";
import {HeaderComponent} from "../components/header/header.component";

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [IonHeader, IonContent, HeaderComponent],
})
export class HomePage implements OnInit {
  user: User | null = null;

  constructor(
    private authService: AuthService,
  ) {
  }

  ngOnInit() {
    this.authService.getUserProfile().subscribe({
      next: (userData) => {
        this.user = userData;
      },
      error: (error) => {
        console.error('Erreur lors de la récupération du profil:', error);
      }
    });
  }
}
