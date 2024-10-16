import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

interface Notification {
  id: string;
  type: 'like' | 'comment' | 'follow' | 'mention' | 'welcome';
  message: string;
  avatar?: string;
  username?: string;
  postId?: string;
  postThumbnail?: string;
  createdAt: Date;
  read: boolean;
}

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="notifications-page">
      <div class="notifications-container">
        <header class="notifications-header">
          <h1>Notifications</h1>
        </header>

        @if (loading()) {
          <div class="notifications-loading">
            <div class="spinner"></div>
            <p>Loading notifications...</p>
          </div>
        } @else if (notifications().length === 0) {
          <div class="notifications-empty">
            <span class="material-icons">notifications_none</span>
            <h2>No Notifications Yet</h2>
            <p>When someone likes, comments, or follows you, you'll see it here.</p>
          </div>
        } @else {
          <div class="notifications-list">
            @for (notification of notifications(); track notification.id) {
              <div class="notification-item" [class.unread]="!notification.read">
                <img 
                  [src]="notification.avatar || 'https://i.pravatar.cc/150?u=default'" 
                  class="avatar" 
                  alt=""
                />
                <div class="notification-content">
                  <p class="notification-message">
                    @if (notification.username) {
                      <strong>{{ notification.username }}</strong>
                    }
                    {{ notification.message }}
                  </p>
                  <span class="notification-time">{{ formatTime(notification.createdAt) }}</span>
                </div>
                @if (notification.postThumbnail) {
                  <img 
                    [src]="notification.postThumbnail" 
                    class="notification-thumbnail" 
                    alt=""
                    [routerLink]="['/post', notification.postId]"
                  />
                }
                @if (notification.type === 'follow') {
                  <button class="btn btn--primary btn--sm">Follow Back</button>
                }
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .notifications-page {
      min-height: 100vh;
      background-color: var(--ig-light);
      padding: var(--ig-spacing-lg) var(--ig-spacing-md);
    }

    .notifications-container {
      max-width: 600px;
      margin: 0 auto;
      background: var(--ig-white);
      border: 1px solid var(--ig-border);
      border-radius: var(--ig-radius-sm);
    }

    .notifications-header {
      padding: var(--ig-spacing-md);
      border-bottom: 1px solid var(--ig-border);

      h1 {
        font-size: var(--ig-font-lg);
        font-weight: 600;
        margin: 0;
      }
    }

    .notifications-loading,
    .notifications-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px;
      text-align: center;

      .material-icons {
        font-size: 64px;
        color: var(--ig-secondary);
        margin-bottom: var(--ig-spacing-md);
      }

      h2 {
        margin-bottom: var(--ig-spacing-sm);
        font-size: var(--ig-font-lg);
      }

      p {
        color: var(--ig-secondary);
      }
    }

    .notifications-list {
      display: flex;
      flex-direction: column;
    }

    .notification-item {
      display: flex;
      align-items: center;
      gap: var(--ig-spacing-sm);
      padding: var(--ig-spacing-md);
      border-bottom: 1px solid var(--ig-border);
      transition: background-color 0.2s;

      &:hover {
        background-color: var(--ig-light);
      }

      &.unread {
        background-color: rgba(0, 149, 246, 0.05);
      }

      &:last-child {
        border-bottom: none;
      }
    }

    .notification-content {
      flex: 1;
      min-width: 0;
    }

    .notification-message {
      margin: 0;
      font-size: var(--ig-font-sm);
      line-height: 1.4;

      strong {
        font-weight: 600;
      }
    }

    .notification-time {
      font-size: var(--ig-font-xs);
      color: var(--ig-secondary);
    }

    .notification-thumbnail {
      width: 44px;
      height: 44px;
      object-fit: cover;
      border-radius: var(--ig-radius-xs);
      cursor: pointer;
    }

    .avatar {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      object-fit: cover;
    }

    .btn--sm {
      padding: var(--ig-spacing-xs) var(--ig-spacing-sm);
      font-size: var(--ig-font-xs);
    }
  `]
})
export class NotificationsComponent implements OnInit {
  private http = inject(HttpClient);
  
  notifications = signal<Notification[]>([]);
  loading = signal<boolean>(true);

  ngOnInit(): void {
    this.loadNotifications();
  }

  loadNotifications(): void {
    this.loading.set(true);
    
    // Try to fetch from API, fallback to mock data
    this.http.get<any>(`${environment.apiUrl}/notifications`).subscribe({
      next: (response) => {
        this.notifications.set(response.data || []);
        this.loading.set(false);
      },
      error: () => {
        // Use mock data for demo/development
        this.notifications.set(this.getMockNotifications());
        this.loading.set(false);
      }
    });
  }

  formatTime(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return new Date(date).toLocaleDateString();
  }

  getMockNotifications(): Notification[] {
    return [
      {
        id: '1',
        type: 'welcome',
        message: 'Welcome to Udagram! Start sharing your moments.',
        createdAt: new Date(Date.now() - 3600000),
        read: false
      },
      {
        id: '2',
        type: 'like',
        message: 'liked your photo.',
        username: 'nature_lover',
        avatar: 'https://i.pravatar.cc/150?u=nature',
        postId: '1',
        postThumbnail: 'https://picsum.photos/100/100?random=1',
        createdAt: new Date(Date.now() - 7200000),
        read: true
      },
      {
        id: '3',
        type: 'follow',
        message: 'started following you.',
        username: 'travel_pics',
        avatar: 'https://i.pravatar.cc/150?u=travel',
        createdAt: new Date(Date.now() - 86400000),
        read: true
      },
      {
        id: '4',
        type: 'comment',
        message: 'commented: "Amazing shot! 📸"',
        username: 'food_diary',
        avatar: 'https://i.pravatar.cc/150?u=food',
        postId: '2',
        postThumbnail: 'https://picsum.photos/100/100?random=2',
        createdAt: new Date(Date.now() - 172800000),
        read: true
      }
    ];
  }
}
