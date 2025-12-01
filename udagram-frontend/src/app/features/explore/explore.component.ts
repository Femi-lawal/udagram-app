import { Component, OnInit, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterLink } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { FeedService, FeedItem } from "../../core/services/feed.service";

@Component({
  selector: "app-explore",
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <div class="explore-page">
      <!-- Search Bar (Mobile) -->
      <div class="search-container">
        <div class="search-input-wrapper">
          <span class="material-icons-outlined search-icon">search</span>
          <input
            type="text"
            class="search-input"
            [(ngModel)]="searchQuery"
            placeholder="Search"
            (input)="onSearch()"
            data-testid="search-input"
          />
          @if (searchQuery) {
          <button class="search-clear" (click)="clearSearch()">
            <span class="material-icons-outlined">cancel</span>
          </button>
          }
        </div>
      </div>

      <!-- Category Tabs -->
      <div class="category-tabs">
        @for (category of categories; track category.id) {
        <button
          class="category-tab"
          [class.category-tab--active]="activeCategory() === category.id"
          (click)="setCategory(category.id)"
        >
          <span class="material-icons-outlined">{{ category.icon }}</span>
          {{ category.label }}
        </button>
        }
      </div>

      <!-- Explore Grid -->
      <div class="explore-grid" data-testid="explore-grid">
        @if (loading()) {
        <div class="loading-overlay">
          <span class="spinner"></span>
        </div>
        } @else if (posts().length === 0) {
        <div class="empty-state">
          <span class="material-icons-outlined">explore</span>
          <h3>Start exploring</h3>
          <p>
            Photos and videos from accounts you don't follow will appear here.
          </p>
        </div>
        } @else { @for (post of posts(); track post.id; let i = $index) {
        <div
          class="explore-tile"
          [class.explore-tile--large]="shouldBeLarge(i)"
          [routerLink]="['/post', post.id]"
          data-testid="explore-tile"
        >
          <img [src]="post.url" [alt]="post.caption" loading="lazy" />
          <div class="explore-tile__overlay">
            <span class="explore-tile__stat">
              <span class="material-icons">favorite</span>
              {{ formatCount(post.likes) }}
            </span>
            <span class="explore-tile__stat">
              <span class="material-icons">chat_bubble</span>
              {{ formatCount(post.comments?.length || 0) }}
            </span>
          </div>

          @if (post.hasMultiple) {
          <span class="explore-tile__multiple">
            <span class="material-icons">collections</span>
          </span>
          } @if (post.isVideo) {
          <span class="explore-tile__video">
            <span class="material-icons">play_arrow</span>
          </span>
          }
        </div>
        } }
      </div>

      <!-- Load More -->
      @if (!loading() && hasMore()) {
      <div class="load-more">
        <button class="btn btn--secondary" (click)="loadMore()">
          Load more
        </button>
      </div>
      }
    </div>
  `,
  styles: [
    `
      .explore-page {
        max-width: 935px;
        margin: 0 auto;
        padding-top: var(--ig-spacing-md);
      }

      .search-container {
        display: none;
        padding: var(--ig-spacing-sm) var(--ig-spacing-md);

        @media (max-width: 735px) {
          display: block;
        }
      }

      .search-input-wrapper {
        position: relative;
        display: flex;
        align-items: center;
      }

      .search-icon {
        position: absolute;
        left: 12px;
        color: var(--ig-secondary);
        font-size: 16px;
      }

      .search-input {
        width: 100%;
        height: 36px;
        padding: 0 36px;
        border: none;
        border-radius: var(--ig-radius-sm);
        background: var(--ig-light);
        font-size: var(--ig-font-md);

        &:focus {
          outline: none;
        }

        &::placeholder {
          color: var(--ig-secondary);
        }
      }

      .search-clear {
        position: absolute;
        right: 8px;
        background: none;
        border: none;
        padding: 4px;
        cursor: pointer;
        display: flex;

        .material-icons-outlined {
          font-size: 16px;
          color: var(--ig-secondary);
        }
      }

      .category-tabs {
        display: flex;
        gap: var(--ig-spacing-sm);
        padding: var(--ig-spacing-md);
        overflow-x: auto;
        scrollbar-width: none;

        &::-webkit-scrollbar {
          display: none;
        }
      }

      .category-tab {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: var(--ig-spacing-xs) var(--ig-spacing-sm);
        background: var(--ig-light);
        border: none;
        border-radius: var(--ig-radius-sm);
        font-size: var(--ig-font-sm);
        color: var(--ig-dark);
        cursor: pointer;
        white-space: nowrap;
        transition: background-color 0.2s;

        .material-icons-outlined {
          font-size: 16px;
        }

        &--active {
          background: var(--ig-dark);
          color: white;
        }

        &:hover:not(&--active) {
          background: var(--ig-border);
        }
      }

      .explore-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 4px;
        padding: 4px;
        position: relative;
        min-height: 300px;

        @media (min-width: 736px) {
          gap: var(--ig-spacing-xl);
          padding: 0 var(--ig-spacing-md);
        }
      }

      .explore-tile {
        position: relative;
        aspect-ratio: 1;
        cursor: pointer;
        overflow: hidden;
        background: var(--ig-light);

        &--large {
          grid-column: span 1;
          grid-row: span 1;

          @media (min-width: 736px) {
            grid-column: span 2;
            grid-row: span 2;
          }
        }

        img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.2s;
        }

        &:hover img {
          transform: scale(1.02);
        }

        &__overlay {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--ig-spacing-lg);
          opacity: 0;
          transition: opacity 0.2s;
        }

        &:hover .explore-tile__overlay {
          opacity: 1;
        }

        &__stat {
          display: flex;
          align-items: center;
          gap: 6px;
          color: white;
          font-weight: 600;
          font-size: 16px;

          .material-icons {
            font-size: 20px;
          }
        }

        &__multiple,
        &__video {
          position: absolute;
          top: var(--ig-spacing-sm);
          right: var(--ig-spacing-sm);
          color: white;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);

          .material-icons {
            font-size: 24px;
          }
        }
      }

      .loading-overlay {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--ig-white);
      }

      .empty-state {
        grid-column: 1 / -1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 48px;
        text-align: center;

        .material-icons-outlined {
          font-size: 64px;
          color: var(--ig-dark);
          margin-bottom: var(--ig-spacing-md);
        }

        h3 {
          font-size: 24px;
          font-weight: 300;
          margin-bottom: var(--ig-spacing-sm);
        }

        p {
          color: var(--ig-secondary);
        }
      }

      .load-more {
        display: flex;
        justify-content: center;
        padding: var(--ig-spacing-xl);
      }
    `,
  ],
})
export class ExploreComponent implements OnInit {
  posts = signal<FeedItem[]>([]);
  loading = signal<boolean>(true);
  hasMore = signal<boolean>(true);
  searchQuery = "";
  activeCategory = signal<string>("all");

  categories = [
    { id: "all", label: "All", icon: "apps" },
    { id: "travel", label: "Travel", icon: "flight" },
    { id: "food", label: "Food", icon: "restaurant" },
    { id: "nature", label: "Nature", icon: "landscape" },
    { id: "fashion", label: "Fashion", icon: "checkroom" },
    { id: "art", label: "Art", icon: "palette" },
  ];

  private page = 1;

  constructor(private feedService: FeedService) {}

  ngOnInit(): void {
    this.loadPosts();
  }

  loadPosts(): void {
    this.loading.set(true);

    this.feedService.getFeed(this.page).subscribe({
      next: (response) => {
        this.posts.set(response.items);
        this.hasMore.set(this.page < response.totalPages);
        this.loading.set(false);
      },
      error: () => {
        // Use mock data on error
        this.posts.set(this.generateMockPosts());
        this.loading.set(false);
      },
    });
  }

  loadMore(): void {
    this.page++;
    this.loading.set(true);

    this.feedService.getFeed(this.page).subscribe({
      next: (response) => {
        this.posts.update((posts) => [...posts, ...response.items]);
        this.hasMore.set(this.page < response.totalPages);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  setCategory(categoryId: string): void {
    this.activeCategory.set(categoryId);
    this.page = 1;
    this.loadPosts();
  }

  onSearch(): void {
    // Implement search functionality
    console.log("Searching:", this.searchQuery);
  }

  clearSearch(): void {
    this.searchQuery = "";
  }

  shouldBeLarge(index: number): boolean {
    // Make every 9th item (starting from 0) span 2x2
    return index % 9 === 0;
  }

  formatCount(count: number): string {
    if (count >= 1000000) {
      return (count / 1000000).toFixed(1) + "M";
    }
    if (count >= 1000) {
      return (count / 1000).toFixed(1) + "K";
    }
    return count.toString();
  }

  private generateMockPosts(): FeedItem[] {
    return Array.from({ length: 12 }, (_, i) => ({
      id: `explore-${i + 1}`,
      caption: `Explore post ${i + 1}`,
      url: `https://picsum.photos/seed/explore${i}/600/600`,
      createdAt: new Date(),
      updatedAt: new Date(),
      user: { id: `user-${i}`, username: `explorer${i}` },
      likes: Math.floor(Math.random() * 10000),
      isLiked: false,
      hasMultiple: i % 5 === 0,
      isVideo: i % 7 === 0,
    })) as FeedItem[];
  }
}
