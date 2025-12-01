import {
  HttpInterceptorFn,
  HttpRequest,
  HttpHandlerFn,
} from "@angular/common/http";
import { inject } from "@angular/core";
import { AuthService } from "../services/auth.service";
import { catchError, throwError } from "rxjs";
import { Router } from "@angular/router";

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const token = authService.getToken();

  // Don't add token to external URLs (like S3 signed URLs)
  const isExternalUrl =
    req.url.startsWith("http") && !req.url.includes("/api/");

  if (token && !isExternalUrl) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  return next(req).pipe(
    catchError((error) => {
      if (error.status === 401) {
        authService.logout();
        router.navigate(["/login"]);
      }
      return throwError(() => error);
    })
  );
};
