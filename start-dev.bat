@echo off
echo Starting DevDigest Development Environment...
echo.

echo Installing dependencies...
npm install

echo.
echo Setting up database...
npm run db:setup

echo.
echo Starting Next.js full-stack development server...
echo App will be available at: http://localhost:3000
echo API routes at: http://localhost:3000/api
echo.
npm run dev

pause 