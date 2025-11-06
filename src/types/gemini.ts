export enum Model {
    Gemini25Flash = "gemini-2.5-flash",
    Gemini25Pro = "gemini-2.5-pro",
}

export type ChatCompletionRequestBody = {
    contents: ChatMessage[];
    systemInstruction?: SystemInstruction;
    tools?: Array<{
        functionDeclarations?: FunctionDeclaration[];
    }>;
    toolConfig?: ToolConfig;
    generationConfig?: {
        temperature?: number;
        thinkingConfig?: ThinkingConfig;
    };
};

export type ChatCompletionRequest = {
    model: Model;
    project: string;
    request: ChatCompletionRequestBody;
};

export type SystemInstruction = {
    parts: TextPart[];
};
export type ToolConfig = {
    functionCallingConfig: {
        mode: "AUTO" | "ANY" | "NONE";
        allowedFunctionNames?: string[];
    };
};

export type FunctionDeclaration = {
    name: string;
    description: string;
    parameters: object;
};

export type InlineDataPart = {
    inlineData: {
        mimeType: string;
        data: string;
    };
};

export type FunctionCall = {
    name: string;
    args: object;
};

export type FunctionCallPart = {
    functionCall: FunctionCall;
};

export type FunctionResponsePart = {
    functionResponse: {
        name: string;
        response: object;
    };
};

export type TextPart = {
    text: string;
    thought?: boolean;
};

export type Part =
    | TextPart
    | InlineDataPart
    | FunctionCallPart
    | FunctionResponsePart;

export type ThinkingConfig = {
    thinkingBudget: number;
    includeThoughts?: boolean;
};

export type ChatMessage = {
    role: string;
    parts: Part[];
};

// Gemini API response types
export type Candidate = {
    content?: {
        parts?: Array<{text?: string}>;
    };
};

export type UsageMetadata = {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
};

export type Response = {
    response?: {
        candidates?: Candidate[];
        usageMetadata?: UsageMetadata;
    };
};

export type ProjectDiscoveryResponse = {
    cloudaicompanionProject?: string;
    allowedTiers: Array<{
        id: string;
        isDefault?: boolean;
    }> | undefined;
};

export type OnboardUserResponse = {
    done?: boolean;
    response?: {
        cloudaicompanionProject?: {
            id: string;
        };
    }
};
