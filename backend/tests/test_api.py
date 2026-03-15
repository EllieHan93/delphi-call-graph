"""API integration tests for the Delphi Call Graph Analyzer REST endpoints."""

from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

SAMPLES_DIR = Path(__file__).resolve().parent.parent.parent / "samples"
SAMPLE_DPR = str(SAMPLES_DIR / "SampleApp.dpr")


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------


def _do_analyze(client: TestClient, dpr_path: str = SAMPLE_DPR) -> dict:
    resp = client.post("/api/analyze", json={"dprPath": dpr_path})
    assert resp.status_code == 200, resp.text
    return resp.json()


# ---------------------------------------------------------------------------
# POST /api/analyze
# ---------------------------------------------------------------------------


class TestAnalyzeEndpoint:
    def test_analyze_success(self, client: TestClient) -> None:
        data = _do_analyze(client)
        assert data["projectName"] == "SampleApp"
        assert data["totalMethods"] >= 0
        assert "unusedRatio" in data
        # unusedRatio should be a percentage (0–100)
        assert 0.0 <= data["unusedRatio"] <= 100.0

    def test_analyze_missing_file(self, client: TestClient) -> None:
        resp = client.post("/api/analyze", json={"dprPath": "/nonexistent/path/App.dpr"})
        assert resp.status_code == 400
        assert "찾을 수 없습니다" in resp.json()["detail"]

    def test_analyze_wrong_extension(self, client: TestClient, tmp_path: Path) -> None:
        not_dpr = tmp_path / "App.pas"
        not_dpr.write_text("unit App;\nend.\n", encoding="utf-8")
        resp = client.post("/api/analyze", json={"dprPath": str(not_dpr)})
        assert resp.status_code == 400
        assert ".dpr" in resp.json()["detail"]

    def test_analyze_response_camel_case(self, client: TestClient) -> None:
        data = _do_analyze(client)
        # All keys should be camelCase
        assert "projectName" in data
        assert "totalUnits" in data
        assert "totalMethods" in data
        assert "usedCount" in data
        assert "unusedCount" in data
        assert "unusedRatio" in data


# ---------------------------------------------------------------------------
# GET /api/summary
# ---------------------------------------------------------------------------


class TestSummaryEndpoint:
    def test_summary_before_analyze_returns_404(self, client: TestClient) -> None:
        resp = client.get("/api/summary")
        assert resp.status_code == 404

    def test_summary_after_analyze(self, client: TestClient) -> None:
        _do_analyze(client)
        resp = client.get("/api/summary")
        assert resp.status_code == 200
        data = resp.json()
        assert data["projectName"] == "SampleApp"
        assert isinstance(data["totalMethods"], int)

    def test_summary_unused_ratio_is_percentage(self, client: TestClient) -> None:
        _do_analyze(client)
        data = client.get("/api/summary").json()
        assert 0.0 <= data["unusedRatio"] <= 100.0


# ---------------------------------------------------------------------------
# GET /api/methods
# ---------------------------------------------------------------------------


class TestMethodsEndpoint:
    def test_methods_before_analyze_returns_404(self, client: TestClient) -> None:
        resp = client.get("/api/methods")
        assert resp.status_code == 404

    def test_methods_default_list(self, client: TestClient) -> None:
        _do_analyze(client)
        resp = client.get("/api/methods")
        assert resp.status_code == 200
        data = resp.json()
        assert "total" in data
        assert "items" in data
        assert isinstance(data["items"], list)

    def test_methods_pagination(self, client: TestClient) -> None:
        _do_analyze(client)
        resp1 = client.get("/api/methods?pageSize=2&page=1")
        assert resp1.status_code == 200
        d1 = resp1.json()
        assert len(d1["items"]) <= 2
        assert d1["page"] == 1
        assert d1["pageSize"] == 2

    def test_methods_unit_filter(self, client: TestClient) -> None:
        _do_analyze(client)
        resp = client.get("/api/methods?unit=MainUnit")
        assert resp.status_code == 200
        data = resp.json()
        for item in data["items"]:
            assert item["unitName"].lower() == "mainunit"

    def test_methods_status_filter_used(self, client: TestClient) -> None:
        _do_analyze(client)
        resp = client.get("/api/methods?status=used")
        assert resp.status_code == 200
        for item in resp.json()["items"]:
            assert item["isUsed"] is True

    def test_methods_status_filter_unused(self, client: TestClient) -> None:
        _do_analyze(client)
        resp = client.get("/api/methods?status=unused")
        assert resp.status_code == 200
        for item in resp.json()["items"]:
            assert item["isUsed"] is False

    def test_methods_search(self, client: TestClient) -> None:
        _do_analyze(client)
        resp = client.get("/api/methods?search=Create")
        assert resp.status_code == 200
        data = resp.json()
        for item in data["items"]:
            assert "create" in item["methodName"].lower()

    def test_methods_sort_by_call_count_desc(self, client: TestClient) -> None:
        _do_analyze(client)
        resp = client.get("/api/methods?sortBy=call_count&sortDir=desc&pageSize=50")
        assert resp.status_code == 200
        items = resp.json()["items"]
        if len(items) >= 2:
            assert items[0]["callCount"] >= items[-1]["callCount"]

    def test_methods_items_are_camel_case(self, client: TestClient) -> None:
        _do_analyze(client)
        items = client.get("/api/methods?pageSize=5").json()["items"]
        if items:
            assert "unitName" in items[0]
            assert "methodName" in items[0]
            assert "isUsed" in items[0]
            assert "callCount" in items[0]


