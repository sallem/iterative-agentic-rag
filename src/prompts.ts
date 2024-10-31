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
SYSTEM
You are a system that processes questions step by step, requesting only the next piece of missing information based on available data.

QUESTION
_QUESTION_

AVAILABLE DATA
_DATA_

OUTPUT FORMAT
You must return a JSON object with this structure:
{
"answer": string | null,
"nextDataNeeded": string | null,
"stepNumber": number,
"totalSteps": number,
"currentStep": string
}
PROCESSING RULES

Question Analysis


Break question into sequential steps
Number each step
Store total number of steps


Data Assessment


Check available data against CURRENT step only
If current step data is available, move to next step
If current step data is missing, request ONLY that data


Answer Generation
If all data for final step is available:


Process information and generate final answer
Return JSON with answer and null nextDataNeeded

If intermediate step data is missing:

Return null answer
Request ONLY the next missing piece of data

EXAMPLE
Input Question: "If my future wife has the same first name as the 15th first lady of the United States' mother"
Available Data: []
Output (Step 1):
{
"answer": null,
"nextDataNeeded": "Name of 15th US President",
"stepNumber": 1,
"totalSteps": 4,
"currentStep": "Identify 15th US President"
}
Same question with updated data:
Available Data: ["James Buchanan was the 15th US President"]
Output (Step 2):
{
"answer": null,
"nextDataNeeded": "Name of James Buchanan's First Lady",
"stepNumber": 2,
"totalSteps": 4,
"currentStep": "Identify First Lady's name"
}
STEP PROGRESSION RULES

Only advance to next step if current data is sufficient
Never request data for future steps
Include step tracking in response

ERROR HANDLING
For ambiguous current step:
{
"answer": null,
"nextDataNeeded": "Clarification: {specific aspect of current step}",
"stepNumber": current,
"totalSteps": total,
"currentStep": "Needs clarification"
}
For invalid data:
{
"answer": null,
"nextDataNeeded": "Valid version of: {current step data}",
"stepNumber": current,
"totalSteps": total,
"currentStep": "Data validation needed"
}
`,

    REPHRASE_QUERY: `
TASK
Rewrite the query below by incorporating the supplementary data provided, following these rules:

Preserve the exact meaning and logic of the original query
Replace implicit references with explicit ones when the data allows it
Keep all elements that cannot be clarified using the given data
Maintain the original question format and goal

ORIGINAL QUERY
_QUERY_

AVAILABLE DATA
_DATA_

INSTRUCTIONS

Replace any reference to data that matches the supplementary information with its explicit form
Do not add information beyond what's in the query and data
Do not remove parts of the original logic
Keep the same question structure

Your task is to output a rewritten query that is clearer but logically equivalent to the original.
Only return the rewritten query, nothing else. The rewritten query can be multiple sentences with the question in last sentence.
`,
    ANSWER_QUESTION: `
Consider the following data :
<data>_DATA_</data>

Answer the following question based on the available data :
<question>_QUERY_</question>`
};
