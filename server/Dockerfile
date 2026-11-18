FROM node:20-alpine

WORKDIR /app

# Install openssl for Prisma runtime
RUN apk add --no-cache openssl

# Install dependencies first (layer caching)
COPY package*.json ./
COPY prisma ./prisma/
RUN npm install

# Generate Prisma Client
RUN npx prisma generate

# Copy the rest of the application files
COPY . .

EXPOSE 5000

# Push DB schema, run seed, and start the production server
CMD ["sh", "-c", "npx prisma db push && npm run db:seed && npm start"]
