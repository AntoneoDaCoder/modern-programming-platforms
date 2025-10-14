import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable, BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SocketService {
    private socket: Socket | null = null;
    private currentToken: string | null = null;
    public connected$ = new BehaviorSubject<boolean>(false);

    connect(token?: string | null) {

        if (this.socket && this.socket.connected && this.currentToken === token) {
            return;
        }

        if (this.socket) {
            try { this.socket.disconnect(); } catch (e) { /* ignore */ }
            this.socket = null;
            this.connected$.next(false);
        }

        this.currentToken = token || null;
        const auth = this.currentToken ? { token: this.currentToken } : undefined;

        this.socket = io('http://localhost:3000', {
            auth,
            transports: ['websocket'],
            autoConnect: true
        });

        this.socket.on('connect', () => this.connected$.next(true));
        this.socket.on('disconnect', () => this.connected$.next(false));
        this.socket.on('connect_error', (err: any) => {
            console.error('Socket connect_error', err);
        });
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.connected$.next(false);
            this.currentToken = null;
        }
    }

    emit(event: string, payload?: any, cb?: (...args: any[]) => void) {
        if (!this.socket) {
            console.error('Socket not connected (emit):', event);
            return;
        }
        if (cb) this.socket.emit(event, payload, cb);
        else this.socket.emit(event, payload);
    }

    on<T = any>(event: string): Observable<T> {
        return new Observable<T>(sub => {
            if (!this.socket) {
                sub.error('Socket not connected');
                return;
            }
            const handler = (data: T) => sub.next(data);
            this.socket.on(event, handler);
            return () => { this.socket?.off(event, handler); };
        });
    }

    getSocket(): Socket | null { return this.socket; }


    getCurrentToken(): string | null {
        return this.currentToken;
    }
    ensureConnectedWithToken(token: string, timeoutMs = 5000): Promise<void> {
        if (!this.socket || this.currentToken !== token) {
            this.connect(token);
        }
        return new Promise((resolve, reject) => {
            if (this.connected$.value) return resolve();
            const sub = this.connected$.subscribe(v => {
                if (v) {
                    sub.unsubscribe();
                    resolve();
                }
            });
            setTimeout(() => {
                try { sub.unsubscribe(); } catch (e) { }
                reject(new Error('Socket connect timeout'));
            }, timeoutMs);
        });
    }
    waitForConnected(timeoutMs = 5000): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.connected$.value) return resolve();
            const sub = this.connected$.subscribe((v) => {
                if (v) {
                    sub.unsubscribe();
                    resolve();
                }
            });
            const t = setTimeout(() => {
                sub.unsubscribe();
                reject(new Error('Socket connect timeout'));
            }, timeoutMs);
        });
    }
}
