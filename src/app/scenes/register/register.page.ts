import {Component, OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';
import {IonContent, IonHeader, IonTitle, IonToolbar} from '@ionic/angular/standalone';
import {Router} from "@angular/router";
import {AuthService} from "../../service/auth/auth.service";
import {ToastController} from "@ionic/angular";

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
  standalone: true,
  imports: [IonContent, CommonModule, FormsModule, ReactiveFormsModule]
})
export class RegisterPage implements OnInit {

  /**
   * Formulaire réactif pour la saisie des informations d'inscription.
   * Contient les champs username, firstname, lastname, email, country et password.
   */
  registerForm!: FormGroup;

  /**
   * Indique si le formulaire a été soumis.
   * Utilisé pour afficher les erreurs de validation uniquement après tentative de soumission.
   */
  isSubmitted = false;

  /**
   * Initialise le composant RegisterPage avec les services nécessaires.
   *
   * @param formBuilder Service Angular pour la création de formulaires réactifs
   * @param router Service de routage pour la navigation entre les pages
   * @param authService Service d'authentification pour l'inscription des utilisateurs
   * @param toastController Service Ionic pour afficher des notifications toast
   */
  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private authService: AuthService,
    private toastController: ToastController
  ) {
  }

  /**
   * Initialise le formulaire d'inscription avec ses champs et validateurs.
   * Est appelé lors de l'initialisation du composant.
   */
  ngOnInit() {
    this.registerForm = this.formBuilder.group({
      username: ['', [Validators.required]],
      firstname: ['', [Validators.required]],
      lastname: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      country: ['', [Validators.required]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  /**
   * Getter pour faciliter l'accès aux contrôles du formulaire dans le template.
   * Permet de vérifier les erreurs de validation pour chaque champ.
   *
   * @returns Les contrôles du formulaire d'inscription
   */
  get errorControl() {
    return this.registerForm.controls;
  }

  /**
   * Gère la soumission du formulaire d'inscription.
   * Vérifie la validité du formulaire, puis envoie les données au service d'authentification.
   * Affiche des notifications appropriées en cas de succès ou d'échec.
   *
   * @returns true si la soumission a réussi, false sinon
   */
  submitForm() {
    this.isSubmitted = true;

    if (!this.registerForm.valid) {
      this.presentToast('Veuillez remplir tous les champs correctement.', 'danger');
      return false;
    }

    this.authService.register(this.registerForm.value).subscribe({
      next: (res) => {
        console.log(res);
        this.presentToast('Inscription réussie ! Connectez-vous.', 'success');
        this.router.navigate(['/register']);
      },
      error: (err) => {
        console.log(err);
      },
      complete: () => {
        console.log('Login completed');
      }
    })
    return true;
  }

  /**
   * Redirige l'utilisateur vers la page de connexion.
   * Utile pour les utilisateurs qui possèdent déjà un compte.
   */
  redirectToLogin() {
    this.router.navigate(['/login']);
  }

  /**
   * Affiche une notification toast avec le message et la couleur spécifiés.
   *
   * @param message Le message à afficher dans la notification
   * @param color La couleur de la notification (success, danger, etc.)
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
