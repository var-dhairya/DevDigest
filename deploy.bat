@echo off
echo 🚀 DevDigest Vercel Deployment Script
echo.

echo 📦 Building project...
npm run build

if %ERRORLEVEL% NEQ 0 (
    echo ❌ Build failed! Please fix the errors before deploying.
    pause
    exit /b 1
)

echo ✅ Build successful!
echo.

echo 🌐 Deploying to Vercel...
vercel --prod

if %ERRORLEVEL% NEQ 0 (
    echo ❌ Deployment failed! Please check your Vercel configuration.
    pause
    exit /b 1
)

echo.
echo 🎉 Deployment completed successfully!
echo 🌍 Your app is now live on Vercel!
echo.
pause 