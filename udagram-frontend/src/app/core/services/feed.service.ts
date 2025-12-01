import { Injectable, signal, computed, inject } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable, tap, catchError, throwError, of, map } from "rxjs";
import { environment } from "../../../environments/environment";
import { DemoService } from "./demo.service";

export interface User {
  id: string;
  username: string;
  avatar?: string;
}

export interface Comment {
  id: string;
  text: string;
  user?: User;
  createdAt: Date;
  likes?: number;
  isLiked?: boolean;
}

export interface FeedItem {
  id: string;
  caption: string;
  url: string;
  createdAt: Date;
  updatedAt: Date;
  user?: User;
  likes: number;
  isLiked: boolean;
  comments?: Comment[];
  hasMultiple?: boolean;
  isVideo?: boolean;
}

export interface FeedResponse {
  items: FeedItem[];
  page: number;
  totalPages: number;
  total: number;
}

@Injectable({
  providedIn: "root",
})
export class FeedService {
  private feedItems = signal<FeedItem[]>([]);
  private loading = signal<boolean>(false);
  private demoService = inject(DemoService);

  readonly items = computed(() => this.feedItems());
  readonly isLoading = computed(() => this.loading());

  constructor(private http: HttpClient) {}

  getFeed(page: number = 1, limit: number = 10): Observable<FeedResponse> {
    this.loading.set(true);

    // Use demo data if in demo mode
    if (this.demoService.isDemoMode()) {
      const demoItems = this.demoService.getDemoFeed(page);
      const response: FeedResponse = {
        items: demoItems,
        page,
        totalPages: 10,
        total: 100,
      };

      if (page === 1) {
        this.feedItems.set(response.items);
      } else {
        this.feedItems.update((current) => [...current, ...response.items]);
      }
      this.loading.set(false);
      return of(response);
    }

    const params = new HttpParams()
      .set("page", page.toString())
      .set("limit", limit.toString());

    return this.http.get<any>(`${environment.apiUrl}/feed`, { params }).pipe(
      map((response) => this.transformFeedResponse(response, page)),
      tap((response) => {
        if (page === 1) {
          this.feedItems.set(response.items);
        } else {
          this.feedItems.update((current) => [...current, ...response.items]);
        }
        this.loading.set(false);
      }),
      catchError((error) => {
        this.loading.set(false);
        // Return demo/mock data on error
        const demoItems = this.demoService.getDemoFeed(page);
        const response: FeedResponse = {
          items: demoItems,
          page,
          totalPages: 10,
          total: 100,
        };
        if (page === 1) {
          this.feedItems.set(response.items);
        } else {
          this.feedItems.update((current) => [...current, ...response.items]);
        }
        return of(response);
      })
    );
  }

  getPost(id: string): Observable<FeedItem> {
    return this.http.get<any>(`${environment.apiUrl}/feed/${id}`).pipe(
      map((item) => this.transformFeedItem(item)),
      catchError((error) => {
        // Return mock data for development
        return of(this.getMockPost(id));
      })
    );
  }

  createPost(file: File, caption: string): Observable<FeedItem> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("caption", caption);

