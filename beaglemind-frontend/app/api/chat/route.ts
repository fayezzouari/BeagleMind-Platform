import { openai } from '@ai-sdk/openai';
import { convertToModelMessages, streamText, UIMessage } from 'ai';

export const maxDuration = 30;

// Configuration constants
const KNOWLEDGE_BASE_URL = process.env.KNOWLEDGE_BASE_URL || 'http://localhost:8000';
// Make collection configurable; default to backend's expected name
const KB_COLLECTION_NAME = process.env.KB_COLLECTION_NAME || 'beaglemind_col';

// Types for the retrieve API
interface DocumentMetadata {
  score: number;
  distance: number;
  file_name?: string;
  file_path?: string;
  file_type?: string;
  source_link?: string;
  chunk_index?: number;
  language?: string;
  has_code?: boolean;
  repo_name?: string;
}

interface RetrieveResponse {
  documents: string[][];
  metadatas: DocumentMetadata[][];
  distances: number[][];
  total_found: number;
  filtered_results: number;
}

// Context building configuration
const KB_CONTEXT_RESULTS = Number(process.env.KB_CONTEXT_RESULTS || 5);
const KB_CONTEXT_CHAR_BUDGET = Number(process.env.KB_CONTEXT_CHAR_BUDGET || 4000);

