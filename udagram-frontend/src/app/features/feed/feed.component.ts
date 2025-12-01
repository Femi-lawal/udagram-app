import { Component, OnInit, signal, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterLink } from "@angular/router";
import { FeedService, FeedItem } from "../../core/services/feed.service";
import { PostCardComponent } from "../../shared/components/post-card/post-card.component";
import { StoriesBarComponent } from "../../shared/components/stories-bar/stories-bar.component";

@Component({
  selector: "app-feed",
  standalone: true,
  imports: [CommonModule, RouterLink, PostCardComponent, StoriesBarComponent],
  template: `
    <div class="feed-page">
      <div class="feed-container">
        <!-- Main Feed -->
        <div class="feed-main">
          <!-- Stories -->
          <app-stories-bar class="feed-stories"></app-stories-bar>

          <!-- Posts -->
          <div class="feed-posts">
            @if (loading()) {
            <div class="feed-loading">
              <div class="spinner"></div>
              <p>Loading your feed...</p>
            </div>
            } @else if (posts().length === 0) {
            <div class="feed-empty">
              <span class="material-icons">photo_camera</span>
              <h2>Welcome to Udagram</h2>
              <p>
                When you follow people, you'll see the photos they post here.
              </p>
              <a routerLink="/explore" class="btn btn--primary"
                >Find People to Follow</a
              >
            </div>
            } @else { @for (post of posts(); track post.id) {
            <app-post-card
              [post]="post"
              (onLike)="handleLike($event)"
              (onComment)="handleComment($event)"
              (onShare)="handleShare($event)"
              (onSave)="handleSave($event)"
              data-testid="post-card"
            ></app-post-card>
            } @if (hasMore()) {
            <button
              class="feed-load-more btn btn--outline"
              (click)="loadMore()"
            >
              Load More
            </button>
            } }
          </div>
        </div>

        <!-- Sidebar (Desktop) -->
        <aside class="feed-sidebar">
          <div class="sidebar-profile">
            <img
              [src]="currentUserAvatar()"
              class="avatar avatar--lg"
              alt="Your profile"
            />
            <div class="sidebar-profile__info">
              <a routerLink="/profile" class="sidebar-profile__username">{{
                currentUserEmail()
              }}</a>
              <span class="sidebar-profile__name text-secondary">You</span>
            </div>
            <button class="btn btn--secondary">Switch</button>
          </div>

          <div class="sidebar-suggestions">
            <div class="sidebar-suggestions__header">
              <span class="text-secondary">Suggestions For You</span>
              <a href="#" class="sidebar-suggestions__see-all">See All</a>
            </div>

            @for (suggestion of suggestions; track suggestion.username) {
            <div class="sidebar-suggestion">
              <img [src]="suggestion.avatar" class="avatar" alt="" />
              <div class="sidebar-suggestion__info">
                <span class="sidebar-suggestion__username">{{
                  suggestion.username
                }}</span>
                <span class="sidebar-suggestion__reason text-secondary">{{
                  suggestion.reason
                }}</span>
              </div>
              <button class="btn btn--secondary">Follow</button>
            </div>
            }
          </div>

          <footer class="sidebar-footer">
            <nav class="sidebar-footer__nav">
              <a href="#">About</a> · <a href="#">Help</a> ·
              <a href="#">Press</a> · <a href="#">API</a> ·
              <a href="#">Jobs</a> · <a href="#">Privacy</a> ·
              <a href="#">Terms</a>
            </nav>
            <p class="sidebar-footer__copyright">© 2024 UDAGRAM</p>
          </footer>
        </aside>
      </div>
    </div>
  `,
  styles: [
    `
      .feed-page {
        min-height: 100vh;
        background-color: var(--ig-light);
      }

      .feed-container {
        max-width: var(--ig-max-width);
        margin: 0 auto;
        padding: var(--ig-spacing-lg) var(--ig-spacing-md);
        display: flex;
        gap: var(--ig-spacing-xl);

        @media (max-width: 935px) {
          justify-content: center;
        }
      }

      .feed-main {
        flex: 0 0 var(--ig-feed-width);
        max-width: 100%;

        @media (max-width: 614px) {
          flex: 1;
        }
      }

      .feed-stories {
        margin-bottom: var(--ig-spacing-lg);
      }

      .feed-posts {
        display: flex;
        flex-direction: column;
        gap: var(--ig-spacing-lg);
      }

      .feed-loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 48px;

        p {
          margin-top: var(--ig-spacing-md);
          color: var(--ig-secondary);
        }
      }

      .feed-empty {
        text-align: center;
        padding: 48px;
        background: var(--ig-white);
        border: 1px solid var(--ig-border);
        border-radius: var(--ig-radius-sm);

        .material-icons {
          font-size: 64px;
          color: var(--ig-dark);
          margin-bottom: var(--ig-spacing-md);
        }

        h2 {
          margin-bottom: var(--ig-spacing-sm);
          font-size: var(--ig-font-lg);
        }

        p {
          color: var(--ig-secondary);
          margin-bottom: var(--ig-spacing-lg);
        }
      }

      .feed-load-more {
        width: 100%;
        padding: var(--ig-spacing-md);
      }

      .feed-sidebar {
        flex: 0 0 293px;
        position: sticky;
        top: 88px;
        height: fit-content;

        @media (max-width: 935px) {
          display: none;
        }
      }

      .sidebar-profile {
        display: flex;
        align-items: center;
        gap: var(--ig-spacing-md);
        margin-bottom: var(--ig-spacing-lg);

        &__info {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        &__username {
          font-weight: 600;
          color: var(--ig-dark);
          text-decoration: none;

          &:hover {
            text-decoration: underline;
          }
        }

        &__name {
          font-size: var(--ig-font-xs);
        }
      }

      .sidebar-suggestions {
        margin-bottom: var(--ig-spacing-lg);

        &__header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--ig-spacing-md);
          font-size: var(--ig-font-sm);
        }

        &__see-all {
          font-weight: 600;
          color: var(--ig-dark);
          font-size: var(--ig-font-xs);
        }
      }

      .sidebar-suggestion {
        display: flex;
        align-items: center;
        gap: var(--ig-spacing-sm);
        margin-bottom: var(--ig-spacing-sm);

        &__info {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        &__username {
          font-weight: 600;
          font-size: var(--ig-font-xs);
        }

        &__reason {
          font-size: 11px;
        }
      }

      .sidebar-footer {
        &__nav {
          font-size: 11px;
          color: var(--ig-border);
          line-height: 1.8;

          a {
            color: inherit;
            text-decoration: none;
          }
        }

        &__copyright {
          margin-top: var(--ig-spacing-md);
          font-size: 11px;
          color: var(--ig-border);
          text-transform: uppercase;
        }
      }
    `,
  ],
})
export class FeedComponent implements OnInit {
  private feedService = inject(FeedService);

