
import {
    type AgentParamsBase,
    AgentRunner,
    AgentWorker,
    callTool,
    consumeAsyncIterable,
    createReadableStream,
    type TaskHandler,
    validateAgentParams,
} from "@llamaindex/core/agent";
import type { JSONObject, JSONValue } from "@llamaindex/core/global";
import type {
    BaseTool,
    ChatMessage,
    ChatResponse,
    ChatResponseChunk,
    LLM,
} from "@llamaindex/core/llms";
import {
    BaseEmbedding,
} from "@llamaindex/core/embeddings";
import OpenAI from 'openai';

import fs from 'fs';
import { jsonrepair } from 'jsonrepair'
import { VectorStore, VectorStoreQueryMode, BaseNodePostprocessor, TextNode, VectorStoreQueryResult } from "llamaindex";
import { QdrantVectorStore } from "llamaindex";
import { OllamaEmbedding, Settings, Groq } from "llamaindex";
import { PROMPTS } from './prompts';
import { CONFIG } from './config';
import { splitTextSafely } from './tools/utils';
import type { MessageContent } from "@llamaindex/core/llms";
import type { NodeWithScore } from "@llamaindex/core/schema";
import { embedFiles } from "./scripts/embedFiles";


// Settings.embedModel = new OllamaEmbedding({ model: CONFIG.embeddings.model });
// Settings.llm = new Groq({
//     apiKey: CONFIG.llm.groqApiKey,
//     model: CONFIG.llm.defaultModel,
//     topP: 0
// });
// const llm_get_data = new Groq({
//     apiKey: CONFIG.llm.groqApiKey,
//     model: CONFIG.llm.fastModel,
//     topP: 0
// });

// If stores.json does not exist, create it:
if (!fs.existsSync('stores.json')) {
    fs.writeFileSync('stores.json', JSON.stringify([]));
}





//------------------------------------------------------------------------------------------------------------------------
// Document management

async function modelCompletion(prompt: string, model: string | null, openAiModel: OpenAI) {
    const res = await openAiModel.chat.completions.create({
        model: model ?? "meta/llama-3.1-405b-instruct",
        messages: [{ "role": "user", "content": prompt }],
        temperature: 0.2,
        top_p: 0.7,
        max_tokens: 1024,
        stream: false,
    });

    if (res?.choices?.length > 0) {
        return { text: res.choices[0].message.content ?? "" };
    } else {
        console.error("No response from model", res)
        return { text: "" };
    }
}


async function findDataInEmbeddings(dataNeeded: string, modelData: string, embedModel = Settings.embedModel, vectorStore: VectorStore, openAI: OpenAI, reranker: BaseNodePostprocessor | null = null) {

    const allDataFound: string[] = [];
    for (let data of dataNeeded) {
        const dataFound = await _findDataInEmbeddings(data, modelData, embedModel, vectorStore, openAI, reranker, allDataFound);
        allDataFound.push(...dataFound);
    }

    return allDataFound;
}

async function _findDataInEmbeddings(dataNeeded: string, modelData: string, embedModel = Settings.embedModel, vectorStore: VectorStore, openAI: OpenAI, reranker: BaseNodePostprocessor | null = null, previousDataFound: string[] = []) {

    // Find chunks containing the data needed :
    const queryResult: VectorStoreQueryResult = await vectorStore.query({
        queryStr: dataNeeded[0],
        mode: VectorStoreQueryMode.DEFAULT,
        similarityTopK: 20,
        queryEmbedding: await embedModel.getTextEmbedding(dataNeeded)
    });

    // For each chunk, re-read the text to extract informations :
    let dataFound: string[] = []
    for (const node of queryResult.nodes ?? []) {

        const prompt = `
If the following text :

<text>
${node.toJSON().text}
</text>

I am looking for informations about "${dataNeeded}".

Extract facts related to this information.
Each result must be a sentence or assertion of that fact.
Add context informations and details, like entity which it stands for, geographical informations, temporal informations, dates, etc.

Do not make up informations, only use the informations provided in the text.
To check the relevance of the fact, ask yourself if this fact could help answering the following question : "${dataNeeded}".

Answer with a JSON array of strings, for example:
["string1", "string2", "string3"]

Return empty array "[]" if no information is found or if the fact is not relevant to the question.
`

        // console.log("Prompt llm get facts : ", prompt);
        const facts = await modelCompletion(prompt, modelData, openAI)

        console.log("Facts for ", dataNeeded, ":", facts.text);
        console.log("--------------------------------");
        // Clean stirng to get only JSON array : remove all before [ and after ]
        let jsonString = facts.text.substring(facts.text.indexOf("[")).replace(/\n/g, "").trim();
        // Clean stirng to get only JSON array : remove all after ]
        jsonString = jsonString.substring(0, jsonString.indexOf("]") + 1);

        try {

            jsonString = jsonrepair(jsonString);
            const found = JSON.parse(jsonString);
            if (found.length > 0) {
                dataFound.push(...found);
            }
        } catch (err) {
            // console.error(`Error parsing JSON string -${jsonString}-:`, err);
        }

        console.log("Data found chunk : ", jsonString);

        if (dataFound.length > 10) {
            break;
        } else {
            await new Promise(resolve => setTimeout(resolve, 250));
        }
    }

    console.log("Whole data found : ", dataFound);

    // If a reranker is provided, rerank the data found and get only the relevant ones :
    if (reranker) {

        console.log("Reranking data found : ", dataNeeded, dataFound)
        const nodes: NodeWithScore[] = dataFound.map((item: string) => {
            return {
                node: new TextNode({ text: item }),
                score: 1
            }
        });

        // We have only one dataNeeded now, TODO: remove array of dataNeeded
        const rerankedData = await reranker.postprocessNodes(nodes, dataNeeded);
        console.log("Reranked data found : ", rerankedData)

        // Get only when scrore > 0 :
        dataFound = rerankedData.filter((item: NodeWithScore) => item.score && item.score > 0).map((item: NodeWithScore) => item.node.toJSON().text)
    }

    return dataFound;
}


