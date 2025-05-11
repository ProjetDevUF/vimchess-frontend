import { Provider } from '@angular/core';
import { Socket } from 'ngx-socket-io';
import { environment } from "../../../environments/environment";

export const socketIoProviders: Provider[] = [
  {
    provide: 'SOCKET_CONFIG',
    useValue: {
      url: `${environment.apiUrl}/game`,
      options: {
        transports: ['websocket'],
        autoConnect: false,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10000
      }
    }
  },
  Socket
];

