# 통합 앱 검증 결과 — 2.5.3

검증일: 2026-09-24 / versionCode 16 / 패키지 `kr.dogdive.roomorder.tablet`

## 2.5.3 원본 애니메이션 복구

- `tablet.js`에서 애니메이션을 막던 규칙을 제거했습니다. 대상은 하단 버튼 `animation:none`, 숫자 굴림 숨김과 `::after` 대체 표시, 주문완료 요약·내역의 `opacity`/`transform` 고정, 체크 숨김, 금액 폭·가림막 무시, 누름 효과의 `transform` 고정입니다. 쓰이지 않게 된 `data-room-number` 표시도 제거했습니다. 가로 배치·글자 크기·터치 영역 보정은 유지합니다.
- 원본 담기 버튼 애니메이션은 `translateY(0 → -20px → 0)` 2초 무한 반복입니다. 복구 후 0.1초 간격 측정에서 이동 폭 20px, 2초 주기를 확인했습니다.
- Android 13 에뮬레이터 화면 녹화(실제 토스 상품 상세, 서버 변경 요청 차단)에서 수량 1→2 터치 시 5,000→10,000원 숫자 굴림이 약 0.7초 동안 표시되고 정상 값으로 멈췄습니다. 같은 상태의 CDP 캡처에는 숫자 칸의 흰 띠가 나타나지만 Android 화면 캡처에는 나타나지 않아, 2.4.1의 "검은 선"은 캡처 경로 현상으로 판단했습니다.
- `scripts/check-tablet-complete.mjs`(주문 조회만 로컬 응답)의 18개 조합을 통과했습니다. 금액 표시 범위가 요약 카드 안에 있고, `원`이 금액 줄의 오른쪽 끝에 있으며, 원본 숫자 굴림 요소가 표시됩니다. 원본 내역 펼치기/접기와 긴 내역 스크롤도 통과했습니다. 서버 변경 요청은 0회입니다. 화면 녹화에서 체크 표시·금액 증가·쿠폰 안내 뒤 `123,456원`이 카드 가운데에 표시됩니다.
- `scripts/check-ui-matrix.mjs --strict`에서 메뉴·카테고리·무료/유료 상세·주문내역·빈 장바구니 36개 화면(3가지 크기 × 두 테마)의 가로 넘침 0, 48px 미만 터치 영역 0, 가격 줄바꿈 0을 확인했습니다. 유료 상세 +/− 터치 후 수량·합계가 원본 값과 일치하고 숫자 굴림이 표시됩니다. 확인창 시험 단계는 토스 배포로 내부 모듈 번호가 바뀌어 시험 도구가 확인창을 열지 못했습니다. 확인창 보정 규칙은 이번에 변경하지 않았습니다.
- 소스 검사, debug/test/release 빌드, 릴리스 Lint(오류 0 / 기존 경고 16), 서명·API 33·가로 Activity 12개·방별 독립 프로세스 8개·디버깅 비활성 검사를 통과했고, APK 안의 웹 스크립트 5개가 현재 소스와 일치합니다. 기존 2.5.2 배포 앱 위에 설치해 3번방과 100초 카운트다운 유지를 확인한 뒤, 실제 매장 장바구니에 정리가 실행되지 않도록 즉시 종료했습니다. 개발 앱 설정은 100초·밝음으로 되돌렸습니다.

APK: 3,081,127바이트. SHA-256: `3b3153f4a7ad6eaeec0c488a2eeb161c61234098bae3375d86d85cccf374f40a`.

증빙: `captures/anim-v253/`의 `cta-roll-bounce.mp4`, `cta-roll-frames.png`, `cta-bounce-sample.json`, `complete-intro.mp4`, `complete-intro-frames.png`, `complete/results.json`, `ui/matrix-results.json`, `ui/numeric-touch-check.json`, `source-check.log`, `build.log`, `apk-verification.log`.

실물 태블릿의 GPU·WebView 버전에서의 애니메이션 표시는 미검증입니다. 담기 버튼이 계속 움직이는 효과는 토스 원본 동작이며, 매장 사용에 방해가 되면 해당 효과만 다시 끌 수 있습니다.

## 2.5.2 이전 검증 기록

검증일: 2026-09-24 / versionCode 15 / 패키지 `kr.dogdive.roomorder.tablet`

## 2.5.2 자동 정리 반복 방지·외부 페이지 복귀·안내 간소화

- 코드 분석에서 세 가지 문제를 확인했습니다. ① 정리가 성공할 때마다 다음 주기를 다시 시작해 아무도 없는 태블릿도 설정 시간마다 QR에 재접속했습니다(100초 기준 하루 약 800회). ② 토스 외 https 페이지에서는 미조작 정리와 세션 복귀가 모두 멈춰 직원이 누르기 전까지 그 화면에 남았습니다. ③ 같은 장바구니 주소를 다시 불러올 때 새 문서가 도착하기 전 이전 문서가 1초 뒤 검사에 응답할 수 있어, 느린 응답에서 이전 화면을 기준으로 삭제하거나 빈 상태를 확인할 수 있었습니다.
- 수정: ① 정리 성공 후 다음 터치까지 쉬고 카운트다운을 숨깁니다. ② 메뉴·장바구니·주문내역에서 외부로 나간 경우 같은 미조작 시간 뒤 장바구니 정리와 같은 방 QR 재접속을 실행합니다. 마지막 토스 페이지가 결제 단계였다면 결제 중일 수 있으므로 계속 대기합니다. ③ 정리용 페이지 로드 후 새 문서가 표시될 때(`onPageStarted` 이후 `onPageCommitVisible`)까지 검사를 보류합니다. 전체 2분 제한은 그대로입니다. `계속 사용` 버튼을 제거하고 왼쪽 안내 문구를 줄였습니다.
- Java 검사에 정리 후 휴식, 경고 연기 중 휴식 유지, 터치·설정 변경 시 재시작을 추가했습니다. 기존 PIN·세션 복구·충돌 복구·입력 보호 검사도 통과했습니다.
- Android 13 에뮬레이터(2560×1600 / 320dpi, 웹 문서는 로컬 응답)에서 `scripts/check-idle-cycle.mjs`의 다섯 시나리오를 통과했습니다.
  - 메뉴 대기 60초: 61.2초에 첫 삭제, 항목 3개 삭제, 빈 상태 재조회, QR 1회, 메뉴 복귀 후 카운트다운 숨김. 이후 70초 동안 장바구니 조회·QR 재접속 0회. 터치 후 60초 주기 재시작.
  - 장바구니 화면 대기 + 장바구니 응답 2.5초 지연: 첫 삭제는 새 장바구니 문서 도착 0.49초 후, QR 재접속은 확인용 문서 도착 0.50초 후에 발생했습니다. 휴식·재시작도 통과했습니다.
  - 외부 https 페이지(example.com 주소, 로컬 응답) 대기: 60초 안내 후 61.2초에 정리를 시작해 삭제·확인·QR·메뉴 복귀·휴식·재시작을 통과했습니다.
  - 결제 단계 → 외부 페이지: 75초 동안 `대기 중`을 유지하고 장바구니 조회·삭제·QR 재접속 0회.
  - 기본값 100초 메뉴 대기: 101.3초에 첫 삭제, 삭제·확인·QR·메뉴 복귀 후 110초 동안 재접속 0회, 터치 후 100초 주기 재시작. 검사 후 개발 앱 설정을 100초·밝음으로 두었습니다.
  - 모든 시나리오에서 `계속 사용` 버튼이 없고, 정리 중 뒤로 가기 3회가 차단됐습니다. 삭제 요청은 모두 로컬 응답이며 서버 전달은 0회입니다.
- 설치 전 실행 중이던 2.5.1 개발 앱 로그에서 실제 1번방 페이지에 약 63초 간격으로 빈 장바구니 조회·확인·QR 재접속이 무인 상태로 반복된 기록을 확인했습니다(장바구니가 비어 있어 삭제는 없음). 2.5.2 개발 앱은 검사 주기 외 실행 0회였습니다(`maintenance-logcat.log`).
- 2.5.2 배포 APK를 에뮬레이터의 기존 2.5.1 배포 앱 위에 설치해 저장된 3번방, 100초 카운트다운, `계속 사용` 버튼 없음을 확인했습니다. PIN 입력·변경·데이터 초기화는 하지 않았고, 실제 매장 장바구니에 정리가 실행되지 않도록 확인 직후 개발/배포 앱을 종료하고 TCP 9222 전달을 해제했습니다.
- 밝음/어두움 네이티브 화면 8개 검사와 미조작 시간 설정 검사(PIN 보호·60/80/100초·사용 안 함·저장·IPC·다른 설정 보존)를 통과했습니다.
- debug/test/release 빌드 및 릴리스 Lint를 통과했습니다. Lint는 오류 0 / 기존 경고 16입니다. 서명·API 33·가로 Activity 12개·방별 독립 프로세스 8개·디버깅 비활성 및 테스트 instrumentation 미포함을 확인했고, APK 안의 웹 스크립트 5개가 현재 소스와 일치합니다.

