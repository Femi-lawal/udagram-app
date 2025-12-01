import { Injectable, signal, computed } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Router } from "@angular/router";
import { Observable, tap, catchError, throwError, of } from "rxjs";
import { environment } from "../../../environments/environment";

export interface User {
  id?: string;
  email: string;
  username?: string;
  displayName?: string;
  avatar?: string;
  bio?: string;
  postsCount?: number;
  followersCount?: number;
  followingCount?: number;
}

export interface AuthResponse {
  auth: boolean;
  token: string;
  user: User;
}

@Injectable({
  providedIn: "root",
})
export class AuthService {
  private readonly TOKEN_KEY = "udagram_token";
  private readonly USER_KEY = "udagram_user";

  private _currentUser = signal<User | null>(null);
  private token = signal<string | null>(null);

  readonly currentUser = computed(() => this._currentUser());
  readonly user = computed(() => this._currentUser());
  readonly isLoggedIn = computed(() => !!this.token());

  constructor(private http: HttpClient, private router: Router) {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    const token = localStorage.getItem(this.TOKEN_KEY);
    const userJson = localStorage.getItem(this.USER_KEY);

    if (token && userJson) {
      this.token.set(token);
      try {
        this._currentUser.set(JSON.parse(userJson));
      } catch {
        this.logout();
      }
    }
  }

  isAuthenticated(): boolean {
    return this.isLoggedIn();
  }

  getToken(): string | null {
    return this.token();
  }

  getUser(): User | null {
    return this._currentUser();
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/users/auth/login`, {
        email,
        password,
      })
      .pipe(
        tap((response) => this.handleAuthSuccess(response)),
        catchError((error) => {
          // For development - mock successful login
          if (environment.production === false) {
            const mockResponse: AuthResponse = {
              auth: true,
              token: "mock-jwt-token-" + Date.now(),
              user: {
                id: "1",
                email: email,
                username: email.split("@")[0],
                avatar: `https://i.pravatar.cc/150?u=${email}`,
              },
            };
            this.handleAuthSuccess(mockResponse);
            return of(mockResponse);
          }
          return throwError(() => error);
        })
      );
  }

  register(
    email: string,
    username: string,
    password: string
  ): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/users/auth`, {
        email,
        username,
        password,
      })
      .pipe(
        tap((response) => this.handleAuthSuccess(response)),
        catchError((error) => {
          // For development - mock successful registration
          if (environment.production === false) {
            const mockResponse: AuthResponse = {
              auth: true,
              token: "mock-jwt-token-" + Date.now(),
              user: {
                id: "1",
                email: email,
                username: username,
                avatar: `https://i.pravatar.cc/150?u=${email}`,
              },
            };
            this.handleAuthSuccess(mockResponse);
            return of(mockResponse);
          }
          return throwError(() => error);
        })
      );
  }

  private handleAuthSuccess(response: AuthResponse): void {
    localStorage.setItem(this.TOKEN_KEY, response.token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(response.user));
    this.token.set(response.token);
    this._currentUser.set(response.user);
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.token.set(null);
    this._currentUser.set(null);
    this.router.navigate(["/login"]);
  }

  verifyToken(): Observable<{ auth: boolean; message: string }> {
    return this.http.get<{ auth: boolean; message: string }>(
      `${environment.apiUrl}/users/auth/verification`
    );
  }
}
