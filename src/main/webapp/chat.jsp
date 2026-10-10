<%@ page contentType="text/html;charset=UTF-8" language="java" %>
<%@ page import="java.sql.*, com.example.yytfsupportsite.yytf.util.DBUtil" %>

<%
  if (session.getAttribute("userId") == null) {
    response.sendRedirect("login.jsp");
    return;
  }

  int userId = (int) session.getAttribute("userId");
  String username = (String) session.getAttribute("username");
  String selectedChatUserIdParam = request.getParameter("chatWith");
  int chatWithId = -1;
  try { if (selectedChatUserIdParam != null) chatWithId = Integer.parseInt(selectedChatUserIdParam); }
  catch (NumberFormatException ignored) { response.sendError(400, "无效的聊天对象"); return; }
%>

<%!
  public String escapeHtml(String input) {
    if (input == null) return "";
    StringBuilder sb = new StringBuilder(input.length());
    for (char c : input.toCharArray()) {
      switch (c) {
        case '<': sb.append("&lt;"); break;
        case '>': sb.append("&gt;"); break;
        case '&': sb.append("&amp;"); break;
        case '"': sb.append("&quot;"); break;
        case '\'': sb.append("&#x27;"); break;
        case '/': sb.append("&#x2F;"); break;
        default: sb.append(c);
      }
    }
    return sb.toString();
  }
%>

<html>

<head>
  <title>聊天室</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Arial, sans-serif;
      background: url('images/chat/background.png') repeat;
      height: 100vh;
    }
    .container {
      display: flex;
      height: 100vh;
    }
    .sidebar {
      width: 280px;
      background-color: #e6e6e6;
      border-right: 1px solid #ccc;
      padding: 20px;
      overflow-y: auto;
    }
    .group, .friend {
      background-color: #fff;
      padding: 12px;
      margin-bottom: 10px;
      border-radius: 8px;
      cursor: pointer;
      box-shadow: 1px 1px 4px rgba(0,0,0,0.1);
    }
    .group:hover, .friend:hover {
      background-color: #d4f1ff;
    }
    .chat-area {
      flex: 1;
      display: flex;
      flex-direction: column;
      background-color: rgba(255,255,255,0.9);
    }
    .chat-header {
      padding: 15px 20px;
      border-bottom: 1px solid #ccc;
      font-weight: bold;
      font-size: 18px;
      background-color: #f8f8f8;
    }
    .chat-messages {
      flex: 1;
      padding: 20px;
      overflow-y: auto;
    }
    .message {
      margin-bottom: 15px;
      background-color: #ffffffcc;
      border-radius: 10px;
      padding: 10px 15px;
      max-width: 70%;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    }
    .from {
      font-weight: bold;
      color: #2f4f4f;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .from img {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      object-fit: cover;
    }
    .timestamp {
      font-size: 0.8em;
      color: #999;
      margin-top: 5px;
    }
    .chat-form {
      display: flex;
      gap: 10px;
      padding: 15px 20px;
      border-top: 1px solid #ccc;
      background-color: #f9f9f9;
    }
    .chat-form input[type="text"] {
      flex: 1;
      padding: 10px;
      border-radius: 20px;
      border: 1px solid #ccc;
    }
    .chat-form input[type="file"] {
      border: none;
    }
    .chat-form input[type="submit"] {
      padding: 10px 18px;
      background-color: #0088cc;
      color: white;
      border: none;
      border-radius: 20px;
      font-weight: bold;
      cursor: pointer;
    }
    .message img.chat-img {
      max-width: 200px;
      border-radius: 8px;
      margin-top: 8px;
    }
  </style>

</head>
<body>
<div id="adminConsole" style="display:none; position:fixed; bottom:20px; left:50%; transform:translateX(-50%); background:#fff; border:2px solid #999; border-radius:10px; padding:20px; z-index:9999; box-shadow:0 0 15px rgba(0,0,0,0.3);">
  <h3 style="margin-bottom:10px; text-align:center;">管理员控制台</h3>
  <input id="consoleInput" type="text" placeholder="输入命令..." style="padding:8px 10px; width:300px; border-radius:5px; border:1px solid #ccc;">
