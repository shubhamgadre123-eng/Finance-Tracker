#!/bin/bash

echo ""
echo "=================================================="
echo "    Finance Tracker - Startup Script"
echo "=================================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed!"
    echo ""
    echo "Please install Node.js from:"
    echo "https://nodejs.org/"
    echo ""
    exit 1
fi

echo "✅ Node.js found: $(node --version)"

# Get current directory
PROJECT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "✅ Project directory: $PROJECT_DIR"
echo ""

# Check if node_modules exists
if [ ! -d "$PROJECT_DIR/node_modules" ]; then
    echo "📦 Installing dependencies..."
    echo ""
    cd "$PROJECT_DIR"
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install dependencies"
        exit 1
    fi
    echo ""
    echo "✅ Dependencies installed successfully"
    echo ""
else
    echo "✅ Dependencies already installed"
    echo ""
fi

# Check if backend.js exists
if [ ! -f "$PROJECT_DIR/backend.js" ]; then
    echo "❌ Error: backend.js not found!"
    echo "Expected location: $PROJECT_DIR/backend.js"
    exit 1
fi

echo "✅ backend.js found"
echo ""
echo "🚀 Starting Finance Tracker Backend..."
echo ""
echo "=================================================="
echo ""

# Start the backend server
cd "$PROJECT_DIR"
node backend.js

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Backend server failed to start"
    exit 1
fi
