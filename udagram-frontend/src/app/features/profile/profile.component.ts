import { Component, OnInit, signal, computed } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { AuthService } from "../../core/services/auth.service";
import { FeedService, FeedItem } from "../../core/services/feed.service";

interface UserProfile {
  id: string;
  username: string;
  email: string;
  bio?: string;
  website?: string;
  avatar?: string;
  postsCount: number;
  followersCount: number;
  followingCount: number;
  isFollowing?: boolean;
}

@Component({
  selector: "app-profile",
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="profile-page">
      <!-- Profile Header -->
      <header class="profile-header">
        <div class="profile-avatar">
          @if (profile()?.avatar) {
          <img [src]="profile()?.avatar" [alt]="profile()?.username" />
          } @else {
          <div class="avatar-placeholder">
            {{ profile()?.username?.charAt(0)?.toUpperCase() }}
          </div>
          } @if (isOwnProfile()) {
          <button class="avatar-edit" title="Change profile photo">
            <span class="material-icons-outlined">photo_camera</span>
          </button>
          }
        </div>

        <div class="profile-info">
          <div class="profile-info__header">
            <h1 class="profile-username" data-testid="profile-username">
              {{ profile()?.username }}
            </h1>

            @if (isOwnProfile()) {
            <button
              class="btn btn--secondary"
              data-testid="edit-profile-button"
            >
              Edit profile
            </button>
            <button class="btn btn--icon">
              <span class="material-icons-outlined">settings</span>
            </button>
            } @else { @if (profile()?.isFollowing) {
            <button
              class="btn btn--secondary"
              (click)="toggleFollow()"
              data-testid="unfollow-button"
            >
              Following
            </button>
            } @else {
            <button
              class="btn btn--primary"
              (click)="toggleFollow()"
              data-testid="follow-button"
            >
              Follow
            </button>
            }
            <button class="btn btn--icon">
              <span class="material-icons-outlined">more_horiz</span>
            </button>
            }
          </div>

          <div class="profile-stats">
            <div class="stat">
              <span class="stat__count">{{ profile()?.postsCount || 0 }}</span>
              <span class="stat__label">posts</span>
            </div>
            <button class="stat" data-testid="followers-button">
              <span class="stat__count">{{
                formatCount(profile()?.followersCount || 0)
              }}</span>
              <span class="stat__label">followers</span>
            </button>
            <button class="stat" data-testid="following-button">
              <span class="stat__count">{{
                formatCount(profile()?.followingCount || 0)
              }}</span>
              <span class="stat__label">following</span>
            </button>
          </div>

          <div class="profile-bio">
            <h2 class="profile-name">{{ profile()?.username }}</h2>
            @if (profile()?.bio) {
            <p class="profile-bio__text">{{ profile()?.bio }}</p>
            } @if (profile()?.website) {
            <a
              [href]="profile()?.website"
              class="profile-website"
              target="_blank"
              rel="noopener"
            >
              {{ profile()?.website }}
            </a>
            }
          </div>
        </div>
      </header>

      <!-- Mobile Stats (shown below header on mobile) -->
      <div class="profile-stats profile-stats--mobile">
        <div class="stat">
          <span class="stat__count">{{ profile()?.postsCount || 0 }}</span>
          <span class="stat__label">posts</span>
        </div>
        <button class="stat">
          <span class="stat__count">{{
            formatCount(profile()?.followersCount || 0)
          }}</span>
          <span class="stat__label">followers</span>
        </button>
        <button class="stat">
          <span class="stat__count">{{
            formatCount(profile()?.followingCount || 0)
          }}</span>
          <span class="stat__label">following</span>
        </button>
      </div>

      <!-- Mobile Bio -->
      <div class="profile-bio profile-bio--mobile">
        <h2 class="profile-name">{{ profile()?.username }}</h2>
        @if (profile()?.bio) {
        <p class="profile-bio__text">{{ profile()?.bio }}</p>
        } @if (profile()?.website) {
        <a
          [href]="profile()?.website"
          class="profile-website"
          target="_blank"
          rel="noopener"
        >
          {{ profile()?.website }}
        </a>
        }
      </div>

      <!-- Tabs -->
      <div class="profile-tabs">
        <button
          class="tab"
          [class.tab--active]="activeTab() === 'posts'"
          (click)="activeTab.set('posts')"
        >
          <span class="material-icons-outlined">grid_on</span>
          <span class="tab__label">POSTS</span>
        </button>

        @if (isOwnProfile()) {
        <button
          class="tab"
          [class.tab--active]="activeTab() === 'saved'"
          (click)="activeTab.set('saved')"
        >
          <span class="material-icons-outlined">bookmark_border</span>
          <span class="tab__label">SAVED</span>
        </button>
        }

        <button
          class="tab"
          [class.tab--active]="activeTab() === 'tagged'"
          (click)="activeTab.set('tagged')"
        >
          <span class="material-icons-outlined">person_pin</span>
          <span class="tab__label">TAGGED</span>
        </button>
      </div>

      <!-- Posts Grid -->
      <div class="posts-grid" data-testid="posts-grid">
        @if (loading()) {
        <div class="loading-state">
          <span class="spinner"></span>
        </div>
        } @else if (posts().length === 0) {
        <div class="empty-state">
          @if (activeTab() === 'posts') { @if (isOwnProfile()) {
          <span class="material-icons-outlined">photo_camera</span>
          <h3>Share Photos</h3>
          <p>When you share photos, they will appear on your profile.</p>
          <button class="btn btn--primary" (click)="openUpload()">
            Share your first photo
          </button>
          } @else {
          <span class="material-icons-outlined">photo_camera</span>
          <h3>No Posts Yet</h3>
          } } @else if (activeTab() === 'saved') {
          <span class="material-icons-outlined">bookmark_border</span>
          <h3>Save</h3>
          <p>Save photos and videos that you want to see again.</p>
          } @else {
          <span class="material-icons-outlined">person_pin</span>
          <h3>Photos of you</h3>
          <p>When people tag you in photos, they'll appear here.</p>
          }
        </div>
        } @else { @for (post of posts(); track post.id) {
        <div class="post-tile" (click)="openPost(post)" data-testid="post-tile">
          <img [src]="post.url" [alt]="post.caption" loading="lazy" />
          <div class="post-tile__overlay">
            <span class="post-tile__stat">
              <span class="material-icons">favorite</span>
              {{ post.likes }}
            </span>
            <span class="post-tile__stat">
              <span class="material-icons">chat_bubble</span>
              {{ post.comments?.length || 0 }}
            </span>
          </div>
        </div>
        } }
      </div>
    </div>
  `,
  styles: [
    `
      .profile-page {
        max-width: 935px;
        margin: 0 auto;
        padding: var(--ig-spacing-lg);
      }

      .profile-header {
        display: flex;
        gap: var(--ig-spacing-xl);
        padding-bottom: var(--ig-spacing-xl);
        border-bottom: 1px solid var(--ig-border);

        @media (max-width: 735px) {
          gap: var(--ig-spacing-md);
          padding-bottom: var(--ig-spacing-md);
          border-bottom: none;
        }
      }

      .profile-avatar {
        flex-shrink: 0;
        width: 150px;
        height: 150px;
        position: relative;

        @media (max-width: 735px) {
          width: 77px;
          height: 77px;
        }

        img,
        .avatar-placeholder {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          object-fit: cover;
          border: 1px solid var(--ig-border);
        }

        .avatar-placeholder {
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(
            135deg,
            var(--ig-primary) 0%,
            #833ab4 100%
          );
          color: white;
          font-size: 48px;
          font-weight: 300;

          @media (max-width: 735px) {
            font-size: 28px;
          }
        }

        .avatar-edit {
          position: absolute;
          bottom: 5px;
          right: 5px;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: var(--ig-white);
          border: 1px solid var(--ig-border);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background-color 0.2s;

          &:hover {
            background: var(--ig-light);
          }

          .material-icons-outlined {
            font-size: 18px;
          }
        }
      }

      .profile-info {
        flex: 1;

        &__header {
          display: flex;
          align-items: center;
          gap: var(--ig-spacing-md);
          margin-bottom: var(--ig-spacing-md);
          flex-wrap: wrap;
        }
      }

      .profile-username {
        font-size: 20px;
        font-weight: 400;
        color: var(--ig-dark);
      }

      .profile-stats {
        display: flex;
        gap: var(--ig-spacing-xl);
        margin-bottom: var(--ig-spacing-md);

        @media (max-width: 735px) {
          display: none;
        }

        &--mobile {
          display: none;

          @media (max-width: 735px) {
            display: flex;
            justify-content: space-around;
            padding: var(--ig-spacing-md) 0;
            border-top: 1px solid var(--ig-border);
            border-bottom: 1px solid var(--ig-border);
          }
        }
      }

      .stat {
        background: none;
        border: none;
        padding: 0;
        cursor: pointer;
        text-align: left;

        @media (max-width: 735px) {
          text-align: center;
          flex: 1;
        }

        &__count {
          font-weight: 600;
          color: var(--ig-dark);

          @media (max-width: 735px) {
            display: block;
          }
        }

        &__label {
          color: var(--ig-dark);

          @media (max-width: 735px) {
            color: var(--ig-secondary);
            font-size: var(--ig-font-sm);
          }
        }
      }

      .profile-bio {
        @media (max-width: 735px) {
          display: none;
        }

        &--mobile {
          display: none;

          @media (max-width: 735px) {
            display: block;
            padding: 0 var(--ig-spacing-md) var(--ig-spacing-md);
          }
        }
      }

      .profile-name {
        font-size: var(--ig-font-sm);
        font-weight: 600;
        color: var(--ig-dark);
        margin-bottom: 2px;
      }

      .profile-bio__text {
        font-size: var(--ig-font-sm);
        color: var(--ig-dark);
        line-height: 1.4;
        white-space: pre-wrap;
      }

      .profile-website {
        font-size: var(--ig-font-sm);
        color: var(--ig-primary);
        font-weight: 600;
        text-decoration: none;

        &:hover {
          text-decoration: underline;
        }
      }

      .profile-tabs {
        display: flex;
        justify-content: center;
        border-top: 1px solid var(--ig-border);
        margin-top: var(--ig-spacing-xl);

        @media (max-width: 735px) {
          margin-top: 0;
        }
      }

      .tab {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: var(--ig-spacing-md) var(--ig-spacing-lg);
        background: none;
        border: none;
        border-top: 1px solid transparent;
        margin-top: -1px;
        color: var(--ig-secondary);
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 1px;
        cursor: pointer;
        transition: color 0.2s;

        .material-icons-outlined {
          font-size: 12px;

          @media (max-width: 735px) {
            font-size: 24px;
          }
        }

        &__label {
          @media (max-width: 735px) {
            display: none;
          }
        }

        &--active {
          color: var(--ig-dark);
          border-top-color: var(--ig-dark);
        }

        &:hover {
          color: var(--ig-dark);
        }
      }

      .posts-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: var(--ig-spacing-xl);
        padding: var(--ig-spacing-lg) 0;

        @media (max-width: 735px) {
          gap: 3px;
          padding: 3px 0;
        }
      }

      .post-tile {
        position: relative;
        aspect-ratio: 1;
        cursor: pointer;
        overflow: hidden;

        img {
          width: 100%;
          height: 100%;
          object-fit: cover;
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

        &:hover .post-tile__overlay {
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
      }

      .loading-state,
      .empty-state {
        grid-column: 1 / -1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 48px;
        text-align: center;
        color: var(--ig-dark);
      }

      .empty-state {
        .material-icons-outlined {
          font-size: 48px;
          margin-bottom: var(--ig-spacing-md);

          @media (max-width: 735px) {
            font-size: 36px;
          }
        }

        h3 {
          font-size: 28px;
          font-weight: 300;
          margin-bottom: var(--ig-spacing-sm);

          @media (max-width: 735px) {
            font-size: 22px;
          }
        }

        p {
          color: var(--ig-secondary);
          margin-bottom: var(--ig-spacing-md);
        }
      }

      .btn {
        &--icon {
          width: 40px;
          height: 32px;
          padding: 0;
          background: none;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;

          .material-icons-outlined {
            font-size: 24px;
          }
        }
      }
    `,
  ],
})
export class ProfileComponent implements OnInit {
  profile = signal<UserProfile | null>(null);
  posts = signal<FeedItem[]>([]);
  loading = signal<boolean>(true);
  activeTab = signal<"posts" | "saved" | "tagged">("posts");

  isOwnProfile = computed(() => {
    const currentUser = this.authService.currentUser();
    return currentUser?.id === this.profile()?.id;
  });

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private feedService: FeedService
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe((params) => {
      const username = params["username"];
      if (username) {
        this.loadProfile(username);
      } else {
        // Load current user's profile
        const currentUser = this.authService.currentUser();
        if (currentUser && currentUser.username) {
          this.loadProfile(currentUser.username);
        }
      }
    });
  }

  loadProfile(username: string): void {
    this.loading.set(true);

    // Mock profile data - in real app, fetch from API
    setTimeout(() => {
      this.profile.set({
        id: "1",
        username: username,
        email: `${username}@example.com`,
        bio: "📷 Photography enthusiast\n✨ Creating memories\n🌍 Travel lover",
        website: "https://udagram.app",
        avatar: `https://i.pravatar.cc/300?u=${username}`,
        postsCount: 42,
        followersCount: 1234,
        followingCount: 567,
        isFollowing: false,
      });

      this.loadPosts();
    }, 500);
  }

  loadPosts(): void {
    this.feedService.getFeed().subscribe({
      next: (response) => {
        this.posts.set(response.items);
        this.loading.set(false);
      },
      error: () => {
        // Use mock data on error
        this.posts.set([
          {
            id: "1",
            caption: "Beautiful sunset",
            url: "https://picsum.photos/seed/profile1/600/600",
            createdAt: new Date(),
            updatedAt: new Date(),
            user: { id: "1", username: "user" },
            likes: 42,
            isLiked: false,
          },
          {
            id: "2",
            caption: "City lights",
            url: "https://picsum.photos/seed/profile2/600/600",
            createdAt: new Date(),
            updatedAt: new Date(),
            user: { id: "1", username: "user" },
            likes: 89,
            isLiked: true,
          },
          {
            id: "3",
            caption: "Nature walk",
            url: "https://picsum.photos/seed/profile3/600/600",
            createdAt: new Date(),
            updatedAt: new Date(),
            user: { id: "1", username: "user" },
            likes: 156,
            isLiked: false,
          },
        ]);
        this.loading.set(false);
      },
    });
  }

  toggleFollow(): void {
    const current = this.profile();
    if (current) {
      this.profile.set({
        ...current,
        isFollowing: !current.isFollowing,
        followersCount: current.isFollowing
          ? current.followersCount - 1
          : current.followersCount + 1,
      });
    }
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

  openPost(post: FeedItem): void {
    // Navigate to post detail or open modal
    console.log("Open post:", post.id);
  }

  openUpload(): void {
    // Open upload modal
    console.log("Open upload modal");
  }
}
