# Railway Backend Troubleshooting Guide

## Changes Made:
1. ✅ Changed default port from 5000 to 8080
2. ✅ Added explicit host binding to '0.0.0.0' 
3. ✅ Added request logging for debugging
4. ✅ Enhanced root endpoint with status information
5. ✅ Added Procfile for Railway deployment

## Troubleshooting Steps:

### 1. Check Railway Logs:
In your Railway dashboard:
- Go to your service
- Click on "Deployments" 
- Click on the latest deployment
- Check the logs for any errors

### 2. Verify Environment Variables:
Make sure these are set in Railway:
```
NODE_ENV=production
mongodb=mongodb+srv://your-connection-string
jwtkey=your-jwt-secret-key
```

### 3. Test Endpoints:
Try these URLs in your browser:
```
https://sabrangselfbackend-production.up.railway.app/
https://sabrangselfbackend-production.up.railway.app/health
```

### 4. Check Network Issues:
If you can't reach the backend, try:
```bash
# Test with curl
curl https://sabrangselfbackend-production.up.railway.app/
curl https://sabrangselfbackend-production.up.railway.app/health
```

### 5. Frontend Connection Test:
Update your frontend .env.local file to ensure it has:
```
NEXT_PUBLIC_API_URL=https://sabrangselfbackend-production.up.railway.app
```

### 6. Check Browser Console:
In your frontend, open browser dev tools and check:
- Network tab for failed requests
- Console for CORS errors
- Check if requests are being made to the correct URL

## Common Issues:

### Port Issues:
- Railway typically uses dynamic ports
- Using PORT=8080 as fallback
- Binding to '0.0.0.0' instead of 'localhost'

### CORS Issues:
- Make sure your frontend domain is in the CORS origins list
- Check that credentials are being sent

### MongoDB Connection:
- Verify your MongoDB connection string is correct
- Check if your IP is whitelisted in MongoDB Atlas

## Debug Commands:

```bash
# Check if service is running
curl -I https://sabrangselfbackend-production.up.railway.app/

# Test with verbose output
curl -v https://sabrangselfbackend-production.up.railway.app/health

# Test CORS preflight
curl -H "Origin: https://sabrang25-first-draft.vercel.app" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     https://sabrangselfbackend-production.up.railway.app/login
```

## Expected Response from Root Endpoint:
```json
{
  "message": "API Server is running",
  "timestamp": "2025-01-XX...",
  "environment": "production",
  "port": "8080",
  "mongoStatus": "Connected"
}
```

If you're still having issues, check the Railway deployment logs for specific error messages.
