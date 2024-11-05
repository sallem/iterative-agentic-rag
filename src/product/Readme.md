# A Writer Bot

A bot that writes stories for you.

## How it works

The bot selects random wikipedia articles and writes a story from them.

Then, it finds common elements between the articles and generates a list of points of interest.

It uses the iterative RAG to collect informations about each point of interest.

Finally it write a story divided into paragraphs, each paragraph focusing on a different point of interest.

For this demonstration, it is made to write threads for X.


## Why Iterative RAG is important for this use case

The first steps are made to find the subject of the story and its subtopics.

Then the bot will have to ask questions about the content of selected articles. The questions could be one-hop or multi-hop. 

The Iteractive RAG is made to adapt the way to read for each question. That's exctly the use-case. The RAG will not extract the same way between two questions.