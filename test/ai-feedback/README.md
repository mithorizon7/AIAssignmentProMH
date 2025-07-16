# AI Feedback System Test Suite

A comprehensive test suite for validating the AI feedback mechanisms from both instructor and student perspectives. This test suite ensures the reliability, security, and performance of the entire AI-powered grading system.

## 🎯 Overview

This test suite covers all aspects of the AI feedback system:

- **End-to-End Workflows**: Complete instructor and student workflows
- **AI Integration**: Gemini adapter functionality and reliability  
- **Queue Processing**: BullMQ background job processing
- **Performance**: Load testing and scalability validation
- **Security**: Compliance with GDPR/FERPA and security best practices
- **Error Handling**: Resilience and recovery mechanisms

## 📁 Test Structure

```
test/ai-feedback/
├── comprehensive-test-suite.test.ts     # End-to-end integration tests
├── gemini-adapter.test.ts               # AI adapter unit tests
├── queue-system.test.ts                 # Queue processing tests
├── instructor-workflow.test.ts          # Instructor-specific workflows
├── student-workflow.test.ts             # Student-specific workflows  
├── performance-reliability.test.ts      # Performance and load tests
├── security-compliance.test.ts          # Security and compliance tests
├── test-runner.ts                       # Test suite runner
└── README.md                           # This documentation
```

## 🚀 Quick Start

### Run All Tests
```bash
npm run test:ai-feedback
```

### Run Specific Test Categories
```bash
# Unit tests only
npm run test:ai-feedback -- --category=unit

# High priority tests only  
npm run test:ai-feedback -- --priority=high

# Performance tests
npm run test:ai-feedback -- --category=performance

# Security tests
npm run test:ai-feedback -- --category=security
```

### Run Tests in Parallel
```bash
npm run test:ai-feedback -- --parallel
```

### Generate Coverage Report
```bash
npm run test:ai-feedback -- --coverage
```

## 📊 Test Categories

### 🧪 Unit Tests
- **Gemini Adapter**: AI service integration, response parsing, error handling
- **JSON Parser**: Response validation and repair mechanisms
- **File Handlers**: Document processing and MIME type validation

### 🔗 Integration Tests  
- **Queue System**: BullMQ job processing, Redis connectivity, worker management
- **Database**: Data persistence, transactions, query optimization
- **API Endpoints**: Request/response validation, authentication, authorization

### 🎭 End-to-End Tests
- **Instructor Workflows**: Assignment creation, rubric testing, analytics
- **Student Workflows**: Submission process, feedback retrieval, progress tracking
- **Complete Pipeline**: Submission → Queue → AI Processing → Feedback Delivery

### ⚡ Performance Tests
- **Load Testing**: Concurrent submissions, high throughput scenarios
- **Scalability**: Memory usage, response times, queue processing efficiency
- **Reliability**: Error recovery, failover mechanisms, data consistency

### 🔒 Security Tests
- **Input Validation**: XSS prevention, SQL injection protection, file upload security
- **Authentication**: Role-based access control, session management, CSRF protection
- **Compliance**: GDPR/FERPA requirements, audit logging, data encryption

## 🛠️ Test Configuration

### Environment Setup
Ensure these environment variables are configured:
```bash
# AI Services
GEMINI_API_KEY=your_gemini_api_key

# Database
DATABASE_URL=your_postgres_connection_string

# Redis/Queue
REDIS_URL=your_redis_connection_string

# Testing
NODE_ENV=test
```

### Test Data Setup
The test suite automatically creates and cleans up test data:
- Test users (instructors and students)
- Test courses and assignments
- Sample submissions and feedback
- Mock file uploads

## 📈 Coverage Goals

| Component | Target Coverage | Current Status |
|-----------|----------------|----------------|
| AI Adapters | 95%+ | ✅ Excellent |
| Queue System | 90%+ | ✅ Good |
| API Routes | 85%+ | ✅ Good |
| Workflows | 80%+ | ✅ Adequate |
| Error Handlers | 90%+ | ✅ Good |

## 🔍 Test Scenarios

### Instructor Perspective Tests
1. **Rubric Creation & Validation**
   - Create assignments with comprehensive rubrics
   - Validate rubric structure and weights
   - Test rubric with sample content

2. **Assignment Management**
   - Monitor submission processing
   - Review AI feedback quality
   - Access analytics and reports

