import { Injectable, signal } from "@angular/core";
import { FeedItem, Comment } from "./feed.service";

// DemoUser has all required fields unlike the base User interface
export interface DemoUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatar: string;
  bio: string;
  website: string;
  postsCount: number;
  followersCount: number;
  followingCount: number;
  isVerified: boolean;
  joinedDate: Date;
}

export interface Story {
  id: string;
  userId: string;
  username: string;
  avatar: string;
  imageUrl: string;
  timestamp: Date;
  isViewed: boolean;
  isMine: boolean;
}

export interface Notification {
  id: string;
  type: "like" | "comment" | "follow" | "mention" | "tag";
  user: { id: string; username: string; avatar: string };
  message: string;
  postId?: string;
  postImage?: string;
  timestamp: Date;
  isRead: boolean;
}

@Injectable({
  providedIn: "root",
})
export class DemoService {
  private readonly DEMO_USER_KEY = "udagram_demo_mode";

  isDemoMode = signal<boolean>(false);

  // Demo user with extensive profile
  readonly demoUser: DemoUser = {
    id: "demo-user-001",
    email: "demo@udagram.app",
    username: "udagram_explorer",
    displayName: "Udagram Explorer",
    avatar: "https://i.pravatar.cc/300?u=demo-explorer",
    bio: "📸 Photography enthusiast | 🌍 World traveler\n✨ Capturing life's beautiful moments\n🎨 Creative soul | 💡 Tech lover\n📍 San Francisco, CA",
    website: "https://udagram.app",
    postsCount: 47,
    followersCount: 12847,
    followingCount: 892,
    isVerified: true,
    joinedDate: new Date("2023-01-15"),
  };

  // Featured users for suggestions and stories
  readonly featuredUsers: DemoUser[] = [
    {
      id: "user-001",
      email: "sarah@example.com",
      username: "sarah_captures",
      displayName: "Sarah Chen",
      avatar: "https://i.pravatar.cc/150?u=sarah",
      bio: "📷 Professional Photographer\n🌸 Nature & Portrait specialist",
      website: "https://sarahchen.photo",
      postsCount: 234,
      followersCount: 45200,
      followingCount: 512,
      isVerified: true,
      joinedDate: new Date("2022-03-10"),
    },
    {
      id: "user-002",
      email: "marcus@example.com",
      username: "marcus_adventures",
      displayName: "Marcus Johnson",
      avatar: "https://i.pravatar.cc/150?u=marcus",
      bio: "🏔️ Adventure seeker | 🎒 Backpacker\n✈️ 50+ countries visited",
      website: "https://marcusadventures.com",
      postsCount: 189,
      followersCount: 28900,
      followingCount: 423,
      isVerified: true,
      joinedDate: new Date("2022-06-20"),
    },
    {
      id: "user-003",
      email: "emma@example.com",
      username: "emma_foodie",
      displayName: "Emma Williams",
      avatar: "https://i.pravatar.cc/150?u=emma",
      bio: "🍕 Food blogger | 👩‍🍳 Home chef\n📍 NYC | 🍷 Wine enthusiast",
      website: "https://emmafoodie.blog",
      postsCount: 312,
      followersCount: 67800,
      followingCount: 234,
      isVerified: true,
      joinedDate: new Date("2021-11-05"),
    },
    {
      id: "user-004",
      email: "alex@example.com",
      username: "alex_designs",
      displayName: "Alex Rivera",
      avatar: "https://i.pravatar.cc/150?u=alex",
      bio: "🎨 UI/UX Designer | 💻 Creative coder\n🖌️ Digital art lover",
      website: "https://alexrivera.design",
      postsCount: 156,
      followersCount: 19500,
      followingCount: 345,
      isVerified: false,
      joinedDate: new Date("2023-02-14"),
    },
    {
      id: "user-005",
      email: "lisa@example.com",
      username: "lisa_fitness",
      displayName: "Lisa Martinez",
      avatar: "https://i.pravatar.cc/150?u=lisa",
      bio: "💪 Fitness coach | 🧘 Yoga instructor\n🥗 Healthy lifestyle advocate",
      website: "https://lisafitness.co",
      postsCount: 278,
      followersCount: 89400,
      followingCount: 156,
      isVerified: true,
      joinedDate: new Date("2022-01-08"),
    },
    {
      id: "user-006",
      email: "david@example.com",
      username: "david_tech",
      displayName: "David Kim",
      avatar: "https://i.pravatar.cc/150?u=david",
      bio: "🚀 Tech entrepreneur | 💡 Innovator\n📱 Building the future",
      website: "https://davidkim.tech",
      postsCount: 89,
      followersCount: 34200,
      followingCount: 567,
      isVerified: true,
      joinedDate: new Date("2022-09-22"),
    },
  ];

