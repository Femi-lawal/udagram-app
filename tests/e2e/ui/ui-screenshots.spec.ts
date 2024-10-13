import { test, expect, Page } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

const BASE_URL = process.env.BASE_URL || "http://localhost:80";
const AUTH_URL = process.env.AUTH_URL || "http://localhost:8081";
const SCREENSHOTS_DIR = path.join(__dirname, "..", "..", "screenshots", "ui");

// Ensure screenshots directory exists
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

// Generate unique email for test users
const generateEmail = () =>
  `e2e-ui-${Date.now()}-${Math.random().toString(36).substring(7)}@test.com`;

// Helper to take and save screenshot
async function takeScreenshot(page: Page, name: string): Promise<string> {
  const filename = `${name}-${Date.now()}.png`;
  const filepath = path.join(SCREENSHOTS_DIR, filename);
  await page.screenshot({ path: filepath, fullPage: true });
  console.log(`📸 Screenshot saved: ${filename}`);
  return filepath;
}

// Helper to set authentication in localStorage (matching Angular's AuthService)
async function setAuth(page: Page, token: string, email: string): Promise<void> {
  await page.evaluate(({ token, email }) => {
    // Angular AuthService uses these exact keys
    localStorage.setItem('udagram_token', token);
    localStorage.setItem('udagram_user', JSON.stringify({
      id: 'test-user-id',
      email: email,
      username: email.split('@')[0],
      avatar: `https://i.pravatar.cc/150?u=${email}`
    }));
  }, { token, email });
}

test.describe("UI Feature Screenshots", () => {
  test.describe.configure({ mode: "serial" });

  let testEmail: string;
  const testPassword = "SecurePass123!";
  let authToken: string;
  let userId: string;

  test.beforeAll(async ({ request }) => {
    // Create a test user via API
    testEmail = generateEmail();
    const response = await request.post(`${AUTH_URL}/api/v1/auth/register`, {
      data: { email: testEmail, password: testPassword },
    });
    const body = await response.json();
    authToken = body.data?.access_token;
    userId = body.data?.user?.id;
  });

  test("01 - Login Page", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState("networkidle");
    
    // Wait for form elements
    await page.waitForSelector('input[type="email"], input[name="email"], [data-testid="email"]', { timeout: 10000 }).catch(() => {});
    
    await takeScreenshot(page, "01-login-page");
    
    // Verify login page elements
    expect(await page.title()).toBeTruthy();
  });

  test("02 - Register Page", async ({ page }) => {
    await page.goto(`${BASE_URL}/register`);
    await page.waitForLoadState("networkidle");
    
    await page.waitForSelector('input[type="email"], input[name="email"], [data-testid="email"]', { timeout: 10000 }).catch(() => {});
    
    await takeScreenshot(page, "02-register-page");
    
    expect(await page.title()).toBeTruthy();
  });

  test("03 - Login Flow", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState("networkidle");

    // Take screenshot before login
    await takeScreenshot(page, "03a-login-form-empty");

    // Fill login form
    const emailInput = page.locator('input[type="email"], input[name="email"], [data-testid="email"]').first();
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
    
    if (await emailInput.isVisible()) {
      await emailInput.fill(testEmail);
      await passwordInput.fill(testPassword);
      await takeScreenshot(page, "03b-login-form-filled");
      
      // Submit form
      const submitBtn = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign in")').first();
      if (await submitBtn.isVisible()) {
        await submitBtn.click();
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(2000);
        await takeScreenshot(page, "03c-login-success");
      }
    }
  });

  test("04 - Feed Page (Authenticated)", async ({ page }) => {
    // Set auth token in localStorage using correct keys
    await page.goto(`${BASE_URL}/login`);
    await setAuth(page, authToken, testEmail);

    await page.goto(`${BASE_URL}/feed`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    
    await takeScreenshot(page, "04-feed-page");
  });

  test("05 - Explore Page (Authenticated)", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await setAuth(page, authToken, testEmail);

    await page.goto(`${BASE_URL}/explore`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    
    await takeScreenshot(page, "05-explore-page");
  });

  test("06 - Upload Page (Authenticated)", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await setAuth(page, authToken, testEmail);

    await page.goto(`${BASE_URL}/upload`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    
    await takeScreenshot(page, "06-upload-page");
  });

  test("07 - Profile Page (Authenticated)", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await setAuth(page, authToken, testEmail);

    await page.goto(`${BASE_URL}/profile`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    
    await takeScreenshot(page, "07-profile-page");
  });

  test("08 - Navigation Elements (Authenticated)", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await setAuth(page, authToken, testEmail);

    await page.goto(`${BASE_URL}/feed`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    // Take screenshot of navigation/header
    await takeScreenshot(page, "08-navigation-elements");

    // Try to find and screenshot sidebar/menu
    const sidebar = page.locator('nav, aside, [data-testid="sidebar"], .sidebar, .nav').first();
    if (await sidebar.isVisible()) {
      await sidebar.screenshot({ path: path.join(SCREENSHOTS_DIR, "08b-sidebar-nav.png") });
    }
  });

  test("09 - Responsive Mobile View (Authenticated)", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 812 });
    
    await page.goto(`${BASE_URL}/login`);
    await setAuth(page, authToken, testEmail);

    await page.goto(`${BASE_URL}/feed`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    
    await takeScreenshot(page, "09-mobile-feed-view");
  });

  test("10 - Error States", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState("networkidle");

    // Try invalid login
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
    
    if (await emailInput.isVisible()) {
      await emailInput.fill("invalid@test.com");
      await passwordInput.fill("wrongpassword");
      
      const submitBtn = page.locator('button[type="submit"], button:has-text("Login")').first();
      if (await submitBtn.isVisible()) {
        await submitBtn.click();
        await page.waitForTimeout(3000);
        await takeScreenshot(page, "10-login-error-state");
      }
    }
  });
});

