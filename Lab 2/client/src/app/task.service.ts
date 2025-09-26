import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Task {
  id: number;
  title: string;
  date: string;
  status: string;
  file?: string;
}

@Injectable({ providedIn: 'root' })
export class TaskService {
  private apiUrl = 'http://localhost:3000/api/tasks';

  constructor(private http: HttpClient) {}

  getTasks(status: string = 'all'): Observable<Task[]> {
    return this.http.get<Task[]>(`${this.apiUrl}?status=${status}`);
  }

  addTask(formData: FormData): Observable<Task> {
    return this.http.post<Task>(this.apiUrl, formData);
  }

  markDone(id: number): Observable<Task> {
    return this.http.put<Task>(`${this.apiUrl}/${id}/done`, {});
  }

  deleteTask(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