APK: 3,081,403바이트. SHA-256: `caf08096065d9b6433bca42a97a6e9cb88e9ae11bbea4730380ad581d1f41180`.

증빙: `captures/idle-v252/source-check.log`, `build.log`, `maintenance-logcat.log`, `apk-verification.log`, `native-audit.log`, `settings-audit.log`, `cycle-60-menu`, `cycle-60-cart-slow`, `cycle-60-external`, `cycle-60-checkout-external`, `cycle-100-menu`의 `native-cycle-results.json`.

실제 태블릿·실제 토스 장바구니 삭제·실제 결제 흐름은 미검증입니다. 외부 페이지 복귀는 마지막 토스 페이지 경로로 결제 여부를 판단하므로, 실제 결제가 외부 사이트를 거치는 경우 결제 단계에서 나간 흐름이 보류되는지 매장에서 확인해야 합니다.

## 2.5.1 이전 검증 기록

검증일: 2026-09-24 / versionCode 14 / 패키지 `kr.dogdive.roomorder.tablet`

## 2.5.1 미조작 시간 60초·80초·100초

- 관리자 시간 선택지를 사용 안 함/60초/80초/100초로 바꾸고 기본값을 100초로 정했습니다. 기존 분 단위 값은 새 초 단위 키와 분리해 100초로 전환하며, 사용 안 함은 유지합니다. 기존 60분이 60초로 잘못 해석되지 않도록 했습니다.
- Java 검사에서 세 주기의 시작, 마지막 60초, 만료 1ms 전/직후, 터치 초기화, 처리 중 보류, 사용 안 함 및 잘못된 설정의 기본값 복원을 확인했습니다. 기존 PIN·세션 복구·충돌 복구·입력 보호 검사도 통과했습니다.
- 별도 테스트 APK에서 이전 사용 안 함/5/10/15/30/60분 값의 전환, 미설정 기본 100초, 60/80/100초·사용 안 함의 표시/선택/저장, 저장 전 값 유지, Intent/비공개 IPC 전달, 기존 방·글자 크기·테마 보존을 확인했습니다. PIN 조회·입력·변경은 하지 않았습니다.
- 반복 검사에서 QR 재접속의 `toss.place` 중간 주소를 주문 페이지가 아닌 것으로 판단해 정리를 중단하는 기존 문제를 발견했습니다. 해당 방에 저장된 정확한 QR 주소일 때만 연결을 기다리도록 수정했으며, 그 주소에서는 웹 스크립트를 실행하지 않습니다. 다른 출처·페이지 오류·전체 2분 제한에 대한 중단은 유지합니다.
- 1280×800 Android 13 에뮬레이터에서 60/80/100초를 각각 실제로 기다리는 검사를 모두 통과했습니다. 터치 초기화·60초 안내·항목 3개 순차 삭제·빈 장바구니 재조회·3초 지연된 QR 중간 주소 통과·같은 방 메뉴 복귀·다음 주기 시작·정리 중 뒤로 가기 3회 차단을 확인했습니다. 첫 삭제 요청은 터치 후 61.175/81.227/101.312초에 발생했으며 정리 시작 후의 새 장바구니 조회 시간을 포함합니다. 삭제 요청 총 9개는 로컬 응답으로 처리했고 서버 전달은 0회입니다.
- 밝음/어두움의 PIN·일반 설정·키오스크 설정·확인창 총 8개 네이티브 검사를 통과했습니다. 표시 글자 잘림과 저장 버튼 스크롤 도달을 확인했습니다.
- debug/test/release 빌드 및 릴리스 Lint를 통과했습니다. Lint는 오류 0 / 기존 경고 16입니다. 서명·API 33·가로 Activity·방별 독립 프로세스·디버깅 비활성 및 테스트 instrumentation 미포함을 확인했습니다.
- 최종 2.5.1 / versionCode 14 APK를 기존 배포 앱 위에 설치해 저장된 3번방을 유지하고, 초기 QR 연결 후 100초 카운트다운이 적용됨을 확인했습니다. PIN 변경·데이터 초기화 없이 업데이트했습니다. 검사 후 개발 앱 설정은 100초·글자 120%·밝음이며 개발/배포 앱을 종료하고 에뮬레이터 해상도·밀도와 TCP 9222 전달을 원래대로 복원했습니다.

APK: 3,081,467바이트. SHA-256: `016211dcfb2a34a7c8a570a15e8dbdd161f734a5dbe7f74d7e870df3f3a086ad`.

증빙: `captures/idle-v251/source-check.log`, `settings-audit.log`, `build.log`, `apk-verification.log`, `native-audit.log`, `cycle-60/native-cycle-results.json`, `cycle-80/native-cycle-results.json`, `cycle-100/native-cycle-results.json`.

카운트다운 및 정리 조건은 이전과 같습니다. 마지막 60초에 안내하므로 60초 선택 시 처음부터 정리 안내가 표시됩니다. 실제 태블릿·실제 토스 장바구니 삭제/세션 유지·주문·결제·POS 접수는 미검증입니다.

## 2.5.0 이전 검증 기록

검증일: 2026-09-23 / versionCode 13 / 패키지 `kr.dogdive.roomorder.tablet`

## 2.5.0 미조작 자동 정리·카운트다운

- 기본 30분 미조작 후 장바구니를 비우고 저장된 방 QR 주소에 재접속합니다. 관리자 PIN 인증 후 사용 안 함/5/10/15/30/60분을 선택할 수 있습니다. 왼쪽에 남은 시간을 표시하고 마지막 60초에는 정리 안내와 계속 사용 버튼을 표시합니다. 터치·앱 복귀 시 새 주기를 시작합니다.
- 순수 Java 검사에서 타이머 경계, 60초 경고, 터치 초기화, 처리 중 경고 연기, 사용 안 함, 잘못된 설정 및 시계 역행을 검사했습니다. 기존 PIN·세션 복구·충돌 복구·중복 입력 검사도 통과했습니다.
- 원본 토스 장바구니 컴포넌트를 사용한 로컬 WebView 검사 6개를 통과했습니다. 항목 3개 순차 삭제와 반복 호출 중 요청 1회 유지, 빈 장바구니, 열린 확인창, HTTP 실패 후 재전송 없음, 20초 지연 뒤 늦게 도착한 응답에도 중단 유지, 알 수 없는 빈 화면에서 중단을 확인했습니다. 삭제 요청 5개는 모두 로컬에서 응답했고 서버 전달은 0회입니다.
- Android 13 에뮬레이터에서 실제 5분 타이머를 기다려 60초 안내·터치 초기화·항목 3개 삭제·두 번째 조회의 빈 상태 확인·저장된 방 QR 재접속·다음 타이머 시작을 확인했습니다. 정리 중 Android 뒤로 가기 3회도 차단됐습니다. 메뉴/장바구니는 로컬 문서 응답이며 실제 주문이나 실제 장바구니를 변경하지 않았습니다. 화면 전환 직후 조회와 네이티브 상태 반영 사이의 시간을 고려해 최종 검사기는 메뉴 확인 후 1.5초 기다리고 완료 상태를 검사합니다.
- 관리자 설정의 PIN 보호, 저장 전 값 유지, 60분/사용 안 함/30분 저장, Intent 및 비공개 IPC 일치, 기존 방·글자 크기·테마 보존 검사를 통과했습니다. 관리자 인증 대체 코드는 별도 테스트 APK에만 있으며 PIN을 읽거나 변경하지 않습니다.
- 1280×800 / 160dpi 기본 글자와 213dpi Android 글자 130%에서 두 테마의 PIN·일반 설정·키오스크 설정·확인창 총 16개 화면 검사를 통과했습니다. 시간 선택란의 고정 높이 때문에 큰 글자가 잘리던 문제를 수정했습니다. 마지막 저장 버튼까지 스크롤 가능하고 버튼 높이 64dp 이상을 확인했습니다.
- debug/test/release 빌드와 릴리스 Lint를 통과했습니다. Lint는 오류 0 / 기존 경고 16입니다.
- 배포 APK의 릴리스 서명·API 33·가로 Activity 12개·독립 방 프로세스 8개·디버깅 비활성 및 테스트 instrumentation 미포함을 확인했습니다. 5개 웹 스크립트의 APK 내 내용이 현재 소스와 일치합니다.
- 최종 2.5.0 / versionCode 13 APK를 기존 배포 앱 위에 설치해 저장된 3번방과 기본 30분 카운트다운을 확인했습니다. PIN 입력·변경·데이터 초기화는 하지 않았습니다. 개발 앱을 30분·글자 120%·밝음으로 복원하고 해상도/밀도 강제 설정과 TCP 9222 전달을 해제했습니다. 검사 후 에뮬레이터의 개발/배포 앱은 종료했습니다.

APK: 3,081,231바이트. SHA-256: `73f2e77a397afc1e428abdd94f5bd62e2d3221da422a539ebd2e6c01898e531c`.

증빙: `captures/idle-v250/cart-adapter-results.json`, `native-cycle-results.json`, `native-touch-reset.json`, `settings-audit.log`, `native-audit.log`, `native-large-audit.log`, `source-check.log`, `build.log`. 재검사: `scripts/check-idle-cart.mjs`, `scripts/check-idle-cycle.mjs`, `scripts/check-source.ps1`.

