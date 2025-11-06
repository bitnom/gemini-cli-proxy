import {describe, it, expect} from "vitest";
import {mapAnthropicMessagesRequestToGemini, mapGeminiResponseToAnthropic} from "./anthropic-mapper.js";
import * as Anthropic from "../types/anthropic.js";
import * as Gemini from "../types/gemini.js";

describe("mapAnthropicMessagesRequestToGemini", () => {
    it("should map basic request with simple message", () => {
        const request: Anthropic.MessagesRequest = {
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 1000,
            messages: [
                {
                    role: "user",
                    content: "Hello world"
                }
            ]
        };

        const result = mapAnthropicMessagesRequestToGemini("test-project", request);

        expect(result.model).toBe(Gemini.Model.Gemini25Pro);
        expect(result.project).toBe("test-project");
        expect(result.request.contents).toHaveLength(1);
        expect(result.request.contents[0].role).toBe("user");
        expect(result.request.contents[0].parts).toEqual([{text: "Hello world"}]);
    });

    it("should map request with temperature", () => {
        const request: Anthropic.MessagesRequest = {
            model: "claude-3-haiku-20240307",
            max_tokens: 500,
            temperature: 0.7,
            messages: [
                {
                    role: "user",
                    content: "Test message"
                }
            ]
        };

        const result = mapAnthropicMessagesRequestToGemini("test-project", request);

        expect(result.request.generationConfig?.temperature).toBe(0.7);
    });

    it("should map request with system message", () => {
        const request: Anthropic.MessagesRequest = {
            model: "claude-3-opus-20240229",
            max_tokens: 1000,
            system: [
                {
                    type: "text",
                    text: "You are a helpful assistant"
                }
            ],
            messages: [
                {
                    role: "user",
                    content: "Hello"
                }
            ]
        };

        const result = mapAnthropicMessagesRequestToGemini("test-project", request);

        expect(result.request.systemInstruction).toBeDefined();
        expect(result.request.systemInstruction?.parts).toEqual([
            {text: "You are a helpful assistant"}
        ]);
    });

    it("should map request with tools and comprehensive schema conversion", () => {
        const request: Anthropic.MessagesRequest = {
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 1000,
            tools: [
                {
                    name: "get_weather",
                    description: "Get weather information",
                    input_schema: {
                        type: "object",
                        properties: {
                            location: {type: "string"},
                            options: {
                                type: ["string", "null"]
                            }
                        },
                        required: ["location"],
                        $schema: "http://json-schema.org/draft-07/schema#"
                    }
                }
            ],
            messages: [
                {
                    role: "user",
                    content: "What is the weather?"
                }
            ]
        };

        const result = mapAnthropicMessagesRequestToGemini("test-project", request);

        expect(result.request.tools).toBeDefined();
        expect(result.request.tools?.[0]?.functionDeclarations).toHaveLength(1);
        
        const functionDeclaration = result.request.tools?.[0]?.functionDeclarations?.[0];
        expect(functionDeclaration?.name).toBe("get_weather");
        expect(functionDeclaration?.description).toBe("Get weather information");
        expect(functionDeclaration?.parameters).toEqual({
            type: "object",
            properties: {
                location: {type: "string"},
                options: {
                    type: "string",
                    nullable: true
                }
            },
            required: ["location"]
        });
        // Ensure $schema is removed and array types are converted
        expect(functionDeclaration?.parameters).not.toHaveProperty("$schema");
    });

    it("should map request with tool_choice auto", () => {
        const request: Anthropic.MessagesRequest = {
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 1000,
            tool_choice: "auto",
            tools: [
                {
                    name: "test_tool",
                    description: "Test tool",
                    input_schema: {type: "object"}
                }
            ],
            messages: [
                {
                    role: "user",
                    content: "Test"
                }
            ]
        };

        const result = mapAnthropicMessagesRequestToGemini("test-project", request);

        expect(result.request.toolConfig).toEqual({
            functionCallingConfig: {
                mode: "AUTO"
            }
        });
    });

    it("should map request with tool_choice any", () => {
        const request: Anthropic.MessagesRequest = {
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 1000,
            tool_choice: "any",
            tools: [
                {
                    name: "test_tool",
                    description: "Test tool",
                    input_schema: {type: "object"}
                }
            ],
            messages: [
                {
                    role: "user",
                    content: "Test"
                }
            ]
        };

        const result = mapAnthropicMessagesRequestToGemini("test-project", request);

        expect(result.request.toolConfig).toEqual({
            functionCallingConfig: {
                mode: "ANY"
            }
        });
    });

    it("should map request with specific tool choice", () => {
        const request: Anthropic.MessagesRequest = {
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 1000,
            tool_choice: {
                type: "tool",
                name: "specific_tool"
            },
            tools: [
                {
                    name: "specific_tool",
                    description: "Specific tool",
                    input_schema: {type: "object"}
                }
            ],
            messages: [
                {
                    role: "user",
                    content: "Test"
                }
            ]
        };

        const result = mapAnthropicMessagesRequestToGemini("test-project", request);

        expect(result.request.toolConfig).toEqual({
            functionCallingConfig: {
                mode: "ANY",
                allowedFunctionNames: ["specific_tool"]
            }
        });
    });

    it("should map messages with array content", () => {
        const request: Anthropic.MessagesRequest = {
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 1000,
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: "Hello"
                        },
                        {
                            type: "image",
                            source: {
                                type: "base64",
                                media_type: "image/png",
                                data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
                            }
                        }
                    ]
                }
            ]
        };

        const result = mapAnthropicMessagesRequestToGemini("test-project", request);

        expect(result.request.contents[0].parts).toHaveLength(2);
        expect(result.request.contents[0].parts[0]).toEqual({text: "Hello\n"});
        expect(result.request.contents[0].parts[1]).toEqual({
            inlineData: {
                mimeType: "image/png",
                data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
            }
        });
    });

    it("should add newline to text content that doesn't end with newline", () => {
        const request: Anthropic.MessagesRequest = {
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 1000,
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: "Hello world"
                        }
                    ]
                }
            ]
        };

        const result = mapAnthropicMessagesRequestToGemini("test-project", request);

        expect(result.request.contents[0].parts).toEqual([{text: "Hello world\n"}]);
    });

    it("should not add extra newline to text content that already ends with newline", () => {
        const request: Anthropic.MessagesRequest = {
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 1000,
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text", 
                            text: "Hello world\n"
                        }
                    ]
                }
            ]
        };

        const result = mapAnthropicMessagesRequestToGemini("test-project", request);

        expect(result.request.contents[0].parts).toEqual([{text: "Hello world\n"}]);
    });

    it("should handle empty text content by adding newline", () => {
        const request: Anthropic.MessagesRequest = {
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 1000,
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: ""
                        }
                    ]
                }
            ]
        };

        const result = mapAnthropicMessagesRequestToGemini("test-project", request);

        expect(result.request.contents[0].parts).toEqual([{text: "\n"}]);
    });

    it("should handle multiple text contents with newline logic", () => {
        const request: Anthropic.MessagesRequest = {
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 1000,
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: "First text"
                        },
                        {
                            type: "text",
                            text: "Second text\n"
                        },
                        {
                            type: "text",
                            text: "Third text"
                        }
                    ]
                }
            ]
        };

        const result = mapAnthropicMessagesRequestToGemini("test-project", request);

        expect(result.request.contents[0].parts).toEqual([
            {text: "First text\n"},
            {text: "Second text\n"},
            {text: "Third text\n"}
        ]);
    });

    it("should handle mixed text and image content with newline logic", () => {
        const request: Anthropic.MessagesRequest = {
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 1000,
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: "Look at this image"
                        },
                        {
                            type: "image",
                            source: {
                                type: "base64",
                                media_type: "image/jpeg",
                                data: "test-image-data"
                            }
                        },
                        {
                            type: "text",
                            text: "What do you see?\n"
                        }
                    ]
                }
            ]
        };

        const result = mapAnthropicMessagesRequestToGemini("test-project", request);

        expect(result.request.contents[0].parts).toEqual([
            {text: "Look at this image\n"},
            {
                inlineData: {
                    mimeType: "image/jpeg",
                    data: "test-image-data"
                }
            },
            {text: "What do you see?\n"}
        ]);
    });

    it("should map assistant role to model role", () => {
        const request: Anthropic.MessagesRequest = {
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 1000,
            messages: [
                {
                    role: "assistant",
                    content: "Hello from assistant"
                }
            ]
        };

        const result = mapAnthropicMessagesRequestToGemini("test-project", request);

        expect(result.request.contents[0].role).toBe("model");
        expect(result.request.contents[0].parts).toEqual([{text: "Hello from assistant"}]);
    });

    it("should handle invalid tool_choice with fallback to auto", () => {
        const request: Anthropic.MessagesRequest = {
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 1000,
            tool_choice: {type: "invalid"} as unknown as Anthropic.ToolChoice,
            tools: [
                {
                    name: "test_tool",
                    description: "Test tool",
                    input_schema: {type: "object"}
                }
            ],
            messages: [
                {
                    role: "user",
                    content: "Test"
                }
            ]
        };

        const result = mapAnthropicMessagesRequestToGemini("test-project", request);

        expect(result.request.toolConfig).toEqual({
            functionCallingConfig: {
                mode: "AUTO"
            }
        });
    });
});