  posts = signal<FeedItem[]>([]);
  loading = signal<boolean>(true);
  hasMore = signal<boolean>(true);
  currentPage = signal<number>(1);

  currentUserEmail = signal<string>("user@example.com");
  currentUserAvatar = signal<string>("https://i.pravatar.cc/150?u=user");

  suggestions = [
    {
      username: "nature_lover",
      avatar: "https://i.pravatar.cc/150?u=nature",
      reason: "Followed by friend",
    },
    {
      username: "travel_pics",
      avatar: "https://i.pravatar.cc/150?u=travel",
      reason: "Popular",
    },
    {
      username: "food_diary",
      avatar: "https://i.pravatar.cc/150?u=food",
      reason: "New to Udagram",
    },
    {
      username: "art_gallery",
      avatar: "https://i.pravatar.cc/150?u=art",
      reason: "Suggested for you",
    },
  ];

  ngOnInit(): void {
    this.loadFeed();
  }

  loadFeed(): void {
    this.loading.set(true);
    this.feedService.getFeed(this.currentPage(), 10).subscribe({
      next: (response) => {
        this.posts.set(response.items);
        this.hasMore.set(response.page < response.totalPages);
        this.loading.set(false);
      },
      error: (error) => {
        console.error("Error loading feed:", error);
        this.loading.set(false);
      },
    });
  }

  loadMore(): void {
    this.currentPage.update((p) => p + 1);
    this.feedService.getFeed(this.currentPage(), 10).subscribe({
      next: (response) => {
        this.posts.update((current) => [...current, ...response.items]);
        this.hasMore.set(response.page < response.totalPages);
      },
    });
  }

  handleLike(post: FeedItem): void {
    if (post.isLiked) {
      this.feedService.unlikePost(post.id).subscribe();
    } else {
      this.feedService.likePost(post.id).subscribe();
    }
    // Optimistic update
    this.posts.update((posts) =>
      posts.map((p) =>
        p.id === post.id
          ? {
              ...p,
              isLiked: !p.isLiked,
              likes: p.isLiked ? p.likes - 1 : p.likes + 1,
            }
          : p
      )
    );
  }

  handleComment(post: FeedItem): void {
    console.log("Comment on post:", post.id);
  }

  handleShare(post: FeedItem): void {
    console.log("Share post:", post.id);
  }

  handleSave(post: FeedItem): void {
    console.log("Save post:", post.id);
  }
}