실물 태블릿, 실제 토스 서버의 장바구니 삭제 및 세션 수명, 실제 주문·결제·POS 접수는 미검증입니다. 원본 QR 재접속은 토스 서버의 만료 정책을 변경하지 않으며 만료 방지를 보장하지 않습니다. 여러 사람이 같은 장바구니를 공유할 때도 이 태블릿의 미조작 시간을 기준으로 정리합니다. 주문/결제 중·확인창·결과 불확실 상태는 보류하고, 삭제 실패 시 자동 재시도하지 않습니다.

## 2.4.2 이전 검증 기록

검증일: 2026-09-22 / versionCode 12 / 패키지 `kr.dogdive.roomorder.tablet`

## 2.4.2 1280×800 및 주문완료

- Android 13 에뮬레이터의 물리 화면을 1280×800으로 설정했습니다. 160dpi의 웹 영역은 1112×800이며, 213dpi에서는 793×601로 측정됐습니다. 213dpi의 원본 터치 영역 높이는 반올림 차이를 포함해 71.995 CSS px(약 96 실제 픽셀)였습니다.
- 메뉴·카테고리·무료/유료 상세·주문내역·빈/긴 장바구니·일반/긴 확인창 9종 × 세 크기 × 두 테마 × 글자 120%/140% = 108개 화면 검사를 통과했습니다. 가로 넘침·검사 대상 48px 미만 터치 영역이 없고, 가격 한 줄·확인창 버튼·원본 수량과 합계 표시 일치를 확인했습니다.
- 주문완료 미결제·부분결제·결제완료 3종 × 세 크기 × 두 테마 × 글자 120%/140% = 36개 검사를 통과했습니다. 123,456원과 `원`의 카드 내 표시, 주문내역 원본 터치 펼침/접힘, 긴 메뉴 10개의 마지막 항목 스크롤 도달, 메뉴 복귀 시 완료 스타일 제거, 원래 배치 전환을 검사했습니다.
- 주문완료 데이터는 조회 응답만 대체한 로컬 fixture이며 주문/결제 변경 요청은 0회입니다. 검사 중 분석 이벤트를 포함한 모든 쓰기 요청을 차단했습니다. 실제 POS 접수·결제의 성공을 뜻하지 않습니다.
- 소스 검사(PIN·세션 복귀·충돌 복구·입력 보호·리소스), Gradle debug/release 빌드와 릴리스 Lint를 통과했습니다. Lint는 오류 0 / 기존 경고 16입니다. 배포 APK의 서명·API 33·가로 Activity·독립 방 프로세스·디버깅 비활성도 확인했습니다.

증빙: `captures/tablet-v242/ui-120.log`, `ui-140.log`, `complete-120.log`, `complete-140.log`, `density-213.log`, `source-check.log`, `build.log`, `apk-verification.log`. 재검사 도구: `scripts/check-ui-matrix.mjs --strict`, `scripts/check-tablet-complete.mjs`.

장바구니 PATCH/DELETE 검사도 각각 반복 터치 10회·뒤로 가기 10회를 차단하고 화면을 유지한 채 응답 후 갱신됨을 확인했습니다(`cart-input.log`). 변경 요청의 서버 전달은 0회입니다.

최종 서명 APK를 에뮬레이터의 기존 배포 앱 위에 설치하고 저장된 3번방으로 실행했습니다. versionName 2.4.2 / versionCode 12 확인, PIN 변경·데이터 초기화 없음. 검사 후 개발 앱의 글자 120%/밝음 설정, 에뮬레이터 해상도·밀도 원래 값 복원 및 TCP 9222 전달 제거를 완료했습니다.

APK: 3,065,923바이트. SHA-256: `3d5033351e5a83f7e469d99c77604227e60ad2a0abcfef0f8a15f72ae4975d04`.

화면 크기 강제 설정 중 일부 캡처의 글자 렌더링이 왜곡됐으나, 강제 설정 해제 후 1280×800 Android 전체 화면에서 정상 표시를 확인했습니다. 실물 태블릿·실제 POS·장시간 운영은 미검증입니다. 기기의 화면 밀도에 따라 2열 또는 위아래 배치를 선택하므로 실제 태블릿의 Android 표시 크기 설정도 현장에서 확인해야 합니다.

## 2.4.1 이전 검증 기록

검증일: 2026-09-21 / versionCode 11 / 패키지 `kr.dogdive.roomorder.tablet`

## 2.4.1 전체 UI 점검

좁은 상품 상세에서 가격/통화 단위가 줄바꿈되는 부분, 하단 숫자 애니메이션의 표시 문제, 작은 네이티브 확인창 글씨·버튼을 수정했습니다. 원본 가격·수량·주문 이벤트는 유지합니다. 상세 내용과 전후 화면은 [UI 점검 결과](UI-REVIEW.md)에 기록했습니다.

| 항목 | 결과 |
|---|---|
| 웹 화면 조합 | 메뉴·카테고리·무료/유료 상세·주문내역·빈 장바구니·긴 장바구니 fixture·일반/긴 확인창 9종 × 세 가지 가로 크기 × 밝음/어두움 × 글자 120%/140% = 108개. 가로 넘침·검사 대상 48px 미만 터치 영역 없음 |
| 큰 글자 추가 검사 | 140%에서 가격 한 줄 표시, 확인창/버튼 화면 내 배치, 버튼 높이 64px 이상, 긴 본문 스크롤 확인 |
| 수량·금액 일치 | 실제 유료 상세의 +/− 터치 후 현재 수량과 합계 변경 확인. 원본 접근성 값과 표시된 숫자 일치. 주문 변경 요청 0회 |
| 네이티브 | 1280×800dp 기본 글자와 1024×600dp/Android 글자 130%의 두 테마에서 PIN·관리자·키오스크·확인창 16개 조합 통과. 잘림 없이 저장 버튼에 도달, 확인 버튼 64dp 이상 |
| PIN 키보드 | 실제 PIN 필드를 빈 상태로 터치. 키보드 표시 후 입력란/버튼 표시 확인. PIN 입력·추출·변경 없음 |
| 입력 보호 | 실제 상세 수량 3회, 로컬 장바구니 PATCH/DELETE 각 10회 반복 입력/뒤로 가기 차단. 담기 6초 지연 중 반복 터치·뒤로 가기 각 12회에도 요청 1개. 모든 시험 변경 요청은 서버 전송 전에 차단 |
| 빌드·소스 | Android Studio MCP assembleDebug·assembleRelease·lintRelease·개발/배포 APK 설치·실행 통과. PIN·세션/충돌 복구·입력 보호·리소스 검사 통과. Lint 오류 0 / 기존 경고 16 |
| 배포 검증 | 릴리스 서명, API 33, 통합 패키지, 가로 Activity 12개와 독립 방 프로세스 8개, debuggable 아님 확인. 배포 APK에 테스트 instrumentation 없음 |

관리자 화면 검사는 별도 테스트 APK에서 인증 성공 상태를 대체해 수행했습니다. 배포 앱의 PIN 보호는 유지합니다. 기기 화면 크기·Android 글자 배율·개발 앱의 표시 설정은 검사 후 원래 값으로 복원했고 임시 TCP 9222 전달을 제거했습니다. 실물 태블릿·실제 주문/결제/POS·매장의 모든 옵션 조합·장시간 운영은 미검증입니다. 기존 만료/충돌/부팅 기능의 현장 검증을 이번 UI 검사로 대체하지 않습니다.

최종 2.4.1 / versionCode 11 배포 앱을 Android Studio MCP로 기존 앱 위에 설치하고 기존 PIN 초기 설정 화면 진입을 확인했습니다. 임의 PIN 설정이나 데이터 초기화는 하지 않았습니다.

증빙: `captures/ui-v241/final-120.log`, `final-140.log`, `final-140/numeric-touch-check.json`, `native-1280-default.log`, `native-1024-large.log`, `cart-input.log`, `transition-check.log`, `source-check.log`, `mcp-build.json`, `mcp-release-install.json`. 웹 재검사: `scripts/check-ui-matrix.mjs --strict`.

APK: 3,064,647바이트. SHA-256: `4997f738c4835f9ed42173dd81f01e43779f3ce133984bb28af3b8d1bb33194a`.

## 2.4.0 이전 검증 이력

검증일: 2026-09-19 / versionCode 10 / 패키지 `kr.dogdive.roomorder.tablet`

## 2.4.0 다크모드

관리자 PIN 인증 후 다크모드를 선택하고 저장합니다. 기본값은 꺼짐이고 태블릿별로 유지됩니다. 기존 WebView를 재생성하거나 페이지를 다시 열지 않고 네이티브 색상과 토스의 `data-tds-color-scheme`을 함께 변경합니다. 이후 새 문서에도 저장한 모드를 적용합니다. 메뉴 사진을 필터로 반전하지 않으며 주문 버튼이나 데이터를 복제하지 않습니다.

