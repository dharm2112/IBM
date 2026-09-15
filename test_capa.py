import requests, json, sqlite3

devs = requests.get('http://127.0.0.1:8000/deviations').json()
dev = devs[0]

payload = {
    'deviation_id': dev['deviation_id'],
    'site_id': dev['site_id'],
    'rule_id': dev.get('rule_id', 'TEST-001'),
    'severity': dev['severity'],
    'category': dev['category'],
    'description': dev['description'],
    'protocol_requirement': dev['expected']
}

print('Requesting CAPA...')
r = requests.post('http://127.0.0.1:8000/ai/generate-capa', json=payload)
print(r.status_code)
if r.status_code != 200:
    print(r.text)
else:
    res = r.json()
    print('Draft chars len:', len(res.get('full_draft', '')))
    
conn = sqlite3.connect('trialguard.db')
c = conn.cursor()
c.execute("DELETE FROM capas WHERE full_draft LIKE '%\u00e2%'")
conn.commit()
print('Deleted mojibake records:', c.rowcount)
