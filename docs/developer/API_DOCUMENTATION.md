# API Documentation

## Overview

The AIGrader API is a RESTful API built with Express.js that provides endpoints for managing educational assessments, user authentication, assignment processing, and AI-powered feedback generation.

**Base URL**: `/api`
**Authentication**: Session-based with CSRF protection
**Content-Type**: `application/json` (except file uploads)

## Authentication

### Session Management

All API endpoints require authentication except for anonymous submission endpoints. The API uses session-based authentication with CSRF tokens.

#### Get Current User
```http
GET /api/auth/user
```

**Response 200 (Success)**
```json
{
  "id": 1,
  "name": "John Doe",
  "username": "john.doe@university.edu",
  "email": "john.doe@university.edu",
  "role": "student",
  "createdAt": "2025-01-15T10:30:00Z"
}
```

**Response 401 (Unauthorized)**
```json
{
  "message": "Unauthorized"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json
```

**Request Body**
```json
{
  "username": "student@university.edu",
  "password": "securepassword123"
}
```

**Response 200 (Success)**
```json
{
  "message": "Login successful",
  "user": {
    "id": 1,
    "name": "John Doe",
    "username": "student@university.edu",
    "role": "student"
  }
}
```

**Response 401 (Invalid credentials)**
```json
{
  "message": "Invalid username or password"
}
```

#### Logout
```http
POST /api/auth/logout
```

**Response 200 (Success)**
```json
{
  "message": "Logout successful"
}
```

### CSRF Protection

State-changing operations require CSRF tokens:

#### Get CSRF Token
```http
GET /api/csrf-token
```

**Response 200**
```json
{
  "csrfToken": "a1b2c3d4e5f6..."
}
```

Include CSRF token in request headers:
```http
X-CSRF-Token: a1b2c3d4e5f6...
```

## User Management

### Create User (Registration)
```http
POST /api/auth/register
Content-Type: application/json
X-CSRF-Token: {csrf_token}
```

**Request Body**
```json
{
  "name": "Jane Smith",
  "username": "jane.smith@university.edu",
  "email": "jane.smith@university.edu",
  "password": "securepassword123",
  "role": "student"
}
```

**Response 201 (Created)**
```json
{
  "message": "User created successfully",
  "user": {
    "id": 2,
    "name": "Jane Smith",
    "username": "jane.smith@university.edu",
    "email": "jane.smith@university.edu",
    "role": "student"
  }
}
```

**Response 400 (Validation Error)**
```json
{
  "message": "Username already exists"
}
```

## Course Management

### List Courses
```http
GET /api/courses
```

**Query Parameters**
- `limit` (optional): Number of courses to return (default: 50)
- `offset` (optional): Number of courses to skip (default: 0)

**Response 200**
```json
[
  {
    "id": 1,
    "title": "Introduction to Computer Science",
    "description": "Fundamental concepts of programming and computer science",
    "code": "CS101",
    "instructorId": 5,
    "createdAt": "2025-01-10T09:00:00Z",
    "assignmentCount": 12,
    "enrollmentCount": 150
  }
]
```

### Create Course (Instructor/Admin only)
```http
POST /api/courses
Content-Type: application/json
X-CSRF-Token: {csrf_token}
```

**Request Body**
```json
{
  "title": "Advanced Machine Learning",
  "description": "Deep dive into ML algorithms and applications",
  "code": "CS440"
}
```

**Response 201 (Created)**
```json
{
  "id": 2,
  "title": "Advanced Machine Learning",
  "description": "Deep dive into ML algorithms and applications",
  "code": "CS440",
  "instructorId": 5,
  "createdAt": "2025-01-15T14:30:00Z"
}
```

### Get Course Details
```http
GET /api/courses/{courseId}
```

**Response 200**
```json
{
  "id": 1,
  "title": "Introduction to Computer Science",
  "description": "Fundamental concepts of programming",
  "code": "CS101",
  "instructorId": 5,
  "instructor": {
    "id": 5,
    "name": "Dr. Sarah Johnson",
    "email": "sarah.johnson@university.edu"
  },
  "assignments": [
    {
      "id": 1,
      "title": "Hello World Program",
      "status": "active",
      "dueDate": "2025-01-20T23:59:59Z"
    }
  ],
  "enrollmentCount": 150
}
```

## Assignment Management

### List Assignments
```http
GET /api/assignments
```

**Query Parameters**
- `courseId` (optional): Filter by course ID
- `status` (optional): Filter by status (`active`, `completed`, `upcoming`)
- `limit` (optional): Number of assignments (default: 50)

**Response 200**
```json
[
  {
    "id": 1,
    "title": "Programming Assignment 1",
    "description": "<p>Write a program that...</p>",
    "status": "active",
    "dueDate": "2025-01-25T23:59:59Z",
    "availableAt": "2025-01-15T00:00:00Z",
    "courseId": 1,
    "course": {
      "title": "Introduction to Computer Science",
      "code": "CS101"
    },
    "maxScore": 100,
    "submissionCount": 45,
    "userSubmissionStatus": "submitted"
  }
]
```

