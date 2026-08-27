# Stage 1: Build the Go binary (CHANGED to golang:alpine to get the latest version)
FROM golang:alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
# Build the binary specifically from your cmd folder
RUN go build -o log-server ./cmd/server/main.go

# Stage 2: Create the lightweight production image
FROM alpine:latest
WORKDIR /app
COPY --from=builder /app/log-server .

EXPOSE 8080
# Run the binary
CMD ["./log-server"]