# A Writer Bot

A bot that gives you some ideas for editorial content.

## Launch

1. Launch init script : `npm run init`
2. Launch the writer script `npx ts-node src/product/writer.ts`

It will show you an idea of article based on 


## How it works

The bot reads text documents in `input_wikipedia` directory. It can be any kind of text inputs, we used Wikipedia pages for development.

The bot will find common elements between the documents and generates a list of questions which answer could make a good idea of article.

For example, given two personalities who worked together, the bot will generate a question like "What if Wozniak had worked on another technology with Jobs?".

Then, the bot uses the *Iterative RAG* to find an answer into the documents. We set a max occurences number to 2 for the tests, but we could be more precise by increasing this number. We wanted to keep a more general answer to give a general idea of article.

## Why Iterative RAG is important for this use case

The first steps are made to find the humorous, interesting or other kind of ideas. It depends on the documents in the input directory. If you put document about people, it will generate funny ideas about their common life experience. It you put a man and a monument in the input dir, it will find ideas about different events in their common history. We don't know. And that's cool.

Then, we can find any kind of questions about entities. We need multi-hop capabilities and we need to have an abstration layer to find any type of informations. That's why the iterative agent will be more effective in our case.

## TODO

 * Allow the user to select the different propositions of the first step, before asking informations to the iterative RAG
 * Write a plan for an article with multiple points
 * For each section, could be a text, a chapter or a post in an X thread, determine a theme
   * Each theme can be a question to ask to the Iterative RAG
   * Use every returned informations to write the section
 * An then we got a complete process of editorial creation based on a collection of documents

