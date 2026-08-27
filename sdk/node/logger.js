// logger.js
export class Logger {
  constructor(config) {
    if (!config.token) throw new Error("Logger requires an API token");
    
    this.endpoint = config.endpoint || "http://localhost:8080/ingest";
    this.token = config.token;
    this.serviceId = config.serviceId || "unknown-service";
  }

  // The core private method that handles the HTTP request
  async _send(level, message, metadata = {}) {
    const payload = {
      service_id: this.serviceId,
      level: level,
      message: message,
      timestamp: new Date().toISOString(),
      metadata: metadata,
    };

    try {
      // Fire and forget: We don't await the fetch response in the main thread
      // so we don't block the user's application.
      fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.token}`,
        },
        body: JSON.stringify(payload),
      }).catch(err => console.error("[Logger SDK] Failed to send log:", err));
    } catch (err) {
      console.error("[Logger SDK] Critical error:", err);
    }
  }

  // Public methods for the developer to use
  info(message, metadata) { this._send("INFO", message, metadata); }
  warn(message, metadata) { this._send("WARN", message, metadata); }
  error(message, metadata) { this._send("ERROR", message, metadata); }
}