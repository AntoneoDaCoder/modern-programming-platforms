import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { SocketService } from './socket.service';
import { HttpClient, HttpEvent, HttpEventType, HttpHeaders } from '@angular/common/http';
import { AuthService } from './auth.service';

export interface Task {
  id: number;
  title: string;
  date: string;
  status: string;
  file?: string | null;
  createdBy?: string;
}

@Injectable({ providedIn: 'root' })
export class TaskService {
  private apiUrl = 'http://localhost:3000/api';
  constructor(
    private socketService: SocketService,
    private http: HttpClient,
    private auth: AuthService
  ) {}

  getTasks(status = 'all'): Observable<Task[]> {
    return new Observable(sub => {
      this.socketService.emit('getTasks', { status }, (resp: any) => {
        if (resp && resp.ok) sub.next(resp.tasks);
        else sub.error(resp);
        sub.complete();
      });
    });
  }


addTask(title: string, date: string, file?: File): Observable<Task> {
    return new Observable<Task>(sub => {
      const token = this.auth.getToken();
      if (!token) {
        sub.error(new Error('Not authenticated (no token). Please login.'));
        return;
      }

      const doEmit = (fileName?: string | null) => {
        this.socketService.ensureConnectedWithToken(token).then(() => {
          this.socketService.emit('addTask', { title, date, fileName }, (resp: any) => {
            if (resp && resp.ok) {
              sub.next(resp.task);
              sub.complete();
            } else {
              sub.error(resp || new Error('addTask failed'));
            }
          });
        }).catch(err => {
          sub.error(err || new Error('Socket connect timeout'));
        });
      };

      if (!file) {
        doEmit(null);
        return;
      }

      // Upload file via multipart/form-data
      const fd = new FormData();
      fd.append('file', file, file.name);

      // корректные заголовки: используем HttpHeaders
      const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });

      this.http.post<any>(`${this.apiUrl}/upload`, fd, { headers, withCredentials: true })
        .subscribe({
          next: resp => {
            if (resp && resp.ok) {
              doEmit(resp.filename);
            } else {
              sub.error(resp || new Error('Upload failed'));
            }
          },
          error: err => {
            console.error('Upload failed', err);
            sub.error(err);
          }
        });
    });
  }


  markDone(id: number): Observable<Task> {
    return new Observable(sub => {
      this.socketService.emit('markDone', { id }, (resp: any) => {
        if (resp && resp.ok) sub.next(resp.task);
        else sub.error(resp);
        sub.complete();
      });
    });
  }

  deleteTask(id: number): Observable<void> {
    return new Observable(sub => {
      this.socketService.emit('deleteTask', { id }, (resp: any) => {
        if (resp && resp.ok) sub.next(void 0);
        else sub.error(resp);
        sub.complete();
      });
    });
  }


  onTaskAdded() { return this.socketService.on<any>('taskAdded'); }
  onTaskUpdated() { return this.socketService.on<any>('taskUpdated'); }
  onTaskDeleted() { return this.socketService.on<any>('taskDeleted'); }
}
