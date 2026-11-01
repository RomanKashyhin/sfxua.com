"""Index the BOOM "Virtual Foley Artist - Footsteps" sample folder into layerlab/vfa-index.json.

    py -3.11 layerlab/tools/index_vfa.py "D:\\AudioLibrary\\BOOM Library - Virtual Foley Artist Footsteps\\PART 1\\Virtual Foley Artist - Footsteps\\Samples"

Output shape (compact: a prefix plus the variation numbers, the page rebuilds the file names):
{
  "folders": {
    "Boots 01 Concrete Clean 01 Dry": {
      "Left": { "01-59": { "Heel": { "p": "BO01 CC01D L - 01-59 - Heel ", "n": [1, 2, ...] }, ... }, ... },
      ...
    }
  }
}
"""
import json
import os
import re
import sys

root = sys.argv[1]
out_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'vfa-index.json')

ZONE = re.compile(r'(\d{1,3}-\d{1,3})')
TAIL = re.compile(r'(.*?)(\d{2})\.wav$', re.I)

folders = {}
count = 0
for top in sorted(os.listdir(root)):
    top_path = os.path.join(root, top)
    if not os.path.isdir(top_path):
        continue
    subs = {}
    # a folder without sub-folders (Metal Additional, Wood Planks Additional) is indexed as one sub named "."
    entries = [e for e in sorted(os.listdir(top_path)) if os.path.isdir(os.path.join(top_path, e))] or ['.']
    for sub in entries:
        sub_path = os.path.join(top_path, sub)
        zones = {}
        for name in sorted(os.listdir(sub_path)):
            m = TAIL.match(name)
            z = ZONE.search(name)
            if not m or not z:
                continue
            prefix, num = m.group(1), int(m.group(2))
            # articulation: what follows the zone, or the token before it (Metal "RA1", Wood "C1")
            after = prefix[z.end():].strip(' -')
            before = prefix[:z.start()].strip(' -').split(' ')[-1]
            art = after if after else before
            slot = zones.setdefault(z.group(1), {}).setdefault(art, {'p': prefix, 'n': []})
            slot['n'].append(num)
            count += 1
        if zones:
            subs[sub] = zones
    if subs:
        folders[top] = subs

json.dump({'folders': folders}, open(out_path, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('files', count, 'folders', len(folders), '->', out_path, os.path.getsize(out_path) // 1024, 'KB')
