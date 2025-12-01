import { Component, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
  ValidationErrors,
} from "@angular/forms";
import { Router, RouterLink } from "@angular/router";
import { AuthService } from "../../../core/services/auth.service";

@Component({
  selector: "app-register",
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="auth-page">
      <div class="auth-container">
        <!-- Register Form Card -->
        <div class="auth-card">
          <h1 class="auth-logo">Udagram</h1>
          <h2 class="auth-subtitle">
            Sign up to see photos and videos from your friends.
          </h2>

          <button class="auth-social auth-social--primary">
            <span class="auth-social-icon">📷</span>
            Sign up with Demo
          </button>

          <div class="auth-divider">
            <span>OR</span>
          </div>

          <form
            [formGroup]="registerForm"
            (ngSubmit)="onSubmit()"
            class="auth-form"
          >
            <div class="form-group">
              <input
                type="email"
                formControlName="email"
                class="input"
                [class.input--error]="
                  registerForm.get('email')?.invalid &&
                  registerForm.get('email')?.touched
                "
                placeholder="Email"
                data-testid="email-input"
              />
              @if (registerForm.get('email')?.hasError('email') &&
              registerForm.get('email')?.touched) {
              <span class="input-hint input-hint--error"
                >Enter a valid email address</span
              >
              }
            </div>

            <div class="form-group">
              <input
                type="text"
                formControlName="username"
                class="input"
                [class.input--error]="
                  registerForm.get('username')?.invalid &&
                  registerForm.get('username')?.touched
                "
                placeholder="Username"
                data-testid="username-input"
              />
              @if (registerForm.get('username')?.hasError('pattern') &&
              registerForm.get('username')?.touched) {
              <span class="input-hint input-hint--error"
                >Username can only contain letters, numbers, and
                underscores</span
              >
              }
            </div>

            <div class="form-group">
              <div class="password-input">
                <input
                  [type]="showPassword() ? 'text' : 'password'"
                  formControlName="password"
                  class="input"
                  [class.input--error]="
                    registerForm.get('password')?.invalid &&
                    registerForm.get('password')?.touched
                  "
                  placeholder="Password"
                  data-testid="password-input"
                />
                <button
                  type="button"
                  class="password-toggle"
                  (click)="togglePassword()"
                  *ngIf="registerForm.get('password')?.value"
                >
                  {{ showPassword() ? "Hide" : "Show" }}
                </button>
              </div>

              <!-- Password strength indicator -->
              @if (registerForm.get('password')?.value) {
              <div class="password-strength">
                <div
                  class="password-strength__bar"
                  [class]="'password-strength__bar--' + passwordStrength()"
                ></div>
                <span class="password-strength__text">{{
                  passwordStrengthText()
                }}</span>
              </div>
              }
            </div>

            <div class="form-group">
              <input
                [type]="showPassword() ? 'text' : 'password'"
                formControlName="confirmPassword"
                class="input"
                [class.input--error]="
                  registerForm.get('confirmPassword')?.invalid &&
                  registerForm.get('confirmPassword')?.touched
                "
                placeholder="Confirm Password"
                data-testid="confirm-password-input"
              />
              @if (registerForm.hasError('passwordMismatch') &&
              registerForm.get('confirmPassword')?.touched) {
              <span class="input-hint input-hint--error"
                >Passwords don't match</span
              >
              }
            </div>

            <p class="auth-terms">
              By signing up, you agree to our <a href="#">Terms</a>,
              <a href="#">Privacy Policy</a> and <a href="#">Cookies Policy</a>.
            </p>

            <button
              type="submit"
              class="btn btn--primary auth-submit"
              [disabled]="registerForm.invalid || loading()"
              data-testid="register-button"
            >
              @if (loading()) {
              <span class="spinner"></span>
              } @else { Sign Up }
            </button>

            @if (error()) {
            <div class="auth-error" data-testid="error-message">
              {{ error() }}
            </div>
            }
          </form>
        </div>

        <!-- Log In Card -->
        <div class="auth-card auth-card--secondary">
          <p>
            Have an account?
            <a routerLink="/login" class="auth-link" data-testid="login-link"
              >Log in</a
            >
          </p>
        </div>

        <!-- App Download -->
        <div class="auth-download">
          <p>Get the app.</p>
          <div class="auth-download__buttons">
            <img
              src="https://static.cdninstagram.com/rsrc.php/v3/yz/r/c5Rp7Ym-Klz.png"
              alt="App Store"
              height="40"
            />
            <img
              src="https://static.cdninstagram.com/rsrc.php/v3/yu/r/EHY6QnZYdNX.png"
              alt="Google Play"
              height="40"
            />
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .auth-page {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: var(--ig-spacing-lg);
        background-color: var(--ig-light);
      }

      .auth-container {
        width: 100%;
        max-width: 350px;
      }

      .auth-card {
        background: var(--ig-white);
        border: 1px solid var(--ig-border);
        border-radius: var(--ig-radius-sm);
        padding: var(--ig-spacing-lg) var(--ig-spacing-xl);
        margin-bottom: var(--ig-spacing-sm);
        text-align: center;

        &--secondary {
          padding: var(--ig-spacing-md) var(--ig-spacing-xl);
          font-size: var(--ig-font-sm);
        }
      }

      .auth-logo {
        font-family: "Billabong", cursive;
        font-size: 50px;
        font-weight: 400;
        margin-bottom: var(--ig-spacing-sm);
        color: var(--ig-dark);
      }

      .auth-subtitle {
        color: var(--ig-secondary);
        font-size: 17px;
        font-weight: 600;
        margin-bottom: var(--ig-spacing-lg);
        line-height: 1.4;
      }

      .auth-form {
        display: flex;
        flex-direction: column;
        gap: var(--ig-spacing-sm);
      }

      .form-group {
        width: 100%;
        text-align: left;
      }

      .password-input {
        position: relative;

        .input {
          padding-right: 60px;
        }
      }

      .password-toggle {
        position: absolute;
        right: 12px;
        top: 50%;
        transform: translateY(-50%);
        background: none;
        border: none;
        font-weight: 600;
        font-size: var(--ig-font-sm);
        color: var(--ig-dark);
        cursor: pointer;
      }

      .password-strength {
        display: flex;
        align-items: center;
        gap: var(--ig-spacing-sm);
        margin-top: var(--ig-spacing-xs);

        &__bar {
          flex: 1;
          height: 4px;
          border-radius: 2px;
          background: var(--ig-border);
          position: relative;
          overflow: hidden;

          &::before {
            content: "";
            position: absolute;
            left: 0;
            top: 0;
            height: 100%;
            border-radius: 2px;
            transition: width 0.3s ease;
          }

          &--weak::before {
            width: 33%;
            background: var(--ig-error);
          }

          &--medium::before {
            width: 66%;
            background: #f5a623;
          }

          &--strong::before {
            width: 100%;
            background: var(--ig-success);
          }
        }

        &__text {
          font-size: var(--ig-font-xs);
          color: var(--ig-secondary);
        }
      }

      .input-hint {
        display: block;
        font-size: var(--ig-font-xs);
        margin-top: 4px;

        &--error {
          color: var(--ig-error);
        }
      }

      .auth-terms {
        font-size: 12px;
        color: var(--ig-secondary);
        line-height: 1.5;
        margin: var(--ig-spacing-sm) 0;

        a {
          color: var(--ig-secondary);
          font-weight: 600;
        }
      }

      .auth-submit {
        width: 100%;
        padding: var(--ig-spacing-sm);
        margin-top: var(--ig-spacing-xs);
        font-size: var(--ig-font-sm);

        .spinner {
          width: 18px;
          height: 18px;
          border-width: 2px;
        }
      }

      .auth-error {
        color: var(--ig-error);
        font-size: var(--ig-font-sm);
        margin-top: var(--ig-spacing-sm);
      }

      .auth-divider {
        display: flex;
        align-items: center;
        margin: var(--ig-spacing-md) 0;

        &::before,
        &::after {
          content: "";
          flex: 1;
          height: 1px;
          background: var(--ig-border);
        }

        span {
          padding: 0 var(--ig-spacing-md);
          color: var(--ig-secondary);
          font-size: 13px;
          font-weight: 600;
        }
      }

      .auth-social {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--ig-spacing-sm);
        width: 100%;
        padding: var(--ig-spacing-sm);
        background: none;
        border: none;
        color: var(--ig-primary);
        font-weight: 600;
        font-size: var(--ig-font-sm);
        cursor: pointer;
        border-radius: var(--ig-radius-sm);

        &--primary {
          background: var(--ig-primary);
          color: var(--ig-white);
        }

        &-icon {
          font-size: 18px;
        }
      }

      .auth-link {
        color: var(--ig-primary);
        font-weight: 600;
        text-decoration: none;
      }

      .auth-download {
        text-align: center;
        margin-top: var(--ig-spacing-lg);

        p {
          margin-bottom: var(--ig-spacing-md);
          font-size: var(--ig-font-sm);
        }

        &__buttons {
          display: flex;
          justify-content: center;
          gap: var(--ig-spacing-sm);

          img {
            height: 40px;
          }
        }
      }
    `,
  ],
})
export class RegisterComponent {
  registerForm: FormGroup;
  loading = signal<boolean>(false);
  error = signal<string>("");
  showPassword = signal<boolean>(false);

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.registerForm = this.fb.group(
      {
        email: ["", [Validators.required, Validators.email]],
        username: [
          "",
          [
            Validators.required,
            Validators.minLength(3),
            Validators.pattern(/^[a-zA-Z0-9_]+$/),
          ],
        ],
        password: ["", [Validators.required, Validators.minLength(6)]],
        confirmPassword: ["", [Validators.required]],
      },
      {
        validators: this.passwordMatchValidator,
      }
    );
  }

  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get("password");
    const confirmPassword = control.get("confirmPassword");

    if (password?.value !== confirmPassword?.value) {
      return { passwordMismatch: true };
    }
    return null;
  }

  togglePassword(): void {
    this.showPassword.update((v) => !v);
  }

  passwordStrength(): string {
    const password = this.registerForm.get("password")?.value || "";

    if (password.length < 6) return "weak";

    const hasNumber = /\d/.test(password);
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);

    const score = [hasNumber, hasLetter, hasSpecial, hasUppercase].filter(
      Boolean
    ).length;

    if (password.length >= 8 && score >= 3) return "strong";
    if (password.length >= 6 && score >= 2) return "medium";
    return "weak";
  }

  passwordStrengthText(): string {
    const strength = this.passwordStrength();
    switch (strength) {
      case "weak":
        return "Weak";
      case "medium":
        return "Medium";
      case "strong":
        return "Strong";
      default:
        return "";
    }
  }

  onSubmit(): void {
    if (this.registerForm.invalid) return;

    this.loading.set(true);
    this.error.set("");

    const { email, username, password } = this.registerForm.value;

    this.authService.register(email, username, password).subscribe({
      next: () => {
        this.router.navigate(["/feed"]);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(
          err.error?.message || "Registration failed. Please try again."
        );
      },
    });
  }
}
