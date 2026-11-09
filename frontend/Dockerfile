FROM node:22.14-alpine AS build
ARG NEXT_PUBLIC_API_URL
WORKDIR /app/frontend
COPY package.json /app/package.json
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
ENV NODE_ENV=production
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
COPY frontend/ ./
RUN npm run build

FROM node:22.14-alpine AS runtime
ARG NEXT_PUBLIC_API_URL
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
WORKDIR /app/frontend
COPY package.json /app/package.json
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/frontend/.next ./.next
COPY --from=build /app/frontend/public ./public
COPY --from=build /app/frontend/next.config.ts ./next.config.ts
RUN chown -R node:node /app
USER node
EXPOSE 3000
CMD ["npm", "start", "--", "--hostname", "0.0.0.0"]
