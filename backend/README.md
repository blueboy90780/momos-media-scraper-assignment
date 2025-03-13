# Media Scraper - Backend

The backend API service for the Media Scraper application, built with Node.js, Express, and MySQL.

## Features

- RESTful API endpoints for media scraping and retrieval
- JWT-based authentication system
- Efficient web scraping with Cheerio
- Queue-based processing with Bull/Redis for handling large workloads
- MySQL database integration with Sequelize ORM
- Comprehensive error handling and logging
- Docker support for development and production

## API Endpoints

### Authentication
- `POST /api/auth/login` - Authenticate user and get JWT token

### Media
- `GET /api/media` - Get media items with pagination, filtering, and search
- `POST /api/media/scrape` - Submit URLs for scraping
- `DELETE /api/media/clear` - Clear all media items

### Monitoring
- `GET /health` - Health check endpoint
- `GET /api/debug` - Debug information (development only)

## Architecture

### Core Components

1. **API Layer** - Express routes and controllers
2. **Authentication** - JWT token implementation
3. **Database** - Sequelize models and MySQL connection
4. **Scraper** - Web scraping service with Cheerio
5. **Queue** - Bull queue for processing URLs asynchronously

### Scalability Features

The backend is designed to handle high loads through:

- **Queue-based Processing**: URLs are processed in a Redis-backed queue
- **Configurable Concurrency**: Control how many URLs are processed simultaneously
- **Batch Processing**: URLs are processed in configurable batch sizes
- **Memory Monitoring**: Checks memory usage and throttles processing if needed
- **Error Recovery**: Graceful handling of failures with automatic retries
- **Connection Management**: Database connections with retry mechanisms

## Environment Configuration

The application uses environment variables for configuration:

- `PORT` - Server port (default: 3001)
- `JWT_SECRET` - Secret key for JWT tokens
- `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME` - Database connection
- `REDIS_URL` - Redis connection for the queue
- `QUEUE_CONCURRENCY` - Number of concurrent scraping tasks
- `BATCH_SIZE` - Number of URLs processed in each batch

## Development

```bash
npm run dev
```

## Production

```bash
npm start
```

## Docker Support

The project includes Docker configuration for both development and production environments.