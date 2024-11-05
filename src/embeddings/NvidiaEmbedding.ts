import { BaseEmbedding, MessageContentDetail } from "llamaindex";
import fetch from "cross-fetch";

const BASE_URL = "https://integrate.api.nvidia.com/v1";

interface NvidiaEmbeddingConfig {
    model: string;
    timeout?: number;
    maxRetries?: number;
    apiKey: string;
    baseUrl?: string;
    embedBatchSize?: number;
    truncate?: 'NONE' | 'START' | 'END';
}

interface NvidiaEmbeddingResponse {
    data: Array<{
        embedding: number[];
        index: number;
    }>;
}

export class NvidiaEmbedding extends BaseEmbedding {
    private model: string;
    private truncate: 'NONE' | 'START' | 'END';
    private apiKey: string;
    private baseUrl: string;

    constructor(config: NvidiaEmbeddingConfig) {
        super();
        
        const {
            model,
            apiKey,
            baseUrl = BASE_URL,
            truncate = 'NONE'
        } = config;

        this.apiKey = apiKey;
        this.truncate = truncate;
        this.baseUrl = baseUrl;
        this.model = model;
    }

    private async makeEmbeddingRequest(input: string[], inputType: 'query' | 'passage'): Promise<number[][]> {
        const response = await fetch(`${this.baseUrl}/embeddings`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                input,
                model: this.model,
                input_type: inputType,
                encoding_format: "float",
                truncate: this.truncate
            })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`NVIDIA Embedding API error: ${response.status} - ${error}`);
        }

        const result = await response.json() as NvidiaEmbeddingResponse;
        return result.data.sort((a, b) => a.index - b.index).map(d => d.embedding);
    }

    async getQueryEmbedding(query: MessageContentDetail): Promise<number[] | null> {
        const text = typeof query === 'string' 
            ? query 
            : 'text' in query 
                ? query.text 
                : null;
        if (text === null) return null;

        const embeddings = await this.makeEmbeddingRequest([text], 'query');
        return embeddings[0];
    }

    async getTextEmbedding(text: string): Promise<number[]> {
        const embeddings = await this.getTextEmbeddings([text]);
        return embeddings[0];
    }

    getTextEmbeddings = async (texts: string[]): Promise<number[][]> => {
        return await this.makeEmbeddingRequest(texts, 'passage');
    };
} 