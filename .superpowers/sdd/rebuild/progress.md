# SDD ledger — plan: 事故重建（源码从 lib 反推）+ 面板样式
基准: f23e737 (上游源码副本 + 幸存 lib/)
样式任务(用户请求)排在重建完成后
Ruling: 设置区标签用户指定为「会话存储」— 已直接改装机副本 lib/client.js（sed 断开硬链接），重建 src/client 时 label 必须用「会话存储」— 成本：若重建时沿用旧文案「会话存储镜像」则需二次修改
Rebuild-1: complete (commit e1afd98; config/health/index/database/types + tsconfigs 重建,产出与 lib 逐字节一致)
Note: database.test.ts 1 个上游陈旧断言待更新; src/client 等 stub d.ts 占位; label 定案「会话存储」
