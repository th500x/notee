# Notee - Multi-Page Web Application

A comprehensive web application with multiple functional pages.

## 🌟 Current Features

### 📅 News Calendar (`/news-calendar`)
- Interactive calendar with news display
- Emoji reaction system (🍺👍👎)
- Hot news ranking
- Monthly news data management
- Responsive design for desktop and mobile

## 🚀 Planned Pages
- `/page2` - [To be defined]
- `/page3` - [To be defined] 
- `/page4` - [To be defined]

## 🏗️ Project Structure

```
notee/
├── news-calendar/          # News calendar application
│   ├── src/               # Frontend source
│   ├── backend/           # Backend API
│   ├── public/            # Static assets
│   └── dist/              # Built files
├── page2/                 # Second page (planned)
├── page3/                 # Third page (planned)
├── page4/                 # Fourth page (planned)
└── shared/                # Shared resources
    ├── components/        # Shared React components
    ├── utils/             # Shared utilities
    └── styles/            # Shared CSS/styles
```

## 🛠️ Technology Stack

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Node.js + Express
- **Database**: SQLite
- **Process Manager**: PM2
- **Web Server**: Nginx

## 🚀 Deployment

- **Server**: Alibaba Cloud ECS
- **Domain**: notee.vip
- **IP**: 47.113.185.170

## 📦 Installation & Setup

```bash
# Install dependencies for news calendar
cd news-calendar
npm install

# Build the project
npm run build

# Start the backend service
cd backend
pm2start ecosystem.config.cjs
```

## 🔧 Development

Each page is a separate sub-project with its own:
- Package.json and dependencies
- Build configuration
- API endpoints
- Database (if needed)

Shared resources are in the `/shared` directory for consistency across pages.

## 🍺 LOVE & PEACE!

Built with passion for creating useful web applications.