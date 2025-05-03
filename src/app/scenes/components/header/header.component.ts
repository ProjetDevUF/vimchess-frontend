import { Component, OnInit } from '@angular/core';
import { AuthService } from "../../../service/auth/auth.service";
import {Router, RouterLink} from '@angular/router';
import { User } from '../../../models/user/user.module';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  imports: [
    RouterLink,
  ]
})
export class HeaderComponent implements OnInit {
  isLoggedIn = false;
  currentUser: User | null = null;
  isMenuOpen = false;

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

  toggleMenu() {
    this.isMenuOpen = !this.isMenuOpen;
  }

  logout() {
    this.isMenuOpen = false;
    this.authService.logout();
  }

  navigateTo(path: string) {
    this.router.navigate([path]);
  }
}
