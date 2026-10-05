"""Import complete official directories, preserving stable WEIG identities.
Requires beautifulsoup4. Usage: python scripts/prepare-kashrut-sources.py /tmp output.sql
Inputs: bs-kashrut.html, kashrut-pt{,2,3}.html, ou-restaurants-all.json.
Supervisor phone numbers are deliberately never imported as business phone numbers.
"""
from pathlib import Path
from datetime import datetime, timezone
from bs4 import BeautifulSoup
import hashlib,json,sys,re
root=Path(sys.argv[1]);rows=[]
def timestamp(p):return datetime.fromtimestamp(p.stat().st_mtime,timezone.utc).isoformat()
def add(source,key,name,address,city,country,certifier,url,fetched,phone=None,label=None,level=None,food=None,revoked=False):
 rows.append(dict(source=source,source_key=str(key),business_name=name,address=address,city=city,country=country,certifier=certifier,source_url=url,fetched_at=fetched,business_phone=phone,source_label=label,level=level,food_type=food,evidence_type='revocation' if revoked else 'official_listing'))
p=root/'bs-kashrut.html';s=BeautifulSoup(p.read_text(),'html.parser')
assert any([c.get_text(' ',strip=True) for c in r.select('th,td')]==['שם עסק','סוג כשרות','ענף','טלפון','כתובת'] for r in s.select('tr'))
for r in s.select('tr'):
 cells=[c.get_text(' ',strip=True) for c in r.select('th,td')]
 if len(cells)!=5 or cells[0]=='שם עסק' or not cells[0]:continue
 name,label,category,phone,address=cells
 add('beit_shemesh_council',hashlib.sha256((name+'|'+address).encode()).hexdigest(),name,address,'בית שמש','IL','רבנות בית שמש','https://www.rabanutbs.co.il/53/',timestamp(p),phone,label,'מהדרין' if 'מהדרין' in label else 'רגילה' if 'רגילה' in label else None,' / '.join(t for t in ['בשרי','חלבי','פרווה'] if t in label) or None)
for file in ['kashrut-pt.html','kashrut-pt2.html','kashrut-pt3.html']:
 p=root/file;s=BeautifulSoup(p.read_text(),'html.parser');entities=s.select('.drts-entity[data-content-type="directory__listing"]')
 assert len(entities)>=100
 for r in entities:
  def field(n):
   f=r.select_one(f'[data-name="entity_field_{n}"]');return f.get_text(' ',strip=True) if f else ''
  label=field('directory_category');title=r.select_one('[data-name="entity_field_post_title"] a')
  if label=='דוח אישי':continue # inspector report is not a kosher listing
  assert title and title['href'].startswith('https://mpt.org.il/directory-kashrut/listing/')
  add('petah_tikva_council',r['data-entity-id'],title.get_text(' ',strip=True),field('location_address'),'פתח תקווה','IL','רבנות פתח תקווה',title['href'],timestamp(p),label=label,level='מהדרין' if 'מהדרין' in label else 'רגילה' if 'רגילה' in label else None,food=' / '.join(t for t in ['בשרי','חלבי','פרווה'] if t in label) or None,revoked='בוטל' in label or 'הוסרה' in label)
netanya_keys=set()
for file in ['kashrut-netanya.html','kashrut-netanya2.html','kashrut-netanya3.html','kashrut-netanya4.html']:
 p=root/file;s=BeautifulSoup(p.read_text(),'html.parser');entities=s.select('.drts-entity[data-content-type="directory__listing"]')
 for r in entities:
  def field(n):
   f=r.select_one(f'[data-name="entity_field_{n}"]');return f.get_text(' ',strip=True) if f else ''
  title=r.select_one('[data-name="entity_field_post_title"] a');assert title and title['href'].startswith('https://mdn.org.il/directory-kashrut/listing/')
  label=field('field_type_of_supervision').replace('סוג השגחה:','').strip()
  food=field('field_balanit_name').replace('סוג כשרות:','').strip() or None
  key=r['data-entity-id'];assert key not in netanya_keys;netanya_keys.add(key)
  add('netanya_council',key,title.get_text(' ',strip=True),field('location_address'),'נתניה','IL','רבנות נתניה',title['href'],timestamp(p),label=label,level=label or None,food=food,revoked='בוטל' in label or 'הוסרה' in label)
assert 400<=len(netanya_keys)<=800
p=root/'kashrut-yokneam.html';data=json.loads(p.read_text());assert data['success'] and len(data['result']['records'])==data['result']['total']==63
for r in data['result']['records']:
 address=' '.join(x for x in [r.get('street_name'),r.get('location')] if x)
 food=' / '.join(r[t] for t in ['meat','dairy','parve'] if r.get(t)) or None
 add('yokneam_government',r['_id'],r['business_name'],address,r.get('city_name') or '','IL','רבנות יקנעם עילית','https://data.gov.il/he/datasets/religion-office/kosherbusiness/c54032cb-5306-4be9-a20d-a0be0ba49cc1',timestamp(p),r.get('business_phone'),r.get('kosher_type'),r.get('kosher_type'),food)
