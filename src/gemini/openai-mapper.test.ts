import {describe, it, expect} from "vitest";
import {mapOpenAIChatCompletionRequestToGemini} from "./openai-mapper.js";
import * as OpenAI from "../types/openai.js";
import * as Gemini from "../types/gemini.js";

describe("mapOpenAIChatCompletionRequestToGemini", () => {
    it("should map basic request with simple message", () => {
        const request: OpenAI.ChatCompletionRequest = {
            model: "gemini-2.5-pro",
            messages: [
                {
                    role: "user",
                    content: "Hello world"
                }
            ]
        };

        const result = mapOpenAIChatCompletionRequestToGemini("test-project", request);

        expect(result.model).toBe(Gemini.Model.Gemini3ProPreview);
        expect(result.project).toBe("test-project");
        expect(result.request.contents).toHaveLength(1);
        expect(result.request.contents[0].role).toBe("user");
        expect(result.request.contents[0].parts).toEqual([{text: "Hello world"}]);
    });

    it("should map request with temperature", () => {
        const request: OpenAI.ChatCompletionRequest = {
            model: "gemini-2.5-flash",
            temperature: 0.7,
            messages: [
                {
                    role: "user",
                    content: "Test message"
                }
            ]
        };

        const result = mapOpenAIChatCompletionRequestToGemini("test-project", request);

        expect(result.request.generationConfig?.temperature).toBe(0.7);
    });

    it("should map request with system message", () => {
        const request: OpenAI.ChatCompletionRequest = {
            model: "gemini-2.5-pro",
            messages: [
                {
                    role: "system",
                    content: "You are a helpful assistant"
                },
                {
                    role: "user",
                    content: "Hello"
                }
            ]
        };

        const result = mapOpenAIChatCompletionRequestToGemini("test-project", request);

        expect(result.request.systemInstruction).toEqual({
            parts: [{text: "You are a helpful assistant"}]
        });
        expect(result.request.contents).toHaveLength(1);
        expect(result.request.contents[0].role).toBe("user");
    });

    it("should map request with developer role as system message", () => {
        const request: OpenAI.ChatCompletionRequest = {
            model: "gemini-2.5-pro",
            messages: [
                {
                    role: "developer",
                    content: "You are a code assistant"
                },
                {
                    role: "user",
                    content: "Hello"
                }
            ]
        };

        const result = mapOpenAIChatCompletionRequestToGemini("test-project", request);

        expect(result.request.systemInstruction).toEqual({
            parts: [{text: "You are a code assistant"}]
        });
    });

    it("should map request with array content in system message", () => {
        const request: OpenAI.ChatCompletionRequest = {
            model: "gemini-2.5-pro",
            messages: [
                {
                    role: "system",
                    content: [
                        {type: "text", text: "You are "},
                        {type: "text", text: "a helpful assistant"}
                    ]
                },
                {
                    role: "user",
                    content: "Hello"
                }
            ]
        };

        const result = mapOpenAIChatCompletionRequestToGemini("test-project", request);

        expect(result.request.systemInstruction).toEqual({
            parts: [{text: "You are a helpful assistant"}]
        });
    });

    it("should map request with tools", () => {
        const request: OpenAI.ChatCompletionRequest = {
            model: "gemini-2.5-pro",
            tools: [
                {
                    type: "function",
                    function: {
                        name: "get_weather",
                        description: "Get weather information",
                        parameters: {
                            type: "object",
                            properties: {
                                location: {type: "string"}
                            },
                            required: ["location"]
                        }
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

        const result = mapOpenAIChatCompletionRequestToGemini("test-project", request);

        expect(result.request.tools).toBeDefined();
        expect(result.request.tools?.[0]?.functionDeclarations).toHaveLength(1);

        const functionDeclaration = result.request.tools?.[0]?.functionDeclarations?.[0];
        expect(functionDeclaration?.name).toBe("get_weather");
        expect(functionDeclaration?.description).toBe("Get weather information");
        expect(functionDeclaration?.parameters).toEqual({
            type: "object",
            properties: {
                location: {type: "string"}
            },
            required: ["location"]
        });
    });

    it("should map request with tool_choice none", () => {
        const request: OpenAI.ChatCompletionRequest = {
            model: "gemini-2.5-pro",
            tool_choice: "none",
            tools: [
                {
                    type: "function",
                    function: {
                        name: "test_tool",
                        description: "Test tool",
                        parameters: {type: "object"}
                    }
                }
            ],
            messages: [
                {
                    role: "user",
                    content: "Test"
                }
            ]
        };

        const result = mapOpenAIChatCompletionRequestToGemini("test-project", request);

        expect(result.request.toolConfig).toEqual({
            functionCallingConfig: {
                mode: "NONE",
                allowedFunctionNames: undefined
            }
        });
    });

    it("should map request with tool_choice auto", () => {
        const request: OpenAI.ChatCompletionRequest = {
            model: "gemini-2.5-pro",
            tool_choice: "auto",
            tools: [
                {
                    type: "function",
                    function: {
                        name: "test_tool",
                        description: "Test tool",
                        parameters: {type: "object"}
                    }
                }
            ],
            messages: [
                {
                    role: "user",
                    content: "Test"
                }
            ]
        };

        const result = mapOpenAIChatCompletionRequestToGemini("test-project", request);

        expect(result.request.toolConfig).toEqual({
            functionCallingConfig: {
                mode: "AUTO",
                allowedFunctionNames: undefined
            }
        });
    });

    it("should map request with specific tool choice", () => {
        const request: OpenAI.ChatCompletionRequest = {
            model: "gemini-2.5-pro",
            tool_choice: {
                type: "function",
                function: {name: "specific_tool"}
            },
            tools: [
                {
                    type: "function",
                    function: {
                        name: "specific_tool",
                        description: "Specific tool",
                        parameters: {type: "object"}
                    }
                }
            ],
            messages: [
                {
                    role: "user",
                    content: "Test"
                }
            ]
        };

        const result = mapOpenAIChatCompletionRequestToGemini("test-project", request);

        expect(result.request.toolConfig).toEqual({
            functionCallingConfig: {
                mode: "ANY",
                allowedFunctionNames: ["specific_tool"]
            }
        });
    });

    it("should map request with reasoning_effort", () => {
        const request: OpenAI.ChatCompletionRequest = {
            model: "gemini-2.5-pro",
            reasoning_effort: OpenAI.ReasoningEffort.medium,
            messages: [
                {
                    role: "user",
                    content: "Think about this problem"
                }
            ]
        };

        const result = mapOpenAIChatCompletionRequestToGemini("test-project", request);

        expect(result.request.generationConfig?.thinkingConfig).toEqual({
            thinkingBudget: 8192,
            includeThoughts: true
        });
    });

    it("should map request with reasoning.effort", () => {
        const request: OpenAI.ChatCompletionRequest = {
            model: "gemini-2.5-pro",
            reasoning: {
                effort: OpenAI.ReasoningEffort.high
            },
            messages: [
                {
                    role: "user",
                    content: "Think about this problem"
                }
            ]
        };

        const result = mapOpenAIChatCompletionRequestToGemini("test-project", request);

        expect(result.request.generationConfig?.thinkingConfig).toEqual({
            thinkingBudget: 24576,
            includeThoughts: true
        });
    });

    it("should map messages with array content", () => {
        const request: OpenAI.ChatCompletionRequest = {
            model: "gemini-2.5-pro",
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: "Hello"
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
                            }
                        }
                    ]
                }
            ]
        };

        const result = mapOpenAIChatCompletionRequestToGemini("test-project", request);

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
        const request: OpenAI.ChatCompletionRequest = {
            model: "gemini-2.5-pro",
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

        const result = mapOpenAIChatCompletionRequestToGemini("test-project", request);

        expect(result.request.contents[0].parts).toEqual([{text: "Hello world\n"}]);
    });

    it("should not add extra newline to text content that already ends with newline", () => {
        const request: OpenAI.ChatCompletionRequest = {
            model: "gemini-2.5-pro", 
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

        const result = mapOpenAIChatCompletionRequestToGemini("test-project", request);

        expect(result.request.contents[0].parts).toEqual([{text: "Hello world\n"}]);
    });

    it("should handle empty text content by adding newline", () => {
        const request: OpenAI.ChatCompletionRequest = {
            model: "gemini-2.5-pro",
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

        const result = mapOpenAIChatCompletionRequestToGemini("test-project", request);

        expect(result.request.contents[0].parts).toEqual([{text: "\n"}]);
    });

    it("should handle multiple text contents with newline logic", () => {
        const request: OpenAI.ChatCompletionRequest = {
            model: "gemini-2.5-pro",
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

        const result = mapOpenAIChatCompletionRequestToGemini("test-project", request);

        expect(result.request.contents[0].parts).toEqual([
            {text: "First text\n"},
            {text: "Second text\n"}, 
            {text: "Third text\n"}
        ]);
    });

    it("should map assistant role to model role", () => {
        const request: OpenAI.ChatCompletionRequest = {
            model: "gemini-2.5-pro",
            messages: [
                {
                    role: "assistant",
                    content: "Hello from assistant"
                }
            ]
        };

        const result = mapOpenAIChatCompletionRequestToGemini("test-project", request);

        expect(result.request.contents[0].role).toBe("model");
        expect(result.request.contents[0].parts).toEqual([{text: "Hello from assistant"}]);
    });

    it("should map assistant message with tool calls", () => {
        const request: OpenAI.ChatCompletionRequest = {
            model: "gemini-2.5-pro",
            messages: [
                {
                    role: "assistant",
                    content: "I'll check the weather for you.",
                    tool_calls: [
                        {
                            index: 0,
                            id: "call_123",
                            type: "function",
                            function: {
                                name: "get_weather",
                                arguments: "{\"location\": \"New York\"}"
                            }
                        }
                    ]
                }
            ]
        };

        const result = mapOpenAIChatCompletionRequestToGemini("test-project", request);

        expect(result.request.contents[0].role).toBe("model");
        expect(result.request.contents[0].parts).toHaveLength(2);
        expect(result.request.contents[0].parts[0]).toEqual({text: "I'll check the weather for you."});
        expect(result.request.contents[0].parts[1]).toEqual({
            functionCall: {
                name: "get_weather",
                args: {location: "New York"}
            }
        });
    });

    it("should map tool role messages", () => {
        const request: OpenAI.ChatCompletionRequest = {
            model: "gemini-2.5-pro",
            messages: [
                {
                    role: "assistant",
                    content: "",
                    tool_calls: [
                        {
                            index: 0,
                            id: "call_123",
                            type: "function",
                            function: {
                                name: "get_weather",
                                arguments: "{\"location\": \"New York\"}"
                            }
                        }
                    ]
                },
                {
                    role: "tool",
                    content: "The weather in New York is sunny, 25°C",
                    tool_call_id: "call_123"
                }
            ]
        };

        const result = mapOpenAIChatCompletionRequestToGemini("test-project", request);

        expect(result.request.contents).toHaveLength(2);
        
        // Tool response message
        expect(result.request.contents[1].role).toBe("user");
        expect(result.request.contents[1].parts[0]).toEqual({
            functionResponse: {
                name: "get_weather",
                response: {
                    result: "The weather in New York is sunny, 25°C"
                }
            }
        });
    });

    it("should handle empty messages array", () => {
        const request: OpenAI.ChatCompletionRequest = {
            model: "gemini-2.5-pro",
            messages: []
        };

        const result = mapOpenAIChatCompletionRequestToGemini("test-project", request);

        expect(result.request.contents).toHaveLength(0);
        expect(result.request.systemInstruction).toBeUndefined();
    });

    it("should handle fallback for unexpected content format", () => {
        const request: OpenAI.ChatCompletionRequest = {
            model: "gemini-2.5-pro",
            messages: [
                {
                    role: "user",
                    content: 123 as unknown as string
                }
            ]
        };

        const result = mapOpenAIChatCompletionRequestToGemini("test-project", request);

        expect(result.request.contents[0].parts).toEqual([{text: "123"}]);
    });
});

describe("OpenAI tool conversion functions", () => {
    it("should convert basic OpenAI function to Gemini format", () => {
        const request: OpenAI.ChatCompletionRequest = {
            model: "gemini-2.5-pro",
            tools: [
                {
                    type: "function",
                    function: {
                        name: "simple_function",
                        description: "A simple function",
                        parameters: {
                            type: "object",
                            properties: {
                                name: {type: "string"}
                            }
                        }
                    }
                }
            ],
            messages: [
                {
                    role: "user",
                    content: "Test"
                }
            ]
        };

        const result = mapOpenAIChatCompletionRequestToGemini("test-project", request);
        
        const functionDeclaration = result.request.tools?.[0]?.functionDeclarations?.[0];
        expect(functionDeclaration).toEqual({
            name: "simple_function",
            description: "A simple function",
            parameters: {
                type: "object",
                properties: {
                    name: {type: "string"}
                }
            }
        });
    });

    it("should handle function without parameters", () => {
        const request: OpenAI.ChatCompletionRequest = {
            model: "gemini-2.5-pro",
            tools: [
                {
                    type: "function",
                    function: {
                        name: "no_params",
                        description: "Function with no parameters",
                        parameters: undefined as unknown as object
                    }
                }
            ],
            messages: [
                {
                    role: "user",
                    content: "Test"
                }
            ]
        };

        const result = mapOpenAIChatCompletionRequestToGemini("test-project", request);
        
        const functionDeclaration = result.request.tools?.[0]?.functionDeclarations?.[0];
        expect(functionDeclaration).toEqual({
            name: "no_params",
            description: "Function with no parameters",
            parameters: undefined
        });
    });
});

describe("OpenAI message mapping functions", () => {
    it("should handle tool message without previous message", () => {
        const request: OpenAI.ChatCompletionRequest = {
            model: "gemini-2.5-pro",
            messages: [
                {
                    role: "tool",
                    content: "Tool response without context",
                    tool_call_id: "call_123"
                }
            ]
        };

        const result = mapOpenAIChatCompletionRequestToGemini("test-project", request);

        expect(result.request.contents[0].role).toBe("user");
        expect(result.request.contents[0].parts[0]).toEqual({
            functionResponse: {
                name: "unknown",
                response: {
                    result: "Tool response without context"
                }
            }
        });
    });

    it("should handle tool message with object content", () => {
        const request: OpenAI.ChatCompletionRequest = {
            model: "gemini-2.5-pro",
            messages: [
                {
                    role: "assistant",
                    content: "",
                    tool_calls: [
                        {
                            index: 0,
                            id: "call_123",
                            type: "function",
                            function: {
                                name: "get_data",
                                arguments: "{}"
                            }
                        }
                    ]
                },
                {
                    role: "tool",
                    content: {data: "complex object"} as unknown as string,
                    tool_call_id: "call_123"
                }
            ]
        };

        const result = mapOpenAIChatCompletionRequestToGemini("test-project", request);

        expect(result.request.contents[1].parts[0]).toEqual({
            functionResponse: {
                name: "get_data",
                response: {
                    result: "{\"data\":\"complex object\"}"
                }
            }
        });
    });

    it("should handle assistant message with only tool calls (no content)", () => {
        const request: OpenAI.ChatCompletionRequest = {
            model: "gemini-2.5-pro",
            messages: [
                {
                    role: "assistant",
                    content: "",
                    tool_calls: [
                        {
                            index: 0,
                            id: "call_123",
                            type: "function",
                            function: {
                                name: "calculate",
                                arguments: "{\"expression\": \"2+2\"}"
                            }
                        }
                    ]
                }
            ]
        };

        const result = mapOpenAIChatCompletionRequestToGemini("test-project", request);

        expect(result.request.contents[0].role).toBe("model");
        expect(result.request.contents[0].parts).toHaveLength(1);
        expect(result.request.contents[0].parts[0]).toEqual({
            functionCall: {
                name: "calculate",
                args: {expression: "2+2"}
            }
        });
    });

    it("should handle invalid image_url format", () => {
        const request: OpenAI.ChatCompletionRequest = {
            model: "gemini-2.5-pro",
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: "Look at this image:"
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: "http://example.com/image.jpg" // Not a data URL
                            }
                        }
                    ]
                }
            ]
        };

        const result = mapOpenAIChatCompletionRequestToGemini("test-project", request);

        // Should only include the text part, invalid image should be skipped
        expect(result.request.contents[0].parts).toHaveLength(1);
        expect(result.request.contents[0].parts[0]).toEqual({text: "Look at this image:\n"});
    });

    it("should handle text content with undefined text", () => {
        const request: OpenAI.ChatCompletionRequest = {
            model: "gemini-2.5-pro",
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: undefined as unknown as string
                        }
                    ]
                }
            ]
        };

        const result = mapOpenAIChatCompletionRequestToGemini("test-project", request);

        expect(result.request.contents[0].parts).toEqual([{text: "\n"}]);
    });

    it("should handle multiple tool calls in assistant message", () => {
        const request: OpenAI.ChatCompletionRequest = {
            model: "gemini-2.5-pro",
            messages: [
                {
                    role: "assistant",
                    content: "I'll call multiple functions for you.",
                    tool_calls: [
                        {
                            index: 0,
                            id: "call_1",
                            type: "function",
                            function: {
                                name: "function_1",
                                arguments: "{\"param1\": \"value1\"}"
                            }
                        },
                        {
                            index: 1,
                            id: "call_2",
                            type: "function",
                            function: {
                                name: "function_2",
                                arguments: "{\"param2\": \"value2\"}"
                            }
                        }
                    ]
                }
            ]
        };

        const result = mapOpenAIChatCompletionRequestToGemini("test-project", request);

        expect(result.request.contents[0].role).toBe("model");
        expect(result.request.contents[0].parts).toHaveLength(3);
        expect(result.request.contents[0].parts[0]).toEqual({text: "I'll call multiple functions for you."});
        expect(result.request.contents[0].parts[1]).toEqual({
            functionCall: {
                name: "function_1",
                args: {param1: "value1"}
            }
        });
        expect(result.request.contents[0].parts[2]).toEqual({
            functionCall: {
                name: "function_2",
                args: {param2: "value2"}
            }
        });
    });

    it("should handle mixed content array with multiple types", () => {
        const request: OpenAI.ChatCompletionRequest = {
            model: "gemini-2.5-pro",
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: "First text"
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
                            }
                        },
                        {
                            type: "text",
                            text: "Second text"
                        }
                    ]
                }
            ]
        };

        const result = mapOpenAIChatCompletionRequestToGemini("test-project", request);

        expect(result.request.contents[0].parts).toHaveLength(3);
        expect(result.request.contents[0].parts[0]).toEqual({text: "First text\n"});
        expect(result.request.contents[0].parts[1]).toEqual({
            inlineData: {
                mimeType: "image/jpeg",
                data: "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
            }
        });
        expect(result.request.contents[0].parts[2]).toEqual({text: "Second text\n"});
    });
});

