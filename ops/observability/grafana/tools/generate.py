#!/usr/bin/env python3
"""Generates the Grafana dashboards, the unified-alerting provisioning and the branding assets.

The JSON/YAML/SVG/PNG outputs are committed; this script is the source of truth so that all
dashboards share the same style (units, thresholds, descriptions, variables, links).

    python3 ops/observability/grafana/tools/generate.py          # rewrite every generated file
    python3 ops/observability/grafana/tools/generate.py --check  # fail if a file would change

Standard library only.
"""

from __future__ import annotations

import json
import math
import struct
import sys
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DASH = ROOT / "dashboards"
ALERTING = ROOT / "provisioning" / "alerting"
BRANDING = ROOT / "branding"

SCHEMA_VERSION = 41
PROM = {"type": "prometheus", "uid": "${datasource}"}
LOKI = {"type": "loki", "uid": "${ds_loki}"}
TEMPO = {"type": "tempo", "uid": "${ds_tempo}"}
GRAFANA_DS = {"type": "grafana", "uid": "-- Grafana --"}

# One palette for every dashboard.
C_OK, C_WARN, C_BAD, C_INFO, C_ALT, C_MUTED = "green", "orange", "red", "blue", "purple", "text"
STATUS_COLORS = {"2xx": "green", "3xx": "blue", "4xx": "orange", "5xx": "red"}
LEVEL_COLORS = {
    "trace": "purple", "debug": "blue", "info": "green", "warn": "orange",
    "error": "red", "fatal": "dark-red", "unknown": "text",
}

OUTPUTS: dict[Path, bytes] = {}


# --------------------------------------------------------------------------- helpers

def ref(i: int) -> str:
    return chr(ord("A") + i)


def thresholds(steps: list[tuple[float | None, str]]) -> dict:
    return {
        "mode": "absolute",
        "steps": [{"color": c, "value": v} for v, c in steps],
    }


def target(expr: str, legend: str = "__auto", i: int = 0, **extra) -> dict:
    t = {
        "datasource": PROM,
        "editorMode": "code",
        "expr": expr,
        "legendFormat": legend,
        "range": True,
        "refId": ref(i),
    }
    t.update(extra)
    return t


def instant(expr: str, legend: str = "__auto", i: int = 0, **extra) -> dict:
    return target(expr, legend, i, instant=True, range=False, **extra)


def loki_target(expr: str, i: int = 0, legend: str = "__auto", **extra) -> dict:
    t = {
        "datasource": LOKI,
        "editorMode": "code",
        "expr": expr,
        "legendFormat": legend,
        "queryType": "range",
        "refId": ref(i),
    }
    t.update(extra)
    return t


class Board:
    """Lays panels out on the 24 column grid, optionally inside collapsible rows."""

    def __init__(self) -> None:
        self.panels: list[dict] = []
        self.x = self.y = self.rowh = 0
        self.next_id = 1
        self.row_panel: dict | None = None

    def _newline(self) -> None:
        if self.x:
            self.y += self.rowh
            self.x = self.rowh = 0

    def row(self, title: str, collapsed: bool = True) -> None:
        self._newline()
        if self.row_panel is not None and self.row_panel["collapsed"]:
            self.y = self.row_panel["gridPos"]["y"] + 1
        row = {
            "collapsed": collapsed,
            "gridPos": {"h": 1, "w": 24, "x": 0, "y": self.y},
            "id": self.next_id,
            "panels": [],
            "title": title,
            "type": "row",
        }
        self.next_id += 1
        self.panels.append(row)
        self.row_panel = row
        self.y += 1

    def add(self, panel: dict, w: int, h: int) -> dict:
        if self.x + w > 24:
            self._newline()
        panel["id"] = self.next_id
        self.next_id += 1
        panel["gridPos"] = {"h": h, "w": w, "x": self.x, "y": self.y}
        self.x += w
        self.rowh = max(self.rowh, h)
        if self.row_panel is not None and self.row_panel["collapsed"]:
            self.row_panel["panels"].append(panel)
        else:
            self.panels.append(panel)
        return panel

    def finish(self) -> list[dict]:
        self._newline()
        return self.panels


def base(kind: str, title: str, desc: str, ds: dict | None, targets: list[dict]) -> dict:
    assert desc, f"panel {title!r} needs a description"
    p = {"title": title, "description": desc, "type": kind, "targets": targets}
    if ds is not None:
        p["datasource"] = ds
    return p


def stat(title, desc, expr, unit="short", steps=None, decimals=None, spark=True, mappings=None,
         color_mode="value", reduce="lastNotNull", min_=None, max_=None, links=None, ds=PROM):
    p = base("stat", title, desc, ds, [instant(expr) if not spark else target(expr)])
    p["fieldConfig"] = {
        "defaults": {
            "color": {"mode": "thresholds"},
            "mappings": mappings or [],
            "thresholds": thresholds(steps or [(None, C_INFO)]),
            "unit": unit,
        },
        "overrides": [],
    }
    d = p["fieldConfig"]["defaults"]
    if decimals is not None:
        d["decimals"] = decimals
    if min_ is not None:
        d["min"] = min_
    if max_ is not None:
        d["max"] = max_
    if links:
        d["links"] = links
    p["options"] = {
        "colorMode": color_mode,
        "graphMode": "area" if spark else "none",
        "justifyMode": "auto",
        "orientation": "auto",
        "reduceOptions": {"calcs": [reduce], "fields": "", "values": False},
        "textMode": "auto",
        "wideLayout": True,
    }
    return p


def series(title, desc, targets, unit="short", kind="line", stack=False, ds=PROM, overrides=None,
           legend="list", fill=10, min_=None, max_=None, steps=None, decimals=None, soft_max=None,
           links=None):
    p = base("timeseries", title, desc, ds, targets)
    custom = {
        "axisBorderShow": False,
        "axisCenteredZero": False,
        "axisColorMode": "text",
        "axisLabel": "",
        "axisPlacement": "auto",
        "barAlignment": 0,
        "drawStyle": "bars" if kind == "bars" else "line",
        "fillOpacity": 60 if kind == "bars" else fill,
        "gradientMode": "none",
        "hideFrom": {"legend": False, "tooltip": False, "viz": False},
        "insertNulls": False,
        "lineInterpolation": "linear",
        "lineWidth": 1,
        "pointSize": 4,
        "scaleDistribution": {"type": "linear"},
        "showPoints": "never",
        "spanNulls": False,
        "stacking": {"group": "A", "mode": "normal" if stack else "none"},
        "thresholdsStyle": {"mode": "off"},
    }
    d = {
        "color": {"mode": "palette-classic"},
        "custom": custom,
        "mappings": [],
        "thresholds": thresholds(steps or [(None, C_OK)]),
        "unit": unit,
    }
    if min_ is not None:
        d["min"] = min_
    if max_ is not None:
        d["max"] = max_
    if soft_max is not None:
        d["custom"]["axisSoftMax"] = soft_max
    if decimals is not None:
        d["decimals"] = decimals
    if links:
        d["links"] = links
    p["fieldConfig"] = {"defaults": d, "overrides": overrides or []}
    p["options"] = {
        "legend": {
            "calcs": ["lastNotNull", "max"] if legend == "table" else [],
            "displayMode": "table" if legend == "table" else "list",
            "placement": "bottom",
            "showLegend": legend != "hidden",
        },
        "tooltip": {"hideZeros": False, "mode": "multi", "sort": "desc"},
    }
    return p


def color_override(name: str, color: str, regex: bool = False) -> dict:
    return {
        "matcher": {"id": "byRegexp" if regex else "byName", "options": name},
        "properties": [{"id": "color", "value": {"fixedColor": color, "mode": "fixed"}}],
    }


def status_overrides() -> list[dict]:
    return [color_override(k, v) for k, v in STATUS_COLORS.items()]


def bargauge(title, desc, targets, unit="short", steps=None, ds=PROM, orientation="horizontal"):
    p = base("bargauge", title, desc, ds, targets)
    p["fieldConfig"] = {
        "defaults": {
            "color": {"mode": "palette-classic"},
            "mappings": [],
            "thresholds": thresholds(steps or [(None, C_INFO)]),
            "unit": unit,
        },
        "overrides": [],
    }
    p["options"] = {
        "displayMode": "gradient",
        "minVizHeight": 16,
        "minVizWidth": 8,
        "namePlacement": "auto",
        "orientation": orientation,
        "reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False},
        "showUnfilled": True,
        "sizing": "auto",
        "valueMode": "color",
    }
    return p


def pie(title, desc, targets, unit="short", overrides=None, ds=PROM):
    p = base("piechart", title, desc, ds, targets)
    p["fieldConfig"] = {
        "defaults": {"color": {"mode": "palette-classic"}, "mappings": [], "unit": unit,
                     "custom": {"hideFrom": {"legend": False, "tooltip": False, "viz": False}}},
        "overrides": overrides or [],
    }
    p["options"] = {
        "displayLabels": ["percent"],
        "legend": {"displayMode": "table", "placement": "right", "showLegend": True,
                   "values": ["value"]},
        "pieType": "donut",
        "reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False},
        "tooltip": {"hideZeros": False, "mode": "single", "sort": "none"},
    }
    return p


