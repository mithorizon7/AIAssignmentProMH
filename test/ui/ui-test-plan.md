# Academus UI Test Plan

This document outlines the UI testing approach for Academus to ensure all user interfaces function correctly.

## Test Environment Setup

### Prerequisites
- Node.js and npm installed
- Chrome or Firefox browser
- Playwright or Cypress test framework (recommended)

### Installation
```bash
# Install Playwright
npm install -D @playwright/test
npx playwright install

# Or install Cypress
npm install -D cypress
```

## Test Scenarios

### 1. Authentication UI

#### 1.1 Login Form Validation
- **Test Objective**: Verify login form validation functions correctly
- **Steps**:
  1. Navigate to login page
  2. Submit empty form
  3. Submit with invalid email format
  4. Submit with valid email but no password
  5. Submit valid credentials
- **Expected Results**:
  - Form shows appropriate validation messages
  - Login succeeds with valid credentials

#### 1.2 User Role Redirection
- **Test Objective**: Verify users are redirected to appropriate dashboards
- **Steps**:
  1. Login as student
  2. Login as instructor
  3. Login as admin
- **Expected Results**:
  - Each user type lands on the correct dashboard

### 2. Course Management UI

#### 2.1 Course List
- **Test Objective**: Verify course list displays correctly
- **Steps**:
  1. Login as instructor
  2. Navigate to Courses page
- **Expected Results**:
  - Course list displays with correct information
  - Course cards show title, description, and actions

#### 2.2 Course Creation Form
- **Test Objective**: Verify course creation form functions correctly
- **Steps**:
  1. Login as instructor
  2. Navigate to create course page
  3. Test form validation
  4. Submit with valid data
- **Expected Results**:
  - Form validates input correctly
  - Course is created successfully
  - UI updates to show new course

### 3. Assignment Management UI

#### 3.1 Assignment List
- **Test Objective**: Verify assignment list displays correctly
- **Steps**:
  1. Login as instructor
  2. Navigate to Assignments page
- **Expected Results**:
  - Assignment list displays with correct information
  - Assignment cards show title, status, and course association

#### 3.2 Assignment Creation Form
- **Test Objective**: Verify assignment creation form functions correctly
- **Steps**:
  1. Login as instructor
  2. Navigate to create assignment page
  3. Test form validation
  4. Test course selection
  5. Test rubric creation
  6. Submit with valid data
- **Expected Results**:
  - Form validates input correctly
  - Course selector works properly
  - Rubric builder functions correctly
  - Assignment is created successfully

#### 3.3 Rubric Builder
- **Test Objective**: Verify rubric builder component functions correctly
- **Steps**:
  1. Navigate to assignment creation
  2. Add multiple criteria
  3. Set max scores
  4. Remove criteria
  5. Set passing threshold
- **Expected Results**:
  - Criteria can be added and removed
  - Scores and thresholds can be set
  - Validation prevents invalid configurations

### 4. Student Experience UI

#### 4.1 Available Assignments
- **Test Objective**: Verify students can see available assignments
- **Steps**:
  1. Login as student
  2. Navigate to Assignments page
- **Expected Results**:
  - Only active assignments from enrolled courses are visible
  - Assignment cards show relevant information

#### 4.2 Submission UI
- **Test Objective**: Verify submission interface functions correctly
- **Steps**:
  1. Navigate to an assignment
  2. Test file upload
  3. Test text input
  4. Submit assignment
- **Expected Results**:
  - File upload works correctly
  - Text input is saved
  - Submission is processed successfully
  - Confirmation is shown

#### 4.3 Feedback Display
- **Test Objective**: Verify feedback is displayed correctly
- **Steps**:
  1. Navigate to a graded submission
- **Expected Results**:
  - Feedback sections are clearly displayed
  - Strengths, improvements, and suggestions are properly formatted

### 5. Responsive Design

#### 5.1 Mobile View
- **Test Objective**: Verify responsive design on mobile viewports
- **Steps**:
  1. Resize browser to mobile dimensions (e.g., 375x667)
  2. Navigate through key pages
- **Expected Results**:
  - Navigation adapts to mobile
  - Content is readable and usable
  - Forms function correctly

#### 5.2 Tablet View
- **Test Objective**: Verify responsive design on tablet viewports
- **Steps**:
  1. Resize browser to tablet dimensions (e.g., 768x1024)
  2. Navigate through key pages
- **Expected Results**:
  - Layout adapts appropriately
  - No overflowing content
  - All functionality accessible

### 6. Cross-Browser Compatibility

- **Test Objective**: Verify application works across major browsers
- **Browsers to Test**:
  - Chrome (latest)
  - Firefox (latest)
  - Safari (latest, if available)
- **Areas to Focus**:
  - Form validation behavior
  - File upload functionality
  - Rich text editing
  - CSS rendering

## Sample Playwright Test Script

```javascript
// Example test for login functionality
import { test, expect } from '@playwright/test';

test('login form validation and successful login', async ({ page }) => {
  // Navigate to login page
  await page.goto('http://localhost:5000/auth');
  
  // Test empty form submission
  await page.click('button[type="submit"]');
  await expect(page.locator('.error-message')).toBeVisible();
  
  // Test invalid email
  await page.fill('input[name="username"]', 'invalid-email');
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  await expect(page.locator('.error-message')).toBeVisible();
  
  // Test valid login
  await page.fill('input[name="username"]', 'instructor@test.com');
  await page.fill('input[name="password"]', 'instructor123');
  await page.click('button[type="submit"]');
  
  // Verify redirect to dashboard
  await expect(page).toHaveURL(/.*dashboard/);
  await expect(page.locator('h1')).toContainText('Dashboard');
});
```

## Test Execution Flow

1. Run automated tests for critical paths
2. Execute manual tests for complex interactions
3. Document results with screenshots
4. Track issues in issue tracker
5. Regression test after fixes

## Reporting

For each test execution, generate a report that includes:
- Test pass/fail status
- Screenshots of failures
- Console errors
- Performance metrics
- Browser and viewport information

## Implementation Plan

1. Set up test environment and framework
2. Implement authentication tests
3. Implement course management tests
4. Implement assignment management tests
5. Implement student experience tests
6. Set up continuous integration for automated UI tests
7. Create regular test execution schedule