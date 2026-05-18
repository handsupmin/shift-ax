# 객관 평가 프레임워크

Shift AX는 “좋다”는 정성 주장보다 측정 가능한 전달 증거로 설명되어야 한다. objective eval suite는 request-to-commit 동작이 안전하고, 완결되어 있고, 토큰 효율적인지 숫자로 검증한다.

## 측정 항목

| 범주 | 예시 지표 | 의미 |
|---|---|---|
| Context | recall@3, MRR, false positive rate | 온보딩 컨텍스트가 정확히 검색되는지 검증한다. |
| Planning | ambiguity classification, ready/vague score | 모호한 요청에서 구현이 시작되지 않는지 검증한다. |
| Tokens | bundle budget compliance, estimated tokens, reduction percent | 컨텍스트 주입이 예산 안에 있고 최적화되는지 검증한다. |
| Harness | FSM rejection, idempotency, retry recovery, DAG order | LLM 호출이 결정적 레일 안에서만 실행되는지 검증한다. |
| Review | allow/block accuracy, required lane coverage, test adequacy blocking | 스펙/테스트/게이트가 부족하면 커밋이 막히는지 검증한다. |
| Artifacts | request-to-plan artifact completeness, plan-review pause | 중요한 상태가 숨겨진 대화가 아니라 파일 artifact로 남는지 검증한다. |

## 명령

```bash
shift-ax eval --output .shift-ax/evals/latest
shift-ax eval --json
npm run eval:objective
npm run eval:all
```

`shift-ax eval`은 아래 파일을 쓴다.

- `objective-eval-report.json`
- `objective-eval-report.md`

어떤 지표든 threshold를 못 넘으면 exit code 1로 실패하므로 CI나 release gate로 사용할 수 있다.

## 현재 기준선

현재 deterministic fixture 기준선은 다음과 같다.

- context recall@3 100%, MRR 1.000
- adversarial false positive rate 0%
- planning readiness classification 100%
- 1200 char bundle budget에서 context-token reduction 89%
- FSM, idempotency, retry recovery, DAG order harness checks 100%
- missing-test blocking을 포함한 review allow/block accuracy 100%
- request-to-plan artifact completeness 100%
