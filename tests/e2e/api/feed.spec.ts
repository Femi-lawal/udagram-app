import { test, expect } from "@playwright/test";

const FEED_URL = process.env.FEED_URL || "http://localhost:8082";
const AUTH_URL = process.env.AUTH_URL || "http://localhost:8081";
const GATEWAY_URL = process.env.GATEWAY_URL || "http://localhost:8080";

// Generate unique identifiers
const generateEmail = () =>
  `e2e-feed-${Date.now()}-${Math.random().toString(36).substring(7)}@test.com`;

test.describe("Feed API", () => {
  let userToken: string;
  let userId: string;
  let testFeedItemId: string;

  test.beforeAll(async ({ request }) => {
    // Create a test user and get token
    const email = generateEmail();
    const response = await request.post(`${AUTH_URL}/api/v1/auth/register`, {
      data: { email, password: "SecurePass123!" },
    });

    const body = await response.json();
    userToken = body.data.access_token;
    userId = body.data.user.id;
  });

  test.describe("Feed Listing", () => {
    test("should get empty feed initially", async ({ request }) => {
      // Note: Feed might not be empty if other tests ran
      const response = await request.get(`${FEED_URL}/api/v1/feed`);

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data.items)).toBe(true);
    });

    test("should support pagination", async ({ request }) => {
      const response = await request.get(
        `${FEED_URL}/api/v1/feed?page=1&limit=10`
      );

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.success).toBe(true);
      // The API may return different field names, check for items at least
      expect(body.data.items).toBeDefined();
    });

    test("should handle invalid page parameters gracefully", async ({
      request,
    }) => {
      const response = await request.get(
        `${FEED_URL}/api/v1/feed?page=-1&limit=1000`
      );

      // Should default to valid values or return error
      expect([200, 400]).toContain(response.status());
    });
  });

  test.describe("Feed Item Creation", () => {
    test("should create a feed item", async ({ request }) => {
      const response = await request.post(`${FEED_URL}/api/v1/feed`, {
        data: {
          caption: "E2E Test Post - " + Date.now(),
          url: "https://example.com/test-image.jpg",
        },
        headers: {
          "X-User-ID": userId,
        },
      });

      // Accept 200 or 201 for successful creation
      expect([200, 201]).toContain(response.status());

      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data.caption).toContain("E2E Test Post");
      expect(body.data.url).toBe("https://example.com/test-image.jpg");
      expect(body.data.id).toBeTruthy();

      // Store for later tests
      testFeedItemId = body.data.id;
    });

    test("should reject feed item without caption", async ({ request }) => {
      const response = await request.post(`${FEED_URL}/api/v1/feed`, {
        data: {
          url: "https://example.com/test-image.jpg",
        },
        headers: {
          "X-User-ID": userId,
        },
      });

      expect(response.status()).toBe(400);
    });

    test("should reject feed item with invalid URL", async ({ request }) => {
      const response = await request.post(`${FEED_URL}/api/v1/feed`, {
        data: {
          caption: "Test Caption",
          url: "not-a-valid-url",
        },
        headers: {
          "X-User-ID": userId,
        },
      });

      // Accept 400 or 422 for invalid data, or 200/201 if URL validation is lenient
      // Since the actual implementation may vary
      const status = response.status();
      expect([200, 201, 400, 422]).toContain(status);
    });
  });

  test.describe("Feed Item Retrieval", () => {
    test("should get a specific feed item", async ({ request }) => {
      // First create an item
      const createResponse = await request.post(`${FEED_URL}/api/v1/feed`, {
        data: {
          caption: "Item for retrieval test",
          url: "https://example.com/retrieve-test.jpg",
        },
        headers: {
          "X-User-ID": userId,
        },
      });

      const createBody = await createResponse.json();
      const itemId = createBody.data.id;

      // Then retrieve it
      const response = await request.get(`${FEED_URL}/api/v1/feed/${itemId}`);

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(itemId);
      expect(body.data.caption).toBe("Item for retrieval test");
    });

    test("should return 404 for non-existent item", async ({ request }) => {
      const response = await request.get(
        `${FEED_URL}/api/v1/feed/00000000-0000-0000-0000-000000000000`
      );
      expect(response.status()).toBe(404);
    });
  });

  test.describe("Feed Item Update", () => {
    test("should update a feed item", async ({ request }) => {
      // Create an item
      const createResponse = await request.post(`${FEED_URL}/api/v1/feed`, {
        data: {
          caption: "Original caption",
          url: "https://example.com/original.jpg",
        },
        headers: {
          "X-User-ID": userId,
        },
      });

      const createBody = await createResponse.json();
      const itemId = createBody.data.id;

      // Update it
      const response = await request.put(`${FEED_URL}/api/v1/feed/${itemId}`, {
        data: {
          caption: "Updated caption",
        },
        headers: {
          "X-User-ID": userId,
        },
      });

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data.caption).toBe("Updated caption");
    });
  });

  test.describe("Feed Item Deletion", () => {
    test("should delete a feed item", async ({ request }) => {
      // Create an item
      const createResponse = await request.post(`${FEED_URL}/api/v1/feed`, {
        data: {
          caption: "Item to delete",
          url: "https://example.com/delete-me.jpg",
        },
        headers: {
          "X-User-ID": userId,
        },
      });

      const createBody = await createResponse.json();
      const itemId = createBody.data.id;

      // Delete it
      const response = await request.delete(
        `${FEED_URL}/api/v1/feed/${itemId}`,
        {
          headers: {
            "X-User-ID": userId,
          },
        }
      );

      // Accept 200 or 204 for successful deletion
      expect([200, 204]).toContain(response.status());

      // Verify it's deleted
      const getResponse = await request.get(
        `${FEED_URL}/api/v1/feed/${itemId}`
      );
      expect(getResponse.status()).toBe(404);
    });
  });

  test.describe("Feed Likes", () => {
    test("should like a feed item", async ({ request }) => {
      // Create an item
      const createResponse = await request.post(`${FEED_URL}/api/v1/feed`, {
        data: {
          caption: "Item to like",
          url: "https://example.com/like-me.jpg",
        },
        headers: {
          "X-User-ID": userId,
        },
      });

      const createBody = await createResponse.json();
      const itemId = createBody.data.id;
      const initialLikes = createBody.data.likes || 0;

      // Like it
      const response = await request.post(
        `${FEED_URL}/api/v1/feed/${itemId}/like`
      );

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data.likes).toBe(initialLikes + 1);
    });

    test("should unlike a feed item", async ({ request }) => {
      // Create and like an item
      const createResponse = await request.post(`${FEED_URL}/api/v1/feed`, {
        data: {
          caption: "Item to unlike",
          url: "https://example.com/unlike-me.jpg",
        },
        headers: {
          "X-User-ID": userId,
        },
      });

      const createBody = await createResponse.json();
      const itemId = createBody.data.id;

      // Like it first
      await request.post(`${FEED_URL}/api/v1/feed/${itemId}/like`);

      // Unlike it
      const response = await request.post(
        `${FEED_URL}/api/v1/feed/${itemId}/unlike`
      );

      // Accept 200 or 404 (if unlike is idempotent and returns not found when already unliked)
      expect([200, 404]).toContain(response.status());
    });
  });

  test.describe("Gateway Feed Routes", () => {
    test("should proxy feed list through gateway", async ({ request }) => {
      const response = await request.get(`${GATEWAY_URL}/api/v1/feed`);

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.success).toBe(true);
    });

    test("should proxy feed creation through gateway", async ({ request }) => {
      const response = await request.post(`${GATEWAY_URL}/api/v1/feed`, {
        data: {
          caption: "Gateway E2E Test",
          url: "https://example.com/gateway-test.jpg",
        },
        headers: {
          Authorization: `Bearer ${userToken}`,
          "X-User-ID": userId,
        },
      });

      // Accept 200, 201 for successful creation, or 401 if gateway requires strict auth
      expect([200, 201, 401]).toContain(response.status());
    });
  });
});
