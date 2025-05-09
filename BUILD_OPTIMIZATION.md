# Build Optimization Strategy

This document outlines the optimization strategies for production builds of both client and server-side code.

## Build Process Overview

The project uses a dual build approach:
- **Client**: Built with Vite
- **Server**: Built with ESBuild

## Client-Side Optimizations (Vite)

Vite provides excellent production optimizations by default, but here are additional considerations:

### Enabled by Default in Production Mode:
- **Code Minification**: Both JavaScript and CSS
- **Tree Shaking**: Eliminates unused code
- **Chunk Splitting**: Creates optimized asset bundles
- **Lazy Loading**: Components can be dynamically imported
- **Content Hashing**: Files are named with content hashes (e.g., main.a2b3c4d5.js) for efficient long-term caching
- **Cache Optimization**: No nanoid() cache-busting mechanisms in production (unlike development mode)

### Additional Optimizations to Consider:

1. **Preload Critical Assets**:
   ```jsx
   import { preload } from 'vite';
   
   // Preload critical components
   preload('/src/critical-component.js');
   ```

2. **Route-Based Code Splitting**:
   ```jsx
   // Dynamically import page components
   const HomePage = React.lazy(() => import('./pages/home-page'));
   ```

3. **Image Optimization**:
   - Use appropriate image formats (WebP where supported)
   - Lazy load images below the fold
   - Use responsive images with `srcset` attribute

4. **State Management Optimization**:
   - Use React Query's caching capabilities effectively
   - Implement proper data invalidation strategies

## Server-Side Optimizations (ESBuild)

The optimized build script `build.sh` enhances the ESBuild process with:

### Applied Optimizations:

1. **Minification**: `--minify` flag reduces file size
2. **Tree Shaking**: `--tree-shaking=true` removes unused code
3. **ES2020 Target**: `--target=es2020` provides good balance of features and compatibility
4. **Production Source Maps**: `--sourcemap=production` creates separate source maps for debugging

### Environment Configuration:

Always set `NODE_ENV=production` for server runtime which:
- Disables development-only code paths
- May enable performance optimizations in dependencies
- Reduces error verbosity

## Performance Optimization Checklist

### Client-Side:
- [ ] Implement code splitting for routes
- [ ] Lazy-load below-the-fold components
- [ ] Use proper image optimization
- [ ] Audit and remove unused dependencies
- [ ] Implement React.memo for expensive components
- [ ] Use web workers for CPU-intensive tasks

### Server-Side:
- [ ] Optimize database queries and add indices
- [ ] Implement proper caching strategies
- [ ] Use connection pooling
- [ ] Configure appropriate timeouts
- [ ] Implement rate limiting for APIs

## Build and Deployment

To build for production:

```bash
# Make build script executable
chmod +x build.sh

# Run optimized build
./build.sh

# Start production server
NODE_ENV=production node dist/index.js
```

### Cache Control Headers

When deploying to production, ensure your server or CDN sets proper cache control headers:

- **For content-hashed files** (JS, CSS with unique filenames):
  ```
  Cache-Control: public, max-age=31536000, immutable
  ```

- **For HTML and non-hashed assets**:
  ```
  Cache-Control: no-cache
  ```

- **For API responses**:
  ```
  Cache-Control: private, no-cache, no-store, must-revalidate
  Pragma: no-cache
  Expires: 0
  ```

This configuration ensures:
1. Static assets with content hashes are cached for a year (or more)
2. HTML is always checked for freshness
3. API responses aren't cached, preventing stale data

## Monitoring Performance

After deployment, monitor these metrics:
- **Client-Side**: First Contentful Paint, Time to Interactive, Total Bundle Size
- **Server-Side**: Response Time, Error Rate, Memory Usage, CPU Usage

## Additional Resources

- [Vite Production Build Documentation](https://vitejs.dev/guide/build.html)
- [ESBuild Documentation](https://esbuild.github.io/)
- [React Performance Optimization](https://reactjs.org/docs/optimizing-performance.html)
- [Web Vitals](https://web.dev/vitals/)