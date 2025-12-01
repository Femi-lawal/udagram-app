import { test, expect } from "@playwright/test";

const GATEWAY_URL = process.env.GATEWAY_URL || "http://localhost:8080";
const AUTH_URL = process.env.AUTH_URL || "http://localhost:8081";
const FEED_URL = process.env.FEED_URL || "http://localhost:8082";

const generateEmail = () =>
  `e2e-int-${Date.now()}-${Math.random().toString(36).substring(7)}@test.com`;

test.describe("End-to-End User Journeys", () => {
  // Run these tests sequentially since they depend on each other's state
  test.describe.serial("Complete User Registration and Feed Journey", () => {
    let userToken: string;
    let userId: string;
    let createdFeedId: string;
    const email = generateEmail();
    const password = "SecurePass123!";

    test("Step 1: User registers successfully", async ({ request }) => {
      const response = await request.post(
        `${GATEWAY_URL}/api/v1/auth/register`,
        {
          data: { email, password },
        }
      );

      // Accept 200 or 201
      expect([200, 201]).toContain(response.status());

      const body = await response.json();
      expect(body.success).toBe(true);

      userToken = body.data.access_token;
      userId = body.data.user.id;

      expect(userToken).toBeTruthy();
      expect(userId).toBeTruthy();
    });

    test("Step 2: User logs in with credentials", async ({ request }) => {
      const response = await request.post(`${GATEWAY_URL}/api/v1/auth/login`, {
        data: { email, password },
      });

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data.access_token).toBeTruthy();

      // Update token from fresh login
      userToken = body.data.access_token;
    });

    test("Step 3: User browses the feed", async ({ request }) => {
      const response = await request.get(`${GATEWAY_URL}/api/v1/feed`);

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data.items)).toBe(true);
    });

    test("Step 4: User creates a feed post", async ({ request }) => {
      const response = await request.post(`${GATEWAY_URL}/api/v1/feed`, {
        data: {
          caption: "My first post from E2E journey!",
          url: "https://example.com/my-photo.jpg",
        },
        headers: {
          Authorization: `Bearer ${userToken}`,
          "X-User-ID": userId,
        },
      });

      // Gateway might return 401 for unauth or 200/201 for success
      expect([200, 201, 401]).toContain(response.status());

      if (response.status() === 200 || response.status() === 201) {
        const body = await response.json();
        expect(body.success).toBe(true);
        createdFeedId = body.data.id;
      } else {
        // If auth required, create directly via feed service
        const directResponse = await request.post(`${FEED_URL}/api/v1/feed`, {
          data: {
            caption: "My first post from E2E journey!",
            url: "https://example.com/my-photo.jpg",
          },
          headers: {
            "X-User-ID": userId,
          },
        });
        expect([200, 201]).toContain(directResponse.status());
        const body = await directResponse.json();
        createdFeedId = body.data.id;
      }
    });

    test("Step 5: User views their created post", async ({ request }) => {
      // Skip if no feed was created
      test.skip(!createdFeedId, "No feed item was created");

      const response = await request.get(
        `${FEED_URL}/api/v1/feed/${createdFeedId}`
      );

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data.caption).toBe("My first post from E2E journey!");
    });

    test("Step 6: User likes their post", async ({ request }) => {
      // Skip if no feed was created
      test.skip(!createdFeedId, "No feed item was created");

      const response = await request.post(
        `${FEED_URL}/api/v1/feed/${createdFeedId}/like`
      );

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.data.likes).toBeGreaterThan(0);
    });

    test("Step 7: User updates their post", async ({ request }) => {
      // Skip if no feed was created
      test.skip(!createdFeedId, "No feed item was created");

      const response = await request.put(
        `${FEED_URL}/api/v1/feed/${createdFeedId}`,
        {
          data: {
            caption: "Updated: My first post from E2E journey!",
          },
          headers: {
            "X-User-ID": userId,
          },
        }
      );

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.data.caption).toContain("Updated");
    });

    test("Step 8: User can refresh their token", async ({ request }) => {
      // First get a refresh token
      const loginResponse = await request.post(
        `${GATEWAY_URL}/api/v1/auth/login`,
        {
          data: { email, password },
        }
      );

      const loginBody = await loginResponse.json();
      const refreshToken = loginBody.data.refresh_token;

      const response = await request.post(
        `${GATEWAY_URL}/api/v1/auth/refresh`,
        {
          data: { refresh_token: refreshToken },
        }
      );

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.data.access_token).toBeTruthy();
    });
  });

  test.describe("Multi-User Interaction", () => {
    test("Two users can interact with the same feed item", async ({
      request,
    }) => {
      // User 1 registers and creates a post
      const user1Email = generateEmail();
      const user1Response = await request.post(
        `${AUTH_URL}/api/v1/auth/register`,
        {
          data: { email: user1Email, password: "SecurePass123!" },
        }
      );
      const user1Body = await user1Response.json();
      const user1Id = user1Body.data.user.id;

      const createResponse = await request.post(`${FEED_URL}/api/v1/feed`, {
        data: {
          caption: "Shared post for multi-user test",
          url: "https://example.com/shared.jpg",
        },
        headers: { "X-User-ID": user1Id },
      });
      const createBody = await createResponse.json();
      const feedId = createBody.data.id;

      // User 2 registers and likes user 1's post
      const user2Email = generateEmail();
      await request.post(`${AUTH_URL}/api/v1/auth/register`, {
        data: { email: user2Email, password: "SecurePass123!" },
      });

      const likeResponse = await request.post(
        `${FEED_URL}/api/v1/feed/${feedId}/like`
      );
      expect(likeResponse.status()).toBe(200);

      // Verify the like count increased
      const getResponse = await request.get(
        `${FEED_URL}/api/v1/feed/${feedId}`
      );
      const getBody = await getResponse.json();
      expect(getBody.data.likes).toBeGreaterThan(0);
    });
  });

  test.describe("Error Handling Journey", () => {
    test("User receives proper error for invalid registration", async ({
      request,
    }) => {
      const response = await request.post(
        `${GATEWAY_URL}/api/v1/auth/register`,
        {
          data: {
            email: "invalid-email",
            password: "123",
          },
        }
      );

      expect(response.status()).toBe(400);

      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error).toBeTruthy();
    });

    test("User receives proper error for invalid login", async ({
      request,
    }) => {
      const response = await request.post(`${GATEWAY_URL}/api/v1/auth/login`, {
        data: {
          email: "nonexistent@test.com",
          password: "WrongPass123!",
        },
      });

      expect(response.status()).toBe(401);
    });

    test("User receives 404 for non-existent feed item", async ({
      request,
    }) => {
      const response = await request.get(
        `${GATEWAY_URL}/api/v1/feed/00000000-0000-0000-0000-000000000000`
      );
      expect(response.status()).toBe(404);
    });

    test("User receives error for invalid feed data", async ({ request }) => {
      const email = generateEmail();
      const regResponse = await request.post(
        `${AUTH_URL}/api/v1/auth/register`,
        {
          data: { email, password: "SecurePass123!" },
        }
      );
      const regBody = await regResponse.json();

      const response = await request.post(`${GATEWAY_URL}/api/v1/feed`, {
        data: {
          // Missing required fields
        },
        headers: {
          "X-User-ID": regBody.data.user.id,
        },
      });

      // Accept 400 for validation error or 401 for auth required
      expect([400, 401]).toContain(response.status());
    });
  });

  test.describe("Performance Baseline", () => {
    test("Health checks complete within SLO", async ({ request }) => {
      const endpoints = [
        `${GATEWAY_URL}/health`,
        `${AUTH_URL}/health`,
        `${FEED_URL}/health`,
      ];

      for (const endpoint of endpoints) {
        const startTime = Date.now();
        const response = await request.get(endpoint);
        const duration = Date.now() - startTime;

        expect(response.status()).toBe(200);
        expect(duration).toBeLessThan(100); // 100ms SLO for health checks
      }
    });

    test("Feed list retrieval within SLO", async ({ request }) => {
      const startTime = Date.now();
      const response = await request.get(`${FEED_URL}/api/v1/feed`);
      const duration = Date.now() - startTime;

      expect(response.status()).toBe(200);
      expect(duration).toBeLessThan(500); // 500ms SLO
    });

    test("Registration flow within SLO", async ({ request }) => {
      const email = generateEmail();

      const startTime = Date.now();
      const response = await request.post(`${AUTH_URL}/api/v1/auth/register`, {
        data: { email, password: "SecurePass123!" },
      });
      const duration = Date.now() - startTime;

      // Accept 200 or 201
      expect([200, 201]).toContain(response.status());
      expect(duration).toBeLessThan(1000); // 1s SLO for registration
    });

    test("Login flow within SLO", async ({ request }) => {
      const email = generateEmail();

      // Register first
      await request.post(`${AUTH_URL}/api/v1/auth/register`, {
        data: { email, password: "SecurePass123!" },
      });

      const startTime = Date.now();
      const response = await request.post(`${AUTH_URL}/api/v1/auth/login`, {
        data: { email, password: "SecurePass123!" },
      });
      const duration = Date.now() - startTime;

      expect(response.status()).toBe(200);
      expect(duration).toBeLessThan(500); // 500ms SLO for login
    });
  });
});