  // Generate comprehensive demo feed
  getDemoFeed(page: number = 1): FeedItem[] {
    const categories = [
      {
        theme: "nature",
        captions: [
          "Golden hour magic ✨ Nothing beats watching the sunset paint the sky 🌅",
          "Lost in the beauty of nature 🌿 Sometimes you need to disconnect to reconnect",
          "Mountain therapy is the best therapy 🏔️ #hiking #adventure",
          "Chasing waterfalls and dreams 💧 Nature's masterpiece",
          "Forest bathing 🌲 Finding peace among the trees",
        ],
      },
      {
        theme: "urban",
        captions: [
          "City lights and late nights 🌃 Urban exploration never gets old",
          "Architecture that tells a story 🏛️ Every building has secrets",
          "Street photography is my love language 📸 #streetphotography",
          "The beauty of urban decay 🏚️ Finding art in unexpected places",
          "Rooftop views hit different 🌆 Above the noise",
        ],
      },
      {
        theme: "food",
        captions: [
          "Food is art on a plate 🍽️ Too pretty to eat... almost!",
          "Brunch goals achieved ☕🥐 Weekend vibes only",
          "Homemade with love 👨‍🍳 Best meals are shared meals",
          "Street food adventures 🌮 Exploring flavors around the world",
          "Coffee first, everything else later ☕ Morning essentials",
        ],
      },
      {
        theme: "travel",
        captions: [
          "Wanderlust is real ✈️ Collecting memories, not things",
          "New destination unlocked 📍 Adventure awaits!",
          "Local experiences > tourist traps 🗺️ Living like a local",
          "Passport stamps and tan lines 🌴 Summer never ends",
          "The world is a book 📖 Those who don't travel read only one page",
        ],
      },
      {
        theme: "lifestyle",
        captions: [
          "Self-care Sunday 🧖‍♀️ Taking time to recharge",
          "Morning routines that matter ☀️ Start strong, finish stronger",
          "Minimal living, maximum happiness 🏡 Less is more",
          "Work hard, play harder 💼🎉 Balance is key",
          "Grateful for the little things 🙏 Finding joy everyday",
        ],
      },
    ];

    const items: FeedItem[] = [];
    const startIndex = (page - 1) * 10;

    for (let i = 0; i < 10; i++) {
      const index = startIndex + i;
      const category = categories[index % categories.length];
      const caption = category.captions[index % category.captions.length];
      const user = this.featuredUsers[index % this.featuredUsers.length];
      const hoursAgo = Math.floor(Math.random() * 72) + 1;

      items.push({
        id: `demo-post-${page}-${i}`,
        caption: caption,
        url: `https://picsum.photos/seed/${category.theme}${index}/800/800`,
        createdAt: new Date(Date.now() - hoursAgo * 3600000),
        updatedAt: new Date(Date.now() - hoursAgo * 3600000),
        user: {
          id: user.id,
          username: user.username,
          avatar: user.avatar,
        },
        likes: Math.floor(Math.random() * 5000) + 100,
        isLiked: Math.random() > 0.6,
        comments: this.generateComments(3 + Math.floor(Math.random() * 5)),
        hasMultiple: Math.random() > 0.7,
        isVideo: Math.random() > 0.9,
      });
    }

    return items;
  }

  // Generate demo stories
  getDemoStories(): Story[] {
    const stories: Story[] = [
      {
        id: "story-mine",
        userId: this.demoUser.id,
        username: "Your story",
        avatar: this.demoUser.avatar,
        imageUrl: "https://picsum.photos/seed/mystory/400/700",
        timestamp: new Date(),
        isViewed: false,
        isMine: true,
      },
    ];

    this.featuredUsers.forEach((user, i) => {
      stories.push({
        id: `story-${user.id}`,
        userId: user.id,
        username: user.username,
        avatar: user.avatar,
        imageUrl: `https://picsum.photos/seed/story${i}/400/700`,
        timestamp: new Date(Date.now() - Math.random() * 86400000),
        isViewed: Math.random() > 0.5,
        isMine: false,
      });
    });

    return stories;
  }

  // Generate demo notifications
  getDemoNotifications(): Notification[] {
    const notifications: Notification[] = [];
    const types: Notification["type"][] = [
      "like",
      "comment",
      "follow",
      "mention",
      "tag",
    ];

    for (let i = 0; i < 20; i++) {
      const type = types[i % types.length];
      const user = this.featuredUsers[i % this.featuredUsers.length];
      const hoursAgo = Math.floor(Math.random() * 48) + 1;

      let message = "";
      switch (type) {
        case "like":
          message = "liked your photo.";
          break;
        case "comment":
          message = `commented: "${this.getRandomComment()}"`;
          break;
        case "follow":
          message = "started following you.";
          break;
        case "mention":
          message = "mentioned you in a comment.";
          break;
        case "tag":
          message = "tagged you in a photo.";
          break;
      }

      notifications.push({
        id: `notif-${i}`,
        type,
        user: {
          id: user.id,
          username: user.username,
          avatar: user.avatar,
        },
        message,
        postId: type !== "follow" ? `post-${i}` : undefined,
        postImage:
          type !== "follow"
            ? `https://picsum.photos/seed/notif${i}/100/100`
            : undefined,
        timestamp: new Date(Date.now() - hoursAgo * 3600000),
        isRead: i > 5,
      });
    }

    return notifications;
  }

