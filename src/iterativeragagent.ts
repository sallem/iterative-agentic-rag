
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

import fs from 'fs';
import { jsonrepair } from 'jsonrepair'
import { VectorStore, VectorStoreQueryMode } from "llamaindex";
import { QdrantVectorStore } from "llamaindex";
import { OllamaEmbedding, Settings, Groq } from "llamaindex";
import { PROMPTS } from './prompts';
import { CONFIG } from './config';
import { splitTextSafely } from './tools/utils';
import type { MessageContent } from "@llamaindex/core/llms";
import type { NodeWithScore } from "@llamaindex/core/schema";
import { embedFiles } from "./scripts/embedFiles";

// TODO: Import from llamaindex package ??
interface BaseNodePostprocessor {
    /**
     * Send message along with the class's current chat history to the LLM.
     * This version returns a promise for asynchronous operation.
     * @param nodes Array of nodes with scores.
     * @param query Optional query string.
     */
    postprocessNodes(
        nodes: NodeWithScore[],
        query?: MessageContent,
    ): Promise<NodeWithScore[]>;
}


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

async function llmCompletion(prompt: string, llm = Settings.llm) {
    return await llm.complete({
        prompt: prompt
    });
}

async function getFilesToRead(name: string, embedModel = Settings.embedModel, vectorStore: VectorStore, localFilesDir: string) {

    const files = await fs.promises.readdir(localFilesDir);

    console.log("Query files for : ", name);

    vectorStore.embedModel = embedModel
    const queryResult = await vectorStore.query({
        queryStr: name,
        mode: VectorStoreQueryMode.DEFAULT,
        similarityTopK: 100,
        queryEmbedding: await embedModel.getTextEmbedding(name)
    });
    let partialResults = queryResult.nodes?.map((item: any) => item.metadata.file)

    // Remove duplicates
    partialResults = [...new Set(partialResults)]

    return files.filter(file => partialResults.includes(file));
}

async function _findData(dataNeeded: string, llm_get_data = Settings.llm, embedModel = Settings.embedModel, vectorStore: VectorStore, localFilesDir: string) {
    // Get all files to read where 
    const arrFiles = await getFilesToRead(dataNeeded, embedModel, vectorStore, localFilesDir);

    // Get 
    let dataFound: string[] = []

    console.log("--------------------------------")
    console.log("Data search: ", dataNeeded)

    for (let file of arrFiles) {

        console.log("Find data in file : ", file);
        const content = fs.readFileSync(`${localFilesDir}/${file}`, 'utf8');
        // console.log("Content : ", content);

        const nodes = await splitTextSafely(content, 512, 75);

        // console.log("Nodes:", nodes)
        // console.log("----------------------------------")

        for (const node of nodes) {

            const prompt = `
If the following text :

<text>${node}</text>

I am looking for informations about "${dataNeeded}".

Extract facts that could be useful to find this information.
Each result must be a sentence or assertion of that fact. Add context informations, like entity which it stands for, geographical informations, temporal informations, dates, etc.

Answer with a JSON array of strings, for example:
["string1", "string2", "string3"]

Return empty array "[]" if no information is found.
`

            // console.log("Prompt : ", prompt);
            const facts = await llm_get_data.complete({
                prompt: prompt,
            });

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

            if (dataFound.length > 1) {
                break;
            } else {
                await new Promise(resolve => setTimeout(resolve, 750));
            }
        }
    }

    console.log("Whole data found : ", dataFound);

    return dataFound;
}

async function findData(dataNeeded: string[], llm_get_data = Settings.llm, embedModel = Settings.embedModel, vectorStore: VectorStore, localFilesDir: string) {

    let dataFound: string[] = []
    for (let data of dataNeeded) {
        const dataFound_ = await _findData(data, llm_get_data, embedModel, vectorStore, localFilesDir);
        dataFound.push(...dataFound_);
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
    llmData: LLM;
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
        const { localFilesDir, embedModel, vectorStore } = step.context.store;
        const { llm } = step.context;
        const lastMessage = step.context.store.messages.at(-1)!.content;
        const question = step.context.store.rephrasedQuery ?? lastMessage.toString();

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

        const prompt1Result = await llmCompletion(prompt1, llm);
        const query1 = prompt1Result.text

        let jsonString = query1.substring(query1.indexOf("{")).replace(/\n/g, "").trim();
        jsonString = jsonString.substring(0, jsonString.indexOf("}") + 1);

        // Fix JSON inconsistency (if any) :
        try {

            jsonString = jsonrepair(jsonString);
        } catch (err) {
            console.error("Error parsing JSON string -${jsonString}-: ", err);
            jsonString = '{ "answer": "no answer", "nextDataNeeded": "no data needed" }'
        }
        const query1Result = JSON.parse(jsonString);

        console.log("Step 1 : Answer or data needed : ", query1Result)

        // console.log("================================================")
        // console.log("[RecursiveRAG] Data needed or answer ok ? ", query1Result.nextDataNeeded.length > 0 ? "No, will need to get data and rephrase query" : "Yes, answer is ready to be given")


        if (query1Result.nextDataNeeded) {

            // 2. Get the data
            const sourceData = await findData([query1Result.nextDataNeeded], llm, embedModel, vectorStore, localFilesDir);

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
                .replace('_QUERY_', question)
                .replace('_DATA_', step.context.store.data.map((item: string) => "- " + item).join("\n"))

            console.log("Rephrase prompt : ", prompt2);

            const queryRephrased = (await llmCompletion(prompt2, llm)).text

            console.log("================================================")
            console.log("[RecursiveRAG] Query rephrased : ", queryRephrased);

            // Update the rephrased query :
            step.context.store.rephrasedQuery = queryRephrased;

            if (step.context.store.remainingOccurences > 0) {
                step.context.store.remainingOccurences--;
                enqueueOutput({
                    taskStep: step,
                    output: { message: { role: 'assistant', content: queryRephrased }, raw: null },
                    isLast: false,
                });
            } else {
                // Let's stop here with occurences, limit reached. Try to answer.

                const prompt3 = PROMPTS.ANSWER_QUESTION
                    .replace('_QUERY_', question)
                    .replace('_DATA_', step.context.store.data.map((item: string) => "- " + item).join("\n"))

                console.log("================================================")
                console.log("Query: ", question)
                console.log("Answer prompt : ", prompt3);

                const prompt3Result = await llmCompletion(prompt3, llm)

                enqueueOutput({
                    taskStep: step,
                    output: { message: { role: 'assistant', content: prompt3Result.text }, raw: null },
                    isLast: true,
                });
            }

        } else {

            console.log("================================================")
            console.log("[RecursiveRAG] Query answered : ", query1Result);

            console.log("Query 1 result : ", query1Result);
            enqueueOutput({
                taskStep: step,
                output: { message: { role: 'assistant', content: query1Result.answer }, raw: null },
                isLast: true,
            });

        }

    };

}



