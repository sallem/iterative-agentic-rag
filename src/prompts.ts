export const PROMPTS = {

    IDENTIFY_NEEDED_DATA: `
I have a complex question that I need help breaking down into smaller, logical steps. Here’s the question:

'_QUESTION_'

Please analyze this question and list each piece of information we need to find as individual steps. Output your response as a JSON array of strings, where each string is one of the steps needed to solve the question.
Do no include steps which answer is already in the available data or no needed to answer the question.
Format your response as follows:

json
Copier le code
[
  "[description of the first step]",
  "[description of the second step]",
  "[description of the third step]",
  ...
]
Only provide the JSON array as output
`,

    REPHRASE_QUERY: `
TASK
Rewrite the following query by replacing any references where we have explicit information in the supplementary data, while maintaining the original logic and question structure.

ORIGINAL QUERY
_INITIAL_QUERY_

SUPPLEMENTARY DATA
_DATA_

RULES
1. Replace implicit references with explicit ones when the data allows it
2. Keep all elements that cannot be clarified using the given data
3. Maintain the original question format
4. Do not add or remove any logical components

OUTPUT FORMAT
Provide only the rewritten query, with no additional text.
`,
    ANSWER_QUESTION: `
Consider the following data :
<data>_DATA_</data>

Answer the following question based on the available data :
<question>_QUERY_</question>

If you cannot answer the question, return only "I don't know".
`,
    GET_FACTS: `
If the following text :

<text>
_TEXT_
</text>

I am looking for informations about "_DATA_NEEDED_".

Extract facts related to this information.
Each result must be a sentence or assertion of that fact.
Add context informations and details, like entity which it stands for, geographical informations, temporal informations, dates, etc.

Do not make up informations, only use the informations provided in the text.
To check the relevance of the fact, ask yourself if this fact could help answering the following question : "_DATA_NEEDED_".

Answer with a JSON array of strings, for example:
["string1", "string2", "string3"]

Return empty array "[]" if no information is found or if the fact is not relevant to the question.
`
};
