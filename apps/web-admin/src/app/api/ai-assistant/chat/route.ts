import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { SYSTEM_PROMPT } from '@/lib/ai-assistant/system-prompt';
import { executeQuery } from '@/lib/ai-assistant/query-executor';
import { formatResponse } from '@/lib/ai-assistant/response-formatter';
import { ChatRequest, ChatResponse, FunctionCall, QueryResult } from '@/lib/ai-assistant/types';

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const { message, conversationHistory = [] } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' } as ChatResponse,
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_PLACES_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key not configured. Please add GOOGLE_API_KEY or GEMINI_API_KEY to environment variables.' } as ChatResponse,
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Build conversation context
    const historyText = conversationHistory
      .slice(-6) // Keep last 6 messages for context
      .map((msg) => `${msg.role === 'user' ? 'Utilisateur' : 'Assistant'}: ${msg.content}`)
      .join('\n');

    const fullPrompt = `${SYSTEM_PROMPT}

${historyText ? `HISTORIQUE RÉCENT:\n${historyText}\n\n` : ''}NOUVELLE QUESTION DE L'UTILISATEUR: ${message}

Si c'est une requête de données, retourne UNIQUEMENT le JSON de la fonction à appeler.
Sinon, réponds directement en français.`;

    // Get Gemini's response
    const result = await model.generateContent(fullPrompt);
    const responseText = result.response.text().trim();

    // Try to parse as function call
    let functionCall: FunctionCall | null = null;
    try {
      // Extract JSON from response (might be wrapped in markdown code blocks)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.function && typeof parsed.function === 'string') {
          functionCall = parsed as FunctionCall;
        }
      }
    } catch {
      // Not a function call, use the response as-is
    }

    // If it's a function call, execute the query
    if (functionCall) {
      try {
        const queryResult = await executeQuery(
          functionCall.function,
          functionCall.params || {}
        );

        // Format the response
        const formattedResponse = await formatResponse(queryResult, message);

        return NextResponse.json({
          response: formattedResponse,
          data: queryResult,
        } as ChatResponse);
      } catch (queryError) {
        console.error('Query execution error:', queryError);
        return NextResponse.json({
          response: `Désolé, une erreur s'est produite lors de l'exécution de la requête: ${queryError instanceof Error ? queryError.message : 'Erreur inconnue'}`,
          error: 'Query execution failed',
        } as ChatResponse);
      }
    }

    // Return the conversational response
    return NextResponse.json({
      response: responseText,
    } as ChatResponse);
  } catch (error) {
    console.error('AI Assistant API error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        response: "Désolé, une erreur s'est produite. Veuillez réessayer.",
      } as ChatResponse,
      { status: 500 }
    );
  }
}
