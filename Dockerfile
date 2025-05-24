FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Build the React app
RUN npm run build

# Expose ports for the app and metrics
EXPOSE 5173 9090

# Start both the Vite dev server and metrics server
CMD ["npm", "run", "dev"] 