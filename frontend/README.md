# Media Scraper - Frontend

The frontend portion of the Media Scraper application, built with Next.js and React.

## Overview

This frontend provides a user interface for the Media Scraper application with the following features:

- User authentication (login/logout)
- URL submission for media scraping
- Display of scraped media (images and videos)
- Search and filtering capabilities
- Pagination for browsing media
- Status updates for scraping tasks

## Key Technical Aspects

- **Server-Side Rendering (SSR)**: Initial data is pre-rendered on the server for better SEO and performance
- **Client-Side Rendering (CSR)**: Subsequent interactions handled on the client for a smooth user experience
- **Component Architecture**: Modular React components for maintainability and reusability
- **Responsive Design**: Fully responsive UI that works on all device sizes
- **Toast Notifications**: Real-time feedback for user actions
- **Loading States**: Visual indicators during data fetching and processing

## Project Structure

```
frontend/
├── public/              # Static assets
├── src/
│   ├── app/             # Next.js app directory
│   │   ├── layout.js    # Root layout with global styles
│   │   ├── page.js      # Server component entry point
│   │   └── globals.css  # Global CSS
│   ├── components/      # React components
│   │   ├── ClientPage.jsx        # Main client component
│   │   ├── LoginForm.jsx         # Authentication form
│   │   ├── MediaCard.jsx         # Media item display
│   │   ├── MediaControls.jsx     # Search and filter controls
│   │   ├── Pagination.jsx        # Page navigation
│   │   ├── ScrapeForm.jsx        # URL submission form
│   │   └── SubmittedLinks.jsx    # Display of submitted URLs
│   └── utils/
│       └── api.js       # API communication utilities
└── next.config.mjs      # Next.js configuration
```

## Development

To run the frontend in development mode:

```bash
npm run dev
```

## Building for Production

```bash
npm run build
npm start
```

## Docker Support

This project includes Docker configuration for both development and production environments.
