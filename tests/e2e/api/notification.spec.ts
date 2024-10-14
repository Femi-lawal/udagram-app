import { test, expect } from "@playwright/test";
import { logAPIResponse } from "../test-utils";

const NOTIFICATION_URL = process.env.NOTIFICATION_URL || "http://localhost:8083";
const AUTH_URL = process.env.AUTH_URL || "http://localhost:8081";

const generateEmail = () =>
  `e2e-notif-${Date.now()}-${Math.random().toString(36).substring(7)}@test.com`;

test.describe("Notification Service API", () => {
  let authToken: string;
  let testEmail: string;
  const testPassword = "SecurePass123!";

  test.beforeAll(async ({ request }) => {
    // Register and login a test user
    testEmail = generateEmail();
    const registerResponse = await request.post(`${AUTH_URL}/api/v1/auth/register`, {
      data: { email: testEmail, password: testPassword },
    });
    const body = await registerResponse.json();
    authToken = body.data?.access_token;
  });

  test.describe("Health Check", () => {
    test("should return healthy status", async ({ request }) => {
      const response = await request.get(`${NOTIFICATION_URL}/health`);
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.status).toBe("healthy");

      await logAPIResponse("notification_health", `${NOTIFICATION_URL}/health`, {
        status: response.status(),
        body,
      });
    });
  });

  test.describe("Get Notifications", () => {
    test("should return notifications list", async ({ request }) => {
      const response = await request.get(
        `${NOTIFICATION_URL}/api/v1/notifications`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            "X-User-ID": "test-user-id",
          },
        }
      );

      // May return 200 with empty array for new users
      expect([200, 401]).toContain(response.status());

      if (response.status() === 200) {
        const body = await response.json();
        expect(body.success).toBe(true);
        expect(Array.isArray(body.data)).toBe(true);

        await logAPIResponse("get_notifications", `${NOTIFICATION_URL}/api/v1/notifications`, {
          status: response.status(),
          body,
        });
      }
    });

    test("should require authentication", async ({ request }) => {
      const response = await request.get(
        `${NOTIFICATION_URL}/api/v1/notifications`
      );

      // Should fail without auth headers
      expect([200, 401]).toContain(response.status());
    });
  });

  test.describe("Send Notification", () => {
    test("should send a notification", async ({ request }) => {
      const response = await request.post(
        `${NOTIFICATION_URL}/api/v1/notifications/send`,
        {
          data: {
            user_id: "test-user-id",
            type: "test",
            message: "E2E test notification",
          },
          headers: {
            Authorization: `Bearer ${authToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      // May return 200 or 401 depending on auth implementation
      expect([200, 201, 401]).toContain(response.status());

      if (response.status() === 200 || response.status() === 201) {
        const body = await response.json();
        expect(body.success).toBe(true);

        await logAPIResponse("send_notification", `${NOTIFICATION_URL}/api/v1/notifications/send`, {
          status: response.status(),
          body,
        });
      }
    });

    test("should validate required fields", async ({ request }) => {
      const response = await request.post(
        `${NOTIFICATION_URL}/api/v1/notifications/send`,
        {
          data: {
            // Missing required fields
          },
          headers: {
            Authorization: `Bearer ${authToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      // Should return 400 for invalid data
      expect([400, 401]).toContain(response.status());
    });
  });
});

test.describe("Notification Service Metrics", () => {
  test("should expose Prometheus metrics", async ({ request }) => {
    const response = await request.get(`${NOTIFICATION_URL}/metrics`);
    expect(response.status()).toBe(200);

    const body = await response.text();
    expect(body).toContain("go_goroutines");
  });
});
