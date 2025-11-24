# ---- Base ----
FROM node:20-slim AS base
WORKDIR /usr/src/app
COPY package.json package-lock.json* ./

# ---- Dependencies ----
FROM base AS dependencies
RUN npm install --omit=dev

# ---- Build ----
FROM base AS build
COPY . .
RUN npm install
RUN npm run build

# ---- Release ----
FROM base AS release
COPY --from=dependencies /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/main"]
