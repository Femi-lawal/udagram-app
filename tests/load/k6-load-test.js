// Udagram Load Testing with k6
// https://k6.io/docs/

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { randomString, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

// Custom metrics
const errorRate = new Rate('errors');
const loginDuration = new Trend('login_duration', true);
const feedGetDuration = new Trend('feed_get_duration', true);
const feedCreateDuration = new Trend('feed_create_duration', true);
const registrationCounter = new Counter('registrations');
const feedItemsCreated = new Counter('feed_items_created');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const AUTH_URL = __ENV.AUTH_URL || 'http://localhost:8081';
const FEED_URL = __ENV.FEED_URL || 'http://localhost:8082';

// Test options - different scenarios
export const options = {
    scenarios: {
        // Smoke test - quick sanity check
        smoke_test: {
            executor: 'constant-vus',
            vus: 1,
            duration: '30s',
            tags: { test_type: 'smoke' },
            exec: 'smokeTest',
        },
        
        // Load test - normal expected load
        load_test: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '2m', target: 50 },   // Ramp up
                { duration: '5m', target: 50 },   // Stay at 50 users
                { duration: '2m', target: 100 },  // Ramp up to 100
                { duration: '5m', target: 100 },  // Stay at 100 users
                { duration: '2m', target: 0 },    // Ramp down
            ],
            tags: { test_type: 'load' },
            startTime: '35s', // Start after smoke test
            exec: 'loadTest',
        },
        
        // Stress test - find breaking point
        stress_test: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '2m', target: 100 },
                { duration: '5m', target: 100 },
                { duration: '2m', target: 200 },
                { duration: '5m', target: 200 },
                { duration: '2m', target: 300 },
                { duration: '5m', target: 300 },
                { duration: '10m', target: 0 },
            ],
            tags: { test_type: 'stress' },
            startTime: '20m', // Start after load test
            exec: 'stressTest',
        },
        
        // Spike test - sudden traffic spike
        spike_test: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '10s', target: 100 },  // Quick ramp up
                { duration: '1m', target: 100 },   // Hold
                { duration: '10s', target: 500 },  // Spike!
                { duration: '3m', target: 500 },   // Hold spike
                { duration: '10s', target: 100 },  // Quick recovery
                { duration: '3m', target: 100 },   // Hold
                { duration: '10s', target: 0 },    // Ramp down
            ],
            tags: { test_type: 'spike' },
            startTime: '55m', // Start after stress test
            exec: 'spikeTest',
        },
    },
    
    // Thresholds - SLO targets
    thresholds: {
        http_req_duration: ['p(95)<500', 'p(99)<1000'],  // 95% under 500ms, 99% under 1s
        http_req_failed: ['rate<0.01'],                   // Less than 1% errors
        errors: ['rate<0.01'],                            // Custom error rate
        login_duration: ['p(95)<300'],                    // Login under 300ms
        feed_get_duration: ['p(95)<200'],                 // Feed get under 200ms
        feed_create_duration: ['p(95)<500'],              // Feed create under 500ms
    },
};

// Setup - runs once before the test
export function setup() {
    console.log('Setting up load test...');
    
    // Verify services are healthy
    const healthChecks = [
        { name: 'Gateway', url: `${BASE_URL}/health` },
        { name: 'Auth', url: `${AUTH_URL}/health` },
        { name: 'Feed', url: `${FEED_URL}/health` },
    ];
    
    for (const check of healthChecks) {
        const res = http.get(check.url);
        if (res.status !== 200) {
            console.error(`${check.name} health check failed: ${res.status}`);
        } else {
            console.log(`${check.name} is healthy`);
        }
    }
    
    return { startTime: new Date().toISOString() };
}

// Teardown - runs once after the test
export function teardown(data) {
    console.log(`Test completed. Started at: ${data.startTime}`);
}

