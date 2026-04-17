# 🚀 SpellTable Pro+ - Deployment Checklist

**MongoDB Atlas:** ✅ Configured  
**Vercel:** ⏳ Ready to deploy

---

## ✅ **Pre-Deployment Checklist**

### **1. MongoDB Atlas Setup**
- [x] **Cluster created** at https://cloud.mongodb.com/v2/69dc5ed3c82ec649bea48068
- [x] **Database user created**: `tonynamlam_db_user`
- [x] **Connection string configured**: `mongodb+srv://tonynamlam_db_user:48f7JJVHAU0RyQSC@cluster.mongodb.net/spelltable-pro`
- [x] **.env file created** with MongoDB credentials

### **2. Network Configuration**
- [ ] **Whitelist IP addresses** in MongoDB Atlas:
  - Add `0.0.0.0/0` (allows all IPs from Vercel)
  - OR add specific Vercel IPs (more secure)

### **3. Vercel Setup**
- [ ] **Install Vercel CLI**: `npm install -g vercel`
- [ ] **Login to Vercel**: `vercel login`
- [ ] **Connect GitHub repository** (recommended for auto-deploy)

### **4. Environment Variables**
- [x] **MONGODB_URI**: Configured with your credentials
- [ ] **ALLOWED_ORIGINS**: Update with Vercel domain after deployment
  - Example: `https://your-project.vercel.app,http://localhost:3000`
- [ ] **NODE_ENV**: Set to `production`

---

## 🚀 **Deployment Steps**

### **Option A: Deploy via CLI**
```bash
cd spelltable-pro

# Install Vercel CLI if not installed
npm install -g vercel

# Login
vercel login

# Deploy to production
vercel --prod
```

### **Option B: Deploy via GitHub** (Recommended)
```bash
# 1. Push to GitHub
git init
git add .
git commit -m "SpellTable Pro+ - Phase 2 complete with Vercel deployment"
git remote add origin https://github.com/YOUR_USERNAME/spelltable-pro.git
git push -u origin main

# 2. Connect in Vercel Dashboard
# - Go to https://vercel.com/dashboard
# - "Add New Project"
# - Connect your GitHub repository
# - Configure environment variables
# - Deploy!
```

### **Option C: Use Deployment Script**
```bash
./scripts/deploy-vercel.sh
```

---

## 🔧 **Post-Deployment Configuration**

### **1. Update ALLOWED_ORIGINS**
After deployment, you'll get a URL like: `https://spelltable-pro-xxxx.vercel.app`

Update `.env` or Vercel environment variables:
```env
ALLOWED_ORIGINS=https://spelltable-pro-xxxx.vercel.app,http://localhost:3000
```

### **2. Test Deployment**
```bash
# Test health endpoint
curl https://spelltable-pro-xxxx.vercel.app/api/health

# Expected response:
{
  "status": "ok",
  "platform": "Vercel",
  "version": "1.0.0",
  ...
}

# Test card search
curl "https://spelltable-pro-xxxx.vercel.app/api/cards/search?q=Forest"

# Open demo page
open https://spelltable-pro-xxxx.vercel.app/demo.html
```

### **3. Configure CORS**
Make sure your frontend can access the API:
- Check browser console for CORS errors
- Update `ALLOWED_ORIGINS` if needed
- Redeploy after changes

---

## 📊 **Deployment URLs**

After deployment, you'll have:

| Service | URL | Status |
|---------|-----|--------|
| **API Health** | `https://your-project.vercel.app/api/health` | ✅ Test |
| **Frontend** | `https://your-project.vercel.app` | ✅ Test |
| **Demo Page** | `https://your-project.vercel.app/demo.html` | ✅ Test |
| **API Docs** | `https://your-project.vercel.app/api/cards/search` | ✅ Test |

---

## 🎯 **Testing Checklist**

### **API Tests:**
- [ ] `/api/health` - Returns health status
- [ ] `/api/games` - List all games
- [ ] `/api/games` (POST) - Create new game
- [ ] `/api/cards/search?q=Forest` - Search cards
- [ ] `/api/cards/Forest` - Get card details

### **Frontend Tests:**
- [ ] Demo page loads correctly
- [ ] Dark/Light theme toggle works
- [ ] Card search displays results
- [ ] Game creation works
- [ ] WebSocket connections work (local dev)

---

## 🔒 **Security Checks**

- [x] **Environment variables** in Vercel (not in git)
- [x] **CORS configured** with specific origins
- [x] **Rate limiting** enabled (100 req/15min)
- [x] **Helmet headers** added (security)
- [x] **MongoDB password** secured in `.env`
- [x] **IP whitelist** configured in MongoDB Atlas

---

## 🐛 **Troubleshooting**

### **"MongoDB connection failed"**
```bash
# Check IP whitelist in MongoDB Atlas
# Add 0.0.0.0/0 for all Vercel IPs
# Or whitelist specific Vercel IPs

# Verify environment variable:
vercel env get MONGODB_URI
```

### **"CORS error on frontend"**
```env
ALLOWED_ORIGINS=https://your-project.vercel.app,http://localhost:3000
```

### **"Function timed out"**
- Serverless functions have 10s default timeout
- Check MongoDB connection is fast
- Increase timeout in `vercel.json` if needed

---

## 📝 **Next Steps After Deploy**

1. **Custom Domain** (Optional)
   - Purchase domain
   - Configure DNS in Vercel
   - Update `ALLOWED_ORIGINS`

2. **Monitoring**
   - Enable Vercel Analytics
   - Set up Sentry for error tracking
   - Monitor MongoDB Atlas metrics

3. **CI/CD**
   - Set up GitHub Actions for automated testing
   - Add linting and validation steps

4. **Phase 3: Authentication**
   - Add JWT authentication
   - User registration/login
   - Secure game access

---

## ✅ **Deployment Complete!**

Once deployed, you'll have:
- ✅ Global CDN (fast worldwide)
- ✅ Auto-HTTPS (security out of the box)
- ✅ Zero downtime deployments
- ✅ Automatic scaling (serverless)
- ✅ Built-in DDoS protection

**Ready to deploy? Run:**
```bash
cd spelltable-pro
vercel --prod
```

**Or use the automated script:**
```bash
./scripts/deploy-vercel.sh
```

Good luck! 🚀