| 항목 | 검증 내용 |
|---|---|
| 빌드 | Android Studio MCP로 assembleDebug·assembleRelease·lintRelease 및 개발 APK 설치·실행 성공. Lint 오류 0 / 기존 경고 16 |
| 관리자 설정 | 별도 androidTest APK에서 PIN 화면에 다크모드 설정이 노출되지 않음 확인. 인증 성공 상태를 테스트 프로세스에서만 대체하고 실제 체크박스·저장 클릭을 검사. 저장 전 값 유지, 저장 후 새 SettingsStore·방 Intent·비공개 IPC 값 일치, 방·글자 크기·가로 설정 유지 확인 |
| 네이티브 테마 | 밝음/어두움 관리자 테마와 창 배경 검사. 저장 후 재실행한 방 화면과 실제 네이티브 메뉴 이동 확인창의 다크모드 캡처 확인. PIN 값 조회·변경·초기화 없음 |
| 웹 화면 | 실제 메뉴·상세·빈 장바구니 및 현재 토스 번들의 장바구니/확인창 컴포넌트로 만든 표시 전용 fixture 검사. 확인창 1112×800, 856×600, 720×480 CSS px에서 제목·설명 겹침 없음, 버튼 높이 64px 이상, 가로 넘침 없음 |
| 글자 대비 | 7개 화면/크기 조합의 화면 내 글자·버튼 표본 54개 통과. 일반 글자 4.5:1, 큰 글자 3:1 기준. 고정 색상이 남은 수량 숫자·취소 버튼·카테고리 흰 그라데이션을 수정하고 삭제 아이콘의 토큰도 보정 |
| 페이지 유지 | 실제 메뉴·상세와 장바구니 fixture에서 밝음↔어두움 전환 후 URL, history 길이, 기존 DOM 컨트롤 동일성, 표시 수량/텍스트, 사진 URL 유지. 사진 filter는 none. 새로 추가된 light 테마 scope도 dark로 동기화 |
| 수량·삭제 회귀 | 실제 상세 수량 터치 3회. 원본 장바구니 컴포넌트의 로컬 PATCH/DELETE를 지연해 각 10회 반복 터치·뒤로 가기에도 요청 1개 유지. 웹·네이티브 전체 가림막 없이 응답 후 갱신. 시험 변경 요청 2개는 로컬에서만 응답 |
| 기존 안전 장치 | PIN, 세션/충돌 복구 예산, 입력 잠금, 리소스 검사 통과. 실제 WebView의 분리된 시험 프레임에서 기존 세션 종료/QR 만료 판별 32개 경우 통과 |

자동화는 Android 13/API 33 에뮬레이터의 개발 APK에서 수행했습니다. 관리자 인증 성공 상태 대체 코드는 별도 테스트 APK에만 있고 배포 APK에는 없습니다. PIN을 알아내거나 공통 PIN을 만들지 않았습니다. 시험 후 개발 APK의 다크모드는 원래 기본값인 꺼짐으로 복원했습니다.

이 검사는 실제 주문·결제·POS 전송 및 실물 태블릿 장시간 운영 검증을 포함하지 않습니다. 관리자 저장 경로와 웹 색상 전환 경로를 각각 검사했으며, 실제 관리자가 PIN을 입력하는 전체 흐름을 자동 수행한 것은 아닙니다. 전체 토스 화면의 모든 색상 조합이나 향후 토스 페이지 변경까지 보장하지 않습니다. 자동 부팅·실제 장시간 QR 만료·WebView 엔진 충돌은 이번 변경에서 재검증하지 않았습니다.

증빙: `captures/dark-v240/dark-check.log`, `dark-results.json`, `native-check.log`, `cart-input-check.log`, `session-check.json`, `source-check.log`, `mcp-build.json`, `dark-menu-native.png`, `native-confirm-dark.png`, `confirmation-dark-720.png`. 재검사: `scripts/check-dark-mode.mjs`, `scripts/check-cart-edit-visibility.mjs --output=captures/dark-v240`, `scripts/check-source.ps1`.

APK: 3,063,095바이트. SHA-256: `5fa15946dc0c00c60c6e1605ed22c78cecca6c20e30137eb399135ac216b6f64`. 릴리스 서명·API 33·가로 Activity 12개·방 프로세스 8개·debuggable 아님 검사 통과.

최종 배포 APK도 Android Studio MCP로 기존 배포 앱 위에 설치·실행했습니다. 설치된 versionName 2.4.0 / versionCode 10과 기존 관리자 PIN 초기 설정 화면 진입을 확인했습니다. 임의 PIN 설정이나 앱 데이터 초기화는 하지 않았습니다. 배포 APK와 설치 빌드의 해시 일치 및 릴리스 Manifest에 테스트 instrumentation이 없는 것을 확인했고 TCP 9222 전달을 해제했습니다.

## 2.3.4 이전 검증 이력

검증일: 2026-09-18 / versionCode 9 / 패키지 `kr.dogdive.roomorder.tablet`

## 2.3.4 장시간 미조작 후 QR 만료 자동 복귀

기존 판별기는 결제 세션 종료 문구만 인식해 QR 접속 인증 만료 화면을 놓쳤습니다. 현재 토스 페이지의 QR 만료 컴포넌트에서 `QR을 다시 인식해주세요 / 접속 가능한 시간이 지났어요` 문구를 확인하고, 내부 판별용 리소스에 추가했습니다. 원본 페이지 문구를 바꾸거나 새 고객 안내 문구를 하드코딩하지 않았습니다.

화면이 4초 이상 유지되면 저장된 방의 원본 QR 링크를 GET으로 다시 엽니다. 2초 검사 간격 때문에 복귀 시작은 보통 약 4~6초이며 실제 메뉴 로딩 시간은 별도입니다. 정상 메뉴가 열리면 만료된 뒤로 가기 기록을 지웁니다. 재시도 예산·간격, 정상 메뉴 10초 후 예산 초기화, 관리자 화면에서 검사 중단은 기존 정책을 유지합니다.

`interaction.js`가 요청 처리 상태를 제공해 진행 중인 변경·화면 이동·결과가 불확실한 주문/결제에는 자동 복귀하지 않습니다. 실패한 장바구니 변경 요청의 가림막 뒤에 QR 만료 화면이 있으면 입력 잠금을 해제하지 않고 원본 QR GET으로 복귀합니다. 정상 장바구니는 유지하며 앱에서 쿠키·장바구니 데이터를 삭제하거나 요청을 재전송하지 않습니다. HTTP 401·403·404·410도 페이지를 검사하지만, 상태 코드만으로 복귀하지 않고 실제 만료 화면이 확인되어야 합니다.

| 항목 | 결과 |
|---|---|
| 실제 원본 화면 확인 | 연결된 Android 13/API 33 `emulator-5554`의 저장된 1번방, 현재 Toss build `yo6O7FSvFoRtoSv-sEr0B`에서 QR 만료 컴포넌트 확인 |
| 화면 판별 | 실제 WebView의 분리된 시험 프레임에서 32개 경우 통과. QR 만료·기존 종료 문구·정상 메뉴·상품·빈 장바구니·결제 입력·팝업·숨긴 제목·오래된 오류 쿠키·처리 중 상태 등 구분 |
| QR 만료 복귀 | 현재 토스의 원본 QR 만료 컴포넌트를 표시한 뒤 고객 버튼 조작 없이 원본 방 QR GET 1회, 같은 테이블 메뉴 복귀, 탐색 기록 1개 확인 |
| 장바구니 요청 중 만료 | 시험 PATCH를 서버 전송 전에 차단하고 QR 만료 컴포넌트 표시. 6.5초 동안 처리 중에는 복귀하지 않음. 로컬 401 응답 후 가림막 뒤 만료 화면을 인식하고 같은 방 메뉴 자동 복귀 |
| 불확실한 주문 보호 | 시험 POST를 로컬 503 응답으로 실패 처리한 뒤 QR 만료 화면 표시. 6.5초 동안 자동 복귀 0회, `uncertain_order` 결과 확인 안내 유지 |
| HTTP 오류 페이지 | 시험 문서 요청에 로컬 HTTP 404와 QR 만료 HTML을 응답. 네이티브 HTTP 오류 화면 뒤에서도 만료 화면 판별 후 같은 방 원본 QR GET으로 자동 복귀, 탐색 기록 1개 |
| 소스 검사 | PIN·복구 제한·세션 안정화/재시도 간격·리소스·입력 잠금 검사 통과. 초기 로딩과 처리 중에는 세션 복귀 불허, 실패한 장바구니는 허용, 불확실한 주문은 불허 확인 |
| 빌드·APK | Android Studio MCP assembleDebug·assembleRelease·lintRelease 및 개발 앱 설치·실행 통과. Lint 오류 0 / 기존 경고 16. 기존 배포 서명·Android 13·통합 패키지·가로 Activity 12개·방 프로세스 8개·debuggable 아님 검사 통과 |

자동 복귀 세 경우의 시험 전체 소요는 약 8.6~9.3초였습니다. 이 수치에는 메뉴 로딩과 탐색 기록 확인을 위한 추가 2.5초 대기가 포함되며, 실제 QR 만료 시간이나 모든 기기의 복귀 시간을 의미하지 않습니다.

