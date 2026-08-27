// app.js
import { Logger } from './logger.js';

// 1. They configure your SDK once when their app starts
const logger = new Logger({
  endpoint: "http://localhost:8080/ingest",
  token: "my-secret-dev-token", // The token our Go server expects!
  serviceId: "checkout-microservice"
});

// 2. They use it throughout their codebase!
console.log("Starting customer application...");

logger.info("Application booted successfully", { node_version: process.version });

logger.warn("Database connection slow", { 
    latency_ms: 450, 
    database_host: "aws-rds-cluster" 
});

logger.error("Failed to process payment", { 
    user_id: 88471, 
    cart_total: 129.99, 
    error_code: "STRIPE_TIMEOUT" 
});