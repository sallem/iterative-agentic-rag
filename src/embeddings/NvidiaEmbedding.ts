import OpenAI from 'openai';
import { URL } from 'url';
import { BaseEmbedding, MessageContentDetail } from "llamaindex";

const BASE_URL = "https://integrate.api.nvidia.com/v1/";
const DEFAULT_MODEL = "nvidia/nv-embedqa-e5-v5";

const MODEL_ENDPOINT_MAP: Record<string, string> = {
    "NV-Embed-QA": "https://ai.api.nvidia.com/v1/retrieval/nvidia/",
    "snowflake/arctic-embed-l": "https://integrate.api.nvidia.com/v1/",
    "nvidia/nv-embed-v1": "https://integrate.api.nvidia.com/v1/",
    "nvidia/nv-embedqa-mistral-7b-v2": "https://integrate.api.nvidia.com/v1/",
    "nvidia/nv-embedqa-e5-v5": "https://integrate.api.nvidia.com/v1/",
    "baai/bge-m3": "https://integrate.api.nvidia.com/v1/",
    "nvidia/llama-3.2-nv-embedqa-1b-v1": "https://integrate.api.nvidia.com/v1/",
};

const KNOWN_URLS = [...new Set([
    ...Object.values(MODEL_ENDPOINT_MAP),
    "https://ai.api.nvidia.com/v1/retrieval/snowflake/arctic-embed-l"
])];

interface NvidiaEmbeddingConfig {
    model?: string;
    timeout?: number;
    maxRetries?: number;
    nvidiaApiKey?: string;
    apiKey?: string;
    baseUrl?: string;
    embedBatchSize?: number;
    truncate?: 'NONE' | 'START' | 'END';
}

export class NvidiaEmbedding extends BaseEmbedding {
    private client: OpenAI;
    private isHosted: boolean;
    private model: string;
    private truncate: 'NONE' | 'START' | 'END';

    constructor(config: NvidiaEmbeddingConfig = {}) {
        super();
        
        const {
            model,
            timeout = 120,
            maxRetries = 5,
            nvidiaApiKey,
            apiKey,
            baseUrl = BASE_URL,
            embedBatchSize = 512,
            truncate = 'NONE'
        } = config;

        if (embedBatchSize > 259) {
            throw new Error("The batch size should not be larger than 259.");
        }

        const finalApiKey = this.getApiKey(nvidiaApiKey || apiKey);
        const finalBaseUrl = this.validateAndGetBaseUrl(baseUrl);
        
        this.isHosted = KNOWN_URLS.includes(finalBaseUrl);
        this.truncate = truncate;
        
        if (this.isHosted && finalApiKey === "NO_API_KEY_PROVIDED") {
            throw new Error("An API key is required for hosted NIM.");
        }

        this.client = new OpenAI({
            apiKey: finalApiKey,
            baseURL: finalBaseUrl,
            timeout: timeout * 1000,
            maxRetries
        });

        this.model = this.validateAndGetModel(model);
    }

    private getApiKey(apiKey?: string): string {
        return apiKey || process.env.NVIDIA_API_KEY || "NO_API_KEY_PROVIDED";
    }

    private validateAndGetBaseUrl(baseUrl: string): string {
        try {
            const url = new URL(baseUrl);
            if (!url.protocol || !url.host) {
                throw new Error("Invalid base URL format");
            }
            return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        } catch {
            throw new Error("Expected format is 'http://host:port'");
        }
    }

    private validateAndGetModel(model?: string): string {
        if (this.isHosted) {
            if (!model) return DEFAULT_MODEL;
            if (!MODEL_ENDPOINT_MAP[model]) {
                console.warn(`Unable to determine validity of ${model}`);
            }
            return model;
        }
        // For non-hosted scenarios, you'd need to implement model validation
        // against available models from the API
        return model || DEFAULT_MODEL;
    }

    async getQueryEmbedding(query: MessageContentDetail): Promise<number[] | null> {
        const text = typeof query === 'string' 
            ? query 
            : 'text' in query 
                ? query.text 
                : null;
        if (text === null) return null;
        const response = await this.client.embeddings.create({
            input: [text],
            model: this.model,
            extra_body: { input_type: "query", truncate: this.truncate }
        } as OpenAI.Embeddings.EmbeddingCreateParams & { extra_body: { input_type: string, truncate: string } });
        return response.data[0].embedding;
    }

    async getTextEmbedding(text: string): Promise<number[]> {
        const embeddings = await this.getTextEmbeddings([text]);
        return embeddings[0];
    }

    getTextEmbeddings = async (texts: string[]): Promise<number[][]> => {
        if (texts.length > 259) {
            throw new Error("The batch size should not be larger than 259.");
        }

        const response = await this.client.embeddings.create({
            input: texts,
            model: this.model,
            extra_body: { input_type: "passage", truncate: this.truncate }
        } as OpenAI.Embeddings.EmbeddingCreateParams & { extra_body: { input_type: string, truncate: string } });
        return response.data.map(d => d.embedding);
    };
} 