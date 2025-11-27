# Dockerfile for Cloud Run (Node 18 + Express)

FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Install dependencies
COPY package.json ./
RUN npm install --only=production

# Copy source
COPY index.js ./

# Expose port (Cloud Run uses PORT env, default 8080)
EXPOSE 8080

# Start server
CMD ["npm", "start"]