type IterativeRAGAgentStore = {
    data: string[];
    remainingOccurences: number;
    embedModel: BaseEmbedding;
    vectorStore: VectorStore;
    reranker?: BaseNodePostprocessor | null;
    localFilesDir: string;
    rephrasedQuery: string | null;
    openAI: OpenAI;
    model: string | null;
    modelData: string;
};

export class IterativeRAGAgentWorker extends AgentWorker<LLM, IterativeRAGAgentStore> {
    taskHandler = IterativeRAGAgent.taskHandler;

    embedModel: BaseEmbedding;

    constructor(embedModel: BaseEmbedding) {
        super();
        this.embedModel = embedModel;
    }
}

type IterativeRAGAgentParams = AgentParamsBase<LLM> & {
    localFilesDir: string;
    apiKey?: string;
    model?: string;
    modelData: string;
    llm?: LLM;
    llmData?: LLM;
    embedModel: BaseEmbedding;
    vectorStore: VectorStore;
    reranker?: BaseNodePostprocessor | null;
    maxOccurences?: number;
}

export class IterativeRAGAgent extends AgentRunner<LLM, IterativeRAGAgentStore> {

    llmData: LLM;
    embedModel: BaseEmbedding;
    reranker?: BaseNodePostprocessor | null;
    localFilesDir: string;
    vectorStore: VectorStore;
    maxOccurences: number;

    model: string | null;
    modelData: string;
    openAI: OpenAI;

    constructor(params: IterativeRAGAgentParams) {
        validateAgentParams(params);
        super({
            llm: params.llm ?? Settings.llm,
            chatHistory: [],
            runner: new IterativeRAGAgentWorker(params.embedModel),
            systemPrompt: params.systemPrompt ?? null,
            tools:
                "tools" in params
                    ? params.tools
                    : params.toolRetriever.retrieve.bind(params.toolRetriever),
            verbose: params.verbose ?? true,
        });
        this.llmData = params.llmData ?? Settings.llm;
        this.embedModel = params.embedModel ?? Settings.embedModel;
        this.reranker = params.reranker ?? null;
        this.localFilesDir = params.localFilesDir;
        this.vectorStore = params.vectorStore;
        this.maxOccurences = params.maxOccurences ?? 5;

        this.openAI = new OpenAI({
            apiKey: params.apiKey,
            baseURL: "https://integrate.api.nvidia.com/v1",
        });
        this.model = params.model ?? null;
        this.modelData = params.modelData;

        Settings.embedModel = this.embedModel
    }

    createStore() {
        return {
            data: [],
            remainingOccurences: this.maxOccurences,
            embedModel: this.embedModel,
            vectorStore: this.vectorStore,
            localFilesDir: this.localFilesDir,
            rephrasedQuery: null,
            openAI: this.openAI,
            model: this.model,
            modelData: this.modelData,
            reranker: this.reranker,
        };
    }

    public getEmbedModel(): BaseEmbedding {
        return this.embedModel;
    }


