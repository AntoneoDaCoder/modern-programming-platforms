import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TaskService, Task } from './task.service';
import { Subscription } from 'rxjs';
import { AuthService } from './auth.service';
import { LoginComponent } from './login.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, LoginComponent],
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit, OnDestroy {
  tasks: Task[] = [];
  filter: string = 'all';
  isAuth: boolean | null = null;
  private sub: Subscription | undefined;
  private realtimeSubs: Subscription[] = [];
  requestedPath = '/';

  constructor(
    private taskService: TaskService,
    private auth: AuthService
  ) {}

  ngOnInit() {
    this.requestedPath = window.location.pathname || '/';
    this.sub = this.auth.isAuthenticated$.subscribe(val => {
      const prev = this.isAuth;
      this.isAuth = val;

      if (prev !== true && val === true) {
        this.loadTasks();
        this.setupRealtime();
      }

      if (val === false) {
        this.tasks = [];
        this.teardownRealtime();
      }
    });

    this.auth.checkAuth().subscribe();
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
    this.teardownRealtime();
  }

  loadTasks() {
    this.taskService.getTasks(this.filter).subscribe({
      next: data => this.tasks = data,
      error: err => console.error('getTasks error', err)
    });
  }

  onFilterChange() {
    this.loadTasks();
  }

  onAddTask(form: any, fileInput: HTMLInputElement) {
    const title = form.value.title;
    const date = form.value.date;
    const file = fileInput.files?.[0];
    this.taskService.addTask(title, date, file).subscribe({
      next: (task) => {
        form.resetForm();
        fileInput.value = '';
        this.loadTasks();
      },
      error: err => console.error('addTask error', err)
    });
  }

  markDone(id: number) {
    this.taskService.markDone(id).subscribe({
      next: () => this.loadTasks(),
      error: err => console.error(err)
    });
  }

  deleteTask(id: number) {
    this.taskService.deleteTask(id).subscribe({
      next: () => this.loadTasks(),
      error: err => console.error(err)
    });
  }

  logout() {
    this.auth.logout().subscribe(() => {
      this.auth.setUnauthenticated();
    });
  }

  private setupRealtime() {
    this.teardownRealtime();
    const s1 = this.taskService.onTaskAdded().subscribe((task: Task) => {
      if (this.filter === 'all' || this.filter === task.status) {
        if (!this.tasks.find(t => t.id === task.id)) this.tasks.unshift(task);
      }
    });
    const s2 = this.taskService.onTaskUpdated().subscribe((task: Task) => {
      const idx = this.tasks.findIndex(t => t.id === task.id);
      if (idx >= 0) this.tasks[idx] = task;
      else if (this.filter === 'all' || this.filter === task.status) this.tasks.unshift(task);
    });
    const s3 = this.taskService.onTaskDeleted().subscribe(({ id }: any) => {
      this.tasks = this.tasks.filter(t => t.id !== id);
    });
    this.realtimeSubs = [s1, s2, s3];
  }

  private teardownRealtime() {
    this.realtimeSubs.forEach(s => s.unsubscribe());
    this.realtimeSubs = [];
  }
}
