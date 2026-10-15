# 公告、在线列表与私聊历史更新（2026-10-10）

## 本次功能

- 首页增加“公告”按钮。每次成功登录进入首页后自动弹出，在同一标签页返回首页不会重复弹出，也可以随时点击按钮查看。暂无公告或加载失败时有明确提示，可手动重新加载。
- 只有数据库中用户名精确为 `admin`、且未被禁用的账户可以发布公告。普通用户即使直接请求接口也不能发布；其他具有 `is_admin` 标记的账户不具备本次公告发布权限。公告标题最多 120 字、正文最多 10000 字，展示最近 50 条。
- 群聊顶部显示在线人数，点击查看昵称和用户名。打开群聊或私聊的登录用户都计入聊天室在线人数，同一账户多个标签页或设备只计一人。每 10 秒更新，停止心跳 35 秒后移出列表，下次刷新列表可见变化。此实现适用于当前单 Tomcat 部署。
- 私聊历史请求增加 10 秒超时、失败自动重试、页面退出取消请求和浏览器返回后重新加载。WebSocket 失败不再停止正常的 HTTP 历史查询。旧记录时间为空时仍可加载。首次只读取最新 30 条，滚动到消息区顶部再按 30 条加载更早记录，并保持阅读位置；后台每 5 秒静默增量同步。2026-10-12 的后续修复改为独立维护旧记录分页状态，并在图片下载前预留预览空间，文字及图片发送通过异步请求完成。详见 `chat-scroll-send-fix.md`。

## 数据库更新（必须先执行）

把项目 `db/announcements.sql` 上传到服务器，例如 `/root/chat-update/announcements.sql`，执行：

```bash
mysql -h127.0.0.1 -u yytf_support -p yytf_support < /root/chat-update/announcements.sql
```

这份脚本只使用 `CREATE TABLE IF NOT EXISTS` 新增公告表，可以重复执行，不修改已有用户、群聊或私聊数据。若该账户没有建表权限，请使用有建表权限的数据库账户执行同一脚本，并确保网站账户可以读写公告表。本次不要重跑旧的 `db/migration.sql`。

## 更新网站

1. 将本次生成的 `target/ROOT.war` 先上传到服务器的暂存目录，例如 `/root/chat-update/ROOT.war`。
2. 备份当前 `/www/apache-tomcat-11.0.9/webapps/ROOT.war` 和 `webapps/ROOT` 到 `webapps` 之外的目录，保留可能存在的服务器自定义文件。用当前实际管理 Tomcat 的方式停止服务，并确认进程已经停止。
3. 用新 WAR 替换 `/www/apache-tomcat-11.0.9/webapps/ROOT.war`，然后使用原来的方式启动 Tomcat。部署完成后重新登录；若浏览器仍使用旧脚本，按 Ctrl+F5 刷新。

继续使用现有 `server.xml`、端口 8079 和 `bin/setenv.sh` 数据库设置。本次升级无需调整 Context 或 JDBC 配置。不要移走 `server.xml`。

上线验收：普通用户登录应自动看到公告，但没有发布表单；admin 登录发布后，普通用户可点击公告按钮查看。两个不同账户打开聊天室，人数应增加；点击列表可见对应用户名。双方发送私聊消息，切换群聊再返回、刷新和浏览器后退都应保留历史。

如果仍有异常，重现后查看最新 `logs/localhost.YYYY-MM-DD.log` 中的 `Announcement read failed`、`Announcement publish failed` 或 `Chat history load failed`。本地未连接阿里云服务器或生产 MySQL，因此最终部署效果需在服务器验证。

## 本地验证

```powershell
.\mvnw.cmd test
node --test src/test/js/*.test.cjs
```

初版验证包含公告权限与参数验证、在线人数去重及过期、私聊好友权限与空时间记录、网络失败恢复、每次登录弹窗、实时消息，以及嵌入式 Tomcat 实际编译和返回首页/群聊/私聊 JSP 页面。最新验证补充了 H2 数据库分页和真实浏览器回归，见 `chat-scroll-send-fix.md`。从 2026-10-12 起按用户要求只修改代码和运行测试，只有用户另行要求时才打包；上文 WAR 步骤保留为手动部署参考。
