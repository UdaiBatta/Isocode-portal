Repository: [isocode-coaching_tracker](https://github.com/UdaiBatta/isocode-coaching_tracker)

Live application: `<LIVE_URL>`

# Coaching Fees — technical design document

This is the T5.5 evaluation checkpoint. The final architecture, screenshots, security review, assumption register and handover sections will be completed at T7.4. No deployment is claimed.

## Synthetic risk evaluation

The risk score follows the fixed B8.9 rules. High begins at 60, Watch at 35, and fewer than four valid attendance weeks or three valid tests produces “Not enough data.” Fee, attendance and test signals have caps of 40, 35 and 25; a single signal cannot reach High. A High result creates a counsellor call task. It cannot change payments, refunds or reminders. Optional AI wording does not choose the score or band; without a provider key, the standard summary remains available.

`backend/fees/tests/test_risk_eval.py` contains 30 fixed, developer-labelled synthetic cases: ten expected High and twenty expected not High. They cover combined signals, the 59/60 boundary, single-signal caps, settled balances, overdue-day boundaries and limited academic history.

| Synthetic result | Count |
|---|---:|
| True positives | 10 |
| False positives | 0 |
| False negatives | 0 |
| True negatives | 20 |
| High-band precision | 1.00 |
| High-band recall | 1.00 |

Precision is TP / (TP + FP); recall is TP / (TP + FN). All 30 cases agree with their authored expectations. This measures policy regression on constructed examples. It is not evidence of real dropout prediction: there are no observed dropout outcomes, independent test cohort or prospective pilot in this evaluation.

S5’s accuracy tile is a separate count of counsellor-marked calls. Its initial eight genuine outcomes out of eleven are fictional seed history, not empirical validation. Real performance needs a labelled pilot, review of missed concerns and false flags, and client approval before changing the stated weights or thresholds.
