# GramTele / YYTFSupportSite

**简介（Overview）**
GramTele（在代码中名为 `YYTFSupportSite`）是一个基于 Jakarta EE 的在线聊天室 / 社区示例项目，包含用户注册、登录、用户资料、发布帖子、私信、好友管理以及基于 WebSocket 的实时聊天功能。本 README 针对开发者/部署者给出详细说明：依赖、数据库、构建、部署、常见问题与扩展建议。

---

# 目录

1. 项目简介  
2. 主要功能  
3. 技术栈  
4. 代码结构（重要文件说明）  
5. 环境与前提条件  
6. 本地快速运行（Maven + Tomcat）  
7. Docker / docker-compose 示例（可选）  
8. 数据库：表结构建议（示例 SQL）  
9. 配置说明（必须改的项）  
10. 路由 / API 列表（Servlet 路径与说明）  
11. 安全注意事项 & 部署建议  
12. 常见问题 (Troubleshooting)
    
---

# 1. 项目简介

这是一个教学 / 演示性质的聊天室/社区系统，实现了用户注册/登录、发帖、上传（简单）、好友、私聊和管理员相关操作。适合作为课堂作业或个人练手项目。

---

# 2. 主要功能（Highlights）

- 用户注册 / 登录 / 注销
- 用户资料编辑（昵称、头像）
- 帖子发布、查询、删除（含简易 status 管理）
- 私信（private messages）
- 好友管理（add/delete）
- 实时聊天（WebSocket，endpoint: `/chatSocket/{userId}`）
- 管理员相关操作（封禁/解封用户、管理聊天记录等）
- 简单的文件上传（在 `ChatServlet` / 上传页面中使用）

---

# 3. 技术栈

- Java 22（代码 pom.xml 中指定为 Java 22）
- Jakarta EE（servlet / websocket 等，代码使用 `jakarta.*` 包）
- Maven 构建（`pom.xml`）
- MySQL（或兼容的关系型数据库）
- 前端：JSP（`src/main/webapp/*.jsp`）
- 推荐运行环境：Tomcat 10.x / Tomcat 10.1（或任何支持 Jakarta Servlet/WebSocket 的容器）

---

# 4. 代码结构（重要文件）

```
Gramtele-main/
├─ pom.xml
├─ src/main/java/com/example/yytfsupportsite/
│  ├─ HelloServlet.java
│  └─ yytf/
│     ├─ servlet/         # 各类 Servlet（业务路由）
│     ├─ websocket/       # WebSocket 实现（ChatWebSocket）
│     └─ util/            # DBUtil 等工具类
├─ src/main/webapp/
│  ├─ index.jsp
│  ├─ login.jsp
│  ├─ register.jsp
│  └─ images/
└─ README.md (原：非常简单)
```

重要类（示例）

- `DBUtil.java`：数据库连接工具（在这里设置数据库 URL/用户/密码）
- `ChatWebSocket.java`：WebSocket 后端，路径 `/chatSocket/{userId}`
- `LoginServlet.java`：`/login`
- `RegisterServlet.java`：`/register`
- `ChatServlet.java`：处理聊天/上传相关 POST 请求
- `GetPostsServlet.java`、`PostMessageServlet.java`：帖子相关
- `FetchMessagesServlet.java`、`GetMessagesServlet.java`：消息拉取相关
- 管理类：`AdminUserServlet.java`、`AdminChatServlet.java`、`vadminServlet.java`（管理员操作）

---

# 5. 环境与前提条件（Prerequisites）

- Java JDK 22（项目 pom 指定为 22）
- Maven 3.6+（用于构建）
- MySQL 8.x（或兼容 DB）
- Servlet 容器：Tomcat 10.x（支持 Jakarta EE 命名空间）
- 可选：Docker & docker-compose（见下方）

---

# 6. 本地快速运行（Maven + Tomcat）

1. 克隆/解压项目到本地机器：

   ```bash
   unzip Gramtele-main.zip
   cd Gramtele-main
   ```

2. 修改数据库配置（非常重要）  
   编辑 `src/main/java/com/example/yytfsupportsite/yytf/util/DBUtil.java`，将 `url`、`user`、`pass` 改为你自己的数据库配置。**不要在生产或公开仓库中提交明文密码**。

3. 使用 Maven 打包：

   ```bash
   mvn clean package
   ```

   打包成功后会在 `target/` 下生成一个 `.war` 文件（artifactId 名称，通常 `YYTFSupportSite-1.0-SNAPSHOT.war` 或类似）。

4. 部署到 Tomcat：

   - 将生成的 `*.war` 拷贝到 Tomcat 的 `webapps/` 目录下，启动 Tomcat（`bin/startup.sh` 或 windows 的 `startup.bat`）。
   - 访问 `http://localhost:8080/<context-path>/`（context-path 根据 war 名称或你的 Tomcat 部署而定）。

5. 初始化数据库（请参照下方的示例 SQL 建表并创建初始用户/数据）。

---

# 7. Docker / docker-compose 示例（可选）

下面是一个最小 `docker-compose.yml` 示例：一个 MySQL 服务 + 一个 Tomcat 服务（将本项目打包成 war 并挂载或构建镜像）。**注意**：示例仅供本地测试，不建议直接用于生产。

