
import fs from "fs/promises";
import storage from "node-persist";

import removeMd from 'remove-markdown';

import OpenAI from "openai";
import { LLM } from "llamaindex";
import { CONFIG } from "../config";

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


    // content = content.replace(/\.{3,}/g, ".").replace(/\-{3,}/g, "-");
    // Remove lines starting with "|"
    // content = content.split("\n").filter(line => !line.startsWith("|")).join("\n");


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


async function getListOfCommonElements(shortSummaries: { [key: string]: string }) {

    console.log("Short summaries :", shortSummaries);

    // For each article :
    // Get list of summaries of other articles :
    const resCommonElements: { [key: string]: string } = {};

    for (const article in shortSummaries) {

        console.log("Article :", article);

        const otherArticles = Object.keys(shortSummaries).filter(summary => summary !== article);

        console.log("Other otherArticles :", otherArticles);

        // Get common elements :
        for (const otherArticle of otherArticles) {

            if (await storage.getItem(`common_elements_${article}_${otherArticle}`)) {
                resCommonElements[article + "-" + otherArticle] = await storage.getItem(`common_elements_${article}_${otherArticle}`);
                continue;
            }

            console.log("Other otherArticle :", otherArticle);

            const commonElements = await llmComplete(`Find common elements between the following summaries : 
<first_summary>${shortSummaries[article]}</first_summary>
<other_summary>${shortSummaries[otherArticle]}</other_summary>

Answer with a list of elements, separated by commas. Give some context for each element, with entities informations.
`);
            console.log("Common elements :", commonElements);

            // Cache it :
            await storage.setItem(`common_elements_${article}_${otherArticle}`, commonElements);

            resCommonElements[article + "-" + otherArticle] = commonElements ?? "";
        }
    }

    return resCommonElements;
}


async function getStoryLines(articles: string[], commonElements: { [key: string]: string }) {

    console.log("Prompt:", `
You are an influencer on Twitter. You like to write short stories based on historical facts.
Write the plan of an anecdote story which could be based on common elements : 
        
<common_elements>
${Object.values(commonElements).join("\n")}
</common_elements>

Answer with the plan of the story in maximum 5 bullet points. This should be the main points of the story in the order they should be written.
Consider using the common elements to write a story that is engaging and interesting. The story should not take only one article as a source.
`)


    // Write the plan of a story which could be based on common elements :
    const storyPlan = await llmComplete(`
You are an influencer on Twitter. You like to write short stories based on historical facts.
Write the plan of an anecdote story which could be based on common elements : 
        
<common_elements>
${Object.values(commonElements).join("\n")}
</common_elements>

Answer with the plan of the story in maximum 5 bullet points. This should be the main points of the story in the order they should be written.
Consider using the common elements to write a story that is engaging and interesting. The story should not take only one article as a source.
`);


    console.log("Story plan :", storyPlan);

    return storyPlan;
}

async function findCommonElements(articles: string[]) {

    // For each article, make short summary :
    const shortSummaries = (await Promise.all(articles.map(article => getShortSummary(article)))).reduce((acc, curr) => {
        return { ...acc, ...curr };
    }, {});

    // For each each article, find elements in the article that could be in relation with the other articles
    const commonElements = await getListOfCommonElements(shortSummaries);

    // For each article, extract a long summary of the article, mentioning the elements found in the previous step

    const storyLines = await getStoryLines(articles, commonElements);

    // Return the list of articles with their short and long summaries

    return articles.map((article) => {
        return {
            articleName: article,
            shortSummary: "",
            longSummary: ""
        }
    });
}


(async () => {

    await storage.init();
    // await storage.clear()

    // Step 1 : Select random wikipedia articles
    // TODO: For the moment, let's just read files in ../input_wikipedia
    // const articles = await fs.readdir("./input_wikipedia");
    const articles = [
        'Harriet_Lane.txt',
        'Punxsutawney_Phil.txt',
    ]

    // Step 2 : Find common elements between the articles
    const commonElements = await findCommonElements(articles);


    // Step 3 : Generate a list of points of interest


    // Step 4 : Use the iterative RAG to collect informations about each point of interest


    // Step 5 : Write a story divided into paragraphs, each paragraph focusing on a different point of interest


    // Show the story :


})();