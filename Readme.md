# Iterative Agentic RAG

The Iterative Agentic RAG is a proposition of Retriever Augmented Generator suitable for multi-hop queries, and able to answer reasonning dependant questions with small opensource models.

## ⚙️ Principles

In the schema below, we see the 10 steps from the initial documents embedding to the answer to a complex query.

![Schema](./img/schema.png)

1. Initial document embedding. Chunks size must be small : 500 characters with 80 characters window show a good performance. This will ne be used to retrieve data.
2. Let's now go to the main engine `Step engine`. We send the user query to the IterativeAgenticRAG agent, it will take care of everything. This agent is a JavaScript class that will analyze, simplify, find data and answer to the question.
3. The analyze phase aims to find the next data you would need to answer to the question. For example, "What is the name of the first lady of the 15th president of the USA ?", you will need to find who is the 15th POTUS, then, find the name of his wife or first lady. This step take the query and can also return the answer directly if the query is simple enough.
4. We need to find the next needed data, for example the name of the 15th POTUS. We will ask this to the `Data Finder` component. If the analyze found the answer, we just return the answer.
5. Remember step 1, we embeded the files of our knowledge base. We will use them to find a sublist of file where we could find the data we need.
6. With the sublist of file, we will read them one by one, asking a model to extract informations in relation with the data we are looking for.
7. When we collect more than a limit number of informations, we consider we have enough informations to give to the `Step Engine`
8. We have data and a complex query, let's rephrase the query to simplify it. For exemple, we found the name of the 15th POTUS, we rephrase the query this way : "What is the name of the first lady of James Buchanan". This is way more simple to understand right ? The engine will launch another loop till it reaches a loop limit number. When the query is still too complex and the loop limit number is reached, whe ask a model to try to answer it for the last time and return its answer.

## ⁉️ Why ?

This RAG architecture was made to address a specific problem of RAGs : Asking quantitative or qualitative informations on the same embeddings can make our lives difficult. Small chunks are good for quantitative questions, large chunks and summaries are good for qualitative questions.

Our assertion : We don't know what the user will ask when we create a RAG. So, let's be radical, search data on-demand, the model will understand a given text from the user's point of view.

Second assertion : Asking an agent to extract specific data is easier for small/medium models and prevent hallucinations and errors. 

This architecture has been developped for the NVIDIA Developper Contest (https://developer.nvidia.com/llamaindex-developer-contest) with LlamaIndex.

We chose the [LlamaIndex](https://github.com/run-llama/LlamaIndexTS) Typescript version in order to test the TS version of the framework. This is really easy to use and it makes it easier to integrate LLM component into web infrastructures.


## 🔎 Quality evaluation

Creating a RAG can be more or less easy. Looking for quantitative information into a text is not the hardest thing in the world but adding a multi-hop capacity can make it a lot more difficult. That's it has been chosen to use the Google RAG benchmark dataset (https://huggingface.co/datasets/google/frames-benchmark). It is composed of a list of questions and sources with the corresponding answer.

The development has been evaluated with the first queries and this project could be improved by adapting the architecture of the Iterative Agentic RAG to be more efficient on different kind of queries.


## 💬 Developper thoughts

* The NVIDIA NIM service is great but working on this project consumed A LOT of credits. Then, it has been chosen to make first tests with different services that makes the source code more "meta" level. LlamaIndex is made to be able to use LLMs like Grok, Ollama, NVIDIA, etc. The Iterative Agentic RAG is a class using LlamaIndex abstract classes to be able to work with different LLMs/Embeddings/Rerankers, etc.
* LlamaIndex `SentenceSplitter` failed with a bug about "max stack size exceeded" when the document is too long, so I used a simpler function to split the texts.
* Agentic data extraction is slow and energy consumer. We should add data into a vector store in order to cache data in a database without having to call a model again.



## 📁 Files

- img: Schema for this file
- input_wikipedia: Will contain text version of wikipedia articles used for tests
- src: Sources
  - scripts: Init script to download and parse Wikipedia pages used for evaluation tests
  - tools: Functions used to split text and WikipediaTools to improve LlamaIndex's version (with infobox and tables)
  - iterativeragagent.ts : Should be sent to LlamaIndex repository if they want it ;)
- evaluation_60.json & evaluation.json : Partial evaluation tests from Google RAG benchmark dataset. `evaluation.json` contains a subset to make dev tests.


## ⚙️ Requirements 

- NodeJS 22.x (a bug will occure with previous versions)
- Ollama / NVIDIA NIM API Key / Groq API Key
- Minimal model : `llama3.1:70b` for minimal quality, 8b would make quality too low to be usable. Tests on `llama-3.2-90b-text-preview`.
- The simplest vector store used with LlamaIndex with TypeScript is QDrant. You shall launch a local QDrant server with : `docker run -p 6333:6333 qdrant/qdrant`