</div>
<script>
  let consoleActive = false;
  document.addEventListener("keydown", function(e) {
    if (!consoleActive) {
      window._keySequence = (window._keySequence || "") + e.key.toLowerCase();
      if (window._keySequence.includes("consoletf")) {

        document.getElementById("adminConsole").style.display = "block";
        setTimeout(() => {
          document.getElementById("consoleInput").focus();
        }, 1000);

        consoleActive = true;
        window._keySequence = "";
      }
    } else if (e.key === "Escape") {
      document.getElementById("adminConsole").style.display = "none";
      consoleActive = false;
    }
  });

  document.addEventListener("click", function(e) {
    const popup = document.getElementById("adminConsole");
    if (consoleActive && !popup.contains(e.target)) {
      popup.style.display = "none";
      consoleActive = false;
    }
  });

  document.getElementById("consoleInput").addEventListener("keydown", function(e) {
    if (e.key === "Enter") {
      const val = this.value.trim().toLowerCase();
      if (val === "wedding") {
        window.location.href = "sihuo.jsp";
      } else if (val.startsWith("admin -")) {
        const key = val.split("-")[1].trim();
        if (key === "1991617") {
          window.location.href = "chatadmin.jsp";
        } else {
          alert("密钥无效");
        }
      } else {
        alert("未知命令");
      }
      this.value = "";
      document.getElementById("adminConsole").style.display = "none";
      consoleActive = false;
    }
  });
</script>

<div class="container">
  <!-- 左侧好友栏 -->
  <div class="sidebar">
    <div class="group" onclick="location.href='chat.jsp?chatWith=-1'">👥 群组：共产国际</div>
    <hr>
    <h4>好友列表</h4>
    <%
      Connection conn = DBUtil.getConnection();
      PreparedStatement ps = conn.prepareStatement(
              "SELECT u.id, COALESCE(u.display_name, u.username) AS show_name " +
                      "FROM users u " +
                      "WHERE u.id IN (SELECT friend_id FROM friends WHERE user_id = ? " +
                      "UNION SELECT user_id FROM friends WHERE friend_id = ?)"
      );
      ps.setInt(1, userId);
      ps.setInt(2, userId);
      ResultSet frs = ps.executeQuery();
      while (frs.next()) {
        int fid = frs.getInt("id");
        String fname = frs.getString("show_name");
    %>
    <div class="friend" onclick="location.href='chat.jsp?chatWith=<%=fid%>'">💬 <%= escapeHtml(fname) %></div>
    <%
      }
      frs.close();
      ps.close();
    %>
  </div>
  <!-- 聊天区域 -->
  <div class="chat-area">
    <div class="chat-header">
      <%
        if (chatWithId == -1) {
          out.print("群聊：共产国际");
        } else {
          PreparedStatement p = conn.prepareStatement(
                  "SELECT COALESCE(display_name, username) AS show_name FROM users WHERE id=?"
          );
          p.setInt(1, chatWithId);
          ResultSet r = p.executeQuery();
          if (r.next()) out.print("私聊：" + escapeHtml(r.getString("show_name")));
          r.close(); p.close();

        }
      %>
      <%
        if (chatWithId != -1) {
      %>
      <button onclick="deleteFriend(<%= chatWithId %>)"
              style="margin-left: 20px; padding: 5px 10px; background-color: #e74c3c; color: white; border: none; border-radius: 6px; font-size: 13px; cursor: pointer;">
        删除好友
      </button>
      <%
        }
      %>
      <span id="connectionStatus" role="status" style="font-size:12px; color:#666; margin-left:12px;"></span>
    </div>
    <% conn.close(); %>
    <div class="chat-messages" id="chatBox" data-user-id="<%= userId %>" data-chat-with="<%= chatWithId %>" data-context-path="<%= escapeHtml(request.getContextPath()) %>">
      <!-- 留空，WebSocket 会动态添加 -->
    </div>
    <!-- 消息输入区域 -->

    <form class="chat-form" method="post" action="ChatServlet" enctype="multipart/form-data">
      <input type="text" name="content" placeholder="输入消息..." id="chatInput">
      <input type="hidden" name="chatWithId" value="<%= chatWithId %>">
      <input type="file" name="image">
      <input type="submit" value="发送">
    </form>
  </div>
</div>

<div style="position: absolute; top: 10px; right: 10px;">
  <button onclick="location.href='home.jsp'">🏠 返回主页</button>
</div>
<script src="js/chat.js" defer></script>
</body>
</html>
