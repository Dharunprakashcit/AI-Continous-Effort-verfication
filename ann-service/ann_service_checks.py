"""
Checks the running ANN service over HTTP and measures request latency. Also
runs a small ablation using the live backend's stored predictions: what would
the decision have been without the ANN term in the fused score?

Needs the ANN service (5001) and, for the ablation, the backend (5000).
Writes report/ann/ann_service_checks.json.

Run: python ann_service_checks.py
"""
import json
import os
import statistics
import time
import urllib.error
import urllib.request

ANN = "http://127.0.0.1:5001"
API = "http://127.0.0.1:5000/api"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "report", "ann"))
LOG = os.path.join(HERE, "predictions_log.jsonl")
os.makedirs(OUT, exist_ok=True)

FEATURES = ["tasks_completed_pct", "doc_edits", "messages_sent", "commits", "deadline_adherence_pct", "active_days_last7"]
LOW = {"tasks_completed_pct": 10, "doc_edits": 1, "messages_sent": 0, "commits": 0, "deadline_adherence_pct": 20, "active_days_last7": 1}
HIGH = {"tasks_completed_pct": 90, "doc_edits": 30, "messages_sent": 20, "commits": 12, "deadline_adherence_pct": 95, "active_days_last7": 7}


def call(method, url, body=None, token=None, raw=None):
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            text = r.read().decode()
            return r.status, (json.loads(text) if text else None)
    except urllib.error.HTTPError as e:
        text = e.read().decode()
        try:
            return e.code, json.loads(text)
        except ValueError:
            return e.code, text[:120]


def log_lines():
    return sum(1 for _ in open(LOG)) if os.path.exists(LOG) else 0


results = []


def check(cid, name, expected, fn):
    try:
        ok, actual = fn()
    except Exception as exc:  # noqa: BLE001
        ok, actual = False, f"Error: {exc}"
    results.append({"id": cid, "case": name, "expected": expected, "actual": str(actual), "status": "Pass" if ok else "Fail"})