```yaml
version: "3.8"
services:
  db:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: rootpass
      MYSQL_DATABASE: yytf_support
      MYSQL_USER: yytf_support
      MYSQL_PASSWORD: your_db_password_here
    ports:
      - "3306:3306"
    volumes:
      - db-data:/var/lib/mysql

  tomcat:
    image: tomcat:10-jdk17
    ports:
      - "8080:8080"
    volumes:
      - ./target/YYTFSupportSite.war:/usr/local/tomcat/webapps/YYTFSupportSite.war:ro
    depends_on:
      - db

volumes:
  db-data:
```

使用：

1. `mvn package`
2. 将生成的 war 重命名（或路径）与 compose 中一致
3. `docker-compose up --build`

---

# 8. 数据库：表结构建议（示例 SQL）

项目代码使用了以下主要表（示例字段基于代码引用，可能需按需调整）：

```sql
CREATE DATABASE IF NOT EXISTS yytf_support CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE yytf_support;

-- 用户表
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  avatar VARCHAR(500),
  is_admin TINYINT(1) DEFAULT 0,
  is_banned TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 聊天/公共消息（posts / timeline）
CREATE TABLE posts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  content TEXT,
  status VARCHAR(50) DEFAULT 'active', -- active/deleted/hidden
  likes INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 即时/公聊消息（也可用于历史记录）
CREATE TABLE chat_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  receiver_id INT NULL, -- NULL 表示公共频道
  content TEXT,
  image_url VARCHAR(500),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 私信
CREATE TABLE private_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sender_id INT NOT NULL,
  receiver_id INT NOT NULL,
  content TEXT,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sender_id) REFERENCES users(id),
  FOREIGN KEY (receiver_id) REFERENCES users(id)
);

-- 好友关系（双向或单向按代码逻辑）
CREATE TABLE friends (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  friend_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_friend (user_id, friend_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (friend_id) REFERENCES users(id)
);
```

> 说明：上面是一个推荐的初始 schema，实际字段名/类型请与代码中的 SQL 语句吻合或调整代码使其匹配数据库。

---

# 9. 配置说明（必须注意）

- `DBUtil.java`：数据库连接 URL、用户名与密码硬编码在该文件中。建议改为：
  - 使用环境变量读取（`System.getenv("DB_USER")` 等），或
  - 使用 `properties` 文件（`application.properties`）并将其加入 `.gitignore`，或
  - 使用容器 secrets / 外部配置服务。
- Tomcat/容器：确保使用支持 Jakarta 命名空间（`jakarta.*`）的容器（Tomcat 10+）。
- 端口：默认 Tomcat 8080，可在容器/服务器上调整。

---

# 10. 路由 & API（主要 Servlet）

下面列出源码中发现的 servlet 路径与用途（按 `@WebServlet` 注解）：

- `/register` — 注册（`RegisterServlet`）  
- `/login` — 登录（`LoginServlet`）  
- `/logout` — 注销（`LogoutServlet`）  
- `/ChatServlet` — 主要 Chat POST 处理（`ChatServlet`）  
- `/chatSocket/{userId}` — WebSocket 连接点（`ChatWebSocket`，路径通过注解 `/chatSocket/{userId}`）  
- `/GetPostsServlet` — 获取帖子（分页）  
- `/postMessage` — 发布帖子（`PostMessageServlet`）  
- `/FetchMessagesServlet`, `/GetMessagesServlet` — 消息拉取/获取  
- `/AddFriendServlet`, `/DeleteFriendServlet` — 好友操作  
- `/SendPrivateMessageServlet` — 发送私信  
- 管理/辅助：`/AdminUserServlet`, `/AdminChatServlet`, `/vadminServlet`, `/deleteUser`, `/deletePost`, `/deleteChat` 等

> 具体请求参数和返回页面（JSP）以 `src/main/webapp/*.jsp` 为准。可以通过阅读每个 Servlet 的 `doGet` / `doPost` 方法获取详细参数名与行为。

---

# 11. 安全注意事项 & 部署建议

- **不要在版本控制中存储真实密码**（目前仓库里的 `DBUtil` 示例使用硬编码密码 — 请务必替换）。  
- 对用户密码使用安全的单向哈希（例如 `bcrypt`/`argon2`），**不要直接以明文存储密码**。目前代码在 `users` 表采用明文对比（建议改进）。  
- 对用户输入做 XSS/SQL 注入防护：项目包含 `XSSFilter`，但请确保所有 SQL 使用 `PreparedStatement`（此项目多数已使用）。  
- 将数据库用户权限降到最小（只给应用所需权限，避免使用 root）。  
- 上线前通过 HTTPS 提供服务（在反向代理 Nginx 或云 LB 前配置 TLS）。  
- 日志与异常处理：增加统一异常处理与日志（Logback/SLF4J）以便排查问题。

---

# 12. 常见问题 (Troubleshooting)

- **无法连接数据库**：确认 MySQL 已启动、端口、数据库名、用户名与密码正确；确认防火墙或容器网络允许访问。  
- **部署后页面 404 或 WebSocket 连接失败**：确认 war 部署后的 context path（URL）是否正确；WebSocket 需使用支持 Jakarta 的容器（Tomcat 10+）。  
- **登录失败**：检查数据库中是否已存在用户记录，密码是否与代码逻辑一致（是否加密）。  
- **编译/打包失败**：确认 Maven 与 JDK 版本（JDK 22）匹配；若无法安装 JDK 22，可将 `pom.xml` 中的 source/target 改为你本地支持的版本（例如 17），同时在代码中确认没有使用仅 22 支持的语言特性。

