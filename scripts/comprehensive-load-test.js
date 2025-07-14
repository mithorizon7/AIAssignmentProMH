/**
 * Comprehensive Load Testing & Performance Profiling Suite
 * Tests realistic usage patterns for enterprise-scale deployment
 */

import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';

class LoadTestSuite {
  constructor() {
    this.baseUrl = process.env.TEST_URL || 'http://localhost:5000';
    this.results = {
      endpoints: {},
      system: {},
      bottlenecks: [],
      recommendations: []
    };
    
    // Realistic load test configuration based on enterprise usage
    this.config = {
      // Concurrent user scenarios
      lightLoad: { users: 50, duration: 30000 },    // 50 users for 30s
      mediumLoad: { users: 100, duration: 60000 },  // 100 users for 1 min
      heavyLoad: { users: 200, duration: 120000 },  // 200 users for 2 min
      peakLoad: { users: 500, duration: 60000 },    // 500 users for 1 min (stress test)
      
      // Performance thresholds
      thresholds: {
        login: { maxResponseTime: 1000, maxThroughput: 100 },
        pageLoad: { maxResponseTime: 2000, maxThroughput: 50 },
        submission: { maxResponseTime: 3000, maxThroughput: 20 },
        fileUpload: { maxResponseTime: 5000, maxThroughput: 10 },
        analytics: { maxResponseTime: 10000, maxThroughput: 5 }
      },
      
      // Test scenarios with realistic weights
      scenarios: {
        'student_workflow': {
          weight: 40,
          endpoints: [
            { url: '/api/auth/user', method: 'GET', weight: 30 },
            { url: '/api/assignments', method: 'GET', weight: 25 },
            { url: '/api/submissions', method: 'GET', weight: 20 },
            { url: '/api/csrf-token', method: 'GET', weight: 25 }
          ]
        },
        'instructor_workflow': {
          weight: 30,
          endpoints: [
            { url: '/api/assignments', method: 'GET', weight: 30 },
            { url: '/api/admin/submissions', method: 'GET', weight: 20 },
            { url: '/api/admin/stats', method: 'GET', weight: 15 },
            { url: '/api/admin/analytics', method: 'GET', weight: 10 }
          ]
        },
        'submission_processing': {
          weight: 20,
          endpoints: [
            { url: '/api/submissions', method: 'POST', weight: 60, body: { content: 'test code' } },
            { url: '/api/health', method: 'GET', weight: 40 }
          ]
        },
        'authentication': {
          weight: 10,
          endpoints: [
            { url: '/api/csrf-token', method: 'GET', weight: 50 },
            { url: '/api/auth/user', method: 'GET', weight: 50 }
          ]
        }
      }
    };
  }

  /**
   * Execute HTTP request with detailed performance tracking
   */
  async executeRequest(endpoint, scenario = 'default') {
    const startTime = performance.now();
    const startMemory = process.memoryUsage();
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      const response = await fetch(`${this.baseUrl}${endpoint.url}`, {
        method: endpoint.method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': `LoadTest-${scenario}`,
          'Cookie': 'connect.sid=test-session-' + Math.random().toString(36).substr(2, 9)
        },
        body: endpoint.body ? JSON.stringify(endpoint.body) : undefined,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      const endTime = performance.now();
      const endMemory = process.memoryUsage();
      
      const result = {
        success: true,
        statusCode: response.status,
        responseTime: endTime - startTime,
        memoryDelta: endMemory.heapUsed - startMemory.heapUsed,
        timestamp: new Date().toISOString(),
        scenario,
        endpoint: endpoint.url,
        method: endpoint.method
      };
      
      this.recordResult(result);
      return result;
      
    } catch (error) {
      const endTime = performance.now();
      const result = {
        success: false,
        statusCode: 0,
        responseTime: endTime - startTime,
        error: error.message,
        timestamp: new Date().toISOString(),
        scenario,
        endpoint: endpoint.url,
        method: endpoint.method
      };
      
      this.recordResult(result);
      return result;
    }
  }

  /**
   * Record and analyze test results
   */
  recordResult(result) {
    const key = `${result.method} ${result.endpoint}`;
    
    if (!this.results.endpoints[key]) {
      this.results.endpoints[key] = {
        requests: [],
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        avgResponseTime: 0,
        minResponseTime: Infinity,
        maxResponseTime: 0,
        p95ResponseTime: 0,
        throughput: 0
      };
    }
    
    const endpoint = this.results.endpoints[key];
    endpoint.requests.push(result);
    endpoint.totalRequests++;
    
    if (result.success && result.statusCode >= 200 && result.statusCode < 400) {
      endpoint.successfulRequests++;
    } else {
      endpoint.failedRequests++;
    }
    
    endpoint.minResponseTime = Math.min(endpoint.minResponseTime, result.responseTime);
    endpoint.maxResponseTime = Math.max(endpoint.maxResponseTime, result.responseTime);
  }

