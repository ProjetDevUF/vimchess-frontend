/**
 * Interface représentant un utilisateur de l'application.
 * Contient toutes les informations du profil, les statistiques de jeu et les identifiants.
 */
export interface User {
  /** Identifiant unique de l'utilisateur */
  uid: string;
  /** Nom d'utilisateur unique choisi lors de l'inscription */
  username: string;
  /** Adresse e-mail de l'utilisateur, utilisée pour l'authentification */
  email: string;
  /** Prénom de l'utilisateur */
  firstname: string;
  /** Nom de famille de l'utilisateur */
  lastname: string;
  /** Code du pays de résidence de l'utilisateur */
  country: string;
  /** Score Elo représentant le niveau de jeu de l'utilisateur */
  elo: number;
  /** État de connexion actuel de l'utilisateur */
  connected: boolean;
  /** Mot de passe de l'utilisateur (optionnel, généralement absent dans les réponses API) */
  password?: string;
  /** Informations sur le rôle de l'utilisateur dans l'application */
  role: {
    /** Identifiant numérique du rôle */
    id: number;
    /** Nom du rôle (ex: "user", "admin", "moderator") */
    role: string;
  };
  /** Identifiant du rôle de l'utilisateur */
  roleId: number;
  /** Date de création du compte au format ISO */
  createdAt: string;
  /** Date de dernière mise à jour du compte au format ISO */
  updatedAt: string;
  /** Token de rafraîchissement pour l'authentification (optionnel) */
  refreshToken?: string;
  /** Nombre total de défaites de l'utilisateur */
  losses: number;
  /** Nombre total de victoires de l'utilisateur */
  wins: number;
  /** Nombre total de parties nulles de l'utilisateur */
  draws: number;
  /** Token pour la réinitialisation du mot de passe, null si aucune demande en cours */
  resetToken: string | null;
}

/**
 * Interface représentant les tokens d'authentification reçus après une connexion réussie.
 * Utilisée pour maintenir la session de l'utilisateur.
 */
export interface UserAuth {
  /** Token d'accès JWT pour les requêtes authentifiées */
  accessToken: string;
  /** Token de rafraîchissement pour obtenir un nouveau token d'accès */
  refreshToken: string;
}

/**
 * Interface représentant les informations nécessaires pour se connecter à l'application.
 * Utilisée lors de la soumission du formulaire de connexion.
 */
export interface LoginCredentials {
  /** Adresse e-mail de l'utilisateur */
  email: string;
  /** Mot de passe de l'utilisateur */
  password: string;
  /** Identifiant unique de l'appareil utilisé pour la connexion */
  deviceId: string;
}

/**
 * Interface représentant les informations requises pour créer un nouveau compte utilisateur.
 * Utilisée lors de la soumission du formulaire d'inscription.
 */
export interface RegisterCredentials {
  /** Nom d'utilisateur unique choisi pour le nouveau compte */
  username: string;
  /** Prénom de l'utilisateur */
  firstname: string;
  /** Nom de famille de l'utilisateur */
  lastname: string;
  /** Adresse e-mail de l'utilisateur */
  email: string;
  /** Code du pays de résidence de l'utilisateur */
  country: string;
  /** Mot de passe choisi pour le compte */
  password: string;
}