    return this.http.post<any>(`${environment.apiUrl}/feed`, formData).pipe(
      map((item) => this.transformFeedItem(item)),
      tap((newItem) => {
        this.feedItems.update((items) => [newItem, ...items]);
      }),
      catchError((error) => {
        // Mock successful upload for development
        const mockItem: FeedItem = {
          id: `new-${Date.now()}`,
          caption,
          url: URL.createObjectURL(file),
          createdAt: new Date(),
          updatedAt: new Date(),
          user: { id: "me", username: "you" },
          likes: 0,
          isLiked: false,
          comments: [],
        };
        this.feedItems.update((items) => [mockItem, ...items]);
        return of(mockItem);
      })
    );
  }

  likePost(postId: string): Observable<{ success: boolean }> {
    return this.http
      .post<{ success: boolean }>(
        `${environment.apiUrl}/feed/${postId}/like`,
        {}
      )
      .pipe(
        tap(() => {
          this.feedItems.update((items) =>
            items.map((item) =>
              item.id === postId
                ? { ...item, isLiked: true, likes: item.likes + 1 }
                : item
            )
          );
        }),
        catchError(() => of({ success: true }))
      );
  }

  unlikePost(postId: string): Observable<{ success: boolean }> {
    return this.http
      .delete<{ success: boolean }>(`${environment.apiUrl}/feed/${postId}/like`)
      .pipe(
        tap(() => {
          this.feedItems.update((items) =>
            items.map((item) =>
              item.id === postId
                ? {
                    ...item,
                    isLiked: false,
                    likes: Math.max(0, item.likes - 1),
                  }
                : item
            )
          );
        }),
        catchError(() => of({ success: true }))
      );
  }

  addComment(postId: string, text: string): Observable<Comment> {
    return this.http
      .post<Comment>(`${environment.apiUrl}/feed/${postId}/comments`, { text })
      .pipe(
        tap((comment) => {
          this.feedItems.update((items) =>
            items.map((item) =>
              item.id === postId
                ? { ...item, comments: [...(item.comments || []), comment] }
                : item
            )
          );
        }),
        catchError(() => {
          const mockComment: Comment = {
            id: `c-${Date.now()}`,
            text,
            user: { id: "me", username: "you" },
            createdAt: new Date(),
            likes: 0,
            isLiked: false,
          };
          return of(mockComment);
        })
      );
  }

  deletePost(postId: string): Observable<{ success: boolean }> {
    return this.http
      .delete<{ success: boolean }>(`${environment.apiUrl}/feed/${postId}`)
      .pipe(
        tap(() => {
          this.feedItems.update((items) =>
            items.filter((item) => item.id !== postId)
          );
        }),
        catchError(() => of({ success: true }))
      );
  }

  private transformFeedResponse(response: any, page: number): FeedResponse {
    const items = (response.rows || response.items || []).map((item: any) =>
      this.transformFeedItem(item)
    );

    return {
      items,
      page,
      totalPages: Math.ceil(
        (response.count || response.total || items.length) / 10
      ),
      total: response.count || response.total || items.length,
    };
  }

  private transformFeedItem(item: any): FeedItem {
    return {
      id: String(item.id),
      caption: item.caption || "",
      url: item.url || "",
      createdAt: new Date(item.createdAt || item.created_at || Date.now()),
      updatedAt: new Date(item.updatedAt || item.updated_at || Date.now()),
      user: {
        id: String(item.userId || item.user_id || item.user?.id || "1"),
        username: item.username || item.user?.username || "anonymous",
        avatar: item.userAvatar || item.user?.avatar,
      },
      likes: item.likesCount || item.likes_count || item.likes || 0,
      isLiked: item.isLiked || item.is_liked || false,
      comments: (item.comments || []).map((c: any) => ({
        id: String(c.id),
        text: c.text || c.content,
        user: {
          id: String(c.userId || c.user_id || c.user?.id || "1"),
          username: c.username || c.user?.username || "anonymous",
        },
        createdAt: new Date(c.createdAt || c.created_at || Date.now()),
        likes: c.likes || 0,
        isLiked: c.isLiked || false,
      })),
    };
  }

  private getMockFeed(page: number): FeedResponse {
    const mockItems: FeedItem[] = Array.from({ length: 10 }, (_, i) => ({
      id: `${(page - 1) * 10 + i + 1}`,
      caption: `Amazing photo ${
        (page - 1) * 10 + i + 1
      }! 📸 #photography #nature #travel`,
      url: `https://picsum.photos/seed/feed${(page - 1) * 10 + i}/600/600`,
      createdAt: new Date(Date.now() - Math.random() * 86400000 * 7),
      updatedAt: new Date(),
      user: {
        id: `user-${i}`,
        username: `photographer${i}`,
        avatar: `https://i.pravatar.cc/150?u=photographer${i}`,
      },
      likes: Math.floor(Math.random() * 1000),
      isLiked: Math.random() > 0.5,
      comments: Array.from(
        { length: Math.floor(Math.random() * 5) },
        (_, j) => ({
          id: `c-${i}-${j}`,
          text: [
            "Great shot!",
            "Love this!",
            "Beautiful 😍",
            "Where is this?",
            "Amazing!",
          ][j],
          user: { id: `commenter-${j}`, username: `user${j}` },
          createdAt: new Date(Date.now() - Math.random() * 3600000),
          likes: Math.floor(Math.random() * 20),
          isLiked: false,
        })
      ),
    }));

    return {
      items: mockItems,
      page,
      totalPages: 5,
      total: 50,
    };
  }

  private getMockPost(id: string): FeedItem {
    return {
      id,
      caption:
        "Beautiful sunset view from the mountains. Nature never fails to amaze me! 🌅 #photography #nature #sunset",
      url: `https://picsum.photos/seed/${id}/800/800`,
      createdAt: new Date(Date.now() - 3600000),
      updatedAt: new Date(),
      user: {
        id: "1",
        username: "photographer",
        avatar: "https://i.pravatar.cc/150?u=photographer",
      },
      likes: 1234,
      isLiked: false,
      comments: [
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
      ],
    };
  }
}
