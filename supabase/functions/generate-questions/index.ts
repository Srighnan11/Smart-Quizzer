import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { topic, customText, skillLevel, numQuestions = 5 } = await req.json();
    console.log('Generating questions for:', { topic, skillLevel, numQuestions });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const contentSource = customText || `Generate quiz questions about ${topic}`;
    
    const systemPrompt = `You are an expert quiz generator. Generate ${numQuestions} quiz questions based on the provided content.

Skill level: ${skillLevel}

For each question, you must provide:
1. A clear question text
2. Question type: either "multiple-choice" or "true-false"
3. For multiple-choice: exactly 4 options (A, B, C, D)
4. The correct answer
5. Difficulty classification: Easy, Medium, or Hard

Difficulty guidelines:
- Easy: Basic recall and simple concepts
- Medium: Application and understanding
- Hard: Analysis and critical thinking

Return ONLY a valid JSON array with this exact structure:
[
  {
    "question": "Question text here?",
    "type": "multiple-choice",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct": "Option A",
    "difficulty": "Easy"
  },
  {
    "question": "True or false statement?",
    "type": "true-false",
    "options": ["True", "False"],
    "correct": "True",
    "difficulty": "Medium"
  }
]

Important: Return ONLY the JSON array, no additional text or formatting.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: contentSource }
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits to your workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error('Failed to generate questions');
    }

    const data = await response.json();
    const generatedText = data.choices[0].message.content;
    
    console.log('Generated text:', generatedText);

    // Extract JSON from the response
    let questions;
    try {
      // Try to find JSON array in the response
      const jsonMatch = generatedText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        questions = JSON.parse(jsonMatch[0]);
      } else {
        questions = JSON.parse(generatedText);
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError, generatedText);
      throw new Error('Invalid response format from AI');
    }

    // Validate and normalize questions
    const normalizedQuestions = questions.map((q: any) => ({
      question_text: q.question,
      question_type: q.type,
      options: q.type === 'multiple-choice' ? q.options : ['True', 'False'],
      correct_answer: q.correct,
      difficulty: q.difficulty || 'Medium'
    }));

    console.log('Successfully generated questions:', normalizedQuestions.length);

    return new Response(
      JSON.stringify({ questions: normalizedQuestions }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-questions:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});