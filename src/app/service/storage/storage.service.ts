import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class StorageService {

  /**
   * Initialise le service de stockage.
   * Aucune configuration n'est requise lors de l'initialisation.
   */
  constructor() {}

  /**
   * Stocke une valeur dans le localStorage en l'associant à une clé.
   * La valeur est automatiquement convertie en chaîne JSON.
   *
   * @param key La clé sous laquelle la valeur sera stockée
   * @param value La valeur à stocker (peut être de n'importe quel type)
   * @throws Capture et journalise les erreurs de sérialisation ou de stockage
   */
  public set(key: string, value: any): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('Erreur lors du stockage des données :', e);
    }
  }

  /**
   * Récupère une valeur du localStorage à partir de sa clé.
   * La valeur est automatiquement désérialisée depuis le format JSON.
   *
   * @param key La clé associée à la valeur recherchée
   * @returns La valeur associée à la clé, ou null si la clé n'existe pas ou en cas d'erreur
   * @throws Capture et journalise les erreurs de désérialisation
   */
  public get(key: string): any {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch (e) {
      console.error('Erreur lors de la récupération des données :', e);
      return null;
    }
  }

  /**
   * Supprime une entrée spécifique du localStorage.
   *
   * @param key La clé de l'entrée à supprimer
   */
  public remove(key: string): void {
    localStorage.removeItem(key);
  }

  /**
   * Efface toutes les données stockées dans le localStorage pour le domaine actuel.
   * Cette opération est irréversible et supprime toutes les entrées.
   */
  public clear(): void {
    localStorage.clear();
  }
}