    static taskHandler: TaskHandler<LLM, IterativeRAGAgentStore> = async (
        step,
        enqueueOutput,
    ) => {

        // Do the magic :
        const { localFilesDir, embedModel, vectorStore, openAI, model, modelData, reranker } = step.context.store;
        const lastMessage = step.context.store.messages.at(-1)!.content;
        const initialQuestion = lastMessage.toString();
        const question = step.context.store.rephrasedQuery ?? initialQuestion;

        // Each step simplifies the query :
        console.log("")
        console.log("================================================")
        console.log("============= Step", step.context.store.remainingOccurences, "===============")
        console.log("Data collected : ", step.context.store.data);
        console.log("================================================")

        // 1. Can I answer this question with the available data ? Or Give me the data I need to answer this question.
        const prompt1 = PROMPTS.IDENTIFY_NEEDED_DATA
            .replace('_QUESTION_', question)
            .replace('_DATA_', step.context.store.data.length > 0 ? step.context.store.data.map((item: string) => "- " + item).join("\n") + "\n" : "- No data collected yet");

        console.log("Initial step prompt : ", prompt1);


        // const prompt1Result = await llmCompletion(prompt1, llm);
        const prompt1Result = await modelCompletion(prompt1, model, openAI);
        const query1 = prompt1Result.text

        console.log("Step 1 : Answer or data needed (str): ", query1)

        let jsonString = query1.substring(query1.indexOf("[")).replace(/\n/g, "").trim();
        jsonString = jsonString.substring(0, jsonString.indexOf("]") + 1);

        // Fix JSON inconsistency (if any) :
        try {

            jsonString = jsonrepair(jsonString);
        } catch (err) {
            console.error(`Error parsing JSON string -${jsonString}-: `, err);
            jsonString = '[]'
        }
        const query1Result = JSON.parse(jsonString);

        console.log("Step 1 : Answer or data needed (json): ", query1Result)

        // console.log("================================================")
        // console.log("[RecursiveRAG] Data needed or answer ok ? ", query1Result.nextDataNeeded.length > 0 ? "No, will need to get data and rephrase query" : "Yes, answer is ready to be given")

        if (query1Result.length > 0) {

            // 2. Get the data

            // const sourceData = await findData([query1Result[0]], modelData, embedModel, vectorStore, localFilesDir, openAI, reranker);
            const sourceData = await findDataInEmbeddings(query1Result, modelData, embedModel, vectorStore, openAI, reranker);

            console.log("================================================")
            console.log("[RecursiveRAG] Data found : ", sourceData.length);


            // 3. Rephrase the query and integrate the data in it:
            // const prompt2 = PROMPTS.REPHRASE_QUERY
            //     .replace('_QUERY_', query)
            //     .replace('_DATA_', JSON.stringify(sourceData));

            // console.log("Rephrase prompt : ", prompt2);
            // const prompt2Result = await llmCompletion(prompt2);
            // const rephrasedQuery = prompt2Result.text

            // console.log("================================================")
            // console.log("[RecursiveRAG] Query rephrased : ", rephrasedQuery);

            for (let data of sourceData) {
                step.context.store.data.push(data)
            }

            // Rephrase :
            const prompt2 = PROMPTS.REPHRASE_QUERY
                .replace('_INITIAL_QUERY_', initialQuestion)
                .replace('_QUERY_', question)
                .replace('_DATA_', step.context.store.data.map((item: string) => "- " + item).join("\n"))

            console.log("Rephrase prompt : ", prompt2);

            // const queryRephrased = (await llmCompletion(prompt2, llm)).text
            const queryRephrased = (await modelCompletion(prompt2, model, openAI)).text

            console.log("================================================")
            console.log("[RecursiveRAG] Query rephrased : ", queryRephrased);

            // Update the rephrased query :
            step.context.store.rephrasedQuery = queryRephrased;

            // Try to answer :
            const prompt3 = PROMPTS.ANSWER_QUESTION
                .replace('_QUERY_', question)
                .replace('_DATA_', step.context.store.data.map((item: string) => "- " + item).join("\n"))

            console.log("================================================")
            console.log("Query: ", question)
            console.log("Answer prompt : ", prompt3);

            // const prompt3Result = await llmCompletion(prompt3, llm)
            const prompt3Result = await modelCompletion(prompt3, model, openAI);


            if (prompt3Result.text.toLowerCase().includes("i don't know") && step.context.store.remainingOccurences > 0) {
                step.context.store.remainingOccurences--;
                enqueueOutput({
                    taskStep: step,
                    output: { message: { role: 'assistant', content: queryRephrased }, raw: null },
                    isLast: false,
                });
            } else {
                // Let's stop here with occurences, limit reached. Try to answer.

                enqueueOutput({
                    taskStep: step,
                    output: { message: { role: 'assistant', content: prompt3Result.text }, raw: null },
                    isLast: true,
                });
            }

        } else {

            console.log("================================================")
            console.log("[RecursiveRAG] Query cannot be answered ...");

        }
    };

}