### Create Assignment (Instructor/Admin only)
```http
POST /api/assignments
Content-Type: application/json
X-CSRF-Token: {csrf_token}
```

**Request Body**
```json
{
  "title": "Data Structures Assignment",
  "description": "<p>Implement a binary search tree...</p>",
  "courseId": 1,
  "dueDate": "2025-02-01T23:59:59Z",
  "availableAt": "2025-01-20T00:00:00Z",
  "maxScore": 100,
  "rubric": {
    "criteria": [
      {
        "name": "Correctness",
        "description": "Code produces correct output",
        "maxPoints": 50
      },
      {
        "name": "Code Quality",
        "description": "Clean, readable, well-documented code",
        "maxPoints": 30
      }
    ]
  }
}
```

**Response 201 (Created)**
```json
{
  "id": 3,
  "title": "Data Structures Assignment",
  "description": "<p>Implement a binary search tree...</p>",
  "status": "upcoming",
  "courseId": 1,
  "dueDate": "2025-02-01T23:59:59Z",
  "createdAt": "2025-01-15T16:00:00Z"
}
```

### Get Assignment Details
```http
GET /api/assignments/{assignmentId}
```

**Response 200**
```json
{
  "id": 1,
  "title": "Programming Assignment 1",
  "description": "<p>Write a program that calculates...</p>",
  "status": "active",
  "dueDate": "2025-01-25T23:59:59Z",
  "availableAt": "2025-01-15T00:00:00Z",
  "maxScore": 100,
  "courseId": 1,
  "course": {
    "title": "Introduction to Computer Science",
    "code": "CS101"
  },
  "rubric": {
    "criteria": [
      {
        "name": "Correctness",
        "description": "Program produces correct output",
        "maxPoints": 70
      }
    ]
  },
  "submissionCount": 45,
  "userSubmission": {
    "id": 12,
    "status": "completed",
    "submittedAt": "2025-01-18T14:30:00Z",
    "score": 85
  }
}
```

## Submission Management

### Submit Assignment
```http
POST /api/submissions
Content-Type: multipart/form-data
X-CSRF-Token: {csrf_token}
```

**Form Data**
- `assignmentId`: Assignment ID (required)
- `submissionType`: `text`, `file`, or `code`
- `content`: Text content (for text submissions)
- `file`: File upload (for file submissions)

**Response 201 (Created)**
```json
{
  "id": 15,
  "assignmentId": 1,
  "userId": 1,
  "submissionType": "file",
  "fileName": "assignment1.py",
  "fileUrl": "https://storage.googleapis.com/bucket/files/assignment1.py",
  "status": "processing",
  "submittedAt": "2025-01-18T15:45:00Z"
}
```

**Response 400 (Validation Error)**
```json
{
  "message": "Assignment deadline has passed"
}
```

### List User Submissions
```http
GET /api/submissions
```

**Query Parameters**
- `assignmentId` (optional): Filter by assignment
- `status` (optional): Filter by status
- `limit` (optional): Number of submissions

**Response 200**
```json
[
  {
    "id": 15,
    "assignmentId": 1,
    "assignment": {
      "title": "Programming Assignment 1",
      "course": {
        "title": "Introduction to Computer Science"
      }
    },
    "submissionType": "file",
    "fileName": "assignment1.py",
    "status": "completed",
    "submittedAt": "2025-01-18T15:45:00Z",
    "feedback": {
      "score": 85,
      "overallFeedback": "Good implementation with minor improvements needed",
      "criteriaScores": [
        {
          "criterion": "Correctness",
          "score": 60,
          "feedback": "Algorithm works correctly for most test cases"
        }
      ]
    }
  }
]
```

### Get Submission Details
```http
GET /api/submissions/{submissionId}
```

**Response 200**
```json
{
  "id": 15,
  "assignmentId": 1,
  "userId": 1,
  "submissionType": "file",
  "fileName": "assignment1.py",
  "fileUrl": "https://storage.googleapis.com/bucket/files/assignment1.py",
  "content": null,
  "status": "completed",
  "submittedAt": "2025-01-18T15:45:00Z",
  "processedAt": "2025-01-18T15:47:30Z",
  "assignment": {
    "title": "Programming Assignment 1",
    "maxScore": 100
  },
  "feedback": {
    "id": 8,
    "score": 85,
    "overallFeedback": "Excellent work! Your solution correctly implements the required algorithm...",
    "suggestions": [
      "Consider adding more comments to explain complex logic",
      "Use more descriptive variable names"
    ],
    "criteriaScores": [
      {
        "criterion": "Correctness",
        "score": 60,
        "maxScore": 70,
        "feedback": "Algorithm implementation is correct and handles edge cases well"
      },
      {
        "criterion": "Code Quality",
        "score": 25,
        "maxScore": 30,
        "feedback": "Code is generally well-structured but could benefit from better documentation"
      }
    ],
    "generatedAt": "2025-01-18T15:47:30Z"
  }
}
```

