import subprocess, re, sys, html
from pathlib import Path

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

ROOT = Path(__file__).resolve().parent.parent

chrome = "C:/Program Files/Google/Chrome/Application/chrome.exe"
target = (ROOT / 'index.html').as_uri()

profile = ROOT / '.qa/chrome-profile'
profile.mkdir(parents=True, exist_ok=True)

proc = subprocess.run([
    chrome,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--disable-background-networking',
    f'--user-data-dir={profile}',
    '--virtual-time-budget=5000',
    '--dump-dom',
    target
], capture_output=True, timeout=60)

dom = proc.stdout.decode('utf-8', errors='replace')

# Look for Japanese text in the rendered DOM
# Exclude scripts and style tags
clean_dom = re.sub(r'<script.*?>.*?</script>', '', dom, flags=re.S)
clean_dom = re.sub(r'<style.*?>.*?</style>', '', clean_dom, flags=re.S)

jp_tokens = re.findall(r'[\u3040-\u30ff\u4e00-\u9fff]+', clean_dom)
# Note: we might have '日本語' in language switcher options, which is normal for a language switcher.
# Let's filter out language names from the language switcher.
lang_names = {'日本語', '繁體中文', '简体中文', '한국어'}
unexpected_jp = [t for t in jp_tokens if t not in lang_names]

print(f"Total Japanese tokens in rendered DOM: {len(jp_tokens)}")
print(f"Unexpected Japanese tokens: {len(unexpected_jp)}")
for t in set(unexpected_jp):
    # find where it appears
    pos = clean_dom.find(t)
    snippet = clean_dom[max(0, pos-50):min(len(clean_dom), pos+len(t)+50)]
    print("  FOUND:", repr(t), "IN:", repr(snippet))
