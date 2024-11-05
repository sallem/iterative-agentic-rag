import dotenv from 'dotenv';
import path from 'path';

// Load .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

interface Config {
    llm: {
        groqApiKey?: string | null;
        nvidiaNimApiKey?: string | null;
        defaultModel: string;
        fastModel: string;
    };
    embeddings: {
        model: string;
    };
    vectorStore: {
        qdrantUrl: string;
    };
    nvidia: {
        rerankerApiKey: string;
        rerankerModel?: string | null;
    };
}

export const CONFIG: Config = {
    llm: {
        groqApiKey: process.env.GROQ_API_KEY || null,
        nvidiaNimApiKey: process.env.NVIDIA_NIM_API_KEY || null,
        defaultModel: process.env.DEFAULT_LLM_MODEL || 'llama-3.2-90b-text-preview',
        fastModel: process.env.FAST_LLM_MODEL || 'llama-3.1-8b-instant'
    },
    embeddings: {
        model: process.env.DEFAULT_EMBED_MODEL || 'nomic-embed-text'
    },
    vectorStore: {
        qdrantUrl: process.env.QDRANT_URL || 'http://localhost:6333'
    },
    nvidia: {
        rerankerApiKey: process.env.NVIDIA_RERANKER_API_KEY || "",
        rerankerModel: process.env.NVIDIA_RERANKER_MODEL || null
    }
};
