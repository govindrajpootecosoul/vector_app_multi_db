# Deployment Checklist

## Pre-Deployment Checklist

### ✅ Git Configuration
- [x] `.gitignore` properly configured (excludes `.env`, `node_modules`, `dist/`)
- [x] `package-lock.json` will be committed (removed from .gitignore for consistency)
- [ ] Repository initialized and remote added
- [ ] All code committed and pushed to remote

### ✅ Environment Variables
- [x] `.env.example` file created (template for environment variables)
- [ ] `.env` file created on VPS with production values
- [ ] All required environment variables set:
  - `PORT` (default: 3110)
  - `DB_SERVER` (Azure SQL server)
  - `DB_DATABASE` (database name)
  - `DB_USER` (database username)
  - `DB_PASSWORD` (database password)
  - `JWT_SECRET` (strong random string)

### ✅ Build Configuration
- [x] TypeScript configuration (`tsconfig.json`) updated to allow JS imports
- [x] Build script working (`npm run build`)
- [x] `dist/` folder generated successfully
- [x] Server entry point verified (`dist/server.js`)

### ✅ Process Management
- [x] PM2 ecosystem config created (`ecosystem.config.js`)
- [x] PM2 scripts added to `package.json`
- [ ] PM2 installed globally on VPS (`npm install -g pm2`)

### ✅ Database Setup
- [ ] Azure SQL Database accessible from VPS
- [ ] Firewall rules configured to allow VPS IP
- [ ] User table created (run `src/config/create_user_table.sql` if needed)
- [ ] Database connection tested

### ✅ Server Configuration
- [ ] Node.js 18+ installed on VPS
- [ ] Port 3110 available (or configured port)
- [ ] Firewall configured (if applicable)
- [ ] Logs directory created and writable

## Deployment Steps

1. **Clone Repository on VPS**
   ```bash
   git clone <repository-url>
   cd thrive_app_main2_backend
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Create Environment File**
   ```bash
   cp .env.example .env
   nano .env  # Edit with production values
   ```

4. **Build TypeScript**
   ```bash
   npm run build
   ```

5. **Start with PM2**
   ```bash
   npm run pm2:start
   ```

6. **Configure PM2 Auto-Start**
   ```bash
   pm2 save
   pm2 startup  # Follow instructions
   ```

7. **Verify Deployment**
   ```bash
   curl http://localhost:3110/health
   pm2 status
   pm2 logs
   ```

## Post-Deployment Verification

- [ ] Health check endpoint responds: `GET /health`
- [ ] PM2 process is running
- [ ] Database connection successful
- [ ] Application logs show no errors
- [ ] API endpoints responding correctly

## Files Created/Modified for Deployment

1. ✅ `ecosystem.config.js` - PM2 configuration
2. ✅ `.env.example` - Environment variables template
3. ✅ `DEPLOYMENT.md` - Detailed deployment guide
4. ✅ `package.json` - Added PM2 scripts and prestart hook
5. ✅ `.gitignore` - Fixed to allow package-lock.json
6. ✅ `tsconfig.json` - Updated to allow JS imports and build successfully
7. ✅ `src/types/index.ts` - Added profile_picture to UserRecord
8. ✅ `src/config/db.ts` - Fixed unused import
9. ✅ `src/app.ts` - Fixed unused parameter

## Important Notes

- **Never commit `.env` file** - It contains sensitive credentials
- **Always use strong JWT_SECRET** - Generate with: `openssl rand -base64 32`
- **Keep dependencies updated** - Run `npm audit` regularly
- **Monitor logs** - Use `pm2 logs` to check for errors
- **Backup database** - Regular backups are essential

## Troubleshooting

If deployment fails, check:
1. Environment variables are set correctly
2. Database is accessible from VPS
3. Port is not already in use
4. Node.js version is 18+
5. All dependencies installed
6. TypeScript build completed successfully