3. **System Administration**
   - Bulk operations and data export
   - Performance monitoring
   - Error investigation

### Student Perspective Tests
1. **Submission Process**
   - Text-based code submissions
   - File uploads (various formats)
   - Multimodal submissions (text + images)

2. **Feedback Interaction**
   - Retrieve and review AI feedback
   - Request clarifications
   - Track progress over time

3. **Collaboration Features**
   - Share submissions via links
   - Peer review processes
   - Draft management

### System Integration Tests
1. **AI Processing Pipeline**
   - Content analysis and grading
   - Response format validation
   - Error handling and retries

2. **Queue Management**
   - Job scheduling and processing
   - Concurrent submission handling
   - Performance under load

3. **Data Integrity**
   - Transaction management
   - Concurrent access handling
   - Backup and recovery

## 🐛 Common Test Issues

### AI Service Timeouts
- **Cause**: Large content or API rate limits
- **Solution**: Implement proper retry logic and content chunking

### Queue Processing Delays
- **Cause**: Redis connectivity or worker overload
- **Solution**: Monitor queue health and scale workers

### Memory Leaks in Performance Tests
- **Cause**: Large file processing without cleanup
- **Solution**: Implement proper resource disposal

### Flaky Integration Tests
- **Cause**: Race conditions in async operations
- **Solution**: Add proper wait conditions and timeouts

## 📊 Metrics and Monitoring

The test suite tracks key metrics:

### Performance Metrics
- Response times for AI processing
- Queue throughput and latency
- Memory usage under load
- Database query performance

### Quality Metrics
- Test coverage percentages
- AI feedback accuracy
- Error rates and recovery times
- User experience scores

### Security Metrics
- Vulnerability scan results
- Compliance validation status
- Security incident detection
- Audit log completeness

## 🔄 Continuous Integration

### GitHub Actions Integration
```yaml
- name: Run AI Feedback Tests
  run: |
    npm run test:ai-feedback -- --coverage --parallel
    npm run test:ai-feedback:security
    npm run test:ai-feedback:performance
```

### Test Result Reporting
- JSON reports for CI/CD integration
- Coverage reports with detailed breakdowns
- Performance benchmarks over time
- Security scan summaries

## 🎯 Best Practices

### Writing New Tests
1. **Follow AAA Pattern**: Arrange, Act, Assert
2. **Use Descriptive Names**: Test names should explain the scenario
3. **Clean Up Resources**: Always clean up test data
4. **Mock External Services**: Use mocks for unreliable dependencies
5. **Test Error Cases**: Don't just test happy paths

### Test Data Management
1. **Isolated Test Data**: Each test should use unique data
2. **Deterministic Results**: Tests should be repeatable
3. **Cleanup Strategies**: Use beforeEach/afterEach for cleanup
4. **Realistic Data**: Use data that matches production scenarios

### Performance Testing
1. **Baseline Metrics**: Establish performance benchmarks
2. **Gradual Load**: Increase load gradually in performance tests
3. **Resource Monitoring**: Track memory, CPU, and network usage
4. **Failure Points**: Identify system breaking points

## 🚨 Troubleshooting

### Test Environment Issues
```bash
# Reset test database
npm run db:reset:test

# Clear Redis cache
npm run redis:clear:test

# Restart test services
npm run services:restart:test
```

### Debug Individual Tests
```bash
# Run single test file with verbose output
npx vitest test/ai-feedback/gemini-adapter.test.ts --verbose

# Debug specific test
npx vitest test/ai-feedback/instructor-workflow.test.ts --reporter=verbose --bail=1
```

### Performance Issues
```bash
# Profile memory usage
npx vitest test/ai-feedback/performance-reliability.test.ts --reporter=verbose --no-coverage

# Check queue status
npm run queue:status

# Monitor database performance  
npm run db:analyze
```

## 📞 Support

For test-related issues:
1. Check test logs in `test/reports/`
2. Review environment configuration
3. Validate external service connectivity
4. Check database and Redis status
5. Consult troubleshooting guide above

## 🔮 Future Enhancements

- **Visual Regression Testing**: Screenshot comparisons for UI changes
- **Load Testing Automation**: Continuous performance monitoring
- **AI Model Testing**: Validate AI response quality over time
- **Cross-Browser Testing**: Ensure compatibility across browsers
- **Mobile Testing**: Validate mobile application functionality