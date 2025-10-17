# Deployment Instructions

## Quick Deploy to Vercel

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm i -g vercel
   ```

2. **Deploy the application**:
   ```bash
   cd AI_agent
   vercel
   ```

3. **Follow the prompts**:
   - Set up and deploy? `Y`
   - Which scope? Choose your account
   - Link to existing project? `N`
   - What's your project's name? `ai-agent` (or your preferred name)
   - In which directory is your code located? `./`
   - Want to override the settings? `N`

4. **Set environment variables** in Vercel dashboard:
   - Go to your project settings
   - Navigate to Environment Variables
   - Add:
     - `JWT_SECRET`: your_super_secret_jwt_key_here
     - `NODE_ENV`: production

## Alternative Deployment Options

### Heroku
1. Create a `Procfile`:
   ```
   web: node server.js
   ```

2. Deploy:
   ```bash
   git add .
   git commit -m "Deploy to Heroku"
   git push heroku main
   ```

### Railway
1. Connect your GitHub repository
2. Railway will auto-detect Node.js
3. Set environment variables in Railway dashboard

### DigitalOcean App Platform
1. Connect your GitHub repository
2. Select Node.js as the runtime
3. Set environment variables in the dashboard

## Environment Variables Required

- `JWT_SECRET`: Secret key for JWT token signing
- `NODE_ENV`: Set to `production` for production deployments
- `PORT`: Will be automatically set by the hosting platform

## Post-Deployment

1. Test all endpoints:
   - Registration: `POST /api/auth/register`
   - Login: `POST /api/auth/login`
   - Chat initiation: `POST /api/chat/initiate`

2. Verify MongoDB connection is working
3. Test the complete user flow from registration to chat

## Troubleshooting

- **MongoDB Connection Issues**: Verify the connection string in `server.js`
- **CORS Issues**: Check if CORS is properly configured
- **Static Files Not Loading**: Verify Vercel routes configuration
- **JWT Errors**: Ensure JWT_SECRET is set in environment variables
