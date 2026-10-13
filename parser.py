import sys
import json

with open('extracted_content.txt', 'r', encoding='utf-8') as f:
    lines = [line.strip() for line in f if line.strip()]

items = []
current_region = ''
region_label = ''
i = 0
while i < len(lines):
    line = lines[i]
    if '8.1. Huyệt vùng đầu, mặt, cổ' in line or 'Huyệt vùng đầu, mặt, cổ' in line:
        current_region = 'head'
        region_label = 'Đầu, Mặt, Cổ'
        i += 1
        continue
    elif '8.2. Huyệt vùng bụng, ngực' in line or 'Huyệt vùng bụng, ngực' in line:
        current_region = 'chest_abdomen'
        region_label = 'Bụng, Ngực'
        i += 1
        continue
    elif '8.3. Huyệt vai, lưng, mông' in line or 'Huyệt vai, lưng, mông' in line:
        current_region = 'back'
        region_label = 'Vai, Lưng, Mông'
        i += 1
        continue
    elif '8.4. Huyệt chi trên' in line or 'Huyệt chi trên' in line:
        current_region = 'arm'
        region_label = 'Chi Trên'
        i += 1
        continue
    elif '8.5. Huyệt chi dưới' in line or 'Huyệt chi dưới' in line:
        current_region = 'leg'
        region_label = 'Chi Dưới'
        i += 1
        continue
    elif line in ['Tên huyệt', 'Vị trí', 'Tác dụng', 'Điều trị', '8. Vị trí huyệt theo vùng cơ thể']:
        i += 1
        continue
    else:
        if i + 2 < len(lines):
            name = lines[i]
            loc = lines[i+1]
            ind = lines[i+2]
            if loc in ['Tên huyệt', 'Vị trí', 'Điều trị', 'Tác dụng'] or ind in ['Tên huyệt', 'Vị trí', 'Điều trị', 'Tác dụng']:
                i += 1
                continue
            items.append({
                'id': f'h_{len(items)+1}',
                'region_id': current_region,
                'region_name': region_label,
                'name': name,
                'location': loc,
                'indication': ind
            })
            i += 3
        else:
            i += 1

print(f'Total parsed acupoints: {len(items)}')
with open('acupoints_raw.json', 'w', encoding='utf-8') as f:
    json.dump(items, f, ensure_ascii=False, indent=2)

for it in items:
    print(f"{it['id']}: [{it['region_name']}] {it['name']}")
