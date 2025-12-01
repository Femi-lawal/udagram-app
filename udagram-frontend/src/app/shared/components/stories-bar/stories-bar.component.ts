import { Component, signal } from "@angular/core";
import { CommonModule } from "@angular/common";

interface Story {
  id: number;
  username: string;
  avatar: string;
  hasUnseenStory: boolean;
}

@Component({
  selector: "app-stories-bar",
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="stories-bar" data-testid="stories-bar">
      <div class="stories-container">
        <!-- Your Story -->
        <div class="story story--your">
          <div class="story__avatar-wrapper">
            <img
              src="https://ui-avatars.com/api/?name=You&background=random&size=150"
              alt="Your Story"
              class="story__avatar"
            />
            <span class="story__add-icon">+</span>
          </div>
          <span class="story__username">Your Story</span>
        </div>

        <!-- Other Stories -->
        @for (story of stories(); track story.id) {
        <div
          class="story"
          [class.story--unseen]="story.hasUnseenStory"
          (click)="viewStory(story)"
        >
          <div
            class="story__avatar-wrapper"
            [class.story__avatar-wrapper--gradient]="story.hasUnseenStory"
          >
            <img
              [src]="story.avatar"
              [alt]="story.username"
              class="story__avatar"
            />
          </div>
          <span class="story__username">{{ story.username }}</span>
        </div>
        }
      </div>

      <!-- Navigation Arrows -->
      @if (canScrollLeft()) {
      <button class="stories-nav stories-nav--left" (click)="scrollLeft()">
        <span class="material-icons">chevron_left</span>
      </button>
      } @if (canScrollRight()) {
      <button class="stories-nav stories-nav--right" (click)="scrollRight()">
        <span class="material-icons">chevron_right</span>
      </button>
      }
    </div>
  `,
  styles: [
    `
      .stories-bar {
        position: relative;
        background: var(--ig-white);
        border: 1px solid var(--ig-border);
        border-radius: var(--ig-radius-sm);
        padding: var(--ig-spacing-md);
        overflow: hidden;
      }

      .stories-container {
        display: flex;
        gap: var(--ig-spacing-md);
        overflow-x: auto;
        scrollbar-width: none;
        -ms-overflow-style: none;
        scroll-behavior: smooth;

        &::-webkit-scrollbar {
          display: none;
        }
      }

      .story {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--ig-spacing-xs);
        cursor: pointer;
        flex-shrink: 0;

        &__avatar-wrapper {
          position: relative;
          width: 66px;
          height: 66px;
          border-radius: 50%;
          padding: 3px;
          background: var(--ig-border);

          &--gradient {
            background: linear-gradient(
              45deg,
              var(--ig-gradient-start),
              var(--ig-gradient-middle),
              var(--ig-gradient-end)
            );
          }
        }

        &__avatar {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          object-fit: cover;
          border: 3px solid var(--ig-white);
        }

        &__add-icon {
          position: absolute;
          bottom: 0;
          right: 0;
          width: 20px;
          height: 20px;
          background: var(--ig-primary);
          color: white;
          border-radius: 50%;
          border: 2px solid var(--ig-white);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          font-weight: 600;
        }

        &__username {
          font-size: 12px;
          color: var(--ig-dark);
          max-width: 70px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          text-align: center;
        }

        &--your &__username {
          color: var(--ig-secondary);
        }
      }

      .stories-nav {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        width: 26px;
        height: 26px;
        background: var(--ig-white);
        border: none;
        border-radius: 50%;
        box-shadow: var(--ig-shadow-lg);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10;

        &--left {
          left: 8px;
        }

        &--right {
          right: 8px;
        }

        .material-icons {
          font-size: 20px;
          color: var(--ig-dark);
        }

        @media (max-width: 614px) {
          display: none;
        }
      }
    `,
  ],
})
export class StoriesBarComponent {
  stories = signal<Story[]>([
    {
      id: 1,
      username: "nature_lover",
      avatar:
        "https://ui-avatars.com/api/?name=NL&background=0D8ABC&color=fff&size=150",
      hasUnseenStory: true,
    },
    {
      id: 2,
      username: "travel_pics",
      avatar:
        "https://ui-avatars.com/api/?name=TP&background=2ECC71&color=fff&size=150",
      hasUnseenStory: true,
    },
    {
      id: 3,
      username: "food_diary",
      avatar:
        "https://ui-avatars.com/api/?name=FD&background=E74C3C&color=fff&size=150",
      hasUnseenStory: true,
    },
    {
      id: 4,
      username: "art_gallery",
      avatar:
        "https://ui-avatars.com/api/?name=AG&background=9B59B6&color=fff&size=150",
      hasUnseenStory: false,
    },
    {
      id: 5,
      username: "music_vibes",
      avatar:
        "https://ui-avatars.com/api/?name=MV&background=F39C12&color=fff&size=150",
      hasUnseenStory: true,
    },
    {
      id: 6,
      username: "tech_news",
      avatar:
        "https://ui-avatars.com/api/?name=TN&background=1ABC9C&color=fff&size=150",
      hasUnseenStory: false,
    },
    {
      id: 7,
      username: "fitness_guru",
      avatar:
        "https://ui-avatars.com/api/?name=FG&background=E91E63&color=fff&size=150",
      hasUnseenStory: true,
    },
    {
      id: 8,
      username: "pets_corner",
      avatar:
        "https://ui-avatars.com/api/?name=PC&background=673AB7&color=fff&size=150",
      hasUnseenStory: true,
    },
  ]);

  private scrollPosition = signal<number>(0);

  canScrollLeft(): boolean {
    return this.scrollPosition() > 0;
  }

  canScrollRight(): boolean {
    return true; // Simplified for now
  }

  scrollLeft(): void {
    const container = document.querySelector(".stories-container");
    if (container) {
      container.scrollBy({ left: -200, behavior: "smooth" });
      this.scrollPosition.update((v) => Math.max(0, v - 200));
    }
  }

  scrollRight(): void {
    const container = document.querySelector(".stories-container");
    if (container) {
      container.scrollBy({ left: 200, behavior: "smooth" });
      this.scrollPosition.update((v) => v + 200);
    }
  }

  viewStory(story: Story): void {
    console.log("View story:", story.username);
    // Mark story as seen
    this.stories.update((stories) =>
      stories.map((s) =>
        s.id === story.id ? { ...s, hasUnseenStory: false } : s
      )
    );
  }
}
