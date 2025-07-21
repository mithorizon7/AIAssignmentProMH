/**
 * Test script to verify assignment submission status issue
 * 
 * This script will:
 * 1. Create test data (courses, assignments, submissions)
 * 2. Test the dashboard API endpoint
 * 3. Verify that assignment cards show correct submission status
 */
import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool } from '@neondatabase/serverless';
import { sql } from 'drizzle-orm';
import axios from 'axios';

// Database connection
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool });

async function createTestData() {
  console.log('Creating test data...');
  
  try {
    // Create test course
    const courseResult = await db.execute(sql`
      INSERT INTO courses (name, code, description)
      VALUES ('Test Course', 'TEST101', 'Test course for assignment testing')
      RETURNING id
    `);
    const courseId = courseResult.rows[0].id;
    console.log(`Created course with ID: ${courseId}`);
    
    // Create test assignment
    const assignmentResult = await db.execute(sql`
      INSERT INTO assignments (title, description, course_id, due_date, status, rubric, shareable_code)
      VALUES (
        'Test Assignment',
        'A test assignment to verify submission status',
        ${courseId},
        '2025-08-01 23:59:59',
        'active',
        'Test rubric',
        'TESTCODE123'
      )
      RETURNING id
    `);
    const assignmentId = assignmentResult.rows[0].id;
    console.log(`Created assignment with ID: ${assignmentId}`);
    
    // Get the user ID
    const userResult = await db.execute(sql`
      SELECT id FROM users LIMIT 1
    `);
    const userId = userResult.rows[0].id;
    console.log(`Using user ID: ${userId}`);
    
    // Create enrollment
    await db.execute(sql`
      INSERT INTO enrollments (user_id, course_id, enrolled_at)
      VALUES (${userId}, ${courseId}, NOW())
    `);
    console.log('Created enrollment');
    
    // Create test submission
    const submissionResult = await db.execute(sql`
      INSERT INTO submissions (assignment_id, user_id, content, content_type, status, created_at)
      VALUES (
        ${assignmentId},
        ${userId},
        'This is a test submission',
        'text',
        'completed',
        NOW()
      )
      RETURNING id
    `);
    const submissionId = submissionResult.rows[0].id;
    console.log(`Created submission with ID: ${submissionId}`);
    
    return {
      courseId,
      assignmentId,
      userId,
      submissionId
    };
  } catch (error) {
    console.error('Error creating test data:', error);
    throw error;
  }
}

async function testAssignmentAPI() {
  console.log('\nTesting assignment API...');
  
  try {
    // Test the assignments endpoint
    const response = await axios.get('http://localhost:8080/api/assignments');
    console.log('Assignment API response status:', response.status);
    
    if (response.data && response.data.length > 0) {
      const assignment = response.data[0];
      console.log('First assignment:', {
        id: assignment.id,
        title: assignment.title,
        submissions: assignment.submissions ? assignment.submissions.length : 'undefined',
        hasSubmissions: assignment.submissions && assignment.submissions.length > 0
      });
      
      if (assignment.submissions && assignment.submissions.length > 0) {
        console.log('Latest submission:', {
          id: assignment.submissions[0].id,
          createdAt: assignment.submissions[0].createdAt,
          status: assignment.submissions[0].status
        });
      }
    } else {
      console.log('No assignments returned from API');
    }
  } catch (error) {
    console.error('Error testing assignment API:', error.message);
  }
}

async function testDashboardLogic() {
  console.log('\nTesting dashboard logic...');
  
  try {
    // Simulate the dashboard logic
    const assignments = await db.execute(sql`
      SELECT 
        a.id,
        a.title,
        a.status,
        a.due_date,
        c.name as course_name,
        s.id as submission_id,
        s.created_at as submission_created_at,
        s.status as submission_status
      FROM assignments a
      JOIN courses c ON a.course_id = c.id
      JOIN enrollments e ON c.id = e.course_id
      LEFT JOIN submissions s ON a.id = s.assignment_id AND s.user_id = e.user_id
      WHERE e.user_id = (SELECT id FROM users LIMIT 1)
      ORDER BY a.due_date DESC
    `);
    
    console.log('Dashboard query results:');
    assignments.rows.forEach(row => {
      console.log(`- Assignment ${row.id}: ${row.title}`);
      console.log(`  Status: ${row.status}`);
      console.log(`  Has submission: ${row.submission_id ? 'YES' : 'NO'}`);
      if (row.submission_id) {
        console.log(`  Submission ID: ${row.submission_id}`);
        console.log(`  Submission status: ${row.submission_status}`);
      }
    });
  } catch (error) {
    console.error('Error testing dashboard logic:', error);
  }
}

async function main() {
  console.log('=== Assignment Submission Status Test ===\n');
  
  try {
    // Create test data
    const testData = await createTestData();
    
    // Test the assignment API
    await testAssignmentAPI();
    
    // Test dashboard logic
    await testDashboardLogic();
    
    console.log('\n=== Test Complete ===');
    console.log('If the assignment API shows no submissions but the dashboard query shows submissions,');
    console.log('then the issue is in the listAssignmentsWithSubmissionsForUser method.');
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    process.exit(0);
  }
}

main();