#!/bin/bash

echo "🚀 Setting up YouTube Video to Text Converter"
echo "============================================"

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version is too old. Please install Node.js 18+ (current: $(node -v))"
    exit 1
fi

# Check for Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.8+ first."
    exit 1
fi

# Check for system dependencies
echo ""
echo "📋 Checking system dependencies..."

# Check for yt-dlp
if ! command -v yt-dlp &> /dev/null && ! command -v ~/.local/bin/yt-dlp &> /dev/null; then
    echo "⚠️  yt-dlp not found. Installing..."
    pip3 install --upgrade yt-dlp
else
    # Check version
    YT_DLP_CMD=$(command -v ~/.local/bin/yt-dlp || command -v yt-dlp)
    YT_DLP_VERSION=$($YT_DLP_CMD --version 2>/dev/null || echo "unknown")
    echo "✅ yt-dlp is installed (version: $YT_DLP_VERSION)"
    
    # Warn if version is old
    if [[ "$YT_DLP_VERSION" < "2024" ]]; then
        echo "⚠️  Your yt-dlp version is outdated. Updating..."
        pip3 install --upgrade yt-dlp
    fi
fi

# Check for Tesseract
if ! command -v tesseract &> /dev/null; then
    echo "❌ Tesseract OCR is not installed."
    echo "Please install it using:"
    echo "  Ubuntu/Debian: sudo apt-get install tesseract-ocr"
    echo "  macOS: brew install tesseract"
    echo "  Windows: Download from https://github.com/UB-Mannheim/tesseract/wiki"
    exit 1
else
    echo "✅ Tesseract is installed"
fi

# Check for FFmpeg
if ! command -v ffmpeg &> /dev/null; then
    echo "❌ FFmpeg is not installed."
    echo "Please install it using:"
    echo "  Ubuntu/Debian: sudo apt-get install ffmpeg"
    echo "  macOS: brew install ffmpeg"
    echo "  Windows: Download from https://ffmpeg.org/download.html"
    exit 1
else
    echo "✅ FFmpeg is installed"
fi

# Install Node.js dependencies
echo ""
echo "📦 Installing Node.js dependencies..."
if [ -f "pnpm-lock.yaml" ]; then
    pnpm install
elif [ -f "yarn.lock" ]; then
    yarn install
else
    npm install
fi

# Create necessary directories
echo ""
echo "📁 Creating directories..."
mkdir -p temp output logs

# Build TypeScript
echo ""
echo "🔨 Building TypeScript..."
if npm run build; then
    echo ""
    echo "✅ Setup complete!"
    echo ""
    echo "🎯 Quick start:"
    echo "  npm run dev convert https://youtube.com/watch?v=VIDEO_ID"
    echo ""
    echo "📖 For more options:"
    echo "  npm run dev -- --help"
    echo ""
else
    echo ""
    echo "❌ Build failed! Please check the errors above."
    echo ""
    echo "Common issues:"
    echo "  - Missing type definitions: npm install @types/node"
    echo "  - TypeScript version mismatch: npm install typescript@latest"
    echo "  - Dependency issues: rm -rf node_modules && npm install"
    echo ""
    exit 1
fi