  /**
   * Run concurrent user simulation
   */
  async runConcurrentUsers(userCount, duration, testName) {
    console.log(`\n🚀 Starting ${testName}: ${userCount} concurrent users for ${duration/1000}s`);
    
    const startTime = Date.now();
    const userPromises = [];
    
    // Stagger user start times for realistic ramp-up
    const rampUpTime = Math.min(duration * 0.2, 10000); // 20% of duration or 10s max
    
    for (let i = 0; i < userCount; i++) {
      const delay = (i / userCount) * rampUpTime;
      
      const userPromise = new Promise(resolve => {
        setTimeout(async () => {
          await this.simulateUser(i + 1, duration - delay, testName);
          resolve();
        }, delay);
      });
      
      userPromises.push(userPromise);
    }
    
    // Monitor system resources during test
    const resourceMonitor = this.startResourceMonitoring(testName);
    
    await Promise.all(userPromises);
    
    clearInterval(resourceMonitor);
    
    const totalTime = Date.now() - startTime;
    console.log(`✅ ${testName} completed in ${(totalTime/1000).toFixed(2)}s`);
  }

  /**
   * Simulate realistic user behavior
   */
  async simulateUser(userId, duration, testName) {
    const endTime = Date.now() + duration;
    let requestCount = 0;
    
    while (Date.now() < endTime) {
      // Select scenario based on weights
      const scenario = this.selectScenario();
      const endpoint = this.selectEndpoint(scenario);
      
      await this.executeRequest(endpoint, `${testName}-${scenario.name}`);
      requestCount++;
      
      // Realistic delay between user actions (500ms - 3s)
      const delay = Math.random() * 2500 + 500;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    console.log(`User ${userId} completed ${requestCount} requests`);
  }

  /**
   * Select scenario based on weights
   */
  selectScenario() {
    const scenarios = Object.entries(this.config.scenarios);
    const totalWeight = scenarios.reduce((sum, [_, config]) => sum + config.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const [name, config] of scenarios) {
      random -= config.weight;
      if (random <= 0) {
        return { name, ...config };
      }
    }
    
    return { name: 'student_workflow', ...this.config.scenarios.student_workflow };
  }

  /**
   * Select endpoint within scenario based on weights
   */
  selectEndpoint(scenario) {
    const endpoints = scenario.endpoints;
    const totalWeight = endpoints.reduce((sum, ep) => sum + ep.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const endpoint of endpoints) {
      random -= endpoint.weight;
      if (random <= 0) {
        return endpoint;
      }
    }
    
    return endpoints[0];
  }

  /**
   * Monitor system resources during load test
   */
  startResourceMonitoring(testName) {
    const interval = 1000; // Monitor every second
    let samples = 0;
    
    return setInterval(() => {
      const memory = process.memoryUsage();
      const timestamp = new Date().toISOString();
      
      if (!this.results.system[testName]) {
        this.results.system[testName] = {
          memory: [],
          cpu: [],
          startTime: timestamp
        };
      }
      
      this.results.system[testName].memory.push({
        timestamp,
        rss: memory.rss / 1024 / 1024, // MB
        heapUsed: memory.heapUsed / 1024 / 1024, // MB
        heapTotal: memory.heapTotal / 1024 / 1024, // MB
        external: memory.external / 1024 / 1024 // MB
      });
      
      samples++;
      
      // Log resource usage every 10 seconds
      if (samples % 10 === 0) {
        console.log(`📊 Memory: RSS=${(memory.rss/1024/1024).toFixed(1)}MB, Heap=${(memory.heapUsed/1024/1024).toFixed(1)}MB`);
      }
    }, interval);
  }

  /**
   * Calculate performance statistics
   */
  calculateStatistics() {
    console.log('\n📊 Calculating performance statistics...');
    
    for (const [endpoint, data] of Object.entries(this.results.endpoints)) {
      if (data.requests.length === 0) continue;
      
      const responseTimes = data.requests.map(r => r.responseTime);
      const successRate = (data.successfulRequests / data.totalRequests) * 100;
      
      // Calculate percentiles
      const sorted = responseTimes.slice().sort((a, b) => a - b);
      const p50 = sorted[Math.floor(sorted.length * 0.5)];
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const p99 = sorted[Math.floor(sorted.length * 0.99)];
      
      data.avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      data.p50ResponseTime = p50;
      data.p95ResponseTime = p95;
      data.p99ResponseTime = p99;
      data.successRate = successRate;
      
      // Identify bottlenecks
      this.identifyBottlenecks(endpoint, data);
    }
  }

  /**
   * Identify performance bottlenecks
   */
  identifyBottlenecks(endpoint, data) {
    const bottlenecks = [];
    
    // Check response time thresholds
    if (data.p95ResponseTime > 2000) {
      bottlenecks.push({
        type: 'SLOW_RESPONSE',
        endpoint,
        severity: data.p95ResponseTime > 5000 ? 'HIGH' : 'MEDIUM',
        value: data.p95ResponseTime,
        threshold: 2000,
        description: `P95 response time (${data.p95ResponseTime.toFixed(0)}ms) exceeds threshold`
      });
    }
    
    // Check success rate
    if (data.successRate < 95) {
      bottlenecks.push({
        type: 'LOW_SUCCESS_RATE',
        endpoint,
        severity: data.successRate < 90 ? 'HIGH' : 'MEDIUM',
        value: data.successRate,
        threshold: 95,
        description: `Success rate (${data.successRate.toFixed(1)}%) below threshold`
      });
    }
    
    // Check for error patterns
    const errors = data.requests.filter(r => !r.success);
    if (errors.length > 0) {
      const errorTypes = [...new Set(errors.map(e => e.error))];
      bottlenecks.push({
        type: 'ERROR_PATTERN',
        endpoint,
        severity: 'MEDIUM',
        value: errors.length,
        description: `${errors.length} errors detected: ${errorTypes.join(', ')}`
      });
    }
    
    this.results.bottlenecks.push(...bottlenecks);
  }

  /**
   * Generate performance recommendations
   */
  generateRecommendations() {
    const recommendations = [];
    
    // Analyze bottlenecks and suggest solutions
    for (const bottleneck of this.results.bottlenecks) {
      switch (bottleneck.type) {
        case 'SLOW_RESPONSE':
          if (bottleneck.endpoint.includes('/api/admin')) {
            recommendations.push({
              priority: 'HIGH',
              category: 'DATABASE',
              description: 'Add database indexes for admin queries',
              action: 'CREATE INDEX ON relevant tables for admin endpoints'
            });
          } else if (bottleneck.endpoint.includes('/api/submissions')) {
            recommendations.push({
              priority: 'HIGH',
              category: 'ARCHITECTURE',
              description: 'Optimize submission processing pipeline',
              action: 'Implement streaming for large file uploads'
            });
          }
          break;
          
        case 'LOW_SUCCESS_RATE':
          recommendations.push({
            priority: 'CRITICAL',
            category: 'RELIABILITY',
            description: 'Fix reliability issues causing request failures',
            action: 'Implement circuit breaker pattern and retry logic'
          });
          break;
          
        case 'ERROR_PATTERN':
          recommendations.push({
            priority: 'HIGH',
            category: 'ERROR_HANDLING',
            description: 'Improve error handling and logging',
            action: 'Add comprehensive error tracking and alerting'
          });
          break;
      }
    }
    
    // Memory usage recommendations
    for (const [testName, systemData] of Object.entries(this.results.system)) {
      const memoryUsage = systemData.memory;
      if (memoryUsage.length > 0) {
        const maxHeap = Math.max(...memoryUsage.map(m => m.heapUsed));
        if (maxHeap > 500) { // 500MB
          recommendations.push({
            priority: 'MEDIUM',
            category: 'MEMORY',
            description: `High memory usage detected: ${maxHeap.toFixed(1)}MB`,
            action: 'Implement memory profiling and garbage collection optimization'
          });
        }
      }
    }
    
    this.results.recommendations = recommendations;
  }

  /**
   * Print comprehensive results
   */
  printResults() {
    console.log('\n' + '='.repeat(80));
    console.log('COMPREHENSIVE LOAD TESTING RESULTS');
    console.log('='.repeat(80));
    
    // Endpoint performance summary
    console.log('\n📊 ENDPOINT PERFORMANCE SUMMARY:');
    for (const [endpoint, data] of Object.entries(this.results.endpoints)) {
      if (data.totalRequests === 0) continue;
      
      console.log(`\n${endpoint}:`);
      console.log(`  Total Requests: ${data.totalRequests}`);
      console.log(`  Success Rate: ${data.successRate.toFixed(1)}%`);
      console.log(`  Avg Response: ${data.avgResponseTime.toFixed(0)}ms`);
      console.log(`  P95 Response: ${data.p95ResponseTime.toFixed(0)}ms`);
      console.log(`  Min/Max: ${data.minResponseTime.toFixed(0)}ms / ${data.maxResponseTime.toFixed(0)}ms`);
    }
    
    // System resource summary
    console.log('\n💻 SYSTEM RESOURCE SUMMARY:');
    for (const [testName, systemData] of Object.entries(this.results.system)) {
      const memory = systemData.memory;
      if (memory.length > 0) {
        const avgHeap = memory.reduce((sum, m) => sum + m.heapUsed, 0) / memory.length;
        const maxHeap = Math.max(...memory.map(m => m.heapUsed));
        console.log(`  ${testName}:`);
        console.log(`    Avg Memory: ${avgHeap.toFixed(1)}MB`);
        console.log(`    Peak Memory: ${maxHeap.toFixed(1)}MB`);
      }
    }
    
    // Bottlenecks
    if (this.results.bottlenecks.length > 0) {
      console.log('\n⚠️  PERFORMANCE BOTTLENECKS:');
      for (const bottleneck of this.results.bottlenecks) {
        console.log(`  [${bottleneck.severity}] ${bottleneck.description}`);
      }
    }
    
    // Recommendations
    if (this.results.recommendations.length > 0) {
      console.log('\n🎯 PERFORMANCE RECOMMENDATIONS:');
      for (const rec of this.results.recommendations) {
        console.log(`  [${rec.priority}] ${rec.category}: ${rec.description}`);
        console.log(`    Action: ${rec.action}`);
      }
    }
    
    // Overall assessment
    const totalRequests = Object.values(this.results.endpoints).reduce((sum, data) => sum + data.totalRequests, 0);
    const avgSuccessRate = Object.values(this.results.endpoints).reduce((sum, data) => sum + data.successRate, 0) / Object.keys(this.results.endpoints).length;
    
    console.log('\n🏆 OVERALL PERFORMANCE ASSESSMENT:');
    console.log(`  Total Requests Processed: ${totalRequests}`);
    console.log(`  Average Success Rate: ${avgSuccessRate.toFixed(1)}%`);
    console.log(`  Critical Bottlenecks: ${this.results.bottlenecks.filter(b => b.severity === 'HIGH').length}`);
    console.log(`  High Priority Recommendations: ${this.results.recommendations.filter(r => r.priority === 'CRITICAL' || r.priority === 'HIGH').length}`);
    
    if (avgSuccessRate > 95 && this.results.bottlenecks.filter(b => b.severity === 'HIGH').length === 0) {
      console.log('  🎉 Status: PRODUCTION READY - Performance meets enterprise standards');
    } else if (avgSuccessRate > 90) {
      console.log('  ⚠️  Status: NEEDS OPTIMIZATION - Some performance issues detected');
    } else {
      console.log('  ❌ Status: NOT READY - Critical performance issues require resolution');
    }
  }

  /**
   * Save detailed results to file
   */
  saveResults() {
    const filename = `load-test-results-${new Date().toISOString().split('T')[0]}.json`;
    fs.writeFileSync(filename, JSON.stringify(this.results, null, 2));
    console.log(`\n📁 Detailed results saved to: ${filename}`);
  }

  /**
   * Run complete load testing suite
   */
  async runComprehensiveTest() {
    console.log('🔥 STARTING COMPREHENSIVE LOAD TESTING SUITE');
    console.log('Target: Enterprise-scale performance validation\n');
    
    try {
      // Warm-up phase
      console.log('🔥 Phase 1: System warm-up...');
      await this.runConcurrentUsers(10, 10000, 'warmup');
      
      // Light load test
      console.log('\n📈 Phase 2: Light load testing...');
      await this.runConcurrentUsers(
        this.config.lightLoad.users, 
        this.config.lightLoad.duration, 
        'light_load'
      );
      
      // Medium load test
      console.log('\n📈 Phase 3: Medium load testing...');
      await this.runConcurrentUsers(
        this.config.mediumLoad.users, 
        this.config.mediumLoad.duration, 
        'medium_load'
      );
      
      // Heavy load test
      console.log('\n📈 Phase 4: Heavy load testing...');
      await this.runConcurrentUsers(
        this.config.heavyLoad.users, 
        this.config.heavyLoad.duration, 
        'heavy_load'
      );
      
      // Peak stress test
      console.log('\n💥 Phase 5: Peak stress testing...');
      await this.runConcurrentUsers(
        this.config.peakLoad.users, 
        this.config.peakLoad.duration, 
        'peak_stress'
      );
      
      // Analysis phase
      console.log('\n🔍 Phase 6: Performance analysis...');
      this.calculateStatistics();
      this.generateRecommendations();
      
      this.printResults();
      this.saveResults();
      
    } catch (error) {
      console.error('❌ Load testing failed:', error);
      throw error;
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const loadTest = new LoadTestSuite();
  loadTest.runComprehensiveTest().catch(console.error);
}

export default LoadTestSuite;