import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { LoggerUtil } from '../logging/logger.util';

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly model: GenerativeModel;
  private readonly streamingModel: GenerativeModel;
  private readonly apiKeyConfigured: boolean;
  private readonly modelName: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    this.modelName = this.configService.get<string>('GEMINI_MODEL', 'gemini-2.5-flash');
    this.apiKeyConfigured = !!apiKey && !apiKey.startsWith('your-');
    if (!this.apiKeyConfigured) {
      console.error('No API key configured for GeminiService');
      LoggerUtil.logInfo(
        this.logger,
        'GeminiService/Init',
        '⚠️  GEMINI_API_KEY not configured — AI features will return mock data. Set GEMINI_API_KEY in .env'
      );
    } else {
       console.error('gfsgsg');
      LoggerUtil.logInfo(
        this.logger,
        'GeminiService/Init',
        `✅ Gemini API configured - Model: ${this.modelName}`
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey ?? 'mock');
    this.model = genAI.getGenerativeModel({ model: this.modelName });
    this.streamingModel = genAI.getGenerativeModel({ model: this.modelName });
  }

  async generateQuizQuestions(params: {
    topic: string;
    cefrLevel: string;
    interests: string[];
    count: number;
    language: 'en' | 'tr';
  }): Promise<QuizQuestion[]> {
    const { topic, cefrLevel, interests, count, language } = params;
    const interestContext = interests.length > 0
      ? `The user is interested in: ${interests.join(', ')}. Use examples from these areas when possible.`
      : '';

    // Random seed forces Gemini to produce a different question set on every call
    const seed = Math.random().toString(36).slice(2, 8).toUpperCase();

    const prompt = `
You are an English language teacher creating quiz questions.

Context:
- Topic: ${topic}
- CEFR Level: ${cefrLevel}
- ${interestContext}
- Number of questions: ${count}
- UI language for explanations: ${language === 'tr' ? 'Turkish' : 'English'}
- Unique session ID: ${seed}

STRICT VARIETY REQUIREMENTS (follow every rule):
1. Every question MUST be completely unique — no repeated grammar points, words, or sentence structures.
2. Cover DIFFERENT sub-aspects of "${topic}" across the ${count} questions (e.g. if topic is "Present Perfect", cover: experience, unfinished time, recent events, with since/for, etc.).
3. Vary question formats: mix fill-in-the-blank, error correction, meaning selection, situational choice, and synonym/antonym.
4. Use fresh, realistic sentences from everyday life, news, travel, technology, food, sports, etc. NEVER use generic examples like "I go to school" or "She is a student".
5. Distribute correct answers: spread correctIndex across 0, 1, 2, and 3 — do NOT cluster correct answers at the same index.
6. Distractors (wrong options) must be plausible and educational — not obviously wrong.

Generate exactly ${count} multiple-choice questions. Return ONLY valid JSON array, no markdown, no explanation.

Schema:
[{
  "question": "string",
  "options": ["A", "B", "C", "D"],
  "correctIndex": 0,
  "explanation": "Why this answer is correct (in ${language === 'tr' ? 'Turkish' : 'English'})",
  "hint": "A subtle hint without giving away the answer",
  "grammar_point": "The specific grammar/vocabulary concept being tested"
}]
`;

    try {
      if (!this.apiKeyConfigured) {
        LoggerUtil.logInfo(this.logger, 'generateQuizQuestions', 'Using mock data (API key not configured)');
        return this.getMockQuestions(topic, count);
      }

      LoggerUtil.logGeminiRequest(this.logger, 'generateQuizQuestions', { topic, cefrLevel, count }, this.modelName);
      const result = await this.model.generateContent(prompt);
      const text = result.response.text().trim();
      LoggerUtil.logGeminiResponse(this.logger, 'generateQuizQuestions', text.length);
      // Strip markdown code blocks if present
      const json = text.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
      return JSON.parse(json) as QuizQuestion[];
    } catch (err: any) {
      LoggerUtil.logGeminiError(this.logger, 'generateQuizQuestions', err, { topic, cefrLevel, count });
      this.logger.warn(`Falling back to mock data. Original error: ${err?.message}`);
      return this.getMockQuestions(topic, count);
    }
  }

  async analyzeAnswer(params: {
    question: string;
    correctAnswer: string;
    userAnswer: string;
    cefrLevel: string;
    language: 'en' | 'tr';
  }): Promise<AnswerAnalysis> {
    const { question, correctAnswer, userAnswer, cefrLevel, language } = params;
    const isCorrect = correctAnswer === userAnswer;

    const prompt = `
You are an empathetic English teacher using the Socratic method.

Question: "${question}"
Correct answer: "${correctAnswer}"
Student's answer: "${userAnswer}"
Student level: ${cefrLevel}

The student answered ${isCorrect ? 'correctly' : 'incorrectly'}.

${!isCorrect ? `
Guide them to understand WHY they were wrong using questions, not direct answers.
- Ask 1-2 leading questions that help them discover the rule
- Then give a brief, clear explanation
` : `
Reinforce what they did right and add an interesting related fact.
`}

Respond in ${language === 'tr' ? 'Turkish' : 'English'}.
Return ONLY valid JSON, no markdown:
{
  "isCorrect": ${isCorrect},
  "feedback": "Your main feedback message",
  "socraticQuestions": ["Question 1 to guide thinking", "Question 2 (optional)"],
  "rule": "The grammar/vocabulary rule in one sentence",
  "example": "An example sentence showing correct usage",
  "xpEarned": ${isCorrect ? 10 : 3}
}
`;

    try {
      if (!this.apiKeyConfigured) {
        LoggerUtil.logInfo(this.logger, 'analyzeAnswer', 'Using mock analysis (API key not configured)');
        return {
          isCorrect,
          feedback: isCorrect ? '👍 Doğru!' : '❌ Biraz daha çalış.',
          socraticQuestions: [],
          rule: '',
          example: '',
          xpEarned: isCorrect ? 10 : 3,
        };
      }

      LoggerUtil.logGeminiRequest(this.logger, 'analyzeAnswer', { cefrLevel, isCorrect }, this.modelName);
      const result = await this.model.generateContent(prompt);
      const text = result.response.text().trim();
      LoggerUtil.logGeminiResponse(this.logger, 'analyzeAnswer', text.length);
      const json = text.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
      return JSON.parse(json) as AnswerAnalysis;
    } catch (err: any) {
      LoggerUtil.logGeminiError(this.logger, 'analyzeAnswer', err, { cefrLevel, isCorrect });
      this.logger.warn(`Falling back to basic feedback. Original error: ${err?.message}`);
      return {
        isCorrect,
        feedback: isCorrect ? '👍 Doğru!' : '❌ Biraz daha çalış.',
        socraticQuestions: [],
        rule: '',
        example: '',
        xpEarned: isCorrect ? 10 : 3,
      };
    }
  }

  async *streamLessonChat(params: {
    messages: Array<{ role: 'user' | 'model'; content: string }>;
    topic: string;
    cefrLevel: string;
    language: 'en' | 'tr';
  }): AsyncGenerator<string> {
    const { messages, topic, cefrLevel, language } = params;

    try {
      if (!this.apiKeyConfigured) {
        LoggerUtil.logInfo(this.logger, 'streamLessonChat', 'Using mock streaming (API key not configured)');
        yield `Mock response: Bu ${topic} konusunu ${cefrLevel} seviyesinde öğreniyorsun.`;
        return;
      }

      const systemContext = `
### ROLE
You are a highly professional AI English Tutor specialized in teaching students at the ${cefrLevel} level. Your goal is to help the student master the topic: "${topic}".

### COMMUNICATION RULES
1. Meta-explanations (grammar rules, complex definitions): Always in ${language === 'tr' ? 'Turkish' : 'English'}.
2. Target language practice (examples, conversation): Always in English, using vocabulary suitable for ${cefrLevel}.
3. Tone: Encouraging, patient, and educational.

### TEACHING PROTOCOL
#### PHASE 1: The Initial Lecture (First Message Only)
When the conversation starts, do not wait for the student. Immediately provide:
- A warm greeting.
- A detailed but simple explanation of "${topic}" in English, followed by a Turkish summary.
- 3 clear example sentences.
- End with a simple question to check the student's understanding.

#### PHASE 2: Conversational Practice (Ongoing)
Once the student replies, transition into a conversational tutor:
- Keep your responses concise (3-5 sentences).
- If the student makes a mistake, gently correct it in Turkish and explain why.
- Always end your response with an open-ended question to keep the conversation flowing.

### CONSTRAINTS
- Do not use overly complex jargon.
- If the student is A2, stick to the most common 2000 English words.
- Never provide the full answer immediately; guide the student to find it.
`;

      const history = messages.slice(0, -1).map(m => ({
        role: m.role,
        parts: [{ text: m.content }],
      }));

      LoggerUtil.logGeminiRequest(this.logger, 'streamLessonChat', { topic, cefrLevel, messageCount: messages.length }, this.modelName);
      const chat = this.streamingModel.startChat({
        history: [
          { role: 'user', parts: [{ text: systemContext }] },
          { role: 'model', parts: [{ text: 'Understood. I am ready to teach.' }] },
          ...history,
        ],
      });

      const lastMessage = messages[messages.length - 1];
      const result = await chat.sendMessageStream(lastMessage.content);

      for await (const chunk of result.stream) {
        yield chunk.text();
      }
      LoggerUtil.logInfo(this.logger, 'streamLessonChat', 'Stream completed');
    } catch (err: any) {
      LoggerUtil.logGeminiError(this.logger, 'streamLessonChat', err, { topic, cefrLevel });
      yield `Hata oluştu: ${err?.message}. Lütfen daha sonra tekrar deneyin.`;
    }
  }

  async generateLearningPath(params: {
    cefrLevel: string;
    interests: string[];
    completedTopics: string[];
    language: 'en' | 'tr';
  }): Promise<LearningPathItem[]> {
    const { cefrLevel, interests, completedTopics, language } = params;

    const prompt = `
Create a personalized English learning path.
Level: ${cefrLevel}
Interests: ${interests.join(', ')}
Already completed: ${completedTopics.join(', ') || 'none'}

Return ONLY a JSON array of 6 recommended topics:
[{
  "topicName": "string",
  "category": "grammar|vocabulary|conversation|business|writing",
  "reason": "Why this is recommended for this user (in ${language === 'tr' ? 'Turkish' : 'English'})",
  "estimatedMinutes": 15,
  "difficulty": "easy|medium|hard"
}]
`;

    try {
      if (!this.apiKeyConfigured) {
        LoggerUtil.logInfo(this.logger, 'generateLearningPath', 'Using mock path (API key not configured)');
        return [];
      }

      LoggerUtil.logGeminiRequest(this.logger, 'generateLearningPath', { cefrLevel, interests: interests.length }, this.modelName);
      const result = await this.model.generateContent(prompt);
      const text = result.response.text().trim();
      LoggerUtil.logGeminiResponse(this.logger, 'generateLearningPath', text.length);
      const json = text.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
      return JSON.parse(json) as LearningPathItem[];
    } catch (err: any) {
      LoggerUtil.logGeminiError(this.logger, 'generateLearningPath', err, { cefrLevel, interests: interests.length });
      this.logger.warn(`Returning empty learning path. Error: ${err?.message}`);
      return [];
    }
  }

  private getMockQuestions(topic: string, count: number): QuizQuestion[] {
    return Array.from({ length: count }, (_, i) => ({
      question: `Sample question ${i + 1} about ${topic}`,
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correctIndex: 0,
      explanation: 'This is the correct answer because...',
      hint: 'Think about the rule for...',
      grammar_point: topic,
    }));
  }
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  hint: string;
  grammar_point: string;
}

export interface AnswerAnalysis {
  isCorrect: boolean;
  feedback: string;
  socraticQuestions: string[];
  rule: string;
  example: string;
  xpEarned: number;
}

export interface LearningPathItem {
  topicName: string;
  category: string;
  reason: string;
  estimatedMinutes: number;
  difficulty: 'easy' | 'medium' | 'hard';
}