describe("mapGeminiResponseToAnthropic", () => {
    it("should map basic text response", () => {
        const geminiResponse = {
            content: "Hello from Gemini",
            usage: {
                inputTokens: 10,
                outputTokens: 5
            }
        };

        const result = mapGeminiResponseToAnthropic(geminiResponse, "claude-3-5-sonnet-20241022", "req-123");

        expect(result.id).toBe("req-123");
        expect(result.type).toBe("message");
        expect(result.role).toBe("assistant");
        expect(result.model).toBe("claude-3-5-sonnet-20241022");
        expect(result.stop_reason).toBe("end_turn");
        expect(result.content).toHaveLength(1);
        expect(result.content[0]).toEqual({
            type: "text",
            text: "Hello from Gemini"
        });
        expect(result.usage).toEqual({
            input_tokens: 10,
            output_tokens: 5
        });
    });

    it("should map response with tool calls", () => {
        const geminiResponse = {
            content: "I will check the weather for you.",
            tool_calls: [
                {
                    id: "tool_call_123",
                    function: {
                        name: "get_weather",
                        arguments: "{\"location\": \"New York\"}"
                    }
                }
            ],
            usage: {
                inputTokens: 15,
                outputTokens: 20
            }
        };

        const result = mapGeminiResponseToAnthropic(geminiResponse, "claude-3-5-sonnet-20241022", "req-456");

        expect(result.id).toBe("req-456");
        expect(result.stop_reason).toBe("tool_use");
        expect(result.content).toHaveLength(2);
        
        expect(result.content[0]).toEqual({
            type: "text",
            text: "I will check the weather for you."
        });
        
        expect(result.content[1]).toEqual({
            type: "tool_use",
            id: "tool_call_123",
            name: "get_weather",
            input: {location: "New York"}
        });
    });

    it("should map response with only tool calls (no text content)", () => {
        const geminiResponse = {
            tool_calls: [
                {
                    id: "tool_call_456",
                    function: {
                        name: "calculate",
                        arguments: "{\"expression\": \"2 + 2\"}"
                    }
                },
                {
                    id: "tool_call_789",
                    function: {
                        name: "search",
                        arguments: "{\"query\": \"artificial intelligence\"}"
                    }
                }
            ],
            usage: {
                inputTokens: 20,
                outputTokens: 10
            }
        };

        const result = mapGeminiResponseToAnthropic(geminiResponse, "claude-3-haiku-20240307", "req-789");

        expect(result.stop_reason).toBe("tool_use");
        expect(result.content).toHaveLength(2);
        
        expect(result.content[0]).toEqual({
            type: "tool_use",
            id: "tool_call_456",
            name: "calculate",
            input: {expression: "2 + 2"}
        });
        
        expect(result.content[1]).toEqual({
            type: "tool_use",
            id: "tool_call_789",
            name: "search",
            input: {query: "artificial intelligence"}
        });
    });

    it("should handle response with no content or tool calls", () => {
        const geminiResponse = {
            usage: {
                inputTokens: 5,
                outputTokens: 0
            }
        };

        const result = mapGeminiResponseToAnthropic(geminiResponse, "claude-3-opus-20240229", "req-empty");

        expect(result.content).toHaveLength(0);
        expect(result.stop_reason).toBe("end_turn");
        expect(result.usage).toEqual({
            input_tokens: 5,
            output_tokens: 0
        });
    });

    it("should handle response with missing usage information", () => {
        const geminiResponse = {
            content: "Response without usage info"
        };

        const result = mapGeminiResponseToAnthropic(geminiResponse, "claude-3-5-sonnet-20241022", "req-no-usage");

        expect(result.usage).toEqual({
            input_tokens: 0,
            output_tokens: 0
        });
    });

    it("should handle response with partial usage information", () => {
        const geminiResponse = {
            content: "Response with partial usage",
            usage: {
                inputTokens: 10
            }
        };

        const result = mapGeminiResponseToAnthropic(geminiResponse, "claude-3-5-sonnet-20241022", "req-partial-usage");

        expect(result.usage).toEqual({
            input_tokens: 10,
            output_tokens: 0
        });
    });

    it("should handle malformed JSON in tool call arguments", () => {
        const geminiResponse = {
            tool_calls: [
                {
                    id: "tool_call_bad_json",
                    function: {
                        name: "bad_tool",
                        arguments: "invalid json"
                    }
                }
            ]
        };

        expect(() => {
            mapGeminiResponseToAnthropic(geminiResponse, "claude-3-5-sonnet-20241022", "req-bad-json");
        }).toThrow();
    });
});