test.describe("Create Post Flow", () => {
  const testPassword = "SecurePass123!";
  let testEmail: string;
  let authToken: string;

  test.beforeAll(async ({ request }) => {
    testEmail = generateEmail();
    const response = await request.post(`${AUTH_URL}/api/v1/auth/register`, {
      data: { email: testEmail, password: testPassword },
    });
    const body = await response.json();
    authToken = body.data?.access_token;
  });

  test("11 - Create Post Flow", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.evaluate(({ token, email }) => {
      localStorage.setItem('udagram_token', token);
      localStorage.setItem('udagram_user', JSON.stringify({
        id: 'test-user-id',
        email: email,
        username: email.split('@')[0],
        avatar: `https://i.pravatar.cc/150?u=${email}`
      }));
    }, { token: authToken, email: testEmail });

    await page.goto(`${BASE_URL}/upload`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    await takeScreenshot(page, "11a-upload-form");

    // Look for upload form elements
    const captionInput = page.locator('textarea, input[name="caption"], [data-testid="caption"]').first();
    if (await captionInput.isVisible()) {
      await captionInput.fill("Test post from E2E automation");
      await takeScreenshot(page, "11b-upload-form-filled");
    }
  });
});

test.describe("Like/Unlike Interactions", () => {
  const testPassword = "SecurePass123!";
  let testEmail: string;
  let authToken: string;

  test.beforeAll(async ({ request }) => {
    testEmail = generateEmail();
    const response = await request.post(`${AUTH_URL}/api/v1/auth/register`, {
      data: { email: testEmail, password: testPassword },
    });
    const body = await response.json();
    authToken = body.data?.access_token;
  });

  test("12 - Like/Unlike Post", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.evaluate(({ token, email }) => {
      localStorage.setItem('udagram_token', token);
      localStorage.setItem('udagram_user', JSON.stringify({
        id: 'test-user-id',
        email: email,
        username: email.split('@')[0],
        avatar: `https://i.pravatar.cc/150?u=${email}`
      }));
    }, { token: authToken, email: testEmail });

    await page.goto(`${BASE_URL}/feed`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    await takeScreenshot(page, "12a-feed-before-like");

    // Look for like buttons
    const likeBtn = page.locator('button:has-text("Like"), [data-testid="like"], .like-button, button svg').first();
    if (await likeBtn.isVisible()) {
      await likeBtn.click();
      await page.waitForTimeout(500);
      await takeScreenshot(page, "12b-feed-after-like");
    }
  });
});

