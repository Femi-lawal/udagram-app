# Set the base image
FROM node:13.11.0
# Create app directory
WORKDIR /usr/src/app
# Copy package.json AND package-lock.json
COPY package*.json ./
# Install all dependencies
RUN npm ci 
# Copy the rest of the code
COPY . .
# Expose the port 
EXPOSE 8000
# Define the command that should be executed
CMD [ "npm", "run", "prod" ]