def main():
    check("S1", "Health endpoint", "200, model_loaded true", lambda: (lambda r: (r[0] == 200 and r[1]["model_loaded"] is True, f"{r[0]}, {r[1]}"))(call("GET", f"{ANN}/health")))

    def valid():
        s, j = call("POST", f"{ANN}/predict", {**LOW, "log": False})
        keys = sorted(j.keys())
        return s == 200 and 0 <= j["risk_probability"] <= 1 and keys == ["features_used", "model_version", "risk_percent", "risk_probability"], f"{s}, keys {keys}"

    check("S2", "Valid request returns probability and metadata", "200, p in [0,1], four keys", valid)

    def missing():
        s, j = call("POST", f"{ANN}/predict", {"doc_edits": 1})
        return s == 400 and "expected" in j, f"{s}, error mentions expected features: {'expected' in j}"

    check("S3", "Missing features", "400 with the list of expected features", missing)

    def nonnum():
        s, j = call("POST", f"{ANN}/predict", {**LOW, "commits": "many"})
        return s == 400, s

    check("S4", "Non-numeric value", "400", nonnum)

    def emptyish():
        s, j = call("POST", f"{ANN}/predict", raw=b"")
        return s in (400, 415, 500), s

    check("S5", "Empty request body", "Rejected (4xx or 5xx), not a prediction", emptyish)

    def extreme():
        a = call("POST", f"{ANN}/predict", {**LOW, "tasks_completed_pct": -500, "commits": 1e9, "log": False})
        b = call("POST", f"{ANN}/predict", {**HIGH, "tasks_completed_pct": 1e6, "log": False})
        return a[0] == 200 and b[0] == 200, f"out-of-range inputs accepted: {a[0]} p={a[1]['risk_probability']}, {b[0]} p={b[1]['risk_probability']}"

    check("S6", "Out-of-range values", "Documented behaviour (no range validation)", extreme)

    def determinism():
        vals = {call("POST", f"{ANN}/predict", {**LOW, "log": False})[1]["risk_probability"] for _ in range(5)}
        return len(vals) == 1, f"{len(vals)} distinct value over 5 calls: {sorted(vals)}"

    check("S7", "Determinism", "Same input gives the same output", determinism)

    def monotonic():
        ps = []
        for t in (0, 25, 50, 75, 100):
            ps.append(call("POST", f"{ANN}/predict", {**LOW, "tasks_completed_pct": t, "log": False})[1]["risk_probability"])
        return all(a >= b - 1e-9 for a, b in zip(ps, ps[1:])), ps

    check("S8", "Risk falls as task completion rises", "Non-increasing", monotonic)

    def ordering():
        lo = call("POST", f"{ANN}/predict", {**LOW, "log": False})[1]["risk_probability"]
        hi = call("POST", f"{ANN}/predict", {**HIGH, "log": False})[1]["risk_probability"]
        return lo > hi, f"low-activity {lo}, high-activity {hi}"

    check("S9", "Low activity scores riskier than high activity", "p(low) > p(high)", ordering)

    def logging_flag():
        b = log_lines()
        call("POST", f"{ANN}/predict", {**LOW, "log": False})
        mid = log_lines()
        call("POST", f"{ANN}/predict", dict(LOW))
        a = log_lines()
        return mid == b and a == mid + 1, f"lines {b} to {mid} (log false), then {a} (default)"

    check("S10", "Drift log writes only when logging is on", "+0 with log false, +1 by default", logging_flag)

    def info():
        s, j = call("GET", f"{ANN}/model/info")
        return s == 200 and len(j["comparison"]) == 5 and j["ann_metrics"]["n_test"] == 800, f"{s}, {len(j['comparison'])} models, n_test {j['ann_metrics']['n_test']}"

    check("S11", "Model info", "200, five models, n_test 800", info)

    def drift():
        s, j = call("GET", f"{ANN}/model/drift")
        return s == 200 and j["status"] in ("stable", "drift_detected", "insufficient_data"), f"{s}, status {j['status']}, samples {j['live_samples']}"

    check("S12", "Drift endpoint", "200 with a valid status", drift)

    # HTTP latency (sequential requests on localhost)
    samples = []
    call("POST", f"{ANN}/predict", {**LOW, "log": False})
    for _ in range(100):
        t = time.perf_counter()
        call("POST", f"{ANN}/predict", {**LOW, "log": False})
        samples.append((time.perf_counter() - t) * 1000)
    srt = sorted(samples)
    latency = {"requests": len(samples), "median_ms": statistics.median(samples), "p95_ms": srt[int(0.95 * len(srt)) - 1], "max_ms": srt[-1]}

    # Ablation using stored predictions from the live backend
    ablation = None
    try:
        s, j = call("POST", f"{API}/auth/login", {"email": "faculty@example.edu", "password": "password123"})
        tok = j["token"]
        rows = []
        for t in call("GET", f"{API}/faculty/teams", token=tok)[1]:
            ov = call("GET", f"{API}/faculty/teams/{t['_id']}/overview", token=tok)[1]
            for r in ov["rows"]:
                p = call("GET", f"{API}/faculty/students/{r['student']['id']}/detail", token=tok)[1]["latest"]
                if not p:
                    continue
                without = round((0.30 * p["editScore"] + 0.35 * p["taskScore"] + 0.15 * p["communicationScore"]) / 0.80)
                level = lambda risk: "LOW" if risk < 30 else ("MEDIUM" if risk <= 70 else "HIGH")  # noqa: E731
                rows.append({
                    "student": r["student"]["name"],
                    "ann_probability": p["annRiskProbability"],
                    "contribution_with_ann": p["contributionScore"],
                    "contribution_without_ann": without,
                    "level_with": p["riskLevel"],
                    "level_without": level(100 - without),
                    "ann_source_in_reasons": any("(ann)" in e for e in p["explanations"]),
                })
        ablation = {
            "rows": rows,
            "changed_level": sum(1 for r in rows if r["level_with"] != r["level_without"]),
            "max_abs_shift_points": max(abs(r["contribution_with_ann"] - r["contribution_without_ann"]) for r in rows),
            "mean_abs_shift_points": statistics.mean(abs(r["contribution_with_ann"] - r["contribution_without_ann"]) for r in rows),
        }
    except Exception as exc:  # noqa: BLE001
        ablation = {"error": str(exc)}

    passed = sum(1 for r in results if r["status"] == "Pass")
    out = {"ran_at": time.strftime("%Y-%m-%d %H:%M:%S"), "summary": {"total": len(results), "passed": passed}, "results": results, "latency_http": latency, "ablation": ablation}
    json.dump(out, open(os.path.join(OUT, "ann_service_checks.json"), "w"), indent=2)
    for r in results:
        print(r["status"].upper(), r["id"], r["case"], "|", r["actual"])
    print(f"{passed}/{len(results)} passed")
    print(json.dumps(latency))
    print(json.dumps({k: v for k, v in (ablation or {}).items() if k != "rows"}))


if __name__ == "__main__":
    main()
