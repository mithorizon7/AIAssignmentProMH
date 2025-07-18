# AIGrader - AI-Powered Assignment Feedback Platform

> An enterprise-grade AI-powered educational assessment platform with intelligent file handling, multimodal submission processing, and comprehensive feedback generation.

AIGrader transforms the educational assessment process by providing intelligent, automated feedback on student submissions through advanced AI models. Built for scalability and designed to handle large classes with tens of thousands of students while maintaining high-quality, personalized feedback.

## ✨ Key Features

### 🤖 **Intelligent AI Assessment**
- **Multimodal Analysis**: Process text, images, documents, audio, and video submissions
- **Custom Rubric Integration**: AI follows instructor-defined rubrics for consistent grading
- **Structured Feedback**: Detailed, constructive feedback with scoring and improvement suggestions
- **Multiple AI Providers**: Primary Google Gemini integration with OpenAI fallback

### 👥 **Role-Based Access Control**
- **Students**: Submit assignments, view feedback, track progress
- **Instructors**: Create assignments, manage courses, review submissions
- **Administrators**: System management, analytics, user administration

### 📚 **Course & Assignment Management**
- **Assignment Lifecycle**: Automated status management (upcoming → active → completed)
- **Flexible Submission Types**: Text, file uploads, anonymous submissions via shareable links
- **Comprehensive File Support**: Documents (PDF, DOCX), images, audio, video, code files
- **Real-time Progress Tracking**: Student and instructor dashboards

### 🚀 **Enterprise-Grade Infrastructure**
- **Scalable Architecture**: Handles concurrent submissions with Redis queue processing
- **Security Compliance**: GDPR/FERPA compliant with comprehensive data protection
- **Performance Optimized**: Database-level aggregation, caching, and N+1 query elimination
- **Production Ready**: Comprehensive monitoring, error recovery, and health checks

## 🛠️ Technology Stack

### Frontend
- **React 18** with TypeScript for type safety
- **Tailwind CSS** + **Shadcn UI** for modern, responsive design
- **React Query** for server state management
- **Wouter** for lightweight routing

### Backend
- **Express.js** with TypeScript
- **PostgreSQL** with **Drizzle ORM** for type-safe database operations
- **BullMQ** + **Redis** for queue processing and session management
- **bcrypt** for secure password hashing
- **CSRF protection** and comprehensive security middleware

