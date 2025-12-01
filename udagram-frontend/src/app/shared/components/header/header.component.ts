import { Component, signal, Output, EventEmitter } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { RouterLink, RouterLinkActive } from "@angular/router";
import { AuthService } from "../../../core/services/auth.service";

@Component({
  selector: "app-header",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive],
  template: `
    <header class="header">
      <div class="header__container">
        <!-- Logo -->
        <a routerLink="/feed" class="header__logo">
          <span class="header__logo-text">Udagram</span>
        </a>

        <!-- Search Bar (Desktop) -->
        <div class="header__search">
          <span class="material-icons header__search-icon">search</span>
          <input
            type="text"
            placeholder="Search"
            class="header__search-input"
            [(ngModel)]="searchQuery"
            (keyup.enter)="onSearch()"
          />
        </div>

        <!-- Navigation Icons -->
        <nav class="header__nav">
          <a
            routerLink="/feed"
            routerLinkActive="active"
            class="header__nav-item"
            data-testid="nav-home"
          >
            <span class="material-icons">home</span>
          </a>
          <a
            routerLink="/explore"
            routerLinkActive="active"
            class="header__nav-item"
            data-testid="nav-explore"
          >
            <span class="material-icons">explore</span>
          </a>
          <button
            class="header__nav-item"
            (click)="openUploadModal.emit()"
            data-testid="nav-upload"
          >
            <span class="material-icons">add_box</span>
          </button>
          <button
            class="header__nav-item"
            (click)="toggleNotifications()"
            data-testid="nav-notifications"
          >
            <span class="material-icons">favorite_border</span>
            @if (hasNotifications()) {
            <span class="header__notification-badge"></span>
            }
          </button>
          <a
            routerLink="/profile"
            routerLinkActive="active"
            class="header__nav-item header__nav-item--profile"
            data-testid="nav-profile"
          >
            <img
              [src]="getUserAvatar()"
              [alt]="getUserEmail()"
              class="header__avatar"
            />
          </a>
        </nav>
      </div>
    </header>

    <!-- Mobile Bottom Navigation -->
    <nav class="mobile-nav">
      <a routerLink="/feed" routerLinkActive="active" class="mobile-nav__item">
        <span class="material-icons">home</span>
      </a>
      <a
        routerLink="/explore"
        routerLinkActive="active"
        class="mobile-nav__item"
      >
        <span class="material-icons">search</span>
      </a>
      <button class="mobile-nav__item" (click)="openUploadModal.emit()">
        <span class="material-icons">add_box</span>
      </button>
      <button class="mobile-nav__item" (click)="toggleNotifications()">
        <span class="material-icons">favorite_border</span>
      </button>
      <a
        routerLink="/profile"
        routerLinkActive="active"
        class="mobile-nav__item"
      >
        <img [src]="getUserAvatar()" class="mobile-nav__avatar" alt="Profile" />
      </a>
    </nav>
  `,
  styles: [
    `
      .header {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: 60px;
        background-color: var(--ig-white);
        border-bottom: 1px solid var(--ig-border);
        z-index: 1000;

        &__container {
          max-width: var(--ig-max-width);
          height: 100%;
          margin: 0 auto;
          padding: 0 var(--ig-spacing-md);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        &__logo {
          text-decoration: none;

          &-text {
            font-family: "Billabong", cursive;
            font-size: 28px;
            color: var(--ig-dark);
          }
        }

        &__search {
          position: relative;
          display: none;

          @media (min-width: 768px) {
            display: flex;
            align-items: center;
          }

          &-icon {
            position: absolute;
            left: 12px;
            color: var(--ig-secondary);
            font-size: 16px;
          }

          &-input {
            width: 268px;
            height: 36px;
            padding: 8px 16px 8px 40px;
            background-color: var(--ig-light);
            border: none;
            border-radius: var(--ig-radius-md);
            font-size: var(--ig-font-sm);

            &:focus {
              outline: none;
            }

            &::placeholder {
              color: var(--ig-secondary);
            }
          }
        }

        &__nav {
          display: none;
          align-items: center;
          gap: var(--ig-spacing-lg);

          @media (min-width: 768px) {
            display: flex;
          }

          &-item {
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--ig-dark);
            background: none;
            border: none;
            cursor: pointer;
            position: relative;
            padding: 0;

            .material-icons {
              font-size: 26px;
            }

            &.active .material-icons {
              font-weight: 700;
            }

            &--profile {
              padding: 0;
            }
          }
        }

        &__avatar {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          object-fit: cover;
          border: 1px solid var(--ig-border);
        }

        &__notification-badge {
          position: absolute;
          top: -2px;
          right: -2px;
          width: 8px;
          height: 8px;
          background-color: var(--ig-error);
          border-radius: 50%;
        }
      }

      .mobile-nav {
        display: flex;
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        height: 50px;
        background-color: var(--ig-white);
        border-top: 1px solid var(--ig-border);
        z-index: 1000;

        @media (min-width: 768px) {
          display: none;
        }

        &__item {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--ig-dark);
          background: none;
          border: none;
          text-decoration: none;
          cursor: pointer;

          .material-icons {
            font-size: 26px;
          }

          &.active .material-icons {
            font-weight: 700;
          }
        }

        &__avatar {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          object-fit: cover;
          border: 1px solid var(--ig-border);
        }
      }
    `,
  ],
})
export class HeaderComponent {
  @Output() openUploadModal = new EventEmitter<void>();

  searchQuery = "";
  private notifications = signal<boolean>(true);

  constructor(private authService: AuthService) {}

  getUserEmail(): string {
    return this.authService.currentUser()?.email || "User";
  }

  getUserAvatar(): string {
    const user = this.authService.currentUser();
    return (
      user?.avatar || `https://i.pravatar.cc/150?u=${user?.email || "user"}`
    );
  }

  hasNotifications(): boolean {
    return this.notifications();
  }

  toggleNotifications(): void {
    this.notifications.set(false);
  }

  onSearch(): void {
    console.log("Search:", this.searchQuery);
  }
}
