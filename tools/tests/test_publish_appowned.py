import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import publish  # noqa: E402


def test_app_owned_assets_are_not_required(tmp_path):
    (tmp_path / "globe").mkdir()
    (tmp_path / "globe" / "index.html").write_text("app globe")
    urls = ["/globe/", "/globe/assets/admin/ITA.json"]
    assert "globe" in publish.APP_OWNED
    assert publish.missing_urls(tmp_path, urls) == []


def test_app_owned_route_page_is_still_required(tmp_path):
    assert publish.missing_urls(tmp_path, ["/globe/"]) == ["/globe/"]


def test_other_routes_assets_still_required(tmp_path):
    assert publish.missing_urls(tmp_path, ["/dolomites-july-2027/assets/route.gpx"]) == ["/dolomites-july-2027/assets/route.gpx"]
