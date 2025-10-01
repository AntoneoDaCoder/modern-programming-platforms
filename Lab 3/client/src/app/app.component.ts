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
  sub: Subscription | undefined;
  requestedPath = '/';

  constructor(private taskService: TaskService, private auth: AuthService) {}

  ngOnInit() {
    this.requestedPath = window.location.pathname || '/';
    this.sub = this.auth.isAuthenticated$.subscribe(val => {
      const prev = this.isAuth;
      this.isAuth = val;
      if (prev !== true && val === true) {
        this.loadTasks();
      }
    });

    this.auth.checkAuth().subscribe();
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  loadTasks() {
    this.taskService.getTasks(this.filter).subscribe({
      next: data => this.tasks = data,
      error: err => {
        console.error(err);
      }
    });
  }

  onFilterChange() {
    this.loadTasks();
  }

  onAddTask(form: any, fileInput: HTMLInputElement) {
    const formData = new FormData();
    formData.append('title', form.value.title);
    formData.append('date', form.value.date);
    if (fileInput.files?.[0]) {
      formData.append('file', fileInput.files[0]);
    }
    this.taskService.addTask(formData).subscribe(() => {
      form.resetForm();
      fileInput.value = '';
      this.loadTasks();
    });
  }

  markDone(id: number) {
    this.taskService.markDone(id).subscribe(() => this.loadTasks());
  }

  deleteTask(id: number) {
    this.taskService.deleteTask(id).subscribe(() => this.loadTasks());
  }

  logout() {
    this.auth.logout().subscribe(() => {
      this.auth.setUnauthenticated();
    });
  }
}