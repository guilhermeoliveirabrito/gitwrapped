# syntax=docker/dockerfile:1

# ---- build: compile TypeScript ----
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json tsconfig.json tsconfig.build.json ./
RUN npm install --no-audit --no-fund
COPY src ./src
RUN npm run build

# ---- runtime: no dependencies, just the compiled output ----
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000
COPY --from=build /app/dist ./dist
COPY package.json ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/serve.js"]
