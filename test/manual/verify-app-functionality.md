# Academus Manual Verification Steps

This guide provides detailed steps to manually verify the core functionality of the Academus platform. Take screenshots at each step to document the results.

## Prerequisites
- Ensure the application is running at `http://localhost:5000` or your Replit URL
- Have login credentials ready:
  - Admin: admin@test.com / admin123
  - Instructor: instructor@test.com / instructor123
  - Student: student@test.com / student123

## Part 1: Instructor Flow
Login with instructor credentials and verify the following:

### 1.1 Course Management
1. **Login**:
   - Navigate to `/auth`
   - Enter instructor credentials
   - Verify successful login and dashboard appears

2. **View Courses**:
   - Navigate to the Courses section
   - Verify list of instructor's courses is displayed
   - Take screenshot of courses list

3. **Create New Course**:
   - Click "New Course" or "Create Course" button
   - Fill in the following details:
     - Title: "Artificial Intelligence Ethics"
     - Description: "Exploring ethical considerations in modern AI development"
   - Submit the form
   - Verify the new course appears in the course list
   - Take screenshot of successful creation and updated list

4. **View Course Details**:
   - Click on the newly created course
   - Verify all details are displayed correctly
   - Take screenshot of course details page

### 1.2 Assignment Creation
1. **Create Standalone Assignment**:
   - Navigate to Assignments section
   - Click "New Assignment" or "Create Assignment"
   - Fill in the following details:
     - Title: "Introduction to AI Ethics"
     - Description: "Write a 500-word essay on an ethical consideration in AI development"
     - Status: Active
     - Leave course selection empty/null
   - Create a rubric with the following criteria:
     - Criteria 1: "Understanding of Concepts" (10 points)
     - Criteria 2: "Critical Analysis" (7 points)
     - Criteria 3: "Writing Quality" (5 points)
     - Set passing threshold to 15
   - Submit the form
   - Verify assignment is created and appears in assignments list
   - Take screenshot of successful creation

2. **Create Course Assignment**:
   - Click "New Assignment" or "Create Assignment"
   - Fill in the following details:
     - Title: "Case Study Analysis"
     - Description: "Analyze a real-world AI ethics case study"
     - Select the previously created course
     - Status: Active
   - Create a rubric with appropriate criteria
   - Submit the form
   - Verify assignment is created and associated with the course
   - Take screenshot of successful creation

3. **Test Rubric Functionality**:
   - Navigate to one of the created assignments
   - Find the "Test Rubric" section or button
   - Prepare a sample text file with content relevant to the assignment
   - Upload the file and submit
   - Verify the AI generates feedback based on the rubric
   - Verify feedback shows strengths, improvements, and suggestions
   - Take screenshot of feedback

4. **Generate Shareable Link**:
   - Navigate to assignment details
   - Find and click "Generate Link" or "Share" button
   - Verify a shareable link is generated
   - Copy the link for later use
   - Take screenshot showing the generated link

## Part 2: Student Flow
Login with student credentials and verify the following:

### 2.1 Viewing Courses and Assignments
1. **Login**:
   - Navigate to `/auth`
   - Enter student credentials
   - Verify successful login and student dashboard appears

2. **View Enrolled Courses**:
   - Navigate to Courses section
   - Verify the courses in which the student is enrolled are displayed
   - Verify the AI Ethics course created earlier is visible (if student enrollment was automatic)
   - Take screenshot of courses list

3. **View Available Assignments**:
   - Navigate to Assignments section
   - Verify available assignments are displayed, including the ones created earlier
   - Take screenshot of assignments list

4. **View Course Assignments**:
   - Click on a specific course
   - Verify the assignments associated with that course are displayed
   - Take screenshot of course details with assignments

### 2.2 Submitting Assignments
1. **Submit Assignment**:
   - Navigate to one of the active assignments
   - Click to view assignment details
   - Click "Submit" or similar button
   - Upload a file or enter text content for submission
   - Submit the assignment
   - Verify submission confirmation message
   - Take screenshot of submission process and confirmation

2. **View Submission History**:
   - Navigate to "My Submissions" section
   - Verify all previous submissions are displayed
   - Verify the recent submission appears with correct status
   - Take screenshot of submissions list

3. **View Feedback** (if available immediately, or check later):
   - Click on a graded submission
   - Verify feedback is displayed with strengths, improvements, and suggestions
   - Take screenshot of feedback display

### 2.3 Accessing via Shareable Link
1. **Access Assignment Link**:
   - Open the shareable link copied earlier in a new browser tab
   - Verify you're prompted to login (if not already logged in)
   - After login, verify assignment details are displayed correctly
   - Verify submission form is available
   - Take screenshot of assignment access via link

## Part 3: Admin Flow
Login with admin credentials and verify the following:

### 3.1 System Management
1. **Login**:
   - Navigate to `/auth`
   - Enter admin credentials
   - Verify successful login and admin dashboard appears

2. **View System Dashboard**:
   - Verify system-wide statistics are displayed
   - Take screenshot of dashboard

3. **View All Users**:
   - Navigate to Users section (if available)
   - Verify list of all users with roles is displayed
   - Take screenshot of users list

4. **View All Courses and Assignments**:
   - Navigate to respective sections
   - Verify admin has access to all courses and assignments
   - Take screenshot of each list

## Additional Tests

### Verification of Course-Assignment Relationships
1. **Instructor View**:
   - Login as instructor
   - Navigate to a specific course
   - Verify that only assignments associated with that course are displayed
   - Take screenshot

2. **Student View**:
   - Login as student
   - Navigate to a specific course
   - Verify that only assignments associated with that course are displayed
   - Take screenshot

### Verification of Assignment Status Changes
1. **Change Assignment Status** (as instructor):
   - Login as instructor
   - Navigate to an active assignment
   - Change status to "Completed"
   - Save changes
   - Take screenshot

2. **Verify Status Effect** (as student):
   - Login as student
   - Check if the completed assignment's visibility/behavior has changed
   - Verify any status indicators are updated
   - Take screenshot

## Results Documentation
Create a document with all screenshots and observations organized by test section. Note any discrepancies or issues encountered during testing.