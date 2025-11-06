import * as Anthropic from "../types/anthropic.js";
import * as Gemini from "../types/gemini.js";
import {DEFAULT_TEMPERATURE} from "../utils/constant.js";
import {mapModelToGemini, mapJsonSchemaToGemini} from "./mapper.js";

export const mapAnthropicMessagesRequestToGemini = (
    project: string,
    request: Anthropic.MessagesRequest,
): Gemini.ChatCompletionRequest => {
    const model = mapModelToGemini(request.model);
    
    const geminiRequest: Gemini.ChatCompletionRequestBody = {
        contents: mapAnthropicMessagesToGeminiFormat(request.messages),
        generationConfig: {
            temperature: request.temperature ?? DEFAULT_TEMPERATURE,
        }
    };

    // Handle system message
    if (request.system) {
        const parts = request.system
            .filter((msg) => msg.type === "text")
            .map((msg) => ({text: msg.text}));

        geminiRequest.systemInstruction = {
            parts,
        };
    }

    // Handle tools
    if (request.tools) {
        geminiRequest.tools = [{
            functionDeclarations: request.tools.map(convertAnthropicToolToGemini)
        }];
    }

    // Handle tool choice
    if (request.tool_choice) {
        geminiRequest.toolConfig = mapAnthropicToolChoiceToGemini(request.tool_choice);
    }

    // Note: Gemini doesn't support top_p, top_k, stop_sequences in generationConfig
    // These parameters are ignored for now

    return {
        model,
        project,
        request: geminiRequest,
    };
};

const mapAnthropicMessagesToGeminiFormat = (messages: Anthropic.Message[]): Gemini.ChatMessage[] => {
    const geminiMessages: Gemini.ChatMessage[] = [];
    
    for (const message of messages) {
        geminiMessages.push(mapAnthropicMessageToGeminiFormat(message));
    }
    
    return geminiMessages;
};

const mapAnthropicMessageToGeminiFormat = (message: Anthropic.Message): Gemini.ChatMessage => {
    const role = message.role === "assistant" ? "model" : "user";
    
    if (typeof message.content === "string") {
        return {
            role,
            parts: [{text: message.content}]
        };
    }

    // Handle array content
    const parts: Gemini.Part[] = [];

    for (const content of message.content) {
        if (content.type === "text") {
            // Gemini API merges text parts without delimiter for consecutive user messages
            // which results awkward results
            // E.g: ["Create a file named test.ts", "then add test cases"] results
            // "Create a file named test.tsthen add test cases"
            let text = content.text ?? "";
            if (!text.endsWith("\n")) {
                text += "\n";
            }
            parts.push({text});
        } else if (content.type === "image") {
            const imageContent = content as Anthropic.ImageContent;
            parts.push({
                inlineData: {
                    mimeType: imageContent.source.media_type,
                    data: imageContent.source.data
                }
            });
        }
    }

    return {role, parts};
};

const convertAnthropicToolToGemini = (tool: Anthropic.Tool): Gemini.FunctionDeclaration => {
    // Use comprehensive JSON schema conversion instead of just removing $schema
    const parameters = mapJsonSchemaToGemini(tool.input_schema);
    
    return {
        name: tool.name,
        description: tool.description,
        parameters
    };
};

const mapAnthropicToolChoiceToGemini = (toolChoice: Anthropic.ToolChoice): Gemini.ToolConfig => {
    if (toolChoice === "auto") {
        return {
            functionCallingConfig: {
                mode: "AUTO"
            }
        };
    }
    
    if (toolChoice === "any") {
        return {
            functionCallingConfig: {
                mode: "ANY"
            }
        };
    }
    
    if (typeof toolChoice === "object" && toolChoice.type === "tool") {
        return {
            functionCallingConfig: {
                mode: "ANY",
                allowedFunctionNames: [toolChoice.name]
            }
        };
    }

    return {
        functionCallingConfig: {
            mode: "AUTO"
        }
    };
};

// Helper function to map Gemini response back to Anthropic format
export const mapGeminiResponseToAnthropic = (
    geminiResponse: {content?: string; tool_calls?: Array<{id: string; function: {name: string; arguments: string}}>; usage?: {inputTokens?: number; outputTokens?: number}},
    model: string,
    requestId: string
): Anthropic.MessagesResponse => {
    const content: Anthropic.MessageContent[] = [];
    if (geminiResponse.content) {
        content.push({
            type: "text",
            text: geminiResponse.content
        });
    }
    
    // Handle tool calls if present
    if (geminiResponse.tool_calls) {
        for (const toolCall of geminiResponse.tool_calls) {
            content.push({
                type: "tool_use",
                id: toolCall.id,
                name: toolCall.function.name,
                input: JSON.parse(toolCall.function.arguments)
            });
        }
    }
    
    return {
        id: requestId,
        type: "message",
        role: "assistant",
        content,
        model,
        stop_reason: (geminiResponse.tool_calls?.length ?? 0) > 0 ? "tool_use" : "end_turn",
        usage: {
            input_tokens: geminiResponse.usage?.inputTokens || 0,
            output_tokens: geminiResponse.usage?.outputTokens || 0
        }
    };
};
