# 🚀 SpellTable Pro+ - Vercel Deployment Guide

## 🎯 **What's Ready**

Your project is now configured for **seamless Vercel deployment**:

✅ **`vercel.json`** - Vercel configuration  
✅ **`.vercelignore`** - Files to exclude from deployment  
✅ **`.env.example`** - Environment variable template  
✅ **`api/server.js`** - Vercel-optimized server (auto-detects Vercel environment)  
✅ **MongoDB Atlas integration** - Ready to configure  

---

## 📋 **Deployment Steps**

### **Step 1: Install Vercel CLI**
```bash
npm install -g vercel
```

### **Step 2: Create MongoDB Atlas Account**

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register)
2. Create free M0 cluster (512 MB free storage)
3. Create database user (username + password)
4. Whitelist IP addresses (`0.0.0.0/0` for Vercel)
5. Get connection string:
   ```
   mongodb+srv://username:password@cluster.mongodb.net/spelltable-pro
   ```

### **Step 3: Configure Environment Variables**

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Update with your MongoDB URI:
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/spelltable-pro
ALLOWED_ORIGINS=https://your-project.vercel.app,http://localhost:3000
NODE_ENV=production
```

### **Step 4: Deploy to Vercel**

#### **Option A: CLI Deployment**
```bash
cd spelltable-pro

# Login to Vercel
vercel login

# Deploy
vercel

# Deploy to production
vercel --prod
```

#### **Option B: GitHub Integration (Recommended)**
1. Push your code to GitHub:
   ```bash
   git init
   git add .
   git commit -m "SpellTable Pro+ - Phase 2 complete"
   git remote add origin https://github.com/YOUR_USERNAME/spelltable-pro.git
   git push -u origin main
   ```

2. Go to [Vercel Dashboard](https://vercel.com/dashboard)
3. Click "Add New Project"
4. Import your GitHub repository
5. Configure environment variables:
   - `MONGODB_URI` - Your MongoDB connection string
   - `ALLOWED_ORIGINS` - Your Vercel domain + localhost
   - `NODE_ENV=production`
6. Click "Deploy"

### **Step 5: Configure Vercel Environment**

In Vercel Dashboard:
```
Settings → Environment Variables
  - MONGODB_URI: mongodb+srv://user:pass@cluster.mongodb.net/spelltable-pro
  - ALLOWED_ORIGINS: https://your-project.vercel.app
  - NODE_ENV: production
```

### **Step 6: Test Deployment**

Your deployed URLs:
- **API:** `https://your-project.vercel.app/api/health`
- **Frontend:** `https://your-project.vercel.app`
- **Demo:** `https://your-project.vercel.app/demo.html`

Test:
```bash
curl https://your-project.vercel.app/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-04-13T02:00:00.000Z",
  "uptime": 123,
  "version": "1.0.0",
  "platform": "Vercel"
}
```

---

## 🔧 **Configuration Details**

### **`vercel.json` Structure**

```json
{
  "version": 2,
  "builds": [
    {
      "src": "api/server.js",
      "use": "@vercel/node"
    },
    {
      "src": "*.html",
      "use": "@vercel/static"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "api/server.js"
    },
    {
      "src": "/index.html",
      "dest": "index.html"
    },
    {
      "src": "/demo.html",
      "dest": "demo.html"
    }
  ]
}
```

**What this does:**
- `api/server.js` becomes serverless functions
- HTML files served statically
- API routes automatically routed to server
- Frontend served automatically

### **Environment Variables**

| Variable | Description | Example |
|----------|-------------|---------|
| `MONGODB_URI` | MongoDB Atlas connection | `mongodb+srv://user:pass@cluster.mongodb.net/spelltable-pro` |
| `ALLOWED_ORIGINS` | CORS allowed domains | `https://your-project.vercel.app,http://localhost:3000` |
| `NODE_ENV` | Environment | `production` |
| `PORT` | Server port (auto-set by Vercel) | (optional) |

---

## 🌐 **Custom Domain** (Optional)

### **Step 1: Purchase Domain**
- Namecheap, GoDaddy, Google Domains, etc.

### **Step 2: Configure DNS**
```
Type: CNAME
Name: www
Value: your-project.vercel.app
```

### **Step 3: Add to Vercel**
```
Settings → Domains
  - Add: www.yourdomain.com
  - Add: yourdomain.com
```

