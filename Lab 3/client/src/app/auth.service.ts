import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private base = 'http://localhost:3000/api/auth';
  private tasksUrl = 'http://localhost:3000/api/tasks';

  private _isAuthenticated = new BehaviorSubject<boolean | null>(null);
  public isAuthenticated$ = this._isAuthenticated.asObservable();

  constructor(private http: HttpClient) {}

  login(username: string, password: string): Observable<any> {
    return this.http.post(`${this.base}/login`, { username, password }, { withCredentials: true })
      .pipe(
        tap(() => this.checkAuth().subscribe())
      );
  }

  logout(): Observable<any> {
    return this.http.post(`${this.base}/logout`, {}, { withCredentials: true })
      .pipe(tap(() => this._isAuthenticated.next(false)));
  }


  checkAuth(): Observable<any> {
    return this.http.get(this.tasksUrl, { withCredentials: true }).pipe(
      tap(() => this._isAuthenticated.next(true)),
      catchError(() => {
        this._isAuthenticated.next(false);
        return of(null);
      })
    );
  }

  setUnauthenticated() {
    this._isAuthenticated.next(false);
  }
}
