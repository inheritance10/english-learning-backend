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

  async defineWord(params: {
    word: string;
    context?: string;
    cefrLevel: string;
    language: 'en' | 'tr';
  }): Promise<import('../../application/ai/use-cases/define-word.use-case').WordDefinition> {
    const { word, context, cefrLevel, language } = params;

    const prompt = `
You are a dictionary and English teacher. Define the word "${word}" for a ${cefrLevel} level English learner.
${context ? `Context sentence where the word appears: "${context}"` : ''}

Return ONLY valid JSON, no markdown:
{
  "word": "${word}",
  "phonetic": "IPA phonetic (e.g. /wɜːrd/)",
  "partOfSpeech": "noun|verb|adjective|adverb|preposition|conjunction|etc",
  "definition": "Clear definition in English (suitable for ${cefrLevel} level)",
  "translation": "Translation in ${language === 'tr' ? 'Turkish' : 'English'}",
  "exampleSentence": "A natural example sentence using the word",
  "exampleTranslation": "Translation of the example sentence in ${language === 'tr' ? 'Turkish' : 'English'}"
}
`;

    try {
      if (!this.apiKeyConfigured) {
        return {
          word,
          phonetic: '',
          partOfSpeech: 'word',
          definition: `Definition of "${word}" (mock - API key not configured)`,
          translation: `"${word}" kelimesinin çevirisi`,
          exampleSentence: `This is an example sentence with ${word}.`,
          exampleTranslation: `Bu ${word} kelimesini içeren örnek bir cümledir.`,
        };
      }

      LoggerUtil.logGeminiRequest(this.logger, 'defineWord', { word, cefrLevel }, this.modelName);
      const result = await this.model.generateContent(prompt);
      const text = result.response.text().trim();
      const json = text.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
      return JSON.parse(json);
    } catch (err: any) {
      LoggerUtil.logGeminiError(this.logger, 'defineWord', err, { word, cefrLevel });
      return {
        word,
        phonetic: '',
        partOfSpeech: 'word',
        definition: `Could not load definition for "${word}"`,
        translation: `"${word}" çevirisi yüklenemedi`,
        exampleSentence: '',
        exampleTranslation: '',
      };
    }
  }

  async generateDailyStory(params: {
    words: string[];
    cefrLevel: string;
    language: 'en' | 'tr';
    userInterests: string[];
  }): Promise<{ title: string; content: string; wordHighlights: string[] }> {
    const { words, cefrLevel, language, userInterests } = params;
    const wordList = words.join(', ');
    const interestCtx = userInterests.length > 0
      ? `The user is interested in: ${userInterests.join(', ')}.`
      : '';

    const prompt = `
You are a creative English teacher. Create a short, fun, and engaging daily story for an English learner at ${cefrLevel} level.

Requirements:
- The story MUST naturally include ALL of these words: ${wordList}
- ${interestCtx} Make the story relevant to these interests if possible.
- Length: 80-120 words — short enough to read in 1 minute
- Use simple vocabulary appropriate for ${cefrLevel}
- Make it fun and memorable (can be slightly humorous)
- Write the story in English
- Provide a ${language === 'tr' ? 'Turkish' : 'English'} title

Return ONLY valid JSON, no markdown:
{
  "title": "Story title in ${language === 'tr' ? 'Turkish' : 'English'}",
  "content": "The full story in English",
  "wordHighlights": ["list", "of", "the", "target", "words", "actually", "used"]
}
`;

    try {
      if (!this.apiKeyConfigured) {
        return {
          title: 'Günün Hikayesi',
          content: `Bu kelimelerle ilgili bir hikaye: ${wordList}. (Mock - API key not configured)`,
          wordHighlights: words,
        };
      }

      LoggerUtil.logGeminiRequest(this.logger, 'generateDailyStory', { wordCount: words.length, cefrLevel }, this.modelName);
      const result = await this.model.generateContent(prompt);
      const text = result.response.text().trim();
      LoggerUtil.logGeminiResponse(this.logger, 'generateDailyStory', text.length);
      const json = text.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
      return JSON.parse(json);
    } catch (err: any) {
      LoggerUtil.logGeminiError(this.logger, 'generateDailyStory', err, { wordCount: words.length });
      return {
        title: 'Günün Hikayesi',
        content: `Today's words: ${wordList}`,
        wordHighlights: words,
      };
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

  async generateQuestionVariant(original: {
    content: string;
    options: string[];
    correctIndex: number;
    explanation?: string;
    difficultyLevel?: string;
    topicTag?: string;
  }): Promise<{ content: string; options: string[]; correctIndex: number; explanation: string }> {
    const prompt = `You are an English exam question writer.
Below is an original exam question. Create a NEW similar question that:
- Tests the SAME grammar/vocabulary concept: "${original.topicTag ?? 'general English'}"
- Has the SAME difficulty level: "${original.difficultyLevel ?? 'medium'}"
- Uses a COMPLETELY DIFFERENT scenario, context and vocabulary
- Has exactly 4 answer options (A, B, C, D format)

ORIGINAL QUESTION:
${original.content}
Options: ${original.options.join(' | ')}
Correct answer index: ${original.correctIndex}

Return ONLY valid JSON in this exact format, no markdown, no extra text:
{"content":"<question text>","options":["A) ...","B) ...","C) ...","D) ..."],"correctIndex":<0-3>,"explanation":"<why the answer is correct>"}`;

    try {
      const result = await this.model.generateContent(prompt);
      const text = result.response.text().trim();
      // Strip markdown code blocks if present
      const json = text.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
      return JSON.parse(json);
    } catch (err) {
      this.logger.warn('generateQuestionVariant failed, returning mock variant');
      // Mock fallback
      return {
        content: `[Similar question for: ${original.topicTag ?? 'grammar'}] ${original.content.substring(0, 60)}...`,
        options: original.options,
        correctIndex: original.correctIndex,
        explanation: original.explanation ?? 'Please review the grammar rule.',
      };
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

  // ─── Reading Activity ────────────────────────────────────────────────────
  /**
   * Generate a personalized "Active Reading" activity:
   * a short reading passage matched to the learner's level + interest,
   * plus a small set of comprehension questions (mix of true/false and multi).
   */
  async generateReadingActivity(params: {
    cefrLevel: string;
    interest: string; // e.g. 'technology' | 'travel' ...
    interestLabel: string; // localized display label (e.g. 'Teknoloji')
    language: 'en' | 'tr';
  }): Promise<{
    title: string;
    topicLabel: string;
    content: string;
    highlightedWords: string[];
    questions: Array<{
      type: 'true-false' | 'multi';
      question: string;
      options: string[];
      correctIndex: number;
      explanation?: string;
    }>;
  }> {
    const { cefrLevel, interest, interestLabel, language } = params;
    const seed = Math.random().toString(36).slice(2, 8).toUpperCase();
    const uiLang = language === 'tr' ? 'Turkish' : 'English';

    const prompt = `
You are an expert English teacher creating a personalized "Active Reading" activity
for a learner at CEFR level ${cefrLevel} interested in "${interest}".

Unique session ID (forces variety, do not include in output): ${seed}

REQUIREMENTS:
1. Reading body MUST be in ENGLISH and tailored for ${cefrLevel}.
2. Length: 90-140 words, organized in 3 short paragraphs separated by a blank line.
3. Topic must clearly relate to "${interest}". Make it engaging and modern.
4. Title is the headline of the article — short and catchy. Provide it in ${uiLang}.
5. Topic label is the broad category in UPPERCASE in ${uiLang}, e.g. "TEKNOLOJİ".
6. Pick 4-6 KEY vocabulary words from the body that the learner should focus on
   (single words, lowercase, exactly as they appear in body). These will be
   visually highlighted in the UI. Avoid pronouns and very common stop-words.
7. Generate EXACTLY 3 comprehension questions:
   - 1 of type "true-false" (options ["True", "False"])
   - 2 of type "multi" with EXACTLY 3 options each
   The first question should test general comprehension (true/false).
   The other two should test detail/inference and vocabulary in context.
8. correctIndex MUST be a valid index into options.
9. Every "question" and every option must be SHORT (max ~12 words).
10. Provide each "explanation" in ${uiLang}, ONE short sentence.

Return ONLY valid JSON, no markdown, no commentary, with this EXACT shape:

{
  "title": "string (in ${uiLang})",
  "topicLabel": "string (UPPERCASE in ${uiLang})",
  "content": "Full reading body in English. Paragraphs separated by \\n\\n.",
  "highlightedWords": ["word1", "word2", "..."],
  "questions": [
    {
      "type": "true-false",
      "question": "Statement to evaluate (English)",
      "options": ["True", "False"],
      "correctIndex": 0,
      "explanation": "One short sentence in ${uiLang}."
    },
    {
      "type": "multi",
      "question": "English question",
      "options": ["A", "B", "C"],
      "correctIndex": 1,
      "explanation": "One short sentence in ${uiLang}."
    },
    {
      "type": "multi",
      "question": "English question",
      "options": ["A", "B", "C"],
      "correctIndex": 2,
      "explanation": "One short sentence in ${uiLang}."
    }
  ]
}
`;

    try {
      if (!this.apiKeyConfigured) {
        return this.getMockReadingActivity(interestLabel, cefrLevel);
      }

      LoggerUtil.logGeminiRequest(
        this.logger,
        'generateReadingActivity',
        { cefrLevel, interest },
        this.modelName,
      );
      const result = await this.model.generateContent(prompt);
      const text = result.response.text().trim();
      LoggerUtil.logGeminiResponse(this.logger, 'generateReadingActivity', text.length);
      const json = text.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
      const parsed = JSON.parse(json);

      // Defensive normalization — Gemini sometimes drifts from the schema.
      const normalize = (q: any): {
        type: 'true-false' | 'multi';
        question: string;
        options: string[];
        correctIndex: number;
        explanation?: string;
      } => {
        const type: 'true-false' | 'multi' =
          q.type === 'true-false' ? 'true-false' : 'multi';
        const options: string[] = Array.isArray(q.options) ? q.options.map((o: any) => String(o)) : [];
        const correctIndex =
          typeof q.correctIndex === 'number' &&
          q.correctIndex >= 0 &&
          q.correctIndex < options.length
            ? q.correctIndex
            : 0;
        return {
          type,
          question: String(q.question ?? ''),
          options,
          correctIndex,
          explanation: q.explanation ? String(q.explanation) : undefined,
        };
      };

      return {
        title: String(parsed.title ?? 'Reading'),
        topicLabel: String(parsed.topicLabel ?? interestLabel.toUpperCase()),
        content: String(parsed.content ?? ''),
        highlightedWords: Array.isArray(parsed.highlightedWords)
          ? parsed.highlightedWords.map((w: any) => String(w).toLowerCase())
          : [],
        questions: Array.isArray(parsed.questions) ? parsed.questions.map(normalize) : [],
      };
    } catch (err: any) {
      LoggerUtil.logGeminiError(this.logger, 'generateReadingActivity', err, {
        cefrLevel,
        interest,
      });
      this.logger.warn(`Falling back to mock reading activity. Error: ${err?.message}`);
      return this.getMockReadingActivity(interestLabel, cefrLevel);
    }
  }

  private getMockReadingActivity(
    interestLabel: string,
    cefrLevel: string,
  ): {
    title: string;
    topicLabel: string;
    content: string;
    highlightedWords: string[];
    questions: Array<{
      type: 'true-false' | 'multi';
      question: string;
      options: string[];
      correctIndex: number;
      explanation?: string;
    }>;
  } {
    return {
      title: `${interestLabel} & The Future`,
      topicLabel: interestLabel.toUpperCase(),
      content:
        `Artificial intelligence is changing the way we live and work. ` +
        `Many people now use convenient AI tools for daily tasks like writing emails or planning trips.\n\n` +
        `Companies invest in machine learning to improve their products. As technology grows, ` +
        `communication between humans and machines becomes faster and more natural.\n\n` +
        `Although AI is helpful, we still need to understand its limits at the ${cefrLevel} level. ` +
        `Used wisely, it can make our future easier and more creative.`,
      highlightedWords: ['artificial', 'convenient', 'machine', 'communication', 'technology'],
      questions: [
        {
          type: 'true-false',
          question: 'AI tools can help us with daily tasks.',
          options: ['True', 'False'],
          correctIndex: 0,
          explanation: 'Metinde günlük görevlerde yardımcı oldukları belirtiliyor.',
        },
        {
          type: 'multi',
          question: 'What does "convenient" mean here?',
          options: ['Useful and easy', 'Expensive', 'Dangerous'],
          correctIndex: 0,
          explanation: '"Convenient" = kullanışlı / uygun.',
        },
        {
          type: 'multi',
          question: 'Why do companies invest in machine learning?',
          options: ['To pay less tax', 'To improve products', 'To stop AI'],
          correctIndex: 1,
          explanation: 'Metin ürünleri geliştirmek için yatırım yapıldığını söylüyor.',
        },
      ],
    };
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
