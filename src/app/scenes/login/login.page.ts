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
  /** Formulaire de connexion avec validation */
  loginForm!: FormGroup;

  /** Indique si le formulaire a été soumis */
  isSubmitted = false;

  /**
   * Initialise le composant de connexion.
   *
   * @param formBuilder - Service pour créer des formulaires réactifs.
   * @param router - Service pour la navigation dans l'application.
   * @param authService - Service gérant l'authentification.
   * @param toastController - Contrôleur pour afficher des notifications toast.
   */
  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private authService: AuthService,
    private toastController: ToastController
  ) { }

  /**
   * Initialise le formulaire de connexion avec les validateurs appropriés.
   * Exécuté à l'initialisation du composant.
   */
  ngOnInit() {
    this.loginForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      deviceId: [''],
    });
  }

  /**
   * Accesseur pour les contrôles du formulaire, facilitant l'accès aux erreurs.
   *
   * @returns Les contrôles du formulaire de connexion.
   */
  get errorControl() {
    return this.loginForm.controls;
  }

  /**
   * Traite la soumission du formulaire de connexion.
   * Vérifie la validité des données, puis tente de connecter l'utilisateur.
   * Affiche des messages d'erreur appropriés en cas d'échec.
   *
   * @returns {boolean} - False si le formulaire est invalide, True sinon.
   */
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

  /**
   * Navigue vers le chemin spécifié.
   *
   * @param {string} path - Chemin de destination.
   */
  navigateTo(path: string) {
    this.router.navigate([path]);
  }

  /**
   * Redirige l'utilisateur vers la page d'inscription.
   */
  redirectToRegister() {
    this.router.navigate(['/register']);
  }

  /**
   * Affiche une notification toast avec le message et la couleur spécifiés.
   *
   * @param {string} message - Message à afficher.
   * @param {string} color - Couleur du toast (success par défaut).
   */
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
