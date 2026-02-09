# jackblack.github.io
cit 480 website

Blackjack 21 - CIT 480 Project
Project Overview
This project is a full stack web application built for the CIT 480 course.
The goal is to design and deploy a Blackjack web app that includes user registration, login, game result tracking, and a leaderboard system.
The application demonstrates front-end and back-end integration, database connectivity, and deployment using modern cloud platforms.

Architecture
Frontend: React (Vite + TypeScript)
Backend: Node.js with Express
Database: Supabase (PostgreSQL)
Hosting:
•	Frontend hosted on Vercel
•	Backend hosted on Render
•	Database hosted on Supabase


Basic Flow:
[ Browser / Frontend (Vercel) ]
              |
              v
[ Backend API (Render - Express/Node) ]
              |
              v
[ Database (Supabase PostgreSQL) ]

Live URLs
Frontend: https://blackjack480.vercel.app
Backend: https://blackjack480.onrender.com
Health Check: https://blackjack480.onrender.com/api/health
Database Check: https://blackjack480.onrender.com/api/health/db

Features
•	User registration and login (with JWT authentication)
•	Encrypted passwords using bcrypt
•	Database persistence using Supabase
•	Game result recording (win/loss + credit updates)
•	Leaderboard showing top users
•	Fully deployed cloud architecture
•	RESTful API design

Environment Variables
Backend (Render)
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-1-us-east-2.pooler.supabase.com:6543/postgres?sslmode=require
JWT_SECRET=mamba-mentality-480
CORS_ORIGINS=https://blackjack480.vercel.app,http://localhost:5173
NODE_ENV=production
PGSSLMODE=no-verify
NODE_TLS_REJECT_UNAUTHORIZED=0
Frontend (Vercel)
VITE_API_BASE_URL=https://blackjack480.onrender.com

How to Run Locally
1.	Clone the repository
2.	git clone https://github.com/luisacosta204/Blackjack480.git
3.	cd Blackjack480
4.	Install dependencies
5.	cd server
6.	npm install
7.	cd ../frontend
8.	npm install
9.	Run backend
10.	cd server
11.	node server.js
12.	Run frontend
13.	cd frontend
14.	npm run dev
15.	Open the app in your browser at http://localhost:5173

API Endpoints
Health
GET /api/health
GET /api/health/db
Authentication
POST /api/register
POST /api/login
GET  /api/me
Game and Leaderboard
POST /api/game/result
GET  /api/leaderboard
 
How to Test
1.	Open the live site: https://blackjack480.vercel.app
2.	Register a new account using a unique username and email.
3.	Log in with the credentials.
4.	Click "Game" to simulate wins or losses.
5.	Click "Leaderboard" to view all users and their scores.
6.	Check Render logs or /api/health to verify API uptime.
 
Technologies Used
•	React (Vite)
•	Node.js + Express
•	PostgreSQL (Supabase)
•	Render (Backend Hosting)
•	Vercel (Frontend Hosting)
•	bcrypt (password hashing)
•	JSON Web Tokens (authentication)
•	CORS + Helmet (security)
•	RESTful API principles
 
Future Improvements
•	Replace the game stub with full Blackjack gameplay
•	Add wagering system and betting limits
•	Improve leaderboard with pagination and styling
•	Add password reset and user profile management
•	Move infrastructure to AWS (EC2, RDS, S3, CloudFront)
•	Add monitoring and CI/CD pipelines for DevOps phase

Current Status
•	Backend and database are fully connected
•	Frontend successfully integrated with backend
•	Authentication and leaderboard functional
•	Application deployed and accessible online

Credits
Project developed for CIT 480 (Software Development / DevOps)
Instructor: [Professor’s Name]
Semester: Fall 2025 – Spring 2026

