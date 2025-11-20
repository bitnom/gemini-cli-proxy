import {describe, it, expect} from "vitest";
import {mapModelToGemini, mapJsonSchemaToGemini} from "./mapper.js";
import type {JsonSchema} from "../types/types.js";
import * as Gemini from "../types/gemini.js";

describe("mapModelToGemini", () => {
    it("should return Gemini3ProPreview for undefined model", () => {
        const result = mapModelToGemini(undefined);
        expect(result).toBe(Gemini.Model.Gemini3ProPreview);
    });

    it("should return valid Gemini model for existing model key", () => {
        const result = mapModelToGemini(Gemini.Model.Gemini25Flash);
        expect(result).toBe(Gemini.Model.Gemini25Flash);
    });

    it("should return Gemini3ProPreview for unknown model", () => {
        const result = mapModelToGemini("unknown-model" as Gemini.Model);
        expect(result).toBe(Gemini.Model.Gemini3ProPreview);
    });

    it("should handle all valid Gemini models", () => {
        Object.values(Gemini.Model).forEach(model => {
            const result = mapModelToGemini(model);
            expect(result).toBe(model);
        });
    });
});

describe("mapJsonSchemaToGemini", () => {
    describe("non-object inputs", () => {
        it("should handle null input", () => {
            const result = mapJsonSchemaToGemini(null);
            expect(result).toBe(null);
        });

        it("should handle undefined input", () => {
            const result = mapJsonSchemaToGemini(undefined);
            expect(result).toBe(undefined);
        });

        it("should handle string input", () => {
            const result = mapJsonSchemaToGemini("string");
            expect(result).toBe("string");
        });

        it("should handle number input", () => {
            const result = mapJsonSchemaToGemini(42);
            expect(result).toBe(42);
        });

        it("should handle boolean input", () => {
            const result = mapJsonSchemaToGemini(true);
            expect(result).toBe(true);
        });
    });

    describe("basic schema conversion", () => {
        it("should convert basic JSON schema", () => {
            const schema: JsonSchema = {
                type: "object",
                properties: {
                    name: {type: "string"}
                }
            };

            const result = mapJsonSchemaToGemini(schema);

            expect(result).toEqual({
                type: "object",
                properties: {
                    name: {type: "string"}
                }
            });
        });

        it("should remove $schema property", () => {
            const schema: JsonSchema = {
                type: "object",
                properties: {
                    name: {type: "string"}
                },
                $schema: "http://json-schema.org/draft-07/schema#"
            };

            const result = mapJsonSchemaToGemini(schema);

            expect(result).toEqual({
                type: "object",
                properties: {
                    name: {type: "string"}
                }
            });
            expect(result).not.toHaveProperty("$schema");
        });
    });

    describe("$ref definition resolution", () => {
        it("should resolve $ref definitions", () => {
            const schema: JsonSchema = {
                type: "object",
                properties: {
                    user: {
                        $ref: "#/definitions/User"
                    }
                },
                definitions: {
                    User: {
                        type: "object",
                        properties: {
                            name: {type: "string"},
                            age: {type: "number"}
                        }
                    }
                }
            };

            const result = mapJsonSchemaToGemini(schema);

            expect(result).toEqual({
                type: "object",
                properties: {
                    user: {
                        type: "object",
                        properties: {
                            name: {type: "string"},
                            age: {type: "number"}
                        }
                    }
                }
            });
        });

        it("should handle $ref to non-existent definition", () => {
            const schema: JsonSchema = {
                type: "object",
                properties: {
                    user: {
                        $ref: "#/definitions/NonExistent"
                    }
                },
                definitions: {
                    User: {
                        type: "object",
                        properties: {
                            name: {type: "string"}
                        }
                    }
                }
            };

            const result = mapJsonSchemaToGemini(schema);

            // Non-existent $ref gets resolved to empty object
            expect(result).toEqual({
                type: "object",
                properties: {
                    user: {}
                }
            });
        });

        it("should handle nested $ref resolution", () => {
            const schema: JsonSchema = {
                type: "object",
                properties: {
                    team: {
                        $ref: "#/definitions/Team"
                    }
                },
                definitions: {
                    Team: {
                        type: "object",
                        properties: {
                            members: {
                                type: "array",
                                items: {
                                    $ref: "#/definitions/User"
                                }
                            }
                        }
                    },
                    User: {
                        type: "object",
                        properties: {
                            name: {type: "string"}
                        }
                    }
                }
            };

            const result = mapJsonSchemaToGemini(schema);

            expect(result).toEqual({
                type: "object",
                properties: {
                    team: {
                        type: "object",
                        properties: {
                            members: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        name: {type: "string"}
                                    }
                                }
                            }
                        }
                    }
                }
            });
        });

        it("should handle array input during resolution", () => {
            const schema: JsonSchema = {
                definitions: {
                    User: {
                        type: "object",
                        properties: {
                            name: {type: "string"}
                        }
                    }
                },
                allOf: [
                    {$ref: "#/definitions/User"},
                    {type: "object", properties: {age: {type: "number"}}}
                ]
            };

            const result = mapJsonSchemaToGemini(schema);

            // Object.assign behavior causes later properties to overwrite earlier ones
            expect(result).toEqual({
                type: "object",
                properties: {
                    age: {type: "number"}
                }
            });
        });
    });

    describe("array type conversion", () => {
        it("should convert array types to nullable single types", () => {
            const schema: JsonSchema = {
                type: "object",
                properties: {
                    nullableString: {
                        type: ["string", "null"]
                    },
                    multipleTypes: {
                        type: ["string", "number"]
                    },
                    nullOnlyType: {
                        type: ["null"]
                    },
                    emptyTypeArray: {
                        type: []
                    }
                }
            };

            const result = mapJsonSchemaToGemini(schema);

            expect(result).toEqual({
                type: "object",
                properties: {
                    nullableString: {
                        type: "string",
                        nullable: true
                    },
                    multipleTypes: {
                        type: "string"
                    },
                    nullOnlyType: {
                        type: "string"
                    },
                    emptyTypeArray: {
                        type: "string"
                    }
                }
            });
        });
    });

    describe("oneOf conversion", () => {
        it("should convert oneOf to enum when all items have const values", () => {
            const schema: JsonSchema = {
                type: "object",
                properties: {
                    status: {
                        oneOf: [
                            {const: "active"},
                            {const: "inactive"},
                            {const: "pending"}
                        ]
                    }
                }
            };

            const result = mapJsonSchemaToGemini(schema);

            expect(result).toEqual({
                type: "object",
                properties: {
                    status: {
                        type: "string",
                        enum: ["active", "inactive", "pending"]
                    }
                }
            });
        });

        it("should handle oneOf with mixed const and type items", () => {
            const schema: JsonSchema = {
                type: "object",
                properties: {
                    value: {
                        oneOf: [
                            {const: "fixed"},
                            {type: "number"}
                        ]
                    }
                }
            };

            const result = mapJsonSchemaToGemini(schema);

            expect(result).toEqual({
                type: "object",
                properties: {
                    value: {
                        type: "number"
                    }
                }
            });
        });

        it("should handle oneOf with no type items", () => {
            const schema: JsonSchema = {
                type: "object",
                properties: {
                    value: {
                        oneOf: [
                            {description: "just a description"},
                            {title: "just a title"}
                        ]
                    }
                }
            };

            const result = mapJsonSchemaToGemini(schema);

            expect(result).toEqual({
                type: "object",
                properties: {
                    value: {
                        type: "string"
                    }
                }
            });
        });

        it("should handle empty oneOf array", () => {
            const schema: JsonSchema = {
                type: "object",
                properties: {
                    value: {
                        oneOf: []
                    }
                }
            };

            const result = mapJsonSchemaToGemini(schema);

            expect(result).toEqual({
                type: "object",
                properties: {
                    value: {
                        type: "string"
                    }
                }
            });
        });
    });

    describe("allOf handling", () => {
        it("should handle allOf by merging objects", () => {
            const schema: JsonSchema = {
                type: "object",
                properties: {
                    combined: {
                        allOf: [
                            {
                                type: "object",
                                properties: {
                                    name: {type: "string"}
                                }
                            },
                            {
                                type: "object",
                                properties: {
                                    age: {type: "number"}
                                }
                            }
                        ]
                    }
                }
            };

            const result = mapJsonSchemaToGemini(schema);

            const combinedProps = result?.properties?.combined?.properties;
            expect(combinedProps).toHaveProperty("age", {type: "number"});
        });

        it("should handle allOf in definitions", () => {
            const schema: JsonSchema = {
                definitions: {
                    BaseUser: {
                        type: "object",
                        properties: {
                            name: {type: "string"}
                        }
                    },
                    ExtendedUser: {
                        allOf: [
                            {$ref: "#/definitions/BaseUser"},
                            {
                                type: "object",
                                properties: {
                                    age: {type: "number"}
                                }
                            }
                        ]
                    }
                },
                type: "object",
                properties: {
                    user: {$ref: "#/definitions/ExtendedUser"}
                }
            };

            const result = mapJsonSchemaToGemini(schema);

            // Due to Object.assign behavior, only the last properties remain
            expect(result?.properties?.user?.properties).toHaveProperty("age", {type: "number"});
        });
    });

    describe("nested properties and items", () => {
        it("should handle nested properties recursively", () => {
            const schema: JsonSchema = {
                type: "object",
                properties: {
                    nested: {
                        type: "object",
                        properties: {
                            deepProp: {
                                type: ["string", "null"]
                            }
                        }
                    }
                }
            };

            const result = mapJsonSchemaToGemini(schema);

            expect(result).toEqual({
                type: "object",
                properties: {
                    nested: {
                        type: "object",
                        properties: {
                            deepProp: {
                                type: "string",
                                nullable: true
                            }
                        }
                    }
                }
            });
        });

        it("should handle array items schema", () => {
            const schema: JsonSchema = {
                type: "object",
                properties: {
                    items: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                id: {type: "number"}
                            }
                        }
                    }
                }
            };

            const result = mapJsonSchemaToGemini(schema);

            expect(result).toEqual({
                type: "object",
                properties: {
                    items: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                id: {type: "number"}
                            }
                        }
                    }
                }
            });
        });

        it("should handle null properties object", () => {
            const schema: JsonSchema = {
                type: "object",
                properties: null as unknown as Record<string, JsonSchema>
            };

            const result = mapJsonSchemaToGemini(schema);

            // Null properties are preserved in the result
            expect(result).toEqual({
                type: "object",
                properties: null
            });
        });

        it("should handle null items object", () => {
            const schema: JsonSchema = {
                type: "array",
                items: null as unknown as JsonSchema
            };

            const result = mapJsonSchemaToGemini(schema);

            // Null items are preserved in the result
            expect(result).toEqual({
                type: "array",
                items: null
            });
        });
    });

    describe("additionalProperties handling", () => {
        it("should preserve boolean additionalProperties", () => {
            const schema: JsonSchema = {
                type: "object",
                properties: {
                    name: {type: "string"}
                },
                additionalProperties: false
            };

            const result = mapJsonSchemaToGemini(schema);

            expect(result).toEqual({
                type: "object",
                properties: {
                    name: {type: "string"}
                },
                additionalProperties: false
            });
        });

        it("should preserve object additionalProperties", () => {
            const schema: JsonSchema = {
                type: "object",
                properties: {
                    name: {type: "string"}
                },
                additionalProperties: {
                    type: "string"
                }
            };

            const result = mapJsonSchemaToGemini(schema);

            expect(result).toEqual({
                type: "object",
                properties: {
                    name: {type: "string"}
                },
                additionalProperties: {
                    type: "string"
                }
            });
        });
    });

    describe("edge cases and complex scenarios", () => {
        it("should handle array input in convertJsonSchemaObject", () => {
            const schema: JsonSchema = [
                {type: "string"},
                {type: "number"}
            ] as unknown as JsonSchema;

            const result = mapJsonSchemaToGemini(schema);

            expect(Array.isArray(result)).toBe(true);
            expect(result).toEqual([
                {type: "string"},
                {type: "number"}
            ]);
        });

        it("should handle array input in resolveJsonSchemaDefinitions", () => {
            const schema: JsonSchema = {
                definitions: {
                    StringList: [
                        {type: "string"},
                        {type: "string"}
                    ] as unknown as JsonSchema
                },
                type: "object",
                properties: {
                    list: {$ref: "#/definitions/StringList"}
                }
            };

            const result = mapJsonSchemaToGemini(schema);

            expect(result?.properties?.list).toEqual([
                {type: "string"},
                {type: "string"}
            ]);
        });

        it("should handle non-object, non-array input in both helper functions", () => {
            const schema: JsonSchema = {
                definitions: {
                    SimpleString: "just a string" as unknown as JsonSchema
                },
                type: "object",
                properties: {
                    simple: {$ref: "#/definitions/SimpleString"}
                }
            };

            const result = mapJsonSchemaToGemini(schema);

            expect(result?.properties?.simple).toBe("just a string");
        });

        it("should handle regular properties in convertJsonSchemaObject", () => {
            const schema: JsonSchema = {
                type: "object",
                title: "Test Schema",
                description: "A test schema",
                required: ["name"],
                properties: {
                    name: {type: "string"}
                }
            };

            const result = mapJsonSchemaToGemini(schema);

            expect(result).toEqual({
                type: "object",
                title: "Test Schema",
                description: "A test schema",
                required: ["name"],
                properties: {
                    name: {type: "string"}
                }
            });
        });

        it("should handle regular properties in resolveJsonSchemaDefinitions", () => {
            const schema: JsonSchema = {
                definitions: {
                    User: {
                        type: "object",
                        title: "User Schema",
                        properties: {
                            name: {type: "string"}
                        }
                    }
                },
                type: "object",
                properties: {
                    user: {$ref: "#/definitions/User"}
                }
            };

            const result = mapJsonSchemaToGemini(schema);

            expect(result?.properties?.user).toEqual({
                type: "object",
                title: "User Schema",
                properties: {
                    name: {type: "string"}
                }
            });
        });
    });
});