def table(title, desc, targets, transformations, overrides=None, sort=None, ds=PROM, unit="short"):
    p = base("table", title, desc, ds, targets)
    p["fieldConfig"] = {
        "defaults": {
            "color": {"mode": "thresholds"},
            "custom": {"align": "auto", "cellOptions": {"type": "auto"}, "filterable": True,
                       "inspect": False},
            "mappings": [],
            "thresholds": thresholds([(None, C_OK)]),
            "unit": unit,
        },
        "overrides": overrides or [],
    }
    p["options"] = {"cellHeight": "sm", "footer": {"show": False, "reducer": ["sum"], "fields": ""},
                    "showHeader": True}
    if sort:
        p["options"]["sortBy"] = [{"desc": True, "displayName": sort}]
    p["transformations"] = transformations
    return p


def column(name: str, unit: str | None = None, width: int | None = None, steps=None,
           cell: str | None = None, decimals: int | None = None) -> dict:
    props = []
    if unit:
        props.append({"id": "unit", "value": unit})
    if width:
        props.append({"id": "custom.width", "value": width})
    if decimals is not None:
        props.append({"id": "decimals", "value": decimals})
    if steps:
        props.append({"id": "thresholds", "value": thresholds(steps)})
        props.append({"id": "color", "value": {"mode": "thresholds"}})
    if cell:
        props.append({"id": "custom.cellOptions", "value": {"type": cell}})
    return {"matcher": {"id": "byName", "options": name}, "properties": props}


def heatmap(title, desc, targets, unit="s", ds=PROM):
    p = base("heatmap", title, desc, ds, targets)
    p["fieldConfig"] = {
        "defaults": {"custom": {"hideFrom": {"legend": False, "tooltip": False, "viz": False},
                                "scaleDistribution": {"type": "linear"}}},
        "overrides": [],
    }
    p["options"] = {
        "calculate": False,
        "cellGap": 1,
        "color": {"exponent": 0.5, "fill": "dark-orange", "mode": "scheme", "reverse": False,
                  "scale": "exponential", "scheme": "Oranges", "steps": 64},
        "exemplars": {"color": "rgba(255,0,255,0.7)"},
        "filterValues": {"le": 1e-9},
        "legend": {"show": True},
        "rowsFrame": {"layout": "auto"},
        "tooltip": {"mode": "single", "showColorScale": False, "yHistogram": True},
        "yAxis": {"axisPlacement": "left", "reverse": False, "unit": unit},
    }
    return p


def text(title, desc, content) -> dict:
    p = base("text", title, desc, None, [])
    p.pop("targets")
    p["options"] = {"code": {"language": "plaintext", "showLineNumbers": False,
                             "showMiniMap": False},
                    "content": content, "mode": "markdown"}
    p["transparent"] = True
    return p


def logs_panel(title, desc, expr, ds=LOKI) -> dict:
    p = base("logs", title, desc, ds, [loki_target(expr, queryType="range", maxLines=500)])
    p["options"] = {
        "dedupStrategy": "none",
        "enableInfiniteScrolling": False,
        "enableLogDetails": True,
        "prettifyLogMessage": False,
        "showCommonLabels": False,
        "showLabels": False,
        "showTime": True,
        "sortOrder": "Descending",
        "wrapLogMessage": True,
    }
    return p


# --------------------------------------------------------------------------- dashboards

def ds_var(name: str, label: str, plugin: str, uid: str, title: str) -> dict:
    return {
        "current": {"text": title, "value": uid},
        "hide": 0,
        "includeAll": False,
        "label": label,
        "multi": False,
        "name": name,
        "options": [],
        "query": plugin,
        "queryValue": "",
        "refresh": 1,
        "regex": f"/^{title}$/",
        "skipUrlSync": False,
        "type": "datasource",
    }


def query_var(name: str, label: str, query: str, multi=True, include_all=True, regex="",
              default: str | None = None) -> dict:
    cur = {"text": ["All"], "value": ["$__all"]} if include_all else {}
    if default:
        cur = {"text": default, "value": default}
    return {
        "allValue": ".*" if include_all else None,
        "current": cur,
        "datasource": PROM,
        "definition": query,
        "hide": 0,
        "includeAll": include_all,
        "label": label,
        "multi": multi,
        "name": name,
        "options": [],
        "query": {"qryType": 1, "query": query, "refId": f"var-{name}"},
        "refresh": 2,
        "regex": regex,
        "skipUrlSync": False,
        "sort": 1,
        "type": "query",
    }


def textbox(name: str, label: str, default: str = "") -> dict:
    return {
        "current": {"text": default, "value": default},
        "hide": 0,
        "label": label,
        "name": name,
        "options": [{"selected": True, "text": default, "value": default}],
        "query": default,
        "skipUrlSync": False,
        "type": "textbox",
    }


def custom_var(name: str, label: str, values: list[str]) -> dict:
    return {
        "allValue": ".*",
        "current": {"text": ["All"], "value": ["$__all"]},
        "hide": 0,
        "includeAll": True,
        "label": label,
        "multi": True,
        "name": name,
        "options": [],
        "query": ",".join(values),
        "skipUrlSync": False,
        "type": "custom",
    }


PROM_VAR = ds_var("datasource", "Metrics", "prometheus", "prometheus", "Prometheus")
LOKI_VAR = ds_var("ds_loki", "Logs", "loki", "loki", "Loki")
TEMPO_VAR = ds_var("ds_tempo", "Traces", "tempo", "tempo", "Tempo")

NAV = [
    ("tm-overview", "Overview"), ("tm-api-red", "API RED"), ("tm-business", "Business"),
    ("tm-traces", "Traces"), ("tm-logs", "Logs"), ("tm-postgres", "PostgreSQL"),
    ("tm-runtime", "Runtime"),
]


def nav_text(current: str) -> dict:
    links = " | ".join(
        f"**{name}**" if uid == current else f"[{name}](/d/{uid})" for uid, name in NAV
    )
    return text(
        "Navigation",
        "Links to the other Time Manager dashboards. The alert rules live under Alerting > Alert rules.",
        f"{links} | [Alerts](/alerting/list)",
    )


def dashboard(uid: str, title: str, desc: str, tags: list[str], board: Board,
              variables: list[dict], time_from: str = "now-6h") -> dict:
    return {
        "annotations": {"list": [{
            "builtIn": 1, "datasource": GRAFANA_DS, "enable": True, "hide": True,
            "iconColor": "rgba(0, 211, 255, 1)", "name": "Annotations & Alerts",
            "type": "dashboard"}]},
        "description": desc,
        "editable": True,
        "fiscalYearStartMonth": 0,
        "graphTooltip": 1,
        "id": None,
        "links": [{
            "asDropdown": True, "icon": "external link", "includeVars": True, "keepTime": True,
            "tags": ["time-manager"], "targetBlank": False, "title": "Time Manager dashboards",
            "type": "dashboards"}],
        "panels": board.finish(),
        "refresh": "30s",
        "schemaVersion": SCHEMA_VERSION,
        "tags": tags,
        "templating": {"list": variables},
        "time": {"from": time_from, "to": "now"},
        "timepicker": {"refresh_intervals": ["10s", "30s", "1m", "5m", "15m", "1h"]},
        "timezone": "browser",
        "title": title,
        "uid": uid,
        "version": 1,
        "weekStart": "",
    }


API = 'job="api"'
HTTP_COUNT = "http_request_duration_seconds_count"
HTTP_BUCKET = "http_request_duration_seconds_bucket"
LAT_STEPS = [(None, C_OK), (0.5, C_WARN), (1, C_BAD)]
ERR_STEPS = [(None, C_OK), (0.01, C_WARN), (0.02, C_BAD)]
CLOCK_IN = 'tm_events_total{code=~"clock[.](in|clocked_in)"}'
CLOCK_OUT = 'tm_events_total{code=~"clock[.](out|clocked_out)"}'
LOGIN_OK = 'tm_events_total{code=~"auth[.](logged_in|login)"}'
LOGIN_KO = 'tm_errors_total{code=~"AUTH_INVALID_CREDENTIALS|auth[._]invalid.*"}'
AUTH_ERR = 'tm_errors_total{code=~"(?i)auth[._].*"}'
USER_CREATED = 'tm_events_total{code=~"user[.]created"}'
TEAM_CREATED = 'tm_events_total{code=~"team[.]created"}'
REPORTS = 'tm_events_total{code=~"report[.].*generated"}'


def rate_by(metric: str, by: str, extra: str = "") -> str:
    return f"sum by ({by}) (rate({metric}{{{API}{extra}}}[$__rate_interval]))"


