import { Injectable } from '@angular/core';
import {HttpClient} from "@angular/common/http";
import {environment} from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class UserService {

  constructor(
    private http: HttpClient,
  ) { }

  getUserConnected() {
    const apiUrl = `${environment.apiUrl}/api/users/connected`;
    return this.http.get(apiUrl);
  }
}
