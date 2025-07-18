# System Architecture

## Overview

AIGrader is built with a modern, scalable architecture designed to handle enterprise-scale educational assessment workloads. The system follows a layered architecture pattern with clear separation of concerns and microservice-inspired modularity.

## High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Client  │    │  Express API    │    │   PostgreSQL    │
│   (Frontend)    │◄──►│   (Backend)     │◄──►│   (Database)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   Redis Cache   │    │  Google Gemini  │
                       │   (Sessions)    │    │   (AI Service)  │
                       └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │  BullMQ Queue   │    │ Google Cloud    │
                       │  (Background)   │    │   Storage       │
                       └─────────────────┘    └─────────────────┘
```

## Technology Stack

### Frontend Architecture
- **React 18** with TypeScript for type safety and modern features
- **Tailwind CSS** + **Shadcn UI** for consistent, responsive design
- **React Query (TanStack Query)** for server state management and caching
- **Wouter** for lightweight client-side routing
- **Vite** for fast development and optimized production builds

### Backend Architecture
- **Express.js** with TypeScript for type-safe API development
- **Drizzle ORM** for type-safe database interactions and migrations
- **PostgreSQL** for primary data storage with ACID compliance
- **Redis** for session storage and queue management
- **BullMQ** for reliable background job processing

### External Services
- **Google Gemini 2.5 Flash** for primary AI processing
- **OpenAI** as fallback AI service
- **Google Cloud Storage** for file storage and CDN
- **Auth0** + **MIT Horizon OIDC** for SSO integration

## Key Components

### Frontend Components

#### Authentication & Routing
```typescript
// client/src/App.tsx
- Route-based authentication
- Role-based access control
- Session management
- CSRF token handling
```

#### Core UI Components
```typescript
// client/src/components/
├── student/          # Student-specific interfaces
├── instructor/       # Instructor dashboards
├── admin/           # Administrative interfaces
├── shared/          # Reusable components
└── ui/              # Shadcn UI base components
```

#### State Management
```typescript
// React Query for server state
- Automatic caching and invalidation
- Optimistic updates
- Error boundary integration
- Background data synchronization
```

### Backend Architecture

#### API Layer
```typescript
// server/routes.ts
- RESTful API endpoints
- Role-based middleware
- Input validation with Zod
- CSRF protection
- Rate limiting
```

#### Service Layer
```typescript
// server/services/
├── ai-service.ts          # AI processing coordination
├── storage.ts             # Data access layer
├── queue-service.ts       # Background job management
├── security.ts            # Security utilities
└── data-protection.ts     # GDPR/FERPA compliance
```

#### Data Layer
```typescript
// server/storage.ts
- IStorage interface for data operations
- DatabaseStorage implementation
- Optimized query patterns
- Connection pooling
```

### Database Schema

#### Core Entities
```sql
-- Primary entities
users              # Student, instructor, admin accounts
courses             # Course organization
assignments         # Assignment definitions
submissions         # Student submissions
feedback            # AI-generated feedback

-- Supporting entities
enrollments         # User-course relationships
rubrics            # Assessment criteria
file_uploads       # File metadata
sessions           # User sessions
audit_logs         # Security audit trail
```

#### Relationships
- Users → Enrollments → Courses (many-to-many)
- Assignments → Courses (many-to-one)
- Submissions → Assignments → Users (many-to-many)
- Feedback → Submissions (one-to-one)
- Rubrics → Assignments (one-to-many)

## Data Flow

### Submission Processing Pipeline

1. **Client Upload**
   ```
   Student → File Upload → Client Validation → CSRF Token
   ```

2. **Server Processing**
   ```
   Express → Multer → File Validation → Database Save
   ```

3. **AI Queue Processing**
   ```
   BullMQ → AI Service → Gemini API → Response Processing
   ```

4. **Feedback Generation**
   ```
   AI Response → Feedback Parser → Database Save → Client Notification
   ```

### Authentication Flow

1. **Login Process**
   ```
   User Input → Validation → bcrypt Check → Session Creation
   ```

2. **Session Management**
   ```
   Redis Session → CSRF Token → Role Authorization
   ```

3. **SSO Integration**
   ```
   Auth0/OIDC → Token Validation → User Mapping → Session Creation
   ```

## Security Architecture

### Authentication & Authorization
- **bcrypt** password hashing with salt rounds
- **Session-based authentication** with Redis storage
- **Role-based access control** (student, instructor, admin)
- **CSRF protection** on all state-changing operations

### Data Protection
- **GDPR Article 17** compliance (Right to be Forgotten)
- **FERPA** educational data protection
- **Audit logging** for all sensitive operations
- **Data encryption** at rest and in transit

### Input Validation
- **Zod schemas** for all API inputs
- **File type validation** with MIME type checking
- **Size limits** and rate limiting
- **SQL injection prevention** via parameterized queries

## Performance Optimizations

### Database Performance
- **Optimized queries** with eliminated N+1 patterns
- **Database-level aggregation** instead of application processing
- **Strategic indexes** on foreign keys and frequently queried columns
- **Connection pooling** for concurrent request handling

### Caching Strategy
- **Redis caching** for frequently accessed data
- **Query result caching** with automatic invalidation
- **Session caching** for authentication state
- **Static asset caching** via CDN

### Memory Management
- **Disk-based file processing** to prevent memory issues
- **Streaming file uploads** for large files
- **Garbage collection optimization** for Node.js
- **Memory monitoring** with automatic alerts

## Scalability Design

### Horizontal Scaling
- **Stateless application servers** for easy scaling
- **Database connection pooling** for concurrent access
- **Redis clustering** for session distribution
- **Queue distribution** across multiple workers

### Load Distribution
- **nginx load balancing** for production deployments
- **PM2 cluster mode** for process management
- **Database read replicas** for query distribution
- **CDN integration** for static asset delivery

## Error Handling & Recovery

### Error Boundaries
- **React Error Boundaries** for frontend error containment
- **Express error middleware** for centralized error handling
- **Graceful degradation** for service failures
- **Automatic retry logic** for transient failures

### Monitoring & Alerting
- **Health check endpoints** for service monitoring
- **Structured logging** for production debugging
- **Performance metrics** collection and analysis
- **Error tracking** and notification systems

## Development Architecture

### Code Organization
```
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── lib/            # Utility libraries
│   │   └── pages/          # Route components
├── server/                 # Backend Express application
│   ├── lib/                # Core utilities
│   ├── middleware/         # Express middleware
│   ├── queue/              # Background job processing
│   ├── services/           # Business logic services
│   └── routes.ts           # API endpoint definitions
├── shared/                 # Shared types and schemas
│   └── schema.ts           # Database schema definitions
└── docs/                   # Documentation
```

### Build Process
- **TypeScript compilation** for both frontend and backend
- **Vite bundling** for optimized frontend assets
- **ESLint + Prettier** for code quality
- **Drizzle migrations** for database schema management

## Deployment Architecture

### Environment Configuration
- **Development**: Local PostgreSQL, mock Redis, file system storage
- **Staging**: Cloud database, Redis cluster, cloud storage
- **Production**: Fully distributed with redundancy and monitoring

### Container Strategy
- **Docker containers** for consistent deployments
- **Multi-stage builds** for optimized image sizes
- **Health checks** for container orchestration
- **Graceful shutdown** handling for zero-downtime deployments

This architecture provides a solid foundation for scaling AIGrader to handle enterprise-level educational assessment workloads while maintaining security, performance, and reliability.