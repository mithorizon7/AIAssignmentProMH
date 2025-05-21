# AI Feedback Platform - Client

This directory contains the frontend client code for the AI-powered assignment feedback platform.

## Architecture Overview

The client is built with React and TypeScript, using Vite as the build tool:

```
client/
├── src/
│   ├── components/     # UI components
│   │   ├── ui/         # Shadcn UI components
│   │   ├── student/    # Student-specific components
│   │   ├── instructor/ # Instructor-specific components
│   │   └── admin/      # Admin-specific components
│   ├── hooks/          # Custom React hooks
│   ├── lib/            # Utility functions and types
│   ├── pages/          # Page components
│   ├── App.tsx         # Application component with routing
│   └── main.tsx        # Application entry point
└── index.html          # HTML template
```

## Key Features

### Routing

- Uses `wouter` for lightweight client-side routing
- Route configuration in `src/App.tsx`
- Role-based route protection with `PrivateRoute` component

### State Management

- Uses `@tanstack/react-query` for server state management
- API requests are handled through the query client
- Local state managed with React hooks

### UI Components

- Uses Shadcn UI, a collection of accessible and customizable components
- TailwindCSS for styling
- Responsive design for all screen sizes
- Lucide icons for consistent iconography

### Forms

- React Hook Form for form state management and validation
- Zod for schema validation
- Form components integrate with the shared schema types

## Role-Based UI

The application has different interfaces for different user roles:

- **Student Interface**: Submit assignments, view feedback, track progress
- **Instructor Interface**: Create assignments, review submissions, view analytics
- **Admin Interface**: Manage users, monitor system health, configure settings

## Navigation Layout

Unauthenticated pages (such as the login screen or public submission links)
display the `MITNavbar` at the top. Once a user is signed in, the interface
switches to a dashboard layout that provides a sidebar and compact header for
navigation. The top navbar is hidden in this mode to avoid duplicate menus.

## Important Directories

### Components

- `components/ui/`: Shadcn UI components for consistent design
- `components/instructor/`: Instructor-specific components like RubricBuilder
- `components/student/`: Student-specific components like SubmissionForm

### Hooks

- `hooks/use-auth.tsx`: Authentication state and operations
- `hooks/use-toast.tsx`: Toast notifications
- `hooks/use-form.tsx`: Form utilities

### Lib

- `lib/queryClient.ts`: TanStack Query client configuration
- `lib/types.ts`: TypeScript interfaces for client
- `lib/utils/`: Utility functions

## Type System

The application uses a shared type system between client and server:

- Common types are defined in `shared/schema.ts`
- Enums are defined in `shared/enums.ts`
- Client-specific types extend or use the shared types

## Development

To run the client in development mode (along with the server):

```bash
npm run dev
```

This starts the Vite development server with HMR enabled.