### **Step 4: Update ALLOWED_ORIGINS**
```env
ALLOWED_ORIGINS=https://www.yourdomain.com,https://yourdomain.com,https://your-project.vercel.app
```

### **Step 5: Redeploy**
```bash
vercel --prod
```

---

## 📊 **Vercel Dashboard Setup**

### **Project Settings**
1. **Git Integration**
   - Connect GitHub repository
   - Auto-deploy on push to `main`

2. **Environment Variables**
   - `MONGODB_URI`
   - `ALLOWED_ORIGINS`
   - `NODE_ENV=production`

3. **Build Settings**
   - Framework Preset: **Other**
   - Build Command: `npm install`
   - Output Directory: (leave empty)

4. **Git Ignore**
   - Vercel auto-configured via `.vercelignore`

---

## 🔒 **Security Configuration**

### **CORS Setup**

In `.env`:
```env
ALLOWED_ORIGINS=https://your-project.vercel.app,http://localhost:3000
```

In `vercel.json`:
```json
{
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Access-Control-Allow-Origin",
          "value": "*"
        }
      ]
    }
  ]
}
```

### **Rate Limiting**

Automatic via Vercel Edge Network:
- Built-in DDoS protection
- Per-function rate limits
- No configuration needed

---

## 📈 **Monitoring & Analytics**

### **Vercel Analytics**
```
Dashboard → Analytics
  - View count
  - Visit time
  - Geolocation
  - Referrers
```

### **Error Monitoring**

#### **Option 1: Vercel Logs**
```
Dashboard → Logs
  - Real-time logs
  - Function errors
  - Performance metrics
```

#### **Option 2: Sentry**
```bash
npm install @sentry/node
```

In `.env`:
```env
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
```

---

## 🐛 **Troubleshooting**

### **"MongoDB connection failed"**
```bash
# Check environment variable is set
vercel env get MONGODB_URI

# Verify MongoDB Atlas IP whitelist
# Add 0.0.0.0/0 for all IPs
```

### **"CORS error on frontend"**
```env
ALLOWED_ORIGINS=https://your-project.vercel.app,http://localhost:3000
```

### **"Function timed out"**
- Vercel serverless functions have 10s default timeout
- For long-running tasks, use background jobs
- Increase timeout in `vercel.json`:
  ```json
  {
    "functions": {
      "api/server.js": {
        "maxDuration": 30
      }
    }
  }
  ```

### **"Static assets not loading"**
- Check `.vercelignore` doesn't include `css/` or `js/`
- Verify file paths in HTML are correct
- Clear browser cache

---

## 🚀 **Quick Deploy Commands**

### **First Deployment:**
```bash
cd spelltable-pro
vercel login
vercel --prod
```

### **Subsequent Deployments:**
```bash
# Commit changes
git add .
git commit -m "Update feature"

# Push to GitHub
git push origin main

# Vercel auto-deploys on push!
```

### **Redeploy:**
```bash
vercel deploy --prod
```

### **Preview Deployment:**
```bash
vercel
```

---

## ✅ **Post-Deployment Checklist**

- [ ] MongoDB Atlas cluster created
- [ ] Environment variables configured in Vercel
- [ ] `ALLOWED_ORIGINS` includes Vercel domain
- [ ] API health endpoint accessible
- [ ] Frontend loads correctly
- [ ] Card search API working
- [ ] Game creation API working
- [ ] CORS working from frontend
- [ ] MongoDB connection confirmed in logs

---

## 📚 **Resources**

- **[Vercel Docs](https://vercel.com/docs)** - Official documentation
- **[MongoDB Atlas](https://www.mongodb.com/cloud/atlas)** - Cloud database
- **[Vercel + MongoDB Guide](https://vercel.com/guides/deploy-mongodb-redis-graphql-api-with-vercel)** - Integration guide
- **[Serverless WebSocket Guide](https://vercel.com/docs/runtimes#official-runtimes/node-js-runtimes/websockets)** - WebSocket setup

---

## 🎉 **You're Ready!**

Your SpellTable Pro+ is configured for **seamless Vercel deployment**.

**Next Steps:**
1. Create MongoDB Atlas account
2. Configure environment variables
3. Deploy with `vercel --prod`
4. Test the deployment

**Need help?** Check the Vercel dashboard for logs and analytics! 🚀
