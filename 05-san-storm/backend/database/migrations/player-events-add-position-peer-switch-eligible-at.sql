-- 三公府 · 同级官职切换 CD（与长效政策谏言「通过」CD 一致：切换后 +24h）
ALTER TABLE player_events
  ADD COLUMN san_gong_peer_switch_at DATETIME NULL DEFAULT NULL
    COMMENT '同级官职切换 CD 截止（切换后 +24h）'
    AFTER san_gong_document_count;