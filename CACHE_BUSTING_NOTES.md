# Cache Busting Implementation Notes

## Current Implementation

In `server/vite.ts`, cache busting is implemented with the following code:

```javascript
template = template.replace(
  `src="/src/main.tsx"`,
  `src="/src/main.tsx?v=${nanoid()}"`,
);
```

## Potential Issues

This approach has a few limitations:

1. **Fragility**: The implementation relies on the exact string `src="/src/main.tsx"` being present in the index.html file. If the HTML structure changes slightly (different quotes, additional attributes, etc.), the replacement will fail.

2. **Specificity**: Only targets the exact main.tsx file reference. If other scripts need cache busting, they would need separate replacements.

## Recommended Future Improvements

Without directly editing the Vite server configuration (which could break the application), here are recommendations for future improvements:

### Option 1: Use Vite's Built-in Features

Vite already has built-in support for cache busting through its asset handling. In production builds, files include content hashes in their names automatically.

For development, Vite uses a timestamp-based query parameter for cache invalidation. This is built into Vite's HMR system.

### Option 2: More Robust String Replacement

If the current approach needs to be maintained, a more flexible regular expression could be used:

```javascript
// Example of a more robust pattern (for future reference)
const mainScriptPattern = /(src=["'])([^"']*\/src\/main\.tsx)([^"']*["'])/i;
template = template.replace(mainScriptPattern, (match, prefix, path, suffix) => {
  const connector = path.includes('?') ? '&' : '?';
  const cleanPath = path.replace(/([&?])v=[^&]*(&|$)/, '$1');
  return `${prefix}${cleanPath}${connector}v=${nanoid()}${suffix}`;
});
```

### Option 3: HTML Plugin Configuration

If using Vite's HTML plugin, it's possible to configure script injection with cache busting parameters automatically.

## Note on Implementation Safety

The current implementation in `server/vite.ts` should be treated as sensitive code that should not be modified without careful testing, as changes could break the development environment.