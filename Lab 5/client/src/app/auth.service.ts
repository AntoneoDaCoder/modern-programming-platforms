import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { GqlWsService } from './graphql-ws.service';
import { map } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _isAuthenticated = new BehaviorSubject<boolean | null>(null);
  public isAuthenticated$ = this._isAuthenticated.asObservable();
  private token: string | null = null;
  private apiBase = 'http://localhost:3000';

  constructor(private http: HttpClient, private gqlWs: GqlWsService) {
    this._isAuthenticated.next(false);
  }

  login(username: string, password: string): Observable<any> {
    const query = `
      mutation Login($username: String!, $password: String!) {
        login(username: $username, password: $password) {
          token
          user { id username }
        }
      }
    `;
    return this.http.post<any>(`${this.apiBase}/graphql`, { query, variables: { username, password } }, { withCredentials: true }).pipe(
      map(resp => {
        if (resp.errors) throw resp.errors;
        const payload = resp.data.login;
        this.token = payload.token;

        this.gqlWs.connect(this.token);
        this._isAuthenticated.next(true);
        return payload;
      })
    );
  }

  logout(): Observable<any> {
    return new Observable(sub => {
      this.token = null;
      this.gqlWs.disconnect();
      this._isAuthenticated.next(false);
      sub.next({ ok: true });
      sub.complete();
    });
  }

  checkAuth(): Observable<any> {
    return this.isAuthenticated$;
  }

  setUnauthenticated() {
    this.token = null;
    this._isAuthenticated.next(false);
    this.gqlWs.disconnect();
  }

  getToken() { return this.token; }
}
