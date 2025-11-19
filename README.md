# Thrive App Main Backend

A Node.js backend application for the Thrive app, providing APIs for user management, sales analysis, inventory, and more.

## Features

- User authentication with JWT
- Sales analysis and reporting
- Inventory management
- Order processing
- P&L calculations
- Ad sales and spend tracking

## Technologies Used

- Node.js
- Express.js
- MongoDB (via Mongoose)
- Azure SQL Server (via mssql)
- JWT for authentication
- Winston for logging

## Installation

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables in `.env` file
4. Run the application: `npm start` or `npm run dev` for development

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```
DB_SERVER=your_sql_server
DB_DATABASE=your_database_name
DB_USER=your_username
DB_PASSWORD=your_password
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
PORT=3111
```

## Database Setup

1. **MongoDB**: Set up a MongoDB Atlas cluster and get the connection URI.
2. **SQL Database**: Create an Azure SQL database and run the script in `src/config/create_user_table.sql`.

## API Endpoints

- `/api/user` - User management
- `/api/order` - Order processing
- `/api/inventory` - Inventory management
- `/api/salesanalysis` - Sales analysis
- `/api/pnl` - Profit and Loss
- `/api/adsalesadspend` - Ad sales and spend

## Deployment

See the deployment guide in `TODO.md` for detailed instructions on deploying to platforms like Heroku, Render, or Railway.

## License

ISC
