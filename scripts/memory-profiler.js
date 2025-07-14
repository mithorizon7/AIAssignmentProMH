/**
 * Memory Profiling and Performance Analysis Tool
 * Identifies memory leaks, hotspots, and optimization opportunities
 */

import fs from 'fs';
import { performance } from 'perf_hooks';

class MemoryProfiler {
  constructor() {
    this.samples = [];
    this.hotspots = [];
    this.leakDetection = {
      baseline: null,
      samples: [],
      threshold: 10 // MB growth threshold
    };
  }

  /**
   * Start continuous memory monitoring
   */
  startMonitoring(interval = 1000) {
    console.log('🔍 Starting memory profiling...');
    
    this.leakDetection.baseline = process.memoryUsage();
    
    return setInterval(() => {
      const memory = process.memoryUsage();
      const timestamp = Date.now();
      
      const sample = {
        timestamp,
        rss: memory.rss / 1024 / 1024, // MB
        heapUsed: memory.heapUsed / 1024 / 1024,
        heapTotal: memory.heapTotal / 1024 / 1024,
        external: memory.external / 1024 / 1024,
        arrayBuffers: memory.arrayBuffers / 1024 / 1024
      };
      
      this.samples.push(sample);
      this.leakDetection.samples.push(sample);
      
      // Detect memory leaks
      this.detectMemoryLeaks(sample);
      
      // Keep only recent samples (last 10 minutes)
      if (this.samples.length > 600) {
        this.samples.shift();
      }
      
      // Log significant memory changes
      if (this.samples.length > 1) {
        const prev = this.samples[this.samples.length - 2];
        const growth = sample.heapUsed - prev.heapUsed;
        
        if (Math.abs(growth) > 5) { // 5MB change
          console.log(`📊 Memory change: ${growth > 0 ? '+' : ''}${growth.toFixed(1)}MB (Heap: ${sample.heapUsed.toFixed(1)}MB)`);
        }
      }
      
    }, interval);
  }

  /**
   * Detect potential memory leaks
   */
  detectMemoryLeaks(currentSample) {
    if (!this.leakDetection.baseline) return;
    
    const growth = currentSample.heapUsed - this.leakDetection.baseline.heapUsed / 1024 / 1024;
    
    if (growth > this.leakDetection.threshold) {
      console.log(`⚠️  Potential memory leak detected: ${growth.toFixed(1)}MB growth from baseline`);
      
      // Update baseline if this appears to be the new normal
      if (this.leakDetection.samples.length > 60) { // After 1 minute
        const recentAvg = this.leakDetection.samples
          .slice(-30)
          .reduce((sum, s) => sum + s.heapUsed, 0) / 30;
        
        if (recentAvg > this.leakDetection.baseline.heapUsed / 1024 / 1024 + 20) {
          console.log('🔄 Updating memory baseline due to consistent high usage');
          this.leakDetection.baseline = process.memoryUsage();
          this.leakDetection.samples = [];
        }
      }
    }
  }

