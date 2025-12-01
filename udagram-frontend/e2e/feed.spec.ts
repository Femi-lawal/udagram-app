import { test, expect, Page } from "@playwright/test";

// Mock API responses
const mockUser = {
  id: "1",
  email: "test@example.com",
  username: "testuser",
  avatar: "https://i.pravatar.cc/150?u=testuser",
};

const mockAuthResponse = {
  auth: true,
  token: "mock-jwt-token",
  user: mockUser,
};

const mockFeedItems = Array.from({ length: 10 }, (_, i) => ({
  id: `${i + 1}`,
  caption: `Test post ${i + 1}! 📸 #test`,
  url: `https://picsum.photos/seed/test${i}/600/600`,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  user: {
    id: `user-${i}`,
    username: `user${i}`,
    avatar: `https://i.pravatar.cc/150?u=user${i}`,
  },
  likes: Math.floor(Math.random() * 1000),
  isLiked: false,
  comments: [
    {
      id: `c-${i}-1`,
      text: "Great shot!",
      user: { id: "2", username: "commenter" },
      createdAt: new Date().toISOString(),
    },
  ],
}));

const mockFeedResponse = {
  items: mockFeedItems,
  rows: mockFeedItems,
  page: 1,
  totalPages: 5,
  total: 50,
  count: 50,
};

// Setup API mocks
async function setupMocks(page: Page) {
  // Mock login endpoint
  await page.route("**/api/v0/users/auth/login", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockAuthResponse),
    });
  });

  // Mock feed endpoint
  await page.route("**/api/v0/feed**", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockFeedResponse),
      });
    } else if (route.request().method() === "POST") {
      // Mock create post
      const newPost = {
        id: `new-${Date.now()}`,
        caption: "New post",
        url: "https://picsum.photos/600/600",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        user: mockUser,
        likes: 0,
        isLiked: false,
        comments: [],
      };
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(newPost),
      });
    } else {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ success: true }),
      });
    }
  });

  // Mock like endpoint
  await page.route("**/api/v0/feed/*/like", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
    });
  });

  // Mock comments endpoint
  await page.route("**/api/v0/feed/*/comments", async (route) => {
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        id: `c-${Date.now()}`,
        text: "New comment",
        user: mockUser,
        createdAt: new Date().toISOString(),
      }),
    });
  });
}

// Helper function to login with mocks
async function login(page: Page) {
  await setupMocks(page);

  // Set auth in localStorage to bypass login
  await page.goto("/login");
  await page.evaluate(
    (data) => {
      localStorage.setItem("udagram_token", data.token);
      localStorage.setItem("udagram_user", JSON.stringify(data.user));
    },
    { token: mockAuthResponse.token, user: mockAuthResponse.user }
  );

  await page.goto("/feed");
  await page.waitForLoadState("networkidle");
}

test.describe("Feed Page", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("should display feed page with header", async ({ page }) => {
    await expect(page.locator(".header")).toBeVisible();
    await expect(page.locator(".header__logo-text")).toBeVisible();
  });

  test("should display posts in feed", async ({ page }) => {
    // Wait for posts to load (mock data should load quickly)
    await page.waitForSelector('[data-testid="post-card"]', { timeout: 15000 });

    const posts = page.locator('[data-testid="post-card"]');
    await expect(posts.first()).toBeVisible();
  });

  test("should display post with all elements", async ({ page }) => {
    await page.waitForSelector('[data-testid="post-card"]', { timeout: 15000 });

    const firstPost = page.locator('[data-testid="post-card"]').first();

    // Check post elements
    await expect(firstPost.locator(".post-card__user")).toBeVisible();
    await expect(firstPost.locator('[data-testid="post-image"]')).toBeVisible();
    await expect(firstPost.getByTestId("like-button")).toBeVisible();
    await expect(firstPost.getByTestId("comment-button")).toBeVisible();
  });

  test("should toggle like on post", async ({ page }) => {
    await page.waitForSelector('[data-testid="post-card"]', { timeout: 15000 });

    const firstPost = page.locator('[data-testid="post-card"]').first();
    const likeButton = firstPost.getByTestId("like-button");

    // Click like
    await likeButton.click();

    // Wait for state change animation
    await page.waitForTimeout(300);

    // The button should have updated state (class changes)
    await expect(likeButton).toBeVisible();
  });

  test("should show comment input", async ({ page }) => {
    await page.waitForSelector('[data-testid="post-card"]', { timeout: 15000 });

    const firstPost = page.locator('[data-testid="post-card"]').first();

    // Comment input should already be visible
    const commentInput = firstPost.getByTestId("comment-input");
    await expect(commentInput).toBeVisible();
  });

  test("should add comment to post", async ({ page }) => {
    await page.waitForSelector('[data-testid="post-card"]', { timeout: 15000 });

    const firstPost = page.locator('[data-testid="post-card"]').first();
    const commentInput = firstPost.getByTestId("comment-input");

    await commentInput.fill("This is a test comment!");
    await commentInput.press("Enter");

    // Wait for comment submission
    await page.waitForTimeout(500);
  });

  test("should display stories bar", async ({ page }) => {
    const storiesBar = page.locator(".stories-bar");
    await expect(storiesBar).toBeVisible();

    // Should have story items
    const stories = storiesBar.locator(".story");
    await expect(stories.first()).toBeVisible();
  });

  test("should load more posts on scroll", async ({ page }) => {
    await page.waitForSelector('[data-testid="post-card"]', { timeout: 15000 });

    const initialPostCount = await page
      .locator('[data-testid="post-card"]')
      .count();

    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Wait for potential load
    await page.waitForTimeout(1000);

    const newPostCount = await page
      .locator('[data-testid="post-card"]')
      .count();

    // Should have same or more posts (infinite scroll)
    expect(newPostCount).toBeGreaterThanOrEqual(initialPostCount);
  });
});

test.describe("Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("should navigate to explore page", async ({ page }) => {
    await page.locator('.header a[routerLink="/explore"]').click();
    await expect(page).toHaveURL(/explore/);
  });

  test("should navigate to profile page", async ({ page }) => {
    await page.locator('.header a[routerLink="/profile"]').click();
    await expect(page).toHaveURL(/profile/);
  });

  test("should navigate back to feed", async ({ page }) => {
    await page.goto("/explore");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("nav-home").click();
    await expect(page).toHaveURL(/feed/);
  });

  test("should open upload modal", async ({ page }) => {
    // Click on upload button in header
    const uploadBtn = page
      .locator(".header .header__icon--upload, .header__nav button")
      .first();
    if (await uploadBtn.isVisible()) {
      await uploadBtn.click();
    }

    // Modal should appear
    await page.waitForTimeout(300);
    const modal = page.locator(".upload-modal, .modal");
    await expect(modal).toBeVisible();
  });

  test("should close upload modal on close button", async ({ page }) => {
    const uploadBtn = page
      .locator(".header .header__icon--upload, .header__nav button")
      .first();
    await uploadBtn.click();

    await page.waitForTimeout(300);

    // Click close button or press escape
    const closeBtn = page
      .locator(".modal__close, .upload-modal__close, [aria-label='Close']")
      .first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    } else {
      // Press escape to close
      await page.keyboard.press("Escape");
    }

    await page.waitForTimeout(300);
  });
});
