"""Simple local summary for GitHub JSON data. Run: python tools/analyze.py"""
import collections, json
from pathlib import Path
root=Path(__file__).resolve().parent.parent
runs=json.loads((root/'data/runs.json').read_text(encoding='utf-8')).get('entries',[])
feedback=json.loads((root/'data/feedback.json').read_text(encoding='utf-8')).get('entries',[])
print('Прохождений:', len(runs))
print('Точечных отзывов:', len(feedback))
print('Статусы:',dict(collections.Counter(x.get('status','?') for x in runs)))
print('Классы:',dict(collections.Counter(x.get('leader','?') for x in runs)))
print('Отзывы по вопросам:',dict(collections.Counter(x.get('question_id','?') for x in feedback)))
ratings=[x.get('feedback',{}).get('rating',0) for x in runs]
ratings=[v for v in ratings if isinstance(v,(int,float)) and v>0]
print('Средняя оценка:',round(sum(ratings)/len(ratings),2) if ratings else 'Пока нет оценок')
