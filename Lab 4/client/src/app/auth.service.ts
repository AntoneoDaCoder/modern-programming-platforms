import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { SocketService } from './socket.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _isAuthenticated = new BehaviorSubject<boolean | null>(null);
  public isAuthenticated$ = this._isAuthenticated.asObservable();
  private token: string | null = null;

  constructor(private socketService: SocketService) {
    this.socketService.connect();
    this.socketService.connected$.subscribe(connected => {
      if (!connected) this._isAuthenticated.next(false);
    });
  }

  login(username: string, password: string): Observable<any> {
    return new Observable(sub => {
      if (!this.socketService.getSocket()) this.socketService.connect();

      this.socketService.emit('login', { username, password }, (resp: any) => {
        if (resp && resp.token) {
          this.token = resp.token;

          this.socketService.disconnect();
          this.socketService.connect(this.token);

          this._isAuthenticated.next(true);
          sub.next(resp);
          sub.complete();
        } else {
          this._isAuthenticated.next(false);
          sub.error(resp);
        }
      });
    });
  }

  logout(): Observable<any> {
    return new Observable(sub => {
      this.socketService.emit('logout', {}, (resp: any) => {
        this.token = null;
        this.socketService.disconnect();
        this._isAuthenticated.next(false);
        sub.next(resp);
        sub.complete();
      });
    });
  }

  checkAuth(): Observable<any> {
    return this.isAuthenticated$;
  }

  setUnauthenticated() {
    this.token = null;
    this._isAuthenticated.next(false);
    this.socketService.disconnect();
  }

  getToken() { return this.token; }
}
