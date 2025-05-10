import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { IonContent, IonHeader, IonIcon, IonSpinner, IonSelect, IonSelectOption, AlertController, ToastController } from '@ionic/angular/standalone';
import { HeaderComponent } from "../components/header/header.component";
import { AuthService } from "../../service/auth/auth.service";
import { User } from "../../models/user/user.module";
import {Router} from "@angular/router";
import {GameSocketService} from "../../service/socket-client/game-socket.service";

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: true,
  imports: [
    IonContent,
    IonHeader,
    IonIcon,
    IonSpinner,
    CommonModule,
    ReactiveFormsModule,
    HeaderComponent
  ]
})
export class ProfilePage implements OnInit {
  /**
   * Utilisateur actuellement connecté, ou null si aucun utilisateur n'est connecté.
   * Contient toutes les informations du profil utilisateur chargées depuis le serveur.
   */
  currentUser: User | null = null;

  /**
   * Formulaire réactif pour gérer les données du profil utilisateur.
   * Inclut les champs username, email, country, password, confirmPassword et newsletter.
   */
  profileForm: FormGroup;

  /**
   * Indique si le formulaire a été soumis.
   * Utilisé pour afficher les erreurs de validation uniquement après tentative de soumission.
   */
  submitted = false;

  /**
   * Indique si une opération asynchrone est en cours.
   * Permet d'afficher un indicateur de chargement et de désactiver les contrôles.
   */
  loading = false;

  /**
   * Contrôle la visibilité du mot de passe dans le formulaire.
   * Lorsque true, le mot de passe est affiché en clair; lorsque false, il est masqué.
   */
  showPassword = false;

  /**
   * Liste des pays disponibles pour la sélection dans le formulaire de profil.
   * Chaque pays est représenté par un code (ISO) et un nom complet.
   */
  countries = [
    { code: 'FR', name: 'France' },
    { code: 'BE', name: 'Belgique' },
    { code: 'CH', name: 'Suisse' },
    { code: 'CA', name: 'Canada' },
  ];

  /**
   * Initialise le composant ProfilePage avec les services nécessaires
   * et configure le formulaire de profil avec les validations appropriées.
   *
   * @param authService Service d'authentification pour gérer les données utilisateur
   * @param fb Service FormBuilder pour créer le formulaire réactif
   * @param router Service de routage pour la navigation entre les pages
   * @param gameSocketService Service de socket pour la connexion en temps réel
   * @param alertController Contrôleur pour afficher des alertes de confirmation
   * @param toastController Contrôleur pour afficher des notifications toast
   */
  constructor(
    private authService: AuthService,
    private fb: FormBuilder,
    private router: Router,
    private gameSocketService: GameSocketService,
    private alertController: AlertController,
    private toastController: ToastController
  ) {
    this.profileForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      country: ['', [Validators.required]],
      password: ['', [
        Validators.minLength(6),
        Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      ]],
      confirmPassword: [''],
      newsletter: [false]
    }, {
      validators: this.passwordMatchValidator
    });
  }

  /**
   * Initialise le composant en établissant une connexion socket
   * et en récupérant les données du profil utilisateur pour préremplir le formulaire.
   */
  ngOnInit() {
    this.gameSocketService.connect();
    this.authService.getUserProfile().subscribe(user => {
      this.currentUser = user;
      console.log(this.currentUser);

      if (this.currentUser) {
        this.profileForm.patchValue({
          username: this.currentUser.username,
          email: this.currentUser.email,
          country: this.currentUser.country,
        });
      }
    });
  }

  /**
   * Accesseur pour obtenir facilement les contrôles du formulaire.
   *
   * @returns Les contrôles du formulaire de profil
   */
  get f() {
    return this.profileForm.controls;
  }

  /**
   * Validateur personnalisé qui vérifie si les champs de mot de passe et de confirmation correspondent.
   *
   * @param control Le groupe de contrôles à valider
   * @returns Un objet d'erreur si les mots de passe ne correspondent pas, sinon null
   */
  passwordMatchValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
    const password = control.get('password');
    const confirmPassword = control.get('confirmPassword');

    if (password && confirmPassword && password.value && password.value !== confirmPassword.value) {
      confirmPassword.setErrors({ matching: true });
      return { matching: true };
    }

    return null;
  };

  /**
   * Bascule la visibilité du mot de passe entre masqué et visible.
   */
  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  /**
   * Traite la soumission du formulaire de profil.
   * Valide les données et met à jour le profil utilisateur si les données sont valides.
   * Affiche un message de succès ou d'erreur selon le résultat.
   */
  async onSubmit() {
    this.submitted = true;

    if (this.profileForm.invalid) {
      return;
    }

    this.loading = true;

    try {
      const formData = { ...this.profileForm.value };

      if (!formData.password) {
        delete formData.password;
        delete formData.confirmPassword;
      }

      await this.authService.updateUserProfile(formData).toPromise();

      await this.presentToast('Profil mis à jour avec succès !', 'success');

      this.profileForm.patchValue({
        password: '',
        confirmPassword: ''
      });

      this.submitted = false;

    } catch (error) {
      await this.presentToast('Une erreur est survenue. Veuillez réessayer.', 'danger');
    } finally {
      this.loading = false;
    }
  }

  /**
   * Affiche une boîte de dialogue de confirmation pour la suppression du compte.
   *
   * @param id Identifiant de l'utilisateur à supprimer
   */
  async openDeleteConfirmation(id: string | undefined) {
    const alert = await this.alertController.create({
      header: 'Confirmer la suppression',
      message: 'Êtes-vous sûr de vouloir supprimer votre compte ? Cette action est irréversible.',
      buttons: [
        {
          text: 'Annuler',
          role: 'cancel'
        }, {
          text: 'Supprimer',
          cssClass: 'danger',
          handler: () => {
            this.deleteAccount(id);
          }
        }
      ]
    });

    await alert.present();
  }

  /**
   * Supprime le compte utilisateur et redirige vers la page de connexion en cas de succès.
   *
   * @param id Identifiant de l'utilisateur à supprimer
   */
  async deleteAccount(id: string | undefined) {
    try {
      this.loading = true;

      await this.authService.deleteAccount(id).toPromise();

      await this.presentToast('Votre compte a été supprimé.', 'success');

      this.router.navigate(['/login']);

    } catch (error) {
      console.error('Erreur lors de la suppression du compte:', error);
      await this.presentToast('Une erreur est survenue. Veuillez réessayer.', 'danger');
    } finally {
      this.loading = false;
    }
  }

  /**
   * Affiche une notification toast avec le message spécifié.
   *
   * @param message Le message à afficher
   * @param color La couleur du toast (success, danger, warning)
   */
  async presentToast(message: string, color: 'success' | 'danger' | 'warning' = 'success') {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'bottom',
      color,
      buttons: [
        {
          icon: 'close',
          role: 'cancel'
        }
      ]
    });

    await toast.present();
  }
}
