<%@ page import="java.sql.*, com.example.yytfsupportsite.yytf.util.DBUtil, com.example.yytfsupportsite.yytf.util.Html" %>
<%
  int userId = (int) session.getAttribute("userId");
  int chatWithId = request.getParameter("chatWith") != null ? Integer.parseInt(request.getParameter("chatWith")) : -1;
  Connection conn = DBUtil.getConnection();
  PreparedStatement ps2;
  if (chatWithId == -1) {
    ps2 = conn.prepareStatement(
            "SELECT c.*, COALESCE(u.display_name, u.username) AS show_name, u.avatar " +
                    "FROM chat_messages c JOIN users u ON c.user_id = u.id " +
                    "WHERE c.receiver_id IS NULL ORDER BY c.timestamp ASC");
  } else {
    ps2 = conn.prepareStatement(
            "SELECT c.*, COALESCE(u.display_name, u.username) AS show_name, u.avatar " +
                    "FROM chat_messages c JOIN users u ON c.user_id = u.id " +
                    "WHERE (c.user_id=? AND c.receiver_id=?) OR (c.user_id=? AND c.receiver_id=?) " +
                    "ORDER BY c.timestamp ASC");
    ps2.setInt(1, userId);
    ps2.setInt(2, chatWithId);
    ps2.setInt(3, chatWithId);
    ps2.setInt(4, userId);
  }

  ResultSet rs = ps2.executeQuery();
  while (rs.next()) {
    String senderName = rs.getString("show_name");
    String avatar = rs.getString("avatar");
    if (avatar == null || avatar.isEmpty()) {
      avatar = "images/taffy1.jpg";
    }
%>
<div class="message">
  <div class="from">
    <img src="<%= Html.escape(avatar) %>" alt="头像">
    <%= Html.escape(senderName) %>
  </div>
  <%= Html.escape(rs.getString("content")) %>
  <% if (rs.getString("image_url") != null && !rs.getString("image_url").isEmpty()) { %>
  <br><img class="chat-img" src="<%= Html.escape(rs.getString("image_url")) %>" alt="图">
  <% } %>
  <div class="timestamp"><%= rs.getTimestamp("timestamp") %></div>
</div>
<%
  }
  rs.close(); ps2.close(); conn.close();
%>
