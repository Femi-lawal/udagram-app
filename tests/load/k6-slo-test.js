// SLO-focused load tests
// Validates that the system meets SLO targets under load

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// SLO Metrics
const sloAvailability = new Rate('slo_availability');
const sloLatencyP50 = new Trend('slo_latency_p50', true);
const sloLatencyP95 = new Trend('slo_latency_p95', true);
const sloLatencyP99 = new Trend('slo_latency_p99', true);
const sloErrorBudget = new Counter('slo_errors');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const FEED_URL = __ENV.FEED_URL || 'http://localhost:8082';

// SLO Targets
const SLO_TARGETS = {
    availability: 0.999,        // 99.9% availability
    latencyP50: 100,            // 50th percentile under 100ms
    latencyP95: 300,            // 95th percentile under 300ms
    latencyP99: 1000,           // 99th percentile under 1s
    errorRate: 0.001,           // Less than 0.1% errors
};

export const options = {
    scenarios: {
        // Constant load to measure SLO compliance
        slo_validation: {
            executor: 'constant-arrival-rate',
            rate: 100,              // 100 requests per second
            timeUnit: '1s',
            duration: '10m',
            preAllocatedVUs: 50,
            maxVUs: 200,
        },
    },
    
    thresholds: {
        // SLO-based thresholds
        slo_availability: [`rate>${SLO_TARGETS.availability}`],
        http_req_duration: [
            `p(50)<${SLO_TARGETS.latencyP50}`,
            `p(95)<${SLO_TARGETS.latencyP95}`,
            `p(99)<${SLO_TARGETS.latencyP99}`,
        ],
        http_req_failed: [`rate<${SLO_TARGETS.errorRate}`],
    },
};

// Weighted endpoint selection (realistic traffic distribution)
const ENDPOINTS = [
    { path: '/health', weight: 5 },
    { path: '/api/v1/feed', weight: 60 },        // Most traffic goes to feed
    { path: '/api/v1/feed?page=1', weight: 15 },
    { path: '/api/v1/feed?page=2', weight: 10 },
    { path: '/metrics', weight: 10 },
];

function selectEndpoint() {
    const totalWeight = ENDPOINTS.reduce((sum, e) => sum + e.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const endpoint of ENDPOINTS) {
        random -= endpoint.weight;
        if (random <= 0) {
            return endpoint.path;
        }
    }
    return ENDPOINTS[0].path;
}

export default function() {
    const endpoint = selectEndpoint();
    const url = endpoint.startsWith('/api/v1/feed') ? `${FEED_URL}${endpoint}` : `${BASE_URL}${endpoint}`;
    
    const startTime = Date.now();
    const res = http.get(url);
    const duration = Date.now() - startTime;
    
    // Track SLO metrics
    const isSuccess = res.status >= 200 && res.status < 400;
    sloAvailability.add(isSuccess);
    
    if (!isSuccess) {
        sloErrorBudget.add(1);
    }
    
    // Track latency at different percentiles
    sloLatencyP50.add(duration);
    sloLatencyP95.add(duration);
    sloLatencyP99.add(duration);
    
    check(res, {
        'status is 2xx or 3xx': (r) => r.status >= 200 && r.status < 400,
        'response time OK': (r) => r.timings.duration < SLO_TARGETS.latencyP95,
        'has valid body': (r) => r.body && r.body.length > 0,
    });
}

export function handleSummary(data) {
    // Calculate SLO compliance
    const availability = data.metrics.slo_availability ? data.metrics.slo_availability.values.rate : 0;
    const p50 = data.metrics.http_req_duration ? data.metrics.http_req_duration.values['p(50)'] : 0;
    const p95 = data.metrics.http_req_duration ? data.metrics.http_req_duration.values['p(95)'] : 0;
    const p99 = data.metrics.http_req_duration ? data.metrics.http_req_duration.values['p(99)'] : 0;
    
    const sloCompliance = {
        availability: {
            target: SLO_TARGETS.availability,
            actual: availability,
            met: availability >= SLO_TARGETS.availability,
        },
        latencyP50: {
            target: SLO_TARGETS.latencyP50,
            actual: p50,
            met: p50 <= SLO_TARGETS.latencyP50,
        },
        latencyP95: {
            target: SLO_TARGETS.latencyP95,
            actual: p95,
            met: p95 <= SLO_TARGETS.latencyP95,
        },
        latencyP99: {
            target: SLO_TARGETS.latencyP99,
            actual: p99,
            met: p99 <= SLO_TARGETS.latencyP99,
        },
    };
    
    const allMet = Object.values(sloCompliance).every(s => s.met);
    
    return {
        'stdout': JSON.stringify({
            summary: 'SLO Validation Complete',
            allSLOsMet: allMet,
            compliance: sloCompliance,
            totalRequests: data.metrics.http_reqs ? data.metrics.http_reqs.values.count : 0,
            errorRate: data.metrics.http_req_failed ? data.metrics.http_req_failed.values.rate : 0,
        }, null, 2),
        'slo-report.json': JSON.stringify(sloCompliance, null, 2),
    };
}
