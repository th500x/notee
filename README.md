# Notee - Multi-Page Web Application

A comprehensive web application with multiple functional pages.

## 🌟 Current Features

### 🏠 Homepage (`/`)
- Clean and modern landing page
- Four feature cards layout
- Guestbook functionality with admin management
- Easy navigation to all sub-applications

### 📅 News Calendar (`/01-news-calendar`)
- Interactive calendar with news display
- Emoji reaction system (🍺👍👎)
- Hot news ranking
- Monthly news data management
- Responsive design for desktop and mobile

### 📚 Tale Historical (`/02-tale-historical`)
- Digital book reading platform
- Password-protected categories ("游戏文本", "个人私密")
- Multiple book collections with chapter navigation
- Reading toolbar with font size and theme controls

### 💰 Coin Index (`/04-coin-index`)
- Cryptocurrency index tracking
- Weekly data visualization
- Investment simulation tools
- Historical performance analysis

### ⚔️ San Storm (`/05-san-storm`)
- Three Kingdoms strategy game prototype
- Character and troop card systems
- Formation and battle mechanics
- Admin user management system

## 🔐 Security Features

### Global Password System
All password-protected features use a unified admin password: `notee.vip.2026`

**Protected Features:**
- Homepage guestbook message deletion
- Tale Historical restricted categories access
- San Storm user management (with device fingerprint verification)

## 🏗️ Project Structure

```
notee/
├── 01-news-calendar/          # News calendar application
├── 02-tale-historical/        # Digital book platform
├── 04-coin-index/            # Cryptocurrency index
├── 05-san-storm/             # Strategy game prototype
├── src/                      # Shared resources
│   ├── components/           # Shared React components
│   ├── utils/               # Shared utilities (including globalAuth.js)
│   └── styles/              # Shared CSS/styles
├── docs/                     # Documentation
│   ├── DEPLOYMENT_GUIDE.md   # Complete deployment guide
│   ├── GLOBAL_PASSWORD_SYSTEM.md
│   ├── SECURITY_SETUP.md
│   ├── SECURITY_MIGRATION_COMPLETE.md
│   └── GUESTBOOK_API.md      # Guestbook API documentation
├── backend/                  # Backend services
│   ├── guestbook.js         # Guestbook API
│   └── server.js            # Main server
```

## 🛠️ Technology Stack

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Node.js + Express
- **Database**: SQLite (for guestbook)
- **Process Manager**: PM2
- **Web Server**: Nginx

## 🚀 Deployment

**📖 For complete deployment instructions, see: [docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md)**

### Quick Deployment
```bash
# 1. Pull latest code
cd /www/wwwroot/notee
git pull origin main

# 2. Set security configuration
export GLOBAL_ADMIN_PASSWORD="notee.vip.2026"
echo "REACT_APP_GLOBAL_ADMIN_PASSWORD=notee.vip.2026" > 05-san-storm/.env

# 3. Build and deploy
cd 05-san-storm
npm install && npm run build
nginx -s reload
```

### Automated Deployment
```bash
# Use deployment script
./deploy.sh 05-san-storm
```

### Server Information
- **Server**: Alibaba Cloud ECS
- **Domain**: notee.vip
- **IP**: 47.113.185.170

## 📦 Installation & Setup

```bash
# Install dependencies for a specific project
cd 05-san-storm
npm install

# Build the project
npm run build

# Start backend services (if needed)
cd ../backend
pm2 start server.js --name notee-backend
```

## 🔧 Development

Each page is a separate sub-project with its own:
- Package.json and dependencies
- Build configuration
- API endpoints
- Database (if needed)

Shared resources are in the `/src` directory for consistency across pages.

## 📚 Documentation

- **[docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md)** - Complete deployment and troubleshooting guide
- **[docs/GLOBAL_PASSWORD_SYSTEM.md](docs/GLOBAL_PASSWORD_SYSTEM.md)** - Global password system documentation
- **[docs/SECURITY_SETUP.md](docs/SECURITY_SETUP.md)** - Security configuration guide
- **[docs/GUESTBOOK_API.md](docs/GUESTBOOK_API.md)** - Guestbook API documentation
- **[05-san-storm/README.md](05-san-storm/README.md)** - San Storm game documentation

## 🔄 Recent Updates

### 2026-02-12
- ✅ Implemented unified global password system
- ✅ Updated admin password to `notee.vip.2026`
- ✅ Enhanced security with environment variable configuration
- ✅ Consolidated deployment documentation

### 2026-02-10
- ✅ Successfully deployed 02-tale-historical and 05-san-storm projects
- ✅ Fixed Nginx static resource configuration issues
- ✅ Unified data loading with dataLoader
- ✅ Added guestbook functionality to homepage
- ✅ Optimized mobile navigation and responsive design

## 🎯 Project Statistics

**Total Projects**: 4 active applications  
**Total Files**: 200+ source files  
**Total Code**: ~25,000 lines  
**Documentation**: 60+ markdown files  
**Data Records**: 300+ characters, troops, and game elements

## 🍺 LOVE & PEACE!

Built with passion for creating useful web applications.

---

**Maintainer**: Kiro AI Assistant  
**Created**: 2026-02-10  
**Last Updated**: 2026-02-12