def overview() -> dict:
    b = Board()
    b.add(nav_text("tm-overview"), 24, 2)
    total = f"sum(rate({HTTP_COUNT}{{{API}}}[$__range]))"
    errs = f'sum(rate({HTTP_COUNT}{{{API},status_code=~"5.."}}[$__range]))'
    b.add(stat("Availability", "Share of requests that did not end in a 5xx over the selected range. SLO target 99.5%.",
               f"1 - ({errs} or vector(0)) / {total}", "percentunit",
               [(None, C_BAD), (0.99, C_WARN), (0.995, C_OK)], decimals=3, spark=False, min_=0, max_=1), 4, 4)
    b.add(stat("p95 latency", "95th percentile of API request duration over the selected range. Threshold: warn 500 ms, critical 1 s.",
               f"histogram_quantile(0.95, sum by (le) (rate({HTTP_BUCKET}{{{API}}}[$__range])))", "s",
               LAT_STEPS, decimals=3, spark=False), 4, 4)
    b.add(stat("Error ratio (5xx)", "Share of 5xx responses over the selected range. Alert fires above 2% for 5 minutes.",
               f"({errs} or vector(0)) / {total}", "percentunit", ERR_STEPS, decimals=2, spark=False), 4, 4)
    b.add(stat("Requests / s", "Average API throughput over the selected range.",
               f"sum(rate({HTTP_COUNT}{{{API}}}[$__rate_interval]))", "reqps",
               [(None, C_INFO)], decimals=2), 4, 4)
    b.add(stat("API up", "Whether Alloy can scrape the API /metrics endpoint right now.",
               f"max(up{{{API}}})", "none", [(None, C_BAD), (1, C_OK)],
               mappings=[{"type": "value", "options": {"0": {"text": "DOWN"}, "1": {"text": "UP"}}}],
               spark=False, color_mode="background"), 4, 4)
    b.add(stat("Firing alerts", "Number of Prometheus alerts currently firing (critical and warning).",
               'count(ALERTS{alertstate="firing"}) or vector(0)', "short",
               [(None, C_OK), (1, C_WARN), (3, C_BAD)], spark=False, color_mode="background",
               links=[{"title": "Alert rules", "url": "/alerting/list"}]), 4, 4)

    b.row("Traffic and latency", collapsed=False)
    b.add(series("Request rate by route", "Requests per second per route template, stacked.",
                 [target(rate_by(HTTP_COUNT, "route"), "{{route}}")], "reqps", stack=True, legend="table"), 12, 8)
    b.add(heatmap("Latency heatmap (exemplars)",
                  "Distribution of request durations. Pink dots are exemplars: click one to open the matching trace in Tempo (needs OpenMetrics exemplars from the API).",
                  [target(f"sum by (le) (increase({HTTP_BUCKET}{{{API}}}[$__rate_interval]))", "{{le}}",
                          format="heatmap", exemplar=True)]), 12, 8)
    b.add(series("p95 latency by route", "95th percentile latency per route (recording rule job_route:http_request_duration_seconds:p95_5m).",
                 [target('job_route:http_request_duration_seconds:p95_5m{job="api"}', "{{route}}")], "s",
                 steps=LAT_STEPS, legend="table"), 12, 8)
    b.add(series("Server latency from traces (exemplars)",
                 "p95 of server spans generated by Tempo span metrics. Exemplars link each point to a representative trace.",
                 [target('histogram_quantile(0.95, sum by (le) (rate(traces_spanmetrics_latency_bucket{service="time-manager-api",span_kind="SPAN_KIND_SERVER"}[$__rate_interval])))',
                         "p95", exemplar=True)], "s", steps=LAT_STEPS), 12, 8)

    b.row("Errors", collapsed=True)
    b.add(bargauge("Top errors by code", "Application error codes (tm_errors_total) in the selected range, with the HTTP status.",
                   [instant("topk(10, sum by (code, status) (increase(tm_errors_total[$__range])))", "{{code}} ({{status}})")],
                   steps=[(None, C_WARN), (50, C_BAD)]), 12, 8)
    b.add(series("5xx responses by route", "Rate of server errors per route template.",
                 [target(rate_by(HTTP_COUNT, "route", ',status_code=~"5.."'), "{{route}}")], "reqps",
                 stack=True, legend="table"), 12, 8)
    b.add(series("Error ratio", "5xx share of all responses (recording rule job:http_request_errors:ratio_rate5m); threshold line at 2%.",
                 [target('job:http_request_errors:ratio_rate5m{job="api"}', "5xx ratio")], "percentunit",
                 steps=ERR_STEPS, min_=0), 24, 7)

    b.row("Business activity", collapsed=True)
    b.add(series("Business events rate", "Rate of successful business events per code (tm_events_total).",
                 [target("sum by (code) (rate(tm_events_total[$__rate_interval]))", "{{code}}")], "ops",
                 stack=True, legend="table"), 16, 8)
    b.add(stat("Net clock-ins (in - out)", "Clock-ins minus clock-outs in the selected range: positive means more people clocked in than out. Proxy for open clocks (no dedicated gauge).",
               f"sum(increase({CLOCK_IN}[$__range])) - sum(increase({CLOCK_OUT}[$__range]))", "short",
               [(None, C_INFO)], spark=False), 8, 8)

    b.row("Dependencies", collapsed=True)
    b.add(stat("Readiness probe", "Black-box probe of GET /health/ready (database reachable within 2 s).",
               'min(probe_success{job="probes",target="api-readiness"})', "none", [(None, C_BAD), (1, C_OK)],
               mappings=[{"type": "value", "options": {"0": {"text": "FAILING"}, "1": {"text": "READY"}}}],
               spark=False, color_mode="background"), 6, 4)
    b.add(stat("Web (nginx) probe", "Black-box probe of GET /healthz on the web container.",
               'min(probe_success{job="probes",target="web"})', "none", [(None, C_BAD), (1, C_OK)],
               mappings=[{"type": "value", "options": {"0": {"text": "DOWN"}, "1": {"text": "UP"}}}],
               spark=False, color_mode="background"), 6, 4)
    b.add(stat("PostgreSQL connections", "Open PostgreSQL connections as a share of max_connections.",
               "sum(pg_stat_activity_count) / max(pg_settings_max_connections)", "percentunit",
               [(None, C_OK), (0.6, C_WARN), (0.8, C_BAD)], decimals=1, min_=0, max_=1), 6, 4)
    b.add(stat("Probe latency (readiness)", "Time the readiness probe takes: a leading indicator of database slowness.",
               'probe_duration_seconds{job="probes",target="api-readiness"}', "s",
               [(None, C_OK), (0.5, C_WARN), (1.5, C_BAD)], decimals=3), 6, 4)

    b.row("Alerts", collapsed=True)
    al = base("alertlist", "Alert instances",
              "Firing and pending alerts from Grafana-managed rules and the Prometheus Alertmanager.", None, [])
    al.pop("targets")
    al["options"] = {"alertInstanceLabelFilter": "", "alertName": "", "dashboardAlerts": False,
                     "groupBy": [], "groupMode": "default", "maxItems": 20, "sortOrder": 1,
                     "stateFilter": {"error": True, "firing": True, "noData": False, "normal": False,
                                     "pending": True}, "viewMode": "list"}
    b.add(al, 24, 8)
    return dashboard("tm-overview", "Time Manager - Overview",
                     "Home dashboard: SLOs, traffic, errors and business activity of the Time Manager API.",
                     ["time-manager", "overview", "slo"], b, [PROM_VAR])


