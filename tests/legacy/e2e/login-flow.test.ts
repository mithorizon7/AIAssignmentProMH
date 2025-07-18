import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import express from 'express';
import { createServer } from 'http';
import { JSDOM } from 'jsdom';

// This is a simple E2E test that simulates a user logging into the application
// For real E2E testing, consider tools like Playwright or Cypress

describe('Login Flow E2E Test', () => {
  let app: express.Express;
  let server: any;
  let request: supertest.SuperTest<supertest.Test>;
  
  // Mock user data
  const mockUser = {
    username: 'testuser',
    password: 'password123',
  };
  
  // Setup express server with mock endpoints
  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));
    
    // Mock API endpoints
    app.post('/api/auth/login', (req, res) => {
      const { username, password } = req.body;
      
      if (username === mockUser.username && password === mockUser.password) {
        return res.status(200).json({
          id: 1,
          username: 'testuser',
          name: 'Test User',
          email: 'test@example.com',
          role: 'instructor',
        });
      }
      
      return res.status(401).json({ message: 'Invalid credentials' });
    });
    
    app.get('/api/auth/user', (req, res) => {
      // Simulate authenticated user
      return res.status(200).json({
        id: 1,
        username: 'testuser',
        name: 'Test User',
        email: 'test@example.com',
        role: 'instructor',
      });
    });
    
    // Mock HTML responses
    app.get('/', (req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Test App</title>
          </head>
          <body>
            <div id="root">
              <h1>Welcome to the Test App</h1>
              <a href="/login">Login</a>
            </div>
          </body>
        </html>
      `);
    });
    
    app.get('/login', (req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Login - Test App</title>
          </head>
          <body>
            <div id="root">
              <h1>Login</h1>
              <form id="login-form" action="/api/auth/login" method="post">
                <div>
                  <label for="username">Username</label>
                  <input id="username" name="username" type="text" required />
                </div>
                <div>
                  <label for="password">Password</label>
                  <input id="password" name="password" type="password" required />
                </div>
                <button type="submit">Login</button>
              </form>
            </div>
          </body>
        </html>
      `);
    });
    
    app.get('/dashboard', (req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Dashboard - Test App</title>
          </head>
          <body>
            <div id="root">
              <h1>Dashboard</h1>
              <p>Welcome, Test User!</p>
              <a href="/logout">Logout</a>
            </div>
          </body>
        </html>
      `);
    });
    
    // Create HTTP server
    server = createServer(app);
    server.listen(0); // Random available port
    
    // Create supertest instance
    request = supertest(app);
  });
  
  afterAll(() => {
    server.close();
  });
  
  it('should be able to navigate to login page', async () => {
    const response = await request.get('/');
    expect(response.status).toBe(200);
    
    // Parse HTML
    const dom = new JSDOM(response.text);
    const document = dom.window.document;
    
    // Check for login link
    const loginLink = document.querySelector('a[href="/login"]');
    expect(loginLink).not.toBeNull();
    expect(loginLink?.textContent).toBe('Login');
  });
  
  it('should be able to submit login form', async () => {
    // First get the login page
    const loginPageResponse = await request.get('/login');
    expect(loginPageResponse.status).toBe(200);
    
    // Parse HTML
    const dom = new JSDOM(loginPageResponse.text);
    const document = dom.window.document;
    
    // Check form exists
    const form = document.getElementById('login-form');
    expect(form).not.toBeNull();
    
    // Submit the form with valid credentials
    const loginResponse = await request
      .post('/api/auth/login')
      .send(mockUser);
    
    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body).toHaveProperty('username', mockUser.username);
  });
  
  it('should fail login with invalid credentials', async () => {
    const response = await request
      .post('/api/auth/login')
      .send({
        username: 'wronguser',
        password: 'wrongpassword',
      });
    
    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('message', 'Invalid credentials');
  });
});