import { Injectable } from '@angular/core';
import { createClient, Client, SubscribePayload } from 'graphql-ws';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class GqlWsService {
  private client: Client | null = null;
  private url = 'ws://localhost:3000/graphql';

  connect(token?: string | null) {
    if (this.client) {
      return;
    }
    this.client = createClient({
      url: this.url,
      connectionParams: () => {
        return token ? { token } : {};
      },
      retryAttempts: 3
    });
  }

  disconnect() {
    if (!this.client) return;
    try {
      this.client.dispose();
    } catch (e) { /* ignore */ }
    this.client = null;
  }

  subscribe<T = any>(query: string, variables?: Record<string, any>): Observable<T> {
    return new Observable<T>(subscriber => {
      if (!this.client) {
        subscriber.error(new Error('WS client not connected'));
        return;
      }

      const onNext = (data: any) => {
        if (data.errors) {
          subscriber.error(data.errors);
        } else {
          subscriber.next(data.data);
        }
      };

      const onError = (err: any) => subscriber.error(err);
      const onComplete = () => subscriber.complete();

      const dispose = this.client!.subscribe(
        { query, variables } as SubscribePayload,
        {
          next: onNext,
          error: onError,
          complete: onComplete
        }
      );

      return () => {
        try { dispose(); } catch (e) { /* ignore */ }
      };
    });
  }
}
