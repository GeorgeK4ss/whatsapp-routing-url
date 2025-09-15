#!/bin/bash

# WhatsApp Geo Redirect Service Deployment Script
# This script helps deploy the service to various platforms

set -e

echo "🚀 WhatsApp Geo Redirect Service Deployment Script"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Node.js is installed
check_node() {
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 20 or higher."
        exit 1
    fi
    
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 20 ]; then
        print_error "Node.js version 20 or higher is required. Current version: $(node --version)"
        exit 1
    fi
    
    print_success "Node.js $(node --version) is installed"
}

# Check if npm is installed
check_npm() {
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm."
        exit 1
    fi
    
    print_success "npm $(npm --version) is installed"
}

# Install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    npm ci --only=production
    print_success "Dependencies installed successfully"
}

# Check environment variables
check_env() {
    print_status "Checking environment variables..."
    
    if [ ! -f ".env" ]; then
        print_warning ".env file not found. Creating from template..."
        cp env.example .env
        print_warning "Please edit .env file with your configuration before running the service"
        return 1
    fi
    
    # Check required variables
    source .env
    
    if [ -z "$ADMIN_TOKEN" ] || [ "$ADMIN_TOKEN" = "your_super_secure_admin_token_here_minimum_16_chars" ]; then
        print_error "ADMIN_TOKEN is not set or is using default value"
        return 1
    fi
    
    if [ -z "$IPINFO_TOKEN" ] || [ "$IPINFO_TOKEN" = "your_ipinfo_token_here" ]; then
        print_error "IPINFO_TOKEN is not set or is using default value"
        return 1
    fi
    
    if [ -z "$DEFAULT_WHATSAPP_NUMBER" ] || [ "$DEFAULT_WHATSAPP_NUMBER" = "1234567890" ]; then
        print_warning "DEFAULT_WHATSAPP_NUMBER is using default value"
    fi
    
    if [ -z "$TURKEY_WHATSAPP_NUMBER" ] || [ "$TURKEY_WHATSAPP_NUMBER" = "1234567890" ]; then
        print_warning "TURKEY_WHATSAPP_NUMBER is using default value"
    fi
    
    print_success "Environment variables checked"
    return 0
}

# Run tests
run_tests() {
    print_status "Running tests..."
    if npm test; then
        print_success "All tests passed"
    else
        print_error "Tests failed"
        exit 1
    fi
}

# Start the service
start_service() {
    print_status "Starting WhatsApp Geo Redirect Service..."
    
    if [ "$NODE_ENV" = "development" ]; then
        npm run dev
    else
        npm start
    fi
}

# Docker deployment
deploy_docker() {
    print_status "Building Docker image..."
    docker build -t whatsapp-geo-redirect .
    print_success "Docker image built successfully"
    
    print_status "Starting Docker container..."
    docker run -d \
        --name whatsapp-geo-redirect \
        --env-file .env \
        -p 3000:3000 \
        whatsapp-geo-redirect
    print_success "Docker container started successfully"
}

# Render.com deployment
deploy_render() {
    print_status "Preparing for Render.com deployment..."
    
    if [ ! -f "render.yaml" ]; then
        print_error "render.yaml not found"
        exit 1
    fi
    
    print_success "Ready for Render.com deployment"
    print_status "1. Push your code to GitHub"
    print_status "2. Connect your repository to Render.com"
    print_status "3. Set environment variables in Render dashboard"
    print_status "4. Deploy!"
}

# Main deployment function
main() {
    case "${1:-local}" in
        "local")
            print_status "Starting local deployment..."
            check_node
            check_npm
            install_dependencies
            
            if check_env; then
                run_tests
                start_service
            else
                print_error "Environment configuration required"
                exit 1
            fi
            ;;
        "docker")
            print_status "Starting Docker deployment..."
            check_node
            check_npm
            install_dependencies
            
            if check_env; then
                run_tests
                deploy_docker
            else
                print_error "Environment configuration required"
                exit 1
            fi
            ;;
        "render")
            deploy_render
            ;;
        "test")
            print_status "Running tests only..."
            check_node
            check_npm
            install_dependencies
            run_tests
            ;;
        "check")
            print_status "Running system checks..."
            check_node
            check_npm
            check_env
            print_success "All checks passed"
            ;;
        *)
            echo "Usage: $0 {local|docker|render|test|check}"
            echo ""
            echo "Commands:"
            echo "  local   - Deploy locally (default)"
            echo "  docker  - Deploy using Docker"
            echo "  render  - Prepare for Render.com deployment"
            echo "  test    - Run tests only"
            echo "  check   - Run system checks only"
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
