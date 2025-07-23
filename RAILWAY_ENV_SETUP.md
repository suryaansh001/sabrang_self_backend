# Railway Environment Variables Setup Guide

## Required Environment Variables for Railway:

1. NODE_ENV=production
2. mongodb=<your_mongodb_connection_string>
3. jwtkey=<your_jwt_secret_key>
4. PORT=<automatically_set_by_railway>

## To set these in Railway:
1. Go to your Railway project dashboard
2. Click on your service
3. Go to "Variables" tab
4. Add the following variables:
   - NODE_ENV: production
   - mongodb: your MongoDB connection string
   - jwtkey: your JWT secret key

## For Vercel Frontend:
Add environment variable in Vercel dashboard:
- NEXT_PUBLIC_API_URL: https://sabrangselfbackend-production.up.railway.app

## Test your API:
- Health check: https://sabrangselfbackend-production.up.railway.app/health
- API status: https://sabrangselfbackend-production.up.railway.app/