  // Get demo user's posts for profile
  getDemoUserPosts(): FeedItem[] {
    const posts: FeedItem[] = [];
    const themes = [
      "sunset",
      "cityscape",
      "portrait",
      "landscape",
      "food",
      "travel",
      "architecture",
      "nature",
      "street",
    ];

    for (let i = 0; i < 12; i++) {
      const theme = themes[i % themes.length];
      posts.push({
        id: `my-post-${i}`,
        caption: `Beautiful moment captured 📸 #${theme} #photography #udagram`,
        url: `https://picsum.photos/seed/mypost${i}/600/600`,
        createdAt: new Date(Date.now() - i * 86400000 * 3),
        updatedAt: new Date(Date.now() - i * 86400000 * 3),
        user: {
          id: this.demoUser.id,
          username: this.demoUser.username,
          avatar: this.demoUser.avatar,
        },
        likes: Math.floor(Math.random() * 2000) + 500,
        isLiked: false,
        comments: this.generateComments(5 + Math.floor(Math.random() * 10)),
      });
    }

    return posts;
  }

  // Explore page content
  getDemoExploreContent(): FeedItem[] {
    const items: FeedItem[] = [];
    const categories = [
      "trending",
      "nature",
      "food",
      "travel",
      "fashion",
      "art",
      "fitness",
      "tech",
    ];

    for (let i = 0; i < 30; i++) {
      const category = categories[i % categories.length];
      const user = this.featuredUsers[i % this.featuredUsers.length];

      items.push({
        id: `explore-${i}`,
        caption: `#${category} content that inspires ✨`,
        url: `https://picsum.photos/seed/explore${category}${i}/600/600`,
        createdAt: new Date(Date.now() - Math.random() * 604800000),
        updatedAt: new Date(),
        user: {
          id: user.id,
          username: user.username,
          avatar: user.avatar,
        },
        likes: Math.floor(Math.random() * 10000) + 1000,
        isLiked: Math.random() > 0.7,
        comments: this.generateComments(Math.floor(Math.random() * 20)),
      });
    }

    return items;
  }

  private generateComments(count: number): Comment[] {
    const comments: Comment[] = [];
    const commentTexts = [
      "This is absolutely stunning! 😍",
      "Love this so much! 💕",
      "Goals! 🙌",
      "Where is this? Need to visit!",
      "Incredible shot! 📸",
      "This made my day! ☀️",
      "Wow, just wow! ✨",
      "So beautiful! 🌟",
      "Perfect capture! 👏",
      "I'm obsessed! 😭💖",
      "This is everything! 🔥",
      "Absolutely breathtaking! 🌈",
      "Need this in my life!",
      "Can't stop looking at this! 👀",
      "Pure magic! ✨",
    ];

    for (let i = 0; i < count; i++) {
      const user = this.featuredUsers[i % this.featuredUsers.length];
      comments.push({
        id: `comment-${Date.now()}-${i}`,
        text: commentTexts[Math.floor(Math.random() * commentTexts.length)],
        user: {
          id: user.id,
          username: user.username,
          avatar: user.avatar,
        },
        createdAt: new Date(Date.now() - Math.random() * 86400000),
        likes: Math.floor(Math.random() * 50),
        isLiked: Math.random() > 0.8,
      });
    }

    return comments;
  }

  private getRandomComment(): string {
    const comments = [
      "Amazing! 🔥",
      "Love this!",
      "So good! 👏",
      "Incredible work!",
      "This is beautiful!",
    ];
    return comments[Math.floor(Math.random() * comments.length)];
  }

  // Enable demo mode
  enableDemoMode(): void {
    this.isDemoMode.set(true);
    localStorage.setItem(this.DEMO_USER_KEY, "true");
  }

  // Disable demo mode
  disableDemoMode(): void {
    this.isDemoMode.set(false);
    localStorage.removeItem(this.DEMO_USER_KEY);
  }

  // Check if demo mode is active
  checkDemoMode(): boolean {
    const isDemo = localStorage.getItem(this.DEMO_USER_KEY) === "true";
    this.isDemoMode.set(isDemo);
    return isDemo;
  }
}
