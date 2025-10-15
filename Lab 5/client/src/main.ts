import { bootstrapApplication } from '@angular/platform-browser';
import {withInterceptorsFromDi,HTTP_INTERCEPTORS,provideHttpClient } from '@angular/common/http';
import { importProvidersFrom } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AppComponent } from './app/app.component';
import { AuthInterceptor } from './auth.interceptor';

bootstrapApplication(AppComponent, {
  providers: [
   provideHttpClient(withInterceptorsFromDi()),
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
    importProvidersFrom(FormsModule)
  ]
}).catch(err => console.error(err));
