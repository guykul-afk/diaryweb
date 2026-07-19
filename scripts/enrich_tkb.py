import os
import glob
import time
import google.generativeai as genai

# Load API key from functions/.env
env_path = os.path.join(os.path.dirname(__file__), '..', 'functions', '.env')
api_key = None
if os.path.exists(env_path):
    with open(env_path, 'r', encoding='utf-8') as f:
        for line in f:
            if line.startswith('GEMINI_API_KEY='):
                api_key = line.strip().split('=', 1)[1]
                break

if not api_key:
    raise ValueError("GEMINI_API_KEY not found in functions/.env")

genai.configure(api_key=api_key)

SYSTEM_PROMPT = """אתה עוזר מומחה לפסיכולוגיה ופילוסופיה. תפקידך לקחת קובץ קיים של מאגר ידע (TKB) ולשכתב אותו לתבנית עשירה ומדויקת יותר, מבלי לאבד מהמידע הקיים.
עליך להחזיר רק את הטקסט בתבנית ה-Markdown, ללא שום תוספת.

חובה לשמור על תבנית ה-YAML בראש הקובץ ולהוסיף את השדות החסרים.
התבנית הנדרשת:
```yaml
---
type: [השאר מה שהיה, או concept/profile]
title: [הכותרת כפי שהייתה]
tags: [תגיות מהקובץ המקורי + תוספות רלוונטיות]
trigger_phrases: [לפחות 3-5 ביטויים, רגשות, או מצבים שמשתמש יכתוב ביומן שלו המצדיקים שימוש בגישה זו. בעברית]
core_conflicts: [2-3 קונפליקטים פנימיים שהגישה פותרת]
domain: [אחד מהבאים: work / relationships / inner_self / meaning]
source: [מהקובץ המקורי]
---

# [Title]

## הגדרה
[שמור על ההגדרה מהקובץ המקורי, שפר אותה במידת הצורך]

## עקרונות מרכזיים
[פירוט העקרונות מהקובץ המקורי, תוך שמירה על ניסוח ברור וסעיפים]

## זיהוי קליני ומתי להשתמש (Clinical Recognition)
[איך התיאוריה באה לידי ביטוי ספציפית ביומנים של משתמש? איזה דפוסים יעידו שזו הגישה הנכונה לניתוח?]

## שאלות רפלקציה אופייניות
[רשימה של 2-3 שאלות עמוקות ברוח ההוגה/הגישה, המנוסחות כפנייה ישירה למשתמש, למחשבה ביומן הבא]

## כיווני פעולה מעשיים (Action Items)
[2-3 הצעות לתרגול מעשי, פעולות התנהגותיות או מחשבתיות, הנגזרות ישירות מהתיאוריה]

## ציטוטים נבחרים מקוטלגים
[2-3 ציטוטים מוכרים ומדויקים של ההוגה/התיאוריה, רלוונטיים להתמודדויות יומיומיות, עם הקשר קצר לכל אחד]

## תפיסת מערכות היחסים והאישיות
[המידע המקורי מהסעיף הזה, אם היה]
```
הימנע מלעטוף את התוצאה בסימוני קוד כגון ```markdown במידת האפשר (או שאם אתה חייב, החזר קובץ מדויק ושלם בלבד). חובה לכלול את כל ה-YAML בין `---` ל-`---`.
"""

def enrich_file(filepath):
    print(f"Enriching {filepath}...")
    with open(filepath, 'r', encoding='utf-8') as f:
        original_content = f.read()
    
    model = genai.GenerativeModel('models/gemini-2.5-flash', system_instruction=SYSTEM_PROMPT)
    prompt = f"להלן התוכן המקורי של הקובץ. שכתב אותו לתבנית הנדרשת:\n\n{original_content}"
    
    try:
        response = model.generate_content(prompt)
        new_content = response.text.strip()
        
        # Clean up markdown code block if model wrapped it
        if new_content.startswith("```markdown"):
            new_content = new_content[len("```markdown"):].strip()
        if new_content.endswith("```"):
            new_content = new_content[:-3].strip()
            
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
            
        print(f"Successfully enriched {os.path.basename(filepath)}")
    except Exception as e:
        print(f"Error enriching {filepath}: {e}")

def main():
    tkb_dir = os.path.join(os.path.dirname(__file__), '..', 'functions', 'okf', 'tkb')
    md_files = glob.glob(os.path.join(tkb_dir, '*.md'))
    
    for filepath in md_files:
        enrich_file(filepath)
        time.sleep(2) # Avoid rate limits

if __name__ == "__main__":
    main()
