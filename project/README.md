# IronBound Auctions

A premium online auction platform built with React, TypeScript, and Tailwind CSS.

## 📚 Documentation

All project documentation is organized in the `/docs` folder:
- **Media Publishing**: `/docs/MEDIA_PUBLISHING_QUICKSTART.md`
- **System Architecture**: `/docs/MEDIA_PUBLISHING_SYSTEM.md`
- **Setup Instructions**: `/docs/SETUP_INSTRUCTIONS.md`
- **Deployment Guide**: `/docs/DEPLOYMENT_GUIDE.md`
- **Worker Setup**: `/docs/WORKER_DEPLOYMENT_GUIDE.md`

## Development Best Practices

### Preventing White Screen Issues

1. **Always use Error Boundaries** - Components are wrapped in error boundaries to catch and display errors gracefully
2. **Make incremental changes** - Modify one component at a time
3. **Test after each change** - Verify the app still works before making the next change
4. **Use TypeScript strictly** - Catch errors at compile time
5. **Validate props** - Use development helpers to validate component props

### Safe Development Workflow

1. **Small Changes**: Make one small change at a time
2. **Test Immediately**: Check the preview after each change
3. **Rollback if Needed**: If something breaks, revert the last change
4. **Use Error Boundary**: The app will show a friendly error instead of white screen

### Component Structure

- All components are properly typed with TypeScript
- Error boundaries catch rendering errors
- Development helpers provide debugging information
- Consistent file organization and naming

### Logo Integration

Your IronBound Auctions logo is integrated throughout:
- Header navigation
- Hero section
- Modal dialogs
- Footer
- Browser favicon

## Available Scripts

## 🚀 Quick Deployment

For frequent testing deployments to ibaproject.com:
1. Make your changes in the Bolt editor
2. Test basic functionality in preview
3. Deploy to production for real-world testing
4. Gather feedback and iterate

### Common Issues That Only Show in Production:
- Authentication flows (login/logout)
- Image loading and optimization
- Mobile device compatibility
- Performance with real data
- External service integrations
- Database operations

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Vite** - Build tool
- **Supabase** - Backend (optional)
- **Lucide React** - Icons