시험에서는 원본 QR 만료 컴포넌트와 로컬 실패 응답을 사용했습니다. 실제 토스 서버 세션의 만료 시간을 변경하거나 장시간 방치해 만료를 유도하지 않았습니다. 시험 장바구니/주문 변경 2개는 모두 서버 전송 전에 차단했고 실제 주문·결제·POS 전송은 하지 않았습니다. 실물 태블릿에서의 장시간 미조작 재현은 현장 검증이 남아 있습니다. 키오스크 자동 부팅·장시간 부하·WebView 엔진 충돌은 이번 변경에서 다시 검증하지 않았습니다.

증빙: `captures/expiry-v234/toss-qr-component.json`, `session-dom-results.json`, `qr-recovery-results.json`, `original-qr-expired.png`, `expired-under-cart-cover.png`, `uncertain-order-preserved.png`, `mcp-build.json`. 재검사: `scripts/check-webview.mjs`, `scripts/check-qr-expiry.mjs`, `scripts/check-source.ps1`.

최종 배포 APK를 Android Studio MCP로 기존 배포 앱 위에 설치·실행했습니다. 기기에서 versionName 2.3.4 / versionCode 9 및 관리자 PIN 초기 설정 화면을 확인했습니다. 임의 PIN 생성이나 앱 데이터 초기화는 하지 않았고, 시험용 TCP 9222 연결을 해제했습니다.

배포 APK: 3,057,694바이트. SHA-256: `3a5996f6021300dea0ff7e57362d97113aa530097be394bd1ac1a85b4ca96451`.

## 2.3.3 이전 검증 이력

검증일: 2026-09-16 / versionCode 8 / 패키지 `kr.dogdive.roomorder.tablet`

## 2.3.3 수량·삭제 작업의 불필요한 대기 화면 제거

입력 잠금(`busy`)과 전체 화면 대기 표시(`cover`)를 분리했습니다. 일반 버튼·수량·옵션 선택, 장바구니 항목 PATCH/DELETE 요청은 화면을 유지합니다. 초기 로딩·실제 페이지 이동·담기 POST·주문·결제에는 가림막을 유지합니다. 실패해 결과가 불확실하면 장바구니/주문내역 확인 안내를 표시합니다. 확인 동작은 토스의 기본 경로가 중복되지 않는 전체 주소로 새 GET을 수행합니다.

현재 토스 수량 버튼은 `click` 이전의 터치/포인터 이벤트에서도 동작합니다. 실제 터치 검사에서 이 경로로 중복 요청이 발생하는 것을 확인해, 처리 중에는 포인터·터치·마우스·키보드 이벤트도 캡처 단계에서 차단했습니다. 요청 본문이나 원본 함수의 반환값은 바꾸지 않으며 자동 재전송하지 않습니다. 새 고객 문구·고정 메뉴 데이터·관리자 설정은 추가하지 않았습니다.

| 항목 | 결과 |
|---|---|
| 실제 상세 수량 | Android 13/API 33 에뮬레이터 `emulator-5554`, 현재 저장된 1번방. 원본 토스 수량 버튼을 실제 터치 이벤트로 더하기 2회·빼기 1회 조작해 실제 숫자 증감 확인. 웹 가림막 없음, 네이티브 대기 문구 없음 |
| 장바구니 수량·삭제 | 현재 토스 원본 장바구니 행·수량 컴포넌트를 시험 화면에 사용. 시험 핸들러의 PATCH/DELETE 요청을 CDP에서 지연 후 로컬 응답. 각각 처리 중 터치 10회·뒤로 10회에도 요청 1개. 전체 화면 안내 없이 장바구니 표시 유지, 응답 뒤 수량 2→3과 행 삭제 확인 |
| 담기 지연 | 원본 담기 버튼 요청을 6초 지연. 반복 담기/뒤로 각 12회에도 요청 1개, 필요한 대기 안내 유지, 로컬 성공 응답 후 메뉴 복귀 |
| 담기 시간 초과 | 원본 담기 요청 12초 지연으로 토스 시간 초과 발생. 반복 담기/뒤로 각 24회에도 요청 1개. 결과 확인 안내 유지, 장바구니 확인을 누르면 실제 장바구니 GET 화면 진입. 중복 `/table/table/` 경로 없음 |
| 독립 검사 | 초기 대기·로컬 버튼·폼 제출·라우터 지연·PATCH/DELETE·응답 본문 지연·실패 결과 확인·포인터/터치/키보드 차단과 해제·원본 요청 보존·재전송 없음 검사 통과. PIN·세션 복귀·충돌 복구 예산·리소스 검사 통과 |
| 빌드·서명 | Android Studio MCP assembleDebug·assembleRelease·lintRelease 및 에뮬레이터 개발 앱 설치·실행 성공. Lint 오류 0 / 기존 경고 16. 배포 서명·API 33·가로 Activity 12개·독립 방 프로세스 8개·debuggable 아님 검사 통과 |

장바구니 편집 시험 화면의 상품명은 원본 상세에서 읽고, 가격과 핸들러는 시험 전용입니다. 실제 서버의 장바구니를 수정한 검증이 아니며, 모든 시험 변경 요청은 서버 전송 전에 차단하고 로컬에서 응답했습니다. 실제 주문·결제·POS 전송 및 물리 태블릿 검증은 하지 않았습니다. 키오스크/HOME/자동 부팅 설정 코드는 변경하지 않았으며 재부팅은 다시 시험하지 않았습니다.

에뮬레이터에서 기존 WebView 149 `NetworkService` SIGTRAP이 다시 관찰돼 복구 후 재연결했습니다. 최초 설치 직후 Android `TopResumedActivityChangeItem`의 Activity client record 오류도 한 차례 기록되었고, 다시 실행 및 최종 빌드 설치 후 정상 진입했습니다. 이번 변경이 해당 엔진·시스템 오류를 해결했다고 주장하지 않습니다. CPU 3배·6배 지연 프레임 검사는 디버거 Runtime.evaluate 시간 초과로 완료하지 못했으며 통과 결과에 포함하지 않습니다.

증빙: `captures/interaction-v233/cart-edit-results.json`, `patch-pending.png`, `delete-pending.png`, `detail-quantity.png`, `cart-delay-results.json`, `cart-timeout-results.json`, `mcp-build.json`. 검사 스크립트: `scripts/check-cart-edit-visibility.mjs`, `scripts/check-transition-cart.mjs`, `scripts/check-source.ps1`.

최종 배포 APK를 Android Studio MCP로 기존 배포 앱 위에 설치·실행했습니다. 기기에서 versionName 2.3.3 / versionCode 8과 관리자 PIN 초기 설정 화면 진입을 확인했습니다. 임의 PIN 생성이나 앱 데이터 초기화는 하지 않았습니다. 테스트용 TCP 9222 연결을 해제했습니다.

배포 APK: 3,057,034바이트. SHA-256: `d8d15d5daa9be09902f6e18f8b89ccd82285a88a529221229aa47d4c9a867a9c`.

## 2.3.2 이전 검증 이력

검증일: 2026-09-15 / versionCode 7 / 패키지 `kr.dogdive.roomorder.tablet`

## 2.3.2 화면 전환·중복 입력 방지

기존 앱은 `onPageFinished`에서 가로 보정 스크립트를 주입하고, SPA DOM 변경은 다음 animation frame으로 미뤘습니다. 페이지 초기 로딩·라우팅 중 원래 폭이 먼저 보일 수 있는 경로를 페이지 시작 주입과 그리기 전 DOM 보정으로 변경했습니다. AndroidX WebKit 1.15.0의 기능 지원을 확인하고 사용하며, 미지원 WebView에서는 네이티브 대기 화면과 로딩 콜백을 사용합니다. 원본 배치 설정을 꺼도 반복 입력 방지는 유지합니다.

화면 전환·변경 요청 중에는 웹 화면과 네이티브 뒤로/처음 버튼을 가리고 비활성화합니다. 원본 fetch/XHR 호출을 그대로 전달하면서 응답 본문 종료까지 추적합니다. 토스 라우터 완료와 레이아웃 안정화 후 WebView의 VisualStateCallback으로 네이티브 가림막을 해제합니다. 고정 시간만 경과했다고 처리 중인 요청의 잠금을 풀지 않습니다.

