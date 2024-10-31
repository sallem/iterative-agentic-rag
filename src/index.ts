import fs from 'fs';
import { OllamaEmbedding, Groq } from "llamaindex";
import { CONFIG } from './config';

import { QdrantVectorStore } from "llamaindex";
import { IterativeRAGAgent } from './iterativeragagent';
import { NvidiaReranker } from './rerankers/NvidiaReranker';


// Components initialization
//--------------------------------------------------------

let embedModel: OllamaEmbedding | null = null;
let llm_reason: Groq | null = null;
let llm_get_data: Groq | null = null;

if (CONFIG.llm.groqApiKey) {

    embedModel = new OllamaEmbedding({ model: CONFIG.embeddings.model });
    llm_reason = new Groq({
        apiKey: CONFIG.llm.groqApiKey,
        model: CONFIG.llm.defaultModel,
        topP: 0
    });
    llm_get_data = new Groq({
        apiKey: CONFIG.llm.groqApiKey,
        model: CONFIG.llm.fastModel,
        topP: 0
    });
}

if (CONFIG.llm.nvidiaNimApiKey) {

    embedModel = new OllamaEmbedding({ model: CONFIG.embeddings.model });
    llm_reason = new Groq({
        apiKey: CONFIG.llm.nvidiaNimApiKey,
        model: CONFIG.llm.defaultModel,
        topP: 0
    });
    llm_get_data = new Groq({
        apiKey: CONFIG.llm.nvidiaNimApiKey,
        model: CONFIG.llm.fastModel,
        topP: 0
    });
}

if (!embedModel || !llm_reason || !llm_get_data) {
    throw new Error("Model not found");
}


const vectorStore = new QdrantVectorStore({
    url: "http://localhost:6333",
    collectionName: "FILES"
});

let reranker: NvidiaReranker | null = null;
if (CONFIG.nvidia.rerankerApiKey) {

    reranker = new NvidiaReranker({
        apiKey: CONFIG.nvidia.rerankerApiKey,
        model: CONFIG.nvidia.rerankerModel || undefined
    });
}
//------------------------------------------------------------------------------------------------------------------------
// Iterative agent :


const iterativeRAGAgent = new IterativeRAGAgent({
    llm: llm_reason,
    llmData: llm_get_data,
    embedModel: embedModel,
    tools: [],
    reranker: reranker,
    localFilesDir: "./input_wikipedia",
    vectorStore: vectorStore,
    maxOccurences: 2,
});

//------------------------------------------------------------------------------------------------------------------------


(async () => {

    for (let evaluation of JSON.parse(fs.readFileSync('evaluation.json', 'utf8'))) {
        try {
            const answer = await iterativeRAGAgent.chat({ message: evaluation.Prompt });
            console.log("Final Answer:", answer);
        } catch (error) {
            console.error("Error processing query:", error);
        }
        break;
    }
})();