# ---------------------------------------------------------------------------
# GET /api/methods/{method_id}
# ---------------------------------------------------------------------------


class TestMethodDetailEndpoint:
    def _get_first_method_id(self, client: TestClient) -> str:
        _do_analyze(client)
        items = client.get("/api/methods?pageSize=1").json()["items"]
        assert items, "No methods available in sample project"
        return items[0]["id"]

    def test_method_detail_success(self, client: TestClient) -> None:
        method_id = self._get_first_method_id(client)
        resp = client.get(f"/api/methods/{method_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == method_id
        assert "bodyText" in data
        assert "callers" in data
        assert "callees" in data

    def test_method_detail_not_found(self, client: TestClient) -> None:
        _do_analyze(client)
        resp = client.get("/api/methods/NonExistent.Class.Method")
        assert resp.status_code == 404

    def test_method_detail_before_analyze(self, client: TestClient) -> None:
        resp = client.get("/api/methods/SomeUnit.SomeClass.SomeMethod")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# GET /api/callgraph/{method_id}
# ---------------------------------------------------------------------------


class TestCallGraphEndpoint:
    def _get_first_method_id(self, client: TestClient) -> str:
        _do_analyze(client)
        items = client.get("/api/methods?pageSize=1").json()["items"]
        assert items
        return items[0]["id"]

    def test_callgraph_default_depth(self, client: TestClient) -> None:
        method_id = self._get_first_method_id(client)
        resp = client.get(f"/api/callgraph/{method_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["rootId"] == method_id
        assert data["depth"] == 2
        assert isinstance(data["nodes"], list)
        assert isinstance(data["edges"], list)
        # Root node must be present
        root_nodes = [n for n in data["nodes"] if n["isRoot"]]
        assert len(root_nodes) == 1

    def test_callgraph_custom_depth(self, client: TestClient) -> None:
        method_id = self._get_first_method_id(client)
        resp = client.get(f"/api/callgraph/{method_id}?depth=1")
        assert resp.status_code == 200
        assert resp.json()["depth"] == 1

    def test_callgraph_not_found(self, client: TestClient) -> None:
        _do_analyze(client)
        resp = client.get("/api/callgraph/NonExistent.Unit.Method")
        assert resp.status_code == 404

    def test_callgraph_before_analyze(self, client: TestClient) -> None:
        resp = client.get("/api/callgraph/SomeUnit.SomeClass.SomeMethod")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# GET /api/units
# ---------------------------------------------------------------------------


class TestUnitsEndpoint:
    def test_units_before_analyze_returns_404(self, client: TestClient) -> None:
        resp = client.get("/api/units")
        assert resp.status_code == 404

    def test_units_structure(self, client: TestClient) -> None:
        _do_analyze(client)
        resp = client.get("/api/units")
        assert resp.status_code == 200
        data = resp.json()
        assert "total" in data
        assert "units" in data
        assert data["total"] == len(data["units"])

    def test_units_stats_validity(self, client: TestClient) -> None:
        _do_analyze(client)
        units = client.get("/api/units").json()["units"]
        for u in units:
            assert u["totalMethods"] == u["usedMethods"] + u["unusedMethods"]
            assert 0.0 <= u["usageRate"] <= 100.0

    def test_units_camel_case(self, client: TestClient) -> None:
        _do_analyze(client)
        units = client.get("/api/units").json()["units"]
        if units:
            assert "unitName" in units[0]
            assert "totalMethods" in units[0]
            assert "usedMethods" in units[0]
            assert "unusedMethods" in units[0]
            assert "usageRate" in units[0]


# ---------------------------------------------------------------------------
# Full integration flow
# ---------------------------------------------------------------------------


class TestIntegrationFlow:
    def test_full_flow(self, client: TestClient) -> None:
        # 1. Analyze
        summary = client.post("/api/analyze", json={"dprPath": SAMPLE_DPR}).json()
        assert summary["projectName"] == "SampleApp"

        # 2. GET summary
        s2 = client.get("/api/summary").json()
        assert s2["projectName"] == summary["projectName"]
        assert s2["totalMethods"] == summary["totalMethods"]

        # 3. GET methods
        methods_resp = client.get("/api/methods?pageSize=100")
        assert methods_resp.status_code == 200
        items = methods_resp.json()["items"]
        assert len(items) > 0

        # 4. GET method detail
        first_id = items[0]["id"]
        detail = client.get(f"/api/methods/{first_id}").json()
        assert detail["id"] == first_id
        assert "bodyText" in detail

        # 5. GET callgraph
        cg = client.get(f"/api/callgraph/{first_id}?depth=2").json()
        assert cg["rootId"] == first_id
        root_nodes = [n for n in cg["nodes"] if n["isRoot"]]
        assert len(root_nodes) == 1

        # 6. GET units
        units_resp = client.get("/api/units")
        assert units_resp.status_code == 200
        units = units_resp.json()["units"]
        assert len(units) > 0

        # Summary totals consistent with unit aggregation
        total_from_units = sum(u["totalMethods"] for u in units)
        assert total_from_units == summary["totalMethods"]
