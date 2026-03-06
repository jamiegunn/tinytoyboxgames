FROM nginx:alpine
COPY . /usr/share/nginx/html
RUN rm -f /usr/share/nginx/html/Dockerfile /usr/share/nginx/html/package*.json /usr/share/nginx/html/server.js /usr/share/nginx/html/node_modules -rf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