def api_red() -> dict:
    b = Board()
    flt = ',route=~"$route",method=~"$method"'
    b.add(nav_text("tm-api-red"), 24, 2)
    cnt = f"{HTTP_COUNT}{{{API}{flt}}}"
    bucket = f"{HTTP_BUCKET}{{{API}{flt}}}"
    err = f'{HTTP_COUNT}{{{API}{flt},status_code=~"5.."}}'
    b.row("RED summary", collapsed=False)
    b.add(stat("Rate", "Requests per second for the selected routes and methods.",
               f"sum(rate({cnt}[$__rate_interval]))", "reqps", decimals=2), 4, 4)
    b.add(stat("Errors (5xx)", "Share of 5xx responses for the selection.",
               f"(sum(rate({err}[$__rate_interval])) or vector(0)) / sum(rate({cnt}[$__rate_interval]))",
               "percentunit", ERR_STEPS, decimals=2), 4, 4)
    for i, (q, nm) in enumerate([(0.5, "p50"), (0.95, "p95"), (0.99, "p99")]):
        b.add(stat(f"Duration {nm}", f"{nm} request duration for the selection.",
                   f"histogram_quantile({q}, sum by (le) (rate({bucket}[$__rate_interval])))", "s",
                   LAT_STEPS, decimals=3), 4, 4)
    b.add(stat("Apdex (T=0.25s)", "Apdex score with a 250 ms satisfied threshold and 1 s tolerated (uses the 0.25 s and 1 s histogram buckets).",
               f'(sum(rate({HTTP_BUCKET}{{{API}{flt},le="0.25"}}[$__rate_interval])) + sum(rate({HTTP_BUCKET}{{{API}{flt},le="1"}}[$__rate_interval]))) / 2 / sum(rate({cnt}[$__rate_interval]))',
               "none", [(None, C_BAD), (0.8, C_WARN), (0.94, C_OK)], decimals=3, min_=0, max_=1), 4, 4)

    b.row("Traffic", collapsed=False)
    b.add(series("Request rate by route and method", "Requests per second per route template and HTTP method.",
                 [target(f"sum by (route, method) (rate({cnt}[$__rate_interval]))", "{{method}} {{route}}")],
                 "reqps", stack=True, legend="table"), 12, 8)
    b.add(series("Status codes", "Responses per second per status code; green 2xx, blue 3xx, orange 4xx, red 5xx.",
                 [target(f"sum by (status_code) (rate({cnt}[$__rate_interval]))", "{{status_code}}")],
                 "reqps", stack=True, kind="bars",
                 overrides=[color_override("/^2\\d\\d$/", "green", True), color_override("/^3\\d\\d$/", "blue", True),
                            color_override("/^4\\d\\d$/", "orange", True), color_override("/^5\\d\\d$/", "red", True)],
                 legend="table"), 12, 8)

    b.row("Errors", collapsed=False)
    b.add(series("5xx ratio by route", "Share of 5xx responses per route.",
                 [target(f'sum by (route) (rate({err}[$__rate_interval])) / sum by (route) (rate({cnt}[$__rate_interval]))',
                         "{{route}}")], "percentunit", steps=ERR_STEPS, min_=0, legend="table"), 12, 8)
    b.add(pie("Status class share", "Share of responses by status class in the selected time range.",
              [instant(f'sum(increase({HTTP_COUNT}{{{API}{flt},status_code=~"{c}.."}}[$__range]))', f"{c}xx", i)
               for i, c in enumerate("2345")],
              overrides=status_overrides()), 12, 8)

    b.row("Latency", collapsed=False)
    b.add(series("Latency percentiles (with exemplars)",
                 "p50/p95/p99 for the selection. Exemplar dots open the trace of a slow request (needs OpenMetrics exemplars from the API; otherwise use the trace-based panel in the Traces dashboard).",
                 [target(f"histogram_quantile(0.50, sum by (le) (rate({bucket}[$__rate_interval])))", "p50", 0, exemplar=True),
                  target(f"histogram_quantile(0.95, sum by (le) (rate({bucket}[$__rate_interval])))", "p95", 1, exemplar=True),
                  target(f"histogram_quantile(0.99, sum by (le) (rate({bucket}[$__rate_interval])))", "p99", 2, exemplar=True)],
                 "s", steps=LAT_STEPS), 12, 8)
    b.add(series("p95 by route", "95th percentile per route template.",
                 [target(f"histogram_quantile(0.95, sum by (le, route) (rate({bucket}[$__rate_interval])))", "{{route}}")],
                 "s", steps=LAT_STEPS, legend="table"), 12, 8)
    b.add(heatmap("Latency heatmap", "Request duration distribution for the selection, with exemplars when available.",
                  [target(f"sum by (le) (increase({bucket}[$__rate_interval]))", "{{le}}", format="heatmap", exemplar=True)]), 24, 8)

    b.row("Slowest routes", collapsed=False)
    sel = f'{{{API}{flt}}}'
    tr = [{"id": "joinByField", "options": {"byField": "route", "mode": "outer"}},
          {"id": "organize", "options": {
              "excludeByName": {"Time": True, "Time 1": True, "Time 2": True, "Time 3": True,
                                "job": True, "job 1": True, "job 2": True, "job 3": True,
                                "method": True},
              "indexByName": {"route": 0, "Value #A": 1, "Value #B": 2, "Value #C": 3},
              "renameByName": {"route": "Route", "Value #A": "p95", "Value #B": "Req/s", "Value #C": "5xx ratio"}}}]
    b.add(table("Slowest routes (p95)", "Routes sorted by p95 latency over the selected range, with their throughput and error ratio.",
                [instant(f"histogram_quantile(0.95, sum by (le, route) (rate({HTTP_BUCKET}{sel}[$__range])))", "", 0, format="table"),
                 instant(f"sum by (route) (rate({HTTP_COUNT}{sel}[$__range]))", "", 1, format="table"),
                 instant(f'(sum by (route) (rate({HTTP_COUNT}{{{API}{flt},status_code=~"5.."}}[$__range])) / sum by (route) (rate({HTTP_COUNT}{sel}[$__range])))', "", 2, format="table")],
                tr, overrides=[column("p95", "s", steps=LAT_STEPS, cell="color-background", decimals=3),
                               column("Req/s", "reqps", decimals=3),
                               column("5xx ratio", "percentunit", steps=ERR_STEPS, cell="color-text", decimals=2)],
                sort="p95"), 24, 9)
    vars_ = [PROM_VAR,
             query_var("route", "Route", f"label_values({HTTP_COUNT}{{{API}}}, route)"),
             query_var("method", "Method", f"label_values({HTTP_COUNT}{{{API}}}, method)")]
    return dashboard("tm-api-red", "Time Manager - API RED",
                     "Rate, errors and duration per route and method, with exemplar-enabled latency.",
                     ["time-manager", "api", "red"], b, vars_)


def business() -> dict:
    b = Board()
    b.add(nav_text("tm-business"), 24, 2)
    hourly = {"interval": "1h"}
    inc = lambda m: f"sum(increase({m}[1h]))"  # noqa: E731
    b.row("Time tracking", collapsed=False)
    b.add(stat("Clock-ins", "Successful clock-ins in the selected range.", f"sum(increase({CLOCK_IN}[$__range]))",
               "short", [(None, C_INFO)], spark=False, decimals=0), 6, 4)
    b.add(stat("Clock-outs", "Successful clock-outs in the selected range.", f"sum(increase({CLOCK_OUT}[$__range]))",
               "short", [(None, C_INFO)], spark=False, decimals=0), 6, 4)
    b.add(stat("Net clock-ins", "Clock-ins minus clock-outs in the range: people still clocked in at the end of the window, relative to its start.",
               f"sum(increase({CLOCK_IN}[$__range])) - sum(increase({CLOCK_OUT}[$__range]))", "short",
               [(None, C_INFO)], spark=False, decimals=0), 6, 4)
    b.add(stat("Clock errors", "Failed clock operations (tm_errors_total, CLOCK_*) in the range, e.g. already clocked in or overlap.",
               'sum(increase(tm_errors_total{code=~"CLOCK_.*"}[$__range]))', "short",
               [(None, C_OK), (1, C_WARN), (20, C_BAD)], spark=False, decimals=0), 6, 4)
    b.add(series("Clock-ins and clock-outs per hour", "Hourly count of clock-in and clock-out events: the working-day heartbeat.",
                 [target(inc(CLOCK_IN), "clock-ins", 0, **hourly), target(inc(CLOCK_OUT), "clock-outs", 1, **hourly)],
                 "short", kind="bars", decimals=0,
                 overrides=[color_override("clock-ins", "green"), color_override("clock-outs", "blue")]), 24, 8)

    b.row("Authentication", collapsed=False)
    b.add(stat("Login failure ratio", "Failed logins (AUTH_INVALID_CREDENTIALS) over all login attempts in the range.",
               f"(sum(increase({LOGIN_KO}[$__range])) or vector(0)) / (sum(increase({LOGIN_KO}[$__range])) + sum(increase({LOGIN_OK}[$__range])))",
               "percentunit", [(None, C_OK), (0.2, C_WARN), (0.5, C_BAD)], spark=False, decimals=1), 6, 8)
    b.add(series("Logins per hour: success vs failed", "Successful logins (auth.logged_in) against rejected credentials (AUTH_INVALID_CREDENTIALS).",
                 [target(inc(LOGIN_OK), "success", 0, **hourly), target(inc(LOGIN_KO), "failed", 1, **hourly)],
                 "short", kind="bars", decimals=0,
                 overrides=[color_override("success", "green"), color_override("failed", "red")]), 18, 8)
    b.add(series("Auth errors by code", "Rate of authentication errors per code; spikes hint at credential stuffing or an SSO outage.",
                 [target(f"sum by (code) (rate({AUTH_ERR}[$__rate_interval]))", "{{code}}")], "ops",
                 stack=True, legend="table"), 12, 7)
    b.add(series("Rate limited requests", "Requests rejected with rate.limit.exceeded (HTTP 429).",
                 [target('sum(rate(tm_errors_total{code="rate.limit.exceeded"}[$__rate_interval]))', "429")], "ops",
                 overrides=[color_override("429", "orange")]), 12, 7)

    b.row("Users and teams", collapsed=False)
    b.add(stat("Users created", "User accounts created in the range.", f"sum(increase({USER_CREATED}[$__range]))",
               "short", [(None, C_INFO)], spark=False, decimals=0), 4, 4)
    b.add(stat("Users archived", "User accounts archived in the range.",
               'sum(increase(tm_events_total{code="user.archived"}[$__range]))', "short", [(None, C_INFO)], spark=False, decimals=0), 4, 4)
    b.add(stat("Teams created", "Teams created in the range.", f"sum(increase({TEAM_CREATED}[$__range]))",
               "short", [(None, C_INFO)], spark=False, decimals=0), 4, 4)
    b.add(stat("Teams archived", "Teams archived in the range.",
               'sum(increase(tm_events_total{code="team.archived"}[$__range]))', "short", [(None, C_INFO)], spark=False, decimals=0), 4, 4)
    b.add(stat("User conflicts", "Duplicate-email conflicts (USER_CONFLICT) in the range.",
               'sum(increase(tm_errors_total{code="USER_CONFLICT"}[$__range]))', "short",
               [(None, C_OK), (5, C_WARN)], spark=False, decimals=0), 4, 4)
    b.add(stat("Validation errors", "Requests rejected by schema validation (validation.error) in the range: a rise after a deploy signals a client/API contract drift.",
               'sum(increase(tm_errors_total{code="validation.error"}[$__range]))', "short",
               [(None, C_OK), (50, C_WARN)], spark=False, decimals=0), 4, 4)
    b.add(series("Users and teams created per hour", "Hourly creation of users and teams.",
                 [target(inc(USER_CREATED), "users", 0, **hourly), target(inc(TEAM_CREATED), "teams", 1, **hourly)],
                 "short", kind="bars", decimals=0), 24, 7)

    b.row("Reports", collapsed=False)
    b.add(stat("Reports generated", "Team and user reports generated in the range.", f"sum(increase({REPORTS}[$__range]))",
               "short", [(None, C_INFO)], spark=False, decimals=0), 6, 7)
    b.add(series("Reports generated per hour", "Hourly report generation split by report type.",
                 [target(f"sum by (code) (increase({REPORTS}[1h]))", "{{code}}", 0, **hourly)], "short", kind="bars",
                 stack=True, decimals=0, legend="table"), 18, 7)

    b.row("Event catalogue", collapsed=True)
    tr = [{"id": "organize", "options": {"excludeByName": {"Time": True}, "renameByName": {"code": "Event", "Value": "Count"}}}]
    b.add(table("All success events", "Every tm_events_total code with its count in the selected range.",
                [instant("sort_desc(sum by (code) (increase(tm_events_total[$__range])))", "", format="table")], tr,
                overrides=[column("Count", "short", decimals=0)], sort="Count"), 12, 10)
    tr2 = [{"id": "organize", "options": {"excludeByName": {"Time": True}, "renameByName": {"code": "Error", "status": "HTTP", "Value": "Count"}}}]
    b.add(table("All error codes", "Every tm_errors_total code and HTTP status with its count in the selected range.",
                [instant("sort_desc(sum by (code, status) (increase(tm_errors_total[$__range])))", "", format="table")], tr2,
                overrides=[column("Count", "short", decimals=0)], sort="Count"), 12, 10)
    return dashboard("tm-business", "Time Manager - Business KPIs",
                     "Product KPIs derived from tm_events_total and tm_errors_total: clock-ins/outs, logins, users, teams, reports.",
                     ["time-manager", "business", "kpi"], b, [PROM_VAR], time_from="now-24h")


