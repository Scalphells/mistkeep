# Front end image: build the static bundle with the Supabase endpoint baked in
# (Vite inlines VITE_* at BUILD time), then serve it with nginx.
#
# IMPORTANT: VITE_SUPABASE_URL must be the address the BROWSER can reach
# (e.g. http://localhost:8000), not an internal Docker hostname.
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
RUN npm run build

FROM nginx:alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
