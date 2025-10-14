import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login-wrap" style="max-width:420px;margin:40px auto;padding:20px;border:1px solid #ddd;border-radius:8px;">
      <h3 style="margin-top:0">Вход</h3>
      <form (ngSubmit)="onSubmit()" #f="ngForm">
        <div style="margin-bottom:12px;">
          <label>Логин</label><br/>
          <input name="username" [(ngModel)]="username" required class="form-control" />
        </div>
        <div style="margin-bottom:12px;">
          <label>Пароль</label><br/>
          <input name="password" [(ngModel)]="password" type="password" required class="form-control" />
        </div>
        <div *ngIf="error" style="color:#b00020;margin-bottom:12px;">{{ error }}</div>
        <button type="submit" [disabled]="loading" style="padding:8px 16px;border-radius:6px;">
          {{ loading ? 'Вхожу...' : 'Войти' }}
        </button>
      </form>
    </div>
  `
})
export class LoginComponent {
  username = '';
  password = '';
  loading = false;
  error: string | null = null;

  constructor(private auth: AuthService) {}

  onSubmit() {
    this.error = null;
    this.loading = true;
    this.auth.login(this.username, this.password).subscribe({
      next: () => {
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = 'Неверный логин или пароль';
        console.error('Login error', err);
      }
    });
  }
}
