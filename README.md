# Media Scraper Application

A full-stack application that allows users to submit URLs for scraping media (images and videos), with support for both server-side rendering (SSR) and client-side rendering (CSR).

## Features

- 🔐 User authentication with JWT
- 🖼️ Scrapes images and videos from provided URLs
- 💾 Stores data in MySQL database
- 📱 Responsive design for all device sizes
- 🔍 Search and filtering capabilities
- 📄 Pagination for better navigation
- 🖥️ Server-side rendering for initial page load
- ⚡ Client-side rendering for subsequent interactions
- 🔄 Real-time status updates for processing tasks
- 📊 Queue-based processing to handle large workloads

## Architecture

The application consists of two main components:

1. **Backend (Node.js/Express)**
   - RESTful API endpoints
   - Authentication system
   - Scraper service with Bull queue
   - MySQL database interaction
   - Error handling and logging

2. **Frontend (Next.js)**
   - Server-side rendering for initial page load
   - Client-side rendering for interactions
   - Responsive UI components
   - Status updates via polling
   - Toast notifications

## Tech Stack

- **Frontend**: Next.js, React, Axios, React-Toastify
- **Backend**: Node.js, Express, Sequelize ORM
- **Database**: MySQL
- **Queue**: Bull (Redis-based)
- **Authentication**: JWT
- **Containerization**: Docker, docker-compose

## Getting Started

### Prerequisites

- Docker and docker-compose
- Node.js (for local development)

### Running the Application

#### Development Mode

```bash
npm run dev
```

This will start the application in development mode with hot reloading enabled.

#### Production Mode

```bash
npm run prod
```

This will start the application in production mode with optimized builds.

### Usage

1. Access the application at http://localhost:3000
2. Login with username: `admin` and password: `admin`
3. Enter URLs to scrape in the text area (one URL per line)
4. Click "Scrape URLs" to start the process
5. View the scraped media in the grid below
6. Use the search and filter options to find specific media

## Project Structure

```
├── backend/                # Node.js backend
│   ├── config/             # Configuration files
│   ├── controllers/        # API controllers
│   ├── middleware/         # Express middleware
│   ├── models/             # Sequelize models
│   ├── routes/             # API routes
│   ├── utils/              # Utility functions
│   └── server.js           # Entry point
├── frontend/               # Next.js frontend
│   ├── public/             # Static assets
│   └── src/                # Source code
│       ├── app/            # Next.js app directory
│       ├── components/     # React components
│       └── utils/          # Utility functions
└── docker-compose.*.yml    # Docker configuration files
```

## Scalability Considerations

The application is designed to handle high loads through:

1. Queue-based processing with configurable concurrency
2. Batch processing of URLs
3. Optimized database queries
4. Memory usage monitoring
5. Efficient error handling and recovery

## License

MIT