// Function to fetch from knowledge base
async function fetchKnowledgeBase(query: string) {
  try {
    const requestBody = {
      query: query,
  collection_name: KB_COLLECTION_NAME,
      n_results: 10,
      include_metadata: true,
      rerank: true
    };

    const response = await fetch(`${KNOWLEDGE_BASE_URL}/api/retrieve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

  const data: RetrieveResponse = await response.json();
  console.log('Knowledge base response:', { total_found: data.total_found, filtered_results: data.filtered_results });
    
    // Format the response for the AI
    const formattedResults = data.documents.map((docGroup, groupIndex) => 
      docGroup.map((doc, docIndex) => ({
        content: doc,
        metadata: data.metadatas[groupIndex]?.[docIndex] || {},
        distance: data.distances[groupIndex]?.[docIndex] || 0,
      }))
    ).flat();

    return {
      total_found: data.total_found,
      filtered_results: data.filtered_results,
      results: formattedResults.slice(0, KB_CONTEXT_RESULTS), // configurable limit for context
    };
  } catch (error) {
    console.error('Error fetching from knowledge base:', error);
    return {
      error: 'Failed to retrieve documents from knowledge base',
      results: [],
      total_found: 0,
      filtered_results: 0
    };
  }
}

// Build a compact, budgeted context string for the system prompt
interface BuiltContext {
  included: number;
  sources: string[]; // "C1: url"
  text: string; // formatted context for system prompt
}

function buildContextFromResults(
  results: Array<{ content: string; metadata: Partial<DocumentMetadata>; distance: number }>,
  totals: { total_found: number; included?: number }
): BuiltContext {
  let used = 0;
  const chunks: string[] = [];
  let included = 0;
  const sourceMap: string[] = [];

  for (const [i, r] of results.entries()) {
    const meta = r.metadata || {};
    const metaParts: string[] = [];
    if (meta.file_name) metaParts.push(`File: ${meta.file_name}`);
    if (meta.repo_name) metaParts.push(`Repo: ${meta.repo_name}`);
    if (meta.language) metaParts.push(`Lang: ${meta.language}`);
    if (meta.has_code) metaParts.push('Contains Code');
    const header = `Context ${i + 1}${metaParts.length ? ` [${metaParts.join(', ')}]` : ''}`;
    const text = (r.content || '').trim();
    const allowed = Math.max(0, KB_CONTEXT_CHAR_BUDGET - used - header.length - 4);
    if (allowed <= 0) break;
    const clipped = text.length > allowed ? text.slice(0, allowed) : text;
    const sourceLine = meta.source_link ? `\n(Source: ${meta.source_link})` : '';
    const block = `${header}:\n${clipped}${sourceLine}`;
    used += block.length + 2;
  chunks.push(block);
    included += 1;
    if (meta.source_link) {
      sourceMap.push(`C${i + 1}: ${meta.source_link}`);
    }
    if (used >= KB_CONTEXT_CHAR_BUDGET) break;
  }

  const summary = `RELEVANT CONTEXT FROM KNOWLEDGE BASE (total matches: ${totals.total_found}, included: ${included})`;
  return {
    included,
    sources: sourceMap, // array of strings like C1: URL
    text: chunks.length
	? `\n\n<context>\n${summary}\n\n${chunks.join('\n\n')}\n</context>\n${sourceMap.length ? `\n<sources>\n# SOURCE LINKS (Cite these inline and list in References)\n${sourceMap.join('\n')}\n</sources>\n` : ''}\nUse the context above for grounding. If insufficient, combine with general BeagleBoard knowledge and clearly label assumptions.`
      : ''
  };
}

// Tools removed; retrieval is handled pre-response and injected into system prompt

export async function POST(req: Request) {
  const { messages, data }: { messages: UIMessage[]; data?: { tool?: string } } = await req.json();

  let contextualSystemPrompt = `You are BeagleMind, an AI assistant specialized in BeagleBoard development and hardware.
You help users with:
- BeagleBoard hardware specifications and capabilities
- Development setup and configuration
- GPIO programming and peripheral interfacing
- Linux and embedded systems development
- Troubleshooting hardware and software issues
- Project guidance and best practices

REFERENCE & CITATION RULES:
1. The <context> section contains numbered context blocks (Context N) and an optional <sources> list mapping CN -> URL.
2. When you directly use or closely paraphrase a factual sentence from a specific context block that has a source link, include that sentence (or a concise paraphrase) immediately followed by a markdown link whose text is the quoted or paraphrased sentence fragment and whose URL is the source link.
   Example: If context sentence is "The BeagleBone Black has 4GB eMMC", you can write: [The BeagleBone Black has 4GB eMMC](https://example.com/specs).
3. Each distinct source link should appear at least once if its information is used; do not spam duplicate links for the same continuous paragraph—group related facts and cite once at the end of the paragraph if they come from the same snippet.
4. If you synthesize info from multiple context snippets, split sentences so each cited sentence has only one source link.
5. If you add general background not present in context, clearly mark with the prefix "Assumption:" or "General knowledge:" and do NOT attach a source link.
6. Never invent URLs. Only use URLs provided as Source lines in the context or sources list. If a needed claim lacks a source, state that explicitly.
7. Format ALL source citations using the markdown pattern: [sentence or fragment](URL) exactly.
8. For code blocks derived from context, add a comment on the first line like // Source: URL (if applicable) but still include inline cited explanation sentences outside the code.
 9. MANDATORY: If any <sources> exist you MUST include at least one citation link for every distinct source you relied upon. Do NOT output uncited factual claims when a source link for that fact exists.
10. If <sources> exists and you provide zero [text](URL) links, you must self-correct before finishing.
11. Do NOT fabricate or guess a URL. If a fact seems to need a citation but no source link was supplied, say "(no source link provided)" instead of adding a link.

At the end of EVERY answer (if any <sources> section was provided) you MUST append a markdown section:
## References\n
List ONLY the distinct source URLs you actually cited in the answer (order of first citation). Format each line as: - [Short descriptive label or domain](URL)
If you used a source but didn't cite it inline yet, cite it inline before producing the References section (self-correct first). If no sources were provided, omit the References section entirely.

Output must be helpful, concise, clean markdown, and must NOT dump raw <context>. Always integrate citations inline and finish with the required References section when sources exist.
\nSELF-CHECK BEFORE SENDING FINAL TOKEN (perform silently, then fix if needed):\n- If a <sources> block exists: Does answer contain inline [text](URL) citations?\n- Does it end with a '## References' section listing each cited URL exactly once?\n- Are there any cited URLs not in <sources>? (Remove them if so.)\n- Any URL in <sources> used but not cited? (Add a citation sentence.)\nIf any check fails, correct the answer BEFORE finalizing the stream.\n
`;

  // Get the latest user message for context retrieval
  const latestMessage = messages[messages.length - 1];
  let retrievedContext = '';

  if (latestMessage && latestMessage.role === 'user') {
    const userQuery = latestMessage.parts
      ?.filter(part => part.type === 'text')
      ?.map(part => part.text)
      ?.join(' ') || '';

    // Also consider previous conversation context for better retrieval
    const conversationContext = messages
      .slice(-4) // Last 4 messages for context
      .filter(msg => msg.role === 'user')
      .map(msg => msg.parts
        ?.filter(part => part.type === 'text')
        ?.map(part => part.text)
        ?.join(' ')
      )
      .filter(Boolean)
      .join(' ');

    const queryForRetrieval = conversationContext || userQuery;

    if (queryForRetrieval) {
      console.log('Retrieving context for query:', queryForRetrieval);
      const contextData = await fetchKnowledgeBase(queryForRetrieval);
      
      if (contextData.results && contextData.results.length > 0) {
  const built = buildContextFromResults(
    contextData.results as Array<{ content: string; metadata: Partial<DocumentMetadata>; distance: number }>,
    { total_found: typeof contextData.total_found === 'number' ? contextData.total_found : 0 }
  );
  retrievedContext = built.text;
  // Coverage section removed per request
  } else if (typeof contextData.error !== 'undefined') {
        console.warn('Knowledge base retrieval failed:', contextData.error);
        retrievedContext = '\n\nNote: Unable to retrieve specific context from knowledge base. Providing answer based on general BeagleBoard knowledge.';
      }
    }
  }
  
  // Optional: keep hint text based on requested tool, but no runtime tools are used
  if (data?.tool === 'websearch') {
    contextualSystemPrompt += '\n\nYou may search the web if required, but prefer internal knowledge base.';
  } else if (data?.tool === 'knowledge') {
    contextualSystemPrompt += '\n\nPrefer the BeagleMind knowledge base when answering.';
  } else if (data?.tool === 'both') {
    contextualSystemPrompt += '\n\nUse both internal knowledge base and general knowledge as needed.';
  }

  // Add the retrieved context to the system prompt
  contextualSystemPrompt += retrievedContext;
  console.log(contextualSystemPrompt)
  // Use non-streaming generation so we can deterministically append a References section manually
  const modelMessages = convertToModelMessages(messages);
  // Pre-compute a references section and force the model to reproduce it verbatim at end.
  const result = streamText({
    model: openai('gpt-4o'),
    system: contextualSystemPrompt,
    messages: modelMessages,
  });

  return result.toUIMessageStreamResponse();
}
