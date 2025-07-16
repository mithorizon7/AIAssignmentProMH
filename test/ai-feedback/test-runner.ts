/**
 * AI Feedback Test Suite Runner
 * 
 * Comprehensive test runner for the AI feedback system that executes
 * all test suites and provides detailed reporting.
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

interface TestSuite {
  name: string;
  file: string;
  description: string;
  category: 'unit' | 'integration' | 'e2e' | 'performance' | 'security';
  priority: 'high' | 'medium' | 'low';
  estimatedDuration: number; // in minutes
}

interface TestResult {
  suite: string;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  coverage?: number;
  errors: string[];
}

interface TestReport {
  timestamp: string;
  totalSuites: number;
  totalTests: number;
  totalPassed: number;
  totalFailed: number;
  totalSkipped: number;
  totalDuration: number;
  overallCoverage: number;
  suiteResults: TestResult[];
  summary: {
    status: 'PASS' | 'FAIL' | 'PARTIAL';
    criticalFailures: string[];
    recommendations: string[];
  };
}

class AIFeedbackTestRunner {
  private testSuites: TestSuite[] = [
    {
      name: 'Comprehensive AI Feedback Tests',
      file: 'comprehensive-test-suite.test.ts',
      description: 'End-to-end tests covering complete AI feedback pipeline',
      category: 'e2e',
      priority: 'high',
      estimatedDuration: 15
    },
    {
      name: 'Gemini Adapter Tests',
      file: 'gemini-adapter.test.ts',
      description: 'Unit tests for Gemini AI adapter functionality',
      category: 'unit',
      priority: 'high',
      estimatedDuration: 8
    },
    {
      name: 'Queue System Tests',
      file: 'queue-system.test.ts',
      description: 'Tests for BullMQ queue processing and reliability',
      category: 'integration',
      priority: 'high',
      estimatedDuration: 10
    },
    {
      name: 'Instructor Workflow Tests',
      file: 'instructor-workflow.test.ts',
      description: 'Tests for instructor-specific AI feedback workflows',
      category: 'e2e',
      priority: 'high',
      estimatedDuration: 12
    },
    {
      name: 'Student Workflow Tests',
      file: 'student-workflow.test.ts',
      description: 'Tests for student-specific AI feedback workflows',
      category: 'e2e',
      priority: 'high',
      estimatedDuration: 10
    },
    {
      name: 'Performance and Reliability Tests',
      file: 'performance-reliability.test.ts',
      description: 'Performance, scalability, and reliability testing',
      category: 'performance',
      priority: 'medium',
      estimatedDuration: 20
    },
    {
      name: 'Security and Compliance Tests',
      file: 'security-compliance.test.ts',
      description: 'Security measures and regulatory compliance testing',
      category: 'security',
      priority: 'high',
      estimatedDuration: 15
    }
  ];

  private results: TestResult[] = [];

  async runAllTests(options: {
    parallel?: boolean;
    category?: string;
    priority?: string;
    coverage?: boolean;
    verbose?: boolean;
  } = {}): Promise<TestReport> {
    console.log('🚀 Starting AI Feedback System Test Suite');
    console.log('================================================');
    
    const startTime = Date.now();
    let filteredSuites = this.testSuites;

    // Filter by category
    if (options.category) {
      filteredSuites = filteredSuites.filter(suite => suite.category === options.category);
    }

    // Filter by priority
    if (options.priority) {
      filteredSuites = filteredSuites.filter(suite => suite.priority === options.priority);
    }

    console.log(`📋 Running ${filteredSuites.length} test suites`);
    
    if (options.parallel && filteredSuites.length > 1) {
      await this.runTestsInParallel(filteredSuites, options);
    } else {
      await this.runTestsSequentially(filteredSuites, options);
    }

    const totalDuration = Date.now() - startTime;
    return this.generateReport(totalDuration);
  }

  private async runTestsSequentially(suites: TestSuite[], options: any): Promise<void> {
    for (const suite of suites) {
      console.log(`\n🧪 Running: ${suite.name}`);
      console.log(`   ${suite.description}`);
      console.log(`   Estimated duration: ${suite.estimatedDuration} minutes`);
      
      const result = await this.runSingleTest(suite, options);
      this.results.push(result);
      
      this.printSuiteResult(result);
    }
  }

  private async runTestsInParallel(suites: TestSuite[], options: any): Promise<void> {
    console.log('\n⚡ Running tests in parallel...');
    
    const promises = suites.map(async (suite) => {
      const result = await this.runSingleTest(suite, options);
      this.results.push(result);
      return result;
    });

    const results = await Promise.all(promises);
    
    results.forEach(result => this.printSuiteResult(result));
  }

  private async runSingleTest(suite: TestSuite, options: any): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      const vitestArgs = [
        'test',
        `test/ai-feedback/${suite.file}`,
        '--reporter=json'
      ];

      if (options.coverage) {
        vitestArgs.push('--coverage');
      }

      if (options.verbose) {
        vitestArgs.push('--verbose');
      }

      const result = await this.runVitest(vitestArgs);
      const duration = Date.now() - startTime;

      return {
        suite: suite.name,
        passed: result.passed || 0,
        failed: result.failed || 0,
        skipped: result.skipped || 0,
        duration: Math.round(duration / 1000),
        coverage: result.coverage,
        errors: result.errors || []
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      return {
        suite: suite.name,
        passed: 0,
        failed: 1,
        skipped: 0,
        duration: Math.round(duration / 1000),
        errors: [error instanceof Error ? error.message : String(error)]
      };
    }
  }

  private runVitest(args: string[]): Promise<any> {
    return new Promise((resolve, reject) => {
      const vitest = spawn('npx', ['vitest', ...args], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd()
      });

      let stdout = '';
      let stderr = '';

      vitest.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      vitest.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      vitest.on('close', (code) => {
        try {
          // Parse JSON output from vitest
          const result = JSON.parse(stdout);
          resolve(result);
        } catch (parseError) {
          // Fallback parsing for non-JSON output
          const passed = (stdout.match(/✓/g) || []).length;
          const failed = (stdout.match(/✗/g) || []).length;
          const skipped = (stdout.match(/↓/g) || []).length;

          resolve({
            passed,
            failed,
            skipped,
            errors: stderr ? [stderr] : []
          });
        }
      });

      vitest.on('error', (error) => {
        reject(error);
      });
    });
  }

  private printSuiteResult(result: TestResult): void {
    const status = result.failed === 0 ? '✅ PASS' : '❌ FAIL';
    const totalTests = result.passed + result.failed + result.skipped;
    
    console.log(`   ${status} ${result.suite}`);
    console.log(`   Tests: ${totalTests} (${result.passed} passed, ${result.failed} failed, ${result.skipped} skipped)`);
    console.log(`   Duration: ${result.duration}s`);
    
    if (result.coverage) {
      console.log(`   Coverage: ${result.coverage}%`);
    }
    
    if (result.errors.length > 0) {
      console.log(`   Errors: ${result.errors.length}`);
      result.errors.forEach(error => {
        console.log(`     - ${error}`);
      });
    }
  }

  private generateReport(totalDuration: number): TestReport {
    const totalTests = this.results.reduce((sum, r) => sum + r.passed + r.failed + r.skipped, 0);
    const totalPassed = this.results.reduce((sum, r) => sum + r.passed, 0);
    const totalFailed = this.results.reduce((sum, r) => sum + r.failed, 0);
    const totalSkipped = this.results.reduce((sum, r) => sum + r.skipped, 0);
    
    const coverageResults = this.results.filter(r => r.coverage !== undefined);
    const overallCoverage = coverageResults.length > 0
      ? Math.round(coverageResults.reduce((sum, r) => sum + (r.coverage || 0), 0) / coverageResults.length)
      : 0;

    const criticalFailures: string[] = [];
    const recommendations: string[] = [];

    // Analyze results for critical failures and recommendations
    this.results.forEach(result => {
      if (result.failed > 0) {
        const highPrioritySuite = this.testSuites.find(s => s.name === result.suite && s.priority === 'high');
        if (highPrioritySuite) {
          criticalFailures.push(`High priority suite failed: ${result.suite}`);
        }
      }

      if (result.coverage !== undefined && result.coverage < 80) {
        recommendations.push(`Improve test coverage for ${result.suite} (currently ${result.coverage}%)`);
      }

      if (result.duration > 300) { // 5 minutes
        recommendations.push(`Optimize performance tests in ${result.suite} (took ${result.duration}s)`);
      }
    });

    // Generate overall recommendations
    if (totalFailed === 0 && totalPassed > 0) {
      recommendations.push('All tests passing! Consider adding more edge case tests.');
    }

    if (overallCoverage < 90) {
      recommendations.push(`Increase overall test coverage to 90%+ (currently ${overallCoverage}%)`);
    }

    const status = totalFailed === 0 ? 'PASS' : criticalFailures.length > 0 ? 'FAIL' : 'PARTIAL';

    return {
      timestamp: new Date().toISOString(),
      totalSuites: this.results.length,
      totalTests,
      totalPassed,
      totalFailed,
      totalSkipped,
      totalDuration: Math.round(totalDuration / 1000),
      overallCoverage,
      suiteResults: this.results,
      summary: {
        status,
        criticalFailures,
        recommendations
      }
    };
  }

  async saveReport(report: TestReport, filename?: string): Promise<string> {
    const reportFilename = filename || `ai-feedback-test-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const reportPath = path.join(process.cwd(), 'test', 'reports', reportFilename);
    
    // Ensure reports directory exists
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    return reportPath;
  }

  printFinalReport(report: TestReport): void {
    console.log('\n' + '='.repeat(60));
    console.log('🎯 AI FEEDBACK SYSTEM TEST RESULTS');
    console.log('='.repeat(60));
    
    console.log(`📊 Overall Status: ${this.getStatusEmoji(report.summary.status)} ${report.summary.status}`);
    console.log(`📈 Test Suites: ${report.totalSuites}`);
    console.log(`🧪 Total Tests: ${report.totalTests}`);
    console.log(`✅ Passed: ${report.totalPassed}`);
    console.log(`❌ Failed: ${report.totalFailed}`);
    console.log(`⏭️  Skipped: ${report.totalSkipped}`);
    console.log(`⏱️  Duration: ${Math.round(report.totalDuration / 60)}m ${report.totalDuration % 60}s`);
    
    if (report.overallCoverage > 0) {
      console.log(`📋 Coverage: ${report.overallCoverage}%`);
    }

    if (report.summary.criticalFailures.length > 0) {
      console.log('\n🚨 Critical Failures:');
      report.summary.criticalFailures.forEach(failure => {
        console.log(`   • ${failure}`);
      });
    }

    if (report.summary.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      report.summary.recommendations.forEach(rec => {
        console.log(`   • ${rec}`);
      });
    }

    console.log('\n📋 Suite Breakdown:');
    report.suiteResults.forEach(result => {
      const status = result.failed === 0 ? '✅' : '❌';
      const passRate = Math.round((result.passed / (result.passed + result.failed)) * 100);
      console.log(`   ${status} ${result.suite}: ${passRate}% pass rate (${result.duration}s)`);
    });

    console.log('\n' + '='.repeat(60));
  }

  private getStatusEmoji(status: string): string {
    switch (status) {
      case 'PASS': return '🎉';
      case 'FAIL': return '🚨';
      case 'PARTIAL': return '⚠️';
      default: return '❓';
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const options: any = {};

  // Parse command line arguments
  args.forEach(arg => {
    if (arg.startsWith('--category=')) {
      options.category = arg.split('=')[1];
    } else if (arg.startsWith('--priority=')) {
      options.priority = arg.split('=')[1];
    } else if (arg === '--parallel') {
      options.parallel = true;
    } else if (arg === '--coverage') {
      options.coverage = true;
    } else if (arg === '--verbose') {
      options.verbose = true;
    }
  });

  const runner = new AIFeedbackTestRunner();
  
  try {
    const report = await runner.runAllTests(options);
    runner.printFinalReport(report);
    
    const reportPath = await runner.saveReport(report);
    console.log(`\n📄 Detailed report saved: ${reportPath}`);
    
    // Exit with appropriate code
    process.exit(report.summary.status === 'FAIL' ? 1 : 0);
  } catch (error) {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  }
}

// Export for programmatic use
export { AIFeedbackTestRunner, TestSuite, TestResult, TestReport };

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}