def traces() -> dict:
    b = Board()
    svc = '{service="$service",span_kind="SPAN_KIND_SERVER"}'
    b.add(nav_text("tm-traces"), 24, 2)
    b.row("Service graph", collapsed=False)
    sg = base("nodeGraph", "Service map", "Service graph generated by Tempo from client/server span pairs: nodes are services (api, postgres, ...), edges show request rate and failures.",
              TEMPO, [{"datasource": TEMPO, "queryType": "serviceMap", "refId": "A"}])
    sg["options"] = {"edges": {}, "nodes": {}}
    b.add(sg, 24, 10)

    b.row("RED from traces (span metrics)", collapsed=False)
    b.add(series("Rate by operation", "Server spans per second per span name (Tempo span metrics).",
                 [target(f"sum by (span_name) (rate(traces_spanmetrics_calls_total{svc}[$__rate_interval]))", "{{span_name}}")],
                 "reqps", stack=True, legend="table"), 8, 8)
    b.add(series("Error rate by operation", "Server spans ending in an error status per second.",
                 [target(f'sum by (span_name) (rate(traces_spanmetrics_calls_total{{service="$service",span_kind="SPAN_KIND_SERVER",status_code="STATUS_CODE_ERROR"}}[$__rate_interval]))', "{{span_name}}")],
                 "reqps", stack=True, legend="table", overrides=[]), 8, 8)
    b.add(series("Duration percentiles (exemplars)", "p50/p95/p99 of server spans. Exemplars link to the trace behind a data point.",
                 [target(f"histogram_quantile({q}, sum by (le) (rate(traces_spanmetrics_latency_bucket{svc}[$__rate_interval])))", nm, i, exemplar=True)
                  for i, (q, nm) in enumerate([(0.5, "p50"), (0.95, "p95"), (0.99, "p99")])],
                 "s", steps=LAT_STEPS), 8, 8)
    b.add(series("Downstream calls (client spans)", "Rate of client spans per target (database and HTTP calls) made by the service.",
                 [target('sum by (span_name) (rate(traces_spanmetrics_calls_total{service="$service",span_kind="SPAN_KIND_CLIENT"}[$__rate_interval]))', "{{span_name}}")],
                 "reqps", stack=True, legend="table"), 12, 7)
    b.add(series("Service graph request rate", "Edge request rate between services from the service graph metrics.",
                 [target("sum by (client, server) (rate(traces_service_graph_request_total[$__rate_interval]))", "{{client}} -> {{server}}")],
                 "reqps", legend="table"), 12, 7)

    b.row("Trace search", collapsed=False)
    def search(title, desc, q):
        p = base("table", title, desc, TEMPO,
                 [{"datasource": TEMPO, "filters": [], "limit": 20, "query": q, "queryType": "traceql",
                   "refId": "A", "tableType": "traces"}])
        p["fieldConfig"] = {"defaults": {"custom": {"align": "auto", "cellOptions": {"type": "auto"}, "inspect": False},
                                         "color": {"mode": "thresholds"}, "mappings": [],
                                         "thresholds": thresholds([(None, C_OK)])}, "overrides": []}
        p["options"] = {"cellHeight": "sm", "footer": {"show": False, "reducer": ["sum"], "fields": ""}, "showHeader": True}
        return p
    b.add(search("Slow traces (> 500 ms)", "TraceQL: traces of the selected service slower than 500 ms. Click a trace id to open the waterfall; its logs are one click away.",
                 '{ resource.service.name = "$service" && duration > 500ms }'), 12, 9)
    b.add(search("Failed traces", "TraceQL: traces of the selected service with an error span.",
                 '{ resource.service.name = "$service" && status = error }'), 12, 9)
    b.add(search("Search (free TraceQL)", "Edit the query in this panel to run any TraceQL expression, e.g. { span.http.route = \"/v1/clocks\" }.",
                 '{ resource.service.name = "$service" }'), 24, 8)
    tr = base("traces", "Trace by id", "Waterfall of the trace id typed in the trace_id variable (copy it from a log line or an exemplar).",
              TEMPO, [{"datasource": TEMPO, "query": "${trace_id}", "queryType": "traceql", "refId": "A"}])
    b.add(tr, 24, 12)
    vars_ = [PROM_VAR, TEMPO_VAR,
             query_var("service", "Service", "label_values(traces_spanmetrics_calls_total, service)", multi=False,
                       include_all=False, default="time-manager-api"),
             textbox("trace_id", "trace_id")]
    return dashboard("tm-traces", "Time Manager - Traces",
                     "Service graph, span-metrics RED and TraceQL search backed by Tempo.",
                     ["time-manager", "traces", "tempo"], b, vars_, time_from="now-1h")


