import { Component, OnInit } from '@angular/core';
import { AuthService } from "../../../service/auth/auth.service";
import {Router, RouterLink} from '@angular/router';
import { User } from '../../../models/user/user.module';
import {IonIcon} from "@ionic/angular/standalone";
import {NgIf} from "@angular/common";

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  imports: [
    IonIcon,
    RouterLink,
    NgIf
  ]
})
export class HeaderComponent implements OnInit {
  isLoggedIn = false;
  currentUser: User | null = null;

  constructor(
    public authService: AuthService,
    private router: Router
  ) { }

  ngOnInit() {
    this.authService.currentUser.subscribe(user => {
      this.currentUser = user;
      this.isLoggedIn = !!user;
    });
  }

  logout() {
    this.authService.logout();
  }

  navigateTo(path: string) {
    this.router.navigate([path]);
  }
}
