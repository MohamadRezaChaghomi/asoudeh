FROM node:22.14-alpine AS build
WORKDIR /app/backend
COPY package.json /app/package.json
COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY backend/ ./
RUN npm run build

FROM node:22.14-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app/backend
COPY package.json /app/package.json
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/backend/dist ./dist
RUN chown -R node:node /app
USER node
EXPOSE 5000
CMD ["node", "dist/server.js"]
