import fs from 'fs';
import { OllamaEmbedding, Groq, BaseEmbedding } from "llamaindex";
import { CONFIG } from './config';

import { QdrantVectorStore } from "llamaindex";
import { IterativeRAGAgent } from './iterativeragagent';
import { NvidiaReranker } from './rerankers/NvidiaReranker';
import { NvidiaEmbedding } from './embeddings/NvidiaEmbedding';
import { NvidiaNimLLM } from './llms/NvidiaNimLLM';
import OpenAI from 'openai';


// Components initialization
//--------------------------------------------------------

let embedModel: BaseEmbedding | null = null;
let llm_reason: OpenAI | null = null;
let llm_get_data: OpenAI | null = null;




if (CONFIG.llm.nvidiaNimApiKey) {

    // Use this to use Nvidia Embedding :
    // embedModel = new NvidiaEmbedding({ model: CONFIG.embeddings.model, apiKey: CONFIG.llm.nvidiaNimApiKey });

    // For credits economy, use Ollama Embedding locally :
    embedModel = new OllamaEmbedding({ model: CONFIG.embeddings.model });

    llm_reason = new OpenAI({
        apiKey: CONFIG.llm.nvidiaNimApiKey,
        baseURL: 'https://integrate.api.nvidia.com/v1',
        // model: CONFIG.llm.defaultModel,
        // topP: 0,
    })
    llm_get_data = new OpenAI({
        apiKey: CONFIG.llm.nvidiaNimApiKey,
        baseURL: 'https://integrate.api.nvidia.com/v1',
        // model: CONFIG.llm.fastModel,
        // topP: 0
    });

}

// } else if (CONFIG.llm.groqApiKey) {

//     embedModel = new OllamaEmbedding({ model: CONFIG.embeddings.model });
//     llm_reason = new Groq({
//         apiKey: CONFIG.llm.groqApiKey,
//         model: CONFIG.llm.defaultModel,
//         topP: 0
//     });
//     llm_get_data = new Groq({
//         apiKey: CONFIG.llm.groqApiKey,
//         model: CONFIG.llm.fastModel,
//         topP: 0
//     });
// }

if (!embedModel || !llm_reason || !llm_get_data) {
    throw new Error("Model not found");
}


const vectorStore = new QdrantVectorStore({
    url: "http://localhost:6333",
    collectionName: "FILES"
});

let reranker: NvidiaReranker | null = null;
if (CONFIG.nvidia.rerankerApiKey) {

    console.log("Using reranker : ", CONFIG.nvidia.rerankerModel)
    reranker = new NvidiaReranker({
        apiKey: CONFIG.nvidia.rerankerApiKey,
        model: CONFIG.nvidia.rerankerModel || undefined
    });
}
//------------------------------------------------------------------------------------------------------------------------
// Iterative agent :


const iterativeRAGAgent = new IterativeRAGAgent({
    model: CONFIG.llm.defaultModel,
    modelData: CONFIG.llm.fastModel,
    apiKey: CONFIG.llm.nvidiaNimApiKey ?? "",
    // llm: llm_reason,
    // llmData: llm_get_data,
    embedModel: embedModel,
    tools: [],
    reranker: reranker,
    localFilesDir: "./input_wikipedia",
    vectorStore: vectorStore,
    maxOccurences: 5,
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



