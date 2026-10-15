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
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>聊天室</title>
  <link rel="stylesheet" href="css/dialog.css">
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
      min-width: 0;
      min-height: 0;
      position: relative;
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
      min-height: 0;
      padding: 20px;
      overflow-y: auto;
      overflow-anchor: none;
      scroll-behavior: auto;
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
      flex-shrink: 0;
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
      display: block;
      width: 200px;
      height: 200px;
      max-width: 100%;
      object-fit: contain;
      background: #f2f5f7;
      border-radius: 8px;
      margin-top: 8px;
    }
    .history-control { display: block; margin: 0 auto 16px; padding: 6px 12px; }
    #historyStatus, #sendStatus { position: absolute; left: 20px; right: 20px; z-index: 2; background: #fff3df; color: #7a4200; padding: 8px; font-size: 13px; }
    #historyStatus { top: 58px; }
    #sendStatus { bottom: 72px; }
    [hidden] { display: none !important; }
  </style>
  <link rel="stylesheet" href="css/social.css?v=20261013-profile-1">

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
  <%@ include file="WEB-INF/jspf/chat-sidebar.jspf" %>
  <!-- 聊天区域 -->
  <div class="chat-area">
    <div class="chat-header">
      <div class="chat-heading">
      <h1 class="chat-title">
      <%
        if (chatWithId == -1) {
          out.print("群聊：共产国际");
        } else {
          try (Connection conn = DBUtil.getConnection()) {
          PreparedStatement p = conn.prepareStatement(
                  "SELECT COALESCE(display_name, username) AS show_name FROM users WHERE id=?"
          );
          p.setInt(1, chatWithId);
          ResultSet r = p.executeQuery();
          if (r.next()) out.print("私聊：" + escapeHtml(r.getString("show_name")));
          r.close(); p.close();
          }

        }
      %>
      </h1>
      <a class="chat-home-button" href="home.jsp">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9"/></svg>
        <span>返回主页</span>
      </a>
      </div>
      <div class="chat-toolbar">
      <%
        if (chatWithId != -1) {
      %>
      <button type="button" class="delete-friend-button" onclick="deleteFriend(<%= chatWithId %>)">
        删除好友
      </button>
      <%
        }
      %>
      <span id="connectionStatus" role="status"></span>
      <% if (chatWithId == -1) { %>
      <button type="button" id="onlineButton">在线人数：加载中</button>
      <% } %>
      <%@ include file="WEB-INF/jspf/message-alerts.jspf" %>
      </div>
    </div>

    <p id="historyStatus" role="alert" hidden></p>
    <div class="chat-messages" id="chatBox" data-user-id="<%= userId %>" data-chat-with="<%= chatWithId %>" data-context-path="<%= escapeHtml(request.getContextPath()) %>">
      <button type="button" id="loadOlder" class="history-control" hidden>加载更早记录</button>
      <div id="messageList"></div>
    </div>
    <!-- 消息输入区域 -->

    <p id="sendStatus" role="alert" hidden></p>
    <form id="chatForm" class="chat-form" method="post" action="ChatServlet" enctype="multipart/form-data">
      <input type="text" name="content" placeholder="输入消息..." id="chatInput" maxlength="4000">
      <input type="hidden" name="chatWithId" value="<%= chatWithId %>">
      <input type="file" name="image" id="chatImage" accept="image/jpeg,image/png,image/gif,image/webp" hidden>
      <button type="button" id="attachImage" class="composer-icon-button" aria-label="选择图片" title="选择图片">
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m4 18 5-5 3 3 4-6 5 8"/></svg>
      </button>
      <div class="emoji-control">
        <button type="button" id="emojiButton" aria-label="插入表情" aria-controls="emojiPicker" aria-expanded="false" data-catalogue="js/emoji-data.json?v=18.0-1">😀</button>
        <div id="emojiPicker" role="group" aria-label="选择表情" hidden>
          <div class="emoji-heading"><strong>选择表情</strong><span id="emojiCount" role="status"></span></div>
          <div class="emoji-filters">
            <input type="search" id="emojiSearch" aria-label="搜索表情" placeholder="搜索中文 / English / emoji" autocomplete="off" disabled>
            <select id="emojiCategory" aria-label="表情分类" disabled><option value="">全部分类</option></select>
          </div>
          <div class="emoji-grid" id="emojiGrid" role="group" aria-label="表情列表"></div>
          <div class="emoji-pagination">
            <button type="button" id="emojiPrev" aria-controls="emojiGrid">上一页</button>
            <span id="emojiPage" role="status"></span>
            <button type="button" id="emojiNext" aria-controls="emojiGrid">下一页</button>
          </div>
          <p id="emojiStatus" role="status" hidden></p>
          <button type="button" id="emojiRetry" hidden>重新加载</button>
        </div>
      </div>
      <input type="submit" value="发送" id="sendButton" disabled>
      <div id="chatAttachment" class="chat-attachment" hidden>
        <span id="chatAttachmentName"></span><button type="button" id="clearChatImage" aria-label="移除已选图片">移除</button>
      </div>
    </form>
  </div>
</div>

<%@ include file="WEB-INF/jspf/user-card.jspf" %>
<script src="js/social.js?v=20261013-profile-1" defer></script>
<script src="js/chat.js?v=20261013-profile-1" defer></script>
<script src="js/chat-attachment.js?v=20261013-1" defer></script>
<script src="js/emoji-support.js?v=20261013-1" defer></script>
<script src="js/emoji.js?v=20261013-1" defer></script>
<dialog id="onlineDialog" class="site-dialog" aria-labelledby="onlineHeading">
  <div class="dialog-header"><h2 id="onlineHeading">当前在线用户</h2><button type="button" id="onlineClose">关闭</button></div>
  <p>正在使用聊天室的用户</p>
  <p id="onlineStatus" role="status"></p>
  <ul id="onlineList"></ul>
</dialog>
<script src="js/presence.js" defer></script>
</body>
</html>