### Anonymous Submission
```http
POST /api/submissions/anonymous/{shareableCode}
Content-Type: multipart/form-data
```

**Form Data**
- `submissionType`: `text`, `file`, or `code`
- `content`: Text content (for text submissions)
- `file`: File upload (for file submissions)
- `studentName` (optional): Student identifier
- `studentEmail` (optional): Student email

**Response 201 (Created)**
```json
{
  "id": 16,
  "assignmentId": 1,
  "submissionType": "text",
  "content": "Here is my solution...",
  "status": "processing",
  "submittedAt": "2025-01-18T16:00:00Z",
  "anonymousStudentName": "Anonymous Student",
  "trackingCode": "ANON-ABC123"
}
```

## Feedback System

### List Assignment Submissions (Instructor/Admin only)
```http
GET /api/assignments/{assignmentId}/submissions
```

**Response 200**
```json
[
  {
    "id": 15,
    "student": {
      "id": 1,
      "name": "John Doe",
      "email": "john.doe@university.edu"
    },
    "submissionType": "file",
    "fileName": "assignment1.py",
    "status": "completed",
    "submittedAt": "2025-01-18T15:45:00Z",
    "score": 85,
    "feedback": {
      "overallFeedback": "Good implementation with room for improvement"
    }
  }
]
```

### Test Rubric (Instructor/Admin only)
```http
POST /api/test-rubric
Content-Type: multipart/form-data
X-CSRF-Token: {csrf_token}
```

**Form Data**
- `assignmentId`: Assignment ID
- `submissionType`: Type of test submission
- `content` or `file`: Test content
- `rubric`: JSON rubric for testing

**Response 200**
```json
{
  "feedback": {
    "score": 78,
    "overallFeedback": "Test feedback based on provided rubric",
    "criteriaScores": [
      {
        "criterion": "Test Criterion",
        "score": 78,
        "feedback": "Detailed feedback for this criterion"
      }
    ]
  },
  "processingTime": "2.3s"
}
```

## Administrative Endpoints

### System Health
```http
GET /api/health
```

**Response 200**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-18T16:30:00Z",
  "services": {
    "database": "healthy",
    "redis": "healthy",
    "ai_service": "healthy"
  },
  "version": "1.0.0"
}
```

### Admin Statistics (Admin only)
```http
GET /api/admin/stats
```

**Response 200**
```json
{
  "userCount": 1250,
  "courseCount": 45,
  "assignmentCount": 180,
  "submissionCount": 3420,
  "processingStats": {
    "avgProcessingTime": "2.1s",
    "successRate": 98.5,
    "totalProcessed": 3315
  },
  "systemLoad": {
    "memoryUsage": "78%",
    "cpuUsage": "45%",
    "queueSize": 12
  }
}
```

## Error Responses

### Standard Error Format
```json
{
  "message": "Error description",
  "code": "ERROR_CODE",
  "details": {
    "field": "Specific field error"
  }
}
```

### Common HTTP Status Codes

- **200 OK**: Successful request
- **201 Created**: Resource created successfully
- **400 Bad Request**: Invalid request data
- **401 Unauthorized**: Authentication required
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Resource not found
- **422 Unprocessable Entity**: Validation errors
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server error

### Rate Limiting

API endpoints are rate limited to prevent abuse:
- **Default**: 100 requests per minute per IP
- **Authentication endpoints**: 10 requests per minute per IP
- **File upload endpoints**: 20 requests per minute per authenticated user

Rate limit headers:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642521600
```

## File Upload Specifications

### Supported File Types

**Documents**
- PDF (application/pdf)
- Word Documents (.docx, .doc)
- Excel Files (.xlsx, .xls)
- PowerPoint (.pptx, .ppt)
- Text Files (.txt, .md)

**Images**
- JPEG (image/jpeg)
- PNG (image/png)
- GIF (image/gif)
- WebP (image/webp)
- SVG (image/svg+xml)

**Audio**
- MP3 (audio/mpeg)
- WAV (audio/wav)
- OGG (audio/ogg)
- M4A (audio/m4a)

**Video**
- MP4 (video/mp4)
- WebM (video/webm)
- QuickTime (video/quicktime)
- AVI (video/avi)

**Code Files**
- All text-based files with appropriate MIME types

### File Size Limits

- **Maximum file size**: 50MB per file
- **Maximum total upload**: 100MB per submission
- **Image files**: Recommended maximum 10MB
- **Video files**: Maximum 50MB

## WebSocket Events (Future)

The API will support real-time updates via WebSocket connections:

```javascript
// Connect to WebSocket
const ws = new WebSocket('wss://api.example.com/ws');

// Listen for submission status updates
ws.on('submission_status', (data) => {
  console.log('Submission status:', data.status);
});

// Listen for feedback completion
ws.on('feedback_ready', (data) => {
  console.log('Feedback ready for submission:', data.submissionId);
});
```

---

This API documentation provides comprehensive coverage of all available endpoints. For integration examples and SDKs, see the [Integration Guide](./INTEGRATION_GUIDE.md).