#!/usr/bin/env node

/**
 * Performance testing script for AIGrader production readiness
 * Tests system performance under various load conditions
 */

import http from 'http';
import https from 'https';
import fs from 'fs';
import { performance } from 'perf_hooks';

const CONFIG = {
  baseUrl: process.env.TEST_BASE_URL || 'http://localhost:5000',
  concurrency: parseInt(process.env.TEST_CONCURRENCY) || 10,
  duration: parseInt(process.env.TEST_DURATION) || 60, // seconds
  rampUp: parseInt(process.env.TEST_RAMP_UP) || 10, // seconds
  endpoints: [
    { path: '/api/health', method: 'GET', weight: 10 },
    { path: '/api/health/detailed', method: 'GET', weight: 2 },
    { path: '/api/auth/user', method: 'GET', weight: 5 },
    { path: '/api/assignments', method: 'GET', weight: 3 },
    { path: '/api/submissions', method: 'GET', weight: 2 }
  ]
};

class PerformanceTest {
  constructor() {
    this.results = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      startTime: 0,
      endTime: 0,
      responseTimes: [],
      errorCounts: {},
      statusCodes: {},
      throughput: 0,
      averageResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      concurrentUsers: 0,
      endpointStats: {}
    };
    
    this.activeRequests = 0;
    this.isRunning = false;
  }

  /**
   * Makes an HTTP request and measures performance
   */
  async makeRequest(endpoint) {
    const startTime = performance.now();
    
    return new Promise((resolve) => {
      const url = new URL(endpoint.path, CONFIG.baseUrl);
      const options = {
        method: endpoint.method,
        headers: {
          'User-Agent': 'AIGrader-Performance-Test/1.0',
          'Accept': 'application/json',
          'Connection': 'keep-alive'
        },
        timeout: 30000
      };

      const client = url.protocol === 'https:' ? https : http;
      
      const req = client.request(url, options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          const endTime = performance.now();
          const responseTime = endTime - startTime;
          
          this.recordResult(endpoint, res.statusCode, responseTime, null);
          resolve({ statusCode: res.statusCode, responseTime, data });
        });
      });

      req.on('error', (error) => {
        const endTime = performance.now();
        const responseTime = endTime - startTime;
        
        this.recordResult(endpoint, 0, responseTime, error);
        resolve({ statusCode: 0, responseTime, error });
      });

      req.on('timeout', () => {
        const endTime = performance.now();
        const responseTime = endTime - startTime;
        
        this.recordResult(endpoint, 0, responseTime, new Error('Request timeout'));
        req.destroy();
        resolve({ statusCode: 0, responseTime, error: new Error('Request timeout') });
      });

      req.end();
    });
  }

  /**
   * Records test results
   */
  recordResult(endpoint, statusCode, responseTime, error) {
    this.results.totalRequests++;
    this.results.responseTimes.push(responseTime);
    
    if (error) {
      this.results.failedRequests++;
      const errorType = error.code || error.message || 'Unknown error';
      this.results.errorCounts[errorType] = (this.results.errorCounts[errorType] || 0) + 1;
    } else {
      this.results.successfulRequests++;
    }
    
    this.results.statusCodes[statusCode] = (this.results.statusCodes[statusCode] || 0) + 1;
    
    // Track per-endpoint stats
    if (!this.results.endpointStats[endpoint.path]) {
      this.results.endpointStats[endpoint.path] = {
        requests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        responseTimes: [],
        errors: {}
      };
    }
    
    const endpointStats = this.results.endpointStats[endpoint.path];
    endpointStats.requests++;
    endpointStats.responseTimes.push(responseTime);
    
    if (error) {
      endpointStats.failedRequests++;
      const errorType = error.code || error.message || 'Unknown error';
      endpointStats.errors[errorType] = (endpointStats.errors[errorType] || 0) + 1;
    } else {
      endpointStats.successfulRequests++;
    }
  }

  /**
   * Selects a random endpoint based on weights
   */
  selectEndpoint() {
    const totalWeight = CONFIG.endpoints.reduce((sum, ep) => sum + ep.weight, 0);
    const random = Math.random() * totalWeight;
    
    let currentWeight = 0;
    for (const endpoint of CONFIG.endpoints) {
      currentWeight += endpoint.weight;
      if (random <= currentWeight) {
        return endpoint;
      }
    }
    
    return CONFIG.endpoints[0];
  }

  /**
   * Runs a single user simulation
   */
  async runUser(userId) {
    const userStartTime = performance.now();
    
    while (this.isRunning) {
      const endpoint = this.selectEndpoint();
      
      this.activeRequests++;
      
      try {
        await this.makeRequest(endpoint);
      } catch (error) {
        console.error(`User ${userId} error:`, error);
      }
      
      this.activeRequests--;
      
      // Small delay between requests to simulate real user behavior
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
    }
  }

  /**
   * Calculates percentile from response times
   */
  calculatePercentile(responseTimes, percentile) {
    const sorted = responseTimes.sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }

  /**
   * Calculates final statistics
   */
  calculateStats() {
    const duration = (this.results.endTime - this.results.startTime) / 1000; // seconds
    
    this.results.throughput = this.results.totalRequests / duration;
    this.results.averageResponseTime = this.results.responseTimes.reduce((sum, time) => sum + time, 0) / this.results.responseTimes.length;
    this.results.p95ResponseTime = this.calculatePercentile(this.results.responseTimes, 95);
    this.results.p99ResponseTime = this.calculatePercentile(this.results.responseTimes, 99);
    
    // Calculate per-endpoint stats
    for (const [path, stats] of Object.entries(this.results.endpointStats)) {
      stats.averageResponseTime = stats.responseTimes.reduce((sum, time) => sum + time, 0) / stats.responseTimes.length;
      stats.p95ResponseTime = this.calculatePercentile(stats.responseTimes, 95);
      stats.successRate = (stats.successfulRequests / stats.requests) * 100;
    }
  }

  /**
   * Prints test results
   */
  printResults() {
    console.log('\n🚀 AIGrader Performance Test Results\n');
    console.log('='.repeat(60));
    
    const duration = (this.results.endTime - this.results.startTime) / 1000;
    const successRate = (this.results.successfulRequests / this.results.totalRequests) * 100;
    
    console.log(`Test Duration: ${duration.toFixed(2)}s`);
    console.log(`Total Requests: ${this.results.totalRequests}`);
    console.log(`Successful Requests: ${this.results.successfulRequests}`);
    console.log(`Failed Requests: ${this.results.failedRequests}`);
    console.log(`Success Rate: ${successRate.toFixed(2)}%`);
    console.log(`Throughput: ${this.results.throughput.toFixed(2)} requests/second`);
    console.log(`Average Response Time: ${this.results.averageResponseTime.toFixed(2)}ms`);
    console.log(`95th Percentile: ${this.results.p95ResponseTime.toFixed(2)}ms`);
    console.log(`99th Percentile: ${this.results.p99ResponseTime.toFixed(2)}ms`);
    
    console.log('\n📊 Status Code Distribution:');
    for (const [code, count] of Object.entries(this.results.statusCodes)) {
      const percentage = (count / this.results.totalRequests) * 100;
      console.log(`  ${code}: ${count} (${percentage.toFixed(1)}%)`);
    }
    
    if (Object.keys(this.results.errorCounts).length > 0) {
      console.log('\n❌ Error Distribution:');
      for (const [error, count] of Object.entries(this.results.errorCounts)) {
        const percentage = (count / this.results.totalRequests) * 100;
        console.log(`  ${error}: ${count} (${percentage.toFixed(1)}%)`);
      }
    }
    
    console.log('\n🎯 Endpoint Performance:');
    for (const [path, stats] of Object.entries(this.results.endpointStats)) {
      console.log(`  ${path}:`);
      console.log(`    Requests: ${stats.requests}`);
      console.log(`    Success Rate: ${stats.successRate.toFixed(2)}%`);
      console.log(`    Avg Response Time: ${stats.averageResponseTime.toFixed(2)}ms`);
      console.log(`    95th Percentile: ${stats.p95ResponseTime.toFixed(2)}ms`);
    }
    
    console.log('\n🏆 Performance Assessment:');
    
    // Performance benchmarks
    const benchmarks = {
      throughput: { good: 100, warning: 50 },
      averageResponseTime: { good: 500, warning: 1000 },
      p95ResponseTime: { good: 1000, warning: 2000 },
      successRate: { good: 99, warning: 95 }
    };
    
    const assessments = [
      {
        metric: 'Throughput',
        value: this.results.throughput,
        unit: 'req/s',
        benchmark: benchmarks.throughput,
        higher: true
      },
      {
        metric: 'Average Response Time',
        value: this.results.averageResponseTime,
        unit: 'ms',
        benchmark: benchmarks.averageResponseTime,
        higher: false
      },
      {
        metric: '95th Percentile',
        value: this.results.p95ResponseTime,
        unit: 'ms',
        benchmark: benchmarks.p95ResponseTime,
        higher: false
      },
      {
        metric: 'Success Rate',
        value: successRate,
        unit: '%',
        benchmark: benchmarks.successRate,
        higher: true
      }
    ];
    
    for (const assessment of assessments) {
      const status = assessment.higher
        ? (assessment.value >= assessment.benchmark.good ? '✅ GOOD' : 
           assessment.value >= assessment.benchmark.warning ? '⚠️ WARNING' : '❌ POOR')
        : (assessment.value <= assessment.benchmark.good ? '✅ GOOD' : 
           assessment.value <= assessment.benchmark.warning ? '⚠️ WARNING' : '❌ POOR');
      
      console.log(`  ${assessment.metric}: ${assessment.value.toFixed(2)}${assessment.unit} ${status}`);
    }
  }

  /**
   * Runs the performance test
   */
  async run() {
    console.log('🚀 Starting AIGrader Performance Test');
    console.log(`Base URL: ${CONFIG.baseUrl}`);
    console.log(`Concurrency: ${CONFIG.concurrency} users`);
    console.log(`Duration: ${CONFIG.duration} seconds`);
    console.log(`Ramp-up: ${CONFIG.rampUp} seconds`);
    console.log('\nStarting test...\n');
    
    this.results.startTime = performance.now();
    this.isRunning = true;
    
    // Start users with ramp-up
    const userPromises = [];
    for (let i = 0; i < CONFIG.concurrency; i++) {
      setTimeout(() => {
        userPromises.push(this.runUser(i + 1));
      }, (i / CONFIG.concurrency) * CONFIG.rampUp * 1000);
    }
    
    // Run for specified duration
    setTimeout(() => {
      this.isRunning = false;
      this.results.endTime = performance.now();
    }, CONFIG.duration * 1000);
    
    // Wait for all users to complete
    await Promise.all(userPromises);
    
    // Calculate final statistics
    this.calculateStats();
    
    // Print results
    this.printResults();
    
    // Save results to file
    const resultsFile = `performance-results-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    fs.writeFileSync(resultsFile, JSON.stringify(this.results, null, 2));
    console.log(`\n📁 Results saved to: ${resultsFile}`);
  }
}

// Run the test
const test = new PerformanceTest();
test.run().catch(console.error);

export default PerformanceTest;