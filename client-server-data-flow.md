# Client-Server Data Flow and Protocol Details

This document provides detailed technical information about the data exchanged between the client and server in the MCP (Model Context Protocol) implementation.

## HTTP Request/Response Structure

### 1. Initialize Request (Client → Server)

```
POST /mcp HTTP/1.1
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "method": "initialize",
  "params": {
    "client": {
      "name": "mcp-client-for-sse-server",
      "version": "1.0.0"
    },
    "capabilities": {
      "tools": {},
      "logging": {}
    }
  },
  "id": "uuid-generated-by-client"
}
```

### 2. Initialize Response (Server → Client)

```
HTTP/1.1 200 OK
Content-Type: application/json
mcp-session-id: "server-generated-uuid"

{
  "jsonrpc": "2.0",
  "result": {
    "server": {
      "name": "itsuki-mcp-server",
      "version": "1.0.0"
    },
    "capabilities": {
      "tools": {},
      "logging": {}
    }
  },
  "id": "uuid-from-request"
}
```

### 3. SSE Connection Request (Client → Server)

```
GET /mcp HTTP/1.1
Accept: text/event-stream
mcp-session-id: "server-generated-uuid"
```

### 4. SSE Connection Response (Server → Client)

```
HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive

data: {"jsonrpc":"2.0","method":"notifications/message","params":{"level":"info","data":"SSE Connection established"}}

```

### 5. List Tools Request (Client → Server)

```
POST /mcp HTTP/1.1
Content-Type: application/json
mcp-session-id: "server-generated-uuid"

{
  "jsonrpc": "2.0",
  "method": "tools/list",
  "id": "uuid-generated-by-client"
}
```

### 6. List Tools Response (Server → Client)

```
HTTP/1.1 200 OK
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "result": {
    "tools": [
      {
        "name": "single-greeting-uuid",
        "description": "Greet the user once.",
        "inputSchema": {
          "type": "object",
          "properties": {
            "name": {
              "type": "string",
              "description": "name to greet"
            }
          },
          "required": ["name"]
        }
      },
      {
        "name": "multi-great",
        "description": "Greet the user multiple times with delay in between.",
        "inputSchema": {
          "type": "object",
          "properties": {
            "name": {
              "type": "string",
              "description": "name to greet"
            }
          },
          "required": ["name"]
        }
      }
    ]
  },
  "id": "uuid-from-request"
}
```

### 7. Call Tool Request (Client → Server)

```
POST /mcp HTTP/1.1
Content-Type: application/json
mcp-session-id: "server-generated-uuid"

{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "single-greeting-uuid",
    "arguments": {
      "name": "itsuki"
    }
  },
  "id": "uuid-generated-by-client"
}
```

### 8. Call Tool Response (Server → Client)

```
HTTP/1.1 200 OK
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Hey itsuki! Welcome to itsuki's world!"
      }
    ]
  },
  "id": "uuid-from-request"
}
```

### 9. SSE Notification (Server → Client)

```
data: {"jsonrpc":"2.0","method":"notifications/message","params":{"level":"info","data":"First greet to itsuki"}}

data: {"jsonrpc":"2.0","method":"notifications/message","params":{"level":"info","data":"Second greet to itsuki"}}

data: {"jsonrpc":"2.0","method":"notifications/message","params":{"level":"info","data":"Streaming complete!"}}
```

### 10. Tool List Changed Notification (Server → Client)

```
data: {"jsonrpc":"2.0","method":"notifications/tools/list_changed"}
```

## Protocol Details

### JSON-RPC 2.0

All communication follows the JSON-RPC 2.0 specification:

- Each request contains:
  - `jsonrpc`: Always "2.0"
  - `method`: The method to call
  - `params`: Parameters for the method (optional)
  - `id`: A unique identifier for the request

- Each response contains:
  - `jsonrpc`: Always "2.0"
  - `result`: The result of the method call (for successful calls)
  - `error`: Error information (for failed calls)
  - `id`: The same identifier from the request

- Each notification contains:
  - `jsonrpc`: Always "2.0"
  - `method`: The notification method
  - `params`: Parameters for the notification (optional)

### Session Management

- The server generates a unique session ID for each client
- The client includes this session ID in all subsequent requests
- The session ID links HTTP POST requests and SSE streams
- The server maintains a map of active sessions and their transports

### Server-Sent Events (SSE)

- The client establishes an SSE connection with a GET request
- The server keeps this connection open for sending notifications
- Each notification is sent as an SSE event with a `data` field
- The client processes these events as they arrive

## Data Flow Diagram

```
┌─────────┐                                              ┌─────────┐
│         │                                              │         │
│ Client  │                                              │ Server  │
│         │                                              │         │
└────┬────┘                                              └────┬────┘
     │                                                        │
     │  POST /mcp (Initialize Request)                        │
     │───────────────────────────────────────────────────────>│
     │                                                        │
     │  HTTP 200 OK (with session ID)                         │
     │<───────────────────────────────────────────────────────│
     │                                                        │
     │  GET /mcp (SSE Connection with session ID)             │
     │───────────────────────────────────────────────────────>│
     │                                                        │
     │                    SSE Stream Open                     │
     │<· · · · · · · · · · · · · · · · · · · · · · · · · · · │
     │                                                        │
     │  POST /mcp (List Tools Request with session ID)        │
     │───────────────────────────────────────────────────────>│
     │                                                        │
     │  HTTP 200 OK (Available Tools)                         │
     │<───────────────────────────────────────────────────────│
     │                                                        │
     │  POST /mcp (Call Tool: single-greet with session ID)   │
     │───────────────────────────────────────────────────────>│
     │                                                        │
     │  HTTP 200 OK (Single Greeting Response)                │
     │<───────────────────────────────────────────────────────│
     │                                                        │
     │  POST /mcp (Call Tool: multi-greet with session ID)    │
     │───────────────────────────────────────────────────────>│
     │                                                        │
     │  SSE: First greeting notification                      │
     │<· · · · · · · · · · · · · · · · · · · · · · · · · · · │
     │                                                        │
     │  SSE: Second greeting notification                     │
     │<· · · · · · · · · · · · · · · · · · · · · · · · · · · │
     │                                                        │
     │  HTTP 200 OK (Final Greeting Response)                 │
     │<───────────────────────────────────────────────────────│
     │                                                        │
     │  SSE: Streaming complete notification                  │
     │<· · · · · · · · · · · · · · · · · · · · · · · · · · · │
     │                                                        │
     │  POST /mcp (Close Connection with session ID)          │
     │───────────────────────────────────────────────────────>│
     │                                                        │
     │  HTTP 200 OK (Connection Closed)                       │
     │<───────────────────────────────────────────────────────│
     │                                                        │
```

## Key Implementation Classes

### Client Side

- `MCPClient`: Main client class that handles connection and tool calls
- `Client`: From MCP SDK, handles the core client functionality
- `StreamableHTTPClientTransport`: Handles HTTP and SSE communication

### Server Side

- `MCPServer`: Main server class that handles requests and manages sessions
- `Server`: From MCP SDK, handles the core server functionality
- `StreamableHTTPServerTransport`: Handles HTTP and SSE communication
- `Express.js`: Web framework used for HTTP routing