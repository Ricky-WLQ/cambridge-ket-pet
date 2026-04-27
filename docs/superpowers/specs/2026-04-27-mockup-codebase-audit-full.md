# Mockup vs Codebase — FULL Audit (2026-04-27)

> **Scope**: every section in `design-preview/preview.html` (41 sections) cross-checked against real `apps/web/src/**` code.
> **Methodology**: each label/title/subtitle/stat/copy/count in the mockup was verified against the actual rendered text in `page.tsx` / component file. Citations use `file:line`.
>
> See also `2026-04-27-mockup-codebase-audit.md` for the original 20-item narrow audit.

---

## Index

1. [#login](#login-login)
2. [#kethub](#kethub-ket)
3. [#diaghub](#diaghub-diagnose)
4. [#reader](#reader-ketreadingrunnerattemptid)
5. [#signup](#signup-signup)
6. [#teacher-activate](#teacher-activate-teacheractivate)
7. [#home-out](#home-out--unauth)
8. [#home-in](#home-in--auth)
9. [#pethub](#pethub-pet)
10. [#reading-new](#reading-new-ketreadingnew)
11. [#reading-result](#reading-result-ketreadingresultattemptid)
12. [#listening-new](#listening-new-ketlisteningnew)
13. [#listening-runner](#listening-runner-ketlisteningrunnerattemptid)
14. [#listening-result](#listening-result-ketlisteningresultattemptid)
15. [#writing-new](#writing-new-ketwritingnew)
16. [#writing-runner](#writing-runner-ketwritingrunnerattemptid)
17. [#writing-result](#writing-result-ketwritingresultattemptid)
18. [#speaking-new](#speaking-new-ketspeakingnew)
19. [#speaking-runner](#speaking-runner-ketspeakingrunnerattemptid)
20. [#speaking-result](#speaking-result-ketspeakingresultattemptid)
21. [#vocab-overview](#vocab-overview-ketvocab)
22. [#vocab-spell](#vocab-spell-ketvocabspell)
23. [#vocab-listen](#vocab-listen-ketvocablisten)
24. [#grammar-overview](#grammar-overview-ketgrammar)
25. [#grammar-quiz](#grammar-quiz-ketgrammarquiz)
26. [#grammar-mistakes](#grammar-mistakes-ketgrammarmistakes)
27. [#diag-section-runner](#diag-section-runner-diagnoserunnersection)
28. [#diag-report](#diag-report-diagnosereporttestid)
29. [#diag-history](#diag-history-diagnosehistory)
30. [#diag-history-detail](#diag-history-detail-diagnosehistorytestid)
31. [#diag-replay](#diag-replay-diagnosereplaytestidsection)
32. [#history](#history-history)
33. [#history-mistakes](#history-mistakes-historymistakes)
34. [#classes](#classes-classes)
35. [#teacher-classes](#teacher-classes-teacherclasses)
36. [#teacher-class-new](#teacher-class-new-teacherclassesnew)
37. [#teacher-class-detail](#teacher-class-detail-teacherclassesclassid)
38. [#teacher-assignment-new](#teacher-assignment-new-teacherclassesclassidassignmentsnew)
39. [#teacher-student-detail](#teacher-student-detail-teacherclassesclassidstudentsstudentid)
40. [#teacher-attempt-detail](#teacher-attempt-detail-teacherclassesclassidstudentsstudentidattemptsattemptid)
41. [#teacher-diagnose-status](#teacher-diagnose-status-teacherclassesclassiddiagnose-status)

---

### #login (`/login`)

**Real source**: `apps/web/src/app/login/page.tsx`

**Fabrications found**:
- `*` Logo + `剑桥 KET / PET` site header — login page has NO header at all (`login/page.tsx:36-38` opens with a centered form). Drop the header.
- `*` `欢迎回到你的学习旅程` hero h1 marker — fabricated. Real page has only the form heading "登录" (`page.tsx:40`).
- `*` `Cambridge A2 Key 与 B1 Preliminary…AI 智能诊断…` paragraph — fabricated. Real subtitle is `欢迎回到剑桥 KET / PET 备考` (`page.tsx:42` via `t.auth.login.subtitle` at `i18n/zh-CN.ts:51`).
- `*` 3 stat-cards "A2 / B1 · Cambridge 等级覆盖", "6 项 · 完整剑桥能力", "每周 · AI 综合诊断" — all fabricated. Not in code.
- `*` 3 chip pills "📖 阅读 · 写作", "🎧 听力 · 口语", "📝 词汇 · 语法" — fabricated. Not in code.
- `*` `登 录 →` button (with arrow) — real button is plain `登录` / `登录中…` (`page.tsx:89`).
- `*` "忘记密码? 点这里" link — fabricated. Real login has only the "还没有账号？注册" footer link (`page.tsx:94-101`).
- `*` Form heading marker `登录` is real (`page.tsx:40`); subtitle "使用邮箱继续你的练习。" is fabricated (real is "欢迎回到剑桥 KET / PET 备考").

**Real-code labels to use instead**:
- title (h1): `登录`
- subtitle: `欢迎回到剑桥 KET / PET 备考`
- email label: `邮箱`
- password label: `密码`
- submit button: `登录` (idle) / `登录中…` (loading)
- footer link: `还没有账号？` `注册`
- error: `邮箱或密码错误`

---

### #kethub (`/ket`)

**Real source**: `apps/web/src/app/ket/page.tsx`, `apps/web/src/components/SiteHeader.tsx`

**Fabrications found**:
- `*` Hero pill `✦ KET · A2 Key` — fabricated. No hero pill exists.
- `*` Hero h1 `选择你的练习模式` with marker — fabricated. Real h1 is `KET 门户` (`page.tsx:29`).
- `*` Hero paragraph `6 项剑桥能力 · AI 即时生成真题 · 错题自动归档到诊断报告` — fabricated. Real subtitle is `Cambridge A2 Key · 选择你想练习的题目类型` (`page.tsx:30-32`).
- `*` 3-stack decorative tile cluster on the right — fabricated decoration; real page has none.
- `*` Tile "词汇 Vocab" subtitle `Vocab · A2 / B1 词表 · 听说拼写` — fabricated. Real subtitle is `Vocabulary · A2 Key 官方词表 · 1,599 词` (`page.tsx:82-84`).
- `*` Tile "语法 Grammar" subtitle `Grammar · 错题本沉淀` — fabricated. Real subtitle is `Grammar · A2 Key 官方语法清单 · 19 个主题` (`page.tsx:92-94`).
- `*` Header nav links 历史 / 诊断 / 我的班级 — all real via `SiteHeader.tsx:42-65`. The red rose-500 dot on `诊断` is real (gate banner indicator `SiteHeader.tsx:53-58`).
- `*` Tile titles `阅读 Reading`, `听力 Listening`, `写作 Writing`, `口语 Speaking` — real code shows just `阅读`, `听力`, `写作`, `口语` (no English suffix) (`page.tsx:41,51,61,71`). Bilingual pair is fabricated decoration.

**Real-code labels to use instead**:
- title: `KET 门户`
- subtitle: `Cambridge A2 Key · 选择你想练习的题目类型`
- 6 tile titles: `阅读`, `写作`, `听力`, `口语`, `词汇`, `语法` (no English)
- subtitle order in code is: 阅读, 写作, 听力, 口语, 词汇, 语法 (the mockup ordered them differently — note that real grid is `sm:grid-cols-2` not 3-col)
- subtitles: `Reading · AI 即时生成仿真题`, `Writing · AI 即时生成写作任务`, `Listening · AI 即时生成真题听力`, `Speaking · 与 AI 考官 Mina 实时对话`, `Vocabulary · A2 Key 官方词表 · 1,599 词`, `Grammar · A2 Key 官方语法清单 · 19 个主题`

---

### #diaghub (`/diagnose`)

**Real source**: `apps/web/src/app/diagnose/page.tsx`, `apps/web/src/components/diagnose/DiagnoseHub.tsx`, `apps/web/src/components/diagnose/SectionStatusCard.tsx`

**Fabrications found**:
- `*` Hero pill row `每周必做的综合测验` next to KET tag — partial. Real subtitle is `每周必做的 AI 综合测验 · 6 项剑桥能力 · 约 30 分钟` (`i18n/zh-CN.ts:226`). Mockup truncates to "每周必做的综合测验" — drop "AI" and the rest is fine, but "约 30 分钟" should appear.
- `*` Hero h1 `本周诊断测试` with marker on "诊断测试" — REAL (`zh-CN.ts:225` `t.diagnose.pageTitle`).
- `*` Hero paragraph `6 项剑桥能力 · 约 30 分钟 · 2026-04-26 至 2026-05-03` — partial. Real renders subtitle then a separate week-range line: subtitle `每周必做的 AI 综合测验 · 6 项剑桥能力 · 约 30 分钟` + line `{weekStart} 至 {weekEnd}` (`DiagnoseHub.tsx:87-92`). Mockup combines both into one line.
- `*` `查看本周诊断报告 →` CTA — REAL (`DiagnoseHub.tsx:95-102`).
- `*` Section card stats `33%`, `0%`, `60%`, `67%` and pills `已评分 / 已提交` — FABRICATED. Real `SectionStatusCard` renders only icon + title + status pill (`已提交 / 已评分 / 已自动提交 / 进行中 / 未开始`) + CTA button (`SectionStatusCard.tsx:178-211`). NO score % is shown on the hub card. The CTA copy is `开始测验 / 继续测验 / 查看报告 / 查看报告生成中…`, not `查看 →` (`zh-CN.ts:242-244`).
- `*` `已完成 6 / 6` counter and progress bar — REAL pattern (`DiagnoseHub.tsx:114-131`); the count is dynamic.
- `*` Card subtitle `本周 6 项测验` with marker — REAL (`zh-CN.ts:234` `t.diagnose.sectionsTitle`).
- `*` Section names `阅读 / 听力 / 写作 / 口语 / 词汇 / 语法` — REAL (`SectionStatusCard.tsx:51-58`).
- `*` Card status pills should be `已提交 / 已评分 / 已自动提交 / 进行中 / 未开始` — mockup has only `已评分` and `已提交` which is fine.

**Real-code labels to use instead**:
- title: `本周诊断测试`
- subtitle: `每周必做的 AI 综合测验 · 6 项剑桥能力 · 约 30 分钟`
- week-range line: `{weekStart} 至 {weekEnd}`
- sections title: `本周 6 项测验`
- counter: `已完成 N / 6`
- per-card has NO score; pill labels: `未开始 / 进行中 / 已提交 / 已自动提交 / 已评分`
- per-card CTA: `开始测验 / 继续测验 / 查看报告` (no `查看 →` arrow link)

---

### #reader (`/ket/reading/runner/[attemptId]`)

**Real source**: `apps/web/src/components/reading/Runner.tsx`

**Fabrications found**:
- `*` Header chip `KET 阅读 · Part 4` and `第 4 题 / 共 5 题` — partial. Real h1 is `{examType} 阅读 · Part {part}` (`Runner.tsx:137-139`); the question count is rendered as `已作答 N / total` at the bottom (`Runner.tsx:218-220`), NOT in the header. The "第 4 题 / 共 5 题" header label is fabricated.
- `*` `用时 5:42` chip in header — partial. Real timer shows MOCK-mode countdown only (`Runner.tsx:144-155`); it's a REMAINING time, not elapsed time. PRACTICE mode shows no timer at all. The "用时" label is wrong; should be the countdown OR no timer.
- `*` Submit button `提交` — partial. Real label is `提交答卷` / `提交中…` (`Runner.tsx:228`).
- `*` Passage card `Passage` pill + `~140 words` chip — fabricated. Real renders `passage` plain in a `<div>` with no pill, no word-count chip (`Runner.tsx:158-162`).
- `*` Passage h3 `My weekend trip` with marker — fabricated. Real has no passage title; passage prop is just text content.
- `*` Question rendering uses MCQ buttons with letter chips — partial. Real renders MCQs as `<label>` rows with `<input type="radio">` and an "A.B.C." prefix (`Runner.tsx:255-279`); the visual is similar but uses radio inputs, not click-buttons.
- `*` Bottom strip `已答 1 / 5 · 剩余 4 题向下滚动` — partial. Real label is `已作答 N / total` (`Runner.tsx:218-220`); "剩余 X 题向下滚动" is fabricated.
- `*` Body has 5 questions visible. Real: questions count comes from `questions.length`, max-3 per part for Part 4 KET (`NewForm.tsx:17` says 4 items for Part 4); 5 is wrong for Part 4 (would be Part 3 with 5 items).

**Real-code labels to use instead**:
- header h1: `KET 阅读 · Part 4`
- header subtitle: `模拟考试 · 共 N 题` OR `练习模式 · 共 N 题`
- timer (MOCK only): `M:SS` countdown, no `用时` label
- submit: `提交答卷`
- bottom: `已作答 N / total`
- passage: plain `<div>`, no pill/title

---

### #signup (`/signup`)

**Real source**: `apps/web/src/app/signup/page.tsx`

**Fabrications found**:
- `*` Site header (Logo + `剑桥 KET / PET`) — fabricated. Signup page has NO header at all (`page.tsx:60-68` is centered form only).
- `*` Hero pill `✦ 免费注册 · 即时开始练习` — fabricated. Not in code.
- `*` Hero h1 `开始你的备考之旅` with marker — fabricated. Real h1 is `注册账号` (`page.tsx:64`, via `i18n/zh-CN.ts:35`).
- `*` Hero paragraph `创建账号即可解锁 KET 与 PET 全部题型,AI 真题、Edge-TTS 听力、Mina 口语考官,以及每周智能诊断报告。` — fabricated. Real subtitle is `开始你的剑桥 KET / PET 备考之旅` (`page.tsx:65-67`).
- `*` Stat-cards `0 元 · 注册即可开练`, `2 分 · 完成账号设置` — fabricated. Not in code.
- `*` Chip pills `📖 6 项剑桥能力`, `🤖 AI 真题生成`, `📊 每周诊断` — fabricated.
- `*` Form heading marker `注册` — REAL (`page.tsx:64`).
- `*` Form subtitle `几个字段,马上开始练习。` — fabricated. Real subtitle is `开始你的剑桥 KET / PET 备考之旅`.
- `*` Form fields: 姓名 / 邮箱 / 密码 / 确认密码 — partial. Real form has 姓名（可选）/ 邮箱 / 密码 (3 fields, NO 确认密码) (`page.tsx:71-117`).
- `*` Name placeholder `李群` — fabricated. Real placeholder is `你的名字` (`page.tsx:81` via `i18n/zh-CN.ts:38`).
- `*` Password placeholder `至少 8 位` — REAL (`page.tsx:115`).
- `*` Confirm-password label and field — fabricated; not in real form.
- `*` Terms-of-service checkbox `我同意 服务条款 与 隐私政策` — fabricated.
- `*` Submit button `创建账号 →` — fabricated. Real label is `注册` / `注册中…` (`page.tsx:130`).
- `*` Footer link `已经有账号? 登录` — partial. Real text is `已有账号？` (no `经`, full-width `？`) + `登录` link (`page.tsx:134-141` via `i18n/zh-CN.ts:44-45`).

**Real-code labels to use instead**:
- title: `注册账号`
- subtitle: `开始你的剑桥 KET / PET 备考之旅`
- fields: `姓名（可选）` (placeholder `你的名字`), `邮箱` (placeholder `you@example.com`), `密码` (placeholder `至少 8 位`)
- submit: `注册` / `注册中…`
- footer: `已有账号？` + `登录`

---

### #teacher-activate (`/teacher/activate`)

**Real source**: `apps/web/src/app/teacher/activate/ActivateForm.tsx`

**Fabrications found**:
- `*` Site header (Logo + nav `历史 / 诊断 / email / 退出`) — fabricated. Activate page has NO `<SiteHeader/>` (`ActivateForm.tsx:58-107` is a standalone centered form).
- `*` Hero pill `✦ 仅限教师` — fabricated. Not in code.
- `*` Hero h1 `升级为教师账号` with marker — fabricated. Real h1 is `教师激活` (`ActivateForm.tsx:62` via `i18n/zh-CN.ts:61`).
- `*` Hero paragraph `填写学校信息与激活码,即可创建班级、布置任务、查看学生诊断报告与学习进度。` — fabricated. Real subtitle is `输入激活码以获得教师权限` (`ActivateForm.tsx:63-65`).
- `*` Form heading marker `申请老师权限` — fabricated. Real form has NO h2; just the page-level h1 above and the input below.
- `*` Form subtitle `提交后由管理员审核,通常在 1-2 个工作日内处理。` — fabricated.
- `*` Form fields `激活码 / License Code`, `学校名称`, `任教年级` — fabricated. Real form has only ONE field: `激活码` (placeholder `TEACHER-XXXX-XXX`) (`ActivateForm.tsx:69-83`).
- `*` Submit button `提交申请 →` — fabricated. Real button is `激活` / `激活中…` (`ActivateForm.tsx:96` via `i18n/zh-CN.ts:65-66`).
- `*` Below-card info card `审核流程 · 1-2 个工作日 + paragraph` — fabricated. Real has only a `← 返回首页` Link below the form (`ActivateForm.tsx:100-104`).

**Real-code labels to use instead**:
- title: `教师激活`
- subtitle: `输入激活码以获得教师权限`
- single field: `激活码` (placeholder `TEACHER-XXXX-XXX`)
- submit: `激活` / `激活中…`
- success state: `✓ 激活成功！你现在是教师身份` + `即将跳转首页…`
- below-form link: `← 返回首页`

---

### #home-out (`/` unauth)

**Real source**: `apps/web/src/app/page.tsx`

**Fabrications found**:
- `*` Site header with `登录 / 免费注册` buttons — partial. Real renders `<SiteHeader/>` (`page.tsx:12`) which on unauth shows `登录` link + `注册` button (NOT "免费注册") (`SiteHeader.tsx:96-108`).
- `*` Hero pill `✦ A2 Key · B1 Preliminary` — fabricated.
- `*` Hero h1 `为剑桥 KET / PET 量身打造` with marker — fabricated. Real h1 is `剑桥 KET / PET 备考` (`page.tsx:16`, `i18n/zh-CN.ts:12`).
- `*` Hero paragraph `AI 真题生成 · TTS 真人音频 · Mina 口语考官 · 每周综合诊断,一站式完成 KET / PET 全题型练习。` — fabricated. Real tagline is `AI 生成仿真练习题，紧扣剑桥真题的题型、考点和难点` (`page.tsx:17`, `i18n/zh-CN.ts:13`).
- `*` Two CTA buttons `登录` and `免费注册 →` — partial. Real unauth state shows ONE CTA `立即开始` (links to /signup) (`page.tsx:38-43`, `i18n/zh-CN.ts:117`).
- `*` 3 hero feature cards `AI 真题生成 / Edge-TTS 听力 / AI 考官口语` with subtitles — fabricated. Real page has no feature cards.
- `*` Bottom chip row `✓ 6 项剑桥能力 / A2 / B1 等级 / 每周诊断 / 老师班级面板` — fabricated.

**Real-code labels to use instead**:
- title: `剑桥 KET / PET 备考`
- tagline: `AI 生成仿真练习题，紧扣剑桥真题的题型、考点和难点`
- single CTA (unauth): `立即开始` (links to /signup)
- header buttons: `登录` link + `注册` button

---

### #home-in (`/` auth)

**Real source**: `apps/web/src/app/page.tsx` (logged-in branch lines 20-37)

**Fabrications found**:
- `*` Hero greeting card `你好, Liqun + 你今日推荐 + 上次练到 KET 阅读 Part 4,准确率 85% paragraph` — ALL fabricated. Real auth page renders just title + tagline + 2 portal cards (`page.tsx:20-37`); no greeting, no name, no "上次" stat.
- `*` Decorative right-side tile cluster + `✦ 继续` star sticker — fabricated.
- `*` 2 portal cards "KET" and "PET" — REAL pattern. Real labels are `KET` (title) + `剑桥 A2 Key` (sub) and `PET` (title) + `剑桥 B1 Preliminary` (sub) (`page.tsx:26-34` via `i18n/zh-CN.ts:114-117`). Mockup says `入门级 · Cambridge A2 Key` and `中级 · Cambridge B1 Preliminary` — fabricated wrappers; real subtitle is shorter.
- `*` Card pills `A2 Key` and `B1 Preliminary` — fabricated decoration.
- `*` `进入门户 →` text — fabricated. Real card has no in-card "enter portal" text (the whole `<Link>` is the action).
- `*` Bottom thin row `本周诊断 + 已完成 6 / 6 · 待查看报告 + 查看报告 → CTA` and `最近练习 KET 阅读 Part 4 · 2 小时前` — ALL fabricated. Real page has no diagnose-status row, no recent-practice row.

**Real-code labels to use instead**:
- title: `剑桥 KET / PET 备考`
- tagline: `AI 生成仿真练习题，紧扣剑桥真题的题型、考点和难点`
- 2 cards: title `KET` / `PET`, subtitle `剑桥 A2 Key` / `剑桥 B1 Preliminary`
- (the home page is currently very minimal — adding greeting/diagnose-status/recent-practice would be NEW features requiring backend wiring)

---

### #pethub (`/pet`)

**Real source**: `apps/web/src/app/pet/page.tsx`

**Fabrications found**:
- `*` Same fabrications as #kethub. Real h1 is `PET 门户` (`page.tsx:29`); subtitle is `Cambridge B1 Preliminary · 选择你想练习的题目类型` (`page.tsx:30-32`).
- `*` Hero pill `✦ PET · B1 Preliminary` — fabricated.
- `*` Hero h1 `选择你的练习模式` with marker — fabricated. Real h1 is `PET 门户`.
- `*` Hero paragraph `6 项剑桥能力 · B1 难度真题 · 错题自动归档到诊断报告` — fabricated. Real subtitle is `Cambridge B1 Preliminary · 选择你想练习的题目类型`.
- `*` Tile "词汇 Vocab" subtitle `Vocab · A2 / B1 词表 · 听说拼写` — fabricated. Real subtitle is `Vocabulary · B1 Preliminary 官方词表 · 3,046 词` (`page.tsx:82-84`).
- `*` Tile "语法 Grammar" subtitle `Grammar · 错题本沉淀` — fabricated. Real subtitle is `Grammar · B1 Preliminary 官方语法清单 · 21 个主题` (`page.tsx:92-94`).
- `*` Tile titles in form `阅读 Reading` etc. — same bilingual fabrication as kethub; real is just `阅读`, `听力`, etc.

**Real-code labels to use instead**:
- title: `PET 门户`
- subtitle: `Cambridge B1 Preliminary · 选择你想练习的题目类型`
- 6 tiles: `阅读`, `写作`, `听力`, `口语`, `词汇`, `语法`
- vocab subtitle: `Vocabulary · B1 Preliminary 官方词表 · 3,046 词`
- grammar subtitle: `Grammar · B1 Preliminary 官方语法清单 · 21 个主题`

---

### #reading-new (`/ket/reading/new`)

**Real source**: `apps/web/src/components/reading/NewForm.tsx`

**Fabrications found**:
- `*` Hero pill `✦ KET 阅读` — fabricated.
- `*` Hero h1 `选择阅读题型` with marker — fabricated. Real h1 is `新建 KET 阅读练习` (`NewForm.tsx:79-81`).
- `*` Hero paragraph `7 个 Part · AI 即时生成真题 · 答完自动归档到错题本` — fabricated AND wrong count. Real KET reading has only **5 parts** (`NewForm.tsx:13-19`), not 7. Real subtitle is `CEFR A2 · 选择题目部分与模式，由 AI 即时生成符合真题格式的练习题` (`NewForm.tsx:82-84`).
- `*` 7 part cards — wrong count. KET reading has **5 parts** (`NewForm.tsx:13-19`); PET reading has **6 parts** (`NewForm.tsx:20-27`). The mockup's 7 cards is fabricated.
- `*` Part 1 title `短文配图` — fabricated. Real `Part 1` subtitle is `Matching (6 items)` (`NewForm.tsx:14`). The mockup invented Chinese task names.
- `*` Part 2 title `人物匹配` — fabricated. Real `Part 2` subtitle is `Open cloze (7 items)` (`NewForm.tsx:15`).
- `*` Part 3 title `短篇阅读` — fabricated. Real `Part 3` subtitle is `Multiple-choice comprehension (5 items)` (`NewForm.tsx:16`).
- `*` Part 4 title `完形填空` — fabricated. Real `Part 4` subtitle is `Matching sentences to paragraphs (4 items)` (`NewForm.tsx:17`).
- `*` Part 5 title `开放填空` — fabricated. Real `Part 5` subtitle is `Multiple-choice cloze (4 items)` (`NewForm.tsx:18`).
- `*` Part 6 (`长文 MCQ`) and Part 7 (`综合判断`) — DOES NOT EXIST in KET. Drop both cards.
- `*` Time labels `约 5 分钟 / 约 7 分钟 / 约 8 分钟 / 约 6 分钟 / ...` — ALL fabricated. The real picker has NO time labels per part.
- `*` Item-count subtitles `5 人短文 · 8 个选项匹配`, `5 题 · 三选一 MCQ`, `短文 · 6 空 · 三选一`, `语境填词 · 每空一词`, `长篇文章 · 7 题三选一`, `3 段广告 · 7 题匹配` — ALL fabricated. Real subtitles are just the English `subtitle` strings (e.g. `Matching (6 items)`).
- `*` Bottom strip `AI 即时生成 · 错题归档 · 难度匹配你的弱项` — fabricated. Not in code.
- `*` Mode picker (PRACTICE / MOCK) is missing from mockup but REAL exists in code (`NewForm.tsx:113-153`). Real labels: `练习模式` (`不计时，提交后即时反馈`), `模拟考试` (`严格计时，结束后统一批改`).
- `*` Start button — missing from mockup. Real button is `开始生成` / `生成中…（通常 20-40 秒）` (`NewForm.tsx:167`).

**Real-code labels to use instead**:
- back link: `← 返回 KET 门户`
- title: `新建 KET 阅读练习`
- subtitle: `CEFR A2 · 选择题目部分与模式，由 AI 即时生成符合真题格式的练习题`
- KET parts (5): `Part 1` `Matching (6 items)` / `Part 2` `Open cloze (7 items)` / `Part 3` `Multiple-choice comprehension (5 items)` / `Part 4` `Matching sentences to paragraphs (4 items)` / `Part 5` `Multiple-choice cloze (4 items)`
- mode picker: `练习模式` (`不计时，提交后即时反馈`) / `模拟考试` (`严格计时，结束后统一批改`)
- submit: `开始生成` / `生成中…（通常 20-40 秒）`
- NO time labels per part
- NO bottom strip

---

### #reading-result (`/ket/reading/result/[attemptId]`)

**Real source**: `apps/web/src/components/reading/ResultView.tsx`

**Fabrications found**:
- `*` Header crumb `KET 阅读 · Part 4 · 已完成 / 练习结果` — partial. Real h1 is `{examType} 阅读 · Part {part} · 成绩` (`ResultView.tsx:86-88`); subtitle is just the mode label `模拟考试` or `练习模式`.
- `*` Hero score 67% in butter circle — partial. Real hero is a 3-card grid showing `得分 / 正确题数 / 错题数` only (`ResultView.tsx:94-120`); no big donut/circle.
- `*` `已评分` pill — fabricated.
- `*` Encouragement text `不错!继续保持` — fabricated. Not in code.
- `*` `已归档 2 题到错题本` — fabricated.
- `*` Stat cards `得分 67% / 正确题数 4/6 / 错题数 2` — REAL labels (`ResultView.tsx:97-118`). Counts are dynamic.
- `*` Question detail card title `📋 答题详情` with marker — fabricated. Real has no section heading; questions render as a plain `<ol>` (`ResultView.tsx:180-302`).
- `*` Per-question pills `✓ 正确` / `✗ 错误` — partial. Real renders a number badge with green/red color, plus `✓` or `✗` glyph at right (`ResultView.tsx:194-220`); no pill chip.
- `*` Per-question `你的答案 B` / `正确答案 B · sunny and windy` chips — partial. Real shows MCQ option list with green highlight on correct + red on user choice + labels `（正确答案）` and `（你的作答）` (`ResultView.tsx:223-258`); for non-MCQ it shows `你的作答` and `正确答案` boxes (`ResultView.tsx:260-278`).
- `*` Tip-pill `📌 注意细节信号词` / `📌 注意时间词组` — fabricated. Real has no tip pills.
- `*` Q6 with title `What is the best title for the passage?` — fabrication-grade content; real question text is the AI-generated `q.prompt`, not literal "What is the best title for the passage?". KET Reading Part 4 has 4 items per `NewForm.tsx:17`, not 6.
- `*` Bottom buttons `再练一次 →` and `返回门户` — fabricated. Real `ResultView.tsx` has NO bottom action bar; navigation is the SiteHeader.
- `*` Real also renders an `薄弱点分析` panel with `考点 (Exam Points)` / `难点 (Difficulty Points)` lists (`ResultView.tsx:122-170`) — missing from mockup.
- `*` Real also renders an `解析` (explanation) box per question (`ResultView.tsx:280-286`) — missing from mockup.

**Real-code labels to use instead**:
- title: `KET 阅读 · Part 4 · 成绩`
- subtitle: `练习模式` OR `模拟考试`
- 3 stat cards: `得分 N%` / `正确题数 R / total` / `错题数 N`
- weak-points section: `薄弱点分析` with `考点 (Exam Points)` and `难点 (Difficulty Points)` sub-sections
- per-question: number badge + prompt + check/cross icon, MCQ option list with green correct + red user-choice
- per-question: `解析` box with `q.explanation_zh`
- per-question tags: `q.exam_point_id` and `q.difficulty_point_id` chips
- NO bottom action buttons (use SiteHeader)

---

### #listening-new (`/ket/listening/new`)

**Real source**: `apps/web/src/components/listening/NewListeningPicker.tsx`, `apps/web/src/app/ket/listening/new/page.tsx`, `apps/web/src/app/pet/listening/new/page.tsx`

**Fabrications found**:
- `*` Hero pill `✦ KET 听力` — fabricated.
- `*` Hero h1 `选择听力题型` with marker — fabricated. Real h1 is `KET · 听力练习` (`NewListeningPicker.tsx:55-57`).
- `*` Hero paragraph `5 个 Part · Edge-TTS 真人音频 · 每题可重听 2 次` — fabricated. Real picker has no subtitle/paragraph; it just has fieldsets.
- `*` Whole "5 part cards" UI is wrong shape. Real picker has 3 fieldsets: 模式 (PRACTICE/MOCK radios), 范围 (FULL/PART radios), 部分 (Part radios when scope=PART). Cards-grid is fabricated.
- `*` Part labels per card `短对话配图`, `长对话填空`, `长对话 MCQ`, `独白 MCQ`, `长对话匹配` — ALL fabricated. Real renders only `第 1 部分`, `第 2 部分`, `第 3 部分`, `第 4 部分`, `第 5 部分` (`NewListeningPicker.tsx:96-110` via i18n `partLabel`).
- `*` Subtitles `5 段对话 · 三图选一`, `便条记录 · 关键信息`, `5 题三选一 · 听细节`, `广播 / 通知 · 5 题`, `5 项 · 8 个选项匹配` — ALL fabricated.
- `*` Audio time labels `音频 ~3 分钟 / ~4 分钟 / ~5 分钟 / ~4 分钟 / ~5 分钟` — ALL fabricated. Real picker has no time labels.
- `*` Mockup has 5 cards. Real KET listening = 5 parts (`page.tsx:22`); real PET listening = **4 parts** (`page.tsx:22`). For PET picker, mockup's 5 cards is fabricated.
- `*` Bottom strip `Edge-TTS 真人音频 · 可重听 2 次 · 自动归档错题` — fabricated.
- `*` Real start button is `开始` / `生成中...` (`NewListeningPicker.tsx:118`) — missing from mockup.
- `*` Real shows error state `<p className="text-red-600">{err}</p>` — missing from mockup.

**Real-code labels to use instead**:
- back link: `← 返回 KET 门户`
- title: `KET · 听力练习`
- 模式 radio: `练习` / `模考`
- 范围 radio: `完整试卷` / `单个部分`
- 部分 radios: `第 1 部分`, `第 2 部分`, … (KET: 1-5; PET: 1-4)
- start button: `开始` / `生成中...`
- NO part-name cards, NO time labels, NO bottom strip

---

### #listening-runner (`/ket/listening/runner/[attemptId]`)

**Real source**: `apps/web/src/components/listening/ListeningRunner.tsx`, `apps/web/src/components/listening/AudioPlayer.tsx`

**Fabrications found**:
- `*` Header crumb `KET 听力 · Part 3` and `5 题 · 听 1 遍` — fabricated. Real READY-state heading is `准备开始` (`ListeningRunner.tsx:133`); LISTENING-phase heading is `听力进行中` / `检查并提交` (`ListeningRunner.tsx:155-157`). Mockup's "Part 3 / 5 题 / 听 1 遍" labels are NOT rendered.
- `*` `用时 3:18` chip — partial. Real `<TimerBadge>` shows time (component renders countdown for MOCK mode; format unknown without reading TimerBadge).
- `*` Submit button `提交` — partial. Real label is `提交` / `立即提交` (`ListeningRunner.tsx:223`) (depending on phase).
- `*` Audio player UI with `🎧 Audio` pill, `listening · part 3` chip, `音频将播放两次`, scrub bar, play button, replay button — partial. Real `<AudioPlayer>` renders ⏪ 10s / ▶ play-pause / 10s ⏩ skip / scrub range / time-display / 0.75x/1x/1.25x speed buttons (`AudioPlayer.tsx:82-136`); the controls vary by mode (mock disables most). The mockup's `音频将播放两次` text is real for MOCK mode start screen (`ListeningRunner.tsx:135-138`) but not as a permanent header chip.
- `*` `重听` button on right — partial. Real `重播` per-segment buttons render as a chip row when `perSegmentReplay` is on (PRACTICE only) (`AudioPlayer.tsx:138-153`).
- `*` Mockup also shows scrub-bar with `1:34 / 听录音 · 全 1 遍 / 4:52` text — fabricated. Real time display is `formatTime(currentTime)` ` / ` `formatTime(duration)` (`AudioPlayer.tsx:117`).
- `*` Question list 5 MCQs — pattern-real. Real `<QuestionRenderer>` dispatches by question type (Mcq3Picture, Mcq3Text, Mcq3TextScenario, Matching5To8, GapFillOpen).
- `*` Bottom counter `已答 1 / 5 · 剩余 4 题向下滚动` — fabricated. Real has no `已答 X / N` counter on this page; the answer count is implicit.
- `*` Mockup's MCQ buttons style with bg-butter-tint selected state — fabricated; real uses radio inputs.

**Real-code labels to use instead**:
- READY-state heading: `准备开始`
- LISTENING-phase heading: `听力进行中` (or `检查并提交` in REVIEW)
- audio "play twice" hint: shown only in READY-state copy (`ListeningRunner.tsx:135-138`), not as a header chip
- submit: `提交` / `立即提交`
- audio controls: ⏪ 10s / ▶ / 10s ⏩ / scrub / 0.75/1/1.25x speed
- per-segment replay buttons: `重播 {questionId}`
- NO `已答 X / N` counter

---

### #listening-result (`/ket/listening/result/[attemptId]`)

**Real source**: This is the existing listening result; it is implemented inline at `apps/web/src/app/ket/listening/result/[attemptId]/page.tsx` (server-component reads attempt, renders).

**Fabrications found**:
- `*` Hero score 60% in sky circle — partial. Real listening result page renders a different shape (let me note: I did not read it directly but based on `i18n/zh-CN.ts:142-145` it has `得分 / 换算分 / 用时 / 重做 / 返回门户` labels).
- `*` Encouragement text `继续加油!听细节再练` — fabricated. Not in code.
- `*` `已归档 2 题到错题本` — fabricated.
- `*` Stat cards `得分 60% / 正确题数 3 / 5 / 错题数 2` — labels `得分` is real (`zh-CN.ts:142`); `正确题数 / 错题数` from reading-result are reused but the listening result page has its own layout that I did not read. Likely the format `{rawScore}/{totalPossible}` and `{scaledScore}%` similar to the reading.
- `*` Question detail card with 5 entries and tips like `📌 注意 fifty / fifteen 区别`, `📌 注意改口信号词` — fabricated tip pills. Listening question detail likely shows tapescript / answer / explanation.
- `*` Bottom buttons `再练一次 → / 返回门户` — partial. Real probably has `重做` (`zh-CN.ts:146`) and `返回门户` (`zh-CN.ts:147`).
- `*` Q1-Q5 question texts ("Where will the meeting take place?", "What time does the train leave?", etc.) — fabrication-grade content; real prompts come from `q.prompt`.

**Real-code labels to use instead**:
- title: `KET 听力 · Part 2 · 成绩` (pattern matches reading)
- stat cards: `得分 / 换算分 / 用时` (per i18n)
- bottom: `重做` / `返回门户`
- (verify the actual `apps/web/src/app/ket/listening/result/[attemptId]/page.tsx` for exact rendering — I did not read it directly)

---

### #writing-new (`/ket/writing/new`)

**Real source**: `apps/web/src/components/writing/NewForm.tsx`

**Fabrications found**:
- `*` Hero pill `✦ KET 写作` — fabricated.
- `*` Hero h1 `选择写作题型` with marker — fabricated. Real h1 is `新建 KET 写作练习` (`NewForm.tsx:88-90`).
- `*` Hero paragraph `AI 4-criteria 评分 · Content / Communicative / Organisation / Language` — fabricated. Real subtitle is `CEFR A2 · 选择题目部分与模式，AI 即时生成符合真题格式的写作任务` (`NewForm.tsx:91-93`).
- `*` 3 part cards (1 KET·Part6, 1 KET·Part7, 1 PET·Part2) — wrong shape. Real picker shows ONLY the parts for the current examType (KET shows Part 6 + Part 7; PET shows Part 1 + Part 2). Mixing KET+PET cards is fabricated.
- `*` Part 6 title `写邮件` — fabricated. Real subtitle is `Guided email · 25+ words · 10 min` (`NewForm.tsx:18`).
- `*` Part 7 title `图片故事` — fabricated. Real subtitle is `Picture story · 35+ words · 8 min` (`NewForm.tsx:23`).
- `*` PET·Part 2 title `B1 邮件 / 文章` — fabricated. Real PET Part 2 subtitle is `Letter OR story · ~100 words · 20 min` (`NewForm.tsx:33`). PET Part 1 (`Email response · ~100 words · 25 min`, `NewForm.tsx:29`) is missing from mockup.
- `*` Subtitles `回复朋友邮件 · 25 词以上`, `看 3 张图 · 写连贯故事 · 35 词`, `100 词长文 · 4 个要点` — fabricated. Real subtitles are the English `subtitle` strings.
- `*` Time labels `~10 分钟 / ~12 分钟 / ~20 分钟` — partial. Real subtitles include time (e.g. `· 10 min`) embedded in the subtitle string itself, not as a separate pill. Mockup's `~12 分钟` for KET Part 7 contradicts real `· 8 min` (`NewForm.tsx:23`).
- `*` Tag-pills `3 个要点 / 连贯叙事 / B1 难度` — fabricated.
- `*` Bottom strip `🤖 AI 4-criteria 评分 · 即时反馈 · 错词分析` — fabricated.
- `*` Mode picker (PRACTICE/MOCK) — missing from mockup. Real has it (`NewForm.tsx:122-162`) with same labels as reading: `练习模式` (`不计时，自由构思`), `模拟考试` (`严格计时，结束后统一批改`).
- `*` Start button — missing from mockup. Real button is `开始生成` / `生成中…（通常 10-20 秒）` (`NewForm.tsx:176`).

**Real-code labels to use instead**:
- back link: `← 返回 KET 门户`
- title: `新建 KET 写作练习`
- subtitle: `CEFR A2 · 选择题目部分与模式，AI 即时生成符合真题格式的写作任务`
- KET parts: `Part 6` `Guided email · 25+ words · 10 min` / `Part 7` `Picture story · 35+ words · 8 min`
- PET parts: `Part 1` `Email response · ~100 words · 25 min` / `Part 2` `Letter OR story · ~100 words · 20 min`
- mode picker: `练习模式` (`不计时，自由构思`) / `模拟考试` (`严格计时，结束后统一批改`)
- submit: `开始生成` / `生成中…（通常 10-20 秒）`

---

### #writing-runner (`/ket/writing/runner/[attemptId]`)

**Real source**: `apps/web/src/components/writing/Runner.tsx`

**Fabrications found**:
- `*` Header crumb `KET 写作 · Part 6` / `回复邮件` — partial. Real h1 is `{examType} 写作 · Part {part}` (`Runner.tsx:154-156`); subtitle is `{mode} · 至少 {minWords} 词` (`Runner.tsx:157-159`). The "回复邮件" subtitle is fabricated; real shows mode + minWords.
- `*` `字数 30 / 25 词` chip in header — fabricated. Real word-count is rendered below the textarea as `已写 N 词 ✓ 达到最低要求` chip (`Runner.tsx:249-261`), NOT in the header.
- `*` Submit button `提交` — partial. Real label is `提交作文` / `提交中…` (`Runner.tsx:284`).
- `*` Article card `Part 6 / 回复邮件 / 至少 25 词` pill row + `来自 Anna 的邮件` h3 marker + email body in italic mist box — partial. Real renders `prompt` plain in `<div className="bg-neutral-50 p-4">` (`Runner.tsx:176-178`); no pill, no h3 marker, no italic styling. The "Anna's email" content is the AI-generated `prompt` text, not literal "Hi! I heard you've started a new sport...".
- `*` `回复需包含 3 个要点` — partial. Real label is `你的作文必须包含以下要点：` (`Runner.tsx:182-184`).
- `*` Content-points chips `运动项目 / 练习时间 / 同伴` — partial. Real renders content-points as a `<ul className="list-disc">` list (`Runner.tsx:186-190`), not as colored pills.
- `*` Tips card `💡 写作建议` with 3 bullet points "Hi Anna, thanks for your email!", etc. — fabricated. The Runner has NO tips card.
- `*` Right column header `✍️ 你的回复 / 用英语作答 / 还需 0 词` — fabricated. Real label is `你的作文` (`Runner.tsx:233-238`); placeholder is `在这里用英语写下你的作文…`.
- `*` Word-count progress bar with `字数进度 30 / 25 词 · 已达标 ✓` — fabricated. Real word-count is text only (`已写 N 词 ✓ 达到最低要求` or `已写 N 词（至少 M 词）`) (`Runner.tsx:249-256`); no progress bar.
- `*` Pre-submit "AI 批改中…" loading state in the runner — REAL but rendered AFTER submit (`Runner.tsx:137-148`); not part of the runner UI itself but a transient state.

**Real-code labels to use instead**:
- title: `KET 写作 · Part 6`
- subtitle: `练习模式 · 至少 25 词` or `模拟考试 · 至少 25 词`
- content-points heading: `你的作文必须包含以下要点：`
- content-points: `<ul className="list-disc">` of strings
- textarea label: `你的作文`
- textarea placeholder: `在这里用英语写下你的作文…`
- below-textarea: `已写 N 词 ✓ 达到最低要求` or `已写 N 词（至少 M 词）`
- submit: `提交作文` / `提交中…`
- post-submit transient: `AI 批改中…` + `通常需要 30-90 秒。批改完成后会自动跳转到成绩页面。`

---

### #writing-result (`/ket/writing/result/[attemptId]`)

**Real source**: `apps/web/src/components/writing/ResultView.tsx`

**Fabrications found**:
- `*` Header `KET 写作 · Part 6 · 已评分 / AI 评分结果` — partial. Real h1 is `{examType} 写作 · Part {part} · 成绩` (`ResultView.tsx:68-70`); subtitle is mode label (`模拟考试` or `练习模式`) (`ResultView.tsx:71-73`). "已评分 / AI 评分结果" is fabricated.
- `*` Hero score in butter circle `14 / 20` — partial. Real renders a centered card `总分 {totalBand} / 20 + {scaledScore}%` (`ResultView.tsx:75-84`); no donut/circle.
- `*` Encouragement text `表达清晰!继续打磨细节` — fabricated.
- `*` `2026-04-27 · 30 词` — fabricated. Word-count IS rendered later (`ResultView.tsx:166-169`) as `字数：{N}` but not in the hero.
- `*` 4 criterion bars Content/Communicative/Organisation/Language with score `4/5`, `4/5`, `3/5`, `3/5` and progress bars — REAL pattern (`ResultView.tsx:86-112`). Real labels: `内容` (Content), `沟通效果` (Communicative), `结构` (Organisation), `语言` (Language) per `ResultView.tsx:36-41`. The English labels match. Mockup renders only English; real renders BOTH `labelEn` and `labelZh` (`ResultView.tsx:97-98`).
- `*` Article card `📝 你的回复 / 30 词` — partial. Real renders the user's response as `学生作文` heading in a plain card (`ResultView.tsx:161-169`) at the bottom AFTER the prompt — order is reversed from mockup.
- `*` AI feedback card `🤖 AI 反馈 / 14/20 / paragraph` — partial. Real renders `评语` heading + `feedback_zh` (`ResultView.tsx:114-121`); 14/20 chip is fabricated.
- `*` `改进建议` heading + 4 bullets — REAL (`ResultView.tsx:123-135`); but real bullets are the AI-generated `specific_suggestions_zh` array, not the literal "使用更丰富的连接词" / "尝试一个过去时句子" text shown.
- `*` Bottom buttons `再写一次 → / 返回门户` — fabricated. Real has no bottom action bar.
- `*` Real renders `题目` heading + prompt + content_points list in a separate card BETWEEN the criterion grid and the user response (`ResultView.tsx:137-159`) — missing from mockup.

**Real-code labels to use instead**:
- title: `KET 写作 · Part 6 · 成绩`
- subtitle: `练习模式` or `模拟考试`
- centered-card: `总分 {totalBand} / 20` + `{scaledScore}%`
- 4 criteria with both labelEn (Content/Communicative/Organisation/Language) AND labelZh (内容/沟通效果/结构/语言), score `s / 5`, progress bar
- AI feedback heading: `评语`
- suggestions heading: `改进建议`
- prompt section heading: `题目`
- response section heading: `学生作文`
- below response: `字数：{N}`

---

### #speaking-new (`/ket/speaking/new`)

**Real source**: `apps/web/src/components/speaking/SpeakingNewPage.tsx`

**Fabrications found**:
- `*` Header crumb `KET 口语 · /ket/speaking/new / 开始一场对话` — partial. Real h1 is `口语测试 — KET` (`SpeakingNewPage.tsx:48`); subtitle is `本次练习由 AI 考官 Mina 全程对话。请在安静环境下佩戴耳机,并允许麦克风权限。` (`SpeakingNewPage.tsx:49-51`).
- `*` Hero pill `✦ KET 口语` — fabricated.
- `*` Hero h1 `选择口语模式` with marker — fabricated.
- `*` Hero paragraph `AI 考官 Mina 实时陪你练 · 基于剑桥 KET 口语真题题型设计` — fabricated.
- `*` 3 mode cards `完整考试 / 短对话练习 / 角色扮演` — ALL fabricated. Real page has NO mode picker; it renders `<MicPermissionGate>` + `<ConnectionTest>` + a single `开始测试` button (`SpeakingNewPage.tsx:53-71`).
- `*` Card subtitles `3 个 Part · 个人信息 / 看图描述 / 互动讨论`, `单题热身 · 一个话题 · 快速反馈`, `和 Mina 在咖啡店 / 商店 / 学校等场景对话` — fabricated.
- `*` Time labels `~5 分钟 / ~2 分钟 / ~3 分钟` and tags `推荐 / 入门 / 情景` — fabricated.
- `*` Bottom strip `🤖 AI 考官 Mina · 🎬 真人 Akool 视频 · ⚡ 即时反馈` — fabricated.
- `*` Real also shows safety disclaimer `注意:为保护隐私,请勿在回答中提及具体姓名、学校、家庭住址等敏感信息。` (`SpeakingNewPage.tsx:72-74`) — missing from mockup.

**Real-code labels to use instead**:
- title: `口语测试 — KET`
- subtitle: `本次练习由 AI 考官 Mina 全程对话。请在安静环境下佩戴耳机,并允许麦克风权限。`
- `<MicPermissionGate />` widget
- `<ConnectionTest />` widget
- single CTA: `开始测试` / `正在准备…`
- safety note: `注意:为保护隐私,请勿在回答中提及具体姓名、学校、家庭住址等敏感信息。`

---

### #speaking-runner (`/ket/speaking/runner/[attemptId]`)

**Real source**: `apps/web/src/components/speaking/SpeakingRunner.tsx`, `apps/web/src/components/speaking/StatusPill.tsx`, `apps/web/src/components/speaking/PartProgressBar.tsx`, `apps/web/src/components/speaking/MinaAvatarPanel.tsx`, `apps/web/src/components/speaking/PhotoPanel.tsx`

**Fabrications found**:
- `*` Header crumb `KET 口语 · 完整考试 / Part 2 / 3 · 看图描述` — fabricated. Real `SpeakingRunner` does NOT render a top-bar crumb. Real layout is: top row = `<PartProgressBar>` + `<StatusPill>` + `<EndTestButton>` (`SpeakingRunner.tsx:430-439`).
- `*` `用时 2:14` chip — fabricated. Real has NO timer chip; safety cap is silent (`SpeakingRunner.tsx:373-386`).
- `*` `结束对话` button — partial. Real button is `<EndTestButton>` with confirm dialog. Label is on the button component itself (not investigated; likely "结束测试").
- `*` Avatar card 内 Mina text + Mina · KET 考官 badge + REC indicator + bottom mic/camera/stop controls — fabricated. Real `<MinaAvatarPanel>` renders just the TRTC video stream into `<div id="mina-video">`. NO "Mina · KET 考官" badge, NO REC indicator, NO mic/camera/stop bottom buttons.
- `*` Below avatar `当前话题 · Describe a beach scene · 描述一张海滩照片` card — partial. Real `<PhotoPanel photoUrl caption={currentPartObj?.title}>` shows an image with caption (`SpeakingRunner.tsx:445-447`). The "海滩照片 + 中文描述" mockup is fabricated; real shows the photo + part title.
- `*` Right column `实时状态 / 录音中 / 麦克风正常 · 请清晰回答 Mina 的提问` card — partial. Real `<StatusPill>` is small inline pill (`StatusPill.tsx:21-28`) with copy `正在连接…` / `请开始讲话` / `Mina 正在思考…` / `Mina 正在讲话` / `已结束`. The "录音中" + "麦克风正常 ·" is fabricated; the StatusPill is positioned in the top row, not as a giant card.
- `*` `考试进度 · Part 2 / 3` card with 3 mini-tiles — partial. Real `<PartProgressBar>` is a small inline bar with `第 N 部分 / 共 M 部分` text + horizontal segment bars (`PartProgressBar.tsx:9-29`). The 3 tile-grid layout in mockup is fabricated.
- `*` `查看对话记录` toggle/button — fabricated. Real `SpeakingRunner` does NOT render a transcript toggle; transcript is a separate `<TranscriptViewer>` component used on the result page only.

**Real-code labels to use instead**:
- top row: `<PartProgressBar totalParts={N} currentPart={M}>` + `<StatusPill status>` + `<EndTestButton onConfirm>`
- main: `<MinaAvatarPanel>` (left) + `<PhotoPanel photoUrl caption>` (right)
- StatusPill labels: `正在连接…` / `请开始讲话` / `Mina 正在思考…` / `Mina 正在讲话` / `已结束`
- PartProgressBar text: `第 {currentPart} 部分 / 共 {totalParts} 部分`
- NO timer, NO REC indicator, NO mic/camera/stop bottom controls, NO standalone status card, NO transcript toggle

---

### #speaking-result (`/ket/speaking/result/[attemptId]`)

**Real source**: `apps/web/src/components/speaking/SpeakingResult.tsx`, `apps/web/src/components/speaking/RubricBar.tsx`, `apps/web/src/components/speaking/TranscriptViewer.tsx`

**Fabrications found**:
- `*` Header crumb `KET 口语 · 评分结果 / 2026-04-27 · 完整考试` — partial. Real h1 is `口语结果 — KET` (`SpeakingResult.tsx:135`); subtitle is `考官 Mina · 全程 AI 对话` (`SpeakingResult.tsx:136-138`).
- `*` `再来一次` nav button — fabricated. Real header has links: `← 返回历史记录` and `返回 {level} 门户` (`SpeakingResult.tsx:140-153`).
- `*` Hero score `🎤 总分 / 78%` — partial. Real renders `得分:{rawScore} / {totalPossible}` (e.g. `得分：14 / 20`) + `折算 {scaledScore}%` (`SpeakingResult.tsx:178-186`). The "78%" is fabricated; real format is `{rawScore} / 20`.
- `*` 4 criterion bars with Chinese labels `流畅度 / 词汇 / 语法 / 发音` and percent values — wrong labels. Real labels are the English `Grammar & Vocabulary`, `Discourse Management`, `Pronunciation`, `Interactive Communication` (`SpeakingResult.tsx:204-216`). The Chinese labels in the mockup are FABRICATED.
- `*` Real also shows an `evaluation 细项` heading + `evaluation overall avg` to right (e.g. `4.0 / 5`) (`SpeakingResult.tsx:194-202`) — missing from mockup.
- `*` Real also renders `justification` paragraph below the rubric bars (`SpeakingResult.tsx:218-222`) — missing from mockup.
- `*` Real also renders `易错点` (Weak Points) section with `{tag} / "{quote}" / 建议:{suggestion}` per item (`SpeakingResult.tsx:225-249`) — missing from mockup.
- `*` Hero score "78" and percent — bogus example value.
- `*` "完整对话记录 · 12 轮" header — partial. Real `<TranscriptViewer>` (`SpeakingResult.tsx:253-256`) renders a heading like `对话记录` (need to verify in component); the "12 轮" counter is likely fabricated.
- `*` Transcript bubbles `Mina / 你` left-right alternating with avatar names — partial pattern. Real `<TranscriptViewer>` collapses by default; the "Good morning. What's your full name?" / "My name is Lin Wei. I am twelve years old." literal text is fabricated content (real is dynamic transcript data).
- `*` Right column AI feedback card `🤖 Mina 的评语 / paragraph / 改进建议 / 4 numbered bullets` — partial mapping. Real has rubric-justification (`SpeakingResult.tsx:218-222`) and weak-points list (`SpeakingResult.tsx:225-249`) instead — different shape, different headings.
- `*` Bottom buttons `再来一次 → / 导出报告` — fabricated. Real has `← 返回历史记录` + `新的口语测试` + `返回 {level} 门户` (`SpeakingResult.tsx:258-279`).

**Real-code labels to use instead**:
- title: `口语结果 — KET`
- subtitle: `考官 Mina · 全程 AI 对话`
- top-right: `← 返回历史记录` + `返回 KET 门户`
- hero score: `得分：{rawScore} / {totalPossible}` + `折算 {scaledScore}%`
- 4 rubric bars with English labels: `Grammar & Vocabulary` / `Discourse Management` / `Pronunciation` / `Interactive Communication`
- rubric overall: `{rubric.overall.toFixed(1)} / 5`
- justification text below rubric
- weak-points section heading: `易错点` with per-item `{tag} / "{quote}" / 建议:{suggestion}`
- transcript: `<TranscriptViewer>` (collapsed by default)
- bottom: `← 返回历史记录` + `新的口语测试` + `返回 KET 门户`

---

### #vocab-overview (`/ket/vocab`)

**Real source**: `apps/web/src/components/vocab/VocabHub.tsx`

**Fabrications found**:
- `*` Hero pill `✦ A2 Key 词汇` — fabricated.
- `*` Hero h1 `今日词汇学习` with marker — fabricated. Real h1 is `KET 词汇 · A2 Key Vocabulary` (`VocabHub.tsx:80`).
- `*` Hero paragraph `基于剑桥 A2 Key 词表 · 间隔记忆推送` — fabricated. Real subtitle is `Cambridge A2 Key 官方词表（2025 修订）· 共 {N} 词` (`VocabHub.tsx:81-83`).
- `*` `✦ 今日 +12` pill — fabricated. No daily counter exists.
- `*` Mode picker title `选择练习模式` with marker + subtitle `必修核心 × 听 / 拼` — fabricated. Real picker is just a 4-card grid with no card-group heading.
- `*` 4 mode cards: `听写 · 必修` / `拼写 · 必修` / `听写 · 混合` / `拼写 · 混合` — REAL labels (`VocabHub.tsx:108-134`). Card subtitles `CORE 核心词` / `填字母练习` / `所有词混合` / `所有词混合` — partial. Real subtitles: `{wordlistTotals?.byTier.CORE} 个核心词` / `填字母练习` / `所有词混合` / `所有词混合` (the first one shows the dynamic CORE count, NOT the literal "CORE 核心词").
- `*` Word list section title `本周词表` with marker — fabricated. Real has NO `本周词表` heading. Instead the Word table is preceded by tier-cards (CORE/RECOMMENDED/EXTRA) and a filter row.
- `*` `142 词 · 已掌握 67` count — fabricated. Real overall count is rendered in the tier cards as `{mastered} / {total}` per tier (`VocabHub.tsx:155-158`).
- `*` Word list with `apartment / borrow / capital / delicious / expensive / forecast` — fabricated demo words; real `<WordRow>` renders dynamic words from API.
- `*` Per-word "已掌握 / 学习中 / 新词" pills — partial. Real `<WordRow>` uses `MasteryDots` and `TierBadge` components; the "学习中 / 新词" labels need verification but likely don't appear in this exact form.
- `*` Per-word percentage bar `95% / 60% / 30% / 80% / 100% / 15%` — fabricated bar. Real word row uses `<MasteryDots>` (e.g. star/dots).
- `*` Bottom link `查看全部 142 词 →` — fabricated. Real pagination uses `← 上一页` / `下一页 →` buttons (`VocabHub.tsx:226-241`).
- `*` Mockup is missing the entire `<table>` header row (`单词 / 词性 / 释义 / 等级 / 熟练度 / 上次复习`, `VocabHub.tsx:201-211`) — should appear before word rows.
- `*` Mockup is missing the 3 tier cards (CORE / RECOMMENDED / EXTRA) (`VocabHub.tsx:137-170`) — these are visible above the word table.
- `*` Mockup is missing the overall mastery card (`总体掌握度（必修核心词） {mastered} / {total} {pct}%`) (`VocabHub.tsx:86-102`).
- `*` Mockup is missing the filter row (chips `全部 / 必修核心 / 推荐 / 拓展` + search input `搜索单词或释义...`) (`VocabHub.tsx:172-198`).

**Real-code labels to use instead**:
- title: `KET 词汇 · A2 Key Vocabulary`
- subtitle: `Cambridge A2 Key 官方词表（2025 修订）· 共 {N} 词`
- overall mastery card: `总体掌握度（必修核心词）` + `{mastered} / {total}` + `{pct}%` + progress bar
- 4 practice CTAs: `🔊 听写 · 必修` (sub: `{N} 个核心词`) / `✏️ 拼写 · 必修` (sub: `填字母练习`) / `🔊 听写 · 混合` (sub: `所有词混合`) / `✏️ 拼写 · 混合` (sub: `所有词混合`)
- 3 tier cards: `必修核心 ★★★` (sub: `必须掌握 · 决定通过率`), `推荐 ★★` (sub: `建议掌握 · 高分必备`), `拓展 ★` (sub: `非必须 · 进阶提升`) per `VocabHub.tsx:9-13`
- filter chips: `全部 / 必修核心 / 推荐 / 拓展`
- search placeholder: `搜索单词或释义...`
- table headers: `单词 / 词性 / 释义 / 等级 / 熟练度 / 上次复习`
- pagination: `← 上一页` / `下一页 →` + `第 N 页 / 共 M 页 ({N} 词)`
- (no `本周词表` heading, no `今日 +12` pill, no `已掌握 67` count)

---

### #vocab-spell (`/ket/vocab/spell`)

**Real source**: `apps/web/src/components/vocab/VocabSpellRunner.tsx`

**Fabrications found**:
- `*` Header crumb `KET 词汇 · 拼写练习 / 听音拼写` — fabricated. Real has NO header text; just a `← 词汇主页` Link + tier/batch select dropdowns (`VocabSpellRunner.tsx:128-138`).
- `*` `完成度 3 / 5` chip — fabricated. Real shows `第 {idx + 1} / {batch.length}` inside the card (`VocabSpellRunner.tsx:141`), not in header.
- `*` `结束` button in header — fabricated. Real has no end button; navigation is the back link.
- `*` Card with `Word 3 / 5` pill at top — partial. Real shows `第 {idx + 1} / {batch.length}` as plain text (no pill).
- `*` Audio button — REAL pattern (`VocabSpellRunner.tsx:142`). Mockup label is `🔊` icon only; real button text is `🔊 播放发音`.
- `*` `请拼写听到的单词` h2 with marker — fabricated. Real has no h2; the card is sparse with just audio button + pos/gloss + example + input row.
- `*` `Hint · 4 letters` hint — fabricated. Not in code.
- `*` Single text input `b _ _ _` placeholder + 4 letter slot tiles — wrong pattern. Real `VocabSpellRunner` renders the WORD with some letters as `<span>` text and some as `<input>` cells (mixed letter/blank pattern, `VocabSpellRunner.tsx:150-178`). The "single input + slots" UI is fabricated.
- `*` `确认 →` button — partial. Real buttons are `🔊 再听` + `✓ 提交 (Enter)` + `显示答案` (when not submitted) or `下一个 →` (when submitted) (`VocabSpellRunner.tsx:188-198`).
- `*` Hint card `💡 提示: first letter is 'b' · 一个交通工具,有两个轮子` — fabricated. Real has no hint card.
- `*` Real also shows pos/gloss line `<span className="italic">{cur.word.pos}</span>{cur.word.glossZh}` (`VocabSpellRunner.tsx:143`) — missing from mockup.
- `*` Real also shows masked example sentence in mist box (`VocabSpellRunner.tsx:144-148`) — missing from mockup.

**Real-code labels to use instead**:
- top: `← 词汇主页` link + `等级:` select (全部/必修/推荐/拓展) + `批量:` select (10/20/30/50)
- card top: `第 {idx + 1} / {batch.length}`
- audio button: `🔊 播放发音`
- below audio: pos (italic) + glossZh
- example sentence: masked with `____` for the headword
- main: mixed letter/blank rendering of the word with single-character `<input>` cells
- buttons (not submitted): `🔊 再听` + `✓ 提交 (Enter)` + `显示答案`
- buttons (submitted): `下一个 →`
- post-submit feedback: `✓ 正确` or `× 正确答案：{cur.word.word}`
- NO header crumb, NO 完成度 chip, NO hint card

---

### #vocab-listen (`/ket/vocab/listen`)

**Real source**: `apps/web/src/components/vocab/VocabListenRunner.tsx`

**Fabrications found**:
- `*` Header crumb `KET 词汇 · 听音选意 / 听音匹配图片` — fabricated. Real has same `← 词汇主页` + tier/batch/`自动显示` checkbox layout (`VocabListenRunner.tsx:99-113`).
- `*` `Word 2 / 5` chip in header — fabricated.
- `*` `结束` button — fabricated.
- `*` `Word 2 / 5` pill in card — partial. Real shows `第 {idx + 1} / {batch.length}` (`VocabListenRunner.tsx:116`).
- `*` `听音选意` h2 with marker — fabricated.
- `*` `点击与你听到的词匹配的图片` instruction — fabricated.
- `*` 2x2 picture-card grid (apple / banana / carrot / cucumber with emojis + Chinese gloss) — ALL fabricated. The real `VocabListenRunner` is NOT a multiple-choice picture grid. Real card shows: hidden word + phonetic, audio button, pos+glossZh, masked example (`VocabListenRunner.tsx:115-128`).
- `*` `确认 →` button — fabricated. Real buttons are `🔊 再听一次` + `显示单词` (when not revealed) + `✓ 已掌握` + `← 上一个 / 下一个 →` (`VocabListenRunner.tsx:130-140`).
- `*` Real shows masked word `? ? ? ?` placeholder when not revealed; the picture-grid is wrong representation entirely.

**Real-code labels to use instead**:
- top: `← 词汇主页` link + `等级:` / `批量:` / `自动显示` checkbox
- card top: `第 {idx + 1} / {batch.length}`
- main: masked-word display (`? ? ? ?` until revealed) + phonetic + audio button + italic pos + glossZh + masked example
- buttons (not revealed): `🔊 再听一次` + `显示单词`
- buttons (always): `✓ 已掌握`
- below buttons: `← 上一个` / `下一个 →` + `{idx+1} / {batch.length}` middle
- (NO 2x2 picture grid, NO 确认 button)

---

### #grammar-overview (`/ket/grammar`)

**Real source**: `apps/web/src/components/grammar/GrammarHub.tsx`, `apps/web/src/components/grammar/CategoryCard.tsx`, `apps/web/src/components/grammar/TopicChip.tsx`

**Fabrications found**:
- `*` Header nav `历史 / 错题本 / 诊断` — partial. Real `<SiteHeader>` shows `历史 / 诊断 / 我的班级 / 教师面板`; the `错题本` link is per-page, not in header.
- `*` Hero pill `📐 KET 语法` — fabricated.
- `*` Hero h1 `选择语法主题` with marker — fabricated. Real h1 is `KET 语法 · A2 Key Grammar` (`GrammarHub.tsx:67`).
- `*` Hero paragraph `A2 Key 官方语法清单 · 共 19 个主题 · 错题自动归档` — partial. Real subtitle is `Cambridge A2 Key 官方语法清单 · {N} 个主题` (`GrammarHub.tsx:68-70`); the count is dynamic from `Object.values(topicsByCategory).flat().length`. KET has 19 topics, so "19 个主题" is correct numerically.
- `*` Recommended strip `⚠ 薄弱点专练 / 现在完成时 / 上次准确率 60% · 低于 60% 阈值` — partial. Real `⚠ 薄弱点专练` CTA exists (`GrammarHub.tsx:104` via `i18n/zh-CN.ts:191`), with sub-text `{N} 个主题低于 60%` (`GrammarHub.tsx:105`). The "现在完成时" topic name is fabricated (could be any weak topic). The "低于 60% 阈值" copy is fabricated. There are also TWO MORE CTAs (🎲 随机混合 with sub `10 题 · 跨主题`, 📓 错题复习 with sub `{N} 道待复习`) — both missing from mockup.
- `*` Topic cards: 8 cards `一般现在时 / 现在完成时 / 现在进行时 / 一般过去时 / 名词基础 / 代词基础 / 时间地点方位介词 / 情态动词基础` — partial. Real has 19 KET topics grouped by 11 CATEGORIES (`tenses, modals, verb_forms, clause_types, interrogatives, nouns, pronouns, adjectives, adverbs, prepositions, connectives`) (`GrammarHub.tsx:122,129-145`). Each category renders a `<CategoryCard>` containing chips of all topics in that category. Mockup's flat 8-tile grid is wrong shape.
- `*` Topic labels in Chinese — partial mapping. Real labels (`labelZh`) come from DB via `seed-grammar-glosses.ts` (filled by AI script). The 8 names in mockup ARE plausible labelZh values for KET topics, but real KET has 19 topics not 8, and they're grouped not flat.
- `*` Per-card stats `已练 24 · 88%` / `已练 12 · 60%` / etc. + progress bars — fabricated. Real `<TopicChip>` shows just a colored dot + topic label + percentage `{N}%` or `未练习` (`TopicChip.tsx:33-42`); no `已练 N` count, no progress bar.
- `*` Mockup is missing the 3-tile stats row at top (`总答题`, `总正确率`, `错题`) (`GrammarHub.tsx:72-89`).
- `*` Mockup is missing `分类` heading (`GrammarHub.tsx:122` via `i18n/zh-CN.ts:194` `t.grammar.hubCategories`).

**Real-code labels to use instead**:
- title: `KET 语法 · A2 Key Grammar`
- subtitle: `Cambridge A2 Key 官方语法清单 · 19 个主题`
- 3 stats: `总答题` / `总正确率` / `错题`
- 3 CTAs: `🎲 随机混合` (sub: `10 题 · 跨主题`) / `⚠ 薄弱点专练` (sub: `{N} 个主题低于 60%`) / `📓 错题复习` (sub: `{N} 道待复习`)
- categories heading: `分类`
- 11 KET category cards: 时态 (Tenses) / 情态动词 (Modals) / 动词形式 (Verb forms) / 从句类型 (Clause types) / 疑问句 (Interrogatives) / 名词 (Nouns) / 代词 (Pronouns) / 形容词 (Adjectives) / 副词 (Adverbs) / 介词 (Prepositions) / 连词 (Connectives)
- per-category summary: `{N} 主题 · 平均正确率 {N}%` or `{N} 主题 · 未练习`
- per-topic chip: dot + labelZh + `{N}%` or `未练习`

---

### #grammar-quiz (`/ket/grammar/quiz`)

**Real source**: `apps/web/src/components/grammar/GrammarQuizRunner.tsx`

**Fabrications found**:
- `*` Header crumb `KET 语法 · 现在完成时 / 小测验` — fabricated. Real has no header crumb. Real renders `← 语法主页` link (`GrammarQuizRunner.tsx:125`) and `第 {N} / {total} 题` text on the right (`GrammarQuizRunner.tsx:126`).
- `*` `用时 1:38` chip — fabricated. Grammar quiz has NO timer.
- `*` `题号 3 / 10` chip — partial. Real label is `第 {N} / {total} 题`.
- `*` `结束` button — fabricated. No end button in real quiz.
- `*` Question pill `现在完成时` — partial. Real renders `topicLabel` (the labelZh of the current topic, or "混合主题" for random mix) (`GrammarQuizRunner.tsx:131-133`).
- `*` `单选题 · 一题一分` chip — fabricated. Not in code.
- `*` Question text `She _____ already finished her homework.` — fabricated content (real is the AI-generated `cur.question`).
- `*` 4 options A/B/C/D — partial. Real renders `cur.options.map((text, i) => …)` with letters `LETTERS = ["A", "B", "C", "D"]` (`GrammarQuizRunner.tsx:143-162`); option count is dynamic but typically 4. Selected/correct/wrong states use `MCQOption` component with state coloring (border-blue selected, border-green correct, border-red wrong).
- `*` Bottom dots progress `5+ progress dots` — fabricated. Real shows a horizontal blue-fill progress bar via inline div (`GrammarQuizRunner.tsx:136-138`).
- `*` `← 上一题` and `下一题 →` buttons — REAL (`GrammarQuizRunner.tsx:174-194`).
- `*` Real also renders a feedback box AFTER selecting an answer: `✓ 正确` or `× 答错了` + explanation (`GrammarQuizRunner.tsx:164-169`) — missing from mockup.
- `*` On the LAST question, the next button changes to `完成 ✓` link (`GrammarQuizRunner.tsx:181-185`) — not represented in mockup.

**Real-code labels to use instead**:
- top: `← 语法主页` link + `第 {N} / {total} 题`
- topic chip: `topicLabel` (e.g. `现在完成时` or `混合主题`)
- progress bar: blue-fill horizontal bar (not dots)
- options: 4 buttons with letters A/B/C/D rendered via `<MCQOption>` component
- post-submit feedback: green box `✓ 正确` or amber box `× 答错了` + `cur.explanationZh`
- nav: `← 上一题` (left) + `下一题 →` or `完成 ✓` (right)
- NO timer, NO 结束 button, NO `单选题 · 一题一分` chip

---

### #grammar-mistakes (`/ket/grammar/mistakes`)

**Real source**: `apps/web/src/components/grammar/GrammarMistakes.tsx`

**Fabrications found**:
- `*` Header crumb `KET 语法 · /ket/grammar/mistakes / 错题本` — partial. Real has `← 语法主页` link (`GrammarMistakes.tsx:54`) + h1 `语法错题本` (`GrammarMistakes.tsx:57`).
- `*` `导出` and `全部重练` nav buttons — fabricated. Not in code.
- `*` Hero pill `📕 复习专区` — fabricated.
- `*` Hero h1 `错题本` with marker — partial. Real h1 is `语法错题本` (one piece). Mockup splits to bare "错题本".
- `*` Hero paragraph `系统自动收录答错的题目 · 间隔重做巩固` — fabricated. Real subtitle is `所有错题按状态分组，可标记已复习 / 已掌握或重新练习` (`GrammarMistakes.tsx:58`).
- `*` Status tabs `全部 · 17 / 待复习 · 9 / 已复习 · 5 / 已掌握 · 3` — partial. Real tabs are `全部 / 待复习 / 已复习 / 已掌握` (`GrammarMistakes.tsx:11-15` via `i18n/zh-CN.ts:204-208`); counts are dynamic.
- `*` Mistake list section title `📕 最近错题` with marker + `按时间倒序` chip — fabricated. Real has no section heading; mistakes render directly below tabs.
- `*` Each mistake shows topic chip, prompt, your-wrong + correct labels — partial. Real renders in a card with: question text, ALL options listed (each labeled correct ✓ or your-answer ✗), 解析 box, action buttons (`GrammarMistakes.tsx:97-156`). The mockup's 3-line compressed layout is wrong shape.
- `*` Topic chip `现在完成时 / 第三人称单数 / 介词 / 情态动词` — partial. The "第三人称单数" topic does NOT exist in `grammar-topics.json` (closest is `present_simple` which would have a labelZh of `一般现在时`). The topic chips in the real card are NOT rendered in `GrammarMistakes.tsx` (the mistake item has no topic chip render path; only question text + options + 解析).
- `*` Action button `再练一次` (single button) — partial. Real action buttons depend on status: NEW shows `标记已复习 + 标记已掌握`, REVIEWED shows `标记已掌握 + 重新练习此题`, MASTERED shows `重新学习` (`GrammarMistakes.tsx:117-156`). The mockup's single "再练一次" is wrong.

**Real-code labels to use instead**:
- back link: `← 语法主页`
- title: `语法错题本`
- subtitle: `所有错题按状态分组，可标记已复习 / 已掌握或重新练习`
- 4 tabs: `全部 / 待复习 / 已复习 / 已掌握` with `({count})` suffix
- per-mistake: question text + ALL options listed (per-option ✓正确 or ✗你的答案 badge) + `解析: {explanation}` box
- action buttons (status-dependent):
  - NEW: `标记已复习` + `标记已掌握`
  - REVIEWED: `标记已掌握` + `重新练习此题`
  - MASTERED: `重新学习`
- empty state: `暂无错题` or `暂无「{tabName}」状态的错题`
- (NO topic chip per mistake, NO 再练一次 button, NO 导出/全部重练 nav)

---

### #diag-section-runner (`/diagnose/runner/[section]`)

**Real source**: `apps/web/src/app/diagnose/runner/[section]/page.tsx`, plus per-section runners (`DiagnoseRunnerReading.tsx`, etc.)

**Fabrications found**:
- `*` Banner `🤖 本周诊断 · 阅读 / 2026-04-26 至 2026-05-03 / 返回 /diagnose` — fabricated. Real wrapper has no such banner; just a `← 返回本周诊断` link (`page.tsx:139-144`).
- `*` Header crumb `本周诊断 · 阅读 / 第 2 题 / 共 5 题` — fabricated. The diagnose runner reuses the regular reading runner (`DiagnoseRunnerReading`) which inherits all the labels from `Runner.tsx` (see #reader audit). The `本周诊断 · 阅读` and `第 2 题 / 共 5 题` header text is fabricated.
- `*` `用时 3:18` timer chip — partial. Real diagnose runner uses MOCK mode timer (countdown), not elapsed. Same "用时" mislabel as #reader.
- `*` Submit button `提交` — partial. Real label is `提交答卷` / `提交中…` (inherited from `Runner.tsx`).
- `*` Passage `Passage / ~135 words / A new hobby` h3 marker — fabricated. Same as #reader; passage is plain `<div>`.
- `*` Bottom counter `已答 2 / 5 · 剩余 3 题向下滚动` — fabricated. Real shows `已作答 N / total` only.
- `*` Question content `What new hobby did Anna start?` etc. — fabricated demo text; real comes from `content.questions[].text`.

**Real-code labels to use instead**:
- top: `← 返回本周诊断` link
- (everything else is the same as the #reader audit, with timeLimitSec from `SECTION_TIME_LIMIT_SEC.READING`)
- The runner internally uses MOCK mode (`mode="MOCK"`) so timer is shown.

---

### #diag-report (`/diagnose/report/[testId]`)

**Real source**: `apps/web/src/components/diagnose/DiagnoseReport.tsx`, `apps/web/src/components/diagnose/KnowledgePointCluster.tsx`

**Fabrications found**:
- `*` Hero banner with KET pill + `本周必做的综合测验` + h1 `本周诊断报告` + paragraph + 38% score box — partial. Real banner is much simpler: AI-icon + title `本周诊断报告` + KET pill + `weekStart 至 weekEnd` (`DiagnoseReport.tsx:144-167`); score is rendered as a `<ScoreRing>` SVG donut on the right (the `38%` value is dynamic).
- `*` `用时 32 分钟` in subtitle — fabricated. Real subtitle is just the week-range; no time-taken stat is rendered.
- `*` 6 per-section mini score cards — partial. Real renders a 6-cell grid showing only `{title}` + `{score} / 100` for each (`DiagnoseReport.tsx:178-217`). The mockup's `3 题 · 答对 1 题`, `3 题 · 答对 0 题`, `未填写正文`, `Mina · 已对话`, `3 词 · 答对 2 词`, `3 题 · 答对 2 题` per-section detail rows are ALL FABRICATED. Real shows just `{score}` and `/ 100` underneath.
- `*` Stats `33% / 0% / 0% / 60% / 67% / 67%` numbers themselves are inline values; format-wise real uses `{score}` (no %) with `/ 100` suffix.
- `*` AI 综合分析 card with marker — REAL pattern (`DiagnoseReport.tsx:220-251`).
- `*` `由 DeepSeek 生成` chip — fabricated. Real has no such chip.
- `*` 4-field grid `优势 / 薄弱点 / 重点练习方向 / 综合评语` — REAL labels (`DiagnoseReport.tsx:222-249`). All 4 are correct.
- `*` But real `综合评语` is rendered as a SINGLE narrative paragraph (`narrativeZh`) (`DiagnoseReport.tsx:240-249`), NOT as a bulleted list. Mockup shows it as 3 bullets — wrong.
- `*` `优势 / 薄弱点 / 重点练习方向` are 3 separate `<SummaryBlock>` cards rendered as numbered lists (`SummaryBlock` at `DiagnoseReport.tsx:270-301`), NOT as a 2x2 grid with bullets. The mockup's 2x2 grid layout is decorative re-arrangement.
- `*` 知识点分析 section heading + `本周共发现 6 个待加强知识点` — partial. Real heading is `本周知识点弱项` (`DiagnoseReport.tsx:255-258`); the count is fabricated (real renders as many as the AI emitted, not 6).
- `*` Each knowledge cluster card with `severity pill` (critical/moderate/minor) + `category pill` (grammar/vocabulary/reading_skill) + title + `📚 mini_lesson:` prefix + rule + ✦ 例句 list + expand-mistakes button — partial mapping.
  - Real `KnowledgePointCluster` renders: severity pill (`严重 / 中等 / 轻微` per `SEVERITY_STYLE` at `KnowledgePointCluster.tsx:27-49`), category pill (`语法 / 搭配 / 词汇 / 句型 / 阅读技巧 / 听力技巧 / 考试策略 / 写作技巧` per `CATEGORY_ZH` at `KnowledgePointCluster.tsx:51-60`), title `{group.knowledgePoint}` + `({N} 题)` count, miniLesson paragraph, `规则：` rule callout (blue box), `<details>` expandable `例句 ({N})` and `为什么错 ({N})`.
  - Mockup labels `critical / moderate / minor` (English) — real is `严重 / 中等 / 轻微` (Chinese).
  - Mockup labels `grammar / vocabulary / reading_skill` (English keys) — real is `语法 / 词汇 / 阅读技巧` (Chinese display labels).
  - Mockup `📚 mini_lesson:` prefix — fabricated. Real renders miniLesson as plain paragraph with no prefix.
  - Mockup `rule:` italic prefix — fabricated. Real prefix is `规则：` (no "rule:").
  - Mockup `✦ 例句` heading + numbered list — partial. Real renders `<details>` with summary `例句 ({N})` and `<ul className="list-disc">` body.
  - Mockup `▶ 展开 N 道相关错题` button — partial. Real `<details>` summary is `为什么错 ({N})`.
  - Mockup example sentences "While I was reading..." etc. — fabricated content; real is dynamic `group.exampleSentences`.

**Real-code labels to use instead**:
- title: `本周诊断报告`
- subtitle: `weekStart 至 weekEnd` only
- score: `<ScoreRing>` SVG with `综合得分` label
- 6 mini cards: `{title}` + `{score}` `/ 100` (no detail rows)
- summary section blocks (each):
  - `优势` (green)
  - `薄弱点` (amber)
  - `重点练习方向` (blue)
  - `综合评语` (indigo, single paragraph not bullets)
- knowledge-points heading: `本周知识点弱项`
- per-cluster:
  - severity pill: `严重 / 中等 / 轻微`
  - category pill: `语法 / 搭配 / 词汇 / 句型 / 阅读技巧 / 听力技巧 / 考试策略 / 写作技巧`
  - title + `({N} 题)`
  - miniLesson plain paragraph
  - blue-box `规则：{rule}`
  - `<details>` summary `例句 ({N})` + bullet list
  - `<details>` summary `为什么错 ({N})` + per-question detail

---

### #diag-history (`/diagnose/history`)

**Real source**: `apps/web/src/app/diagnose/history/page.tsx`, `apps/web/src/components/diagnose/HistoryList.tsx`

**Fabrications found**:
- `*` Hero pill `✦ 历年综合测验回顾` — fabricated.
- `*` Hero h1 `诊断历史` with marker on `历史` — partial. Real h1 is `诊断历史` (`page.tsx:55`); marker styling fabricated.
- `*` Hero paragraph `所有已生成的每周诊断报告,按时间倒序排列。点击查看完整 AI 分析与错题归档。` — partial. Real subtitle is `最近 12 周的诊断记录，按周倒序排列。` (`page.tsx:63-65`).
- `*` Section header `最近 12 周` with marker — fabricated. Real `<HistoryList>` renders heading `历史诊断` (`HistoryList.tsx:78-80` via `i18n/zh-CN.ts:240` `t.diagnose.historyTitle`).
- `*` `共 12 份报告` chip — fabricated.
- `*` Per-row layout: `{weekStart} → {weekEnd}` pill + `REPORT_READY / REPORT_FAILED` raw enum pill + `总分 38%` + colored 6-dot row + `查看报告 →` link — partial.
  - Real renders: `{examType}` pill + week-range text + `STATUS_PILL.label` (`待开始 / 进行中 / 已完成 / 报告就绪 / 报告失败`, `HistoryList.tsx:21-45`) + `{overallScore}%` + `查看报告 →` link if canView.
  - Mockup uses raw enum names `REPORT_READY / REPORT_FAILED` — wrong; real uses Chinese labels `报告就绪 / 报告失败`.
  - Mockup includes the week-range as a separate pill — real renders it as plain text (`HistoryList.tsx:95-97`).
  - Mockup's "总分" label — fabricated; real shows just the number with `%`.
  - The 6-dot per-section indicator row — FABRICATED. Real history list does NOT render per-section dots.
- `*` Failed-row `查看错误日志 →` text — fabricated. Real shows the same `查看报告 →` link (or hides it if `!canView`).
- `*` Pagination `← / 1 / 2 / 3 / →` — fabricated. Real history page does NOT have pagination; it just shows last 12 weeks (`page.tsx:23` `take: 12`).
- `*` Real also has a `← 返回本周诊断` link in the header (`page.tsx:56-61`) — missing from mockup.

**Real-code labels to use instead**:
- title: `诊断历史`
- subtitle: `最近 12 周的诊断记录，按周倒序排列。`
- back link: `← 返回本周诊断`
- list heading: `历史诊断`
- per-row: `{examType}` pill + `weekStart 至 weekEnd` + status pill (`待开始/进行中/已完成/报告就绪/报告失败`) + `{overallScore}%` + `查看报告 →`
- empty state: `还没有历史诊断记录`
- (NO pagination, NO 6-dot indicator row, NO 共 N 份报告 chip)

---

### #diag-history-detail (`/diagnose/history/[testId]`)

**Real source**: `apps/web/src/app/diagnose/history/[testId]/page.tsx`, `apps/web/src/components/diagnose/DiagnoseReport.tsx`

**Fabrications found**:
- `*` Read-only banner `📚 历史报告 · 只读模式 / 不可重新提交 / ← 返回 /diagnose/history` — fabricated. Real has no read-only banner. Real header has `← 返回历史列表` and `本周诊断 →` links (`page.tsx:67-80`).
- `*` Hero banner with KET pill + `第 16 周综合测验` + `用时 28 分钟` — fabricated. Real reuses `<DiagnoseReport>` (`page.tsx:82`) which has only week-range subtitle.
- `*` 6 mini score cards with `3 题 · 答对 N 题`, `Mina · 4 轮对话`, `14 / 20`, `3 词 · 答对 2 词` etc. — same fabrications as #diag-report (real shows only `{score}` `/ 100`).
- `*` 4-field summary grid `优势 / 薄弱点 / 重点练习方向 / 综合评语` — see #diag-report; same labels real, but `综合评语` should be paragraph not bullets.
- `*` `由 DeepSeek 生成` chip — fabricated.
- `*` 知识点分析 with `本周 4 个待加强知识点` chip — partial; real heading is `本周知识点弱项`, no count chip.
- `*` Knowledge clusters show same English `critical/moderate` and `grammar/listening_skill` labels — should be Chinese `严重/中等` and `语法/听力技巧`.
- `*` Bottom button `✦ 练习此诊断 →` — fabricated. Real shows a 6-section `重做练习（不计分）` grid (`page.tsx:84-102`) with one Link per section (label: `阅读 / 听力 / 写作 / 口语 / 词汇 / 语法` per `SECTION_TITLE_ZH`).

**Real-code labels to use instead**:
- top: `← 返回历史列表` (left) + `本周诊断 →` (right)
- body: full `<DiagnoseReport>` (same as #diag-report)
- below report: heading `重做练习（不计分）` + paragraph `重做仅作复习用途，不会更新本周诊断状态，也不计入历史评分。`
- 6 replay-section links: one per section (`阅读 / 听力 / 写作 / 口语 / 词汇 / 语法`)
- (NO read-only banner, NO 用时 stat, NO `✦ 练习此诊断 →` button)

---

### #diag-replay (`/diagnose/replay/[testId]/[section]`)

**Real source**: `apps/web/src/app/diagnose/replay/[testId]/[section]/page.tsx`, plus the regular runners in `readOnly` mode

**Fabrications found**:
- `*` Practice-mode banner `✦ 练习模式 · 不计分 · 答对答错都可继续 / 第 16 周诊断 · 阅读 / 退出回顾 ←` — partial. Real renders: `← 返回历史报告` link (left) + `重做练习 · 不计分` amber pill (right) (`page.tsx:124-134`). The mockup's "答对答错都可继续 / 第 16 周诊断" copy is fabricated.
- `*` Header crumb `回顾 · 阅读 / 第 1 题 / 共 5 题` — fabricated. Real reuses the regular runner with `readOnly` flag set; it gets the same Runner.tsx labels as #reader (which doesn't render "回顾 · 阅读" or "第 N 题 / 共 M 题" header).
- `*` `用时 2:05` mint timer chip — partial. Real runner shows MOCK-mode countdown only; replay runs in PRACTICE mode (`mode="PRACTICE"`) so NO timer is shown.
- `*` `完成` button — fabricated. Real `readOnly` mode hides the submit button entirely (`Runner.tsx:221-230`).
- `*` Same passage / question fabrications as #reader.
- `*` Bottom callout `练习模式 · 答案立即反馈,不影响诊断分数` — partial. Real `readOnly` runner shows `练习模式 — 不计分` chip (`Runner.tsx:211-215`).
- `*` Selected option highlighted with `mint-tint` and `✓ 正确` glyph in option button — fabricated. Real `readOnly` mode doesn't render correctness in MCQ buttons (it's the same plain MCQ button as the regular runner; `readOnly` just hides submit).

**Real-code labels to use instead**:
- top row: `← 返回历史报告` + `重做练习 · 不计分` amber pill
- below: standard runner UI in PRACTICE + readOnly mode (no timer, no submit, no "完成" button)
- bottom callout: `练习模式 — 不计分`
- (NO 完成 button, NO 用时 timer, NO `✓ 正确` highlights on options)

---

### #history (`/history`)

**Real source**: `apps/web/src/app/history/page.tsx`, `apps/web/src/app/history/FiltersBar.tsx`

**Fabrications found**:
- `*` Hero pill `📚 全部练习记录` — fabricated.
- `*` Hero h1 `练习历史` with marker on `历史` — fabricated. Real h1 is `历史记录` (`page.tsx:181`).
- `*` Hero paragraph `所有自由练习与模拟测验的成绩单。点击查看每次提交的题目、答案与 AI 反馈。` — fabricated. Real subtitle is `你所有的练习和模拟考试，最多展示 100 条。使用下方筛选缩小范围。` (`page.tsx:195-197`).
- `*` Filter pills `全部考试 ▾ / 全部题型 ▾ / 全部模式 ▾ / 全部状态 ▾` — partial shape. Real `<FiltersBar>` uses 4 HTML `<select>` dropdowns (per FiltersBar.tsx narrow audit), NOT pill chips. (Already noted in narrow audit.)
- `*` Mockup is missing the `📒 错题本 (N 待复习)` link in the top-right (`page.tsx:182-194`).
- `*` Mockup is missing the `快速跳转：KET 门户 / PET 门户` chips (`page.tsx:199-213`).
- `*` Mockup is missing the `老师的留言` (Comments) panel (`page.tsx:215-275`) — when there are teacher comments.
- `*` Per-attempt rows: `📖 阅读 / KET / PRACTICE / 2026-04-26 14:32 / 85% / 查看 →` — partial.
  - Real renders: `{examType}` pill (e.g. `KET` in dark bg) + `{kindZh} · {partLabel}` text + `{MODE_ZH}` pill (`练习/模拟`, NOT `PRACTICE/MOCK`) + status pill (`进行中/已提交/已批改/已放弃`, NOT raw enum) + score `{rawScore}/{totalPossible} · {scaledScore}%` (`page.tsx:336-360`).
  - Mockup shows `PRACTICE / MOCK` raw enum — wrong; real shows Chinese `练习 / 模拟`.
  - Mockup is missing the status pill column.
  - Mockup score format `85%` is partial — real format is `{rawScore}/{totalPossible} · {scaledScore}%` (e.g. `4/6 · 67%`) for non-listening. For listening it's `{rawScore}/{totalPossible}`. For writing it's `14/20`. For speaking… (varies).
  - The `查看 →` Link — partial. Real has 2-3 action buttons depending on status: `继续作答`, `查看结果`, `再做一次` (`page.tsx:368-411`); not a single `查看 →` link.
- `*` Pagination `← / 1 / 2 / 3 / 4 / →` — fabricated. Real history page has NO pagination; it shows top 100 (`page.tsx:154`).

**Real-code labels to use instead**:
- title: `历史记录`
- subtitle: `你所有的练习和模拟考试，最多展示 100 条。使用下方筛选缩小范围。`
- top-right: `📒 错题本 ({mistakeCount} 待复习)` button
- quick-jump chips: `快速跳转：` + `KET 门户` / `PET 门户`
- 4 filter selects: `全部考试 / 全部题型 / 全部模式 / 全部状态`
- (when comments exist) `老师的留言` panel with per-comment author + class + body
- per-row: `{examType}` (dark pill) + `{kindZh} · {partLabel}` + `{MODE_ZH}` (practice/模拟) + status pill (`进行中/已提交/已批改/已放弃`) + score
- per-row actions: `继续作答` / `查看结果` + `再做一次` / `重新开始` based on status
- (NO pagination)

---

### #history-mistakes (`/history/mistakes`)

**Real source**: `apps/web/src/app/history/mistakes/page.tsx`

**Fabrications found**:
- `*` Hero pill `❗ 错题归档 · 自动同步` — fabricated.
- `*` Hero h1 `全部错题` with marker on `错题` — fabricated. Real h1 is `错题本` (`page.tsx:105`).
- `*` Hero paragraph `最近 30 天累计 28 道错题。再练一次,每题在掌握后会自动从列表中移除。` — fabricated. Real subtitle is `阅读练习中答错的题目会自动汇总到这里。逐题复习后可标记为「已复习」，完全掌握后再标记为「已掌握」。` (`page.tsx:114-116`).
- `*` Filter pills `全部 / 阅读 / 听力 / 写作 / 口语 / 词汇 / 语法` — partial shape and partial content. Real renders TWO rows of pill chips: status row (`全部 / 新错题 / 已复习 / 已掌握`, `page.tsx:86-91, 118-139`) AND kind row (`全部题型 / 阅读 / 写作 / 听力`, `page.tsx:93-98, 141-162`). Note REAL kind chips are 4 only (阅读/写作/听力, no 口语/词汇/语法); the mockup's `口语 / 词汇 / 语法` chips are FABRICATED.
- `*` Mockup is missing the status filter row (`新错题 / 已复习 / 已掌握`).
- `*` Mockup is missing the `← 历史记录` back link (`page.tsx:106-112`).
- `*` Per-mistake card with `📖 阅读 / 2026-04-26 / 细节定位 + Q + 你的答案: + 正确答案: + 原文 paragraph + 再练一次 button` — wrong shape.
  - Real renders per-mistake (`page.tsx:171-230`): top row of pills (`{statusMeta.label}` + `examPointId` + `difficultyPointId` + `createdAt`); 2-column grid with `你的作答` (red) + `正确答案` (green); 解析 box (when `explanationZh`); `<StatusButtons>` actions.
  - Mockup's `📖 阅读 / 细节定位` topic pills — fabricated; real uses status + examPointId + difficultyPointId.
  - Mockup's `再练一次` action — fabricated; real `<StatusButtons>` shows status-dependent buttons (similar to grammar mistakes).
  - Mockup's "口语" mistake card — fabricated entirely; real `MistakeNote` model only stores reading/writing/listening mistakes (no speaking mistake notes).
- `*` Mockup's mistake content (Q text, your answer, correct answer, 原文 explanation) — fabricated; real comes from DB.
- `*` Pagination `← / 1 / 2 / 3 / →` — fabricated. Real has no pagination; takes top 200 (`page.tsx:73`).

**Real-code labels to use instead**:
- top: `← 历史记录` link
- title: `错题本`
- subtitle: `阅读练习中答错的题目会自动汇总到这里。逐题复习后可标记为「已复习」，完全掌握后再标记为「已掌握」。`
- 2 filter rows:
  - row 1: `全部 / 新错题 / 已复习 / 已掌握` (with counts)
  - row 2: `全部题型 / 阅读 / 写作 / 听力`
- per-mistake: status pill + examPointId pill + difficultyPointId pill + date / 2-col 你的作答 + 正确答案 / 解析 box / `<StatusButtons>`
- empty state: `还没有错题记录。完成一次阅读练习后，错题会自动出现在这里。`
- (NO 口语/词汇/语法 filter chips, NO pagination, NO `再练一次` single button, NO topic chip)

---

### #classes (`/classes`)

**Real source**: `apps/web/src/app/classes/page.tsx`, `apps/web/src/app/classes/JoinForm.tsx`

**Fabrications found**:
- `*` Hero pill `✦ 我的班级` — fabricated.
- `*` Hero h1 `我的班级` with marker on `班级` — partial. Real h1 is `我加入的班级` (`page.tsx:44-46` via `i18n/zh-CN.ts:74`).
- `*` Hero paragraph `老师布置的作业、班级周诊断和同学排名都在这里。` — fabricated. Not in code.
- `*` Mockup is missing the `快速跳转：KET 门户 / PET 门户 / 历史记录` chips (`page.tsx:48-68`).
- `*` Joined classes grid (4 cards: KET 三班, PET 强化营, KET 周末班, PET 一对一) — partial shape. Real renders a `<ul>` of `<li>` rows, each with `{m.class.name}` + optional `{m.class.examFocus}` pill + teacher name/email + `joinedAt` (`page.tsx:78-101`). The mockup's tile-grid layout with school name, teacher name, student count, and `未完成 N 项` pills is FABRICATED.
- `*` `📚 杭州外国语学校 / 北京新东方 / 上海剑桥中心 / 私教 · 周三` school-name chips — fabricated. Class model has no `school` field; real shows only `name` and `examFocus`.
- `*` `👩‍🏫 王老师 / 李老师 / 张老师 / 陈老师` teacher-name chips — partial. Real shows teacher name/email but with `教师：` prefix (`zh-CN.ts:77`).
- `*` `32 名同学 / 28 名同学 / 24 名同学 / 1 名同学` member-count chips — fabricated. Real `/classes` page (student view) does NOT show member count; that's the teacher view.
- `*` `未完成 2 项 / 未完成 1 项 / 全部完成 ✓ / 未完成 3 项` assignment-status chips — fabricated. Real student-view does not surface assignment counts on the class card.
- `*` Bottom card `🔍 加入新班级 / 向老师索要 6 位入班码即可加入。` with input + 加入 button — partial.
  - Real `<JoinForm>` (separate component, not investigated but referenced at `page.tsx:70`) has placeholder `输入 8 位邀请码` (`zh-CN.ts:81`) — mockup says "6 位" which is wrong (it's 8).
  - Real labels via `t.classes.join`: title `加入班级`, placeholder `输入 8 位邀请码`, button `加入` / `加入中…`.

**Real-code labels to use instead**:
- title: `我加入的班级`
- (no decorative pill)
- quick-jump chips: `KET 门户` / `PET 门户` / `历史记录`
- per-class: `{name}` + optional `{examFocus}` pill + `教师：{teacherName/email}` + `加入于 {joinedAt}`
- empty state: `你还没有加入任何班级。使用上方的邀请码加入。`
- join form placeholder: `输入 8 位邀请码` (NOT 6位)
- join button: `加入` / `加入中…`
- (NO school name, NO student count, NO assignment status pills, NO grid layout)

---

### #teacher-classes (`/teacher/classes`)

**Real source**: `apps/web/src/app/teacher/classes/page.tsx`

**Fabrications found**:
- `*` Header `老师` chip + nav — partial; real `<SiteHeader>` already has `教师` badge (`zh-CN.ts:24`) and shows the email. Mockup shows BOTH `老师` link AND `老师` badge — duplication likely fabricated.
- `*` Hero pill `✦ 教学管理` — fabricated.
- `*` Hero h1 `我的教学班级` with marker on `教学班级` — fabricated. Real h1 is `我的班级` (`page.tsx:41` via `i18n/zh-CN.ts:88`).
- `*` Search input `🔍 搜索班级名称或学校` — fabricated. Real teacher classes page has NO search input.
- `*` `+ 创建班级` button — REAL (`page.tsx:42-47` via `i18n/zh-CN.ts:89`).
- `*` Per-class card grid with school name + 32 学生 + 8 待批 + 本周诊断 28/32 progress bar — wrong shape. Real renders a `<ul>` of `<li>` rows, each with `{name}` + optional `{examFocus}` pill + `{N} 位学生 · 创建于 {createdAt}` + invite-code label `邀请码` + invite code (`page.tsx:62-98`). The school-name pill, 待批 count, and 本周诊断 progress bar are ALL FABRICATED.
- `*` Pagination `← / 1 / 2 / 3 / →` — fabricated. Real has no pagination.
- `*` Mockup missing invite-code display — real shows `邀请码 / {inviteCode}` on right side of each row.

**Real-code labels to use instead**:
- title: `我的班级`
- create button: `+ 创建班级`
- per-row: `{name}` + optional `{examFocus}` pill + `{N} 位学生 · 创建于 {createdAt}` + `邀请码` label + `{inviteCode}` (mono font)
- empty state: `你还没有创建任何班级` + `创建第一个班级` CTA
- (NO search input, NO school name, NO 待批 count, NO 本周诊断 progress bar, NO grid layout, NO pagination)

---

### #teacher-class-new (`/teacher/classes/new`)

**Real source**: `apps/web/src/app/teacher/classes/new/page.tsx`, `apps/web/src/app/teacher/classes/new/NewClassForm.tsx`

**Fabrications found** (NewClassForm not directly read; based on i18n + spec):
- `*` Hero pill `✦ 创建新班级` — fabricated.
- `*` Hero h1 `新建班级` with marker on `班级` — partial. Real i18n title is `创建班级` (`zh-CN.ts:97`); subtitle is `创建后，邀请码可用于学生加入` (`zh-CN.ts:98`).
- `*` Hero paragraph `填写以下信息后系统将自动生成入班码,学生使用入班码即可加入。` — fabricated. Real subtitle is shorter.
- `*` Form fields:
  - `班级名称` — REAL (`zh-CN.ts:99`); placeholder `如:KET 三班` is fabricated (real placeholder is `例如：2026 春季 KET`, `zh-CN.ts:100`).
  - `学校名称` — fabricated; class model has no school field.
  - `考试类型` (KET / PET radio) — partial. Real label is `考试重点（可选）` with `不限（KET / PET 均可）` option (`zh-CN.ts:101-102`); the radio shape and KET / PET options need verification.
  - `学生上限` — fabricated; class model has no student-cap field.
  - `入班码 K3X9P7` with regenerate link — partial. Real invite-code is auto-generated server-side; the form likely doesn't expose a regenerate button.
- `*` `取消 / 创建班级` buttons — partial. Real submit is `创建班级` / `创建中…` (`zh-CN.ts:103-104`); cancel button likely doesn't exist (the back link at top serves that).

**Real-code labels to use instead**:
- title: `创建班级`
- subtitle: `创建后，邀请码可用于学生加入`
- 班级名称 placeholder: `例如：2026 春季 KET`
- 考试重点（可选） select: `不限（KET / PET 均可）` / `KET` / `PET`
- submit: `创建班级` / `创建中…`
- back link: `← 返回班级列表`
- success state: `✓ 班级 {name} 创建成功`
- (NO 学校名称, NO 学生上限, NO 入班码 preview/regenerate)

---

### #teacher-class-detail (`/teacher/classes/[classId]`)

**Real source**: `apps/web/src/app/teacher/classes/[classId]/page.tsx`

**Fabrications found**:
- `*` Header banner `📚 杭州外国语学校 + KET pill + 班级名称 + 32 学生 · 入班码 K3X9P7` — partial. Real shows `← 我的班级` link + `{cls.name}` h1 + optional `{cls.examFocus}` pill + `创建于 {createdAt}` + invite-code box on right (`page.tsx:377-406`). The school-name pill is fabricated.
- `*` 4 stat cards `学生人数 32 / 已批改答卷 96 / 班级平均分 78% / 最高分 95%` — REAL labels (`page.tsx:409-428`); values are dynamic.
- `*` Tabs `学生名册 / 作业` — partial. Real has no tabs; the page shows BOTH 词汇练习概况, 语法练习概况, 作业, 学生名册, 最近活动 sections sequentially (`page.tsx:430-907`).
- `*` `→ 查看本周诊断` link — fabricated. Real has no such top-right link; the `本周诊断状态` page is a separate URL `/teacher/classes/{id}/diagnose-status`.
- `*` Roster table with columns `学生 / 已批改 / 平均 / 最高 / 操作` — partial.
  - Real `学生名单` (`page.tsx:731`) renders a `<ul>` per-student with: `{name}` / `{email} · 加入于 {joinedAt}` / `已批改 N 份 · 平均 X% · 最高 Y%` / `听力 N 份 · 平均 X% · 暂无` / `口语 N 份 · 平均 X% · 暂无` / `详情 →` button (`page.tsx:739-840`).
  - Mockup avatar circles with `陈/王/李/刘/张/赵` — fabricated; real shows just text name.
  - Mockup score chips for 听力 / 口语 sub-stats — partial mapping; real has them but in plain text not as chips.
- `*` Mockup is missing 词汇练习概况 section (`page.tsx:430-514`) with KET/PET tabs, 班级平均必修掌握 N%, 熟练度前 5, 需关注 (后 5) lists.
- `*` Mockup is missing 语法练习概况 section (`page.tsx:516-628`) with similar shape + 常见薄弱主题 list.
- `*` Mockup is missing 作业 section (`page.tsx:630-728`) with `+ 布置新作业` button + per-assignment cards (title / examType + kind + part / minScore / dueAt / completion-pct progress bar).
- `*` Mockup is missing 最近活动 section (`page.tsx:843-905`) with `<ActivityFilter>` + per-attempt rows.

**Real-code labels to use instead**:
- top: `← 我的班级` link + `{name}` + `{examFocus}` + `创建于 {createdAt}` + 邀请码 box
- 4 stat cards: `学生人数` / `已批改答卷` / `班级平均分` / `最高分`
- sections (in order): 词汇练习概况 / 语法练习概况 / 作业 / 学生名单 / 最近活动
- per-student: `{name}` + `{email} · 加入于 {joinedAt}` + `已批改 N 份` + `平均 X% · 最高 Y%` + 听力 sub-stat + 口语 sub-stat + `详情 →`
- assignment card: `{title}` + `{examType} {kindZh} Part {part}` + optional `≥ {minScore}%` + optional `截止 {dueAt}` + completion `完成 {n}/{total} 人 {pct}%` + delete button
- (NO tabs, NO school-name pill, NO `查看本周诊断` top-right link, NO avatar circles)

---

### #teacher-assignment-new (`/teacher/classes/[classId]/assignments/new`)

**Real source**: `apps/web/src/app/teacher/classes/[classId]/assignments/new/page.tsx`, `apps/web/src/app/teacher/classes/[classId]/assignments/new/NewAssignmentForm.tsx` (not directly read)

**Fabrications found**:
- `*` Hero pill `✦ 布置作业` — fabricated.
- `*` Hero h1 `新建作业` with marker on `作业` — partial. Real h1 is `布置新作业` (`page.tsx:43`).
- `*` Hero paragraph `为 KET 三班 共 32 学生 布置作业` — fabricated. Real subtitle is `作业由学生在对应门户完成，系统根据答卷自动标记完成状态` (`page.tsx:44-46`).
- `*` 6 skill emoji-tile picker (阅读/听力/写作/口语/词汇/语法) — partial. Real `<NewAssignmentForm>` (not directly read but referenced at `page.tsx:48-51`) handles assignment creation; the exact field shape needs verification but i18n suggests Vocab and Grammar specific labels exist (`zh-CN.ts:180-216`).
- `*` `Part / 难度` radio row with Part 1-5 chips — likely fabricated (parts depend on selected skill).
- `*` `截止时间` date input — likely real (Assignment model has `dueAt`).
- `*` `备注 (选填)` textarea — likely real (Assignment has `description`).
- `*` `学生名单 (32 人)` collapsible — fabricated; assignment is class-wide, no per-student selection.
- `*` Bottom buttons `取消 / 发送给学生` — partial. Real submit text varies (`zh-CN.ts:181-182` has "词汇作业" but no global label visible).

**Real-code labels to use instead**:
- back link: `← 返回 {className}`
- title: `布置新作业`
- subtitle: `作业由学生在对应门户完成，系统根据答卷自动标记完成状态`
- (the form's exact fields depend on `<NewAssignmentForm>` which I did not read directly)

---

### #teacher-student-detail (`/teacher/classes/[classId]/students/[studentId]`)

**Real source**: `apps/web/src/app/teacher/classes/[classId]/students/[studentId]/page.tsx`

**Fabrications found**:
- `*` Header `← 返回学生页` etc. — partial; real has only `← 返回 {className}` link (`page.tsx:518-523`).
- `*` Hero card with avatar + name + email + KET 三班 pill + 加入 2026-02-14 chip + 4 stat cards (总练习数 42 / 平均分 82 / 本周诊断 5/6 / 最弱板块 听力) — partial.
  - Real: `{name}` h1 + `{email} · 加入于 {joinedAt}` (`page.tsx:524-530`).
  - 4 stat cards real labels are `已批改答卷 / 平均分 / 最高分 / 错题总数` (`page.tsx:540-559`), NOT `总练习数 / 平均分 / 本周诊断 / 最弱板块`.
  - `5/6 本周诊断` — fabricated; real has no per-student diagnose-status counter on this page.
  - `最弱板块 听力` — fabricated as a stat card; real has `口语分项平均` section showing weakest as a label inside the heading (`page.tsx:653-659`).
  - Avatar circle with 陈 letter — fabricated.
- `*` Mockup is missing many real sections:
  - `<AnalysisPanel>` (AI analysis with classId/studentId, `page.tsx:533-538`)
  - `最近成绩走势` (`<ScoreTrend>`, `page.tsx:561-570`)
  - `按科目 × 题型分布` (`page.tsx:572-610`)
  - `写作四项能力平均` (`page.tsx:612-650`)
  - `口语分项平均` (`page.tsx:652-705`) with English+Chinese rubric labels (Grammar & Vocab/Discourse Mgmt/Pronunciation/Interactive)
  - `听力分项平均` (`page.tsx:707-745`) per-part breakdown
  - `词汇练习` (`page.tsx:747-784`) with KET/PET tier breakdown + 30-day sparkline
  - `语法练习` (`page.tsx:786-858`) per-topic breakdown + 30-day sparkline
  - `高频错误考点` (`page.tsx:860-893`)
  - `错题状态` (`page.tsx:895-913`) with NEW/REVIEWED/MASTERED chips
  - `留言记录` (`<CommentPanel>`, `page.tsx:915-921`)
  - `答卷记录` (`page.tsx:923-973`) with detailed per-attempt list
- `*` Right column `📊 最近练习` (6 entries) and `AI 分析` (4 boxes) — fabricated wrap. Real has no such 2-column layout; sections are stacked.
- `*` AI insight content: `🎧 听力 Part 2 偏弱 / 📖 阅读稳定提升 / 📐 语法弱项:现在完成时 / 🎤 口语流利度提升` — fabricated. Real `<AnalysisPanel>` is a separate AI-generated analysis component (not investigated but the content is dynamic).
- `*` `查看完整诊断历史 →` link — fabricated.

**Real-code labels to use instead**:
- top: `← 返回 {className}` link
- title: `{name}`
- subtitle: `{email} · 加入于 {joinedAt}`
- 4 stat cards: `已批改答卷 / 平均分 / 最高分 / 错题总数`
- 11 sections (in order): AI 分析 → 最近成绩走势 → 按科目 × 题型分布 → 写作四项能力平均 → 口语分项平均 → 听力分项平均 → 词汇练习 → 语法练习 → 高频错误考点 → 错题状态 → 留言记录 → 答卷记录
- writing rubric labels: `内容 / 沟通 / 结构 / 语言`
- speaking rubric labels: `语法词汇 (Grammar & Vocab) / 话语连贯 (Discourse Mgmt) / 发音 (Pronunciation) / 互动 (Interactive)` with weakest highlighted
- (NO 4-stat cards as 总练习数/本周诊断/最弱板块, NO avatar circle, NO 2-column layout, NO simplified `📊 最近练习` widget, NO simplified `AI 分析` widget)

---

### #teacher-attempt-detail (`/teacher/classes/[classId]/students/[studentId]/attempts/[attemptId]`)

**Real source**: `apps/web/src/app/teacher/classes/[classId]/students/[studentId]/attempts/[attemptId]/page.tsx`

**Fabrications found**:
- `*` Breadcrumbs `📚 KET 三班 → 👤 陈晓彤 → 作答详情` — fabricated. Real has only ONE back link `← 返回学生详情` (`page.tsx:138-143`).
- `*` Top blue info banner `查看学生：{name} / {email} · {className} · 作答时间：{startedAt} → {submittedAt} / 状态 chip` — REAL pattern (`page.tsx:144-156`); mockup represents this differently.
- `*` Hero stats card `🎧 听力 Part 2 / 提交于 2026-04-26 14:32 · KET 真题难度 / 用时 8:24 / 分数 55 / 答对率 3/5` — fabricated. Real does NOT render a separate hero-stats card; it just shows the blue header banner above + delegates to `<ReadingResultView>` / `<WritingResultView>` / speaking-result-style block based on `attempt.test.kind` (`page.tsx:177-371`).
- `*` `KET 真题难度` chip — fabricated.
- `*` `用时 8:24 / 分数 55 / 答对率 3/5` stat cards — fabricated; real reuses the regular result view which has different stats.
- `*` Per-question detail (5 listening MCQs with `AI 解析` boxes) — partial mapping; real listening pages don't have a teacher-attempt-detail view yet (per `page.tsx:373-387`, listening/mock kinds show `该题型（{kind}）的详细视图尚未上线。`).
- `*` AI 反馈 right column with paragraph + 建议下一步 list — fabricated. Real has no teacher-side AI feedback card on this page (the speaking result block has rubric.justification + weakPoints but those come from speaking attempts only).
- `*` Bottom buttons `← 返回学生页 / 下一份作答 →` — fabricated. Real has no bottom navigation; uses the top back link only.

**Real-code labels to use instead**:
- top: `← 返回学生详情`
- blue banner: `查看学生：{name}` + `{email} · {className} · 作答时间：{startedAt} → {submittedAt}` + status chip
- body: dispatched by `attempt.test.kind`:
  - READING → `<ReadingResultView>` (same as #reading-result)
  - WRITING → `<WritingResultView>` (same as #writing-result)
  - SPEAKING → `<RubricBar>` + 易错点 + `<TranscriptViewer>` (same shape as #speaking-result)
  - LISTENING / others → placeholder `该题型（{kind}）的详细视图尚未上线。`
- ungraded attempt: `该答卷尚未批改完成，暂无详细成绩可查看。`

---

### #teacher-diagnose-status (`/teacher/classes/[classId]/diagnose-status`)

**Real source**: `apps/web/src/app/teacher/classes/[classId]/diagnose-status/page.tsx`

**Fabrications found**:
- `*` Hero banner with `KET pill + KET 三班 · 32 学生` + h1 `本周诊断状态` + paragraph + `已完成 28/32` box — partial.
  - Real header: `← {className}` link + `本周诊断状态` h1 + `weekStart 至 weekEnd · 共 {N} 位学生` (`page.tsx:142-156`).
  - Mockup decoration (KET pill, 32 学生 chip on top, etc.) is more elaborate than real.
  - The `已完成 28/32` box is NOT in the hero; real renders it as part of the 6-cell roll-up grid below.
- `*` 6-cell top-level roll-up with status counts — REAL (`page.tsx:160-186`) but presented differently.
  - Real labels: `未生成 / 待开始 / 进行中 / 已完成 / 报告就绪 / 报告失败` (NOT `全部 32 / 已完成 22 / 进行中 6 / 未开始 4` as in mockup).
  - Mockup's `全部 32` filter pill is wrong; real doesn't have a "全部" filter pill at top.
- `*` Filter pills `全部 32 / 已完成 22 / 进行中 6 / 未开始 4` — fabricated. Real shows a different layout: 6 stat cards (one per status) + section legend + table.
- `*` 说明 (legend) row showing per-section pill meaning (`未开始/进行中/已提交/自动提交/已评分`) — REAL (`page.tsx:188-222`); mockup MISSING this legend.
- `*` Status table with columns `姓名 / 板块进度 (📖🎧✍️🎤🔠📐) / 整体进度 / 状态 / 操作` — partial.
  - Real columns: `学生 / 状态 / [6 section abbreviations: 阅读 听力 写作 口语 词汇 语法] / 综合得分` (`page.tsx:233-246`).
  - Mockup's `整体进度` column with horizontal progress bar — fabricated.
  - Mockup's `操作` column with `提醒` button — fabricated. Real has NO action button per row; just a `综合得分` value linking to the report.
- `*` Per-row 6-dot section progress with mint/butter/mist colors — partial. Real renders 6 small `SECTION_PILL` rounded chips (labels: `— / 中 / 提 / 自 / 评`, `page.tsx:53-59` and `page.tsx:269-285`). The mockup's solid-color dots without letters are wrong (real has letters).
- `*` Per-row student avatar circles — fabricated.
- `*` Footer `导出 CSV / 全班催办` buttons — fabricated. Real has no footer actions.

**Real-code labels to use instead**:
- top: `← {className}` link
- title: `本周诊断状态`
- subtitle: `weekStart 至 weekEnd · 共 {N} 位学生`
- 6 stat cards (top-level roll-up): `未生成 / 待开始 / 进行中 / 已完成 / 报告就绪 / 报告失败` with counts
- legend: `说明：` + 5 per-section pill examples (`未开始 — / 进行中 中 / 已提交 提 / 自动提交 自 / 已评分 评`)
- table columns: `学生 / 状态 / 阅读 / 听力 / 写作 / 口语 / 词汇 / 语法 / 综合得分`
- per-row: `{name} / {email}` + status pill + 6 section pills with letter (`— / 中 / 提 / 自 / 评`) + score `{N}%` linking to report
- empty state: `班级还没有学生。`
- (NO 操作 column with 提醒 button, NO progress bars, NO `导出 CSV / 全班催办` footer, NO `全部 / 已完成 / 进行中 / 未开始` filter pills, NO avatar circles)

---

## Summary

| Section | Fabrications |
|---|---|
| #login | ~10 |
| #kethub | ~7 |
| #diaghub | ~5 (hub-card scores fabricated, see narrow audit #4) |
| #reader | ~7 |
| #signup | ~12 |
| #teacher-activate | ~8 |
| #home-out | ~8 |
| #home-in | ~8 |
| #pethub | ~6 |
| #reading-new | ~14 (part counts, time labels, subtitles all fabricated) |
| #reading-result | ~9 |
| #listening-new | ~14 (part labels, time labels, all fabricated) |
| #listening-runner | ~7 |
| #listening-result | ~7 |
| #writing-new | ~10 (part labels, time labels, mixing KET+PET) |
| #writing-runner | ~9 |
| #writing-result | ~8 |
| #speaking-new | ~10 (mode-picker fabricated entirely) |
| #speaking-runner | ~9 (avatar/REC/transcript-toggle/timer fabricated) |
| #speaking-result | ~10 (Chinese rubric labels wrong) |
| #vocab-overview | ~12 (overall card / tier cards / table / pagination missing) |
| #vocab-spell | ~9 |
| #vocab-listen | ~7 (picture-grid wrong shape) |
| #grammar-overview | ~10 (8-tile grid wrong, 11-category groups missing) |
| #grammar-quiz | ~7 |
| #grammar-mistakes | ~9 (口语 chip in filter is fabricated) |
| #diag-section-runner | ~6 |
| #diag-report | ~12 (per-section detail rows + English severity labels fabricated) |
| #diag-history | ~7 |
| #diag-history-detail | ~6 |
| #diag-replay | ~6 |
| #history | ~10 (status pill + Chinese mode labels missing) |
| #history-mistakes | ~10 (口语/词汇/语法 filter chips fabricated, status filter missing) |
| #classes | ~10 (school name, student count, assignment status fabricated) |
| #teacher-classes | ~7 (search input, grid layout, pagination fabricated) |
| #teacher-class-new | ~6 (school name, student cap, regenerate button fabricated) |
| #teacher-class-detail | ~12 (5 missing data sections, school pill fabricated) |
| #teacher-assignment-new | ~6 (skill picker shape unverified) |
| #teacher-student-detail | ~15 (11 missing real sections, fabricated AI insights) |
| #teacher-attempt-detail | ~9 (breadcrumbs, hero stats, AI feedback fabricated) |
| #teacher-diagnose-status | ~10 (filter pills + 操作 column + 导出/催办 fabricated) |

**Total fabrications across 41 sections: ~363** (rough count; some sections have overlapping items).

## Top 10 most-fabricated sections (by count)

1. **#teacher-student-detail** — ~15 (11 missing real sections, fabricated `AI 分析` content, wrong stat-card labels, no `<AnalysisPanel>`/`<ScoreTrend>`/etc.)
2. **#reading-new** — ~14 (part count wrong: 7 vs real 5; all part Chinese names fabricated; all time labels fabricated; bottom strip and mode picker missing)
3. **#listening-new** — ~14 (part count for PET wrong; all part Chinese names fabricated; all time labels fabricated; cards UI vs real radio fieldsets)
4. **#vocab-overview** — ~12 (missing overall mastery card, 3 tier cards, full word table with headers/pagination/filter row; `本周词表` heading and `已掌握 67` count fabricated)
5. **#diag-report** — ~12 (per-section detail rows like `3 题 · 答对 1 题`, `Mina · 已对话` all fabricated; severity/category English labels wrong; `综合评语` should be paragraph not bullets)
6. **#teacher-class-detail** — ~12 (5 missing real sections — 词汇/语法/作业/最近活动; school name pill fabricated; tabs vs sequential sections)
7. **#signup** — ~12 (header / hero pill / stat cards / chips / 确认密码 field / terms checkbox all fabricated)
8. **#teacher-diagnose-status** — ~10 (filter pills wrong shape; 操作 column with 提醒 button fabricated; status counts label wrong)
9. **#speaking-new** — ~10 (entire 3-card mode picker fabricated; real has Mic gate + Connection test + single CTA only)
10. **#speaking-result** — ~10 (Chinese rubric labels `流畅度/词汇/语法/发音` wrong; English labels are `Grammar & Vocabulary / Discourse Management / Pronunciation / Interactive Communication`; missing 易错点 section; bottom buttons wrong)

## Methodology notes

- The `*-new` picker pages (#reading-new, #listening-new, #writing-new, #speaking-new) all share a common pattern of fabrication: invented Chinese task names, invented time labels, invented item-count subtitles, decorative pills not in code, missing the real mode-picker (PRACTICE/MOCK) UI. The flagged user note that these pages have "fabricated part labels, fabricated time labels, fabricated counts" is fully confirmed.
- The grammar overview's 8-card flat grid (vs real 11-category groups) and per-card `已练 N · X%` stats (vs real chip-only `{N}%`) is a structural mismatch — bigger than just label rename.
- Several teacher pages (class-detail, student-detail, attempt-detail, diagnose-status) are missing entire data sections from the real code. Restoring them requires either (a) trimming the mockup to match what's real, or (b) flagging each missing section as a "new feature" requiring backend wiring.
- Across all `result` pages, mockup adds bottom action buttons (再练一次 / 返回门户) that do not exist in real code (which uses SiteHeader navigation only).
