# Client-Server Interaction Diagram for MCP (Model Context Protocol)

## Detailed Sequence Diagram

```
+----------------+                                  +----------------+
|                |                                  |                |
|     Client     |                                  |     Server     |
|                |                                  |                |
+----------------+                                  +----------------+
        |                                                  |
        | 1. Initialize Client                             |
        |--------------------------------------------->    |
        |                                                  |
        | 2. HTTP POST /mcp (Initialize Request)           |
        |--------------------------------------------->    |
        |                                                  | 3. Create new transport
        |                                                  | and generate session ID
        |                                                  |
        | 4. HTTP 200 OK (with session ID)                 |
        |<---------------------------------------------    |
        |                                                  |
        | 5. Store session ID                              |
        |                                                  |
        | 6. HTTP GET /mcp (SSE Connection)                |
        | with session ID header                           |
        |--------------------------------------------->    |
        |                                                  | 7. Establish SSE stream
        |                                                  |
        | 8. SSE: Connection established notification      |
        |<---------------------------------------------    |
        |                                                  |
        | 9. HTTP POST /mcp (List Tools Request)           |
        | with session ID header                           |
        |--------------------------------------------->    |
        |                                                  | 10. Process request
        |                                                  |
        | 11. HTTP 200 OK (Available Tools)                |
        |<---------------------------------------------    |
        |                                                  |
        | 12. Store available tools                        |
        |                                                  |
        | 13. HTTP POST /mcp (Call Tool: single-greet)     |
        | with session ID header                           |
        |--------------------------------------------->    |
        |                                                  | 14. Process tool call
        |                                                  |
        | 15. HTTP 200 OK (Single Greeting Response)       |
        |<---------------------------------------------    |
        |                                                  |
        | 16. HTTP POST /mcp (Call Tool: multi-greet)      |
        | with session ID header                           |
        |--------------------------------------------->    |
        |                                                  | 17. Process tool call
        |                                                  |
        | 18. SSE: First greeting notification             |
        |<---------------------------------------------    |
        |                                                  |
        | 19. SSE: Second greeting notification            |
        |<---------------------------------------------    |
        |                                                  |
        | 20. HTTP 200 OK (Final Greeting Response)        |
        |<---------------------------------------------    |
        |                                                  |
        | 21. SSE: Streaming complete notification         |
        |<---------------------------------------------    |
        |                                                  |
        | 22. HTTP POST /mcp (Close Connection)            |
        |--------------------------------------------->    |
        |                                                  | 23. Clean up resources
        |                                                  |
        | 24. HTTP 200 OK (Connection Closed)              |
        |<---------------------------------------------    |
        |                                                  |
```

## Detailed Explanation of Each Step

### 1. Client Initialization
- Client creates a new `MCPClient` instance
- Sets up internal state and prepares for connection

### 2-4. Connection Establishment
- Client sends an HTTP POST request to `/mcp` endpoint
- This is an initialization request without a session ID
- Server creates a new `StreamableHTTPServerTransport` for this client
- Server generates a unique session ID and responds with it
- Client stores this session ID for future requests

### 5-7. SSE Stream Establishment
- Client sends an HTTP GET request to `/mcp` with the session ID in headers
- Server validates the session ID and establishes an SSE stream
- This stream will be used for server-to-client notifications

### 8. Initial SSE Notification
- Server sends a "Connection established" notification through the SSE stream
- Client receives and processes this notification

### 9-12. Tool Discovery
- Client sends an HTTP POST request to list available tools
- Server processes the request and responds with available tools:
  - single-greet: Returns a single greeting
  - multi-greet: Sends multiple greetings with notifications
- Client stores the list of available tools

### 13-15. Single-Greet Tool Call
- Client calls the single-greet tool via HTTP POST
- Server processes the tool call and executes the single-greet logic
- Server responds with a single greeting message
- Client receives and processes the response

### 16-21. Multi-Greet Tool Call
- Client calls the multi-greet tool via HTTP POST
- Server processes the tool call and executes the multi-greet logic
- Server sends the first greeting notification via SSE
- After a delay, server sends the second greeting notification via SSE
- Server responds with the final greeting message via HTTP
- Server sends a "Streaming complete" notification via SSE
- Client receives and processes all notifications and the response

### 22-24. Connection Closure
- Client sends a request to close the connection
- Server cleans up resources associated with this client
- Server responds confirming the connection closure

## Technical Details

### Transport Protocol
- Uses StreamableHTTP for communication
- HTTP POST for regular requests and responses
- HTTP GET with SSE for server-to-client notifications

### Session Management
- Server maintains a map of active sessions
- Each session has its own transport instance
- Session ID is used to identify clients across requests

### Tool Handling
- Server defines tools with input schemas
- Client discovers available tools through the listTools request
- Client calls tools by name with arguments
- Server processes tool calls and returns results

### Notification System
- Server sends notifications through the SSE stream
- Client registers notification handlers for different notification types
- Notifications include logging messages and tool list changes

### Error Handling
- Transport errors are caught and handled
- Connection closure is properly managed
- Failed requests result in appropriate error responses
```

This diagram illustrates the complete interaction flow between the client and server in the MCP implementation, showing both the HTTP request/response cycle and the SSE notification stream.