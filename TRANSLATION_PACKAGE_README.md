# Translation Package - Training Platform

## 📦 Package Contents

This package contains all English (US) strings ready for translation into:
- 🇯🇵 Japanese (ja) - **Priority**
- 🇧🇷 Portuguese Brazil (pt-BR) - **Priority**  
- 🇮🇩 Bahasa Indonesia (id)
- 🇲🇾 Malay (ms)

## 📊 Translation Statistics

| File | Words | Strings | Category |
|------|-------|---------|----------|
| common.json | 440 | ~180 | Shared UI elements |
| auth.json | 129 | ~40 | Login & authentication |
| consultant.json | 393 | ~150 | Consultant dashboard |
| boss.json | 287 | ~100 | Boss dashboard |
| admin.json | 621 | ~200 | Admin panel |
| pathways.json | 222 | ~60 | Pathways management |
| **TOTAL** | **2,092** | **~730** | **All categories** |

## 🎯 Translation Instructions

### Step 1: Copy Files
```bash
# For Japanese
cp public/static/locales/en-US/*.json public/static/locales/ja/

# For Portuguese (Brazil)
cp public/static/locales/en-US/*.json public/static/locales/pt-BR/

# For Bahasa Indonesia
cp public/static/locales/en-US/*.json public/static/locales/id/

# For Malay
cp public/static/locales/en-US/*.json public/static/locales/ms/
```

### Step 2: Translate JSON Values
**IMPORTANT:** Only translate the VALUES, NOT the KEYS

**Correct:**
```json
{
  "buttons": {
    "save": "保存",        ← Translate this
    "cancel": "キャンセル"  ← Translate this
  }
}
```

**Incorrect:**
```json
{
  "ボタン": {              ← DON'T translate keys!
    "save": "保存",
    "cancel": "キャンセル"
  }
}
```

### Step 3: Handle Variables
Some strings contain variables like `{{count}}`, `{{name}}`, etc.

**Keep variables unchanged:**
```json
// English
"progress": "Progress: {{completed}}/{{total}} levels"

// Japanese (keep {{completed}} and {{total}})
"progress": "進捗: {{completed}}/{{total}} レベル"

// Portuguese (keep {{completed}} and {{total}})
"progress": "Progresso: {{completed}}/{{total}} níveis"
```

### Step 4: Context Notes

#### Product Terms (Consider keeping in English or localizing):
- **"The Academy"** - App name (may stay in English)
- **"Journey Map"** - Our term for progress visualization
- **"Pathway"** - Our term for learning track
- **"Boss"** - Role term (not "Manager" or "Supervisor")
- **"Consultant"** - Role term
- **"Sign-off"** - Approval from boss

#### Technical Terms:
- **"Admin"** - May stay in English if culturally appropriate
- **"Dashboard"** - Common tech term
- **"API"**, **"URL"** - Usually stay in English

#### UI Constraints:
- **Buttons** should be concise (max 10-15 characters if possible)
- **Navigation items** should fit in menu (max 20 characters)
- **Error messages** should be clear and actionable

## 🌍 Language-Specific Notes

### Japanese (ja)
- Use polite form (です/ます) for general UI
- Technical terms often kept in katakana
- Buttons can be shorter than English
- Consider kanji vs hiragana readability

### Portuguese Brazil (pt-BR)
- Use Brazilian Portuguese, not European Portuguese
- Technical terms may use English or Portuguese
- Formal tone for professional context
- Watch for accents (á, é, í, ó, ú, ç, ã, õ)

### Bahasa Indonesia (id)
- Formal Indonesian, not colloquial
- Many tech terms borrowed from English
- Use "Anda" for formal "you"
- Sentences often shorter than English

### Malay (ms)
- Standard Malay (Bahasa Malaysia)
- Similar to Indonesian but with differences
- Formal tone for business context
- Tech terms often English-based

## 📋 Translation Checklist

- [ ] All JSON files copied to target language folder
- [ ] Only VALUES translated (keys unchanged)
- [ ] Variables ({{var}}) preserved in translations
- [ ] Product terms reviewed (localize or keep?)
- [ ] Button text is concise
- [ ] Error messages are clear
- [ ] Tested in application (after integration)
- [ ] Native speaker review completed
- [ ] Spelling and grammar checked
- [ ] Cultural appropriateness verified

## 🧪 Testing Recommendations

After translation, test:
1. ✅ All text displays correctly (no missing characters)
2. ✅ UI doesn't break with longer text
3. ✅ Variables show correct values
4. ✅ Error messages make sense
5. ✅ Tone is appropriate (professional)
6. ✅ No untranslated strings (English fallback)

## 🚨 Common Mistakes to Avoid

❌ **Translating JSON keys**
```json
// WRONG
{"ボタン": {"save": "保存"}}

// CORRECT  
{"buttons": {"save": "保存"}}
```

❌ **Removing variables**
```json
// WRONG
"progress": "進捗: 5/14 レベル"

// CORRECT
"progress": "進捗: {{completed}}/{{total}} レベル"
```

❌ **Breaking JSON syntax**
```json
// WRONG (missing quote)
{"save": "保存}

// CORRECT
{"save": "保存"}
```

❌ **Using wrong quote types**
```json
// WRONG (curly quotes)
{"save": "保存"}

// CORRECT (straight quotes)
{"save": "保存"}
```

## 📞 Translation Support

If you have questions about:
- **Context** - What does this text mean? Where is it shown?
- **Technical terms** - Should this be translated or kept in English?
- **Character limits** - Will this text fit in the UI?
- **Tone** - Formal vs casual?

Please ask! Context is important for accurate translation.

## 📈 Priority Order

1. **High Priority** (Must have for launch):
   - common.json - Shared UI elements
   - auth.json - Login functionality
   - consultant.json - Main user interface
   - pathways.json - Core feature

2. **Medium Priority** (Important but can come later):
   - boss.json - Boss dashboard
   - admin.json - Admin panel

3. **Low Priority** (Nice to have):
   - Error messages refinement
   - Tooltip text
   - Help text

## ✅ Quality Standards

- **Accuracy**: Translation matches English meaning
- **Consistency**: Same terms translated the same way
- **Clarity**: Easy to understand for target audience
- **Tone**: Professional and appropriate
- **Grammar**: Correct grammar and spelling
- **Cultural**: Culturally appropriate expressions

## 🎯 Success Criteria

Translation is complete when:
- ✅ All JSON files exist in target language folder
- ✅ All values are translated (no English left)
- ✅ Variables are preserved
- ✅ JSON syntax is valid (can be parsed)
- ✅ Native speaker review completed
- ✅ Tested in application
- ✅ UI displays correctly

---

**Good luck with translations!** 🌍✨

For questions or issues, please contact the development team.
