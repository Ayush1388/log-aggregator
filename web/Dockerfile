# Stage 1: Build the React UI
FROM node:alpine AS builder
WORKDIR /app
COPY package*.json ./
# CHANGED: Add --legacy-peer-deps to bypass version conflicts
RUN npm install --legacy-peer-deps
COPY . .
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]