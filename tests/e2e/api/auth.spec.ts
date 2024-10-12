import { test, expect } from "@playwright/test";
import { logAPIResponse } from "../test-utils";

const AUTH_URL = process.env.AUTH_URL || "http://localhost:8081";
const GATEWAY_URL = process.env.GATEWAY_URL || "http://localhost:8080";

// Generate unique email for each test run
const generateEmail = () =>
  `e2e-${Date.now()}-${Math.random().toString(36).substring(7)}@test.com`;

test.describe("Authentication API", () => {
  test.describe("User Registration", () => {
    test("should register a new user successfully", async ({ request }) => {
      const email = generateEmail();
      const response = await request.post(`${AUTH_URL}/api/v1/auth/register`, {
        data: {
          email: email,
          password: "SecurePass123!",
        },
      });

      // Accept both 200 and 201 as valid success codes
      expect([200, 201]).toContain(response.status());

      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data.user.email).toBe(email);
      expect(body.data.access_token).toBeTruthy();
      expect(body.data.refresh_token).toBeTruthy();

      // Log API response for verification
      await logAPIResponse("register_success", `${AUTH_URL}/api/v1/auth/register`, {
        status: response.status(),
        body: { success: body.success, hasToken: !!body.data.access_token },
      });
    });

    test("should reject registration with invalid email", async ({
      request,
    }) => {
      const response = await request.post(`${AUTH_URL}/api/v1/auth/register`, {
        data: {
          email: "invalid-email",
          password: "SecurePass123!",
        },
      });

      expect(response.status()).toBe(400);
    });

    test("should reject registration with short password", async ({
      request,
    }) => {
      const response = await request.post(`${AUTH_URL}/api/v1/auth/register`, {
        data: {
          email: generateEmail(),
          password: "123",
        },
      });

      expect(response.status()).toBe(400);
    });

    test("should reject duplicate registration", async ({ request }) => {
      const email = generateEmail();

      // First registration
      await request.post(`${AUTH_URL}/api/v1/auth/register`, {
        data: { email, password: "SecurePass123!" },
      });

      // Duplicate registration
      const response = await request.post(`${AUTH_URL}/api/v1/auth/register`, {
        data: { email, password: "SecurePass123!" },
      });

      // Accept 400 or 409 (Conflict) for duplicate registration
      expect([400, 409]).toContain(response.status());
    });
  });

  test.describe("User Login", () => {
    let testEmail: string;
    const testPassword = "SecurePass123!";

    test.beforeAll(async ({ request }) => {
      testEmail = generateEmail();
      await request.post(`${AUTH_URL}/api/v1/auth/register`, {
        data: { email: testEmail, password: testPassword },
      });
    });

    test("should login with valid credentials", async ({ request }) => {
      const response = await request.post(`${AUTH_URL}/api/v1/auth/login`, {
        data: {
          email: testEmail,
          password: testPassword,
        },
      });

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data.access_token).toBeTruthy();
      expect(body.data.refresh_token).toBeTruthy();
      expect(body.data.token_type).toBe("Bearer");
    });

    test("should reject login with wrong password", async ({ request }) => {
      const response = await request.post(`${AUTH_URL}/api/v1/auth/login`, {
        data: {
          email: testEmail,
          password: "WrongPassword!",
        },
      });

      expect(response.status()).toBe(401);
    });

    test("should reject login with non-existent user", async ({ request }) => {
      const response = await request.post(`${AUTH_URL}/api/v1/auth/login`, {
        data: {
          email: "nonexistent@test.com",
          password: testPassword,
        },
      });

      expect(response.status()).toBe(401);
    });
  });

  test.describe("Token Refresh", () => {
    test("should refresh access token", async ({ request }) => {
      const email = generateEmail();

      // Register and get tokens
      const registerResponse = await request.post(
        `${AUTH_URL}/api/v1/auth/register`,
        {
          data: { email, password: "SecurePass123!" },
        }
      );

      const registerBody = await registerResponse.json();
      const refreshToken = registerBody.data.refresh_token;

      // Refresh token
      const response = await request.post(`${AUTH_URL}/api/v1/auth/refresh`, {
        data: { refresh_token: refreshToken },
      });

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data.access_token).toBeTruthy();
    });

    test("should reject invalid refresh token", async ({ request }) => {
      const response = await request.post(`${AUTH_URL}/api/v1/auth/refresh`, {
        data: { refresh_token: "invalid-token" },
      });

      expect(response.status()).toBe(401);
    });
  });

  test.describe("Token Validation", () => {
    test("should validate a valid access token", async ({ request }) => {
      const email = generateEmail();

      // Register and get token
      const registerResponse = await request.post(
        `${AUTH_URL}/api/v1/auth/register`,
        {
          data: { email, password: "SecurePass123!" },
        }
      );

      const registerBody = await registerResponse.json();
      const accessToken = registerBody.data.access_token;

      // Validate token
      const response = await request.get(`${AUTH_URL}/api/v1/auth/validate`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data.valid).toBe(true);

      // Log API response for verification
      await logAPIResponse("validate_token_success", `${AUTH_URL}/api/v1/auth/validate`, {
        status: response.status(),
        body,
      });
    });

    test("should reject invalid access token", async ({ request }) => {
      const response = await request.get(`${AUTH_URL}/api/v1/auth/validate`, {
        headers: {
          Authorization: "Bearer invalid-token",
        },
      });

      expect(response.status()).toBe(401);

      // Log API response for verification
      await logAPIResponse("validate_token_invalid", `${AUTH_URL}/api/v1/auth/validate`, {
        status: response.status(),
        body: await response.json().catch(() => ({})),
      });
    });

    test("should reject missing authorization header", async ({
      request,
    }) => {
      const response = await request.get(`${AUTH_URL}/api/v1/auth/validate`);
      expect(response.status()).toBe(401);

      // Log API response for verification
      await logAPIResponse("validate_missing_auth", `${AUTH_URL}/api/v1/auth/validate`, {
        status: response.status(),
        body: await response.json().catch(() => ({})),
      });
    });
  });

  test.describe("Gateway Auth Routes", () => {
    test("should proxy auth registration through gateway", async ({
      request,
    }) => {
      const email = generateEmail();
      const response = await request.post(
        `${GATEWAY_URL}/api/v1/auth/register`,
        {
          data: { email, password: "SecurePass123!" },
        }
      );

      // Accept both 200 and 201 as valid success codes
      expect([200, 201]).toContain(response.status());

      const body = await response.json();
      expect(body.success).toBe(true);
    });

    test("should proxy auth login through gateway", async ({ request }) => {
      const email = generateEmail();

      // Register first
      await request.post(`${GATEWAY_URL}/api/v1/auth/register`, {
        data: { email, password: "SecurePass123!" },
      });

      // Login through gateway
      const response = await request.post(`${GATEWAY_URL}/api/v1/auth/login`, {
        data: { email, password: "SecurePass123!" },
      });

      expect(response.status()).toBe(200);
    });
  });
});
