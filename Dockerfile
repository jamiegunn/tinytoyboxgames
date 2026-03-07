FROM node:22.14-alpine3.21 AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Validate critical files exist
RUN test -f dist/index.html && test -f dist/toybox.html \
    || (echo "Build validation failed: missing HTML files" && exit 1)

FROM nginx:1.27-alpine3.21
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
