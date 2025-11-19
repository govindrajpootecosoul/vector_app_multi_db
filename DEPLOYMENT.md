# Deployment Guide for Thrive App Backend

This guide covers deploying the application to a VPS server and setting up Git.

## Prerequisites

- Node.js 18+ installed on VPS
- Git installed on VPS
- PM2 installed globally (`npm install -g pm2`)
- Azure SQL Database access
- SSH access to VPS server

## Step 1: Git Setup

### Initial Git Setup (if not already done)

```bash
# Initialize git repository (if not already initialized)
git init

# Add remote repository
git remote add origin <your-git-repository-url>

# Add all files
git add .

# Commit
git commit -m "Initial commit - ready for deployment"

# Push to remote
git push -u origin main
```

### On VPS Server

```bash
# Clone the repository
git clone <your-git-repository-url>
cd thrive_app_main2_backend

# Switch to production branch if needed
git checkout main
```

## Step 2: Environment Variables Setup

1. Create `.env` file on the VPS:

```bash
cd thrive_app_main2_backend
nano .env
```

2. Add the following environment variables (copy from `.env.example` and fill in values):

```env
PORT=3111
NODE_ENV=production

# Azure SQL Database Configuration
DB_SERVER=your_sql_server.database.windows.net
DB_DATABASE=your_database_name
DB_USER=your_username
DB_PASSWORD=your_password

# JWT Secret Key (generate a strong random string)
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production

# Optional: Logging Configuration
LOG_LEVEL=info
```

**Important:** Never commit the `.env` file to Git. It's already in `.gitignore`.

## Step 3: Install Dependencies

```bash
# Install production dependencies
npm install --production

# Or install all dependencies (including dev dependencies for building)
npm install
```

## Step 4: Build TypeScript

```bash
# Build TypeScript to JavaScript
npm run build

# This will create the `dist/` folder with compiled JavaScript
```

## Step 5: Database Setup

1. Ensure your Azure SQL Database is accessible from the VPS
2. Run the SQL script to create user table (if not already done):

```bash
# Connect to your Azure SQL Database and run:
# src/config/create_user_table.sql
```

## Step 6: Start Application with PM2

PM2 is a process manager that keeps your application running and restarts it if it crashes.

```bash
# Start the application
npm run pm2:start

# Or manually:
pm2 start ecosystem.config.js

# Check status
pm2 status

# View logs
npm run pm2:logs
# Or: pm2 logs

# Monitor
pm2 monit
```

## Step 7: Configure PM2 to Start on Server Reboot

```bash
# Save PM2 configuration
pm2 save

# Setup PM2 to start on system boot
pm2 startup

# Follow the instructions provided by the command above
```

## Step 8: Configure Firewall (if needed)

If your VPS has a firewall, allow the application port:

```bash
# For Ubuntu/Debian with UFW
sudo ufw allow 3111/tcp

# For CentOS/RHEL with firewalld
sudo firewall-cmd --permanent --add-port=3111/tcp
sudo firewall-cmd --reload
```

## Step 9: Verify Deployment

1. Check if the server is running:
   ```bash
   curl http://localhost:3111/health
   ```

2. Check PM2 status:
   ```bash
   pm2 status
   ```

3. Check logs for any errors:
   ```bash
   pm2 logs
   ```

## Updating the Application

When you need to update the application:

```bash
# Pull latest changes
git pull origin main

# Install any new dependencies
npm install

# Rebuild TypeScript
npm run build

# Restart the application
npm run pm2:restart
# Or: pm2 restart ecosystem.config.js
```

## Useful PM2 Commands

```bash
# View all processes
pm2 list

# View logs
pm2 logs thrive-app-backend

# Stop application
npm run pm2:stop
# Or: pm2 stop thrive-app-backend

# Restart application
npm run pm2:restart
# Or: pm2 restart thrive-app-backend

# Delete application from PM2
npm run pm2:delete
# Or: pm2 delete thrive-app-backend

# Monitor resources
pm2 monit

# View detailed information
pm2 show thrive-app-backend
```

## Troubleshooting

### Application won't start

1. Check logs: `pm2 logs`
2. Check if port is already in use: `lsof -i :3111` or `netstat -tulpn | grep 3111`
3. Verify environment variables are set correctly
4. Check database connection

### Database connection errors

1. Verify Azure SQL firewall allows your VPS IP address
2. Check database credentials in `.env`
3. Test connection manually using `mssql` or SQL Server Management Studio

### Build errors

1. Ensure TypeScript is installed: `npm install typescript --save-dev`
2. Check `tsconfig.json` configuration
3. Review TypeScript errors: `npm run type-check`

### Port already in use

```bash
# Find process using port 3111
lsof -i :3111
# or
netstat -tulpn | grep 3111

# Kill the process (replace PID with actual process ID)
kill -9 <PID>
```

## Production Checklist

- [ ] Environment variables configured in `.env`
- [ ] Database connection tested and working
- [ ] TypeScript compiled successfully (`dist/` folder exists)
- [ ] Application starts without errors
- [ ] PM2 is managing the process
- [ ] PM2 configured to start on server reboot
- [ ] Firewall configured (if applicable)
- [ ] Health check endpoint responding (`/health`)
- [ ] Logs directory exists and is writable
- [ ] Git repository is set up and synced

## Security Considerations

1. **Never commit `.env` file** - It's in `.gitignore` but double-check
2. **Use strong JWT_SECRET** - Generate a random string: `openssl rand -base64 32`
3. **Keep dependencies updated** - Regularly run `npm audit` and `npm update`
4. **Use HTTPS** - Configure reverse proxy (Nginx/Apache) with SSL certificate
5. **Restrict database access** - Only allow connections from your VPS IP
6. **Regular backups** - Backup your database regularly

## Reverse Proxy Setup (Optional but Recommended)

For production, use Nginx as a reverse proxy:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3111;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Then configure SSL with Let's Encrypt.

