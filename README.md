# 호흡기 내과 가이드라인 (전공의·인턴용)

호흡기 내과 주치의 매뉴얼 v18 (2025.9) + 2026 업데이트 보완 11개 챕터를 웹으로 보는 정적 사이트.

- **요약본 (2026)** — 25개 토픽 핵심 요약 (Quick Reference)
- **매뉴얼 전체** — v18 매뉴얼 원문 + 보완 챕터 (COPD 2024, 천식 2022, 결핵 5판, 폐고혈압 2020, ILD 2023, 폐암 2026 등)

## 구조

```
respiratory-guideline/
├── public/                  # Cloudflare Pages 배포 디렉터리
│   ├── index.html           # 랜딩 페이지
│   ├── manual.html          # 매뉴얼 전체 (v18 + 보완)
│   ├── summary.html         # 요약본 (2026)
│   ├── assets/              # CSS, JS, TOC JSON
│   ├── images/              # 매뉴얼 추출 이미지 (~36MB)
│   ├── downloads/           # 작은 다운로드 파일
│   │   └── summary-2026.docx   (≈ 76 KB)
│   ├── _headers             # Cloudflare 헤더 (캐시·보안)
│   └── _redirects           # (선택) URL 리디렉션
├── files/                   # 25MB 초과 파일 (.gitignore 처리, GitHub Release로 별도 업로드)
│   └── manual-v18-with-2026-supplement.docx   (≈ 42 MB · git 추적 안 함)
├── configure.py             # GitHub URL 일괄 치환 스크립트
├── .gitignore
├── .gitattributes
└── README.md
```

## 배포 가이드 (Cloudflare Pages)

### 1. GitHub 저장소 생성

1. [github.com/new](https://github.com/new) 접속
2. Repository name 입력 (예: `respiratory-guideline`)
3. **Public** 선택
4. README/`.gitignore`/license는 **추가하지 말 것** (이미 있음)
5. Create repository 클릭

### 2. GitHub URL 자동 치환

매뉴얼 다운로드 링크에 본인의 GitHub user/repo 이름을 채워넣어야 합니다.

```bash
python configure.py <GitHub사용자명> <repo이름>
```

예시:
```bash
python configure.py kaist79 respiratory-guideline
```

### 3. Git 초기화 및 push

```bash
git init
git branch -M main
git add -A
git commit -m "Initial commit: respiratory guideline site"
git remote add origin https://github.com/<USER>/<REPO>.git
git push -u origin main
```

### 4. GitHub Release 생성 (42 MB DOCX 업로드)

Cloudflare Pages는 파일당 25MB 제한이 있어 42MB 매뉴얼 docx는 git에 포함하지 않고 GitHub Release로 별도 호스팅합니다.

1. GitHub 저장소 → **Releases** 탭 → **Create a new release**
2. **Choose a tag** → `v1.0` 입력 → **Create new tag: v1.0 on publish**
3. **Release title**: `v1.0 — 초기 배포`
4. **Attach binaries**: `files/manual-v18-with-2026-supplement.docx` 드래그하여 업로드
5. **Publish release** 클릭

이후 매뉴얼 다운로드 링크가 정상 동작합니다:
`https://github.com/<USER>/<REPO>/releases/latest/download/manual-v18-with-2026-supplement.docx`

### 5. Cloudflare Pages 연결

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create application** → **Pages** 탭 → **Connect to Git**
2. GitHub 계정 인증 → 해당 저장소 선택 → **Begin setup**
3. Build 설정:
   - **Framework preset**: `None`
   - **Build command**: (비워둠)
   - **Build output directory**: `public`
   - **Root directory**: (비워둠 — 저장소 루트)
4. **Save and Deploy** 클릭
5. 약 1~2분 후 배포 완료 → `https://<프로젝트명>.pages.dev` 발급

### 6. (선택) 커스텀 도메인 연결

Cloudflare Pages 프로젝트 → **Custom domains** → **Set up a custom domain** → 도메인 입력 → DNS 자동 설정.

## 로컬 미리보기

브라우저에서 `public/index.html`을 열거나, 간단한 정적 서버 실행:

```bash
cd public
python -m http.server 8000
# http://localhost:8000
```

## 콘텐츠 업데이트

원본 docx (`files/manual-v18-with-2026-supplement.docx`)를 수정한 경우:

1. docx 파일을 `files/` 에 덮어쓰기
2. 변환 스크립트 재실행 (별도 빌드 폴더에 있는 `convert_to_html.py` 사용 또는 수동)
3. `git add -A && git commit -m "Update content" && git push`
4. Cloudflare Pages 자동 재배포

## 참고 자료

다음 18종 진료지침의 최신 권고를 정리:

- 대한결핵및호흡기학회 — COPD 2024 / 천식 2022 / ILD 2023 / 폐고혈압 2020 / 기침 2020
- 대한감염학회 — 성인 CAP 항생제 사용지침 / HAP·VAP 항생제 사용지침
- 질병관리청 — 결핵 진료지침 5판 (2024.02)
- 대한폐암학회 — 폐암 진료가이드라인 2023 + 2026.05 NSCLC·SCLC
- ARDS Berlin 정의 (2012) + Global definition (2023)
- 대한호흡기내시경학회 — 기관지내시경 교과서
- 기타 (호흡기 민간요법 문헌고찰, Lung Cancer Fact Sheet 등)

## 면책

- 본 자료는 호흡기 내과 전공의·인턴 교육 및 병동 실무 참고용입니다.
- 실제 진료는 환자 임상 상황, 최신 진료지침, Staff 선생님의 판단에 따라 결정해야 합니다.
- 본 자료의 사용으로 발생하는 결과에 대해 작성자는 책임지지 않습니다.

## 라이선스

콘텐츠: CC BY-NC-SA 4.0 (비상업적·동일조건변경허락)
코드 (HTML/CSS/JS): MIT
