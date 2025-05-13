#!/usr/bin/env node

/**
 * API Validation Script for Academus
 * 
 * This script tests the core API endpoints to ensure they're functioning correctly.
 * It verifies authentication, course management, assignment handling, and submissions.
 * 
 * Usage:
 *   node api-validation.js http://localhost:5000
 * 
 * Requirements:
 *   npm install axios
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = process.argv[2] || 'http://localhost:5000';
const LOGIN_CREDENTIALS = {
  instructor: { username: 'instructor@test.com', password: 'instructor123' },
  student: { username: 'student@test.com', password: 'student123' },
  admin: { username: 'admin@test.com', password: 'admin123' },
};

// Storage for test data
let tokens = {
  instructor: null,
  student: null,
  admin: null
};

let testData = {
  courseId: null,
  assignmentId: null,
  submissionId: null,
  shareableCode: null
};

// Initialize axios instance
const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  validateStatus: null // Don't throw on any status code
});

// Helper for formatted console output
const log = {
  info: (msg) => console.log(`\x1b[36m[INFO]\x1b[0m ${msg}`),
  success: (msg) => console.log(`\x1b[32m[SUCCESS]\x1b[0m ${msg}`),
  error: (msg) => console.log(`\x1b[31m[ERROR]\x1b[0m ${msg}`),
  result: (name, status, data = null) => {
    const statusText = status ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
    console.log(`${statusText} ${name}`);
    if (data && !status) {
      console.log(`     Response: ${JSON.stringify(data, null, 2).slice(0, 500)}`);
    }
  }
};

// Save execution results
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  tests: []
};

const recordResult = (name, passed, response = null) => {
  results.total++;
  if (passed) {
    results.passed++;
  } else {
    results.failed++;
  }
  
  results.tests.push({
    name,
    passed,
    timestamp: new Date().toISOString(),
    responseData: response ? JSON.stringify(response.data).slice(0, 1000) : null,
    status: response ? response.status : null
  });
  
  log.result(name, passed, response ? response.data : null);
};

// Authentication Tests
async function testAuthentication() {
  log.info('Testing Authentication APIs...');
  
  // Test instructor login
  try {
    const loginResponse = await api.post('/api/auth/login', LOGIN_CREDENTIALS.instructor);
    const success = loginResponse.status === 200 && loginResponse.data && loginResponse.data.role === 'instructor';
    
    if (success && loginResponse.headers['set-cookie']) {
      // Extract credentials for future requests
      tokens.instructor = loginResponse.headers['set-cookie'];
      api.defaults.headers.Cookie = tokens.instructor;
    }
    
    recordResult('Instructor Login', success, loginResponse);
  } catch (error) {
    recordResult('Instructor Login', false, error.response);
  }
  
  // Verify auth state
  try {
    const userResponse = await api.get('/api/auth/user');
    const success = userResponse.status === 200 && userResponse.data && userResponse.data.role === 'instructor';
    recordResult('Get Authenticated User', success, userResponse);
  } catch (error) {
    recordResult('Get Authenticated User', false, error.response);
  }
  
  // Test student login
  try {
    const loginResponse = await api.post('/api/auth/login', LOGIN_CREDENTIALS.student);
    const success = loginResponse.status === 200 && loginResponse.data && loginResponse.data.role === 'student';
    
    if (success && loginResponse.headers['set-cookie']) {
      tokens.student = loginResponse.headers['set-cookie'];
    }
    
    recordResult('Student Login', success, loginResponse);
  } catch (error) {
    recordResult('Student Login', false, error.response);
  }
}

// Course Management Tests
async function testCourseManagement() {
  log.info('Testing Course Management APIs...');
  
  // Set instructor credentials
  if (tokens.instructor) {
    api.defaults.headers.Cookie = tokens.instructor;
  }
  
  // List courses
  try {
    const coursesResponse = await api.get('/api/courses');
    const success = coursesResponse.status === 200 && Array.isArray(coursesResponse.data);
    recordResult('List Instructor Courses', success, coursesResponse);
    
    // Store a course ID for later tests if available
    if (success && coursesResponse.data.length > 0) {
      testData.courseId = coursesResponse.data[0].id;
    }
  } catch (error) {
    recordResult('List Instructor Courses', false, error.response);
  }
  
  // Create a new course
  try {
    const newCourse = {
      title: `Test Course ${new Date().toISOString()}`,
      description: 'Created by API validation script'
    };
    
    const createResponse = await api.post('/api/courses', newCourse);
    const success = createResponse.status === 201 && createResponse.data && createResponse.data.title === newCourse.title;
    
    if (success && !testData.courseId) {
      testData.courseId = createResponse.data.id;
    }
    
    recordResult('Create New Course', success, createResponse);
  } catch (error) {
    recordResult('Create New Course', false, error.response);
  }
  
  // Get course details if we have a course ID
  if (testData.courseId) {
    try {
      const courseResponse = await api.get(`/api/courses/${testData.courseId}`);
      const success = courseResponse.status === 200 && courseResponse.data && courseResponse.data.id === testData.courseId;
      recordResult('Get Course Details', success, courseResponse);
    } catch (error) {
      recordResult('Get Course Details', false, error.response);
    }
  } else {
    log.error('No course ID available for course details test');
    recordResult('Get Course Details', false, { data: 'No course ID available' });
  }
}

// Assignment Management Tests
async function testAssignmentManagement() {
  log.info('Testing Assignment Management APIs...');
  
  // Set instructor credentials
  if (tokens.instructor) {
    api.defaults.headers.Cookie = tokens.instructor;
  }
  
  // List assignments
  try {
    const assignmentsResponse = await api.get('/api/assignments');
    const success = assignmentsResponse.status === 200 && Array.isArray(assignmentsResponse.data);
    recordResult('List Instructor Assignments', success, assignmentsResponse);
    
    // Store an assignment ID for later tests if available
    if (success && assignmentsResponse.data.length > 0) {
      testData.assignmentId = assignmentsResponse.data[0].id;
    }
  } catch (error) {
    recordResult('List Instructor Assignments', false, error.response);
  }
  
  // Create a standalone assignment
  try {
    const newAssignment = {
      title: `Standalone Assignment ${new Date().toISOString()}`,
      description: 'Created by API validation script',
      rubric: {
        criteria: [
          { name: 'Quality', description: 'Overall quality', maxScore: 10 },
          { name: 'Creativity', description: 'Creative thinking', maxScore: 5 }
        ],
        passingThreshold: 10,
        feedbackPrompt: 'Provide feedback on assignment quality'
      }
    };
    
    const createResponse = await api.post('/api/assignments', newAssignment);
    const success = createResponse.status === 201 && 
                   createResponse.data && 
                   createResponse.data.title === newAssignment.title;
    
    if (success) {
      if (!testData.assignmentId) {
        testData.assignmentId = createResponse.data.id;
      }
      if (createResponse.data.shareableCode) {
        testData.shareableCode = createResponse.data.shareableCode;
      }
    }
    
    recordResult('Create Standalone Assignment', success, createResponse);
  } catch (error) {
    recordResult('Create Standalone Assignment', false, error.response);
  }
  
  // Create a course assignment if we have a course ID
  if (testData.courseId) {
    try {
      const newAssignment = {
        title: `Course Assignment ${new Date().toISOString()}`,
        description: 'Created by API validation script',
        courseId: testData.courseId,
        rubric: {
          criteria: [
            { name: 'Research', description: 'Research quality', maxScore: 10 },
            { name: 'Analysis', description: 'Analytical skills', maxScore: 10 }
          ],
          passingThreshold: 15,
          feedbackPrompt: 'Provide detailed feedback'
        }
      };
      
      const createResponse = await api.post('/api/assignments', newAssignment);
      const success = createResponse.status === 201 && 
                     createResponse.data && 
                     createResponse.data.title === newAssignment.title &&
                     createResponse.data.courseId === testData.courseId;
      
      if (success && !testData.assignmentId) {
        testData.assignmentId = createResponse.data.id;
      }
      
      recordResult('Create Course Assignment', success, createResponse);
    } catch (error) {
      recordResult('Create Course Assignment', false, error.response);
    }
  } else {
    log.error('No course ID available for course assignment test');
    recordResult('Create Course Assignment', false, { data: 'No course ID available' });
  }
  
  // Get assignment details if we have an assignment ID
  if (testData.assignmentId) {
    try {
      const assignmentResponse = await api.get(`/api/assignments/${testData.assignmentId}`);
      const success = assignmentResponse.status === 200 && 
                     assignmentResponse.data && 
                     assignmentResponse.data.id === testData.assignmentId;
      recordResult('Get Assignment Details', success, assignmentResponse);
    } catch (error) {
      recordResult('Get Assignment Details', false, error.response);
    }
  } else {
    log.error('No assignment ID available for assignment details test');
    recordResult('Get Assignment Details', false, { data: 'No assignment ID available' });
  }
  
  // Update assignment status if we have an assignment ID
  if (testData.assignmentId) {
    try {
      const updateResponse = await api.patch(`/api/assignments/${testData.assignmentId}/status`, {
        status: 'active'
      });
      const success = updateResponse.status === 200 && 
                     updateResponse.data && 
                     updateResponse.data.id === testData.assignmentId &&
                     updateResponse.data.status === 'active';
      recordResult('Update Assignment Status', success, updateResponse);
    } catch (error) {
      recordResult('Update Assignment Status', false, error.response);
    }
  } else {
    log.error('No assignment ID available for status update test');
    recordResult('Update Assignment Status', false, { data: 'No assignment ID available' });
  }
}

// Submission Management Tests
async function testSubmissionManagement() {
  log.info('Testing Submission Management APIs...');
  
  // Switch to student credentials
  if (tokens.student) {
    api.defaults.headers.Cookie = tokens.student;
  }
  
  // List assignments (as student)
  try {
    const assignmentsResponse = await api.get('/api/assignments');
    const success = assignmentsResponse.status === 200 && Array.isArray(assignmentsResponse.data);
    recordResult('List Student Assignments', success, assignmentsResponse);
    
    // Update assignment ID if needed
    if (success && assignmentsResponse.data.length > 0 && !testData.assignmentId) {
      testData.assignmentId = assignmentsResponse.data[0].id;
    }
  } catch (error) {
    recordResult('List Student Assignments', false, error.response);
  }
  
  // Submit an assignment
  if (testData.assignmentId) {
    try {
      const submissionData = {
        assignmentId: testData.assignmentId,
        content: 'This is a test submission from the API validation script'
      };
      
      const submitResponse = await api.post('/api/submissions', submissionData);
      const success = submitResponse.status === 201 && 
                     submitResponse.data && 
                     submitResponse.data.assignmentId === testData.assignmentId;
      
      if (success) {
        testData.submissionId = submitResponse.data.id;
      }
      
      recordResult('Submit Assignment', success, submitResponse);
    } catch (error) {
      recordResult('Submit Assignment', false, error.response);
    }
  } else {
    log.error('No assignment ID available for submission test');
    recordResult('Submit Assignment', false, { data: 'No assignment ID available' });
  }
  
  // List student submissions
  try {
    const submissionsResponse = await api.get('/api/submissions');
    const success = submissionsResponse.status === 200 && Array.isArray(submissionsResponse.data);
    recordResult('List Student Submissions', success, submissionsResponse);
  } catch (error) {
    recordResult('List Student Submissions', false, error.response);
  }
  
  // Test access to assignment via shareable code
  if (testData.shareableCode) {
    try {
      const shareableResponse = await api.get(`/api/assignments/code/${testData.shareableCode}`);
      const success = shareableResponse.status === 200 && shareableResponse.data;
      recordResult('Access Assignment via Shareable Code', success, shareableResponse);
    } catch (error) {
      recordResult('Access Assignment via Shareable Code', false, error.response);
    }
  } else {
    log.error('No shareable code available for test');
    recordResult('Access Assignment via Shareable Code', false, { data: 'No shareable code available' });
  }
  
  // Switch back to instructor to view submissions
  if (tokens.instructor) {
    api.defaults.headers.Cookie = tokens.instructor;
  }
  
  // List submissions for an assignment (as instructor)
  if (testData.assignmentId) {
    try {
      const submissionsResponse = await api.get(`/api/assignments/${testData.assignmentId}/submissions`);
      const success = submissionsResponse.status === 200 && Array.isArray(submissionsResponse.data);
      recordResult('List Assignment Submissions (Instructor)', success, submissionsResponse);
    } catch (error) {
      recordResult('List Assignment Submissions (Instructor)', false, error.response);
    }
  } else {
    log.error('No assignment ID available for submission listing test');
    recordResult('List Assignment Submissions (Instructor)', false, { data: 'No assignment ID available' });
  }
}

// Run tests and save results
async function runTests() {
  const startTime = new Date();
  log.info(`Starting API validation against ${BASE_URL}`);
  
  try {
    await testAuthentication();
    await testCourseManagement();
    await testAssignmentManagement();
    await testSubmissionManagement();
    
    const duration = new Date() - startTime;
    
    // Summarize results
    log.info('Test Summary:');
    log.info(`Total Tests: ${results.total}`);
    log.success(`Passed: ${results.passed}`);
    if (results.failed > 0) {
      log.error(`Failed: ${results.failed}`);
    } else {
      log.success('All tests passed!');
    }
    log.info(`Duration: ${duration / 1000} seconds`);
    
    // Save results
    const report = {
      timestamp: new Date().toISOString(),
      baseUrl: BASE_URL,
      summary: {
        total: results.total,
        passed: results.passed,
        failed: results.failed,
        passRate: `${Math.round((results.passed / results.total) * 100)}%`,
        duration: `${duration / 1000} seconds`
      },
      tests: results.tests
    };
    
    fs.writeFileSync(
      path.join(__dirname, `api-test-results-${new Date().toISOString().replace(/[:.]/g, '-')}.json`),
      JSON.stringify(report, null, 2)
    );
    
  } catch (error) {
    log.error(`Unexpected error during test execution: ${error.message}`);
    console.error(error);
  }
}

// Execute tests
runTests();