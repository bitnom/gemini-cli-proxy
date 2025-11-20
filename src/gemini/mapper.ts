import * as Gemini from "../types/gemini.js";
import type {JsonSchema} from "../types/types.js";

export const mapModelToGemini = (model?: string): Gemini.Model => {
    if (model === undefined) {
        return Gemini.Model.Gemini3ProPreview;
    }

    // Check if the model string is one of the valid enum values
    const validModels = Object.values(Gemini.Model) as string[];
    if (validModels.includes(model)) {
        return model as Gemini.Model;
    }

    return Gemini.Model.Gemini3ProPreview;
};


export const mapJsonSchemaToGemini = (schema: JsonSchema | unknown): JsonSchema => {
    if (!schema || typeof schema !== "object") {
        return schema as JsonSchema;
    }

    const schemaObj = schema as JsonSchema;

    // Handle definitions by inlining them
    if (schemaObj.definitions) {
        const resolved = resolveJsonSchemaDefinitions(schemaObj, schemaObj.definitions);
        return convertJsonSchemaObject(resolved);
    }

    // Convert the schema recursively
    return convertJsonSchemaObject(schemaObj);
};

const resolveJsonSchemaDefinitions = (schema: JsonSchema, definitions: Record<string, JsonSchema>): JsonSchema => {
    if (!schema || typeof schema !== "object") {
        return schema;
    }

    if (Array.isArray(schema)) {
        return schema.map(item => resolveJsonSchemaDefinitions(item as JsonSchema, definitions)) as unknown as JsonSchema;
    }

    const result: JsonSchema = {};

    for (const [key, value] of Object.entries(schema)) {
        if (key === "definitions") {
            // Skip definitions in the output
            continue;
        }

        if (key === "$ref" && typeof value === "string") {
            // Resolve $ref
            const refPath = value.replace("#/definitions/", "");
            if (definitions[refPath]) {
                return resolveJsonSchemaDefinitions(definitions[refPath], definitions);
            }
        } else if (key === "allOf" && Array.isArray(value)) {
            // Resolve allOf by merging objects
            for (const item of value) {
                const resolved = resolveJsonSchemaDefinitions(item, definitions);
                Object.assign(result, resolved);
            }
        } else {
            result[key] = resolveJsonSchemaDefinitions(value as JsonSchema, definitions);
        }
    }

    return result;
};

const convertJsonSchemaObject = (schema: JsonSchema): JsonSchema => {
    if (!schema || typeof schema !== "object") {
        return schema;
    }

    if (Array.isArray(schema)) {
        return schema.map(item => convertJsonSchemaObject(item as JsonSchema)) as unknown as JsonSchema;
    }

    const result: JsonSchema = {};

    for (const [key, value] of Object.entries(schema)) {
        if (key === "definitions" || key === "$schema") {
            // Skip definitions and $schema in the output
            continue;
        }

        if (key === "type" && Array.isArray(value)) {
            // Convert array types like ["string", "null"] to single type with nullable
            const nonNullTypes = value.filter(t => t !== "null");
            if (nonNullTypes.length === 1) {
                result.type = nonNullTypes[0];
                if (value.includes("null")) {
                    result.nullable = true;
                }
            } else {
                // If multiple non-null types, use the first one
                result.type = nonNullTypes[0] || "string";
            }
        } else if (key === "properties" && typeof value === "object" && value !== null) {
            result.properties = {};
            for (const [propKey, propValue] of Object.entries(value)) {
                result.properties[propKey] = convertJsonSchemaObject(propValue as JsonSchema);
            }
        } else if (key === "items" && typeof value === "object" && value !== null) {
            result.items = convertJsonSchemaObject(value as JsonSchema);
        } else if (key === "additionalProperties") {
            // Keep additionalProperties as is
            result.additionalProperties = value as boolean | JsonSchema;
        } else if (key === "allOf") {
            // allOf should have been resolved already, but handle just in case
            if (Array.isArray(value)) {
                for (const item of value) {
                    const converted = convertJsonSchemaObject(item);
                    Object.assign(result, converted);
                }
            }
        } else if (key === "oneOf" && Array.isArray(value)) {
            // Convert oneOf to enum if all items have const values
            const localVal = (value ?? []);
            const constValues = localVal
                .filter(item => item && typeof item === "object" && "const" in item)
                .map(item => (item as JsonSchema).const);

            if (constValues.length === localVal.length && constValues.length > 0) {
                // All items are const values, convert to enum
                result.type = "string";
                result.enum = constValues;
            } else {
                // Mixed or complex oneOf, use the first type or fallback to string
                const firstType = localVal.find(item => item && typeof item === "object" && item.type);
                result.type = firstType?.type || "string";
            }
        } else {
            result[key] = convertJsonSchemaObject(value as JsonSchema);
        }
    }

    return result;
};
