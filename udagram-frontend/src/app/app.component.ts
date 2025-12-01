import { Component, signal } from "@angular/core";
import { RouterOutlet, Router, NavigationEnd } from "@angular/router";
import { HeaderComponent } from "./shared/components/header/header.component";
import { UploadModalComponent } from "./shared/components/upload-modal/upload-modal.component";
import { AuthService } from "./core/services/auth.service";
import { CommonModule } from "@angular/common";
import { filter } from "rxjs/operators";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [CommonModule, RouterOutlet, HeaderComponent, UploadModalComponent],
  template: `
    @if (authService.isAuthenticated()) {
    <app-header (openUploadModal)="showUploadModal.set(true)"></app-header>
    }

    <main [class.authenticated]="authService.isAuthenticated()">
      <router-outlet></router-outlet>
    </main>

    @if (showUploadModal()) {
    <app-upload-modal
      (close)="showUploadModal.set(false)"
      (uploaded)="onPostUploaded()"
    ></app-upload-modal>
    }
  `,
  styles: [
    `
      main {
        min-height: 100vh;
        background-color: var(--ig-light);

        &.authenticated {
          padding-top: 60px;
          padding-bottom: 60px;
        }
      }

      @media (min-width: 768px) {
        main.authenticated {
          padding-bottom: 0;
        }
      }
    `,
  ],
})
export class AppComponent {
  showUploadModal = signal<boolean>(false);

  constructor(public authService: AuthService, private router: Router) {
    // Close modal on navigation
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        this.showUploadModal.set(false);
      });
  }

  onPostUploaded(): void {
    // Navigate to feed to see the new post
    this.router.navigate(["/feed"]);
  }
}
