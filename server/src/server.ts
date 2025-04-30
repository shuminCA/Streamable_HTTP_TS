import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { Notification, CallToolRequestSchema, ListToolsRequestSchema, ToolListChangedNotification, JSONRPCNotification, JSONRPCError, InitializeRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { randomUUID } from "crypto";
import { Request, Response } from "express"

const SESSION_ID_HEADER_NAME = "mcp-session-id"
const JSON_RPC = "2.0"

export class MCPServer {
    server: Server

    // to support multiple simultaneous connections
    transports: {[sessionId: string]: StreamableHTTPServerTransport} = {}

    private toolInterval: NodeJS.Timeout | undefined
    private weatherForecastToolName = "weather-forecast"

    constructor(server: Server) {
        this.server = server
        this.setupTools()
    }

    async handleGetRequest(req: Request, res: Response) {
        console.log("get request received")
        // if server does not offer an SSE stream at this endpoint.
        // res.status(405).set('Allow', 'POST').send('Method Not Allowed')

        const sessionId = req.headers['mcp-session-id'] as string | undefined
        if (!sessionId || !this.transports[sessionId]) {
            res.status(400).json(this.createErrorResponse("Bad Request: invalid session ID or method."))
            return
        }

        console.log(`Establishing SSE stream for session ${sessionId}`)
        const transport = this.transports[sessionId]
        await transport.handleRequest(req, res)

        return
    }

    async handlePostRequest(req: Request, res: Response) {
        const sessionId = req.headers[SESSION_ID_HEADER_NAME] as string | undefined

        console.log("post request received")
        console.log("request body: ", req.body)

        let transport: StreamableHTTPServerTransport

        try {
            // reuse existing transport
            if (sessionId && this.transports[sessionId]) {
                transport = this.transports[sessionId]
                await transport.handleRequest(req, res, req.body)
                return
            }

            // create new transport
            if (!sessionId && this.isInitializeRequest(req.body)) {
                const transport = new StreamableHTTPServerTransport({
                    sessionIdGenerator: () => randomUUID(),
                    // for stateless mode:
                    // sessionIdGenerator: () => undefined
                })

                await this.server.connect(transport)
                await transport.handleRequest(req, res, req.body)

                // session ID will only be available (if in not Stateless-Mode)
                // after handling the first request
                const sessionId = transport.sessionId
                if (sessionId) {
                    this.transports[sessionId] = transport
                }

                console.log("session id", sessionId)
                return
            }

            res.status(400).json(this.createErrorResponse("Bad Request: invalid session ID or method."))
            return

        } catch (error) {

            console.error('Error handling MCP request:', error)
            res.status(500).json(this.createErrorResponse("Internal server error."))
            return
        }
    }

    async cleanup() {
        this.toolInterval?.close()
        await this.server.close()
    }

    private setupTools() {

        // Define available tools
        const setToolSchema = () => this.server.setRequestHandler(ListToolsRequestSchema, async () => {

            const weatherForecastTool = {
                name: this.weatherForecastToolName,
                description: "Get weather forecast for a location.",
                inputSchema: {
                    type: "object",
                    properties: {
                        latitude: {
                            type: "number"
                        },
                        longitude: {
                            type: "number"
                        }
                    },
                    required: ["latitude", "longitude"]
                }
            }

            return {
                tools: [weatherForecastTool]
            }
        })

        setToolSchema()

        // set tools dynamically, changing 5 second
        this.toolInterval = setInterval(async () => {
            setToolSchema()
            // to notify client that the tool changed
            Object.values(this.transports).forEach((transport) => {

                const notification: ToolListChangedNotification = {
                    method: "notifications/tools/list_changed",
                }
                this.sendNotification(transport, notification)
            })
        }, 5000)

        // handle tool calls
        this.server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
            console.log("tool request received: ", request)
            console.log("extra: ", extra)

            const args = request.params.arguments
            const toolName = request.params.name
            const sendNotification = extra.sendNotification

            if (!args) {
                throw new Error("arguments undefined")
            }

            if (!toolName) {
                throw new Error("tool name undefined")
            }

            if (toolName === this.weatherForecastToolName) {

                return {
                    content: [ {
                        type: "text",
                        text: "Mock weather forecast result"
                    }]
                }
            }

            throw new Error("Tool not found")
        })
    }


    private async sendNotification(transport: StreamableHTTPServerTransport, notification: Notification) {
        const rpcNotificaiton: JSONRPCNotification = {
            ...notification,
            jsonrpc: JSON_RPC,
        }
        await transport.send(rpcNotificaiton)
    }

    private createErrorResponse(message: string): JSONRPCError {
        return {
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: message,
            },
            id: randomUUID(),
        }
    }

    private isInitializeRequest(body: any): boolean {
        const isInitial = (data: any) => {
            const result = InitializeRequestSchema.safeParse(data)
            return result.success
        }
        if (Array.isArray(body)) {
          return body.some(request => isInitial(request))
        }
        return isInitial(body)
    }

}