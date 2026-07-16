# PlanListScreen

## 개요

내 여행 목록 화면. 여행 일정 탭 / 달력 탭 전환.

## Variants

| Variant | 설명 |
|---|---|
| Light / 일정 탭 | 라이트, 여행 목록 |
| Light / 달력 탭 | 라이트, 월간 달력 (여행 일정 표시) |
| Dark / 일정 탭 | 다크, 여행 목록 |
| Dark / 달력 탭 | 다크, 월간 달력 (여행 일정 표시) |

## 구성 컴포넌트

- `TravelListTabBar` — 여행목록 헤더 + 일정/달력 탭 전환
- **일정 탭:** `TravelPlanCard` × N (map 렌더링)
- **달력 탭:** `Calendar` (재사용 컴포넌트, `components/ui/Calendar.tsx`) — 월간 뷰 + 일정 이벤트 바
- `BottomNavigation` — 여행목록 탭 활성

## 레이아웃 (일정 탭)

```
┌──────────────────────────┐
│     TravelListTabBar     │ ← 여행목록 타이틀 + 탭 전환
├──────────────────────────┤
│      TravelPlanCard      │
│      TravelPlanCard      │ ← 스크롤 (plans.map)
│      TravelPlanCard      │
├──────────────────────────┤
│     BottomNavigation     │
└──────────────────────────┘
```

## 레이아웃 (달력 탭)

```
┌──────────────────────────┐
│     TravelListTabBar     │
├──────────────────────────┤
│                           │
│         Calendar          │ ← 월 이동 헤더 + 요일 + 날짜 그리드
│   (일정 구간 이벤트 바)    │    이벤트 바: 여행 일정의 시작~종료일에
│                           │    걸쳐 얇은 바 + 목적지 텍스트 표시
├──────────────────────────┤
│     BottomNavigation     │
└──────────────────────────┘
```

## 동작

- `TravelPlanCard` 탭 → PlanDetailScreen 진입
- `Calendar` 월 이동 버튼 탭 → 이전/다음 달로 이동
- 일정 이벤트 바는 표시 전용 (탭 인터랙션 없음)

## 스타일

| 속성 | Light | Dark |
|---|---|---|
| 배경 | `Light/Page Background` | `Dark/Page Background` |

## 이미지

### My Travel Plan List Screen Plan Dark/Light
![My Travel Plan List Screen Plan Dark](MyTravelPlanListScreen-Plan-Dark.svg)
![My Travel Plan List Screen Plan Light](MyTravelPlanListScreen-Plan-Light.svg)

### 달력 탭 (구) — 예약 탭 스크린샷, 참고용
달력 탭 전용 디자인 스크린샷은 아직 없습니다. 아래 이미지는 이전 "예약 탭" UI로, 현재는 `Calendar` 컴포넌트로 교체되어 더 이상 실제 화면과 일치하지 않습니다.
![My Travel Plan List Screen Reservation Dark](MyTravelPlanListScreen-Reservation-Dark.svg)
![My Travel Plan List Screen Reservation Light](MyTravelPlanListScreen-Reservation-Light.svg)
