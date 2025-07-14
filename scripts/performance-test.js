/**
 * Performance testing script for AIGrader production readiness
 * Tests system performance under various load conditions
 */

import fs from 'fs';
import path from 'path';

class PerformanceTest {
  constructor() {
    this.baseUrl = process.env.TEST_URL || 'http://localhost:5000';
    this.results = [];
    this.config = {
      // Test configuration for scalability assessment
      totalUsers: 100,           // Simulate 100 concurrent users
      testDuration: 60000,       // Run for 1 minute
      rampUpTime: 10000,         // Ramp up over 10 seconds
      
      // Endpoint weights (simulating real usage patterns)
      endpoints: {
        'GET /api/health': { weight: 5, method: 'GET' },
        'GET /api/assignments': { weight: 20, method: 'GET', requiresAuth: true },
        'GET /api/submissions': { weight: 15, method: 'GET', requiresAuth: true },
        'POST /api/submissions': { weight: 10, method: 'POST', requiresAuth: true },
        'GET /api/auth/user': { weight: 25, method: 'GET', requiresAuth: true },
        'GET /api/csrf-token': { weight: 25, method: 'GET' }
      }
    };
  }

  /**
   * Makes an HTTP request and measures performance
   */
  async makeRequest(endpoint) {
    const startTime = Date.now();
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
      
      const response = await fetch(`${this.baseUrl}${endpoint.url}`, {
        method: endpoint.method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(endpoint.requiresAuth && {
            'Cookie': 'connect.sid=test-session'
          })
        },
        body: endpoint.body ? JSON.stringify(endpoint.body) : undefined,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;
      
      this.recordResult(endpoint.url, response.status, responseTime);
      return { success: true, responseTime, status: response.status };
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.recordResult(endpoint.url, 0, responseTime, error.message);
      return { success: false, responseTime, error: error.message };
    }
  }

  /**
   * Records test results
   */
  recordResult(endpoint, statusCode, responseTime, error) {
    this.results.push({
      endpoint,
      statusCode,
      responseTime,
      timestamp: new Date().toISOString(),
      error: error || null
    });
  }

  /**
   * Selects a random endpoint based on weights
   */
  selectEndpoint() {
    const endpoints = Object.entries(this.config.endpoints);
    const totalWeight = endpoints.reduce((sum, [_, config]) => sum + config.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const [url, config] of endpoints) {
      random -= config.weight;
      if (random <= 0) {
        return { url, ...config };
      }
    }
    
    // Fallback to health check
    return { url: '/api/health', method: 'GET', weight: 1 };
  }