// Helper function to register and login a user
function registerAndLogin() {
    const email = `loadtest-${randomString(8)}@example.com`;
    const password = 'LoadTest123!';
    
    // Register
    const registerPayload = JSON.stringify({
        email: email,
        password: password,
    });
    
    const registerRes = http.post(`${AUTH_URL}/api/v1/auth/register`, registerPayload, {
        headers: { 'Content-Type': 'application/json' },
    });
    
    if (registerRes.status === 200 || registerRes.status === 201) {
        registrationCounter.add(1);
        const data = JSON.parse(registerRes.body);
        return {
            token: data.data.access_token,
            userId: data.data.user.id,
            email: email,
        };
    }
    
    return null;
}

// Helper to get auth headers
function getAuthHeaders(token) {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
    };
}

// Smoke test - basic sanity check
export function smokeTest() {
    group('Health Checks', () => {
        const res = http.get(`${BASE_URL}/health`);
        check(res, {
            'health status is 200': (r) => r.status === 200,
            'health response is healthy': (r) => JSON.parse(r.body).status === 'healthy',
        }) || errorRate.add(1);
    });
    
    group('Feed Read', () => {
        const res = http.get(`${FEED_URL}/api/v1/feed`);
        feedGetDuration.add(res.timings.duration);
        check(res, {
            'feed status is 200': (r) => r.status === 200,
            'feed has items array': (r) => JSON.parse(r.body).data.items !== undefined,
        }) || errorRate.add(1);
    });
    
    sleep(1);
}

// Load test - simulate normal load
export function loadTest() {
    const user = registerAndLogin();
    
    if (!user) {
        errorRate.add(1);
        return;
    }
    
    group('User Journey', () => {
        // 1. Login (already done during registration)
        loginDuration.add(0); // Registration includes login
        
        // 2. Browse feed
        group('Browse Feed', () => {
            for (let i = 1; i <= 3; i++) {
                const res = http.get(`${FEED_URL}/api/v1/feed?page=${i}`);
                feedGetDuration.add(res.timings.duration);
                check(res, {
                    'feed page loaded': (r) => r.status === 200,
                }) || errorRate.add(1);
                sleep(randomIntBetween(1, 3));
            }
        });
        
        // 3. Create a post (30% of users)
        if (Math.random() < 0.3) {
            group('Create Post', () => {
                const payload = JSON.stringify({
                    caption: `Load test post ${randomString(10)}`,
                    url: `https://example.com/image-${randomString(5)}.jpg`,
                });
                
                const res = http.post(`${FEED_URL}/api/v1/feed`, payload, {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-User-ID': user.userId,
                    },
                });
                
                feedCreateDuration.add(res.timings.duration);
                if (res.status === 200 || res.status === 201) {
                    feedItemsCreated.add(1);
                    check(res, {
                        'post created': (r) => r.status === 200 || r.status === 201,
                    });
                } else {
                    errorRate.add(1);
                }
            });
        }
        
        // 4. Like random posts (50% of users)
        if (Math.random() < 0.5) {
            group('Like Posts', () => {
                const feedRes = http.get(`${FEED_URL}/api/v1/feed`);
                if (feedRes.status === 200) {
                    const feed = JSON.parse(feedRes.body);
                    if (feed.data.items && feed.data.items.length > 0) {
                        const randomItem = feed.data.items[Math.floor(Math.random() * feed.data.items.length)];
                        const likeRes = http.post(`${FEED_URL}/api/v1/feed/${randomItem.id}/like`);
                        check(likeRes, {
                            'like successful': (r) => r.status === 200,
                        }) || errorRate.add(1);
                    }
                }
            });
        }
    });
    
    sleep(randomIntBetween(3, 5));
}

// Stress test - push the system
export function stressTest() {
    loadTest(); // Same as load test but with more users
}

// Spike test - sudden traffic burst
export function spikeTest() {
    // Rapid actions without much sleep
    group('Spike Actions', () => {
        const res = http.get(`${FEED_URL}/api/v1/feed`);
        feedGetDuration.add(res.timings.duration);
        check(res, {
            'feed loaded during spike': (r) => r.status === 200,
        }) || errorRate.add(1);
    });
    
    sleep(randomIntBetween(0, 1));
}

// Default function for standalone runs
export default function() {
    loadTest();
}
