import express from "express";
import {GeminiApiClient} from "../gemini/client.js";
import * as Gemini from "../types/gemini.js";
import * as OpenAI from "../types/openai.js";
import {mapOpenAIChatCompletionRequestToGemini} from "../gemini/openai-mapper.js";
import {getLogger} from "../utils/logger.js";
import chalk from "chalk";


export function createOpenAIRouter(geminiClient: GeminiApiClient): express.Router {
    const router = express.Router();
    const logger = getLogger("SERVER-OPENAI", chalk.green);

    router.get("/v1/models", (_req, res) => {
        const modelData = Object.values(Gemini.Model).map((modelId) => ({
            id: modelId,
            object: "model",
            created: Math.floor(Date.now() / 1000),
            owned_by: "Google",
        }));

        res.json({
            object: "list",
            data: modelData,
        });
    });

    router.post("/v1/chat/completions", async (req, res) => {
        try {
            const body = req.body as OpenAI.ChatCompletionRequest;
            if (!body.messages.length) {
                return res.status(400).json({error: "messages is a required field"});
            }
            const projectId = await geminiClient.discoverProjectId();
            const geminiCompletionRequest = mapOpenAIChatCompletionRequestToGemini(projectId, body);

            if (body.stream) {
                res.setHeader("Content-Type", "text/event-stream");
                res.setHeader("Cache-Control", "no-cache");
                res.setHeader("Connection", "keep-alive");
                res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
                res.setHeader("Access-Control-Allow-Origin", "*");

                const {readable, writable} = new TransformStream();
                const writer = writable.getWriter();
                const reader = readable.getReader();

                (async () => {
                    try {
                        const geminiStream = geminiClient.streamContent(geminiCompletionRequest);
                        for await (const chunk of geminiStream) {
                            await writer.write(chunk);
                        }
                        await writer.close();
                    } catch (error) {
                        logger.error("stream error", error);
                        const errorMessage = error instanceof Error ? error.message : "Unknown stream error";
                        await writer.abort(errorMessage);
                    }
                })();

                while (true) {
                    const {done, value} = await reader.read();
                    if (done) {
                        res.write("data: [DONE]\n\n");
                        res.end();
                        break;
                    }
                    res.write(`data: ${JSON.stringify(value)}\n\n`);
                }
            } else {
                // Non-streaming response
                try {
                    const completion = await geminiClient.getCompletion(geminiCompletionRequest);

                    const response: OpenAI.ChatCompletionResponse = {
                        id: `chatcmpl-${crypto.randomUUID()}`,
                        object: "chat.completion",
                        created: Math.floor(Date.now() / 1000),
                        model: body.model,
                        choices: [
                            {
                                index: 0,
                                message: {
                                    role: "assistant",
                                    content: completion.content,
                                    tool_calls: completion.tool_calls
                                },
                                finish_reason: completion.tool_calls && completion.tool_calls.length > 0 ? "tool_calls" : "stop"
                            }
                        ]
                    };

                    // Add usage information if available
                    if (completion.usage) {
                        response.usage = {
                            prompt_tokens: completion.usage.inputTokens,
                            completion_tokens: completion.usage.outputTokens,
                            total_tokens: completion.usage.inputTokens + completion.usage.outputTokens
                        };
                    }

                    res.json(response);
                } catch (completionError: unknown) {
                    const errorMessage = completionError instanceof Error ? completionError.message : String(completionError);
                    logger.error("completion error", completionError);
                    res.status(500).json({error: errorMessage});
                }
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
            logger.error("completion error", error);

            if (!res.headersSent) {
                res.status(500).json({error: errorMessage});
            } else {
                res.end();
            }
        }
    });

    return router;
}
