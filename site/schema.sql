CREATE TABLE IF NOT EXISTS events(
  visit TEXT NOT NULL, kind TEXT NOT NULL, page TEXT NOT NULL, entry TEXT NOT NULL,
  source TEXT NOT NULL, guide TEXT NOT NULL, at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(visit,kind,page)
);
CREATE TABLE IF NOT EXISTS activations(
  receipt TEXT PRIMARY KEY, visit TEXT, at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- New website traffic is counted directly into these buckets (no visit identifiers).
CREATE TABLE IF NOT EXISTS web_counts (
  day TEXT NOT NULL DEFAULT (date('now')), page TEXT NOT NULL, source TEXT NOT NULL,
  kind TEXT NOT NULL, total INTEGER NOT NULL DEFAULT 1, PRIMARY KEY(day,page,source,kind)
);
CREATE TABLE IF NOT EXISTS app_counts (
  utc_date TEXT PRIMARY KEY, active_devices INTEGER NOT NULL
);
CREATE VIEW IF NOT EXISTS daily_activity AS
  SELECT utc_date,active_devices FROM app_counts ORDER BY utc_date DESC;

-- Retain earlier measurements with their original meaning: one view per visit/page.
CREATE VIEW IF NOT EXISTS website_traffic AS
  SELECT day AS utc_date,page,source,
    SUM(CASE WHEN kind='view' THEN total ELSE 0 END) AS page_views,
    SUM(CASE WHEN kind='visit' THEN total ELSE 0 END) AS entries,
    SUM(CASE WHEN kind='download' THEN total ELSE 0 END) AS download_clicks,
    SUM(CASE WHEN kind='demo' THEN total ELSE 0 END) AS demo_actions,
    SUM(CASE WHEN kind='cta' THEN total ELSE 0 END) AS download_ctas
  FROM (
    SELECT day,page,source,kind,total FROM web_counts
    UNION ALL SELECT date(at),page,source,kind,count(*) FROM events GROUP BY date(at),page,source,kind
    UNION ALL SELECT date(first_seen),entry,source,'visit',count(*) FROM
      (SELECT min(at) AS first_seen,entry,source FROM events WHERE kind='view' GROUP BY visit)
      GROUP BY date(first_seen),entry,source
  ) GROUP BY day,page,source ORDER BY day DESC,page,source;

CREATE VIEW IF NOT EXISTS daily_summary AS
  WITH web AS (SELECT utc_date,sum(page_views) AS page_views,sum(entries) AS entries,
    sum(download_clicks) AS download_clicks FROM website_traffic GROUP BY utc_date),
  days AS (SELECT utc_date FROM web UNION SELECT utc_date FROM app_counts)
  SELECT days.utc_date,coalesce(page_views,0) AS page_views,coalesce(entries,0) AS website_entries,
    coalesce(download_clicks,0) AS download_clicks,active_devices
  FROM days LEFT JOIN web USING(utc_date) LEFT JOIN app_counts USING(utc_date)
  ORDER BY days.utc_date DESC;
