import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { IonContent, IonHeader, IonIcon, IonSpinner, IonSelect, IonSelectOption, AlertController, ToastController } from '@ionic/angular/standalone';
import { HeaderComponent } from "../components/header/header.component";
import { AuthService } from "../../service/auth/auth.service";
import { User } from "../../models/user/user.module";
import {Router} from "@angular/router";

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
  currentUser: User | null = null;
  profileForm: FormGroup;
  submitted = false;
  loading = false;
  showPassword = false;

  countries = [
    { code: 'FR', name: 'France' },
    { code: 'BE', name: 'Belgique' },
    { code: 'CH', name: 'Suisse' },
    { code: 'CA', name: 'Canada' },
  ];

  constructor(
    private authService: AuthService,
    private fb: FormBuilder,
    private router: Router,
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

  ngOnInit() {
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

  get f() {
    return this.profileForm.controls;
  }

  passwordMatchValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
    const password = control.get('password');
    const confirmPassword = control.get('confirmPassword');

    if (password && confirmPassword && password.value && password.value !== confirmPassword.value) {
      confirmPassword.setErrors({ matching: true });
      return { matching: true };
    }

    return null;
  };

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

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
      console.error('Erreur lors de la mise à jour du profil:', error);
      await this.presentToast('Une erreur est survenue. Veuillez réessayer.', 'danger');
    } finally {
      this.loading = false;
    }
  }

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
