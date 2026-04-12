# AI (Gemini) Debugging Guide

## 🔴 Yaygın Sorunlar ve Çözümleri

### 1. "AI features will return mock data" Uyarısı
**Sorun**: Backend startup sırasında bu uyarı görüyorsunuz
**Sebep**: `GEMINI_API_KEY` ayarlanmamış veya `your-` ile başlayan placeholder değer
**Çözüm**:
```bash
# .env dosyasını açarak GEMINI_API_KEY'i güncelleyin
GEMINI_API_KEY=AIzaSyBi2QU0FAeM-MvW9hf9vnRReKaUADBDBX8
```
Daha sonra server'ı yeniden başlatın.

---

### 2. Quiz Sorularını Üretemiyor (Mock Sorular Geliyor)
**Sorun**: HomeScreen'den seviye + konu seçip "Test Çöz"'e tıkladığınızda AI 10 soru yerine mock sorular geliyor
**Sebep**:
- GEMINI_API_KEY ayarlanmamış
- API key geçersiz
- Gemini API çağrısı başarısız
**Debug Adımları**:
```bash
# 1. Backend log'unu kontrol et
# "Gemini/generateQuizQuestions" satırını ara:
#   ✅ "Using mock data (API key not configured)" → API key ayarlı değil
#   ✅ "Request {topicId, cefrLevel, count}" → Başlatıldı
#   ❌ "Network Error" veya "API Error" → API çağrısı başarısız

# 2. API key'i verify et
echo $GEMINI_API_KEY  # Boş değilse doğru şekilde ayarlanmış

# 3. API key'in geçerli olduğundan emin ol
# https://aistudio.google.com/apikey adresine git ve key'i kontrol et
```

---

### 3. AI Ders Anlatımı Streaming Durmuyor
**Sorun**: LessonScreen'de AI chat'i açtığınızda hiçbir yanıt gelmiyor veya yarı yolda duruyor
**Sebep**:
- GEMINI_API_KEY ayarlanmamış
- Bağlantı timeout
- Hatalı topic ID
**Debug**:
```bash
# Backend log'unda "Gemini/streamLessonChat" ara:
# - "Request {topic, cefrLevel, messageCount}" → Başlatıldı
# - "Stream completed" → Başarılı
# - "Network Error" veya "API Error" → Bağlantı problemi
```

---

### 4. Quiz Analizi (Wrong Answer Analysis) Çalışmıyor
**Sorun**: Quiz'i tamamladığında "AI Analizi" bölümü boş veya "AI yanışları analiz ediyor..." duruyor
**Sebep**:
- GEMINI_API_KEY ayarlanmamış
- Rate limiting (çok hızlı çok sorgusu)
- API timeout
**Çözüm**:
```bash
# Backend log'unda "Gemini/analyzeAnswer" ara
# - Multiple "Request" satırı → Her yanlış soru için birini çağırıyor
# - "Falling back to basic feedback" → API başarısız, fallback data döndürüyor
```

---

## 📊 Log Formatı

### Başarılı Log (✅)
```
[GeminiService] [Gemini/generateQuizQuestions] Request {topicId, cefrLevel, count} with model gemini-2.0-flash
[GeminiService] [Gemini/generateQuizQuestions] Response received {length: 2543}
```

### Hata Log (❌)
```
[GeminiService] [Gemini/generateQuizQuestions/Network Error] Error: getaddrinfo ENOTFOUND generativelanguage.googleapis.com — {
  "isNetworkError": true,
  "status": undefined,
  "apiError": "connection refused"
}
```

---

## 🔧 Manual API Test

### cURL ile Gemini API'yi Test Et
```bash
# 1. API key'i ortam değişkenine kaydet
export GEMINI_API_KEY="AIzaSyBi2QU0FAeM-MvW9hf9vnRReKaUADBDBX8"

# 2. Simple test isteği gönder
curl -s -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=$GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [{
      "parts": [{
        "text": "Say hello in Turkish"
      }]
    }]
  }' | jq .

# 3. Yanıt formatı:
# {
#   "candidates": [{"content": {"parts": [{"text": "Merhaba!"}]}}]
# }
```

---

## 📱 Mobile Tarafında Debug

### Network Log'u Kontrol Et
```typescript
// api/client.ts'de interceptor log'u kontrol et
// POST /ai/quiz/generate yanıtını kontrol et:
// - 200 OK → Server doğru veri döndürüyor
// - 401 Unauthorized → JWT token geçersiz
// - 500 Internal Server Error → Backend hatası (log'u kontrol et)
```

---

## 🚀 Hızlı Çözüm Listesi

| Sorun | Kontrol Etmen Gereken | Komut |
|-------|----------------------|-------|
| AI soruları gelmiyyor | GEMINI_API_KEY | `grep GEMINI_API_KEY .env` |
| Streaming duruyor | Network bağlantısı | `curl -s https://generativelanguage.googleapis.com` |
| Mock data geliyor | API key placeholder | `echo $GEMINI_API_KEY \| grep -c "^AIz"` |
| Timeout | API rate limit | Backend log'unda tekrar dene |
| Random hata | Server restart | `npm run start:dev` |

---

## 📝 Issue Reporting Template

Eğer sorun çözülmezse, backend log'unu şu şekilde paylaş:

```
Backend Çıktısı:
---
[GeminiService] [Gemini/generateQuizQuestions/Network Error] ...
---

Mobil Hatası:
---
Error loading Metro config: ... veya
Unable to resolve module ...
---

Adımlar:
1. HomeScreen'de B1 ve "Present Simple" seçtim
2. "Test Çöz" tıkladım
3. Loading spinner sonsuz dönüyor
```

