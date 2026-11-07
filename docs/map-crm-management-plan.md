# Eurasiago CRM 地图管理模块设计（草案，未执行数据库迁移）

## 目标
让 CRM 管理官网地图站点、线路、通道和中英文展示；先预览，人工确认后发布。官网只读取已发布数据，不展示内部成本。

## 推荐数据表
- public_map_stations: id (stable slug PK), name_zh, name_en, longitude, latitude, station_type, country_code, is_active, updated_at.
- public_map_segments: id (stable slug PK), from_station_id, to_station_id, via_coordinates (jsonb), transport_mode, line_kind, is_active, updated_at.
- public_map_corridors: id, name_zh, name_en, border_station_id, is_active, sort_order.
- public_map_corridor_segments: corridor_id, segment_id, sequence_no (composite key), allow_shared_segment.
- public_map_releases: id, version, status (draft/preview/published), payload (jsonb), created_at, published_at, published_by.

## 约束与验证
- 外键必须指向有效站点；经纬度校验；线路 ID 唯一；不能自连；线路几何为经纬度坐标数组。
- 草稿与发布版本隔离；发布前检查孤立站点、重复段、缺失中英文、无效通道与连通性。
- 只允许授权 CRM 用户编辑和发布；公开接口只返回 published 快照；启用 RLS 并记录审计日志。
- 官网报价沿用成本中心的既有公开销售价接口；地图路径只是示意，不能自动认定为有舱位或有报价。
- 现有 src/data/eurasiaMapNetwork.js 作为迁移种子及断网兜底；迁移时保留原 ID，防止旧询价链接失效。

## 迭代顺序
1. 在预览环境建立只读发布快照 API，保持现有静态数据兜底。
2. CRM 增加站点/线路编辑器与地图预览，支持发布前差异检查。
3. 通过权限校验、数据迁移核对、移动端验收后，再逐步切换官网数据源。

> 本文仅为结构设计，不表示已在 Supabase 创建表或启用发布流程。