def logs() -> dict:
    b = Board()
    b.add(nav_text("tm-logs"), 24, 2)
    sel = '{service="api"}'
    b.row("Overview", collapsed=False)
    lv = [color_override(k, v) for k, v in LEVEL_COLORS.items()]
    b.add(series("Log volume by level", "Number of api log lines per level. Sudden warn/error growth precedes most incidents.",
                 [loki_target(f"sum by (level) (count_over_time({sel} [$__auto]))", legend="{{level}}")],
                 "short", kind="bars", stack=True, ds=LOKI, overrides=lv, legend="table"), 16, 8)
    b.add(stat("Errors in range", "api log lines with level error or fatal in the selected range.",
               f'sum(count_over_time({{service="api",level=~"error|fatal"}}[$__range]))', "short",
               [(None, C_OK), (1, C_WARN), (20, C_BAD)], spark=False, ds=LOKI), 4, 8)
    b.add(stat("Warnings in range", "api log lines with level warn in the selected range.",
               f'sum(count_over_time({{service="api",level="warn"}}[$__range]))', "short",
               [(None, C_OK), (20, C_WARN)], spark=False, ds=LOKI), 4, 8)
    for s in b.panels[-2:]:
        s["targets"] = [loki_target(s["targets"][0]["expr"], queryType="instant")]
    b.add(series("Volume by service", "Log lines per second per compose service (api, db, web, ...).",
                 [loki_target("sum by (service) (rate({service=~\".+\"} [$__auto]))", legend="{{service}}")],
                 "cps", ds=LOKI, stack=True, legend="table"), 24, 6)

    b.row("Errors", collapsed=False)
    b.add(logs_panel("Error logs", "api lines with level error or fatal, newest first. Expand a line to see request_id and trace_id and jump to the trace.",
                     '{service="api",level=~"error|fatal"}'), 24, 10)

    b.row("Request and trace correlation", collapsed=False)
    b.add(logs_panel("Logs for request_id / trace_id", "Lines matching the request_id and trace_id variables (regex; both default to everything). Paste a trace id from Tempo or an x-request-id response header.",
                     '{service="api", level=~"$level"} | request_id=~"$request_id" | trace_id=~"$trace_id" |~ "$search"'), 24, 12)
    lk = base("text", "Jump to traces", "How to go from a log line to its trace.", None, [])
    lk.pop("targets")
    lk["options"] = {"mode": "markdown", "content": "Expand a log line and click **View trace in Tempo** (derived field on `trace_id`), "
                                                    "or copy the id into the `trace_id` variable of the [Traces dashboard](/d/tm-traces)."}
    lk["transparent"] = True
    b.add(lk, 24, 2)

    b.row("All services", collapsed=True)
    b.add(logs_panel("All logs", "Lines of every collected container filtered with the search variable.",
                     '{service=~".+"} |~ "$search"'), 24, 12)
    vars_ = [LOKI_VAR,
             custom_var("level", "Level", ["trace", "debug", "info", "warn", "error", "fatal", "unknown"]),
             textbox("request_id", "request_id (regex)", ".*"),
             textbox("trace_id", "trace_id (regex)", ".*"),
             textbox("search", "search (regex)", ".*")]
    d = dashboard("tm-logs", "Time Manager - Logs",
                  "Loki log explorer for the api: volume by level, errors and request/trace correlation.",
                  ["time-manager", "logs", "loki"], b, vars_, time_from="now-1h")
    return d


def postgres() -> dict:
    b = Board()
    db = 'datname=~"$database"'
    b.add(nav_text("tm-postgres"), 24, 2)
    b.row("Health", collapsed=False)
    b.add(stat("Exporter up", "pg_up: 1 when postgres-exporter can query PostgreSQL.", "min(pg_up)", "none",
               [(None, C_BAD), (1, C_OK)],
               mappings=[{"type": "value", "options": {"0": {"text": "DOWN"}, "1": {"text": "UP"}}}], spark=False, color_mode="background"), 4, 4)
    b.add(stat("Uptime", "Time since the PostgreSQL postmaster started.", "time() - max(pg_postmaster_start_time_seconds)", "s",
               [(None, C_INFO)], spark=False), 4, 4)
    b.add(stat("Connections used", "Open connections as a share of max_connections. Alert above 80%.",
               "sum(pg_stat_activity_count) / max(pg_settings_max_connections)", "percentunit",
               [(None, C_OK), (0.6, C_WARN), (0.8, C_BAD)], decimals=1, min_=0, max_=1), 4, 4)
    b.add(stat("Cache hit ratio", "Share of block reads served from shared buffers. Healthy OLTP stays above 99%.",
               f"sum(rate(pg_stat_database_blks_hit{{{db}}}[$__rate_interval])) / (sum(rate(pg_stat_database_blks_hit{{{db}}}[$__rate_interval])) + sum(rate(pg_stat_database_blks_read{{{db}}}[$__rate_interval])))",
               "percentunit", [(None, C_BAD), (0.9, C_WARN), (0.99, C_OK)], decimals=2, min_=0, max_=1), 4, 4)
    b.add(stat("Database size", "On-disk size of the selected databases.", f"sum(pg_database_size_bytes{{{db}}})", "bytes",
               [(None, C_INFO)]), 4, 4)
    b.add(stat("Deadlocks (range)", "Deadlocks detected in the selected range.", f"sum(increase(pg_stat_database_deadlocks{{{db}}}[$__range]))",
               "short", [(None, C_OK), (1, C_BAD)], spark=False, decimals=0), 4, 4)

    b.row("Connections and transactions", collapsed=False)
    b.add(series("Connections by state", "pg_stat_activity connections by state against max_connections.",
                 [target("sum by (state) (pg_stat_activity_count)", "{{state}}", 0),
                  target("max(pg_settings_max_connections)", "max_connections", 1)],
                 "short", stack=False, legend="table",
                 overrides=[color_override("max_connections", "red")]), 12, 8)
    b.add(series("Transactions per second", "Commits and rollbacks per second.",
                 [target(f"sum(rate(pg_stat_database_xact_commit{{{db}}}[$__rate_interval]))", "commit", 0),
                  target(f"sum(rate(pg_stat_database_xact_rollback{{{db}}}[$__rate_interval]))", "rollback", 1)],
                 "ops", overrides=[color_override("commit", "green"), color_override("rollback", "red")]), 12, 8)
    b.add(series("Longest open transaction", "Age of the oldest transaction per state: idle in transaction values that grow indicate leaked connections.",
                 [target("max by (state) (pg_stat_activity_max_tx_duration)", "{{state}}")], "s", legend="table"), 12, 7)
    b.add(series("Rows per second", "Tuples returned, fetched, inserted, updated and deleted per second.",
                 [target(f"sum(rate(pg_stat_database_tup_{k}{{{db}}}[$__rate_interval]))", k, i)
                  for i, k in enumerate(["returned", "fetched", "inserted", "updated", "deleted"])], "ops", legend="table"), 12, 7)

    b.row("Cache, locks and I/O", collapsed=True)
    b.add(series("Cache hit ratio over time", "Buffer cache hit ratio per database.",
                 [target(f"sum by (datname) (rate(pg_stat_database_blks_hit{{{db}}}[$__rate_interval])) / (sum by (datname) (rate(pg_stat_database_blks_hit{{{db}}}[$__rate_interval])) + sum by (datname) (rate(pg_stat_database_blks_read{{{db}}}[$__rate_interval])))", "{{datname}}")],
                 "percentunit", min_=0, max_=1, steps=[(None, C_BAD), (0.9, C_WARN), (0.99, C_OK)]), 12, 8)
    b.add(series("Locks by mode", "Locks currently held per lock mode.",
                 [target(f"sum by (mode) (pg_locks_count{{{db}}})", "{{mode}}")], "short", stack=True, legend="table"), 12, 8)
    b.add(series("Temp files and bytes", "Temporary files spilled to disk (work_mem too small) per second.",
                 [target(f"sum(rate(pg_stat_database_temp_bytes{{{db}}}[$__rate_interval]))", "temp bytes", 0)], "Bps"), 12, 7)
    b.add(series("Conflicts and deadlocks", "Recovery conflicts and deadlocks per second.",
                 [target(f"sum(rate(pg_stat_database_conflicts{{{db}}}[$__rate_interval]))", "conflicts", 0),
                  target(f"sum(rate(pg_stat_database_deadlocks{{{db}}}[$__rate_interval]))", "deadlocks", 1)], "ops"), 12, 7)

    b.row("Storage", collapsed=True)
    b.add(series("Database size over time", "Growth of each database on disk.",
                 [target(f"pg_database_size_bytes{{{db}}}", "{{datname}}")], "bytes", legend="table"), 24, 8)

    b.row("Slow queries (requires pg_stat_statements)", collapsed=True)
    tr = [{"id": "organize", "options": {"excludeByName": {"Time": True}, "renameByName": {"queryid": "Query id", "datname": "Database", "Value": "Mean time"}}}]
    b.add(table("Slowest statements (mean time)", "Top statements by mean execution time. Needs pg_stat_statements loaded on the db service and postgres-exporter started with --collector.stat_statements; see docs/OBSERVABILITY.md. Empty otherwise.",
                [instant("topk(10, sum by (datname, queryid) (rate(pg_stat_statements_seconds_total[$__range])) / sum by (datname, queryid) (rate(pg_stat_statements_calls_total[$__range])))", "", format="table")],
                tr, overrides=[column("Mean time", "s", steps=LAT_STEPS, cell="color-text", decimals=4)], sort="Mean time"), 24, 8)
    vars_ = [PROM_VAR, query_var("database", "Database", "label_values(pg_stat_database_xact_commit, datname)", regex="/^(?!template).*/")]
    return dashboard("tm-postgres", "Time Manager - PostgreSQL",
                     "Connections, transactions, cache efficiency, locks and size from postgres-exporter.",
                     ["time-manager", "postgres", "database"], b, vars_)


