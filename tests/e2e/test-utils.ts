import { APIRequestContext } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const SCREENSHOTS_DIR = path.join(__dirname, "..", "screenshots");

// Ensure screenshots directory exists
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

/**
 * Log API response data to a file for verification
 */
export async function logAPIResponse(
  testName: string,
  endpoint: string,
  response: {
    status: number;
    body: unknown;
    duration?: number;
  }
): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${testName.replace(/\s+/g, "_")}_${timestamp}.json`;
  const filepath = path.join(SCREENSHOTS_DIR, filename);

  const logData = {
    test: testName,
    endpoint,
    timestamp: new Date().toISOString(),
    status: response.status,
    duration: response.duration,
    body: response.body,
  };

  fs.writeFileSync(filepath, JSON.stringify(logData, null, 2));
  console.log(`📸 API snapshot saved: ${filename}`);
}

/**
 * Create a test result summary
 */
export function createTestSummary(
  suiteName: string,
  results: Array<{ test: string; passed: boolean; duration: number }>
): void {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${suiteName}_summary_${timestamp}.json`;
  const filepath = path.join(SCREENSHOTS_DIR, filename);

  const summary = {
    suite: suiteName,
    timestamp: new Date().toISOString(),
    total: results.length,
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed).length,
    results,
  };

  fs.writeFileSync(filepath, JSON.stringify(summary, null, 2));
  console.log(`📊 Test summary saved: ${filename}`);
}

/**
 * Helper to measure API call duration
 */
export async function timedAPICall<T>(
  request: APIRequestContext,
  method: "get" | "post" | "put" | "delete",
  url: string,
  options?: { data?: unknown; headers?: Record<string, string> }
): Promise<{ response: Awaited<ReturnType<APIRequestContext[typeof method]>>; duration: number }> {
  const startTime = Date.now();
  const response = await request[method](url, options as never);
  const duration = Date.now() - startTime;
  return { response, duration };
}
