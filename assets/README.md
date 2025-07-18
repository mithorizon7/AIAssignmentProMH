# Assets Directory

This directory contains static assets used by the AIGrader application.

## Contents
- `generated-icon.png` - Application icon/logo

## Usage

Static assets in this directory can be imported in the React frontend using the `@assets/` alias.

Example:
```typescript
import iconPath from "@assets/generated-icon.png";
```

## Organization

- **Images**: Application icons, logos, and graphics
- **Icons**: SVG icons and vector graphics  
- **Fonts**: Custom font files (if needed)
- **Other**: Miscellaneous static assets

## Guidelines

- Use SVG format for icons and graphics when possible for scalability
- Optimize image files for web delivery
- Follow consistent naming conventions
- Document any special usage requirements for assets