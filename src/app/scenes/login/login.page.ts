import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonContent } from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import {AuthService} from "../../service/auth/auth.service";
import {ToastController} from "@ionic/angular";
import {reload} from "ionicons/icons";

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [IonContent, CommonModule, ReactiveFormsModule]
})
export class LoginPage implements OnInit {
  loginForm!: FormGroup;
  isSubmitted = false;

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private authService: AuthService,
    private toastController: ToastController
  ) { }

  ngOnInit() {
    this.loginForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      deviceId: [''],
    });
  }

  get errorControl() {
    return this.loginForm.controls;
  }

  submitForm() {
    this.isSubmitted = true;

    if (!this.loginForm.valid) {
      this.presentToast('Veuillez remplir tous les champs correctement.', 'danger');
      return false;
    }

    const loginData = this.loginForm.value;
    loginData.deviceId = this.authService.getDeviceId();

    this.authService.login(this.loginForm.value).subscribe({
      next: (res) => {
        this.navigateTo('/home');
      },
      error: (err) => {
        this.presentToast('Email ou mot de passe incorrect.', 'danger');
      }
    })
    return true;
  }

  navigateTo(path: string) {
    this.router.navigate([path]);
  }

  redirectToRegister() {
    this.router.navigate(['/register']);
  }

  async presentToast(message: string, color: string = 'success') {
    const toast = await this.toastController.create({
      message: message,
      duration: 2000,
      position: 'top',
      color: color,
      buttons: [
        {
          text: 'X',
          role: 'cancel'
        }
      ]
    });

    await toast.present();
  }
}