### AI & External Services
- **Google Gemini 2.5 Flash** (primary AI service)
- **OpenAI** (fallback AI service)
- **Google Cloud Storage** for file storage
- **Auth0** + **MIT Horizon OIDC** for SSO integration

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ and **npm**
- **PostgreSQL** 13+
- **Redis** (for production) or Redis Cloud account
- **Google Gemini API Key** (get from [Google AI Studio](https://makersuite.google.com/app/apikey))

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd aigrader
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your configuration. **Required variables:**
   - `DATABASE_URL`: PostgreSQL connection string
   - `GEMINI_API_KEY`: Google Gemini API key
   - `SESSION_SECRET`: Strong random string for session encryption
   
   **For production deployment, also configure:**
   - `BASE_URL`: Your domain (e.g., `https://yourdomain.com`)
   - `STRUCTURED_LOGGING=true`: Enable JSON logging

4. **Set up the database**
   ```bash
   npm run db:push
   ```

### Running the Application

#### Development Mode
```bash
npm run dev
```
- Frontend: `http://localhost:5000` (Vite dev server)
- Backend API: `http://localhost:5000/api` (Express server)
- Auto-reload enabled for both frontend and backend

#### Production Mode
```bash
# Build the application
npm run build

# Start production server
npm start
```

### Key Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build application for production |
| `npm start` | Start production server |
| `npm run db:push` | Push database schema changes |
| `npm run db:studio` | Open Drizzle Studio for database management |
| `npm test` | Run test suite |
| `npm run lint` | Run ESLint code quality checks |

## 📖 Documentation

### For Developers
- **[API Documentation](./docs/API_DOCUMENTATION.md)** - Complete API reference
- **[System Architecture](./docs/ARCHITECTURE.md)** - Technical architecture details
- **[Deployment Guide](./docs/DEPLOYMENT.md)** - Production deployment instructions

### For Users
- **[User Guide](./docs/USER_GUIDE.md)** - End-user documentation
- **[Admin Guide](./docs/ADMIN_GUIDE.md)** - Administrator documentation

### Additional Resources
- **[CHANGELOG.md](./CHANGELOG.md)** - Version history and changes
- **[Security Policy](./SECURITY.md)** - Security guidelines and reporting
- **[Gemini API References](./docs/gemini_references/)** - AI integration documentation

## 🔧 Configuration

### Environment Variables

The application uses environment variables for configuration. See `.env.example` for a complete reference with detailed explanations of each variable.

**Critical Production Variables:**
- `BASE_URL`: Required for production deployment
- `STRUCTURED_LOGGING=true`: Required for production logging
- `REDIS_URL` or Redis connection parameters: Required for queue processing
- `GEMINI_API_KEY`: Required for AI functionality

### Redis Configuration

- **Development**: Mock implementation (no Redis required)
- **Production**: Redis connection required for queue processing and sessions
- **Hybrid**: Set `ENABLE_REDIS=true` in development to test with real Redis

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- --grep "submission"
```

## 🚀 Deployment

The application is ready for production deployment on platforms like:
- **Replit Deployments** (recommended)
- **Vercel** + **Railway/PlanetScale** for database
- **AWS/GCP/Azure** with container orchestration

See [DEPLOYMENT.md](./docs/DEPLOYMENT.md) for detailed deployment instructions and platform-specific configuration.

## 🔒 Security & Compliance

- **GDPR/FERPA Compliant**: Comprehensive data protection and privacy controls
- **CSRF Protection**: All state-changing operations protected
- **Rate Limiting**: API endpoint protection against abuse
- **Secure Sessions**: PostgreSQL-based session storage with encryption
- **Input Validation**: Zod-based validation for all user inputs

## 📊 Performance & Scalability

- **Database Optimized**: Eliminated N+1 queries, uses database-level aggregation
- **Cached Responses**: Redis-based caching for frequently accessed data
- **Queue Processing**: Asynchronous AI processing for scalability
- **Memory Optimized**: Disk-based file processing to prevent memory issues
- **Horizontal Scaling**: Stateless architecture ready for multi-instance deployment

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Issues**: [GitHub Issues](../../issues)
- **Documentation**: [docs/](./docs/)
- **Security**: See [SECURITY.md](./SECURITY.md) for reporting security issues

---

**Status**: ✅ **Production Ready** - Deployed and handling enterprise-scale educational assessments
npm run db:push

# Start the development server
npm run dev
```

## Development

The development server runs the Express backend and the React frontend in a single process, with automatic hot reloading.

```bash
npm run dev
```

## Directory Structure

The project is organized into the following main directories:

```
/
├── client/              # React frontend application
│   ├── src/
│   │   ├── components/  # UI components
│   │   ├── hooks/       # Custom React hooks
│   │   ├── lib/         # Utility functions and types
│   │   └── pages/       # Page components
│   └── index.html       # HTML template
│
├── server/              # Express backend application
│   ├── adapters/        # AI service adapters
│   ├── config/          # Environment-specific configurations
│   ├── lib/             # Utility libraries
│   ├── queue/           # BullMQ implementation
│   └── services/        # Business logic
│
├── shared/              # Code shared between client and server
│   ├── enums.ts         # Shared enum definitions
│   └── schema.ts        # Database schema and shared types
│
├── test/                # Test files
│
└── attached_assets/     # Additional assets for the project
```

Detailed README files are available in each major directory:
- [Server Documentation](server/README.md)
- [Client Documentation](client/README.md)
- [Shared Types Documentation](shared/README.md)

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start the development server (both frontend and backend) |
| `npm run build` | Build the application for production |
| `npm start` | Start the production server after building |
| `npm run db:push` | Push schema changes to the database |
| `npm test` | Run tests |
| `npm run lint` | Lint the codebase |
| `npm run typecheck` | Check TypeScript types |

## Production Deployment

For production deployment:

1. Set `NODE_ENV=production` in your environment
2. Ensure Redis is configured with proper credentials
3. Set up a PostgreSQL database and configure the connection
4. Build the application: `npm run build`
5. Start the server: `npm start`

For more detailed information about production optimizations, see [BUILD_OPTIMIZATION.md](BUILD_OPTIMIZATION.md).

## Additional Documentation

- [Redis Configuration Guide](REDIS_CONFIGURATION.md): Detailed Redis setup instructions
- [Build Optimization Guide](BUILD_OPTIMIZATION.md): Production build configuration
- [Security Policy and Practices](SECURITY.md): Security requirements and best practices
- [Gemini API Reference](docs/gemini_references/index.md): Comprehensive documentation for Google Gemini API integration
- [Gemini Prompting Strategies](docs/gemini_references/prompting-strategies.md): Best practices for designing effective prompts

## License

[MIT License](LICENSE)
