import { WikipediaTool } from "llamaindex";
import { default as wiki } from "wikipedia";
import { NodeHtmlMarkdown } from 'node-html-markdown';

export class WikipediaToolInfobox extends WikipediaTool {
    async loadData(
        page: string,
        lang: string = 'en',
    ): Promise<string> {
        wiki.setLang(lang);
        console.log("Load data : ", page);
        const pageResult = await wiki.page(page, { 
            autoSuggest: false, 
            fields: ['summary', 'content', 'infobox', 'tables'] 
        });

        // Convert HTML content to markdown
        let content = await pageResult.html();
        content = NodeHtmlMarkdown.translate(content);
        return content;
    }
}
