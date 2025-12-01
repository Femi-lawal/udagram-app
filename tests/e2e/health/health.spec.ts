import { test, expect, APIRequestContext } from "@playwright/test";

const GATEWAY_URL = process.env.GATEWAY_URL || "http://localhost:8080";
const AUTH_URL = process.env.AUTH_URL || "http://localhost:8081";
const FEED_URL = process.env.FEED_URL || "http://localhost:8082";
const NOTIFICATION_URL =
  process.env.NOTIFICATION_URL || "http://localhost:8083";

test.describe("Service Health Checks", () => {
  test("Gateway service is healthy", async ({ request }) => {
    const response = await request.get(`${GATEWAY_URL}/health`);
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.status).toBe("healthy");
  });

  test("Auth service is healthy", async ({ request }) => {
    const response = await request.get(`${AUTH_URL}/health`);
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.status).toBe("healthy");
  });

  test("Feed service is healthy", async ({ request }) => {
    const response = await request.get(`${FEED_URL}/health`);
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.status).toBe("healthy");
  });

  test("Notification service is healthy", async ({ request }) => {
    const response = await request.get(`${NOTIFICATION_URL}/health`);
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.status).toBe("healthy");
  });

  test("All services respond within acceptable time", async ({ request }) => {
    const services = [
      { name: "Gateway", url: `${GATEWAY_URL}/health` },
      { name: "Auth", url: `${AUTH_URL}/health` },
      { name: "Feed", url: `${FEED_URL}/health` },
      { name: "Notification", url: `${NOTIFICATION_URL}/health` },
    ];

    for (const service of services) {
      const startTime = Date.now();
      const response = await request.get(service.url);
      const duration = Date.now() - startTime;

      expect(response.status()).toBe(200);
      expect(duration).toBeLessThan(500); // 500ms SLO

      console.log(`${service.name} responded in ${duration}ms`);
    }
  });

  test("Metrics endpoints are accessible", async ({ request }) => {
    const response = await request.get(`${GATEWAY_URL}/metrics`);
    expect(response.status()).toBe(200);

    const body = await response.text();
    expect(body).toContain("http_requests_total");
    expect(body).toContain("go_goroutines");
  });

  test("Ready endpoint works", async ({ request }) => {
    const response = await request.get(`${GATEWAY_URL}/ready`);
    expect(response.status()).toBe(200);
  });
});
