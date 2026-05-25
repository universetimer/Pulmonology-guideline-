"""
GitHub 저장소 정보를 HTML에 반영.

사용법:
  python configure.py <GitHub_사용자명> <repo_이름>

예시:
  python configure.py kaist79 respiratory-guideline

이렇게 하면 public/index.html, public/manual.html의 download URL이
https://github.com/kaist79/respiratory-guideline/raw/main/files/...  로 채워진다.
"""
import sys
import re
from pathlib import Path

if len(sys.argv) != 3:
    print(__doc__)
    sys.exit(1)

gh_user, gh_repo = sys.argv[1], sys.argv[2]

# 안전성 체크
if not re.match(r'^[A-Za-z0-9_.-]+$', gh_user) or not re.match(r'^[A-Za-z0-9_.-]+$', gh_repo):
    print("ERROR: 사용자명/repo 이름은 영문/숫자/_-만 허용")
    sys.exit(1)

ROOT = Path(__file__).parent
PUBLIC = ROOT / "public"

count = 0
for html_file in PUBLIC.rglob("*.html"):
    text = html_file.read_text(encoding="utf-8")
    new_text = text.replace("__GH_USER__", gh_user).replace("__GH_REPO__", gh_repo)
    if new_text != text:
        html_file.write_text(new_text, encoding="utf-8")
        count += 1
        print(f"  updated: {html_file.relative_to(ROOT)}")

print(f"\nDone. {count} HTML files updated.")
print(f"GitHub: https://github.com/{gh_user}/{gh_repo}")
print(f"DOCX URL: https://github.com/{gh_user}/{gh_repo}/releases/latest/download/manual-v18-with-2026-supplement.docx")
print("\n다음 단계:")
print("  git add -A")
print('  git commit -m "Configure GitHub URLs"')
print("  git push")
print("\n※ DOCX 다운로드 링크는 GitHub Release를 만든 후 작동합니다.")
print("  - GitHub 저장소 → Releases → Create a new release")
print("  - Tag: v1.0 / Title: v1.0 / Assets: manual-v18-with-2026-supplement.docx 업로드")
