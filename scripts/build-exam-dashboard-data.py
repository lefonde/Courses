"""Build public dashboard metadata from the locally verified research database.

Run from any directory with Python 3. Pass --input for a different research
checkout. The input database and original course PDFs are not published.
The output deliberately omits complete historical questions, private paths,
student answers, diagnostics, and personal progress.
"""
from __future__ import annotations

import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path, PurePosixPath
import re


REPO = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = REPO.parent.parent / 'Test/exam-research/problem-database.json'
BANDS = [
    {'id': 'high', 'label': 'עדיפות גבוהה', 'minimum': 60},
    {'id': 'medium', 'label': 'עדיפות בינונית־גבוהה', 'minimum': 40},
    {'id': 'supplementary', 'label': 'עדיפות משלימה', 'minimum': 25},
    {'id': 'extension', 'label': 'מאגר הרחבה', 'minimum': 0},
]
COMPONENTS = [
    {'id': 'scope', 'label': 'שייכות לחומר הקורס', 'maximum': 10,
     'explanation': '10 נקודות לכל משפחה שנכללה במאגר. זהו רכיב משותף, שאינו מבדיל בין המשפחות.'},
    {'id': 'current', 'label': 'הרצאות, מטלות והדוגמה הרשמית', 'maximum': 45,
     'explanation': 'בעיה או הוכחה בהרצאה: 28; נושא שהוסבר בהרצאה: 12; שאלת חובה במטלה: 28; סעיף עזר במטלה: 6; שאלה בדוגמה הרשמית: 28. הסכום מוגבל ל־45.'},
    {'id': 'family', 'label': 'הופעות של אותה משפחת שאלות', 'maximum': 25,
     'explanation': 'עד 25 נקודות לפי מספר הבחינות השונות שבהן הופיעה המשפחה. שלוש בחינות או יותר מקנות את מלוא הניקוד ברכיב.'},
    {'id': 'theme', 'label': 'שכיחות הנושא בבחינות', 'maximum': 10,
     'explanation': 'עד 10 נקודות לפי שיעור הבחינות שבהן הופיע הנושא הראשי. חזרה על נושא אינה בהכרח חזרה על אותה שאלה.'},
    {'id': 'recency', 'label': 'עדכניות ההופעה ההיסטורית', 'maximum': 5,
     'explanation': '2021: שתי נקודות; 2022: שלוש; 2023: ארבע; 2024: חמש. כאשר תאריך הבחינה אינו ידוע, שנת הסמסטר משמשת קירוב מסומן.'},
    {'id': 'reported_recent_exam', 'label': 'הדיווח על מועד א האחרון', 'maximum': 5,
     'explanation': '5 נקודות להתאמה ישירה לשאלה שדווחה. הדיווח נשמר בנפרד משמונת השאלונים שנבדקו, ואינו נספר כבחינה היסטורית נוספת.'},
]


