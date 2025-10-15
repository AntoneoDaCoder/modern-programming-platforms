import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { AuthService } from './auth.service';
import { GqlWsService } from './graphql-ws.service';

export interface Task {
  id: number;
  title: string;
  date?: string;
  status: string;
  file?: string | null;
  createdBy?: string;
}

@Injectable({ providedIn: 'root' })
export class TaskService {
  private base = 'http://localhost:3000';
  constructor(private http: HttpClient, private auth: AuthService, private gqlWs: GqlWsService) {}

  private gqlRequest<T>(query: string, variables?: any): Observable<T> {
    return new Observable<T>(sub => {
      this.http.post<any>(`${this.base}/graphql`, { query, variables }, { withCredentials: true })
        .subscribe({
          next: resp => {
            if (resp.errors) sub.error(resp.errors);
            else sub.next(resp.data as T);
            sub.complete();
          },
          error: err => sub.error(err)
        });
    });
  }

  getTasks(status = 'all'): Observable<Task[]> {
    const q = `query GetTasks($status: String) { getTasks(status: $status) { id title status date file createdBy } }`;
    return new Observable<Task[]>(sub => {
      this.gqlRequest<{ getTasks: Task[] }>(q, { status }).subscribe({
        next: data => sub.next(data.getTasks),
        error: err => sub.error(err),
        complete: () => sub.complete()
      });
    });
  }

  addTask(title: string, date: string, file?: File): Observable<Task> {
    return new Observable<Task>(sub => {
      const finished = (fileName?: string | null) => {
        const m = `mutation AddTask($title: String!, $date: String, $fileName: String) {
          addTask(title: $title, date: $date, fileName: $fileName) {
            id title status date file createdBy
          }
        }`;
        this.gqlRequest<{ addTask: Task }>(m, { title, date, fileName }).subscribe({
          next: d => { sub.next(d.addTask); sub.complete(); },
          error: e => sub.error(e)
        });
      };

      if (!file) {
        finished(null);
        return;
      }

      const fd = new FormData();
      fd.append('file', file, file.name);
      this.http.post<any>(`${this.base}/api/upload`, fd, { withCredentials: true })
        .subscribe({
          next: resp => {
            if (resp && resp.ok) finished(resp.filename);
            else sub.error(resp || new Error('Upload failed'));
          },
          error: err => sub.error(err)
        });
    });
  }

  markDone(id: number): Observable<Task> {
    const m = `mutation MarkDone($id: ID!) { markDone(id: $id) { id title status date file createdBy } }`;
    return new Observable<Task>(sub => {
      this.gqlRequest<{ markDone: Task }>(m, { id }).subscribe({
        next: d => { sub.next(d.markDone); sub.complete(); },
        error: e => sub.error(e)
      });
    });
  }

  deleteTask(id: number): Observable<void> {
    const m = `mutation DeleteTask($id: ID!) { deleteTask(id: $id) }`;
    return new Observable<void>(sub => {
      this.gqlRequest<{ deleteTask: boolean }>(m, { id }).subscribe({
        next: _ => { sub.next(void 0); sub.complete(); },
        error: e => sub.error(e)
      });
    });
  }

  onTaskAdded() {
    const s = `subscription { taskAdded { id title status date file createdBy } }`;
    return new Observable<any>(sub => {
      this.gqlWs.subscribe<any>(s).subscribe({
        next: data => sub.next(data.taskAdded),
        error: err => sub.error(err),
        complete: () => sub.complete()
      });
    });
  }

  onTaskUpdated() {
    const s = `subscription { taskUpdated { id title status date file createdBy } }`;
    return new Observable<any>(sub => {
      this.gqlWs.subscribe<any>(s).subscribe({
        next: data => sub.next(data.taskUpdated),
        error: err => sub.error(err),
        complete: () => sub.complete()
      });
    });
  }

  onTaskDeleted() {
    const s = `subscription { taskDeleted }`;
    return new Observable<any>(sub => {
      this.gqlWs.subscribe<any>(s).subscribe({
        next: data => sub.next({ id: data.taskDeleted }),
        error: err => sub.error(err),
        complete: () => sub.complete()
      });
    });
  }
}
