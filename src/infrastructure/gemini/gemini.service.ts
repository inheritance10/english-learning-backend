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

  // ─────────────────────────────────────────────────────────────────────────
  // WRITING ACTIVITY
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Generate a writing scenario for any of the 6 activity types.
   * The JSON shape is always the same; prompt content differs per type.
   *
   * Field semantics per type:
   *  mail    → receivedMail = inbox email text
   *  picture → receivedMail = vivid scene description (no real image needed)
   *  social  → receivedMail = context card (what happened)
   *  chat    → receivedMail = chat conversation (formatted as lines: "Alex: ...")
   *  journal → receivedMail = reflective prompt question
   *  whatif  → receivedMail = hypothetical scenario question
   */
  async generateWritingScenario(params: {
    cefrLevel: string;
    interest: string;
    interestLabel: string;
    language: 'en' | 'tr';
    activityType?: string;
  }): Promise<{
    scenario: string;
    receivedMail: string;
    keyPoints: string[];
    initialHint: string;
  }> {
    const { cefrLevel, interest, interestLabel, language, activityType = 'mail' } = params;
    const seed = Math.random().toString(36).slice(2, 8).toUpperCase();
    const uiLang = language === 'tr' ? 'Turkish' : 'English';

    const prompt = this.buildWritingPrompt({
      activityType,
      cefrLevel,
      interest,
      interestLabel,
      uiLang,
      seed,
    });

    try {
      if (!this.apiKeyConfigured) {
        return this.getMockWritingScenario(interest, cefrLevel, language, activityType);
      }

      LoggerUtil.logGeminiRequest(this.logger, 'generateWritingScenario', { cefrLevel, interest, activityType }, this.modelName);
      const result = await this.model.generateContent(prompt);
      const text = result.response.text().trim();
      LoggerUtil.logGeminiResponse(this.logger, 'generateWritingScenario', text.length);

      const json = text.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
      const parsed = JSON.parse(json);

      return {
        scenario: String(parsed.scenario ?? ''),
        receivedMail: String(parsed.receivedMail ?? ''),
        keyPoints: Array.isArray(parsed.keyPoints)
          ? parsed.keyPoints.slice(0, 3).map((k: any) => String(k))
          : [],
        initialHint: String(parsed.initialHint ?? ''),
      };
    } catch (err: any) {
      LoggerUtil.logGeminiError(this.logger, 'generateWritingScenario', err, { cefrLevel, interest, activityType });
      this.logger.warn(`Falling back to mock writing scenario (type=${activityType}). Error: ${err?.message}`);
      return this.getMockWritingScenario(interest, cefrLevel, language, activityType);
    }
  }

  /** Build a type-specific Gemini prompt. All types return the same JSON shape. */
  private buildWritingPrompt(p: {
    activityType: string;
    cefrLevel: string;
    interest: string;
    interestLabel: string;
    uiLang: string;
    seed: string;
  }): string {
    const { activityType, cefrLevel, interest, interestLabel, uiLang, seed } = p;
    const BASE = `Unique session ID (forces variety, do not include in output): ${seed}\n\nReturn ONLY valid JSON, no markdown, no commentary:\n{\n  "scenario": "string in ${uiLang}",\n  "receivedMail": "string",\n  "keyPoints": ["string in ${uiLang}", "string in ${uiLang}", "string in ${uiLang}"],\n  "initialHint": "string in English"\n}`;

    switch (activityType) {
      case 'mail':
        return `You are an expert English writing coach creating a "Reply to an Email" exercise for a CEFR ${cefrLevel} learner interested in "${interest}" (${interestLabel}).
${seed}
- "receivedMail": a realistic incoming email (60-90 words in English, ${cefrLevel} complexity). Greeting + clear request + sign-off.
- "scenario": 1-sentence task description in ${uiLang}.
- "keyPoints": exactly 3 action items the user must address, in ${uiLang}, max 7 words each.
- "initialHint": one English sentence-starter, e.g. "Thank you for your email regarding…"
${BASE}`;

      case 'picture':
        return `You are an English writing coach creating a "Describe the Scene" exercise for a CEFR ${cefrLevel} learner interested in "${interest}" (${interestLabel}).
${seed}
- "receivedMail": a vivid text description of an imaginary scene/photo related to "${interest}" (50-80 words). Describe objects, colours, positions and what is happening. The learner will read this and write their own description paragraph.
- "scenario": 1-sentence task in ${uiLang}, e.g. "Aşağıdaki sahneyi İngilizce olarak betimle."
- "keyPoints": 3 checklist items in ${uiLang}: mention 3 objects, use Present Continuous for 2 actions, include 1 location/position phrase.
- "initialHint": English sentence starter, e.g. "In this scene, I can see…"
${BASE}`;

      case 'social':
        return `You are an English writing coach creating a "Social Media Caption" exercise for a CEFR ${cefrLevel} learner interested in "${interest}" (${interestLabel}).
${seed}
- "receivedMail": a short context card describing WHAT just happened related to "${interest}" (30-50 words, in English). E.g. "You just received the latest smartphone as a gift. You're at home unboxing it, excited to share it with your followers."
- "scenario": 1-sentence task in ${uiLang} telling the learner to write a 280-char tweet or Instagram caption.
- "keyPoints": 3 checklist items in ${uiLang}: max 280 characters, at least 2 hashtags, catchy/informal tone.
- "initialHint": short English caption starter, e.g. "Just unboxed my…"
${BASE}`;

      case 'chat':
        return `You are an English writing coach creating a "Chat Dialogue Completion" exercise for a CEFR ${cefrLevel} learner interested in "${interest}" (${interestLabel}).
${seed}
- "receivedMail": a short WhatsApp/SMS conversation (3-5 messages) ending with a message the user must reply to. Format each line as "Name: message". Theme: "${interest}". The user needs to decline/accept/suggest something politely.
- "scenario": 1-sentence task in ${uiLang}, e.g. "Arkadaşın seni bir etkinliğe davet etti. Kibarca reddet ve alternatif öner."
- "keyPoints": 3 checklist items in ${uiLang}: politely decline/accept, give a reason, suggest an alternative.
- "initialHint": English sentence starter, e.g. "Hey! That sounds great, but…"
${BASE}`;

      case 'journal':
        return `You are an English writing coach creating a "Daily Journal" exercise for a CEFR ${cefrLevel} learner interested in "${interest}" (${interestLabel}).
${seed}
- "receivedMail": a reflective journaling prompt question in English, related to "${interest}" (1-2 sentences that spark personal reflection). E.g. "Think about the last time something in your daily life surprised you. What happened and how did you feel?"
- "scenario": 1-sentence task in ${uiLang} asking user to write 3-5 sentences about a personal experience.
- "keyPoints": 3 checklist items in ${uiLang}: use Past Simple tense, express a feeling/emotion, write at least 3 sentences.
- "initialHint": English diary entry starter, e.g. "Yesterday, I…" or "Today was interesting because…"
${BASE}`;

      case 'whatif':
        return `You are an English writing coach creating a "What If…?" creative exercise for a CEFR ${cefrLevel} learner interested in "${interest}" (${interestLabel}).
${seed}
- "receivedMail": a creative hypothetical scenario question in English related to "${interest}" (1-2 sentences). Use "What if…" or "Imagine that…". Make it fun and thought-provoking. E.g. "What if you could travel back in time to any moment in the history of technology? Where would you go and why?"
- "scenario": 1-sentence task in ${uiLang} asking user to answer the what-if question creatively.
- "keyPoints": 3 checklist items in ${uiLang}: use conditional (If I were…/If I had…), give at least 2 reasons, be creative and specific.
- "initialHint": English conditional starter, e.g. "If I could…, I would…"
${BASE}`;

      default:
        return this.buildWritingPrompt({ ...p, activityType: 'mail' });
    }
  }

  /**
   * Analyze the user's written reply and return an improved "native" version
   * with highlighted key changes and a pro-tip.
   */
  async analyzeWriting(params: {
    userText: string;
    scenario: string;
    receivedMail: string;
    cefrLevel: string;
    language: 'en' | 'tr';
  }): Promise<{
    improved: string;
    proTip: string;
    highlightedPhrases: string[];
  }> {
    const { userText, scenario, receivedMail, cefrLevel, language } = params;
    const uiLang = language === 'tr' ? 'Turkish' : 'English';

    const prompt = `
You are Octo, a friendly English writing mentor. A learner at CEFR level ${cefrLevel} has written the following reply to an email.

SCENARIO: ${scenario}

ORIGINAL EMAIL RECEIVED:
"""
${receivedMail}
"""

USER'S REPLY (what they wrote):
"""
${userText}
"""

YOUR TASK:
1. Rewrite the user's reply as a natural, native-sounding English response — keep their intended meaning but fix grammar, word choice, register and flow. Max 150 words.
2. Write a short "proTip" in ${uiLang} (1-2 sentences) highlighting ONE specific improvement area (e.g. formal register, transition words, politeness markers). Make it encouraging and specific.
3. List 3-5 short phrases (exact sub-strings from YOUR improved version) that represent meaningful upgrades. These will be highlighted in green in the UI.

Return ONLY valid JSON, no markdown, no commentary:
{
  "improved": "The naturally rewritten reply in English.",
  "proTip": "Encouraging tip in ${uiLang}.",
  "highlightedPhrases": ["phrase1 from improved", "phrase2 from improved", "phrase3 from improved"]
}
`;

    try {
      if (!this.apiKeyConfigured) {
        return this.getMockWritingAnalysis(userText);
      }

      LoggerUtil.logGeminiRequest(this.logger, 'analyzeWriting', { cefrLevel }, this.modelName);
      const result = await this.model.generateContent(prompt);
      const text = result.response.text().trim();
      LoggerUtil.logGeminiResponse(this.logger, 'analyzeWriting', text.length);

      const json = text.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
      const parsed = JSON.parse(json);

      return {
        improved: String(parsed.improved ?? ''),
        proTip: String(parsed.proTip ?? ''),
        highlightedPhrases: Array.isArray(parsed.highlightedPhrases)
          ? parsed.highlightedPhrases.map((p: any) => String(p))
          : [],
      };
    } catch (err: any) {
      LoggerUtil.logGeminiError(this.logger, 'analyzeWriting', err, { cefrLevel });
      this.logger.warn(`Falling back to mock writing analysis. Error: ${err?.message}`);
      return this.getMockWritingAnalysis(userText);
    }
  }

  private getMockWritingScenario(
    interest: string,
    cefrLevel: string,
    language: 'en' | 'tr',
    activityType = 'mail',
  ): { scenario: string; receivedMail: string; keyPoints: string[]; initialHint: string } {
    const isTr = language === 'tr';

    const mocks: Record<string, { scenario: string; receivedMail: string; keyPoints: string[]; initialHint: string }> = {
      mail: {
        scenario: isTr
          ? 'Bir iş arkadaşın sana toplantı talebi gönderdi. İngilizce olarak yanıt yaz.'
          : 'A colleague sent you a meeting request. Write a reply in English.',
        receivedMail:
          `Hi,\n\nI hope you're doing well! I wanted to check if you're available for a quick ` +
          `30-minute sync on Thursday at 2 PM to discuss the upcoming ${interest} project.\n\n` +
          `Could you let me know if that time works for you? Also, would you prefer to meet ` +
          `in the conference room or online?\n\nLooking forward to your reply!\n\nBest,\nAlex`,
        keyPoints: isTr
          ? ['Toplantı saatini onayla', 'Toplantı yerini / online seçeneğini sor veya belirt', 'Teşekkür et']
          : ['Confirm the meeting time', 'Confirm location or online option', 'Thank the sender'],
        initialHint: 'Thank you for reaching out. I would be happy to...',
      },

      picture: {
        scenario: isTr
          ? 'Aşağıdaki sahneyi en az 3 nesne ve 2 eylem içerecek şekilde İngilizce betimle.'
          : 'Describe the scene below with at least 3 objects and 2 actions in English.',
        receivedMail:
          `A busy coffee shop on a rainy afternoon. Near the window, a young woman in a red coat is typing on her laptop. ` +
          `Next to her, two friends are laughing and sharing a piece of cake. A barista behind the counter is pouring ` +
          `steaming milk into a tall glass. On the walls, there are black-and-white photos of the city. ` +
          `The floor is wooden and slightly wet from people coming in from the rain.`,
        keyPoints: isTr
          ? ['En az 3 nesne belirt', '2 eylem için Present Continuous kullan', 'Yer/konum ifadesi ekle']
          : ['Mention at least 3 objects', 'Use Present Continuous for 2 actions', 'Include a location/position phrase'],
        initialHint: 'In this scene, I can see...',
      },

      social: {
        scenario: isTr
          ? 'Az önce harika bir şey yaşadın. Bunun için etkileyici bir sosyal medya paylaşımı yaz (max 280 karakter).'
          : 'You just experienced something great. Write an engaging social media post (max 280 chars).',
        receivedMail:
          `You just finished a ${interest}-themed online course and received your certificate. ` +
          `You're proud of yourself and want to inspire your followers to learn new skills too.`,
        keyPoints: isTr
          ? ['Maksimum 280 karakter', 'En az 2 hashtag ekle', 'Kısa, etkileyici ve günlük dil kullan']
          : ['Max 280 characters', 'Include at least 2 hashtags', 'Short, catchy and informal tone'],
        initialHint: 'Just completed my...',
      },

      chat: {
        scenario: isTr
          ? 'Arkadaşın seni bir etkinliğe davet etti. Kibarca reddet ve alternatif öner.'
          : 'Your friend invited you to an event. Politely decline and suggest an alternative.',
        receivedMail:
          `Sam: Hey! Are you free this Saturday evening? 🎉\n` +
          `You: I'm not sure yet, what's up?\n` +
          `Sam: We're having a ${interest} meetup at the community centre — games, snacks, the whole deal! You should totally come.\n` +
          `Sam: It starts at 7 PM. Would be so fun if you came! 😊`,
        keyPoints: isTr
          ? ['Kibarca reddet', 'Makul bir bahane yaz', 'Alternatif bir buluşma öner']
          : ['Politely decline the invitation', 'Give a believable reason', 'Suggest an alternative'],
        initialHint: 'Hey! That sounds amazing, but unfortunately...',
      },

      journal: {
        scenario: isTr
          ? 'Bugün seni etkileyen bir anı geçmiş zamanı kullanarak 3-5 cümlede İngilizce anlat.'
          : 'Write 3-5 sentences in English about a moment that affected you today. Use Past Simple.',
        receivedMail:
          `Think about the last time you learned or discovered something new related to ${interest}. ` +
          `What happened exactly? How did you feel in that moment, and what did you take away from it?`,
        keyPoints: isTr
          ? ['Past Simple (geçmiş zaman) kullan', 'Bir duygu veya tepki ifade et', 'En az 3 cümle yaz']
          : ['Use Past Simple tense throughout', 'Express a feeling or reaction', 'Write at least 3 sentences'],
        initialHint: 'Yesterday, I...',
      },

      whatif: {
        scenario: isTr
          ? 'Aşağıdaki "ya olsaydı?" sorusunu koşul cümlesi kullanarak yaratıcı bir şekilde yanıtla.'
          : 'Answer the "what if?" question below creatively, using conditional sentences.',
        receivedMail:
          `What if you were given unlimited funding to build a ${interest}-focused startup or project? ` +
          `What would you create, who would it help, and what would your first step be?`,
        keyPoints: isTr
          ? ['Koşul cümlesi kullan (If I were / If I had)', 'En az 2 neden veya detay ver', 'Yaratıcı ve özgün ol']
          : ['Use conditional (If I were… / If I had…)', 'Give at least 2 reasons or details', 'Be creative and specific'],
        initialHint: 'If I had the chance, I would...',
      },
    };

    return mocks[activityType] ?? mocks['mail'];
  }

  private getMockWritingAnalysis(
    userText: string,
  ): { improved: string; proTip: string; highlightedPhrases: string[] } {
    return {
      improved:
        `Thank you for reaching out. Thursday at 2 PM works perfectly for me.\n\n` +
        `Regarding the venue, I would prefer to meet online via video call, as it will be ` +
        `more convenient for both of us. Please feel free to send me the meeting link whenever you're ready.\n\n` +
        `Looking forward to our discussion!\n\nBest regards`,
      proTip:
        'Harika bir başlangıç! Resmi e-postalarda "I would prefer" veya "I would be happy to" gibi kalıplar çok daha kibar ve doğal bir ton yaratır.',
      highlightedPhrases: [
        'Thank you for reaching out',
        'works perfectly for me',
        'I would prefer to meet online',
        'Please feel free to send me',
        'Looking forward to our discussion',
      ],
    };
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