describe("reasoning/thinking config mapping", () => {
    it("should map low reasoning effort", () => {
        const request: OpenAI.ChatCompletionRequest = {
            model: "gemini-2.5-pro",
            reasoning_effort: OpenAI.ReasoningEffort.low,
            messages: [
                {
                    role: "user",
                    content: "Think about this"
                }
            ]
        };

        const result = mapOpenAIChatCompletionRequestToGemini("test-project", request);

        expect(result.request.generationConfig?.thinkingConfig).toEqual({
            thinkingBudget: 1024,
            includeThoughts: true
        });
    });

    it("should map medium reasoning effort", () => {
        const request: OpenAI.ChatCompletionRequest = {
            model: "gemini-2.5-pro",
            reasoning_effort: OpenAI.ReasoningEffort.medium,
            messages: [
                {
                    role: "user",
                    content: "Think about this"
                }
            ]
        };

        const result = mapOpenAIChatCompletionRequestToGemini("test-project", request);

        expect(result.request.generationConfig?.thinkingConfig).toEqual({
            thinkingBudget: 8192,
            includeThoughts: true
        });
    });

    it("should map high reasoning effort", () => {
        const request: OpenAI.ChatCompletionRequest = {
            model: "gemini-2.5-pro",
            reasoning_effort: OpenAI.ReasoningEffort.high,
            messages: [
                {
                    role: "user",
                    content: "Think about this"
                }
            ]
        };

        const result = mapOpenAIChatCompletionRequestToGemini("test-project", request);

        expect(result.request.generationConfig?.thinkingConfig).toEqual({
            thinkingBudget: 24576,
            includeThoughts: true
        });
    });

    it("should prefer reasoning_effort over reasoning.effort", () => {
        const request: OpenAI.ChatCompletionRequest = {
            model: "gemini-2.5-pro",
            reasoning_effort: OpenAI.ReasoningEffort.high,
            reasoning: {
                effort: OpenAI.ReasoningEffort.low
            },
            messages: [
                {
                    role: "user",
                    content: "Think about this"
                }
            ]
        };

        const result = mapOpenAIChatCompletionRequestToGemini("test-project", request);

        expect(result.request.generationConfig?.thinkingConfig).toEqual({
            thinkingBudget: 24576,
            includeThoughts: true
        });
    });

    it("should handle undefined reasoning effort", () => {
        const request: OpenAI.ChatCompletionRequest = {
            model: "gemini-2.5-pro",
            messages: [
                {
                    role: "user",
                    content: "Think about this"
                }
            ]
        };

        const result = mapOpenAIChatCompletionRequestToGemini("test-project", request);

        expect(result.request.generationConfig?.thinkingConfig).toBeUndefined();
    });

    it("should handle invalid reasoning effort value", () => {
        const request: OpenAI.ChatCompletionRequest = {
            model: "gemini-2.5-pro",
            reasoning_effort: "invalid" as unknown as OpenAI.ReasoningEffort,
            messages: [
                {
                    role: "user",
                    content: "Think about this"
                }
            ]
        };

        const result = mapOpenAIChatCompletionRequestToGemini("test-project", request);

        expect(result.request.generationConfig?.thinkingConfig).toBeUndefined();
    });
});