| 항목 | 결과 |
|---|---|
| 느린 화면 전환 | 실제 Android 13 WebView에서 CPU 6배 지연, 네트워크 300ms 지연·400KB/s 제한. 초기 메뉴 진입과 메뉴/상세/뒤로 3회 왕복의 409개 프레임 검사. 대기 중 349개 프레임은 가림막 유지, 노출 60개에서 세로 폭·보정 미적용 프레임 0개 |
| 연속 뒤로 | 전환마다 뒤로 요청 3회 연속 호출 시 첫 요청만 허용. 추가 요청 2회 차단 및 같은 방 메뉴 복귀 |
| 실제 담기 버튼 | 원본 상세의 담기 요청을 CDP에서 서버 전송 전에 중단하고 6초 뒤 로컬 성공 응답. 담기/뒤로 각 12회 반복에도 요청 1개, 응답·라우팅 후 메뉴 복귀. 서버에 전달한 장바구니 변경 요청 0개 |
| 토스 시간 초과 | 원본 요청을 12초 지연하자 토스 클라이언트의 약 10초 timeout 발생. 담기/뒤로 각 24회 반복에도 요청 1개. 시간 초과 이후에도 입력 잠금 유지, 장바구니 확인 동작 후 실제 장바구니 GET 진입 |
| 응답 본문·XHR | 독립 JS 검사에서 헤더 수신 후 본문 지연 중 잠금 유지, 지연 XHR 완료, 연속 클릭·뒤로 차단, 입력 인자/Response 보존 확인 |
| 주문 결과 불확실 | 외부 주문을 보내지 않는 독립 검사에서 주문 요청 거절 후 30초가 지나도 재입력 차단, 명시적 확인 동작은 주문내역 GET 주소로 이동. 자동 재시도 0개 |
| 기존 확인창 | 토스 원본 확인창 컴포넌트에 표시 전용 시험 문구와 주문 함수 없는 버튼을 사용. 1112×800, 856×600, 720×480에서 제목/본문 겹침 없음, 버튼 64px·가로 넘침 없음 |
| 빌드 | Android Studio MCP로 assembleDebug·assembleRelease·lintRelease 및 에뮬레이터 설치·실행 성공. Lint 오류 0 / 경고 16: 고정 가로 12개와 기존 도구·대상/의존성 버전 안내 4개 |
| 배포 APK | 기존 서명 유지, debuggable 아님, API 33, 가로 Activity 12개·독립 방 프로세스 8개 검사 통과. MCP로 기존 배포 앱 위에 설치·실행하고 기기에서 versionName 2.3.2 / versionCode 7 확인. PIN·방 설정을 초기화하지 않음 |

테스트 중 실제 주문·결제는 전송하지 않았습니다. 서버의 멱등성 처리를 추가한 것은 아니며, 실제 POS의 중복 접수 방지와 물리 태블릿의 느린 환경은 현장 확인이 남아 있습니다. 이전부터 관찰된 WebView 149 엔진 충돌은 별도 문제이고 기존 2.3.1 복구 경로를 유지합니다. 이번 버전에서 Device Owner 등록·잠금·실제 재부팅은 다시 시험하지 않았습니다.

증빙: `captures/transition-v232/frame-results.json`, `cart-delay-results.json`, `cart-timeout-results.json`, `mcp-build.json`. 재검증: `scripts/check-source.ps1`, `scripts/check-transition-cart.mjs`, `scripts/check-transition-frames.mjs`. 지연 요청 검사는 개발용 WebView에서만 사용하고, 주문 전송용으로 사용하지 않습니다.

최종 APK: 3,056,426바이트. SHA-256: `751cb893c6ffcc5afd830cc2297800da50d109902137beef99fa44ac31f01ecf`. 테스트용 TCP 9222 연결을 해제했습니다. 최종 대기 화면의 버튼 비활성 표시는 `captures/transition-v232/pending-native.png`에서 확인했습니다.

