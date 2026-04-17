# SpellTable Pro+ - GitHub Pages Deployment Guide

## 🚀 Quick Deployment

### Prerequisites
- Node.js 18+ installed
- MongoDB installed and running (or MongoDB Atlas account)
- GitHub account with repository access

### Step 1: Install Dependencies
```bash
cd spelltable-pro
npm install
```

### Step 2: Configure Environment
Create `.env` file:
```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/spelltable-pro
ALLOWED_ORIGINS=http://localhost:3000,https://yourusername.github.io
NODE_ENV=production
```

### Step 3: Test Locally
```bash
# Start the server
npm start

# Or with auto-reload
npm run dev
```

Open `http://localhost:3000/demo.html` to verify everything works.

### Step 4: Deploy to GitHub Pages

**Option A: Static Deploy (Frontend Only)**
If you only want to serve the static demo (no backend API):

```bash
# Build frontend
npm run build

# Deploy to GitHub Pages
npx gh-pages -d spelltable-pro/dist
```

**Option B: Full Deploy (Backend + Static)**
Since GitHub Pages only serves static files, you'll need a separate hosting service for the API.

#### Recommended Setup:
- **Frontend:** GitHub Pages
- **Backend API:** Railway, Render, or Vercel
- **Database:** MongoDB Atlas (free tier)

### Step 5: Configure GitHub Pages

1. **Create Repository:**
```bash
cd spelltable-pro
git init
git add .
git commit -m "Initial SpellTable Pro+ commit"
git branch -M main
git remote add origin https://github.com/yourusername/spelltable-pro.git
git push -u origin main
```

2. **Enable GitHub Pages:**
   - Go to Repository Settings → Pages
   - Source: Deploy from branch
   - Branch: `main`
   - Folder: `/ (root)`

3. **Update CORS Settings:**
   Update `api/server.js` with your GitHub Pages URL:
   ```javascript
   cors: {
       origin: ["https://yourusername.github.io"],
       methods: ["GET", "POST"]
   }
   ```

## 📋 Deployment Checklist

### Before Deploying:
- [ ] All API routes tested locally
- [ ] MongoDB connection tested
- [ ] CORS configured for production domain
- [ ] Environment variables set in `.env`
- [ ] `.env` added to `.gitignore`
- [ ] Database indexes created

### After Deploying:
- [ ] Verify frontend loads on GitHub Pages
- [ ] Test WebSocket connections
- [ ] Check API health endpoint
- [ ] Monitor error logs
- [ ] Test card search functionality

## 🔧 Production Setup

### For Backend API (Railway/Render/Vercel):

1. **Create Project on Railway/Render**
2. **Connect GitHub Repository**
3. **Set Environment Variables:**
   - `PORT` (usually auto-set)
   - `MONGODB_URI` (your MongoDB Atlas connection string)
   - `NODE_ENV` = `production`
   - `ALLOWED_ORIGINS` = your GitHub Pages URL

4. **Deploy:**
   ```bash
   # Railway
   railway init
   railway up

   # Render
   render deploy

   # Vercel
   vercel deploy --prod
   ```

### MongoDB Atlas Setup:

1. **Create Free Cluster:**
   - Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
   - Create free M0 cluster
   - Create database user
   - Get connection string

2. **Configure Connection:**
   ```env
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/spelltable-pro
   ```

3. **Whitelist IP Addresses:**
   - Add `0.0.0.0/0` (if deploying to cloud)
   - Or whitelist your deployment service IPs

## 🌐 Custom Domain (Optional)

1. **Purchase Domain** (Namecheap, GoDaddy, etc.)
2. **Configure DNS:**
   ```
   Type: CNAME
   Name: www
   Value: yourusername.github.io
   ```

3. **GitHub Pages Settings:**
   - Custom domain: `www.yourdomain.com`
   - Enable HTTPS

4. **Update CORS:**
   ```javascript
   ALLOWED_ORIGINS=https://www.yourdomain.com,https://yourusername.github.io
   ```

## 📊 Monitoring & Maintenance

### Health Checks:
```bash
# API health endpoint
curl https://your-api-url.com/api/health

# GitHub Pages URL
curl https://yourusername.github.io/api/health
```

### Error Logging:
- Enable logging in production
- Use services like Sentry or LogRocket
- Monitor MongoDB Atlas metrics

### Backups:
- MongoDB Atlas has automatic backups on paid tiers
- For free tier, manually export collections:
  ```bash
  mongodump --uri="your-connection-string" --out=backups
  ```

## 🐛 Troubleshooting

### "MongoDB connection failed"
- Check MONGODB_URI is correct
- Ensure database user has proper permissions
- Whitelist IP addresses in MongoDB Atlas

### "CORS error"
- Update `ALLOWED_ORIGINS` in environment variables
- Restart server after changes

### "WebSocket connection failed"
- Check firewall allows WebSocket
- Verify CORS includes `POST` methods
- Test with browser DevTools Network tab

### "404 on API routes"
- Verify server is running on correct port
- Check routes are properly registered
- Ensure `/api/` prefix is used

## 📚 Next Steps After Deployment

1. **Add SSL/HTTPS** (GitHub Pages handles this automatically)
2. **Set up CI/CD** (GitHub Actions for automated testing)
3. **Configure monitoring** (Uptime monitoring, error alerts)
4. **Add analytics** (Google Analytics, Plausible)
5. **Implement player profiles** (Phase 8: Community Features)

## 🔒 Security Best Practices

- ✅ Use environment variables for sensitive data
- ✅ Enable rate limiting (already configured)
- ✅ Use helmet for security headers
- ✅ Validate all user inputs
- ✅ Use HTTPS only in production
- ✅ Regular dependency updates
- ✅ Monitor for security vulnerabilities

## 📞 Support

- **Documentation:** [PROJECT-SUMMARY.md](./PROJECT-SUMMARY.md)
- **API Docs:** [api/README.md](./api/README.md)
- **Issues:** [GitHub Issues](https://github.com/yourusername/spelltable-pro/issues)

---

**Ready to deploy? Run:**
```bash
npm install
npm start
```

**Then follow the deployment steps above!** 🚀
