import { Component, OnInit, signal, computed } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { FormsModule } from "@angular/forms";
import {
  FeedService,
  FeedItem,
  Comment,
} from "../../core/services/feed.service";
import { AuthService } from "../../core/services/auth.service";

@Component({
  selector: "app-post-detail",
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <div class="post-detail-page">
      @if (loading()) {
      <div class="loading-state">
        <span class="spinner"></span>
      </div>
      } @else if (post()) {
      <article class="post-detail" data-testid="post-detail">
        <!-- Image Section -->
        <div class="post-image">
          <img [src]="post()?.url" [alt]="post()?.caption" />
        </div>

        <!-- Content Section -->
        <div class="post-content">
          <!-- Header -->
          <header class="post-header">
            <a
              [routerLink]="['/profile', post()?.user?.username]"
              class="post-header__user"
            >
              <img
                [src]="'https://i.pravatar.cc/150?u=' + post()?.user?.username"
                [alt]="post()?.user?.username"
                class="post-header__avatar"
              />
              <span class="post-header__username">{{
                post()?.user?.username
              }}</span>
            </a>

            <button class="btn--icon" (click)="toggleMenu()">
              <span class="material-icons-outlined">more_horiz</span>
            </button>
          </header>

          <!-- Comments Section -->
          <div class="post-comments" data-testid="comments-section">
            <!-- Original Caption as first comment -->
            @if (post()?.caption) {
            <div class="comment comment--caption">
              <a
                [routerLink]="['/profile', post()?.user?.username]"
                class="comment__avatar-link"
              >
                <img
                  [src]="
                    'https://i.pravatar.cc/150?u=' + post()?.user?.username
                  "
                  [alt]="post()?.user?.username"
                  class="comment__avatar"
                />
              </a>
              <div class="comment__content">
                <p>
                  <a
                    [routerLink]="['/profile', post()?.user?.username]"
                    class="comment__username"
                  >
                    {{ post()?.user?.username }}
                  </a>
                  {{ post()?.caption }}
                </p>
                <span class="comment__time">{{
                  formatTime(post()?.createdAt)
                }}</span>
              </div>
            </div>
            }

            <!-- Comments List -->
            @for (comment of comments(); track comment.id) {
            <div class="comment" data-testid="comment">
              <a
                [routerLink]="['/profile', comment.user?.username]"
                class="comment__avatar-link"
              >
                <img
                  [src]="
                    'https://i.pravatar.cc/150?u=' + comment.user?.username
                  "
                  [alt]="comment.user?.username"
                  class="comment__avatar"
                />
              </a>
              <div class="comment__content">
                <p>
                  <a
                    [routerLink]="['/profile', comment.user?.username]"
                    class="comment__username"
                  >
                    {{ comment.user?.username }}
                  </a>
                  {{ comment.text }}
                </p>
                <div class="comment__actions">
                  <span class="comment__time">{{
                    formatTime(comment.createdAt)
                  }}</span>
                  <button class="comment__action">
                    {{ comment.likes || 0 }} likes
                  </button>
                  <button class="comment__action">Reply</button>
                </div>
              </div>
              <button class="comment__like" (click)="likeComment(comment)">
                <span
                  class="material-icons-outlined"
                  [class.liked]="comment.isLiked"
                >
                  {{ comment.isLiked ? "favorite" : "favorite_border" }}
                </span>
              </button>
            </div>
            } @if (comments().length === 0 && !post()?.caption) {
            <div class="no-comments">
              <h3>No comments yet.</h3>
              <p>Start the conversation.</p>
            </div>
            }
          </div>

          <!-- Actions -->
          <div class="post-actions">
            <div class="action-buttons">
              <button
                class="btn--icon"
                (click)="toggleLike()"
                [class.liked]="post()?.isLiked"
                data-testid="like-button"
              >
                <span class="material-icons-outlined">
                  {{ post()?.isLiked ? "favorite" : "favorite_border" }}
                </span>
              </button>
              <button class="btn--icon" (click)="focusCommentInput()">
                <span class="material-icons-outlined">chat_bubble_outline</span>
              </button>
              <button class="btn--icon">
                <span class="material-icons-outlined">send</span>
              </button>
              <button class="btn--icon btn--icon-right" (click)="toggleSave()">
                <span class="material-icons-outlined">
                  {{ isSaved() ? "bookmark" : "bookmark_border" }}
                </span>
              </button>
            </div>

            <div class="post-likes" data-testid="likes-count">
              <strong>{{ formatCount(post()?.likes || 0) }} likes</strong>
            </div>

            <div class="post-time">
              {{ formatFullDate(post()?.createdAt) }}
            </div>
          </div>

          <!-- Add Comment -->
          <div class="add-comment">
            <button class="emoji-btn" title="Add emoji">😊</button>
            <input
              #commentInput
              type="text"
              [(ngModel)]="newComment"
              placeholder="Add a comment..."
              (keyup.enter)="submitComment()"
              class="comment-input"
              data-testid="comment-input"
            />
            <button
              class="btn--text"
              [disabled]="!newComment.trim()"
              (click)="submitComment()"
              data-testid="post-comment-button"
            >
              Post
            </button>
          </div>
        </div>
      </article>

      <!-- More posts from user -->
      <section class="more-posts">
        <h3 class="more-posts__header">
          More posts from
          <a [routerLink]="['/profile', post()?.user?.username]">{{
            post()?.user?.username
          }}</a>
        </h3>

        <div class="posts-grid" data-testid="more-posts-grid">
          @for (relatedPost of relatedPosts(); track relatedPost.id) {
          <a [routerLink]="['/post', relatedPost.id]" class="post-tile">
            <img
              [src]="relatedPost.url"
              [alt]="relatedPost.caption"
              loading="lazy"
            />
            <div class="post-tile__overlay">
              <span class="post-tile__stat">
                <span class="material-icons">favorite</span>
                {{ relatedPost.likes }}
              </span>
              <span class="post-tile__stat">
                <span class="material-icons">chat_bubble</span>
                {{ relatedPost.comments?.length || 0 }}
              </span>
            </div>
          </a>
          }
        </div>
      </section>
      } @else {
      <div class="error-state">
        <span class="material-icons-outlined">error_outline</span>
        <h3>Post not found</h3>
        <p>The post you're looking for doesn't exist or has been removed.</p>
        <a routerLink="/feed" class="btn btn--primary">Go to Feed</a>
      </div>
      }
    </div>
  `,
  styles: [
    `
      .post-detail-page {
        max-width: 935px;
        margin: 0 auto;
        padding: var(--ig-spacing-lg);
      }

      .loading-state,
      .error-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 400px;
        text-align: center;

        .material-icons-outlined {
          font-size: 64px;
          margin-bottom: var(--ig-spacing-md);
        }

        h3 {
          font-size: 24px;
          font-weight: 300;
          margin-bottom: var(--ig-spacing-sm);
        }

        p {
          color: var(--ig-secondary);
          margin-bottom: var(--ig-spacing-lg);
        }
      }

      .post-detail {
        display: flex;
        background: var(--ig-white);
        border: 1px solid var(--ig-border);
        border-radius: var(--ig-radius-sm);
        overflow: hidden;

        @media (max-width: 735px) {
          flex-direction: column;
          border: none;
          border-radius: 0;
        }
      }

      .post-image {
        flex: 1;
        min-width: 0;
        max-width: 600px;
        background: var(--ig-dark);
        display: flex;
        align-items: center;
        justify-content: center;

        img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          max-height: 600px;
        }

        @media (max-width: 735px) {
          max-width: none;
        }
      }

      .post-content {
        width: 335px;
        display: flex;
        flex-direction: column;
        border-left: 1px solid var(--ig-border);

        @media (max-width: 735px) {
          width: 100%;
          border-left: none;
        }
      }

      .post-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--ig-spacing-md);
        border-bottom: 1px solid var(--ig-border);

        &__user {
          display: flex;
          align-items: center;
          gap: var(--ig-spacing-sm);
          text-decoration: none;
        }

        &__avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          object-fit: cover;
        }

        &__username {
          font-weight: 600;
          font-size: var(--ig-font-sm);
          color: var(--ig-dark);
        }
      }

      .post-comments {
        flex: 1;
        overflow-y: auto;
        padding: var(--ig-spacing-md);
        max-height: 400px;

        @media (max-width: 735px) {
          max-height: 300px;
        }
      }

      .comment {
        display: flex;
        gap: var(--ig-spacing-sm);
        margin-bottom: var(--ig-spacing-md);

        &__avatar-link {
          flex-shrink: 0;
        }

        &__avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          object-fit: cover;
        }

        &__content {
          flex: 1;
          min-width: 0;

          p {
            font-size: var(--ig-font-sm);
            line-height: 1.4;
            word-wrap: break-word;
          }
        }

        &__username {
          font-weight: 600;
          color: var(--ig-dark);
          text-decoration: none;
          margin-right: 4px;

          &:hover {
            text-decoration: underline;
          }
        }

        &__actions {
          display: flex;
          gap: var(--ig-spacing-sm);
          margin-top: var(--ig-spacing-xs);
        }

        &__time,
        &__action {
          font-size: var(--ig-font-xs);
          color: var(--ig-secondary);
        }

        &__action {
          background: none;
          border: none;
          cursor: pointer;
          font-weight: 600;
          padding: 0;

          &:hover {
            color: var(--ig-dark);
          }
        }

        &__like {
          flex-shrink: 0;
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;

          .material-icons-outlined {
            font-size: 12px;
            color: var(--ig-secondary);

            &.liked {
              color: var(--ig-error);
            }
          }
        }
      }

      .no-comments {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        min-height: 200px;

        h3 {
          font-size: var(--ig-font-lg);
          font-weight: 600;
        }

        p {
          color: var(--ig-secondary);
          font-size: var(--ig-font-sm);
        }
      }

      .post-actions {
        padding: var(--ig-spacing-sm) var(--ig-spacing-md);
        border-top: 1px solid var(--ig-border);
      }

      .action-buttons {
        display: flex;
        gap: var(--ig-spacing-md);
        padding: var(--ig-spacing-xs) 0;
      }

      .btn--icon {
        background: none;
        border: none;
        padding: 4px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;

        .material-icons-outlined {
          font-size: 24px;
          color: var(--ig-dark);
          transition: color 0.1s, transform 0.1s;
        }

        &:hover .material-icons-outlined {
          color: var(--ig-secondary);
        }

        &.liked .material-icons-outlined {
          color: var(--ig-error);
        }

        &-right {
          margin-left: auto;
        }
      }

      .post-likes {
        font-size: var(--ig-font-sm);
        margin: var(--ig-spacing-xs) 0;
      }

      .post-time {
        font-size: 10px;
        color: var(--ig-secondary);
        text-transform: uppercase;
        letter-spacing: 0.2px;
      }

      .add-comment {
        display: flex;
        align-items: center;
        padding: var(--ig-spacing-sm) var(--ig-spacing-md);
        border-top: 1px solid var(--ig-border);
      }

      .emoji-btn {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        padding: 4px;
      }

      .comment-input {
        flex: 1;
        border: none;
        padding: var(--ig-spacing-sm);
        font-size: var(--ig-font-sm);

        &:focus {
          outline: none;
        }

        &::placeholder {
          color: var(--ig-secondary);
        }
      }

      .btn--text {
        background: none;
        border: none;
        color: var(--ig-primary);
        font-weight: 600;
        font-size: var(--ig-font-sm);
        cursor: pointer;
        padding: var(--ig-spacing-xs) var(--ig-spacing-sm);

        &:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        &:not(:disabled):hover {
          color: var(--ig-dark);
        }
      }

      .more-posts {
        margin-top: 48px;
        border-top: 1px solid var(--ig-border);
        padding-top: var(--ig-spacing-xl);

        &__header {
          font-size: var(--ig-font-sm);
          color: var(--ig-secondary);
          margin-bottom: var(--ig-spacing-lg);

          a {
            color: var(--ig-dark);
            text-decoration: none;

            &:hover {
              text-decoration: underline;
            }
          }
        }
      }

      .posts-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 28px;

        @media (max-width: 735px) {
          gap: 3px;
        }
      }

      .post-tile {
        position: relative;
        aspect-ratio: 1;
        overflow: hidden;
        display: block;

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

        &:hover .post-tile__overlay {
          opacity: 1;
        }

        &__stat {
          display: flex;
          align-items: center;
          gap: 6px;
          color: white;
          font-weight: 600;

          .material-icons {
            font-size: 18px;
          }
        }
      }
    `,
  ],
})
export class PostDetailComponent implements OnInit {
  post = signal<FeedItem | null>(null);
  comments = signal<Comment[]>([]);
  relatedPosts = signal<FeedItem[]>([]);
  loading = signal<boolean>(true);
  isSaved = signal<boolean>(false);

  newComment = "";

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private feedService: FeedService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe((params) => {
      const postId = params["id"];
      if (postId) {
        this.loadPost(postId);
      }
    });
  }

  loadPost(postId: string): void {
    this.loading.set(true);

    this.feedService.getPost(postId).subscribe({
      next: (post) => {
        this.post.set(post);
        this.comments.set(post.comments || []);
        this.loadRelatedPosts(post.user?.username || "");
        this.loading.set(false);
      },
      error: () => {
        // Use mock data on error
        this.post.set({
          id: postId,
          caption:
            "Beautiful sunset view from the mountains. Nature never fails to amaze me! 🌅 #photography #nature #sunset",
          url: `https://picsum.photos/seed/${postId}/800/800`,
          createdAt: new Date(Date.now() - 3600000),
          updatedAt: new Date(),
          user: { id: "1", username: "photographer" },
          likes: 1234,
          isLiked: false,
        });

        this.comments.set([
          {
            id: "c1",
            text: "Absolutely stunning! 😍",
            user: { id: "2", username: "naturelover" },
            createdAt: new Date(Date.now() - 1800000),
            likes: 12,
            isLiked: false,
          },
          {
            id: "c2",
            text: "Where was this taken?",
            user: { id: "3", username: "traveler" },
            createdAt: new Date(Date.now() - 900000),
            likes: 5,
            isLiked: false,
          },
          {
            id: "c3",
            text: "Perfect timing for this shot!",
            user: { id: "4", username: "photofan" },
            createdAt: new Date(Date.now() - 300000),
            likes: 8,
            isLiked: true,
          },
        ]);

        this.loadRelatedPosts("photographer");
        this.loading.set(false);
      },
    });
  }

  loadRelatedPosts(username: string): void {
    // Mock related posts
    this.relatedPosts.set(
      Array.from({ length: 6 }, (_, i) => ({
        id: `related-${i + 1}`,
        caption: `Related post ${i + 1}`,
        url: `https://picsum.photos/seed/related${i}/600/600`,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: { id: "1", username },
        likes: Math.floor(Math.random() * 1000),
        isLiked: false,
      }))
    );
  }

  toggleLike(): void {
    const currentPost = this.post();
    if (currentPost) {
      const isLiked = !currentPost.isLiked;
      this.post.set({
        ...currentPost,
        isLiked,
        likes: isLiked ? currentPost.likes + 1 : currentPost.likes - 1,
      });

      if (isLiked) {
        this.feedService.likePost(currentPost.id).subscribe();
      } else {
        this.feedService.unlikePost(currentPost.id).subscribe();
      }
    }
  }

  toggleSave(): void {
    this.isSaved.update((v) => !v);
  }

  toggleMenu(): void {
    // Open post options menu
    console.log("Toggle menu");
  }

  likeComment(comment: Comment): void {
    this.comments.update((comments) =>
      comments.map((c) =>
        c.id === comment.id
          ? {
              ...c,
              isLiked: !c.isLiked,
              likes: c.isLiked ? (c.likes || 0) - 1 : (c.likes || 0) + 1,
            }
          : c
      )
    );
  }

  focusCommentInput(): void {
    // Focus the comment input
    const input = document.querySelector(
      '[data-testid="comment-input"]'
    ) as HTMLInputElement;
    if (input) input.focus();
  }

  submitComment(): void {
    if (!this.newComment.trim()) return;

    const newComment: Comment = {
      id: `c-${Date.now()}`,
      text: this.newComment.trim(),
      user: {
        id: this.authService.currentUser()?.id || "me",
        username: this.authService.currentUser()?.username || "me",
      },
      createdAt: new Date(),
      likes: 0,
      isLiked: false,
    };

    this.comments.update((comments) => [...comments, newComment]);

    const postId = this.post()?.id;
    if (postId) {
      this.feedService.addComment(postId, this.newComment.trim()).subscribe();
    }

    this.newComment = "";
  }

  formatTime(date: Date | undefined): string {
    if (!date) return "";

    const now = new Date();
    const postDate = new Date(date);
    const diffMs = now.getTime() - postDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    const diffWeeks = Math.floor(diffDays / 7);

    if (diffMins < 1) return "now";
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return `${diffWeeks}w`;
  }

  formatFullDate(date: Date | undefined): string {
    if (!date) return "";
    return new Date(date).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  formatCount(count: number): string {
    if (count >= 1000000) {
      return (count / 1000000).toFixed(1) + " million";
    }
    if (count >= 1000) {
      return count.toLocaleString();
    }
    return count.toString();
  }
}
