#!/bin/bash
# setup.sh - Initialize AI Quiz Generator project

# Set up colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Setting up AI Quiz Generator...${NC}"

# Check if podman is installed
if ! command -v podman &> /dev/null; then
    echo -e "${RED}Podman is not installed. Please install podman first.${NC}"
    exit 1
fi

# Check if podman-compose is installed
if ! command -v podman-compose &> /dev/null; then
    echo -e "${YELLOW}Podman-compose not found. Installing...${NC}"
    pip install podman-compose
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo -e "${YELLOW}Creating .env file...${NC}"
    cat > .env << EOF
# Security
SECRET_KEY=$(openssl rand -hex 32)
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Admin User
ADMIN_EMAIL=admin@example.com
ADMIN_USERNAME=admin
ADMIN_PASSWORD=adminpassword123

# API Keys
GEMINI_API_KEY=your_gemini_api_key_here
EOF
    echo -e "${GREEN}.env file created successfully.${NC}"
    echo -e "${YELLOW}Please update the Gemini API key in the .env file.${NC}"
else
    echo -e "${GREEN}.env file already exists.${NC}"
fi

# Create uploads directory
mkdir -p backend/uploads
echo -e "${GREEN}Uploads directory created.${NC}"

# Create logs directory
mkdir -p logs
echo -e "${GREEN}Logs directory created.${NC}"

# Build and start the containers
echo -e "${GREEN}Building and starting containers...${NC}"
podman-compose up -d --build

echo -e "${GREEN}Setup complete!${NC}"
echo -e "${GREEN}The API is now running at http://localhost:8000${NC}"
echo -e "${YELLOW}API Documentation is available at http://localhost:8000/docs${NC}"