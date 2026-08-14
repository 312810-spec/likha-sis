import re

filepath = r'c:\\Users\\Alota PC\\Desktop\\likha-sis\\likha-sis\\src\\ClassRecord.jsx'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the section input from text to select
old_input = '''<input
                  type="text"
                  placeholder="e.g. Kindness"
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm outline-none placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
                  required
                />'''

new_select = '''<select
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm outline-none placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
                >
                  <option value="">Select a section</option>
                  {availableSections.map((sec) => (
                    <option key={sec} value={sec}>
                      {sec}
                    </option>
                  ))}
                </select>
                {loading && <small className="text-xs text-gray-500">Loading sections...</small}>'''

if old_input in content:
    content = content.replace(old_input, new_select)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print('Replacement done')
else:
    print('Old input not found, showing first 200 chars of actual input section:')
    # Find the input section
    import re
    match = re.search(r'<input[^>]+/>', content)
    if match:
        print(repr(match.group()[:200]))