def runtime() -> dict:
    b = Board()
    j = f"{{{API}}}"
    b.add(nav_text("tm-runtime"), 24, 2)
    b.row("Process", collapsed=False)
    b.add(stat("Uptime", "Time since the API process started.", f"time() - max(process_start_time_seconds{j})", "s", [(None, C_INFO)], spark=False), 4, 4)
    b.add(stat("Restarts (24h)", "Process restarts in the last 24 hours, from process_start_time_seconds changes (no cAdvisor in this stack).",
               f"sum(changes(process_start_time_seconds{j}[24h]))", "short", [(None, C_OK), (1, C_WARN), (5, C_BAD)], spark=False, decimals=0), 4, 4)
    b.add(stat("Memory (RSS)", "Resident set size of the API process.", f"max(process_resident_memory_bytes{j})", "bytes", [(None, C_INFO)]), 4, 4)
    b.add(stat("CPU", "CPU cores used by the API process.", f"sum(rate(process_cpu_seconds_total{j}[$__rate_interval]))", "none",
               [(None, C_OK), (0.7, C_WARN), (0.95, C_BAD)], decimals=2), 4, 4)
    b.add(stat("Event loop lag p99", "99th percentile event loop delay. Above 100 ms users feel it; alert above 500 ms.",
               f"max(nodejs_eventloop_lag_p99_seconds{j})", "s", [(None, C_OK), (0.1, C_WARN), (0.5, C_BAD)], decimals=4), 4, 4)
    b.add(stat("Open file descriptors", "Open file descriptors against the process limit.",
               f"max(process_open_fds{j}) / max(process_max_fds{j})", "percentunit", [(None, C_OK), (0.6, C_WARN), (0.8, C_BAD)], decimals=1, min_=0, max_=1), 4, 4)

    b.row("CPU and memory", collapsed=False)
    b.add(series("CPU usage", "CPU seconds per second, user versus system.",
                 [target(f"rate(process_cpu_user_seconds_total{j}[$__rate_interval])", "user", 0),
                  target(f"rate(process_cpu_system_seconds_total{j}[$__rate_interval])", "system", 1)], "none", stack=True), 12, 8)
    b.add(series("Memory", "Resident memory, heap and external memory.",
                 [target(f"process_resident_memory_bytes{j}", "rss", 0),
                  target(f"nodejs_heap_size_total_bytes{j}", "heap total", 1),
                  target(f"nodejs_heap_size_used_bytes{j}", "heap used", 2),
                  target(f"nodejs_external_memory_bytes{j}", "external", 3)], "bytes", legend="table"), 12, 8)

    b.row("Event loop and GC", collapsed=False)
    b.add(series("Event loop lag", "Event loop delay: mean, p50, p90, p99 and max.",
                 [target(f"nodejs_eventloop_lag_{k}_seconds{j}", k, i) for i, k in enumerate(["mean", "p50", "p90", "p99", "max"])],
                 "s", legend="table"), 12, 8)
    b.add(series("GC time", "Seconds per second spent in garbage collection, by kind.",
                 [target(f"sum by (kind) (rate(nodejs_gc_duration_seconds_sum{j}[$__rate_interval]))", "{{kind}}")], "s", stack=True, legend="table"), 12, 8)
    b.add(series("Active handles and requests", "Libuv handles and pending requests: a steady climb means a leak.",
                 [target(f"nodejs_active_handles_total{j}", "handles", 0), target(f"nodejs_active_requests_total{j}", "requests", 1)], "short"), 12, 7)
    b.add(series("Heap by space", "V8 heap usage per space.",
                 [target(f"nodejs_heap_space_size_used_bytes{j}", "{{space}}")], "bytes", stack=True, legend="table"), 12, 7)

    b.row("Database pool", collapsed=True)
    b.add(stat("Pool max connections", "Configured DATABASE_POOL_MAX of the API (tm_db_pool_max_connections).", f"max(tm_db_pool_max_connections{j})", "short",
               [(None, C_INFO)], spark=False), 6, 4)
    b.add(series("Readiness probe duration", "Duration of GET /health/ready, dominated by the database round trip.",
                 [target('probe_duration_seconds{job="probes",target="api-readiness"}', "readiness")], "s"), 18, 7)

    b.row("Observability stack health", collapsed=True)
    tr = [{"id": "organize", "options": {"excludeByName": {"Time": True, "__name__": True}, "renameByName": {"job": "Job", "instance": "Instance", "Value": "Up"}}}]
    b.add(table("Scrape targets", "Every scrape target Alloy knows about; Up=0 means the target is down.",
                [instant("up", "", format="table")], tr,
                overrides=[column("Up", "none", steps=[(None, C_BAD), (1, C_OK)], cell="color-background")], sort="Up"), 8, 8)
    b.add(series("Samples ingested", "Prometheus head samples appended per second.",
                 [target("rate(prometheus_tsdb_head_samples_appended_total[$__rate_interval])", "samples/s")], "ops"), 8, 8)
    b.add(series("Active series", "Prometheus head series: watch for cardinality explosions.",
                 [target("prometheus_tsdb_head_series", "series")], "short"), 8, 8)
    b.add(series("Spans received by Tempo", "Spans accepted by the Tempo distributor per second.",
                 [target("sum(rate(tempo_distributor_spans_received_total[$__rate_interval]))", "spans/s")], "ops"), 8, 7)
    b.add(series("Loki ingestion", "Bytes received by the Loki distributor per second.",
                 [target("sum(rate(loki_distributor_bytes_received_total[$__rate_interval]))", "bytes/s")], "Bps"), 8, 7)
    b.add(series("Remote-write failures", "Samples Alloy failed to write to Prometheus per second (should be zero).",
                 [target("sum(rate(prometheus_remote_storage_samples_failed_total[$__rate_interval]))", "failed")], "ops",
                 overrides=[color_override("failed", "red")]), 8, 7)
    return dashboard("tm-runtime", "Time Manager - Node.js Runtime",
                     "API process health: CPU, memory, event loop lag, GC, restarts and the health of the observability stack.",
                     ["time-manager", "runtime", "nodejs"], b, [PROM_VAR])


# --------------------------------------------------------------------------- alerting

def yaml_scalar(v) -> str:
    return json.dumps(v, ensure_ascii=False)


def to_yaml(v, indent: int = 0) -> str:
    pad = "  " * indent
    if isinstance(v, dict):
        if not v:
            return "{}"
        out = []
        for k, val in v.items():
            if isinstance(val, (dict, list)) and val:
                out.append(f"{pad}{k}:\n{to_yaml(val, indent + 1)}")
            else:
                out.append(f"{pad}{k}: {to_yaml(val, indent + 1)}")
        return "\n".join(out)
    if isinstance(v, list):
        if not v:
            return "[]"
        out = []
        for item in v:
            if isinstance(item, dict) and item:
                body = to_yaml(item, indent + 1).split("\n")
                body[0] = body[0].lstrip()
                out.append(f"{pad}- " + "\n".join(body))
            else:
                out.append(f"{pad}- {yaml_scalar(item)}")
        return "\n".join(out)
    return yaml_scalar(v)


def rule(uid, title, expr, op, threshold, for_, severity, summary, runbook, no_data="OK", window=600) -> dict:
    return {
        "uid": uid,
        "title": title,
        "condition": "C",
        "data": [
            {"refId": "A", "relativeTimeRange": {"from": window, "to": 0}, "datasourceUid": "prometheus",
             "model": {"datasource": {"type": "prometheus", "uid": "prometheus"}, "editorMode": "code", "expr": expr,
                       "instant": True, "range": False, "intervalMs": 1000, "maxDataPoints": 43200, "refId": "A"}},
            {"refId": "B", "relativeTimeRange": {"from": window, "to": 0}, "datasourceUid": "__expr__",
             "model": {"type": "reduce", "datasource": {"type": "__expr__", "uid": "__expr__"}, "expression": "A",
                       "reducer": "last", "settings": {"mode": "dropNN"}, "refId": "B"}},
            {"refId": "C", "relativeTimeRange": {"from": window, "to": 0}, "datasourceUid": "__expr__",
             "model": {"type": "threshold", "datasource": {"type": "__expr__", "uid": "__expr__"}, "expression": "B",
                       "conditions": [{"evaluator": {"type": op, "params": [threshold]}}], "refId": "C"}},
        ],
        "noDataState": no_data,
        "execErrState": "Error",
        "for": for_,
        "annotations": {"summary": summary, "runbook": f"docs/OBSERVABILITY.md#{runbook}"},
        "labels": {"severity": severity, "source": "grafana"},
        "isPaused": False,
    }