p=root/'ou-restaurants-all.json';ou=json.loads(p.read_text());assert len(ou)>=100
il_cities={'jerusalem':'ירושלים','tel aviv':'תל אביב-יפו','herzliya':'הרצליה','netanya':'נתניה','beit shemesh':'בית שמש','beersheva':'באר שבע','eilat':'אילת','haifa':'חיפה','kfar saba':'כפר סבא','raanana':'רעננה','ramat gan':'רמת גן','petach tikva':'פתח תקווה'}
countries={'israel':'IL','usa':'US','united states':'US','canada':'CA','mexico':'MX','panama':'PA','united kingdom':'GB','uk':'GB','england':'GB','france':'FR','australia':'AU'}
unknown=[]
city_aliases={'new york city - manhattan':'New York','new york city - brooklyn':'Brooklyn','california - los angeles':'Los Angeles','california - beverly hills':'Beverly Hills','california - oxnard':'Oxnard','california - reseda':'Reseda','california - sherman oaks':'Sherman Oaks','baltimore md':'Baltimore','stamford ct':'Stamford','newark de':'Newark','chicago il':'Chicago','la':'Los Angeles','dc':'Washington'}
for r in ou:
 address=BeautifulSoup(r.get('address') or '', 'html.parser').get_text(' ',strip=True)
 locations=[x['name'] for x in r.get('location',[])];loc=[x.lower() for x in locations]
 country=next((countries[x] for x in loc if x in countries),None)
 if not country and re.search(r'\bENGLAND\b',address,re.I):country='GB'
 if not country and (re.search(r'\b(?:NY|NJ|FL|CA|IL|PA|MD|OH|TX|CT|MA|NV|TN|CO|VA|GA|MO|AZ|RI|DC|DE)\b',address) or locations or 'Tri-State' in address):country='US'
 if not country:raise SystemExit('Unresolved country: '+r['name'])
 if country=='IL':
  town=next((il_cities[x] for x in loc if x in il_cities),None)
  if not town:town=next((v for k,v in il_cities.items() if k in address.lower()),'')
 elif country=='GB':town='London' if 'London' in address else ''
 else:
  town=next((city_aliases[x] for x in reversed(loc) if x in city_aliases),'')
  if not town:
   # Explicit source locality, rather than inferring a town from a street name.
   regions={'new york','new jersey','connecticut','illinois','pennsylvania','fl','california','new york/ tri-state'}
   town=next((x for x in reversed(locations) if x.lower() not in regions),'')
  if not town:
   parts=[x.strip() for x in address.split(',')]
   if len(parts)>=3:town=parts[-2]
 if not town:unknown.append(r['name']) # retained, but cannot be automatically associated
 assert r['url'].startswith('https://oukosher.org/restaurants/')
 food=' / '.join({'meat':'בשרי','dairy':'חלבי','parve':'פרווה'}.get(x,x) for x in r.get('mdps',[])) or r.get('mdp')
 details=['גלאט' if r.get('glatt') else '', 'חלב ישראל' if r.get('cholov_yisroel') else '', 'פת ישראל' if r.get('pas_yisroel') else '', 'ישן' if r.get('yoshon') else '']
 terminated=bool(r.get('company_terminated'))
 label='OU — '+('הופסק הפיקוח' if terminated else ' / '.join(x for x in details if x) or 'מופיע ברשימת העסקים המפוקחים')
 add('ou_kosher',r['id'],r['name'],address,town,country,'OU',r['url'],timestamp(p),r.get('phone'),label,food=food,revoked=terminated)
# Duplicate names at one address in the council table preserve its original key.
rows=list({(r['source'],r['source_key']):r for r in rows}.values())
counts={s:sum(r['source']==s for r in rows) for s in {r['source'] for r in rows}}
assert counts['beit_shemesh_council']==225 and counts['petah_tikva_council']>=500 and counts['ou_kosher']>=50
payload=json.dumps(rows,ensure_ascii=False)
assert '$data$' not in payload
sql="""do $import$ declare item jsonb; own_id uuid; begin
update public.weig_kashrut_evidence set active_in_directory=false where source in ('beit_shemesh_council','petah_tikva_council','ou_kosher','netanya_council','yokneam_government');
for item in select value from jsonb_array_elements($data$PAYLOAD$data$::jsonb) loop
 select place_id into own_id from public.weig_kashrut_evidence where source=item->>'source' and source_key=item->>'source_key';
 if own_id is null then insert into public.weig_place_identities default values returning id into own_id; end if;
 insert into public.weig_kashrut_evidence(place_id,source,source_key,business_name,address,city,country,business_phone,certifier,level,food_type,source_label,evidence_type,source_url,fetched_at,active_in_directory)
 values(own_id,item->>'source',item->>'source_key',item->>'business_name',item->>'address',item->>'city',item->>'country',item->>'business_phone',item->>'certifier',item->>'level',item->>'food_type',item->>'source_label',item->>'evidence_type',item->>'source_url',(item->>'fetched_at')::timestamptz,true)
 on conflict(source,source_key) do update set business_name=excluded.business_name,address=excluded.address,city=excluded.city,country=excluded.country,business_phone=excluded.business_phone,level=excluded.level,food_type=excluded.food_type,source_label=excluded.source_label,evidence_type=excluded.evidence_type,source_url=excluded.source_url,fetched_at=excluded.fetched_at,active_in_directory=true;
end loop; end $import$;
""".replace('PAYLOAD',payload)
Path(sys.argv[2]).write_text(sql);Path(sys.argv[2]+'.json').write_text(payload)
print(json.dumps({'counts':counts,'total':len(rows),'unresolved_ou_localities':unknown},ensure_ascii=False))
