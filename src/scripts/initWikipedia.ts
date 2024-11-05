import fs from 'fs';
import { WikipediaToolInfobox } from '../tools/WikipediaToolInfobox';

async function getWikiPages() {
    // Create input_wikipedia directory if it doesn't exist
    if (!fs.existsSync('./input_wikipedia')) {
        fs.mkdirSync('./input_wikipedia');
    }

    const evaluation = JSON.parse(fs.readFileSync('evaluation.json', 'utf8'));
    let arrWikipediaPages: string[] = [];

    // Collect all wikipedia links from evaluation
    console.log("Collecting Wikipedia pages...");
    for (let i = 1; i <= 10; i++) {
        console.log(`Adding wiki links from wikipedia_link_${i}`);
        arrWikipediaPages.push(...evaluation.map((item: any) => item[`wikipedia_link_${i}`]));
    }
    console.log("Adding wiki links from wikipedia_link_11+");
    arrWikipediaPages.push(...evaluation.map((item: any) => item["wikipedia_link_11+"]));

    // Remove duplicates and empty links
    arrWikipediaPages = [...new Set(arrWikipediaPages)].filter(link => link !== "");
    console.log("Total unique Wikipedia pages:", arrWikipediaPages.length);

    const tool = new WikipediaToolInfobox();
    for (let wikiPage of arrWikipediaPages) {
        try {
            console.log("\nProcessing wiki page:", wikiPage);

            let url = decodeURIComponent(wikiPage) || "";
            let pageName = url.split("/").pop()
                ?.replace(/%27/g, "'")
                .replace(/%E2%80%93/g, "-") || "";

            // Remove after #
            pageName = pageName.split("#")[0];

            // Skip if file already exists
            if (fs.existsSync(`./input_wikipedia/${pageName}.txt`)) {
                console.log("File already exists, skipping:", pageName);
                continue;
            }

            console.log("Fetching content for:", pageName);
            const page = await tool.loadData(pageName);
            fs.writeFileSync(`./input_wikipedia/${pageName}.txt`, page);
            console.log("Successfully saved:", pageName);

            // Add a small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            console.error(`Error processing ${wikiPage}:`, error);
        }
    }
}

// Execute if this file is run directly
if (require.main === module) {
    getWikiPages()
        .then(() => console.log('Wikipedia page fetching completed'))
        .catch(error => console.error('Error:', error));
}

export { getWikiPages };