  /**
   * Profile specific function execution
   */
  async profileFunction(name, fn, ...args) {
    const startMemory = process.memoryUsage();
    const startTime = performance.now();
    
    try {
      const result = await fn(...args);
      
      const endTime = performance.now();
      const endMemory = process.memoryUsage();
      
      const profile = {
        name,
        duration: endTime - startTime,
        memoryDelta: {
          rss: (endMemory.rss - startMemory.rss) / 1024 / 1024,
          heapUsed: (endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024,
          external: (endMemory.external - startMemory.external) / 1024 / 1024
        },
        timestamp: new Date().toISOString()
      };
      
      this.hotspots.push(profile);
      
      // Log significant operations
      if (profile.duration > 100 || Math.abs(profile.memoryDelta.heapUsed) > 1) {
        console.log(`🔥 Hotspot detected: ${name}`);
        console.log(`   Duration: ${profile.duration.toFixed(2)}ms`);
        console.log(`   Memory: ${profile.memoryDelta.heapUsed > 0 ? '+' : ''}${profile.memoryDelta.heapUsed.toFixed(2)}MB`);
      }
      
      return result;
      
    } catch (error) {
      const endTime = performance.now();
      const endMemory = process.memoryUsage();
      
      this.hotspots.push({
        name,
        duration: endTime - startTime,
        error: error.message,
        memoryDelta: {
          rss: (endMemory.rss - startMemory.rss) / 1024 / 1024,
          heapUsed: (endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024
        },
        timestamp: new Date().toISOString()
      });
      
      throw error;
    }
  }

  /**
   * Generate memory usage report
   */
  generateReport() {
    if (this.samples.length === 0) {
      console.log('No memory samples collected');
      return;
    }
    
    const latest = this.samples[this.samples.length - 1];
    const earliest = this.samples[0];
    const duration = (latest.timestamp - earliest.timestamp) / 1000 / 60; // minutes
    
    // Calculate statistics
    const heapUsages = this.samples.map(s => s.heapUsed);
    const avgHeap = heapUsages.reduce((a, b) => a + b, 0) / heapUsages.length;
    const minHeap = Math.min(...heapUsages);
    const maxHeap = Math.max(...heapUsages);
    
    // Detect patterns
    const growth = latest.heapUsed - earliest.heapUsed;
    const growthRate = growth / duration; // MB per minute
    
    console.log('\n' + '='.repeat(60));
    console.log('MEMORY PROFILING REPORT');
    console.log('='.repeat(60));
    
    console.log(`\n📊 Memory Usage Summary (${duration.toFixed(1)} minutes):`);
    console.log(`   Current Heap: ${latest.heapUsed.toFixed(1)}MB`);
    console.log(`   Average Heap: ${avgHeap.toFixed(1)}MB`);
    console.log(`   Min/Max Heap: ${minHeap.toFixed(1)}MB / ${maxHeap.toFixed(1)}MB`);
    console.log(`   Total Growth: ${growth > 0 ? '+' : ''}${growth.toFixed(1)}MB`);
    console.log(`   Growth Rate: ${growthRate.toFixed(2)}MB/min`);
    
    // RSS vs Heap analysis
    console.log(`\n💾 Memory Breakdown:`);
    console.log(`   RSS (Total): ${latest.rss.toFixed(1)}MB`);
    console.log(`   Heap Used: ${latest.heapUsed.toFixed(1)}MB`);
    console.log(`   Heap Total: ${latest.heapTotal.toFixed(1)}MB`);
    console.log(`   External: ${latest.external.toFixed(1)}MB`);
    console.log(`   Array Buffers: ${latest.arrayBuffers.toFixed(1)}MB`);
    
    // Hotspot analysis
    if (this.hotspots.length > 0) {
      console.log(`\n🔥 Performance Hotspots:`);
      
      // Sort by duration descending
      const slowestOps = this.hotspots
        .filter(h => !h.error)
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 10);
      
      console.log('   Slowest Operations:');
      slowestOps.forEach((op, i) => {
        console.log(`   ${i + 1}. ${op.name}: ${op.duration.toFixed(2)}ms`);
      });
      
      // Sort by memory usage
      const memoryHogs = this.hotspots
        .filter(h => !h.error && h.memoryDelta.heapUsed > 0)
        .sort((a, b) => b.memoryDelta.heapUsed - a.memoryDelta.heapUsed)
        .slice(0, 5);
      
      if (memoryHogs.length > 0) {
        console.log('\n   Highest Memory Usage:');
        memoryHogs.forEach((op, i) => {
          console.log(`   ${i + 1}. ${op.name}: +${op.memoryDelta.heapUsed.toFixed(2)}MB`);
        });
      }
    }
    
    // Memory health assessment
    console.log(`\n🏥 Memory Health Assessment:`);
    
    if (growthRate > 1) {
      console.log('   ❌ HIGH RISK: Rapid memory growth detected');
      console.log('      Possible memory leak - investigate immediately');
    } else if (growthRate > 0.1) {
      console.log('   ⚠️  MEDIUM RISK: Gradual memory growth');
      console.log('      Monitor for extended periods');
    } else if (growthRate > -0.1) {
      console.log('   ✅ LOW RISK: Stable memory usage');
    } else {
      console.log('   ✅ EXCELLENT: Memory usage decreasing');
    }
    
    if (latest.heapUsed > 500) {
      console.log('   ⚠️  High memory usage detected (>500MB)');
      console.log('      Consider memory optimization strategies');
    } else if (latest.heapUsed > 200) {
      console.log('   ℹ️  Moderate memory usage (>200MB)');
    } else {
      console.log('   ✅ Low memory usage');
    }
    
    // Recommendations
    this.generateRecommendations(growthRate, latest.heapUsed, this.hotspots);
  }

  /**
   * Generate optimization recommendations
   */
  generateRecommendations(growthRate, currentHeap, hotspots) {
    console.log(`\n🎯 Optimization Recommendations:`);
    
    if (growthRate > 0.5) {
      console.log('   1. CRITICAL: Implement memory leak detection');
      console.log('      - Add heap snapshots before/after major operations');
      console.log('      - Review event listener cleanup');
      console.log('      - Check for circular references');
    }
    
    if (currentHeap > 300) {
      console.log('   2. HIGH: Reduce memory footprint');
      console.log('      - Implement object pooling for frequently created objects');
      console.log('      - Use streaming for large file operations');
      console.log('      - Consider lazy loading for large datasets');
    }
    
    const slowOps = hotspots.filter(h => h.duration > 100);
    if (slowOps.length > 5) {
      console.log('   3. MEDIUM: Optimize slow operations');
      console.log('      - Cache frequently computed results');
      console.log('      - Implement database query optimization');
      console.log('      - Consider async processing for heavy operations');
    }
    
    if (currentHeap < 100 && growthRate < 0.1) {
      console.log('   ✅ Memory usage is well optimized');
      console.log('      Continue current practices');
    }
  }

  /**
   * Save detailed profiling data
   */
  saveProfile() {
    const filename = `memory-profile-${new Date().toISOString().split('T')[0]}.json`;
    const data = {
      samples: this.samples,
      hotspots: this.hotspots,
      leakDetection: this.leakDetection,
      generatedAt: new Date().toISOString()
    };
    
    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
    console.log(`\n📁 Memory profile saved to: ${filename}`);
  }
}

export default MemoryProfiler;