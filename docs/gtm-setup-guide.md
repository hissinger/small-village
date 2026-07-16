# Small Village — GTM / GA4 운영 세팅 가이드

GTM/GA4 이벤트 수집 파이프라인(PR #42) 배포 후, **GTM 콘솔에서 수동으로 1회** 세팅해야
실제 데이터가 GA4로 흐른다. 코드는 `dataLayer.push({ event, ...params })`만 쏘므로, 이름↔GA4
매핑·파라미터 스키마·커스텀 디멘전은 여기서 관리한다(배포 없이 수정 가능).

> 컨테이너 ID: `GTM-MV2WZML5` (Netlify env `REACT_APP_GTM_ID`)
> GA4 측정 ID: Netlify env `REACT_APP_GA_ID` (`G-XXXXXXX`)

---

## 0. 사전 확인 (가장 많이 놓치는 함정)

### 캐시/빌드
- `REACT_APP_*`는 **빌드 타임 주입**. Netlify에서 env를 바꿨으면 반드시
  **Deploys → "Clear cache and deploy"** (일반 Deploy 말고). 안 하면 env 미반영.
- 배포된 `main.js`에 `GTM-XXXX`/`G-XXXX`가 박혔는지 확인:
  브라우저 DevTools → Network → `main.js` → 응답에서 `GTM-` 검색.

### ⚠️ Ad-block 이 GTM을 막는다 (실제 겪은 이슈)
- uBO Lite / uBlock / Brave Shields / AdGuard 등이 `googletagmanager.com`을
  **307 Internal Redirect로 차단**하면 GTM이 안 뜬다(`window.google_tag_manager` undefined).
- **증상**: Network 탭에 `gtm.js` 요청이 `307 Internal Redirect`, Console에 ad-block 차단 팝업.
- **해결**: 해당 사이트를 ad-block 허용 목록에 추가, 또는 시크릿 모드에서 확인.
- **운영 한계**: ad-block 쓰는 유저는 GTM/GA4가 아예 안 뜬다 → 수집 데이터는
  "ad-block 끈 유저" 기준만 잡힘. 보수적 추정치로 해석할 것. 우회(자체 호스팅 gtm.js)는
  규모 대비 과하므로 수용.

### GTM 로드 확인
브라우저 Console:
```js
window.google_tag_manager ? "GTM 로드됨" : "GTM 안 로드됨"
```
"안 로드됨"이면 위 두 가지(빌드/adbock) 중 하나.

---

## 1. 데이터 영역 변수 (Data Layer Variables)
GTM 좌측 **변수 → 사용자 정의 변수 → 새로 만들기 → 유형: 데이터 영역 변수**.
각 파라미터마다 1개. "데이터 영역 변수 이름"란에 **아래 키를 딱 그대로** 입력(오타나면 매핑 안 됨).

| 변수 ID(내가 짓는 이름) | 데이터 영역 변수 이름 |
|---|---|
| `DL - room_id` | `room_id` |
| `DL - character_index` | `character_index` |
| `DL - room_size` | `room_size` |
| `DL - duration_sec` | `duration_sec` |
| `DL - error_code` | `error_code` |
| `DL - length` | `length` |
| `DL - is_public` | `is_public` |
| `DL - peer_count` | `peer_count` |
| `DL - room_count` | `room_count` |
| `DL - user_id` | `user_id` |

(`error_msg`는 현재 코드에서 보내지 않음 — voice_join_error는 error_code만 전송, PII 유출 방지)

---

## 2. 트리거 (Custom Events)
좌측 **트리거 → 새로 만들기 → 유형: 사용자 정의 이벤트**.
이벤트 이름은 아래 값과 **딱 일치** (코드의 `event:` 값).

| 트리거 이름 | 이벤트 이름 |
|---|---|
| `tr - enter_room` | `enter_room` |
| `tr - exit_room` | `exit_room` |
| `tr - voice_join_success` | `voice_join_success` |
| `tr - voice_join_error` | `voice_join_error` |
| `tr - room_not_found` | `room_not_found` |
| `tr - chat_message_sent` | `chat_message_sent` |
| `tr - character_selected` | `character_selected` |
| `tr - room_list_view` | `room_list_view` |
| `tr - room_created` | `room_created` |
| `tr - proximity_talk` | `proximity_talk` |
| `tr - mic_permission_denied` | `mic_permission_denied` |
| `tr - set_user_id` | `set_user_id` |

---

## 3. 태그 (GA4 이벤트)
좌측 **태그 → 새로 만들기 → 유형: Google Analytics: GA4 이벤트**.
측정 ID는 `{{GA4 구성}}`(구성 태그 있으면) 또는 `G-XXXXXXX` 직접 입력.
이벤트 이름 = 트리거와 같은 이름. 이벤트 파라미터에 아래 매핑.

| 태그 | 이벤트 이름 | 파라미터 (이벤트 파라미터) | 연결 트리거 |
|---|---|---|---|
| `tag - enter_room` | `enter_room` | `room_id`→`{{DL - room_id}}`, `character_index`→`{{DL - character_index}}`, `room_size`→`{{DL - room_size}}` | `tr - enter_room` |
| `tag - exit_room` | `exit_room` | `room_id`→`{{DL - room_id}}`, `duration_sec`→`{{DL - duration_sec}}` | `tr - exit_room` |
| `tag - voice_join_success` | `voice_join_success` | `room_id`→`{{DL - room_id}}` | `tr - voice_join_success` |
| `tag - voice_join_error` | `voice_join_error` | `room_id`→`{{DL - room_id}}`, `error_code`→`{{DL - error_code}}` | `tr - voice_join_error` |
| `tag - room_not_found` | `room_not_found` | `room_id`→`{{DL - room_id}}` | `tr - room_not_found` |
| `tag - chat_message_sent` | `chat_message_sent` | `room_id`→`{{DL - room_id}}`, `length`→`{{DL - length}}` | `tr - chat_message_sent` |
| `tag - character_selected` | `character_selected` | `character_index`→`{{DL - character_index}}` | `tr - character_selected` |
| `tag - room_list_view` | `room_list_view` | `room_count`→`{{DL - room_count}}` | `tr - room_list_view` |
| `tag - room_created` | `room_created` | `is_public`→`{{DL - is_public}}` | `tr - room_created` |
| `tag - proximity_talk` | `proximity_talk` | `room_id`→`{{DL - room_id}}`, `peer_count`→`{{DL - peer_count}}` | `tr - proximity_talk` |
| `tag - mic_permission_denied` | `mic_permission_denied` | `room_id`→`{{DL - room_id}}` | `tr - mic_permission_denied` |
| `tag - set_user_id` | `set_user_id` | `user_id`→`{{DL - user_id}}` | `tr - set_user_id` |

> `set_user_id`는 GA4 User ID로도 연결 권장(아래 4번). 이벤트로도 남기되,
> 별도로 GA4 구성 태그의 `user_id` 필드에 `{{DL - user_id}}` 매핑 권장.

---

## 4. GA4 콘솔 — 커스텀 정의 + User-ID
GA4 관리 화면(`analytics.google.com`):
- **관리 → 맞춤 정의 → 맞춤 dimensions** 생성(이벤트 범위):
  - `room_id`, `character_index`, `error_code` 등 리포트에 쓸 파라미터 등록
- **관리 → 자산 세부정보 → Reporting Identity** → "User-ID 포함" 활성화
  (`set_user_id` 흐르게 하려면 필수. uuid는 익명값이라 PII 아님)

---

## 5. BigQuery export (권장)
서버가 없어 원시 이벤트가 GA4에만 쌓인다.
- GA4 **관리 → 연결된 제품 → BigQuery Links** → 프로젝트 연결
- 일일 export로 원시 보존 → 방별 코호트/잔존 분석 가능

---

## 6. 검증
1. GTM 우측 **미리보기(Preview)** → 사이트 URL → 방 입장/퇴장 → 우측 패널에
   `enter_room` 등 태그 **발동됨(fired)** 확인.
   (Preview가 SPA/팝업 환경에서 잘 안 잡히면 7번 우회법)
2. **게시(Submit → Publish)** — 안 하면 콘솔에만 있고 실제 데이터 안 흐름.
3. GA4 **보고서 → 실시간(Realtime)** 또는 **디버그뷰**에서 이벤트 도착 확인.
4. 개발모드 콘솔에 `[analytics] {event:...}` 디버그 로그도 찍힘(코드 레벨 확인용).

### Preview 안 잡힐 때 우회
- GA4 **실시간** 탭에서 게시 후 이벤트 도착 확인
- 또는 **GA Debugger** 크롬 확장으로 콘솔에 GA4 이벤트 직접 확인(GTM Preview 불필요)

---

## 이벤트 명세 요약 (코드 기준)
| 이벤트 | 트리거 | 파라미터 |
|---|---|---|
| `set_user_id` | GA init 직후 | `user_id` (익명 uuid) |
| `enter_room` | 방 입장(씬 READY) | `room_id`, `character_index`, `room_size`(DB count) |
| `exit_room` | 방 퇴장 | `room_id`, `duration_sec` |
| `voice_join_success` | RTK join resolve | `room_id` |
| `voice_join_error` | RTK join 실패 | `room_id`, `error_code` (error_msg는 PII 우려로 미전송) |
| `room_not_found` | 입장 차단(종료된 방) | `room_id` |
| `chat_message_sent` | 말풍선 전송 | `room_id`, `length` (본문 전송 안 함) |
| `character_selected` | 캐릭터 선택 확정 | `character_index` |
| `room_list_view` | 로비 방 목록 노출 | `room_count` |
| `room_created` | 방 생성 | `is_public` (현재 항상 true) |
| `proximity_talk` | 근접 발화(audioTrack remote) | `room_id`, `peer_count` (30s 스로틀) |
| `mic_permission_denied` | 마이크 권한 거부 | `room_id` (best-effort, 미지원 브라우저는 voice_join_error로만) |

> 참고: `character_selected`는 방 join/create 양쪽 공통 경로에서 발사되므로,
> 생성 시 `room_created`와 동시 발생함(분석 시 혼동 주의).