// New Test Suite: Registration Flow
test.describe("Registration Flow", () => {
  test("13 - Complete Registration Flow", async ({ page }) => {
    const newEmail = generateEmail();
    const newUsername = `user${Date.now()}`;
    const newPassword = "SecurePass123!";

    await page.goto(`${BASE_URL}/register`);
    await page.waitForLoadState("networkidle");

    await takeScreenshot(page, "13a-register-empty");

    // Fill registration form
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const usernameInput = page.locator('input[name="username"], input[placeholder*="username" i]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    const confirmPasswordInput = page.locator('input[type="password"]').nth(1);

    if (await emailInput.isVisible()) {
      await emailInput.fill(newEmail);
    }
    if (await usernameInput.isVisible()) {
      await usernameInput.fill(newUsername);
    }
    if (await passwordInput.isVisible()) {
      await passwordInput.fill(newPassword);
    }
    if (await confirmPasswordInput.isVisible()) {
      await confirmPasswordInput.fill(newPassword);
    }

    await takeScreenshot(page, "13b-register-filled");

    // Submit registration
    const submitBtn = page.locator('button[type="submit"], button:has-text("Sign up"), button:has-text("Register")').first();
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(3000);
      await takeScreenshot(page, "13c-register-success");
    }
  });
});

// New Test Suite: Logout Flow
test.describe("Logout Flow", () => {
  const testPassword = "SecurePass123!";
  let testEmail: string;
  let authToken: string;

  test.beforeAll(async ({ request }) => {
    testEmail = generateEmail();
    const response = await request.post(`${AUTH_URL}/api/v1/auth/register`, {
      data: { email: testEmail, password: testPassword },
    });
    const body = await response.json();
    authToken = body.data?.access_token;
  });

  test("14 - Logout Flow", async ({ page }) => {
    // Login first
    await page.goto(`${BASE_URL}/login`);
    await setAuth(page, authToken, testEmail);

    await page.goto(`${BASE_URL}/feed`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    await takeScreenshot(page, "14a-logged-in");

    // Look for logout button/link in profile or menu
    const profileBtn = page.locator('[data-testid="profile"], .profile-link, a[href*="profile"]').first();
    if (await profileBtn.isVisible()) {
      await profileBtn.click();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1000);
    }

    // Look for logout button
    const logoutBtn = page.locator('button:has-text("Logout"), button:has-text("Log out"), a:has-text("Logout"), [data-testid="logout"]').first();
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click();
      await page.waitForTimeout(2000);
      await takeScreenshot(page, "14b-logged-out");
    } else {
      // Try clearing localStorage to simulate logout
      await page.evaluate(() => {
        localStorage.removeItem('udagram_token');
        localStorage.removeItem('udagram_user');
      });
      await page.goto(`${BASE_URL}/feed`);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1000);
      await takeScreenshot(page, "14b-redirect-to-login");
    }
  });
});

// New Test Suite: Post Detail Page
test.describe("Post Detail Page", () => {
  const testPassword = "SecurePass123!";
  let testEmail: string;
  let authToken: string;
  let feedItemId: string;

  test.beforeAll(async ({ request }) => {
    testEmail = generateEmail();
    const registerResponse = await request.post(`${AUTH_URL}/api/v1/auth/register`, {
      data: { email: testEmail, password: testPassword },
    });
    const registerBody = await registerResponse.json();
    authToken = registerBody.data?.access_token;

    // Create a feed item for testing
    const FEED_URL = process.env.FEED_URL || "http://localhost:8082";
    const createResponse = await request.post(`${FEED_URL}/api/v1/feed`, {
      data: {
        caption: "E2E Test Post for Post Detail Page",
        url: "https://picsum.photos/800/600",
      },
    });
    const createBody = await createResponse.json();
    feedItemId = createBody.data?.id;
  });

  test("15 - Post Detail Page", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await setAuth(page, authToken, testEmail);

    // Navigate to post detail page
    if (feedItemId) {
      await page.goto(`${BASE_URL}/post/${feedItemId}`);
    } else {
      // If we don't have a specific post ID, go to feed and click on a post
      await page.goto(`${BASE_URL}/feed`);
    }
    
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    await takeScreenshot(page, "15-post-detail-page");

    // Try clicking on a post if on feed page
    const postCard = page.locator('[data-testid="post"], .post-card, article').first();
    if (await postCard.isVisible()) {
      await postCard.click();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1000);
      await takeScreenshot(page, "15b-post-detail-modal");
    }
  });
});

