# Vælg en base image med Node.js
FROM node:18

# Sæt arbejdsbiblioteket i containeren
WORKDIR /app

# Kopier package.json og package-lock.json
COPY package*.json ./

# Installer afhængigheder
RUN npm install

# Kopier hele applikationen til containeren
COPY . .

# Exponer porten, som applikationen vil køre på
EXPOSE 3000

# Kør applikationen
CMD ["npm", "start"]
