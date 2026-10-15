<%@ page contentType="text/html;charset=UTF-8" language="java" %>
<%@ page import="java.sql.*, com.example.yytfsupportsite.yytf.util.DBUtil" %>
<%
  if (session.getAttribute("userId") == null) { response.sendRedirect("login.jsp"); return; }
  int userId = (int) session.getAttribute("userId");
%>
<%!
  public String escapeHtml(String input) {
    if (input == null) return "";
    return input.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
      .replace("\"", "&quot;").replace("'", "&#39;");
  }
%>
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>通知 - 聊天室</title>
  <link rel="stylesheet" href="css/social.css?v=20261013-profile-1">
</head>
<body class="notifications-page">
<div class="container">
  <%@ include file="WEB-INF/jspf/chat-sidebar.jspf" %>
  <main class="notifications-area">
    <div class="notifications-heading">
      <h1>通知</h1>
      <a class="chat-home-button" href="home.jsp">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9"/></svg>
        <span>返回主页</span>
      </a>
    </div>
    <p class="muted">好友申请会显示在这里，同意后才能互相私聊。</p>
    <%@ include file="WEB-INF/jspf/message-alerts.jspf" %>
    <button type="button" id="refreshNotifications">刷新通知</button>
    <p id="notificationStatus" role="status">正在加载通知…</p>
    <div id="notificationList"></div>
    <button type="button" id="olderNotifications" hidden>加载更早通知</button>
  </main>
</div>
<%@ include file="WEB-INF/jspf/user-card.jspf" %>
<script src="js/social.js?v=20261013-profile-1" defer></script>
</body>
</html>
