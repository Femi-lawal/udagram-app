import { test, expect, Page } from "@playwright/test";

// Mock auth response
const mockAuthResponse = {
  auth: true,
  token: "mock-jwt-token",
  user: {
    id: "1",
    email: "test@example.com",
    username: "testuser",
    avatar: "https://i.pravatar.cc/150?u=testuser",
  },
};

// Setup API mocks
async function setupMocks(page: Page) {
  await page.route("**/api/v0/users/auth/login", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockAuthResponse),
    });
  });

  await page.route("**/api/v0/users/auth", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(mockAuthResponse),
      });
    } else {
      await route.continue();
    }
  });

  await page.route("**/api/v0/feed**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [], rows: [], count: 0 }),
    });
  });
}

test.describe("Auth Flow", () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    // Clear storage before each test
    await page.goto("/login");
    await page.evaluate(() => localStorage.clear());
  });

  test("should display login page for unauthenticated users", async ({
    page,
  }) => {
    await page.goto("/feed");
    await expect(page).toHaveURL(/login/);
    await expect(page.locator(".auth-logo")).toContainText("Udagram");
  });

  test("should show login form with all elements", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByTestId("email-input")).toBeVisible();
    await expect(page.getByTestId("password-input")).toBeVisible();
    await expect(page.getByTestId("login-button")).toBeVisible();
    await expect(page.getByTestId("register-link")).toBeVisible();
  });

  test("should validate email format", async ({ page }) => {
    await page.goto("/login");

    await page.getByTestId("email-input").fill("invalid-email");
    await page.getByTestId("password-input").fill("password123");
    await page.getByTestId("email-input").blur();

    await expect(page.getByTestId("login-button")).toBeDisabled();
  });

  test("should require minimum password length", async ({ page }) => {
    await page.goto("/login");

    await page.getByTestId("email-input").fill("test@example.com");
    await page.getByTestId("password-input").fill("12345"); // Less than 6 chars
    await page.getByTestId("password-input").blur();

    await expect(page.getByTestId("login-button")).toBeDisabled();
  });

  test("should toggle password visibility", async ({ page }) => {
    await page.goto("/login");

    const passwordInput = page.getByTestId("password-input");
    await passwordInput.fill("password123");

    // Initially password should be hidden
    await expect(passwordInput).toHaveAttribute("type", "password");

    // Click show button
    await page.getByRole("button", { name: "Show" }).click();
    await expect(passwordInput).toHaveAttribute("type", "text");

    // Click hide button
    await page.getByRole("button", { name: "Hide" }).click();
    await expect(passwordInput).toHaveAttribute("type", "password");
  });

  test("should login with valid credentials", async ({ page }) => {
    await page.goto("/login");

    await page.getByTestId("email-input").fill("test@example.com");
    await page.getByTestId("password-input").fill("password123");
    await page.getByTestId("login-button").click();

    // Should redirect to feed after successful login
    await expect(page).toHaveURL(/feed/, { timeout: 10000 });
  });

  test("should navigate to register page", async ({ page }) => {
    await page.goto("/login");

    await page.getByTestId("register-link").click();
    await expect(page).toHaveURL(/register/);
  });

  test("should show register form with all elements", async ({ page }) => {
    await page.goto("/register");

    await expect(page.getByTestId("email-input")).toBeVisible();
    await expect(page.getByTestId("username-input")).toBeVisible();
    await expect(page.getByTestId("password-input")).toBeVisible();
    await expect(page.getByTestId("confirm-password-input")).toBeVisible();
    await expect(page.getByTestId("register-button")).toBeVisible();
    await expect(page.getByTestId("login-link")).toBeVisible();
  });

  test("should validate password match on register", async ({ page }) => {
    await page.goto("/register");

    await page.getByTestId("email-input").fill("test@example.com");
    await page.getByTestId("username-input").fill("testuser");
    await page.getByTestId("password-input").fill("password123");
    await page.getByTestId("confirm-password-input").fill("differentpassword");
    await page.getByTestId("confirm-password-input").blur();

    await expect(page.getByTestId("register-button")).toBeDisabled();
  });

  test("should show password strength indicator", async ({ page }) => {
    await page.goto("/register");

    const passwordInput = page.getByTestId("password-input");

    // Weak password
    await passwordInput.fill("abc");
    await expect(page.locator(".password-strength__text")).toContainText(
      "Weak"
    );

    // Medium password
    await passwordInput.fill("abcdef123");
    await expect(page.locator(".password-strength__text")).toContainText(
      "Medium"
    );

    // Strong password
    await passwordInput.fill("Abcdef123!");
    await expect(page.locator(".password-strength__text")).toContainText(
      "Strong"
    );
  });

  test("should register with valid data", async ({ page }) => {
    await page.goto("/register");

    await page.getByTestId("email-input").fill("newuser@example.com");
    await page.getByTestId("username-input").fill("newuser");
    await page.getByTestId("password-input").fill("Password123!");
    await page.getByTestId("confirm-password-input").fill("Password123!");
    await page.getByTestId("register-button").click();

    // Should redirect to feed after successful registration
    await expect(page).toHaveURL(/feed/, { timeout: 10000 });
  });

  test("should navigate back to login from register", async ({ page }) => {
    await page.goto("/register");

    await page.getByTestId("login-link").click();
    await expect(page).toHaveURL(/login/);
  });

  test("should display demo button on login page", async ({ page }) => {
    await page.goto("/login");

    const demoButton = page.getByTestId("demo-button");
    await expect(demoButton).toBeVisible();
    await expect(demoButton).toContainText("Try Demo Account");
  });

  test("should login with demo account", async ({ page }) => {
    await page.goto("/login");

    const demoButton = page.getByTestId("demo-button");
    await demoButton.click();

    // Should redirect to feed after successful demo login
    await expect(page).toHaveURL(/feed/, { timeout: 10000 });
  });

  test("should display demo features list", async ({ page }) => {
    await page.goto("/login");

    const demoFeatures = page.locator(".demo-features");
    await expect(demoFeatures).toBeVisible();
    await expect(demoFeatures).toContainText("Demo Features Include");
  });
});