// New Test Suite: Activity/Notifications Page
test.describe("Activity/Notifications Page", () => {
  const testPassword = "SecurePass123!";
  let testEmail: string;
  let authToken: string;

  test.beforeAll(async ({ request }) => {
    testEmail = generateEmail();
    const response = await request.post(`${AUTH_URL}/api/v1/auth/register`, {
      data: { email: testEmail, password: testPassword },
    });
    const body = await response.json();
    authToken = body.data?.access_token;
  });

  test("16 - Activity/Notifications Page", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await setAuth(page, authToken, testEmail);

    await page.goto(`${BASE_URL}/feed`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    await takeScreenshot(page, "16a-before-activity");

    // Look for activity/notifications icon in nav
    const activityBtn = page.locator(
      'a[href*="activity"], [data-testid="activity"], button[aria-label*="notification" i], button[aria-label*="activity" i], nav button svg, nav a svg'
    ).nth(2); // Usually 3rd icon (Home, Explore, Upload, Activity)

    if (await activityBtn.isVisible()) {
      await activityBtn.click();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(2000);
      await takeScreenshot(page, "16b-activity-page");
    } else {
      // Try direct navigation if available
      await page.goto(`${BASE_URL}/activity`);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(2000);
      await takeScreenshot(page, "16b-activity-direct");
    }
  });
});

// New Test Suite: Explore Page Filters
test.describe("Explore Page Filters", () => {
  const testPassword = "SecurePass123!";
  let testEmail: string;
  let authToken: string;

  test.beforeAll(async ({ request }) => {
    testEmail = generateEmail();
    const response = await request.post(`${AUTH_URL}/api/v1/auth/register`, {
      data: { email: testEmail, password: testPassword },
    });
    const body = await response.json();
    authToken = body.data?.access_token;
  });

  test("17 - Explore Page Category Filters", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await setAuth(page, authToken, testEmail);

    await page.goto(`${BASE_URL}/explore`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    await takeScreenshot(page, "17a-explore-all");

    // Look for filter tabs/buttons (All, Travel, Food, etc.)
    const filterTabs = page.locator('button:has-text("Travel"), button:has-text("Food"), button:has-text("Nature"), [role="tab"]');
    
    // Click on Travel filter
    const travelTab = page.locator('button:has-text("Travel"), [data-testid="filter-travel"]').first();
    if (await travelTab.isVisible()) {
      await travelTab.click();
      await page.waitForTimeout(1000);
      await takeScreenshot(page, "17b-explore-travel");
    }

    // Click on Food filter
    const foodTab = page.locator('button:has-text("Food"), [data-testid="filter-food"]').first();
    if (await foodTab.isVisible()) {
      await foodTab.click();
      await page.waitForTimeout(1000);
      await takeScreenshot(page, "17c-explore-food");
    }

    // Click on Nature filter
    const natureTab = page.locator('button:has-text("Nature"), [data-testid="filter-nature"]').first();
    if (await natureTab.isVisible()) {
      await natureTab.click();
      await page.waitForTimeout(1000);
      await takeScreenshot(page, "17d-explore-nature");
    }
  });

  test("18 - Explore Page Search", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await setAuth(page, authToken, testEmail);

    await page.goto(`${BASE_URL}/explore`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    // Look for search input
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i], [data-testid="search"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill("test");
      await page.waitForTimeout(1000);
      await takeScreenshot(page, "18-explore-search");
    }
  });
});

