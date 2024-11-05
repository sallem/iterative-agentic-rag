export const PROMPTS = {
    IDENTIFY_DATA_GROUP: `
Consider the following data :
<data>_DATA_</data>

And the following existing data groups :
<existing_data_groups>_EXISTING_DATA_GROUPS_</existing_data_groups>

Identify the data group that best match this data.

Answer only in a valid JSON object :
{
    "existingDataGroup": "name of the existing data group that best match this data, empty if no existing data group match this data",
    "newDataGroup": {
        "name": "name of the new data group to create if no existing data group match this data",
        "description": "description of the new data group to create if no existing data group match this data"
    }
}`,

    EXTRACT_FACTS: `Extract facts from the following text : 

<text>_NODE_TEXT_</text>

Express facts in an active form in english with as many details as possible.
Each fact must contain as much details as possible, each fact can contain multiple informations.
A fact MUST mention context informations, like entity which it stands for, geographical informations, temporal informations, dates, etc.
Do not use pronouns and replace them by the entity which it stands for.

You have to find facts dealing with the following subject : 
<subject>_DESCRIPTION_</subject>

For example : 
_SAMPLES_

Return only valid JSON format.
If no text provided or no fact is found, return [].

Output format: ["fact1", "fact2", "fact3"] or [], no other than an array of strings.`,

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
`
};