  /**
   * Runs a single user simulation
   */
  async runUser(userId) {
    const startTime = Date.now();
    const endTime = startTime + this.config.testDuration;
    
    console.log(`User ${userId} starting test simulation`);
    
    while (Date.now() < endTime) {
      const endpoint = this.selectEndpoint();
      await this.makeRequest(endpoint);
      
      // Random delay between requests (50-500ms)
      const delay = Math.random() * 450 + 50;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    console.log(`User ${userId} completed simulation`);
  }

  /**
   * Calculates percentile from response times
   */
  calculatePercentile(responseTimes, percentile) {
    const sorted = responseTimes.slice().sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }

  /**
   * Calculates final statistics
   */
  calculateStats() {
    if (this.results.length === 0) {
      return { error: 'No test results available' };
    }

    const responseTimes = this.results.map(r => r.responseTime);
    const successfulRequests = this.results.filter(r => r.statusCode >= 200 && r.statusCode < 400);
    const errorRequests = this.results.filter(r => r.error || r.statusCode >= 400);
    
    return {
      totalRequests: this.results.length,
      successfulRequests: successfulRequests.length,
      errorRequests: errorRequests.length,
      successRate: (successfulRequests.length / this.results.length * 100).toFixed(2),
      
      // Response time statistics
      avgResponseTime: (responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length).toFixed(2),
      minResponseTime: Math.min(...responseTimes),
      maxResponseTime: Math.max(...responseTimes),
      p50ResponseTime: this.calculatePercentile(responseTimes, 50),
      p95ResponseTime: this.calculatePercentile(responseTimes, 95),
      p99ResponseTime: this.calculatePercentile(responseTimes, 99),
      
      // Throughput
      requestsPerSecond: (this.results.length / (this.config.testDuration / 1000)).toFixed(2),
      
      // Error analysis
      errorRate: (errorRequests.length / this.results.length * 100).toFixed(2),
      timeoutErrors: errorRequests.filter(r => r.error && r.error.includes('timeout')).length,
      
      // Performance grades
      performanceGrade: this.getPerformanceGrade(responseTimes)
    };
  }

  /**
   * Assigns performance grade based on response times
   */
  getPerformanceGrade(responseTimes) {
    const p95 = this.calculatePercentile(responseTimes, 95);
    
    if (p95 < 100) return 'A+ (Excellent)';
    if (p95 < 200) return 'A (Very Good)';
    if (p95 < 500) return 'B (Good)';
    if (p95 < 1000) return 'C (Acceptable)';
    if (p95 < 2000) return 'D (Poor)';
    return 'F (Unacceptable)';
  }

  /**
   * Prints test results
   */
  printResults() {
    const stats = this.calculateStats();
    
    console.log('\n' + '='.repeat(60));
    console.log('PERFORMANCE TEST RESULTS');
    console.log('='.repeat(60));
    
    console.log(`📊 Test Configuration:`);
    console.log(`   Users: ${this.config.totalUsers}`);
    console.log(`   Duration: ${this.config.testDuration / 1000}s`);
    console.log(`   Target: Tens of thousands of students scalability`);
    
    console.log(`\n📈 Request Statistics:`);
    console.log(`   Total Requests: ${stats.totalRequests}`);
    console.log(`   Success Rate: ${stats.successRate}%`);
    console.log(`   Error Rate: ${stats.errorRate}%`);
    console.log(`   Requests/sec: ${stats.requestsPerSecond}`);
    
    console.log(`\n⚡ Response Time Analysis:`);
    console.log(`   Average: ${stats.avgResponseTime}ms`);
    console.log(`   50th percentile: ${stats.p50ResponseTime}ms`);
    console.log(`   95th percentile: ${stats.p95ResponseTime}ms`);
    console.log(`   99th percentile: ${stats.p99ResponseTime}ms`);
    console.log(`   Min/Max: ${stats.minResponseTime}ms / ${stats.maxResponseTime}ms`);
    
    console.log(`\n🎯 Performance Grade: ${stats.performanceGrade}`);
    
    if (stats.errorRate > 5) {
      console.log(`\n⚠️  High Error Rate Warning: ${stats.errorRate}%`);
      console.log(`   This indicates potential scalability issues`);
    }
    
    if (stats.p95ResponseTime > 1000) {
      console.log(`\n⚠️  Slow Response Warning: P95 = ${stats.p95ResponseTime}ms`);
      console.log(`   This may not scale to tens of thousands of users`);
    }
    
    console.log('\n📋 Scalability Assessment:');
    if (stats.successRate > 95 && stats.p95ResponseTime < 500) {
      console.log('   ✅ PASS - System shows good scalability potential');
    } else if (stats.successRate > 90 && stats.p95ResponseTime < 1000) {
      console.log('   ⚠️  PARTIAL - System needs optimization for full scale');
    } else {
      console.log('   ❌ FAIL - System requires significant improvements for scale');
    }
    
    // Save detailed results
    const filename = `performance-results-${new Date().toISOString()}.json`;
    fs.writeFileSync(filename, JSON.stringify({
      config: this.config,
      stats,
      detailedResults: this.results
    }, null, 2));
    
    console.log(`\n📁 Detailed results saved to: ${filename}`);
  }

  /**
   * Runs the performance test
   */
  async run() {
    console.log('🚀 Starting AIGrader Performance Test');
    console.log(`   Testing scalability for ${this.config.totalUsers} concurrent users`);
    console.log(`   Target: Tens of thousands of students capacity\n`);
    
    const startTime = Date.now();
    
    // Create user promises with staggered start times
    const userPromises = [];
    for (let i = 0; i < this.config.totalUsers; i++) {
      const delay = (i / this.config.totalUsers) * this.config.rampUpTime;
      
      const userPromise = new Promise(resolve => {
        setTimeout(async () => {
          await this.runUser(i + 1);
          resolve();
        }, delay);
      });
      
      userPromises.push(userPromise);
    }
    
    // Wait for all users to complete
    await Promise.all(userPromises);
    
    const totalTime = Date.now() - startTime;
    console.log(`\n✅ Test completed in ${(totalTime / 1000).toFixed(2)}s`);
    
    this.printResults();
  }
}

// Check if running directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const test = new PerformanceTest();
  test.run().catch(console.error);
}

export default PerformanceTest;