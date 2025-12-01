import { Component, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from "@angular/forms";
import { Router, RouterLink } from "@angular/router";
import { AuthService } from "../../../core/services/auth.service";
import { DemoService } from "../../../core/services/demo.service";

@Component({
  selector: "app-login",
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="auth-page">
      <div class="auth-container">
        <!-- Login Form Card -->
        <div class="auth-card">
          <h1 class="auth-logo">Udagram</h1>

          <form
            [formGroup]="loginForm"
            (ngSubmit)="onSubmit()"
            class="auth-form"
          >
            <div class="form-group">
              <input
                type="email"
                formControlName="email"
                class="input"
                [class.input--error]="
                  loginForm.get('email')?.invalid &&
                  loginForm.get('email')?.touched
                "
                placeholder="Email"
                data-testid="email-input"
              />
            </div>

            <div class="form-group">
              <div class="password-input">
                <input
                  [type]="showPassword() ? 'text' : 'password'"
                  formControlName="password"
                  class="input"
                  [class.input--error]="
                    loginForm.get('password')?.invalid &&
                    loginForm.get('password')?.touched
                  "
                  placeholder="Password"
                  data-testid="password-input"
                />
                <button
                  type="button"
                  class="password-toggle"
                  (click)="togglePassword()"
                  *ngIf="loginForm.get('password')?.value"
                >
                  {{ showPassword() ? "Hide" : "Show" }}
                </button>
              </div>
            </div>

            <button
              type="submit"
              class="btn btn--primary auth-submit"
              [disabled]="loginForm.invalid || loading()"
              data-testid="login-button"
            >
              @if (loading()) {
              <span class="spinner"></span>
              } @else { Log In }
            </button>

            @if (error()) {
            <div class="auth-error" data-testid="error-message">
              {{ error() }}
            </div>
            }
          </form>

          <div class="auth-divider">
            <span>OR</span>
          </div>

          <!-- Demo Account Button -->
          <button
            class="demo-button"
            (click)="loginAsDemo()"
            [disabled]="demoLoading()"
            data-testid="demo-button"
          >
            @if (demoLoading()) {
            <span class="spinner spinner--white"></span>
            } @else {
            <span class="demo-button__icon">✨</span>
            <div class="demo-button__text">
              <span class="demo-button__title">Try Demo Account</span>
              <span class="demo-button__subtitle"
                >Explore all features instantly</span
              >
            </div>
            <span class="demo-button__arrow">→</span>
            }
          </button>

          <a href="#" class="auth-forgot">Forgot password?</a>
        </div>

        <!-- Sign Up Card -->
        <div class="auth-card auth-card--secondary">
          <p>
            Don't have an account?
            <a
              routerLink="/register"
              class="auth-link"
              data-testid="register-link"
              >Sign up</a
            >
          </p>
        </div>

        <!-- Demo Features Preview -->
        <div class="demo-features">
          <h3>🚀 Demo Features Include:</h3>
          <ul>
            <li>📸 Instagram-style photo feed</li>
            <li>❤️ Like & comment on posts</li>
            <li>📤 Upload & share photos</li>
            <li>👤 Full profile management</li>
            <li>🔍 Explore & discover content</li>
            <li>📱 Mobile-responsive design</li>
          </ul>
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

      <!-- Phone Mockup (Desktop) -->
      <div class="auth-mockup">
        <div class="phone-frame">
          <img
            [src]="mockupImages()[currentMockupIndex()]"
            alt="App Preview"
            class="phone-screen"
          />
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

        @media (min-width: 875px) {
          gap: var(--ig-spacing-xl);
        }
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
        font-family: "Pacifico", "Billabong", cursive;
        font-size: 42px;
        font-weight: 400;
        margin-bottom: var(--ig-spacing-lg);
        color: var(--ig-dark);
      }

      .auth-form {
        display: flex;
        flex-direction: column;
        gap: var(--ig-spacing-sm);
      }

      .form-group {
        width: 100%;
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

      .auth-submit {
        width: 100%;
        padding: var(--ig-spacing-sm);
        margin-top: var(--ig-spacing-sm);
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
        margin: var(--ig-spacing-lg) 0;

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

      .demo-button {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--ig-spacing-sm);
        width: 100%;
        padding: var(--ig-spacing-md);
        background: linear-gradient(
          135deg,
          #833ab4 0%,
          #fd1d1d 50%,
          #fcb045 100%
        );
        border: none;
        border-radius: var(--ig-radius-md);
        color: white;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s ease;
        box-shadow: 0 4px 15px rgba(131, 58, 180, 0.3);

        &:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(131, 58, 180, 0.4);
        }

        &:active:not(:disabled) {
          transform: translateY(0);
        }

        &:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        &__icon {
          font-size: 24px;
        }

        &__text {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          flex: 1;
        }

        &__title {
          font-size: 15px;
          font-weight: 600;
        }

        &__subtitle {
          font-size: 11px;
          opacity: 0.9;
          font-weight: 400;
        }

        &__arrow {
          font-size: 20px;
          transition: transform 0.2s;
        }

        &:hover &__arrow {
          transform: translateX(4px);
        }

        .spinner--white {
          border-color: rgba(255, 255, 255, 0.3);
          border-top-color: white;
        }
      }

      .demo-features {
        background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%);
        border-radius: var(--ig-radius-md);
        padding: var(--ig-spacing-md);
        margin-top: var(--ig-spacing-md);
        text-align: left;

        h3 {
          font-size: 14px;
          font-weight: 600;
          margin-bottom: var(--ig-spacing-sm);
          color: #333;
        }

        ul {
          list-style: none;
          padding: 0;
          margin: 0;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
        }

        li {
          font-size: 12px;
          color: #555;
          display: flex;
          align-items: center;
          gap: 4px;
        }
      }

      .auth-forgot {
        display: block;
        margin-top: var(--ig-spacing-md);
        color: var(--ig-dark);
        font-size: var(--ig-font-xs);
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

      .auth-mockup {
        display: none;

        @media (min-width: 875px) {
          display: block;
        }
      }

      .phone-frame {
        width: 240px;
        height: 520px;
        background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 520"><rect width="240" height="520" rx="24" fill="%23262626"/><rect x="16" y="50" width="208" height="400" rx="4" fill="%23fafafa"/></svg>')
          no-repeat;
        background-size: cover;
        padding: 50px 16px;
        position: relative;
      }

      .phone-screen {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 4px;
      }
    `,
  ],
})
export class LoginComponent {
  loginForm: FormGroup;
  loading = signal<boolean>(false);
  demoLoading = signal<boolean>(false);
  error = signal<string>("");
  showPassword = signal<boolean>(false);

  mockupImages = signal<string[]>([
    "https://picsum.photos/seed/udagram1/208/400",
    "https://picsum.photos/seed/udagram2/208/400",
    "https://picsum.photos/seed/udagram3/208/400",
  ]);
  currentMockupIndex = signal<number>(0);

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private demoService: DemoService,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      email: ["", [Validators.required, Validators.email]],
      password: ["", [Validators.required, Validators.minLength(6)]],
    });

    // Rotate mockup images
    setInterval(() => {
      this.currentMockupIndex.update(
        (i) => (i + 1) % this.mockupImages().length
      );
    }, 5000);
  }

  togglePassword(): void {
    this.showPassword.update((v) => !v);
  }

  onSubmit(): void {
    if (this.loginForm.invalid) return;

    this.loading.set(true);
    this.error.set("");

    const { email, password } = this.loginForm.value;

    this.authService.login(email, password).subscribe({
      next: () => {
        this.router.navigate(["/feed"]);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(
          err.error?.message || "Login failed. Please check your credentials."
        );
      },
    });
  }

  loginAsDemo(): void {
    this.demoLoading.set(true);
    this.error.set("");

    // Enable demo mode
    this.demoService.enableDemoMode();

    // Login with demo credentials
    const demoUser = this.demoService.demoUser;

    this.authService.login(demoUser.email, "demo123456").subscribe({
      next: () => {
        this.router.navigate(["/feed"]);
      },
      error: () => {
        // Even if API fails, use mock login for demo
        this.authService
          .login(demoUser.email, "demo123456")
          .subscribe({
            next: () => this.router.navigate(["/feed"]),
            error: () => {
              this.demoLoading.set(false);
              this.router.navigate(["/feed"]);
            },
          });
      },
    });
  }
}