참고: [Android WebViewCompat 문서 시작 스크립트](https://developer.android.com/reference/androidx/webkit/WebViewCompat#addDocumentStartJavaScript(android.webkit.WebView,java.lang.String,java.util.Set%3Cjava.lang.String%3E)), [WebView VisualStateCallback](https://developer.android.com/reference/android/webkit/WebView.VisualStateCallback).

## 2.3.1 이전 검증 이력

검증일: 2026-09-14 / versionCode 6 / 패키지 `kr.dogdive.roomorder.tablet`

## 2.3.1 간헐 종료 복구

연결된 Android 13/API 33 에뮬레이터 `emulator-5554`에서 Android System WebView **149.0.7827.163**의 `NetworkService` 스레드가 SIGTRAP으로 방 프로세스를 종료한 기록을 확인했습니다. `libwebviewchromium.so`의 반복되는 동일 위치이며, Java UI 예외가 아닙니다. 이 버전은 외부 WebView 엔진 자체를 변경하지 않고 앱의 복구 경로를 보완합니다.

| 항목 | 확인 결과 |
|---|---|
| 네이티브 충돌 | 개발용 `:room7` 프로세스에 SIGTRAP을 발생시켜 같은 종류의 프로세스 종료 시험. 기본 호스트 PID 25628 유지, 방 PID 25667 → 25845 → 26080으로 재생성, 7번방 실제 메뉴 재진입 |
| 실제 엔진 오류 재발 | 13:06:44에 별도 강제 종료 없이 `NetworkService`가 동일한 `libwebviewchromium.so +0x3674fc2`에서 SIGTRAP. 호스트 PID 26957 유지, 방 PID 27365 → 27609 자동 복구, 실제 7번방 메뉴와 탐색 기록 1개 확인 |
| Android 종료 처리 | 주문 화면 바로 아래 Activity도 Android가 강제 종료하는 경로를 재현. 내부 RoomBoundaryActivity를 두어 기본 복구 화면 유지 |
| 연속 오류 제한 | 자동 복구 예산의 3회차 복구 후 4회차에서는 RoomPickerActivity가 전면 유지. '직원에게 알려 주세요'와 수동 열기 버튼 표시. 수동 열기로 실제 메뉴 재진입 |
| 렌더러 종료 | 개발용 CDP `Page.crash` 사용. `onRenderProcessGone` 처리와 `renderer=true` 복구 기록 확인, 호스트와 방 프로세스 PID 유지하며 새 Room Activity 생성. 실제 방 메뉴·탐색 기록 1개 확인 |
| 관리자 뒤에서 충돌 | 상품 상세 → 관리자 PIN 화면에서 방 PID만 종료. PIN 화면 유지, 뒤로 복귀 시 새 PID 27365에서 같은 방 `/menu?tid=...`로 진입, 탐색 기록 1개. 중간 상품/결제 탐색 기록을 복원하지 않음 |
| 런처 재진입 | 상품 상세에서 런처 Intent 재실행 후 같은 상세 URL·탐색 기록 유지. 관리자 설정 진입 시 기존 PIN 요구 |
| 반복 조작 | 실제 오류 복구 후 디버거를 새 프로세스에 다시 연결하여 메뉴 ↔ 상품 상세 20회 왕복, 28.5초 검사 통과. 같은 방 유지, 주문 변경 요청 0개. 이전 디버거 연결은 실제 엔진 충돌로 끊겨 이를 통과로 집계하지 않음 |
| 복구 예산 검사 | Java 검사로 1.5/3/6초 대기, 최대 3회, 예산 저장·재생성, 5분 경과, 시스템 시각 역행 및 수동 초기화 확인 |
| 빌드·Lint | Android Studio MCP `execute_terminal_command`에서 assembleDebug·assembleRelease·lintRelease 성공. 오류 0 / 경고 15(가로 Activity 12개와 기존 버전 안내 3개). PIN·세션 복귀·리소스 검사 통과 |
| 배포 APK | 기존 서명·패키지 유지, API 33, 가로 Activity 12개, 방 프로세스 8개, debuggable 아님, 릴리스 서명 검사 통과. MCP에서 기존 앱 위에 설치·관리자 초기 화면 진입 성공(종료 코드 0). 임의 PIN 생성이나 데이터 초기화 없음 |

복구는 저장된 방의 원본 QR 링크를 GET으로 다시 여는 방식입니다. 주문·결제·주문 삭제는 실행하지 않았고, 제출 중이던 주문을 자동으로 재전송하는 코드를 추가하지 않았습니다. 복구 후 주문내역 확인 문구를 표시합니다. 충돌 직전 주문의 실제 접수 여부·장바구니 유지 여부는 토스 상태에 따라 달라집니다.

이번 검증 기기는 일반 에뮬레이터입니다. 실제 매장 태블릿, 생산 POS 주문, 최신 버전에서의 Device Owner 등록·잠금·물리 재부팅은 이번 종료 수정에서 재시험하지 않았습니다. 아래 2.2.0 키오스크 검증은 이전 버전의 기록이며 새 버전의 현장 장시간 안정성 보증이 아닙니다. Android 설정의 사용자 강제 중지를 해제하는 동작은 포함하지 않습니다.

최종 APK 크기: 2,168,497바이트. SHA-256: `95715a87d9a0231f710e3410f110998cbfa7432695728a556a6acb313ece2451`. 테스트용 ADB TCP 9222 연결은 검증 후 해제했습니다.

증빙: `captures/crash-v231/native-crash-boundary.json`, `retry-limit.json`, `renderer-crash.json`, `background-crash.json`, `real-engine-crash.log`, `real-engine-recovery.log`, `navigation-results.json`, `recovered.png`, `retry-stopped.png`, `mcp-build.json`. 재검증에는 `scripts/check-source.ps1`, `scripts/crash-test-renderer.mjs`, `scripts/check-navigation.mjs`를 사용합니다. 충돌 도구는 개발용 WebView에만 연결합니다.

설계 근거: [Android WebViewClient의 렌더러 종료 처리](https://developer.android.com/reference/android/webkit/WebViewClient#onRenderProcessGone(android.webkit.WebView,%20android.webkit.RenderProcessGoneDetail)), [Android 13 Task의 finishTopCrashedActivityLocked 구현](https://github.com/aosp-mirror/platform_frameworks_base/blob/android13-release/services/core/java/com/android/server/wm/Task.java).

## 2.3.0 이전 검증 이력

검증일: 2026-09-14 / versionCode 5 / 패키지 `kr.dogdive.roomorder.tablet`

## 2.3.0 화면과 세션 복귀 검증

Android Studio MCP의 `execute_terminal_command`로 Android 13 에뮬레이터 `emulator-5554`에 빌드·설치·실행했습니다. 기존 서명과 패키지를 유지합니다. 테스트 중 실제 주문·결제·주문 삭제 API는 호출하지 않았습니다.

| 항목 | 확인 결과 |
|---|---|
| 확인창 원인 재현 | 토스 원본 ConfirmDialog 컴포넌트를 주문 함수 없이 표시. 기존 CSS에서 제목/설명의 computed line-height가 0px, 제목 높이가 약 3px으로 축소되는 현상과 겹침을 캡처 |
| 확인창 수정 | unitless TDS 토큰과 em을 혼합하던 max()를 제거. 원본 native `<dialog>`도 식별. 제목·설명 높이 정상, 버튼 최소 64px |
| 가로 화면 크기 | 글씨 140%인 WebView에서 1112×800, 856×600, 720×480 CSS px 검사. 제목/본문/버튼 겹침 없음, 팝업 화면 밖 잘림·수평 넘침 없음 |
| 메뉴·상세 | 실제 7번방 메뉴와 상품 상세 표시. 이미지·정보 좌우 배치, 수량 56px, 하단 담기 72px 확인 |
| 장바구니 | 토스 원본 항목·수량 컴포넌트에 표시 전용 데이터 및 긴 옵션을 넣어 검사. 원본 하단 버튼의 이벤트 없는 복사본과 큰 옵션 변경 시험 버튼 사용. 세 크기에서 카드 밖으로 버튼이 넘치지 않고 터치 크기 유지 |
| 종료 감지 | 실제 Android WebView의 격리 iframe에서 15개 DOM 사례 통과. 공백이 다른 예전 종료 문구, 번역된 종료 문구, 만료 쿠키, 숨은 문구, 일반 완료 화면, 메뉴 이름 오인식, 장바구니, 결제 폼, native/ARIA 팝업, 다른 호스트·HTTP, 일반 오류, 빈 페이지 검사 |
| 자동 복귀 통합 | 디버그 WebView 본문을 종료 재현 화면으로 바꾼 뒤 앱의 실제 Handler가 원본 7번방 QR 링크를 GET으로 열고 실제 메뉴로 복귀. 방 tid 동일, 탐색 기록 1개, 주문 관련 변경 요청 0개. 네트워크 로딩과 완료 확인 대기까지 약 9~10초 |
| 복귀 제한 | Java 테스트로 안정된 종료 화면 4초, 화면 전환/일시 중단, 30초/120초 대기, 프로세스 재생성 시 제한 유지, 최대 3회, 정상 메뉴 10초 후 제한 초기화 확인 |
| 빌드·Lint·서명 | assembleDebug, assembleRelease, lintRelease 성공. Lint 오류 0, 기존 경고 14. PIN·문자열·방 링크·매니페스트·릴리스 서명 검사 통과 |
| 배포 APK 설치 | MCP에서 서명된 2.3.0 설치·실행 성공, versionCode 5 확인. 현재 에뮬레이터의 배포 앱은 PIN 미설정 상태로 초기 PIN 생성 화면에 진입. 임의 PIN을 만들거나 기존 데이터를 초기화하지 않음 |

새 앱이 토스의 주문 완료나 결제를 실행해서 종료 상태를 만든 것은 아닙니다. POS에서 실제 결제 완료/전체 주문 삭제가 발생하는 연동 상황은 현장 확인이 남아 있습니다. 토스 화면 구조나 종료 문구가 크게 바뀌는 경우 감지 규칙의 재검증이 필요합니다.

개발 에뮬레이터에 설치된 Android System WebView 149.0.7827.163에서 `NetworkService`의 SIGTRAP 네이티브 종료가 관찰됐습니다. 이번 수정 전 2.2.0 디버그 앱에서도 같은 종료가 발생했으며, Java 예외나 UI 수정으로 해결된 문제로 분류하지 않았습니다. 본 검증은 화면 배치·복귀 기능 확인이며 WebView 엔진의 장시간 안정성 보증은 아닙니다. 실제 운영 태블릿에서도 별도의 연속 실행 확인이 필요합니다.

증빙: `captures/ui-v230/dialog-before.png`, `dialog-after.png`, `dialog-layout-results.json`, `cart-layout-results.json`, `session-dom-results.json`, `native-return-results.json`, `mcp-release-install.json`.

재검증: `scripts/check-source.ps1`, `scripts/check-webview.mjs`, `scripts/check-dialog.mjs`, `scripts/check-session-return.mjs`. WebView 도구는 개발용 앱에서만 사용하며 표시 전용 확인창을 먼저 엽니다. 결제 제출 함수를 연결하지 않습니다.

## 2.2.0 이전 검증 이력

검증일: 2026-09-12 / versionCode 4 / 패키지 `kr.dogdive.roomorder.tablet`

## 2.2.0 키오스크 추가 검증

기존 태블릿 데이터와 분리해 프로젝트의 `build/kiosk-avd`에 새 Android 13 에뮬레이터 `RoomOrderKioskQA`를 만들었습니다. Serial은 `emulator-5556`, 해상도는 2560×1600, 밀도는 320dpi입니다. 계정 0개인 이 시험 기기에서만 기기 소유자 등록과 잠금을 검증했습니다.

| 항목 | 확인 결과 |
|---|---|
| Android Studio MCP | `build_project` 성공, problems 없음. `execute_terminal_command`에서 `run-android.ps1 -Serial emulator-5556 -InstallRelease` 실행·설치·최초 화면 진입 성공, 종료 코드 0 |
| 기존 앱 업데이트 | 최종 APK를 MCP의 `run-android.ps1 -Serial emulator-5554 -InstallRelease`로 기존 2.1.0 위에 설치·실행 성공. 버전 2.2.0, 기존 1번방 진입과 관리자 PIN 인증 화면 유지 확인. 이 기존 기기에는 홈 지정이나 기기 소유자 등록을 적용하지 않음 |
| 최종 빌드·Lint | `assembleRelease lintRelease` 성공. 오류 0 / 경고 14: 가로 방향 11개, Android 대상 버전 및 도구 버전 안내 3개 |
| 배포 검사 | 서명 정상, debuggable 아님, API 33 이상, 가로 Activity 11개, 독립 방 프로세스 8개, HOME·DPC·내부 설정 Provider 확인 |
| 일반 자동 실행 | 전용 기기 등록 전 Android 기본 홈 앱 선택창에서 앱 선택 성공. 실제 재부팅 후 Room1 자동 진입 확인 |
| 관리자 경계 | ADB 외부 호출로 AdminActivity와 RuntimeSettingsProvider에 접근하면 각각 SecurityException으로 차단 |
| 전용 기기 등록 | 작업용 새 AVD에만 `dpm set-device-owner` 성공. 관리자 화면에서 등록 완료 상태 확인 |
| 잠금 | PIN 인증 뒤 켜고 저장하면 `mLockTaskModeState=LOCKED`. 화면 고정(PINNED) 아님 |
| 이탈 차단 | 홈·최근 앱 keyevent와 알림창 펼치기 요청 후 같은 Room1 Activity 유지, LOCKED 유지 |
| 부팅 후 잠금 복원 | 실제 재부팅 후 선택한 HOME과 방 자동 진입, LOCKED 상태 복원 확인. 최종 APK에서는 중지 후 재활성화하여 새 boot ID와 Room2 복원을 확인 |
| 방 전환 | 잠금 상태에서 PIN 인증 후 Room1 → Room2 전환, 같은 잠금 유지 |
| 최초 연결 복구 | 처음 여는 Room2를 오프라인으로 열어 연결 오류 확인. 네트워크 활성화 후 추가 터치 없이 실제 Room2 메뉴 로딩 확인 |
| 관리자 점검 | PIN 인증 뒤 `기기 설정 열기`로 NONE 전환 및 Android 설정 진입. 복귀 시 PIN 입력 화면 표시 |
| 현재 화면 유지 | Room2 상품 상세 상태에서 점검·홈 복귀 후 같은 Activity 토큰과 상세 화면 유지. 잠금 종료 후 허용 목록을 해제하도록 순서 보완 |
| 화면 켜짐 | 켜면 주문 Activity가 `mHoldScreenWindow`로 표시되고, 끄고 저장하면 `mHoldScreenWindow=null`로 해제됨 |
| 자동 실행 해제 | 앱에 중지 상태를 영구 저장하고 홈 정책 해제 후 Pixel Launcher 선택. 최종 APK를 실제 재부팅하여 새로운 커널 boot ID, Pixel Launcher 전면, 잠금 NONE 확인 |
| 기존 검사 | PIN 암호화·형식·오답 검사, 방 링크 8개, 관리자 비공개, Java UI 문자열 리소스 검사 통과 |

주문 버튼·결제·주문 취소는 실행하지 않았습니다. 이번 키오스크 검증에서는 상품 상세까지만 열었고 장바구니에 상품을 추가하지 않았습니다. 이전 가로 화면·장바구니 검증 이력은 아래 2.1.0 기록을 참고합니다.

부팅 시 자동 재시도는 최초 방 링크의 GET 연결 오류에 한해 최대 3회로 제한합니다. 정상 로딩 또는 사용자 조작 이후에는 중단하며 POST·HTTP 오류·인증서 오류는 재시도하지 않습니다. 이미 로딩된 웹 페이지 내부 API의 재연결은 토스 페이지 동작을 따릅니다.

실제 매장 태블릿의 화면 잠금·제조사 홈 설정·재부팅과 POS 연동은 별도 현장 확인이 필요합니다. QR/EMM 배포와 실제 기기의 기기 소유자 등록은 수행하지 않았습니다. 설치·해제·기기 관리 등록 방법은 `KIOSK.md`에 있습니다.

홈 해제 후에도 부팅 초기에 이전 HOME 진입점이 호출되는 경우가 있어 앱의 중지 상태를 별도로 저장합니다. 중지 중에는 주문 WebView를 자동으로 열지 않으며, Android 홈 역할과 시스템 Intent 실행으로 선택된 원래 홈 앱에 복귀합니다. 선택창을 취소해 이 앱을 기본 홈으로 남겨 둔 경우에는 수동 시작 화면을 제공합니다.

재부팅 검사는 `sys.boot_completed=1`만 확인하지 않고 이전과 다른 커널 boot ID 및 예상 전면 앱을 함께 확인합니다. `scripts/test-kiosk-reboot.ps1`로 재현할 수 있습니다.

검증 후 새로 만든 시험 AVD와 임시 PIN 파일을 제거했습니다. 기존 `emulator-5554`에는 최종 2.2.0이 1번방으로 실행 중이며 기존 PIN·방 설정을 유지했습니다. 배포 ZIP에 서명 키나 시험 PIN을 포함하지 않았고, ZIP 내부 APK와 배포 APK의 SHA-256 일치를 확인했습니다.

증빙: `captures/kiosk-mcp-final-install.json`, `kiosk-existing-update.json`, `kiosk-final-boot-locked.json`, `kiosk-final-boot-disabled.json`, `kiosk-boot-unmanaged.json`, `kiosk-navigation-blocked.json`, `kiosk-room2-recovered.xml`, `kiosk-detail-before-maintenance.json`, `kiosk-detail-after-maintenance.json`, `kiosk-home-preserved.json`.

## 2.1.0 이전 검증 이력

아래는 2026-09-11~12에 확인한 2.1.0 (versionCode 3)의 기록입니다.

## 빌드 및 실행

| 항목 | 결과 |
|---|---|
| Android Studio MCP 연결 | `http://127.0.0.1:64342/stream` 초기화·프로젝트 조회·도구 호출 성공 |
| MCP 소스 빌드 | `build_project` 성공, problems 없음 |
| MCP에서 APK 빌드·실행 | `execute_terminal_command`로 `scripts/run-android.ps1 -Serial emulator-5554 -BuildRelease` 실행, 종료 코드 0 |
| Gradle | `assembleDebug assembleRelease lintRelease` 성공 |
| Android Lint | 오류 0 / 경고 13: Android 13 대상 지정, 고정 가로 방향, 빌드 도구 최신 버전 안내 |
| 릴리스 APK | `releases/unified/dogdive-order.apk`, 패키지 `kr.dogdive.roomorder.tablet`, Android API 33 이상 |
| 배포 검증 | 서명 정상, debuggable 아님, 10개 Activity 가로 방향, 8개 방 독립 프로세스 확인 |
| 실행 환경 | Android 13/API 33, `test` 태블릿 에뮬레이터, 320dpi, 2560×1600 및 2048×1200 픽셀 |
| 최종 서명 APK 실제 실행 | MCP 터미널의 `-InstallRelease` 실행으로 새 패키지 설치 성공, 2.1.0 확인 및 최초 PIN 설정 화면 표시 |
| 개발용 실제 실행 | `kr.dogdive.roomorder.dev`, versionCode 3 / 2.1.0-dev, Room1 실행 확인 |

이 Android Studio 버전의 일반 MCP `execute_run_configuration`은 Android 대상 대신 `<default>`를 선택하여 실패합니다. 장치를 명시한 MCP 터미널 실행은 성공했습니다. 확인창의 해당 명령만 허용했고 상시 무확인 실행 설정은 변경하지 않았습니다.

## 앱 동작

| 항목 | 확인 내용 |
|---|---|
| 최초 설정 | 기본 PIN 없이 숫자 6자리 생성·재입력 후 방 선택 |
| 관리자 진입 | 고객 화면에서 진입하면 먼저 PIN 요구, 재진입 시에도 요구 |
| 인증 실패 | 잘못된 PIN으로 설정 진입 차단, 5회 실패 후 30초 잠금 표시 |
| 정상 인증 | 잠금 시간 경과 후 올바른 PIN으로 설정 표시 |
| PIN 저장 방식 | 단독 Java 테스트에서 올바른 값·오답·잘못된 형식 검증, 같은 PIN도 서로 다른 salt 적용 |
| 민감한 설정 | 방 변경·원본 배치·글자 크기·새로고침·PIN 변경은 관리자 인증 안에 배치 |
| 방 전환 | 관리자 인증 후 1→2→1 전환, 실제 페이지의 테이블 번호 일치 |
| 저장소 분리 | `app_webview_room_1`, `app_webview_room_2`가 별도로 생성됨 |
| 데이터 표시 | 매장명·메뉴·가격이 실제 토스에서 로딩됨. 앱 안내 문자열은 Android 리소스로 분리 |
| 원본 배치 | 관리자에서 끄면 원래 단일 열, 다시 켜면 가로 배치. 같은 화면에서 전환할 때 장바구니 수량 유지 확인 |
| 큰 글자 | 120% 및 140%에서 표시 확인, 방 번호 줄바꿈 수정 |
| 상품 상세 | 실제 상품 사진·정보 좌우 배치, 수량 버튼 56×56px, 담기 버튼 높이 72px |
| 장바구니 | 실제 상품 두 개의 2열 표시, 수량 증가·삭제 동작 확인, 주문 버튼 높이 72px |
| 작은 태블릿 | WebView 856×600px에서도 메뉴 2열·상세 좌우 배치·장바구니 2열 유지, 가로 넘침 없음 |
| 기본 태블릿 | WebView 1112×800px에서 메뉴·상세·장바구니의 가로 넘침 없음 |
| 실제 주문 | 주문하기·결제·주문 취소를 실행하지 않음. 마지막 확인용 상품 삭제 후 빈 장바구니 확인 |

관리자 인증 후 132초 동안 아무 조작 없이 대기한 뒤 PIN 입력 화면으로 자동 복귀한 것을 확인했습니다.

## 검사와 자료

```powershell
pwsh -File .\scripts\check-source.ps1
pwsh -File .\scripts\build.ps1
pwsh -File .\scripts\verify-apks.ps1
```

`captures`에는 실행 화면과 접근성 XML, 레이아웃 확인 자료가 있습니다. 배포 미리보기는 `releases/unified`에 별도로 제공합니다. PIN과 서명 자료는 배포 파일에 포함하지 않습니다.

## 실제 매장에서 남은 확인

매장의 실제 태블릿·POS에서 주문이 정확한 방으로 도착하는지, 옵션과 결제 앱 연동, 세션 만료 및 손님 교체 흐름을 확인해야 합니다. 실제 주문 전송은 이번 검증 범위에 포함하지 않았습니다.

장바구니와 그룹 세션은 토스 서버가 관리합니다. 앱은 방 변경 시 주문 취소나 장바구니 삭제 요청을 전송하지 않지만, 페이지 재접속·방 전환·서버 세션 만료 후 장바구니 유지까지 보장하지는 않습니다. 이번 방 전환 검증 뒤 재접속한 1번방에는 새 그룹의 빈 장바구니가 표시되어 이를 유지 성공으로 기록하지 않았습니다.

기존 `kr.dogdive.roomorder` 앱은 다른 서명으로 설치되어 업데이트가 거절되었습니다. 기존 데이터를 삭제하지 않고 새 릴리스 패키지 `kr.dogdive.roomorder.tablet`로 분리하여 설치·실행에 성공했습니다. 검증 후 이 작업에서 설치한 개발용 `.dev` 앱과 임시 PIN은 제거했고, 최종 서명 앱은 관리자가 PIN을 설정할 수 있는 첫 화면으로 남겨 두었습니다.

8개 방의 링크와 Activity 구성을 검사했고, 통합 앱의 실제 방 전환은 1·2번방에서 검증했습니다. 모든 방에서 실제 주문을 반복 제출한 것은 아닙니다. 토스의 화면 구조가 변경되면 가로 보정 업데이트가 필요할 수 있습니다.



