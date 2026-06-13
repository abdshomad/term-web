FROM node:22-slim

# Install build dependencies for compiling node-pty, openssh-client, and sshpass
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    openssh-client \
    sshpass \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /usr/src/app

# Copy dependency definitions
COPY package*.json ./

# Install dependencies (compiling node-pty inside the container)
RUN npm install

# Copy application files
COPY . .

# Expose the application port
EXPOSE 3046

# Command to run the application
CMD ["npm", "start"]
