"""Parse the official Beit Shemesh council table into an idempotent SQL import.
Usage: python scripts/prepare-kashrut-council.py council.html import.sql
No Google display content is stored. A directory row is not a valid certificate.
"""
from html.parser import HTMLParser
from pathlib import Path
from datetime import datetime, timezone
import hashlib,json,sys
class CouncilTable(HTMLParser):
 def __init__(self):super().__init__();self.rows=[];self.row=None;self.cell=None
 def handle_starttag(self,tag,attrs):
  if tag=='tr':self.row=[]
  if tag in ('td','th'):self.cell=[]
 def handle_data(self,data):
  if self.cell is not None:self.cell.append(data)
 def handle_endtag(self,tag):
  if tag in ('td','th') and self.cell is not None:
   if self.row is not None:self.row.append(' '.join(' '.join(self.cell).split()))
   self.cell=None
  if tag=='tr' and self.row is not None:self.rows.append(self.row);self.row=None
p=CouncilTable();source=Path(sys.argv[1]);p.feed(source.read_text())
if not any(row==['שם עסק','סוג כשרות','ענף','טלפון','כתובת'] for row in p.rows):raise SystemExit('Expected council table header missing; refusing import')
rows=[];seen=set()
for row in p.rows:
 if len(row)!=5 or row[0]=='שם עסק' or not row[0]:continue
 name,label,category,phone,address=row
 key=hashlib.sha256((name+'|'+address).encode()).hexdigest()
 if key in seen:continue
 seen.add(key)
 rows.append({'source_key':key,'business_name':name,'address':address,'source_label':label or None,'level':'מהדרין' if 'מהדרין' in label else 'רגילה' if 'רגילה' in label else None,'food_type':' / '.join(t for t in ['בשרי','חלבי','פרווה'] if t in label) or None})
if not 10<=len(rows)<=1000:raise SystemExit('Unexpected row count; refusing import')
payload=json.dumps(rows,ensure_ascii=False);fetched=datetime.fromtimestamp(source.stat().st_mtime,timezone.utc).isoformat()
sql="""do $import$ declare item jsonb; own_id uuid; begin
for item in select value from jsonb_array_elements($data$PAYLOAD$data$::jsonb) loop
 select place_id into own_id from public.weig_kashrut_evidence where source='beit_shemesh_council' and source_key=item->>'source_key';
 if own_id is null then insert into public.weig_place_identities default values returning id into own_id; end if;
 insert into public.weig_kashrut_evidence(place_id,source,source_key,business_name,address,city,certifier,level,food_type,source_label,evidence_type,source_url,fetched_at)
 values(own_id,'beit_shemesh_council',item->>'source_key',item->>'business_name',item->>'address','בית שמש','רבנות בית שמש',item->>'level',item->>'food_type',item->>'source_label','official_listing','https://www.rabanutbs.co.il/53/','FETCHED'::timestamptz)
 on conflict(source,source_key) do update set level=excluded.level,food_type=excluded.food_type,source_label=excluded.source_label,fetched_at=excluded.fetched_at;
end loop; end $import$;
""".replace('PAYLOAD',payload).replace('FETCHED',fetched)
Path(sys.argv[2]).write_text(sql);print(json.dumps({'records':len(rows),'fetched_at':fetched}))