def read_json(path: Path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def unique(values):
    return list(dict.fromkeys(values))


def source_label(evidence, public_source):
    if public_source:
        return public_source['label']
    source_id = evidence['source_id']
    number = int(source_id.rsplit('-', 1)[-1])
    if source_id.startswith('book-guide-'):
        return f'ספר הקורס — פרק {number}' if number <= 7 else f'מדריך הקורס — פרק {number - 7}'
    if source_id.startswith('lectures-'):
        return f'שיעור {number}'
    if source_id.startswith('homework-') and number >= 4:
        return f'ממ״ן {number + 7}'
    return PurePosixPath(evidence['relative_original_path'].replace('\\', '/')).stem


def compact_sources(family, public_sources):
    references, seen = [], set()
    for item in family['evidence']:
        path = item['relative_original_path'].replace('\\', '/')
        public_source = public_sources.get(path)
        ref = {
            'sourceId': public_source['id'] if public_source else None,
            'label': source_label(item, public_source),
            'filename': PurePosixPath(path).name,
            'pages': item['pdf_pages'],
        }
        for key in ('question', 'section'):
            if item.get(key) is not None:
                ref[key] = str(item[key])
        if item.get('subparts'):
            ref['subparts'] = item['subparts']
        if item.get('exercise_numbers'):
            ref['exercises'] = item['exercise_numbers']
        key = json.dumps(ref, ensure_ascii=False, sort_keys=True)
        if key not in seen:
            references.append(ref)
            seen.add(key)
    return references


def current_evidence(family):
    labels = []
    if family['lecture_level'] == 'explicit':
        labels.append('בעיה או הוכחה בהרצאה')
    elif family['lecture_level'] == 'theme':
        labels.append('נושא שהוסבר בהרצאה')
    if family['homework_level'] == 'explicit':
        labels.append('שאלת חובה במטלה')
    elif family['homework_level'] == 'supporting':
        labels.append('סעיף עזר במטלה')
    if family['official_sample']:
        labels.append('שאלה בדוגמה הרשמית')
    return labels


def build(database, public_sources, input_digest):
    pages = {page['id']: page for page in read_json(REPO / 'docs/data/exam-problem-pages.json')['pages']}
    notation = read_json(REPO / 'scripts/exam-math-notation.json')
    # These are reviewed, exact source expressions, not a heuristic TeX parser.
    pattern = re.compile('|'.join(re.escape(key) for key in sorted(notation, key=len, reverse=True)))
    overrides = read_json(REPO / 'scripts/exam-content-overrides.json')
    families = []
    for ordinal, source in enumerate(database['candidates'], 1):
        band = next(b for b in BANDS if source['score'] >= b['minimum'])
        families.append({
            'id': source['id'],
            'title': source['name_he'],
            'theme': source['theme_id'],
            'themeLabel': source['theme_name_he'],
            'score': source['score'],
            'rank': source['rank'],
            'ordinal': ordinal,
            'band': band['id'],
            'bandLabel': band['label'],
            'rankRange': source['rank_range'],
            'scoreRange': source['score_range'],
            'scoreBreakdown': source['score_breakdown'],
            'scenarioScores': source['scenario_scores'],
            'scenarioRanks': source['scenario_ranks'],
            'currentEvidence': current_evidence(source),
            'historicalExamCount': source['historical_exam_count'],
            'recentExamReported': bool(source['recalled_question_ids']),
            'tasks': source['tasks_he'],
            'techniques': unique(source['techniques_he']),
            'prerequisites': unique(source['prerequisites_he']),
            'sources': compact_sources(source, public_sources),
            'caveats': unique(source['notes_he']),
            'variants': unique(source['variants_he']),
            'lessonUrl': '#exam-problem/' + source['id'] if source['id'] in pages else None,
            'contentStatus': 'ready' if source['id'] in pages else 'planned',
        })
        families[-1].update(overrides.get(source['id'], {}))

    math_text = {}
    for family in families:
        for field in ('title', 'tasks', 'techniques', 'prerequisites', 'caveats', 'variants'):
            values = [family[field]] if isinstance(family[field], str) else family[field]
            for value in values:
                marked = pattern.sub(lambda match: r'\(' + notation[match.group()] + r'\)', value)
                if marked != value:
                    math_text[value] = marked

    counts = Counter(f['band'] for f in families)
    themes = {}
    for family in families:
        theme = themes.setdefault(family['theme'], {
            'id': family['theme'], 'label': family['themeLabel'], 'count': 0})
        theme['count'] += 1
    return {
        'schemaVersion': 1,
        'version': '2026-10-23.2',
        'researchDate': database['created_date'],
        'researchSha256': input_digest,
        'title': 'מפת ההכנה למבחן',
        'description': 'משפחות השאלות מסודרות לפי עדיפות להכנה. אפשר לעקוב אחר מה שנלמד ולבחור במה להתמקד בהמשך.',
        'stats': {
            'families': len(families),
            'historicalExams': database['historical_exam_denominator'],
            'historicalQuestions': database['historical_question_count'],
            'guideExercises': 64,
            'bookExercises': len(database['book_exercise_index']),
            'prerequisiteFamilies': database['prerequisite_count'],
            'readyPages': len(pages),
            'scenarios': len(database['scoring_model']['scenarios']),
        },
        'bands': [{**band, 'count': counts[band['id']]} for band in BANDS],
        'themes': list(themes.values()),
        'methodology': {
            'title': 'איך נקבע סדר העדיפויות?',
            'summary': 'הניקוד משלב חומר מההרצאות ומהמטלות, חזרות בבחינות ועדכניות. המשקלים נקבעו לצורך תעדוף ונבדקו בשישה תרחישים.',
            'scoreMeaning': 'הציון הוא מדד עדיפות מתוך 100. הוא אינו אחוז סיכוי להופעת שאלה ואינו מדד למוכנות אישית.',
            'rankMeaning': 'ציונים שווים מקבלים אותו מקום בדירוג. המספור ברשימה משמש להתמצאות ושומר על סדר קבוע גם בין ציונים שווים.',
            'rankRangeMeaning': 'טווח המקום מציג את המיקום הנמוך והגבוה בששת תרחישי המשקל. זהו מדד לרגישות הדירוג, לא רווח סמך סטטיסטי.',
            'progressMeaning': 'ההתקדמות מבוססת על סימון אישי של נושאים שנלמדו. היא אינה מעידה כשלעצמה על פתרון עצמאי או על ציון צפוי בבחינה.',
            'coverageMeaning': 'המאגר רחב בכוונה. 83 המשפחות בקבוצת ההרחבה אינן רשימת חובה להספק בחודש.',
            'contentStatusMeaning': 'דפי הלימוד מתווספים בהדרגה. שלוש המשפחות הראשונות כוללות תרגיל בסיסי, שאלת בחינה ופתרונות מלאים.',
            'components': COMPONENTS,
            'limits': [
                'המדגם כולל שמונה בחינות עבר בלבד, ואינו מדגם אקראי או רציף של כל המועדים.',
                'לא נמצאה הצדקה לקבוע שמועד ב קשה יותר באופן שיטתי, או להבטיח ששאלה מההרצאה או מהמטלה תופיע.',
                'שלוש השאלות שדווחו ממועד א האחרון נשמרות כדיווח שלא אומת בשאלון רשמי.',
                'פרקי הספר 4, 6 ו־7 הוחרגו מהמחקר בגלל חוסר או פגיעה בקריאות. הקטעים הלא ברורים במקורות האחרים אינם בסיס לניקוד.',
            ],
        },
        'scenarios': [{'id': s['id'], 'label': s['label_he']} for s in database['scoring_model']['scenarios']],
        'families': families,
        'mathText': math_text,
    }


def validate(output, database, public_sources):
    families = output['families']
    expected = database['candidates']
    assert len(families) == 129
    assert len({f['id'] for f in families}) == 129
    assert [f['id'] for f in families] == [f['id'] for f in expected]
    assert [f['score'] for f in families] == sorted([f['score'] for f in families], reverse=True)
    assert [f['rank'] for f in families] == [f['rank'] for f in expected]
    assert [f['ordinal'] for f in families] == list(range(1, 130))
    assert Counter(f['band'] for f in families) == {'high': 5, 'medium': 27, 'supplementary': 14, 'extension': 83}
    assert sum(theme['count'] for theme in output['themes']) == 129
    page_ids = {p['id'] for p in read_json(REPO / 'docs/data/exam-problem-pages.json')['pages']}
    assert page_ids <= {f['id'] for f in families}
    assert all(f['contentStatus'] == ('ready' if f['id'] in page_ids else 'planned') for f in families)
    assert all(f['lessonUrl'] == ('#exam-problem/' + f['id'] if f['id'] in page_ids else None) for f in families)
    assert all(0 <= f['score'] <= 100 and f['rankRange'][0] <= f['rankRange'][1] for f in families)
    public_ids = {s['id'] for s in public_sources.values()}
    assert all(ref['sourceId'] is None or ref['sourceId'] in public_ids for f in families for ref in f['sources'])
    assert all(ref['pages'] and all(isinstance(p, int) and p >= 1 for p in ref['pages']) for f in families for ref in f['sources'])
    text = json.dumps(output, ensure_ascii=False)
    assert not re.search(r'[A-Za-z]:[/\\]|file://|C:\\\\Users', text)
    assert all(key not in text for key in ['relative_original_path', 'historical_questions', 'baselineAssessment', 'sessionUpdates'])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, default=DEFAULT_INPUT)
    parser.add_argument('--output', type=Path, default=REPO / 'docs/data/exam-dashboard.json')
    args = parser.parse_args()
    database = read_json(args.input)
    curriculum = read_json(REPO / 'docs/data/curriculum.json')
    public_sources = {s['path'].replace('\\', '/'): s for s in curriculum['sources'].values()}
    result = build(database, public_sources, hashlib.sha256(args.input.read_bytes()).hexdigest())
    validate(result, database, public_sources)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'status': 'PASS', 'families': len(result['families']),
        'bands': {b['id']: b['count'] for b in result['bands']},
        'themes': len(result['themes']), 'historicalQuestions': result['stats']['historicalQuestions'],
        'readyPages': result['stats']['readyPages']}, ensure_ascii=False))


if __name__ == '__main__':
    main()
