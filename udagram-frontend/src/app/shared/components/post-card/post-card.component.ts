import { Component, Input, Output, EventEmitter, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterLink } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { FeedItem } from "../../../core/services/feed.service";

@Component({
  selector: "app-post-card",
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <article class="post-card" data-testid="post-card">
      <!-- Header -->
      <header class="post-card__header">
        <a
          [routerLink]="['/profile', post.user?.username]"
          class="post-card__user"
        >
          <img
            [src]="getUserAvatar()"
            [alt]="post.user?.username"
            class="avatar avatar--md post-card__avatar"
          />
          <span class="post-card__username">{{ post.user?.username }}</span>
        </a>
        <button class="post-card__more" (click)="showOptions = !showOptions">
          <span class="material-icons">more_horiz</span>
        </button>

        <!-- Options Menu -->
        @if (showOptions) {
        <div class="post-card__options-menu">
          <button (click)="onReportPost()">Report</button>
          <button (click)="onUnfollow()">Unfollow</button>
          <button (click)="onGoToPost()">Go to post</button>
          <button (click)="onShare.emit(post)">Share to...</button>
          <button (click)="onCopyLink()">Copy link</button>
          <button (click)="showOptions = false">Cancel</button>
        </div>
        }
      </header>

      <!-- Image -->
      <div class="post-card__image-container" (dblclick)="handleDoubleTap()">
        <img
          [src]="post.url"
          [alt]="post.caption"
          class="post-card__image"
          loading="lazy"
          data-testid="post-image"
        />
        @if (showHeartAnimation()) {
        <div class="post-card__heart-animation">
          <span class="material-icons">favorite</span>
        </div>
        }
      </div>

      <!-- Actions -->
      <div class="post-card__actions">
        <div class="post-card__actions-left">
          <button
            class="post-card__action"
            [class.liked]="post.isLiked"
            (click)="onLike.emit(post)"
            data-testid="like-button"
          >
            <span class="material-icons">{{
              post.isLiked ? "favorite" : "favorite_border"
            }}</span>
          </button>
          <button
            class="post-card__action"
            (click)="focusComment()"
            data-testid="comment-button"
          >
            <span class="material-icons">chat_bubble_outline</span>
          </button>
          <button class="post-card__action" (click)="onShare.emit(post)">
            <span class="material-icons">send</span>
          </button>
        </div>
        <button
          class="post-card__action"
          [class.saved]="isSaved()"
          (click)="toggleSave()"
          data-testid="save-button"
        >
          <span class="material-icons">{{
            isSaved() ? "bookmark" : "bookmark_border"
          }}</span>
        </button>
      </div>

      <!-- Likes -->
      <div class="post-card__likes" data-testid="likes-count">
        <strong>{{ formatLikes(post.likes) }}</strong>
      </div>

      <!-- Caption -->
      <div class="post-card__caption">
        <a
          [routerLink]="['/profile', post.user?.username]"
          class="post-card__caption-username"
        >
          {{ post.user?.username }}
        </a>
        <span class="post-card__caption-text">{{ post.caption }}</span>
        @if (post.caption && post.caption.length > 100) {
        <button
          class="post-card__caption-more"
          *ngIf="!showFullCaption"
          (click)="showFullCaption = true"
        >
          more
        </button>
        }
      </div>

      <!-- Comments Preview -->
      @if (post.comments && post.comments.length > 0) {
      <a [routerLink]="['/post', post.id]" class="post-card__comments-link">
        View all {{ post.comments.length }} comments
      </a>
      }

      <!-- Time -->
      <time class="post-card__time">{{ getTimeAgo(post.createdAt) }}</time>

      <!-- Comment Input -->
      <div class="post-card__comment-form">
        <button class="post-card__emoji-btn">
          <span class="material-icons">sentiment_satisfied_alt</span>
        </button>
        <input
          #commentInput
          type="text"
          placeholder="Add a comment..."
          class="post-card__comment-input"
          [(ngModel)]="newComment"
          (keyup.enter)="submitComment()"
          data-testid="comment-input"
        />
        <button
          class="post-card__comment-submit"
          [disabled]="!newComment.trim()"
          (click)="submitComment()"
          data-testid="submit-comment"
        >
          Post
        </button>
      </div>
    </article>
  `,
  styles: [
    `
      .post-card {
        background: var(--ig-white);
        border: 1px solid var(--ig-border);
        border-radius: var(--ig-radius-sm);
        margin-bottom: var(--ig-spacing-lg);

        &__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--ig-spacing-sm) var(--ig-spacing-md);
          position: relative;
        }

        &__user {
          display: flex;
          align-items: center;
          gap: var(--ig-spacing-sm);
          text-decoration: none;
        }

        &__avatar {
          width: 32px;
          height: 32px;
        }

        &__username {
          font-weight: 600;
          color: var(--ig-dark);
          font-size: var(--ig-font-sm);
        }

        &__more {
          background: none;
          border: none;
          padding: var(--ig-spacing-xs);
          cursor: pointer;
          color: var(--ig-dark);
        }

        &__options-menu {
          position: absolute;
          top: 100%;
          right: var(--ig-spacing-md);
          background: var(--ig-white);
          border: 1px solid var(--ig-border);
          border-radius: var(--ig-radius-md);
          box-shadow: var(--ig-shadow-lg);
          z-index: 100;
          overflow: hidden;

          button {
            display: block;
            width: 100%;
            padding: var(--ig-spacing-sm) var(--ig-spacing-lg);
            text-align: left;
            background: none;
            border: none;
            border-bottom: 1px solid var(--ig-border);
            cursor: pointer;
            font-size: var(--ig-font-sm);

            &:last-child {
              border-bottom: none;
            }

            &:hover {
              background: var(--ig-light);
            }

            &:first-child {
              color: var(--ig-error);
              font-weight: 600;
            }
          }
        }

        &__image-container {
          position: relative;
          width: 100%;
          aspect-ratio: 1;
          background: var(--ig-dark);
          cursor: pointer;
        }

        &__image {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        &__heart-animation {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) scale(0);
          animation: heartBurst 0.8s ease-out forwards;

          .material-icons {
            font-size: 80px;
            color: white;
            filter: drop-shadow(0 0 10px rgba(0, 0, 0, 0.5));
          }
        }

        @keyframes heartBurst {
          0% {
            transform: translate(-50%, -50%) scale(0);
            opacity: 1;
          }
          50% {
            transform: translate(-50%, -50%) scale(1.2);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 0;
          }
        }

        &__actions {
          display: flex;
          justify-content: space-between;
          padding: var(--ig-spacing-sm) var(--ig-spacing-md);

          &-left {
            display: flex;
            gap: var(--ig-spacing-md);
          }
        }

        &__action {
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;

          .material-icons {
            font-size: 26px;
            color: var(--ig-dark);
            transition: color 0.2s, transform 0.2s;
          }

          &:hover .material-icons {
            opacity: 0.6;
          }

          &.liked .material-icons {
            color: var(--ig-error);
            animation: likeAnimation 0.3s ease;
          }

          &.saved .material-icons {
            color: var(--ig-dark);
          }
        }

        @keyframes likeAnimation {
          50% {
            transform: scale(1.2);
          }
        }

        &__likes {
          padding: 0 var(--ig-spacing-md);
          font-size: var(--ig-font-sm);
        }

        &__caption {
          padding: var(--ig-spacing-xs) var(--ig-spacing-md);
          font-size: var(--ig-font-sm);

          &-username {
            font-weight: 600;
            color: var(--ig-dark);
            text-decoration: none;
            margin-right: var(--ig-spacing-xs);

            &:hover {
              text-decoration: underline;
            }
          }

          &-text {
            word-wrap: break-word;
          }

          &-more {
            background: none;
            border: none;
            color: var(--ig-secondary);
            cursor: pointer;
            padding: 0;
          }
        }

        &__comments-link {
          display: block;
          padding: var(--ig-spacing-xs) var(--ig-spacing-md);
          color: var(--ig-secondary);
          font-size: var(--ig-font-sm);
          text-decoration: none;
        }

        &__time {
          display: block;
          padding: var(--ig-spacing-xs) var(--ig-spacing-md);
          color: var(--ig-secondary);
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.2px;
        }

        &__comment-form {
          display: flex;
          align-items: center;
          padding: var(--ig-spacing-sm) var(--ig-spacing-md);
          border-top: 1px solid var(--ig-border);
        }

        &__emoji-btn {
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
          margin-right: var(--ig-spacing-sm);

          .material-icons {
            font-size: 24px;
            color: var(--ig-dark);
          }
        }

        &__comment-input {
          flex: 1;
          border: none;
          background: none;
          font-size: var(--ig-font-sm);
          padding: var(--ig-spacing-xs) 0;

          &:focus {
            outline: none;
          }

          &::placeholder {
            color: var(--ig-secondary);
          }
        }

        &__comment-submit {
          background: none;
          border: none;
          color: var(--ig-primary);
          font-weight: 600;
          font-size: var(--ig-font-sm);
          cursor: pointer;

          &:disabled {
            opacity: 0.3;
            cursor: not-allowed;
          }
        }
      }
    `,
  ],
})
export class PostCardComponent {
  @Input({ required: true }) post!: FeedItem;
  @Output() onLike = new EventEmitter<FeedItem>();
  @Output() onComment = new EventEmitter<FeedItem>();
  @Output() onShare = new EventEmitter<FeedItem>();
  @Output() onSave = new EventEmitter<FeedItem>();

  showOptions = false;
  showFullCaption = false;
  newComment = "";
  private saved = signal<boolean>(false);
  private heartAnimation = signal<boolean>(false);

  isSaved(): boolean {
    return this.saved();
  }

  showHeartAnimation(): boolean {
    return this.heartAnimation();
  }

  getUserAvatar(): string {
    return (
      this.post.user?.avatar ||
      `https://i.pravatar.cc/150?u=${this.post.user?.username}`
    );
  }

  handleDoubleTap(): void {
    if (!this.post.isLiked) {
      this.onLike.emit(this.post);
    }
    this.heartAnimation.set(true);
    setTimeout(() => this.heartAnimation.set(false), 800);
  }

  toggleSave(): void {
    this.saved.update((v) => !v);
    this.onSave.emit(this.post);
  }

  focusComment(): void {
    // Focus the comment input
  }

  submitComment(): void {
    if (this.newComment.trim()) {
      this.onComment.emit(this.post);
      this.newComment = "";
    }
  }

  formatLikes(count: number | undefined): string {
    if (!count) return "0 likes";
    if (count === 1) return "1 like";
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M likes`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K likes`;
    return `${count} likes`;
  }

  getTimeAgo(date: Date | string): string {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    const now = new Date();
    const seconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);

    if (seconds < 60) return "Just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;

    return dateObj.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
    });
  }

  onReportPost(): void {
    console.log("Report post");
    this.showOptions = false;
  }

  onUnfollow(): void {
    console.log("Unfollow user");
    this.showOptions = false;
  }

  onGoToPost(): void {
    // Navigate to post detail
    this.showOptions = false;
  }

  onCopyLink(): void {
    navigator.clipboard.writeText(
      `${window.location.origin}/post/${this.post.id}`
    );
    this.showOptions = false;
  }
}
