
import fs from "fs/promises";
import storage from "node-persist";
import { jsonrepair } from 'jsonrepair'

import removeMd from 'remove-markdown';

import OpenAI from "openai";
import { LLM } from "llamaindex";
import { CONFIG } from "../config";

import { iterativeRAGAgent } from './loadAgent';

const llm = new OpenAI({
    apiKey: CONFIG.llm.nvidiaNimApiKey ?? "",
    baseURL: "https://integrate.api.nvidia.com/v1",
});

async function llmComplete(prompt: string) {
    return (await llm.chat.completions.create({
        model: CONFIG.llm.defaultModel,
        messages: [{ role: "user", content: prompt }],
    })).choices[0].message.content;
}


/**
 * Create a short summary of an article
 * @param article 
 * @param llm 
 * @returns 
 */
async function getShortSummary(article: string) {

    if (await storage.getItem(`short_summary_${article}`)) {
        const summary = await storage.getItem(`short_summary_${article}`);
        return { [article]: summary };
    }

    // Read the first 2000 characters of the article :
    let content = await fs.readFile(`./input_wikipedia/${article}`, "utf-8");

    // Remove MD links and tables :
    content = removeMd(content);

    // Get the first 2000 characters of the article :
    content = content.substring(0, 3000);
    // Cut the last sentence if it is incomplete, get last index of "."
    const lastDotIndex = content.lastIndexOf(".");
    if (lastDotIndex !== -1) {
        content = content.substring(0, lastDotIndex + 1);
    }

    // Use LLM to generate a short summary of the article :
    const summary = await llmComplete(`Generate a short summary of the following article : ${content}`);

    // Cache it :
    await storage.setItem(`short_summary_${article}`, summary);

    // Return the short summary
    return { [article]: summary }
}


async function getListOfCommonElements(shortSummaries: { [key: string]: string[] }) {

    for (const article in shortSummaries) {

        const otherArticles = Object.keys(shortSummaries).filter(summary => summary !== article);

        // Get common elements :
        for (const otherArticle of otherArticles) {

            const commonElements = await llmComplete(`Find common elements between the following summaries : 
<first_summary>${shortSummaries[article]}</first_summary>
<other_summary>${shortSummaries[otherArticle]}</other_summary>

Based on these common elements, generate 6-8 specific questions that will help uncover amusing, surprising, or intriguing details.
Your questions should focus on:
- Unexpected connections or coincidences
- Humorous mistakes or mishaps
- Surprising origins or evolution
- Quirky historical details
- Ironic twists
- Fun statistics or numbers
- Strange human behaviors or decisions

Answer with a list of questions in a JSON array of string. Answer only with a valid JSON.
`);

            let jsonString = commonElements?.substring(commonElements?.indexOf("[")).replace(/\n/g, "").trim();
            // Clean stirng to get only JSON array : remove all after ]
            jsonString = jsonString?.substring(0, jsonString?.indexOf("]") + 1);

            try {

                jsonString = jsonrepair(jsonString ?? "[]");

                await storage.setItem(`common_elements_${article}_${otherArticle}`, commonElements);
                // resCommonElements[article + "-" + otherArticle] = JSON.parse(commonElements) ?? [];

                return JSON.parse(jsonString);

            } catch (err) {
                console.error(`Error parsing JSON string -${jsonString}-:`, err);
            }
        }
    }
}



async function findIdea(articles: string[]): Promise<string> {

    // For each article, make short summary :
    const shortSummaries = (await Promise.all(articles.map(article => getShortSummary(article)))).reduce((acc, curr) => {
        return { ...acc, ...curr };
    }, {});

    // For each each article, find elements in the article that could be in relation with the other articles
    const arrCommonElements = await getListOfCommonElements(shortSummaries);

    // Go with question 1 :
    // User can select the best proposition :
    const question1 = arrCommonElements[0];
    const answer1 = await iterativeRAGAgent.chat({ message: question1 });
    return answer1.message.content.toString();
}



(async () => {

    await storage.init();

    // Step 1 : Select random wikipedia articles
    const articles = await fs.readdir("./input_wikipedia");

    // Let's find ideas from Wikipedia articles :
    const ideas = await findIdea(articles);

    console.log("Ideas :", ideas);

})();
