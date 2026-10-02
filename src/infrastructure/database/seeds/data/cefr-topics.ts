// Grammar topics A1–C2. Grouped from the CEFR-J Grammar Profile (csvIds → backend/cefrj-grammar-profile-20180315.csv),
// levels cross-checked with the English Grammar Profile and the British Council/EAQUALS Core Inventory.
// C2 items have no CEFR-J rows (csvIds empty) and come from the English Grammar Profile.

export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export interface CefrTopicSeed {
  level: CefrLevel;
  name: string;
  nameTr: string;
  example: string;
  csvIds: string[];
}

export const CEFR_TOPICS: CefrTopicSeed[] = [
  // ── A1 ──────────────────────────────────────────────────────────────────
  { level: 'A1', name: 'Verb "to be" (am / is / are)', nameTr: '"To be" fiili (am / is / are)', example: 'She is a teacher.', csvIds: ['1', '2', '3', '4', '5', '10', '58'] },
  { level: 'A1', name: 'Subject & object pronouns', nameTr: 'Özne ve nesne zamirleri', example: 'He likes her.', csvIds: ['7'] },
  { level: 'A1', name: 'Possessive adjectives & possessive \'s', nameTr: 'İyelik sıfatları ve \'s eki', example: 'This is my brother\'s car.', csvIds: ['6'] },
  { level: 'A1', name: 'This / that / these / those', nameTr: 'This / that / these / those', example: 'Those shoes are nice.', csvIds: ['8', '9', '11', '12'] },
  { level: 'A1', name: 'Articles: a / an / the', nameTr: 'Tanımlıklar: a / an / the', example: 'I saw a dog. The dog was big.', csvIds: ['13', '14'] },
  { level: 'A1', name: 'Singular & plural nouns', nameTr: 'Tekil ve çoğul isimler', example: 'One child, two children.', csvIds: [] },
  { level: 'A1', name: 'Countable & uncountable nouns: some / any', nameTr: 'Sayılabilen/sayılamayan isimler: some / any', example: 'Is there any milk?', csvIds: ['15', '16'] },
  { level: 'A1', name: 'There is / there are', nameTr: 'There is / there are', example: 'There are two cats in the garden.', csvIds: ['146'] },
  { level: 'A1', name: 'Have / have got', nameTr: 'Have / have got (sahiplik)', example: 'I have got a sister.', csvIds: [] },
  { level: 'A1', name: 'Present simple', nameTr: 'Geniş zaman (Present Simple)', example: 'He works in a bank.', csvIds: ['59', '60'] },
  { level: 'A1', name: 'Present continuous', nameTr: 'Şimdiki zaman (Present Continuous)', example: 'They are playing football now.', csvIds: ['61'] },
  { level: 'A1', name: 'Adverbs of frequency', nameTr: 'Sıklık zarfları', example: 'I usually get up at seven.', csvIds: ['32', '35'] },
  { level: 'A1', name: 'Can / can\'t', nameTr: 'Can / can\'t (yetenek ve izin)', example: 'Can I open the window?', csvIds: ['123', '253'] },
  { level: 'A1', name: 'Imperatives & let\'s', nameTr: 'Emir cümleleri ve let\'s', example: 'Let\'s go to the park.', csvIds: ['117', '120'] },
  { level: 'A1', name: 'Prepositions of place & time (in / on / at)', nameTr: 'Yer ve zaman edatları (in / on / at)', example: 'The meeting is on Monday at 3.', csvIds: ['21'] },
  { level: 'A1', name: 'Wh- questions', nameTr: 'Soru kelimeleri (Wh- soruları)', example: 'Where do you live?', csvIds: ['235', '236', '239', '240', '245', '246', '247'] },
  { level: 'A1', name: 'Past simple of "be" (was / were)', nameTr: '"Be" fiilinin geçmişi (was / were)', example: 'We were at home yesterday.', csvIds: ['64'] },
  { level: 'A1', name: 'Like / love / hate + -ing', nameTr: 'Like / love / hate + -ing', example: 'I love swimming.', csvIds: ['112'] },
  { level: 'A1', name: 'Connectors: and / but / or / because', nameTr: 'Bağlaçlar: and / but / or / because', example: 'I was tired, but I went out.', csvIds: ['150'] },

  // ── A2 ──────────────────────────────────────────────────────────────────
  { level: 'A2', name: 'Past simple: regular & irregular verbs', nameTr: 'Geçmiş zaman: düzenli ve düzensiz fiiller', example: 'We went to Rome last year.', csvIds: ['65'] },
  { level: 'A2', name: 'Past continuous', nameTr: 'Geçmişte süreklilik (Past Continuous)', example: 'I was reading when you called.', csvIds: ['66'] },
  { level: 'A2', name: 'Past simple vs past continuous (when / while)', nameTr: 'Past Simple ile Past Continuous (when / while)', example: 'While she was cooking, the phone rang.', csvIds: ['66', '155'] },
  { level: 'A2', name: 'Future with "going to"', nameTr: '"Going to" ile gelecek zaman', example: 'I\'m going to visit my aunt.', csvIds: ['122'] },
  { level: 'A2', name: 'Future with "will"', nameTr: '"Will" ile gelecek zaman', example: 'I think it will rain.', csvIds: ['69', '141'] },
  { level: 'A2', name: 'Present continuous for future plans', nameTr: 'Gelecek planları için Present Continuous', example: 'We\'re meeting Tom on Friday.', csvIds: ['69'] },
  { level: 'A2', name: 'Present perfect: ever / never / just / already / yet', nameTr: 'Present Perfect: ever / never / just / already / yet', example: 'Have you ever been to Japan?', csvIds: ['62'] },
  { level: 'A2', name: 'Comparative adjectives', nameTr: 'Karşılaştırma sıfatları', example: 'My car is faster than yours.', csvIds: ['38', '39'] },
  { level: 'A2', name: 'Superlative adjectives', nameTr: 'Üstünlük sıfatları', example: 'It\'s the most beautiful city.', csvIds: ['40', '41'] },
  { level: 'A2', name: 'Quantifiers: much / many / a lot of / a few / a little', nameTr: 'Miktar belirteçleri: much / many / a lot of / a few / a little', example: 'There isn\'t much time.', csvIds: ['18', '19', '20'] },
  { level: 'A2', name: 'Possessive pronouns (mine, yours…)', nameTr: 'İyelik zamirleri (mine, yours…)', example: 'This bag is mine.', csvIds: ['22'] },
  { level: 'A2', name: 'Indefinite pronouns (something, anyone…)', nameTr: 'Belgisiz zamirler (something, anyone…)', example: 'Is anyone there?', csvIds: ['24', '25'] },
  { level: 'A2', name: 'Should / shouldn\'t for advice', nameTr: 'Tavsiye için should / shouldn\'t', example: 'You should see a doctor.', csvIds: ['139'] },
  { level: 'A2', name: 'Have to / must for obligation', nameTr: 'Zorunluluk: have to / must', example: 'I have to work tomorrow.', csvIds: ['127', '135'] },
  { level: 'A2', name: 'Polite requests & offers (would like, could you, shall I)', nameTr: 'Kibar rica ve teklifler (would like, could you, shall I)', example: 'Could you help me, please?', csvIds: ['142', '249', '250', '252', '254', '256', '257'] },
  { level: 'A2', name: 'Verb + to-infinitive / verb + -ing', nameTr: 'Fiil + to-infinitive / fiil + -ing', example: 'I want to learn. I enjoy learning.', csvIds: ['101', '105'] },
  { level: 'A2', name: 'Infinitive of purpose', nameTr: 'Amaç bildiren "to"', example: 'I went out to buy bread.', csvIds: ['88'] },
  { level: 'A2', name: 'First conditional', nameTr: 'Birinci tip koşul cümleleri', example: 'If it rains, we will stay home.', csvIds: ['156'] },
  { level: 'A2', name: 'Adverbs of manner', nameTr: 'Durum zarfları', example: 'She speaks slowly.', csvIds: [] },
  { level: 'A2', name: 'Common phrasal verbs', nameTr: 'Temel öbek fiiller (phrasal verbs)', example: 'Please turn off the light.', csvIds: ['55', '56'] },

  // ── B1 ──────────────────────────────────────────────────────────────────
  { level: 'B1', name: 'Present perfect vs past simple', nameTr: 'Present Perfect ile Past Simple', example: 'I have lost my keys. / I lost them yesterday.', csvIds: ['62'] },
  { level: 'B1', name: 'Present perfect continuous', nameTr: 'Present Perfect Continuous', example: 'I\'ve been waiting for an hour.', csvIds: ['63'] },
  { level: 'B1', name: 'Past perfect', nameTr: 'Past Perfect (geçmişin geçmişi)', example: 'The train had left when we arrived.', csvIds: ['67'] },
  { level: 'B1', name: 'Used to & would for past habits', nameTr: 'Geçmiş alışkanlıklar: used to & would', example: 'I used to play the piano.', csvIds: ['140'] },
  { level: 'B1', name: 'Future forms compared', nameTr: 'Gelecek zaman yapılarının karşılaştırılması', example: 'I\'m flying at 6. / I\'ll call you.', csvIds: ['69', '70'] },
  { level: 'B1', name: 'Modals of possibility: may / might / could', nameTr: 'Olasılık kipleri: may / might / could', example: 'It might snow tonight.', csvIds: ['124', '129', '132'] },
  { level: 'B1', name: 'Obligation & necessity: must / have to / need to / ought to', nameTr: 'Zorunluluk ve gereklilik: must / have to / need to / ought to', example: 'You don\'t need to come.', csvIds: ['127', '135', '136', '137'] },
  { level: 'B1', name: 'Ability: can / could / be able to', nameTr: 'Yetenek: can / could / be able to', example: 'I wasn\'t able to finish.', csvIds: ['121', '124'] },
  { level: 'B1', name: 'Zero & first conditionals', nameTr: 'Sıfır ve birinci tip koşul cümleleri', example: 'If you heat ice, it melts.', csvIds: ['156'] },
  { level: 'B1', name: 'Second conditional', nameTr: 'İkinci tip koşul cümleleri', example: 'If I had more time, I would travel.', csvIds: ['215'] },
  { level: 'B1', name: 'Passive voice: present & past simple', nameTr: 'Edilgen yapı: Present & Past Simple', example: 'The bridge was built in 1990.', csvIds: ['73', '76'] },
  { level: 'B1', name: 'Defining relative clauses (who / which / that / where)', nameTr: 'Tanımlayıcı sıfat cümlecikleri (who / which / that / where)', example: 'The man who called is my boss.', csvIds: ['172', '173', '174', '179', '185'] },
  { level: 'B1', name: 'Reported speech: statements', nameTr: 'Dolaylı anlatım: düz cümleler', example: 'She said she was tired.', csvIds: ['200', '201'] },
  { level: 'B1', name: 'Reported questions & requests', nameTr: 'Dolaylı anlatım: sorular ve ricalar', example: 'He asked me to wait.', csvIds: ['202', '203', '209'] },
  { level: 'B1', name: 'Gerunds & infinitives', nameTr: 'Ulaç (-ing) ve mastar (to)', example: 'I\'m interested in learning to cook.', csvIds: ['101', '103', '105', '110'] },
  { level: 'B1', name: 'Too & enough', nameTr: 'Too ve enough', example: 'It\'s too cold to swim.', csvIds: ['43', '44'] },
  { level: 'B1', name: 'So & such', nameTr: 'So ve such', example: 'It was such a good film.', csvIds: ['45', '46'] },
  { level: 'B1', name: 'Reflexive pronouns & each other', nameTr: 'Dönüşlü zamirler ve each other', example: 'They looked at each other.', csvIds: ['23', '27'] },
  { level: 'B1', name: 'Question tags', nameTr: 'Onay soruları (question tags)', example: 'You\'re coming, aren\'t you?', csvIds: ['193'] },
  { level: 'B1', name: 'Indirect questions', nameTr: 'Dolaylı sorular', example: 'Do you know where the station is?', csvIds: ['153', '202'] },
  { level: 'B1', name: 'Linking words: although / however / unless', nameTr: 'Bağlaçlar: although / however / unless', example: 'Although it was late, we stayed.', csvIds: ['157', '161'] },
  { level: 'B1', name: 'Phrasal verbs', nameTr: 'Öbek fiiller (phrasal verbs)', example: 'I\'m looking forward to it.', csvIds: ['55', '56', '57'] },

  // ── B2 ──────────────────────────────────────────────────────────────────
  { level: 'B2', name: 'Narrative tenses', nameTr: 'Anlatı zamanları', example: 'I had been walking for hours when I saw it.', csvIds: ['64', '65', '66', '67', '68'] },
  { level: 'B2', name: 'Past perfect continuous', nameTr: 'Past Perfect Continuous', example: 'She had been working there for years.', csvIds: ['68'] },
  { level: 'B2', name: 'Future continuous & future perfect', nameTr: 'Future Continuous ve Future Perfect', example: 'By June I will have finished.', csvIds: ['71', '72'] },
  { level: 'B2', name: 'Passive voice: all tenses & modals', nameTr: 'Edilgen yapı: tüm zamanlar ve kipler', example: 'It must be done by Friday.', csvIds: ['74', '75', '77', '78', '79', '82'] },
  { level: 'B2', name: 'Impersonal passive (It is said that…)', nameTr: 'Kişisiz edilgen (It is said that…)', example: 'He is believed to be rich.', csvIds: ['91'] },
  { level: 'B2', name: 'Causative: have / get something done', nameTr: 'Ettirgen yapı: have / get something done', example: 'I had my hair cut.', csvIds: ['207'] },
  { level: 'B2', name: 'Make / let / have + object + infinitive', nameTr: 'Make / let / have + nesne + mastar', example: 'They made me wait.', csvIds: ['206'] },
  { level: 'B2', name: 'Third conditional', nameTr: 'Üçüncü tip koşul cümleleri', example: 'If I had known, I would have helped.', csvIds: ['216'] },
  { level: 'B2', name: 'Mixed conditionals', nameTr: 'Karışık koşul cümleleri', example: 'If I had studied, I would be a doctor now.', csvIds: [] },
  { level: 'B2', name: 'Wish & if only', nameTr: 'Wish ve if only (dilek ve pişmanlık)', example: 'I wish I had listened.', csvIds: ['218', '219', '222', '223'] },
  { level: 'B2', name: 'Modals of deduction (present & past)', nameTr: 'Çıkarım kipleri (şimdi ve geçmiş)', example: 'She must have forgotten.', csvIds: ['145'] },
  { level: 'B2', name: 'Past modals: should have / could have / needn\'t have', nameTr: 'Geçmiş kipler: should have / could have / needn\'t have', example: 'You should have told me.', csvIds: ['145'] },
  { level: 'B2', name: 'Non-defining relative clauses', nameTr: 'Tanımlayıcı olmayan sıfat cümlecikleri', example: 'My sister, who lives in Paris, is a nurse.', csvIds: ['180', '181', '184', '187'] },
  { level: 'B2', name: 'Participle clauses', nameTr: 'Ortaç cümlecikleri (participle clauses)', example: 'Feeling tired, he went to bed.', csvIds: ['213', '214'] },
  { level: 'B2', name: 'Reporting verbs (suggest, admit, deny…)', nameTr: 'Aktarma fiilleri (suggest, admit, deny…)', example: 'He denied taking the money.', csvIds: ['217'] },
  { level: 'B2', name: 'Gerund vs infinitive: change in meaning', nameTr: 'Ulaç ve mastar: anlam değişimi', example: 'I stopped to smoke. / I stopped smoking.', csvIds: ['114'] },
  { level: 'B2', name: 'Advanced comparisons (the more…, the better)', nameTr: 'İleri karşılaştırmalar (the more…, the better)', example: 'The sooner, the better.', csvIds: ['37', '42', '49', '50', '51'] },
  { level: 'B2', name: 'Linkers of contrast & purpose', nameTr: 'Zıtlık ve amaç bağlaçları', example: 'Despite the rain, we left early so that we could park.', csvIds: ['95', '160', '161'] },
  { level: 'B2', name: 'So / neither + auxiliary', nameTr: 'So / neither + yardımcı fiil', example: 'I can\'t swim. — Neither can I.', csvIds: ['232', '233'] },
  { level: 'B2', name: 'Used to / be used to / get used to', nameTr: 'Used to / be used to / get used to', example: 'I\'m used to getting up early.', csvIds: ['140'] },

  // ── C1 ──────────────────────────────────────────────────────────────────
  { level: 'C1', name: 'Inversion after negative adverbials', nameTr: 'Olumsuz zarflardan sonra devrik yapı', example: 'Never have I seen such a mess.', csvIds: ['234'] },
  { level: 'C1', name: 'Inverted conditionals (Had I known…)', nameTr: 'Devrik koşul cümleleri (Had I known…)', example: 'Should you need help, call me.', csvIds: ['225', '226', '227'] },
  { level: 'C1', name: 'Cleft sentences (It is… that / What…)', nameTr: 'Vurgu cümleleri (It is… that / What…)', example: 'What I need is a holiday.', csvIds: ['204', '205'] },
  { level: 'C1', name: 'Advanced passive forms', nameTr: 'İleri edilgen yapılar', example: 'He hates being told what to do.', csvIds: ['80', '81', '84', '108', '109'] },
  { level: 'C1', name: 'Perfect infinitive & perfect gerund', nameTr: 'Perfect mastar ve perfect ulaç', example: 'Having finished, she left.', csvIds: ['90', '92', '107'] },
  { level: 'C1', name: 'Speculation: may well / might as well / bound to', nameTr: 'Tahmin: may well / might as well / bound to', example: 'It may well rain later.', csvIds: ['131', '133'] },
  { level: 'C1', name: 'Subjunctive after suggest / insist / recommend', nameTr: 'Suggest / insist / recommend sonrası dilek kipi', example: 'I suggest that he be informed.', csvIds: ['217'] },
  { level: 'C1', name: 'Alternatives to "if" (provided, unless, supposing)', nameTr: '"If" alternatifleri (provided, unless, supposing)', example: 'Provided that you pay, you can come.', csvIds: ['224', '228', '230'] },
  { level: 'C1', name: 'As if / as though', nameTr: 'As if / as though', example: 'He talks as if he knew everything.', csvIds: ['220', '221'] },
  { level: 'C1', name: 'Whatever / wherever / however', nameTr: 'Whatever / wherever / however', example: 'Whatever happens, stay calm.', csvIds: ['188'] },
  { level: 'C1', name: 'Emphatic do / does / did', nameTr: 'Vurgulu do / does / did', example: 'I did tell you!', csvIds: ['53', '54'] },
  { level: 'C1', name: 'Future in the past', nameTr: 'Geçmişte gelecek (future in the past)', example: 'I was going to call, but I forgot.', csvIds: [] },
  { level: 'C1', name: 'Ellipsis & substitution', nameTr: 'Eksiltme ve yerine koyma', example: 'I hope so. / I\'d like to.', csvIds: [] },
  { level: 'C1', name: 'Nominalisation', nameTr: 'İsimleştirme (nominalisation)', example: 'The decision to expand was made.', csvIds: ['151'] },
  { level: 'C1', name: 'Discourse markers', nameTr: 'Söylem belirteçleri', example: 'Nevertheless, the results were clear.', csvIds: ['34'] },

  // ── C2 ──────────────────────────────────────────────────────────────────
  { level: 'C2', name: 'Advanced inversion (Not only… / Little did I know)', nameTr: 'İleri devrik yapılar (Not only… / Little did I know)', example: 'Little did they realise the danger.', csvIds: ['234'] },
  { level: 'C2', name: 'Were it not for / had it not been for', nameTr: 'Were it not for / had it not been for', example: 'Had it not been for you, I\'d have failed.', csvIds: ['229', '231'] },
  { level: 'C2', name: 'Formulaic subjunctive (be that as it may, come what may)', nameTr: 'Kalıplaşmış dilek kipi (be that as it may, come what may)', example: 'Come what may, we\'ll finish.', csvIds: [] },
  { level: 'C2', name: 'Hedging & distancing', nameTr: 'Temkinli ve mesafeli anlatım', example: 'It would appear that the data is incomplete.', csvIds: [] },
  { level: 'C2', name: 'Fronting for emphasis', nameTr: 'Vurgu için öne alma (fronting)', example: 'Strange though it may seem, it worked.', csvIds: [] },
  { level: 'C2', name: 'Complex noun phrases', nameTr: 'Karmaşık isim öbekleri', example: 'A rapidly growing number of young urban professionals…', csvIds: [] },
  { level: 'C2', name: 'Advanced modality (needn\'t have, would rather, had better, dare)', nameTr: 'İleri kipler (needn\'t have, would rather, had better, dare)', example: 'You needn\'t have bothered.', csvIds: ['125', '126', '143'] },
  { level: 'C2', name: 'Concession (much as, however much, albeit)', nameTr: 'Ödün cümleleri (much as, however much, albeit)', example: 'Much as I like him, I can\'t agree.', csvIds: ['161'] },
  { level: 'C2', name: 'Quasi-negatives (hardly, scarcely, seldom)', nameTr: 'Yarı olumsuzlar (hardly, scarcely, seldom)', example: 'I had scarcely arrived when it began.', csvIds: ['36'] },
  { level: 'C2', name: 'Fixed formal expressions (so as to, may as well, be about to)', nameTr: 'Kalıplaşmış resmi ifadeler (so as to, may as well, be about to)', example: 'We left early so as not to miss it.', csvIds: ['97', '98', '100', '130'] },
  { level: 'C2', name: 'Ellipsis in formal & written English', nameTr: 'Resmi ve yazılı İngilizcede eksiltme', example: 'If necessary, contact us. / Though tired, she continued.', csvIds: [] },
];