def alert_rules() -> str:
    rules = [
        rule("tm-api-down", "ApiDown", 'min(up{job="api"})', "lt", 1, "1m", "critical",
             "API scrape target is down", "apidown", no_data="Alerting"),
        rule("tm-api-5xx", "ApiHighErrorRatio",
             'job:http_request_errors:ratio_rate5m{job="api"} and on (job) job:http_requests:rate5m{job="api"} > 0.05',
             "gt", 0.02, "5m", "critical", "More than 2% of API responses are 5xx", "apihigherrorratio"),
        rule("tm-api-p95", "ApiHighLatencyP95",
             'job:http_request_duration_seconds:p95_5m{job="api"} and on (job) job:http_requests:rate5m{job="api"} > 0.05',
             "gt", 1, "5m", "warning", "API p95 latency above 1s", "apihighlatencyp95"),
        rule("tm-readiness", "ReadinessFailing", 'min(probe_success{job="probes",target="api-readiness"})', "lt", 1, "2m",
             "critical", "api /health/ready is failing", "readinessfailing", no_data="Alerting"),
        rule("tm-db-connections", "PostgresConnectionsSaturation",
             "sum(pg_stat_activity_count) / max(pg_settings_max_connections)", "gt", 0.8, "5m", "warning",
             "PostgreSQL connections above 80% of max_connections", "postgresconnectionssaturation"),
    ]
    doc = {"apiVersion": 1,
           "groups": [{"orgId": 1, "name": "tm-critical", "folder": "Time Manager", "interval": "1m", "rules": rules}]}
    head = ("# Grafana-managed alert rules mirroring the critical Prometheus rules\n"
            "# (ops/observability/prometheus/rules/alerts.yml). Generated by grafana/tools/generate.py.\n"
            "# Grafana notifies the `tm-webhook` contact point; Prometheus alerts go through Alertmanager.\n")
    return head + to_yaml(doc) + "\n"


CONTACT_POLICIES = """\
# Contact point: webhook from GRAFANA_ALERT_WEBHOOK_URL (compose passes a harmless default,
# so provisioning never fails; set a real Slack/Teams/ntfy/incident webhook for production).
apiVersion: 1

contactPoints:
  - orgId: 1
    name: tm-webhook
    receivers:
      - uid: tm-webhook
        type: webhook
        disableResolveMessage: false
        settings:
          url: ${GRAFANA_ALERT_WEBHOOK_URL}
          httpMethod: POST

policies:
  - orgId: 1
    receiver: tm-webhook
    group_by: ["alertname", "severity"]
    group_wait: 30s
    group_interval: 5m
    repeat_interval: 4h
    routes:
      - receiver: tm-webhook
        object_matchers:
          - ["severity", "=", "critical"]
        group_wait: 10s
        repeat_interval: 1h
"""


# --------------------------------------------------------------------------- branding

def svg_icon(size: int = 64) -> str:
    ticks = "".join(
        f'<line x1="32" y1="9" x2="32" y2="{13 if i % 3 == 0 else 11}" transform="rotate({i * 30} 32 32)"/>'
        for i in range(12))
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 64 64" role="img" aria-label="Time Manager">
  <defs>
    <linearGradient id="tm-g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#38BDF8"/>
      <stop offset="1" stop-color="#6366F1"/>
    </linearGradient>
  </defs>
  <circle cx="32" cy="32" r="27" fill="none" stroke="url(#tm-g)" stroke-width="5"/>
  <g stroke="url(#tm-g)" stroke-width="2.2" stroke-linecap="round">{ticks}</g>
  <path d="M32 32V18M32 32l10 6" fill="none" stroke="url(#tm-g)" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="32" cy="32" r="3.2" fill="#F97316"/>
</svg>
"""


def svg_login(dark: bool) -> str:
    fg = "#E2E8F0" if dark else "#0F172A"
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="260" height="72" viewBox="0 0 260 72" role="img" aria-label="Time Manager Observability">
  <defs>
    <linearGradient id="tm-g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#38BDF8"/>
      <stop offset="1" stop-color="#6366F1"/>
    </linearGradient>
  </defs>
  <g transform="translate(4 4)">
    <circle cx="32" cy="32" r="27" fill="none" stroke="url(#tm-g)" stroke-width="5"/>
    <path d="M32 32V18M32 32l10 6" fill="none" stroke="url(#tm-g)" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="32" cy="32" r="3.2" fill="#F97316"/>
  </g>
  <text x="80" y="35" font-family="Inter, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="25" font-weight="700" fill="{fg}">Time Manager</text>
  <text x="81" y="56" font-family="Inter, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="14" letter-spacing="2.5" fill="#94A3B8">OBSERVABILITY</text>
</svg>
"""


def svg_background(dark: bool) -> str:
    c0, c1 = ("#0B1220", "#111C33") if dark else ("#F1F5F9", "#DBEAFE")
    stroke = "#38BDF8" if dark else "#6366F1"
    rings = "".join(f'<circle cx="1500" cy="260" r="{r}" fill="none" stroke="{stroke}" stroke-opacity="{0.10 - i * 0.012:.3f}" stroke-width="2"/>'
                    for i, r in enumerate(range(120, 720, 100)))
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="{c0}"/>
      <stop offset="1" stop-color="{c1}"/>
    </linearGradient>
  </defs>
  <rect width="1920" height="1080" fill="url(#bg)"/>
  {rings}
</svg>
"""


def png(size: int, rounded: bool) -> bytes:
    """Rasterises the clock icon (4x4 supersampling) into an RGBA PNG without dependencies."""
    ss = 4
    px = bytearray()
    cx = cy = size / 2

    def in_bg(x: float, y: float) -> bool:
        if not rounded:
            return True
        r = size * 0.22
        dx = max(r - x, 0, x - (size - r))
        dy = max(r - y, 0, y - (size - r))
        return dx * dx + dy * dy <= r * r

    def seg(x, y, x0, y0, x1, y1, w) -> bool:
        vx, vy = x1 - x0, y1 - y0
        t = max(0.0, min(1.0, ((x - x0) * vx + (y - y0) * vy) / (vx * vx + vy * vy)))
        return math.hypot(x - (x0 + t * vx), y - (y0 + t * vy)) <= w / 2

    for j in range(size):
        px.append(0)  # PNG filter type 0
        for i in range(size):
            acc = [0.0, 0.0, 0.0, 0.0]
            for sj in range(ss):
                for si in range(ss):
                    x, y = i + (si + 0.5) / ss, j + (sj + 0.5) / ss
                    col = None
                    if in_bg(x, y):
                        col = (15, 23, 42, 255)
                        d = math.hypot(x - cx, y - cy)
                        s = size
                        if abs(d - 0.34 * s) <= 0.045 * s:
                            col = (56, 189, 248, 255)
                        if seg(x, y, cx, cy, cx, cy - 0.22 * s, 0.07 * s) or seg(x, y, cx, cy, cx + 0.16 * s, cy + 0.09 * s, 0.07 * s):
                            col = (129, 140, 248, 255)
                        if d <= 0.05 * s:
                            col = (249, 115, 22, 255)
                    if col:
                        for k in range(4):
                            acc[k] += col[k]
            n = ss * ss
            a = acc[3] / n
            if a > 0:
                px.extend([round(acc[0] / n * 255 / a), round(acc[1] / n * 255 / a), round(acc[2] / n * 255 / a), round(a)])
            else:
                px.extend([0, 0, 0, 0])

    def chunk(tag: bytes, data: bytes) -> bytes:
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(bytes(px), 9)) + chunk(b"IEND", b""))


# --------------------------------------------------------------------------- main

def emit(path: Path, content: str | bytes) -> None:
    OUTPUTS[path] = content.encode() if isinstance(content, str) else content


def main() -> int:
    check = "--check" in sys.argv
    for folder, items in {"time-manager": [overview(), api_red(), business(), traces(), logs()],
                          "infrastructure": [postgres(), runtime()]}.items():
        names = {"tm-overview": "overview", "tm-api-red": "api-red", "tm-business": "business",
                 "tm-traces": "traces", "tm-logs": "logs", "tm-postgres": "postgres", "tm-runtime": "runtime"}
        for d in items:
            emit(DASH / folder / f"{names[d['uid']]}.json", json.dumps(d, indent=2, ensure_ascii=False) + "\n")
    emit(ALERTING / "rules.yaml", alert_rules())
    emit(ALERTING / "contact-points.yaml", CONTACT_POLICIES)
    emit(BRANDING / "grafana_icon.svg", svg_icon())
    emit(BRANDING / "g8_login_dark.svg", svg_login(True))
    emit(BRANDING / "g8_login_light.svg", svg_login(False))
    emit(BRANDING / "login_background_dark.svg", svg_background(True))
    emit(BRANDING / "login_background_light.svg", svg_background(False))
    emit(BRANDING / "fav32.png", png(32, False))
    emit(BRANDING / "apple-touch-icon.png", png(180, True))
    stale = 0
    for path, content in OUTPUTS.items():
        if check:
            if not path.exists() or path.read_bytes() != content:
                print(f"out of date: {path.relative_to(ROOT)}")
                stale += 1
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(content)
            print(f"wrote {path.relative_to(ROOT)}")
    return 1 if stale else 0


if __name__ == "__main__":
    sys.exit(main())
