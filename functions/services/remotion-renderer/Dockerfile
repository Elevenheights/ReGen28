FROM node:18-slim

# Install ffmpeg
RUN apt-get update && apt-get install -y ffmpeg

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Build TS and Bundle Remotion
RUN npm run build

CMD ["npm", "start"]
