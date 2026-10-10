<%@ page import="java.sql.*, com.example.yytfsupportsite.yytf.util.DBUtil, com.example.yytfsupportsite.yytf.util.Html" %>
<%
  request.setCharacterEncoding("UTF-8");

  int userId = Integer.parseInt(request.getParameter("userId"));
  int chatWithId = Integer.parseInt(request.getParameter("chatWith"));
  String lastTimestampStr = request.getParameter("lastTime");

  Connection conn = DBUtil.getConnection();
  PreparedStatement ps;
  if (chatWithId == -1) {
    ps = conn.prepareStatement(
            "SELECT c.*, COALESCE(u.display_name, u.username) AS show_name, u.avatar " +
                    "FROM chat_messages c JOIN users u ON c.user_id = u.id " +
                    "WHERE c.receiver_id IS NULL AND c.timestamp > ? ORDER BY c.timestamp ASC");
    ps.setTimestamp(1, Timestamp.valueOf(lastTimestampStr));
  } else {
    ps = conn.prepareStatement(
            "SELECT c.*, COALESCE(u.display_name, u.username) AS show_name, u.avatar " +
                    "FROM chat_messages c JOIN users u ON c.user_id = u.id " +
                    "WHERE ((c.user_id=? AND c.receiver_id=?) OR (c.user_id=? AND c.receiver_id=?)) AND c.timestamp > ? " +
                    "ORDER BY c.timestamp ASC");
    ps.setInt(1, userId);
    ps.setInt(2, chatWithId);
    ps.setInt(3, chatWithId);
    ps.setInt(4, userId);
    ps.setTimestamp(5, Timestamp.valueOf(lastTimestampStr));
  }

  ResultSet rs = ps.executeQuery();
  while (rs.next()) {
    String senderName = rs.getString("show_name");
    String avatar = rs.getString("avatar");
    if (avatar == null || avatar.isEmpty()) {
      avatar = "images/taffy1.jpg";
    }
%>
<div class="message" data-time="<%= rs.getTimestamp("timestamp") %>">
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
  rs.close(); ps.close(); conn.close();
%>
