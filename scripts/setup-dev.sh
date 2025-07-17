#!/bin/bash
set -e

echo "🚀 Setting up development environment..."

# Check Node.js version
NODE_VERSION=$(node -v | grep -oE 'v([0-9]+)' | grep -oE '[0-9]+' | head -1)
if [ -z "$NODE_VERSION" ] || [ "$NODE_VERSION" -lt 20 ]; then
  echo "❌ Node.js 20 or higher is required. Current version: $(node -v)"
  exit 1
fi

# Check pnpm
if ! command -v pnpm &>/dev/null; then
  echo "❌ pnpm is not installed. Please install it first:"
  echo "   npm install -g pnpm"
  exit 1
fi

# Check Tesseract
if ! command -v tesseract &>/dev/null; then
  echo "⚠️  Tesseract OCR is not installed."
  echo "   Please install it for your platform:"
  echo "   - macOS: brew install tesseract"
  echo "   - Ubuntu/Debian: sudo apt-get install tesseract-ocr"
  echo "   - Windows: choco install tesseract"
fi

# Check FFmpeg
if ! command -v ffmpeg &>/dev/null; then
  echo "⚠️  FFmpeg is not installed."
  echo "   Please install it for your platform:"
  echo "   - macOS: brew install ffmpeg"
  echo "   - Ubuntu/Debian: sudo apt-get install ffmpeg"
  echo "   - Windows: choco install ffmpeg"
fi

# Check if yt-dlp is installed
if ! command -v yt-dlp &>/dev/null; then
  echo "⚠️  yt-dlp is not installed."
  echo "   Please install it for your platform:"
  echo "   - macOS: brew install yt-dlp"
  echo "   - Ubuntu/Debian: sudo apt-get install yt-dlp"
  echo "   - Windows: choco install yt-dlp"
  echo "   Alternatively, you can install it via pip: pip install yt-dlp"
fi

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Setup git hooks
echo "🪝 Setting up Git hooks..."
pnpm exec husky install

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p temp/frames output logs

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
  echo "📝 Creating .env file..."
  cp .env.example .env 2>/dev/null || echo "# Environment variables" >.env
fi

# Build the project
echo "🔨 Building project..."
pnpm build

# Run tests
echo "🧪 Running tests..."
pnpm test

echo "✅ Development environment setup complete!"
echo ""
echo "Available commands:"
echo "  pnpm dev       - Run in development mode"
echo "  pnpm test      - Run tests"
echo "  pnpm lint      - Check code style"
echo "  pnpm build     - Build for production"
echo ""
echo "Happy coding! 🎉"
