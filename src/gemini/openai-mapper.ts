import * as OpenAI from "../types/openai.js";
import * as Gemini from "../types/gemini.js";
import {DEFAULT_TEMPERATURE} from "../utils/constant.js";
import {mapModelToGemini, mapJsonSchemaToGemini} from "./mapper.js";

export const mapOpenAIChatCompletionRequestToGemini = (
    project: string,
    request: OpenAI.ChatCompletionRequest,
): Gemini.ChatCompletionRequest => {
    const model = mapModelToGemini(request.model);
    const reasoningEffort = request.reasoning_effort ?? request.reasoning?.effort;
    const messages = request.messages ?? [];
    const messagesWithoutSystem = messages.filter((message) => !isSystemMessage(message));
    const geminiRequest: Gemini.ChatCompletionRequestBody = {
        contents: mapOpenAIMessagesToGeminiFormat(messagesWithoutSystem),
        generationConfig: {
            temperature: request.temperature ?? DEFAULT_TEMPERATURE,
        }
    };

    if (messages.length > 0) {
        geminiRequest.systemInstruction = mapSystemInstruction(messages);
    }
    if (request.tools) {
        geminiRequest.tools = [{functionDeclarations: request.tools?.map((tool) => convertOpenAIFunctionToGemini(tool.function))}];
    }
    if (request.tool_choice) {
        geminiRequest.toolConfig = mapToolChoiceToToolConfig(request.tool_choice);
    }
    if (reasoningEffort) {
        geminiRequest.generationConfig = {
            ...geminiRequest.generationConfig,
            thinkingConfig: getThinkingConfig(reasoningEffort),
        };
    }

    return {
        model,
        project,
        request: geminiRequest,
    };
};

const mapSystemInstruction = (messages: OpenAI.ChatMessage[]): Gemini.SystemInstruction | undefined => {
    const systemMessage = messages.find(isSystemMessage);
    if (!systemMessage) {
        return;
    }

    let systemInstruction: Gemini.SystemInstruction | undefined;
    if (typeof systemMessage.content === "string") {
        systemInstruction = {
            parts: [{
                text: systemMessage.content
            }]
        };
    } else if (Array.isArray(systemMessage.content)) {
        const text = systemMessage.content
            .filter((message) => message.type === "text")
            .reduce((prev, next) => prev + next.text, "");

        systemInstruction = {
            parts: [{
                text,
            }]
        };
    }

    return systemInstruction;
};

const mapToolChoiceToToolConfig = (toolChoice?: OpenAI.ToolChoice): Gemini.ToolConfig | undefined => {
    if (!toolChoice) {
        return;
    }

    let mode: "AUTO" | "ANY" | "NONE" = "AUTO";
    let allowedFunctionNames: string[] | undefined = undefined;

    if (toolChoice === "none") {
        mode = "NONE";
    } else if (toolChoice === "auto") {
        mode = "AUTO";
    } else if (typeof toolChoice === "object") {
        mode = "ANY";
        allowedFunctionNames = [toolChoice.function.name];
    }
    return {functionCallingConfig: {mode, allowedFunctionNames}};
};

const isSystemMessage = (message: OpenAI.ChatMessage): boolean => message.role === "system" || message.role === "developer";

const mapOpenAIMessageToGeminiFormat = (msg: OpenAI.ChatMessage, prevMsg?: OpenAI.ChatMessage): Gemini.ChatMessage => {
    const role = msg.role === "assistant" ? "model" : "user";

    if (msg.role === "tool") {

        const originalToolCall = prevMsg?.tool_calls?.find(
            (tc: OpenAI.ToolCall) => tc.id === msg.tool_call_id
        );

        return {
            role: "user",
            parts: [{
                functionResponse: {
                    name: originalToolCall?.function.name ?? "unknown",
                    response: {
                        result: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content)
                    }
                }
            }]
        };
    }

    if (msg.role === "assistant" && msg.tool_calls && msg.tool_calls.length > 0) {
        const parts: Gemini.Part[] = [];
        if (typeof msg.content === "string" && msg.content.trim()) {
            parts.push({text: msg.content});
        }

        for (const toolCall of msg.tool_calls) {
            if (toolCall.type === "function") {
                parts.push({
                    functionCall: {
                        name: toolCall.function.name,
                        args: JSON.parse(toolCall.function.arguments)
                    }
                });
            }
        }

        return {role: "model", parts};
    }

    if (typeof msg.content === "string") {
        return {
            role,
            parts: [{text: msg.content}]
        };
    }

    if (Array.isArray(msg.content)) {
        const parts: Gemini.Part[] = [];
        for (const content of msg.content) {
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
            } else if (content.type === "image_url" && content.image_url) {
                const imageUrl = content.image_url.url;
                const match = imageUrl.match(/^data:(image\/.+);base64,(.+)$/);
                if (match) {
                    parts.push({
                        inlineData: {mimeType: match[1], data: match[2]},
                    });
                }
            }
        }

        return {role, parts};
    }

    // Fallback for unexpected content format
    return {
        role,
        parts: [{text: String(msg.content)}]
    };
};

const mapOpenAIMessagesToGeminiFormat = (messages: OpenAI.ChatMessage[]): Gemini.ChatMessage[] => {
    const geminiMessages: Gemini.ChatMessage[] = [];
    let prevMessage: OpenAI.ChatMessage | undefined = undefined;
    for (const message of messages) {
        geminiMessages.push(mapOpenAIMessageToGeminiFormat(message, prevMessage));
        prevMessage = message;
    }
    return geminiMessages;
};

const getThinkingConfig = (reasoningEffort?: string): Gemini.ThinkingConfig | undefined => {
    if (!reasoningEffort) {
        return;
    }

    const key = reasoningEffort as OpenAI.ReasoningEffort;
    if (!(key in thinkingBudgetMap)) {
        return;
    }

    return {
        thinkingBudget: thinkingBudgetMap[key],
        includeThoughts: true,
    };
};

const thinkingBudgetMap: Record<OpenAI.ReasoningEffort, number> = {
    [OpenAI.ReasoningEffort.low]: 1024,
    [OpenAI.ReasoningEffort.medium]: 8192,
    [OpenAI.ReasoningEffort.high]: 24576,
};

const convertOpenAIFunctionToGemini = (fn: OpenAI.FunctionDeclaration): Gemini.FunctionDeclaration => {
    // Only keep the fields that are valid for Gemini FunctionDeclaration
    const {name, description, parameters, ...extraFields} = fn;

    if (!parameters) {
        return {
            name: name || "",
            description: description || "",
            parameters: {}
        };
    }

    // Convert OpenAI JSON Schema to Gemini function parameters format
    const convertedParameters = mapJsonSchemaToGemini(parameters);

    return {
        name: name || "",
        description: description || "",
        parameters: convertedParameters
    };
};

